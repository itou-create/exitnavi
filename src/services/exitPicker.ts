import type { Destination, ExitCandidate, Platform, Station } from '../types'
import { distanceMeters } from './geo'

/**
 * 出口の算出
 *
 * 「起点（ホーム）＋目的地」から最適な出口を出す。
 *
 * ★ 重要：同じ目的地でも、起点が違えば答えが変わる。
 *   JR埼京線から来たか、副都心線から来たかで最適な出口は別物になる。
 *   これがこのアプリの主張そのもの。
 *
 * 現在の計算：
 *   構内の所要時間（stations.ts の legs、暫定値）
 *   ＋ 出口から目的地までの直線距離 ÷ 徒歩速度 × 迂回係数
 *
 * 将来：
 *   構内は pathways.txt を経路探索した結果に置き換わる。
 *   地上は OSM の歩道ネットワークで経路探索する。
 *   いまはどちらも近似なので、順位が僅差のときは信用しないこと。
 */

/** 徒歩速度（m/s）。分速80mを想定 */
const WALK_SPEED = 80 / 60

/**
 * 直線距離を実際の歩行距離に補正する係数。
 * 街区を迂回するぶん、直線より長くなる。
 * TODO: OSM の歩道ネットワークで経路探索したら不要になる
 */
const DETOUR_FACTOR = 1.3

/** 僅差とみなす秒数。これ以内なら「ほぼ同じ」と表示すべき */
export const TIE_THRESHOLD_SECONDS = 60

export function rankExits(
  station: Station,
  origin: Platform,
  destination: Destination,
): ExitCandidate[] {
  const legs = station.legs.filter((l) => l.platformId === origin.id)

  const candidates: ExitCandidate[] = legs.flatMap((leg) => {
    const exit = station.exits.find((e) => e.id === leg.exitId)
    if (!exit) return []

    const meters = distanceMeters(exit.position, destination.position) * DETOUR_FACTOR
    const outdoorSeconds = Math.round(meters / WALK_SPEED)

    return [{
      exit,
      indoorSeconds: leg.traversalTime,
      outdoorSeconds,
      totalSeconds: leg.traversalTime + outdoorSeconds,
      outdoorMeters: Math.round(meters),
      stairCount: leg.stairCount,
      gateName: leg.gateName,
      signpostedAs: leg.signpostedAs,
    }]
  })

  return candidates.sort((a, b) => a.totalSeconds - b.totalSeconds)
}

/**
 * なぜこの出口なのかを日本語で説明する。
 *
 * 設計原則（CLAUDE.md 5）：嘘の精度を表示しない。
 * 僅差のときは「最短です」と言い切らないこと。
 */
export function explain(
  best: ExitCandidate,
  runnerUp: ExitCandidate | undefined,
  origin: Platform,
): string {
  if (!runnerUp) {
    return `${origin.name}からは${best.exit.name}が唯一の案内対象です。構内${fmtMin(best.indoorSeconds)}、地上${best.outdoorMeters}m。`
  }

  const diff = runnerUp.totalSeconds - best.totalSeconds

  if (diff < TIE_THRESHOLD_SECONDS) {
    return `${best.exit.name}と${runnerUp.exit.name}はほぼ同じです（差は約${Math.round(diff)}秒）。${
      best.stairCount < runnerUp.stairCount
        ? `階段が少ないぶん${best.exit.name}を出しています。`
        : `わずかに${best.exit.name}が早い計算です。`
    }`
  }

  if (best.stairCount === 0 && runnerUp.stairCount > 0) {
    return `${best.exit.name}が最短です。${runnerUp.exit.name}より約${fmtMin(diff)}早く、階段を使わずに出られます。`
  }

  return `${best.exit.name}が最短です。次点の${runnerUp.exit.name}より約${fmtMin(diff)}早くなります。`
}

export function fmtMin(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m <= 0) return `${seconds}秒`
  return `${m}分`
}
