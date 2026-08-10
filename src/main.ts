import './styles.css'
import type { BoardedPosition, Destination, OriginGuess, Platform, Station } from './types'
import { getState, resetState, setState, subscribe } from './state'
import { render, type Handlers } from './ui/render'
import { getCurrentFix, isOutdoor, nearestStations } from './services/geo'
import { guessOrigin, isGuessUsable } from './services/originGuess'
import { rankExits } from './services/exitPicker'
import { buildGuideSteps, canPersonalizeOrient } from './services/guide'
import { IKEBUKURO, STATIONS } from './data/stations'
import { setDemoMode, usingMock } from './services/odpt'
import { stopCompass } from './services/compass'
import { startStepCounter, stopStepCounter } from './services/steps'
import { startTurnDetector, stopTurnDetector } from './services/turn'
import * as telemetry from './services/telemetry'
import { communityEdgeFor, communityRouteFor } from './data/measured'

/**
 * 「この駅にいる」と自動判定してよい距離の上限。
 * これより遠い・測位できない場合は pickStation 画面で選ばせる。
 * 池袋と偽って進めない（設計原則: 嘘の精度を表示しない）。
 */
const STATION_RADIUS_METERS = 1200

const root = document.getElementById('app')!

/* ------------------------- 自動判定モード ------------------------- */
// 歩数・ジャイロ・測位精度の閾値で「次へ」の申告を代行する。
// 現在地を測って進めるのではなく、「指示どおりの行動を検知」して進める。

let autoAdvanceTimer: number | null = null
let geoWatchId: number | null = null

function stopAllSensors(): void {
  stopCompass()
  stopStepCounter()
  stopTurnDetector()
  if (autoAdvanceTimer != null) {
    clearTimeout(autoAdvanceTimer)
    autoAdvanceTimer = null
  }
  if (geoWatchId != null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(geoWatchId)
    geoWatchId = null
  }
}

/** 自動判定の状況表示（render が置く #autostatus を直接更新。60Hz再描画を避ける） */
function setAutoStatus(textContent: string): void {
  const node = document.getElementById('autostatus')
  if (node && node.textContent !== textContent) node.textContent = textContent
}

