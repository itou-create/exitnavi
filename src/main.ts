import './styles.css'
import type { OriginGuess, Platform, Station } from './types'
import { getState, resetState, setState, subscribe } from './state'
import { render, type Handlers } from './ui/render'
import { getCurrentFix, nearestStations } from './services/geo'
import { guessOrigin, isGuessUsable } from './services/originGuess'
import { rankExits } from './services/exitPicker'
import { DESTINATIONS, IKEBUKURO, STATIONS } from './data/stations'
import { setDemoMode, usingMock } from './services/odpt'

/**
 * 「この駅にいる」と自動判定してよい距離の上限。
 * これより遠い・測位できない場合は pickStation 画面で選ばせる。
 * 池袋と偽って進めない（設計原則: 嘘の精度を表示しない）。
 */
const STATION_RADIUS_METERS = 1200

const root = document.getElementById('app')!

const handlers: Handlers = {
  onPickStation(station: Station) {
    void proceedWithStation(station)
  },
  onStartDemo() {
    // 駅の近くにいない人向けのデモ。モックデータで池袋に着いた想定で流れを見せる。
    // モックであることは statusbar のチップで明示され続ける。
    setDemoMode(true)
    setState({ usingMock: true })
    void proceedWithStation(IKEBUKURO)
  },
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
    setDemoMode(false)
    resetState()
    void start()
  },
}

subscribe((s) => render(root, s, handlers))
render(root, getState(), handlers)

async function start(): Promise<void> {
  setState({ usingMock: usingMock() })

  // 1) どの駅にいるか（数百m粒度）。ここは地下でも取れることが多い。
  try {
    const fix = await getCurrentFix()
    setState({ accuracy: fix.accuracy })

    const near = nearestStations(fix.position, 3)
    const best = near[0]

    if (best && best.meters <= STATION_RADIUS_METERS) {
      await proceedWithStation(best.station)
      return
    }

    // 対応駅の圏外。池袋（先頭の駅）と偽らず、正直に選ばせる。
    setState({
      screen: 'pickStation',
      stationChoices: near.map((n) => ({ station: n.station, meters: n.meters })),
      locateNote: best
        ? `対応駅の近くにいないようです（最寄りの対応駅: ${best.station.name} 約${fmtDistance(best.meters)}）。試す駅を選んでください。`
        : '対応駅が見つかりませんでした。試す駅を選んでください。',
    })
  } catch (e) {
    // 位置情報が使えなくてもアプリは止めない。駅を選ばせて進める。
    setState({
      screen: 'pickStation',
      stationChoices: STATIONS.map((station) => ({ station, meters: null })),
      locateNote: `位置情報を取得できませんでした（${e instanceof Error ? e.message : String(e)}）。いる駅を選んでください。`,
    })
  }
}

/** 駅が確定してから先の共通フロー（自動判定でも手動選択でも同じ） */
async function proceedWithStation(station: Station): Promise<void> {
  const { accuracy } = getState()
  setState({ station })

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

function fmtDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)}km`
}

void start()
