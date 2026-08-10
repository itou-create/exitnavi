import type { GuidanceStep } from '../types'

/**
 * 実測データの収集（クラウドソーシングの土台）
 *
 * アプリ自体を計測器にする：案内どおりに歩くと、各ステップの
 * 所要秒数・歩数・回転角が自動で記録され、案内完了時に
 * 「提供する」を押すと共有できる。集まった記録の中央値で
 * stations.ts の暫定値を実測値に置き換えていく。
 *
 * プライバシー：
 *   - 記録するのは 駅・経路・ステップごとの秒数/歩数/回転角/地上判定の精度 のみ
 *   - 位置の履歴・移動の軌跡は記録しない（そもそも測っていない）
 *   - 送信は本人が「提供する」を押したときだけ。自動送信はしない
 */

export interface StepMeasure {
  kind: GuidanceStep['kind']
  instruction: string
  elapsedSec: number
  /** 歩数（センサーONのときのみ） */
  walkSteps?: number
  /** 累積回転角（右+、センサーONのときのみ） */
  turnDeg?: number
}

export interface RouteMeasure {
  v: 1
  recordedAt: string
  stationId: string
  platformId: string
  exitId: string
  steps: StepMeasure[]
  totalSec: number
  /** 地上判定時の測位精度（m） */
  outdoorAccuracy?: number
}

const STORAGE_KEY = 'exitnavi.measures.v1'
const MAX_STORED = 50

interface Recording {
  stationId: string
  platformId: string
  exitId: string
  startedAt: number
  stepStartedAt: number
  currentStep: GuidanceStep | null
  steps: StepMeasure[]
  sensors: { walkSteps?: number; turnDeg?: number }
  outdoorAccuracy?: number
}

let rec: Recording | null = null

export function beginRoute(stationId: string, platformId: string, exitId: string, firstStep: GuidanceStep | null): void {
  const now = Date.now()
  rec = {
    stationId,
    platformId,
    exitId,
    startedAt: now,
    stepStartedAt: now,
    currentStep: firstStep,
    steps: [],
    sensors: {},
  }
}

/** engageAuto のセンサーコールバックから現在値を流し込む */
export function noteSensors(v: { walkSteps?: number; turnDeg?: number }): void {
  if (!rec) return
  if (v.walkSteps != null) rec.sensors.walkSteps = v.walkSteps
  if (v.turnDeg != null) rec.sensors.turnDeg = v.turnDeg
}

export function noteOutdoor(accuracy: number): void {
  if (rec) rec.outdoorAccuracy = Math.round(accuracy)
}

/** いまのステップを閉じて次へ。前進のときだけ呼ぶ（戻りは記録しない） */
export function advanceStep(nextStep: GuidanceStep | null): void {
  if (!rec) return
  closeCurrentStep()
  rec.currentStep = nextStep
  rec.stepStartedAt = Date.now()
  rec.sensors = {}
}

function closeCurrentStep(): void {
  if (!rec || !rec.currentStep) return
  rec.steps.push({
    kind: rec.currentStep.kind,
    instruction: rec.currentStep.instruction,
    elapsedSec: Math.round((Date.now() - rec.stepStartedAt) / 1000),
    walkSteps: rec.sensors.walkSteps,
    turnDeg: rec.sensors.turnDeg != null ? Math.round(rec.sensors.turnDeg) : undefined,
  })
}

/** 記録を確定して端末に保存し、返す */
export function finishRoute(): RouteMeasure | null {
  if (!rec) return null
  closeCurrentStep()
  const out: RouteMeasure = {
    v: 1,
    recordedAt: new Date().toISOString(),
    stationId: rec.stationId,
    platformId: rec.platformId,
    exitId: rec.exitId,
    steps: rec.steps,
    totalSec: Math.round((Date.now() - rec.startedAt) / 1000),
    outdoorAccuracy: rec.outdoorAccuracy,
  }
  rec = null
  try {
    const all = loadAll()
    all.push(out)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(-MAX_STORED)))
  } catch { /* プライベートモード等で保存できなくても動作は継続 */ }
  return out
}

export function cancelRoute(): void {
  rec = null
}

function loadAll(): RouteMeasure[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RouteMeasure[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** この経路の過去の実測（この端末のもの） */
export function measuresFor(stationId: string, platformId: string, exitId: string): RouteMeasure[] {
  return loadAll().filter(
    (m) => m.stationId === stationId && m.platformId === platformId && m.exitId === exitId,
  )
}

/** 中央値（表示用） */
export function medianTotalSec(measures: RouteMeasure[]): number | null {
  if (measures.length === 0) return null
  const sorted = measures.map((m) => m.totalSec).sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** 共有用テキスト（人が読める形 + 機械処理用JSON） */
export function shareText(m: RouteMeasure, routeLabel: string): string {
  const lines = [
    `【出口ナビ 実測データ】${routeLabel}`,
    `合計 ${m.totalSec}秒`,
    ...m.steps.map((st, i) =>
      `${i + 1}. ${st.instruction}: ${st.elapsedSec}秒` +
      (st.walkSteps != null ? ` / ${st.walkSteps}歩` : '') +
      (st.turnDeg != null ? ` / 回転${st.turnDeg > 0 ? '右' : '左'}${Math.abs(st.turnDeg)}°` : ''),
    ),
    m.outdoorAccuracy != null ? `地上判定時の測位精度 ±${m.outdoorAccuracy}m` : '',
    '',
    `JSON: ${JSON.stringify(m)}`,
  ]
  return lines.filter((l) => l !== '').join('\n')
}
