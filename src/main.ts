import './styles.css'
import type { OriginGuess, Platform } from './types'
import { getState, resetState, setState, subscribe } from './state'
import { render, type Handlers } from './ui/render'
import { getCurrentFix, nearestStations } from './services/geo'
import { guessOrigin, isGuessUsable } from './services/originGuess'
import { rankExits } from './services/exitPicker'
import { DESTINATIONS, IKEBUKURO } from './data/stations'
import { usingMock } from './services/odpt'

const root = document.getElementById('app')!

const handlers: Handlers = {
  onAcceptGuess(guess: OriginGuess) {
    // 推定をユーザーが承認した = originSource は 'guessed'
    setState({ origin: guess.platform, originSource: 'guessed', screen: 'pickDest' })
  },
  onOpenManualPick() {
    setState({ screen: 'pickOrigin' })
  },
  onPickPlatform(platform: Platform) {
    setState({ origin: platform, originSource: 'manual', screen: 'pickDest' })
  },
  onPickDestination(id: string) {
    const s = getState()
    const destination = DESTINATIONS.find((d) => d.id === id)
    if (!s.station || !s.origin || !destination) return
    setState({
      destination,
      candidates: rankExits(s.station, s.origin, destination),
      screen: 'result',
    })
  },
  onRestart() {
    resetState()
    void start()
  },
}

subscribe((s) => render(root, s, handlers))
render(root, getState(), handlers)

async function start(): Promise<void> {
  setState({ usingMock: usingMock() })

  // 1) どの駅にいるか（数百m粒度）。ここは地下でも取れることが多い。
  let accuracy: number | null = null
  let station = IKEBUKURO

  try {
    const fix = await getCurrentFix()
    accuracy = fix.accuracy
    const near = nearestStations(fix.position, 1)[0]
    // TODO: 駅が増えたら「近い駅3つから1タップで選ばせる」画面を足す
    if (near) station = near.station
  } catch (e) {
    // 位置情報が使えなくてもアプリは止めない。池袋にいる前提で進める。
    // TODO: 駅の手動選択画面を出す
    console.warn('[geo] 位置情報を取得できなかったため池袋駅で進めます', e)
  }

  setState({ station, accuracy })

  // 2) ★ 起点（どのホームから来たか）の推定
  try {
    const { guesses, mocked } = await guessOrigin(station, { accuracy })
    setState({
      guesses,
      usingMock: mocked,
      // 推定が弱いときは「当てにいく」画面を飛ばして、いきなり一覧を出す。
      // 推定が主、入力は保険。外して訂正させる回数を増やさない。
      screen: isGuessUsable(guesses[0]) ? 'guessOrigin' : 'pickOrigin',
    })
  } catch (e) {
    setState({ screen: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

void start()