function engageAuto(): void {
  const s = getState()
  if (!s.autoGuide || s.screen !== 'guide') return
  const step = s.guideSteps[s.guideIndex]
  if (!step) return
  const isLast = s.guideIndex === s.guideSteps.length - 1

  const parts: { walk?: string; turn?: string; done?: string } = {}
  const renderStatus = () => {
    const live = [parts.walk, parts.turn].filter(Boolean).join(' ／ ')
    const fallback = isLast
      ? '測位で「地上に出た」を監視中…'
      : step.kind === 'move'
        ? '階段・エスカレーターを上がりきったら「次へ」を押してください'
        : 'このステップは自動判定の材料が無いため「次へ」で進んでください'
    setAutoStatus(parts.done ?? (live || fallback))
  }

  // 判定材料の整理:
  //   distTarget  : 歩行距離の目安（m）
  //   stairTarget : 階段の段数（move ステップ。らせん階段でも歩数は数えられる。
  //                 回転は階段では信用できないため一切使わない）
  //   dirTarget   : 曲がる方向。ただし「曲がっただけ」は周りを見回しただけでも
  //                 起きるので、曲がり検知後にさらに数歩進んだら確定とする
  const distTarget = step.distanceMeters ?? null
  const stairTarget = step.kind === 'move' && step.stairCount ? Math.ceil(step.stairCount * 0.8) : null
  const dirTarget = step.direction && step.direction !== 'straight' && step.kind !== 'move' ? step.direction : null

  // 明示データが無いステップでも、実測プロファイルがあれば自動判定できる。
  // 優先順位: この端末の実測（2回以上）→ コミュニティ集約（data/measured.ts）
  // ここが「たくさんのデータで精度が上がる」の本体。
  let learnedTarget: number | null = null
  let learnedLabel = ''
  const best = s.candidates[0]
  if (distTarget == null && stairTarget == null && !isLast && s.station && s.origin && best) {
    // 優先1: エッジ（区間）単位の実測。別の出口へ歩いた記録でも同じ区間なら効く
    const edgeLocal = step.edgeId ? telemetry.localEdgeProfile(step.edgeId) : null
    const edgeCommunity = step.edgeId ? communityEdgeFor(step.edgeId) : null
    // 優先2: 経路×ステップ位置の実測（ネットワーク未整備の駅向け）
    const local = telemetry.localStepProfile(
      s.station.id, s.origin.id, best.exit.id, s.guideIndex, step.kind,
    )
    if (edgeLocal && edgeLocal.samples >= 2 && edgeLocal.medianSteps != null && edgeLocal.medianSteps >= 5) {
      learnedTarget = Math.max(4, Math.ceil(edgeLocal.medianSteps * 0.9))
      learnedLabel = `この区間のあなたの実測${edgeLocal.samples}回`
    } else if (edgeCommunity && edgeCommunity.steps != null && edgeCommunity.steps >= 5) {
      learnedTarget = Math.max(4, Math.ceil(edgeCommunity.steps * 0.9))
      learnedLabel = `この区間のみんなの実測${edgeCommunity.samples}件`
    } else if (local.samples >= 2 && local.medianSteps != null && local.medianSteps >= 5) {
      learnedTarget = Math.max(4, Math.ceil(local.medianSteps * 0.9))
      learnedLabel = `あなたの実測${local.samples}回`
    } else {
      const community = communityRouteFor(s.station.id, s.origin.id, best.exit.id)
      const cs = community?.steps[s.guideIndex]
      if (community && cs && cs.kind === step.kind && cs.steps != null && cs.steps >= 5) {
        learnedTarget = Math.max(4, Math.ceil(cs.steps * 0.9))
        learnedLabel = `みんなの実測${community.samples}件`
      }
    }
  }

  const hasCriteria = distTarget != null || stairTarget != null || dirTarget != null || learnedTarget != null

  const CONFIRM_STEPS_AFTER_TURN = 4
  const stride = telemetry.strideInfo().meters

  let advanced = false
  let distanceDone = distTarget == null && stairTarget == null && learnedTarget == null
  let turnConfirmed = dirTarget == null
  let turnHit = false
  let stepsNow = 0
  let stepsAtTurn: number | null = null

  const evalTurnConfirm = () => {
    if (!dirTarget || turnConfirmed) return
    if (turnHit && stepsAtTurn != null && stepsNow >= stepsAtTurn + CONFIRM_STEPS_AFTER_TURN) {
      turnConfirmed = true
      parts.turn = '✓ 曲がって進んでいます'
    }
  }

  const maybeAdvance = () => {
    if (advanced || !hasCriteria || !distanceDone || !turnConfirmed || isLast) return
    advanced = true
    parts.done = '✓ 検知しました — 次のステップへ進みます'
    renderStatus()
    try { navigator.vibrate?.(60) } catch { /* 対応していない端末は無視 */ }
    autoAdvanceTimer = window.setTimeout(() => handlers.onGuideStep(1), 1200)
  }

  // 歩数（距離・階段の上りきり・実測プロファイル・曲がり後の確定、すべての土台）
  const needSteps =
    distTarget != null || stairTarget != null || dirTarget != null || learnedTarget != null ||
    step.kind === 'walk' || step.kind === 'orient'
  if (needSteps) {
    void startStepCounter((n) => {
      stepsNow = n
      const meters = Math.round(n * stride)
      telemetry.noteSensors({ walkSteps: n })
      if (stairTarget != null) {
        if (n >= stairTarget) {
          distanceDone = true
          parts.walk = `✓ 階段を上がりきった頃です（${n}歩）`
        } else {
          parts.walk = `階段 ${n}歩／約${step.stairCount}段`
        }
      } else if (distTarget != null) {
        if (meters >= distTarget) {
          distanceDone = true
          parts.walk = `✓ 目安の${distTarget}mに到達`
        } else {
          parts.walk = `歩行 約${meters}m／目安${distTarget}m`
        }
      } else if (learnedTarget != null) {
        if (n >= learnedTarget) {
          distanceDone = true
          parts.walk = `✓ 実測目安の${learnedTarget}歩に到達（${learnedLabel}）`
        } else {
          parts.walk = `${n}歩／実測目安${learnedTarget}歩（${learnedLabel}）`
        }
      } else {
        parts.walk = `歩行 約${meters}m`
      }
      evalTurnConfirm()
      renderStatus()
      maybeAdvance()
    })
  }

  // ジャイロ → 曲がりの検知（階段ステップでは使わない。らせん階段で誤検知するため）
  if (dirTarget) {
    const targetDeg = dirTarget === 'u-turn' ? 150 : dirTarget.startsWith('slight') ? 30 : 60
    const wantRight = dirTarget === 'right' || dirTarget === 'slight-right'
    void startTurnDetector((cum) => {
      telemetry.noteSensors({ turnDeg: cum })
      const ok = dirTarget === 'u-turn'
        ? Math.abs(cum) >= targetDeg
        : wantRight ? cum >= targetDeg : cum <= -targetDeg
      if (ok && !turnHit) {
        turnHit = true
        stepsAtTurn = stepsNow
      }
      if (!turnConfirmed) {
        parts.turn = turnHit
          ? '✓ 曲がりを検知 — そのまま数歩進むと確定します'
          : `回転 ${cum > 0 ? '右' : '左'}${Math.round(Math.abs(cum))}°／目標${targetDeg}°`
      }
      evalTurnConfirm()
      renderStatus()
      maybeAdvance()
    })
  }

  // 最終ステップ → 測位精度の改善で「地上に出た」を自動判定
  if (isLast && 'geolocation' in navigator) {
    geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy
        if (isOutdoor(acc)) {
          telemetry.noteOutdoor(acc)
          setState({
            accuracy: acc,
            guideArrivalNote: `測位精度が±${Math.round(acc)}mに改善 — 地上に出たと判定しました 🎉`,
          })
          if (geoWatchId != null) {
            navigator.geolocation.clearWatch(geoWatchId)
            geoWatchId = null
          }
        }
      },
      () => { /* 測位失敗は無視（手動ボタンが残っている） */ },
      { enableHighAccuracy: true, maximumAge: 5000 },
    )
  }

  renderStatus()
}

/** ステップ遷移後に自動判定を仕掛け直す（描画完了を待ってから） */
function reengageAuto(): void {
  window.setTimeout(engageAuto, 0)
}

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
    // 推定をユーザーが承認した = originSource は 'guessed'。
    // 列車を覚えておく（走り去った方向の計算に使う）
    setState({
      origin: guess.platform,
      originSource: 'guessed',
      originTrain: guess.train ?? null,
      screen: 'pickDest',
    })
  },
  onOpenManualPick() {
    setState({ screen: 'pickOrigin' })
  },
  onPickPlatform(platform: Platform) {
    setState({ origin: platform, originSource: 'manual', originTrain: null, screen: 'pickDest' })
  },
  onPickDestination(destination: Destination) {
    const s = getState()
    if (!s.station || !s.origin) return
    setState({
      destination,
      candidates: rankExits(s.station, s.origin, destination),
      screen: 'result',
    })
  },
  onStartGuide() {
    // 最上位候補の出口への案内を開始する。
    // 降車直後の個別化（乗車位置×走り去った方向）ができるなら、まず乗車位置を聞く
    const s = getState()
    const best = s.candidates[0]
    if (!s.station || !s.origin || !best) return
    if (canPersonalizeOrient(s.station, s.origin, best, s.originTrain)) {
      setState({ screen: 'askBoarded' })
      return
    }
    startGuideWith(null)
  },
  onPickBoarded(pos: BoardedPosition | null) {
    startGuideWith(pos)
  },
  onGuideStep(delta: number) {
    stopAllSensors()
    const s = getState()
    const next = Math.min(Math.max(s.guideIndex + delta, 0), s.guideSteps.length - 1)
    // 前進のときだけ実測を記録する（戻りは記録しない）
    if (delta > 0 && next !== s.guideIndex) {
      telemetry.advanceStep(s.guideSteps[next] ?? null)
    }
    setState({ guideIndex: next })
    reengageAuto()
  },
  onGuideExit() {
    // 案内をやめて結果画面へ戻る（データは保持）。中断した計測は破棄
    stopAllSensors()
    telemetry.cancelRoute()
    setState({ screen: 'result', guideArrivalNote: null })
  },
  onShareMeasurements() {
    const s = getState()
    const m = telemetry.finishRoute()
    if (!m || m.steps.length === 0) {
      setState({ guideArrivalNote: '共有できる計測データがまだありません。' })
      return
    }
    const label = `${s.station?.name ?? ''} ${s.origin?.line ?? ''} → ${s.candidates[0]?.exit.name ?? ''}`
    const body = telemetry.shareText(m, label)
    if (navigator.share) {
      void navigator.share({ title: '出口ナビ 実測データ', text: body }).catch(() => { /* キャンセルは無視 */ })
    } else {
      void navigator.clipboard?.writeText(body).then(
        () => setState({ guideArrivalNote: '計測データをコピーしました。チャットやメールで貼り付けて送ってください。' }),
        () => setState({ guideArrivalNote: '共有に失敗しました。' }),
      )
    }
  },
  async onToggleAutoGuide() {
    const s = getState()
    if (s.autoGuide) {
      stopAllSensors()
      setState({ autoGuide: false })
      return
    }
    // iOS はユーザー操作起点で許可が要る。ここで両方まとめて要求する
    // （プロンプトは初回のみ。以降は許可済みとして即座に解決される）
    const dm = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
    const doe = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    try {
      const results = await Promise.all([
        dm.requestPermission?.() ?? 'granted',
        doe.requestPermission?.() ?? 'granted',
      ])
      if (results.some((r) => r !== 'granted')) {
        setState({ guideArrivalNote: 'センサーの利用が許可されなかったため、自動判定は使えません。' })
        return
      }
    } catch {
      setState({ guideArrivalNote: 'センサーの利用が許可されなかったため、自動判定は使えません。' })
      return
    }
    setState({ autoGuide: true })
    reengageAuto()
  },
  async onCheckOutdoor() {
    // 許可されている2つ目の測位：「地上に出たか」を accuracy の改善で判定する。
    // 判定に使った数値ごと見せる（嘘の精度を表示しない）。
    setState({ guideArrivalNote: '測位しています…' })
    try {
      const fix = await getCurrentFix(6000)
      setState({
        accuracy: fix.accuracy,
        guideArrivalNote: isOutdoor(fix.accuracy)
          ? `測位精度が±${Math.round(fix.accuracy)}mに改善しました。地上に出たと判定します。`
          : `測位精度は±${Math.round(fix.accuracy)}m。まだ屋内の可能性があります。`,
      })
    } catch {
      setState({ guideArrivalNote: '位置情報を取得できませんでした。' })
    }
  },
  onRestart() {
    stopAllSensors()
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

/** 乗車位置（null = わからない）を受けてステップ案内を開始する */
function startGuideWith(pos: BoardedPosition | null): void {
  const s = getState()
  const best = s.candidates[0]
  if (!s.station || !s.origin || !best) return
  const guideSteps = buildGuideSteps(s.station, s.origin, best, {
    train: s.originTrain,
    boardedPosition: pos,
  })
  // 実測レコーダーを起動（案内どおり歩くこと自体が計測になる）
  telemetry.beginRoute(s.station.id, s.origin.id, best.exit.id, guideSteps[0] ?? null)
  setState({
    boardedPosition: pos,
    guideSteps,
    guideIndex: 0,
    guideArrivalNote: null,
    screen: 'guide',
  })
  reengageAuto()
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
