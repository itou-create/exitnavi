import type { ExitCandidate, GuidanceStep, Platform, Station } from '../types'
import { fmtMin } from './exitPicker'

/**
 * 構内ステップ案内（第2段階）
 *
 * 設計原則（CLAUDE.md 1）：現在地を測らない。
 *   屋内で数m粒度の測位はできない前提。「いまここ」を描く代わりに
 *   「次に何をするか」を1画面1指示で出し、進行はユーザーの「次へ」で申告してもらう。
 *   使ってよい測位は「地上に出たか（accuracy の急改善）」だけで、
 *   それも最終ステップの確認ボタンに限定している（ui/render.ts + main.ts）。
 *
 * データについて：
 *   leg.steps に手書きの詳細ステップがあればそれを使う。
 *   無ければ leg の既存フィールド（改札名・階段数・案内板表記）から
 *   汎用ステップを自動生成する。どちらも暫定データであり、UI側で
 *   「現地の案内板を優先」と常時表示する。
 *
 * 将来の姿：
 *   GTFS-Pathways の pathways.txt（stairs / escalator / fare_gate / exit の
 *   ノード列）を経路探索した結果がそのままこのステップ列になる。
 */

export function buildGuideSteps(
  station: Station,
  origin: Platform,
  candidate: ExitCandidate,
): GuidanceStep[] {
  const leg = station.legs.find(
    (l) => l.platformId === origin.id && l.exitId === candidate.exit.id,
  )
  if (!leg) return []

  // 手書きステップがあれば最優先
  if (leg.steps && leg.steps.length > 0) return leg.steps

  // --- 汎用ステップの自動生成 ---
  const steps: GuidanceStep[] = []

  // 0) 降車直後。まず「どっちへ歩くか」を決めさせる。
  //    乗っていた車両位置は測れないので、階段のホーム上の位置だけを示す。
  const hasStairsPos = leg.stairsPositionRatio != null
  steps.push({
    kind: 'orient',
    instruction: hasStairsPos
      ? `電車を降りたら、${stairsPositionLabel(leg.stairsPositionRatio, origin)}の階段へ`
      : `電車を降りたら、「${leg.gateName}」の案内表示を探す`,
    signpostedAs: leg.gateName,
    detail: hasStairsPos
      ? 'ホームの図で階段の位置を確認してください（暫定データ）'
      : '階段の位置は未実測のため、ホーム上の吊り下げ案内に従ってください',
  })

  // 1) 階の移動。ホームの階層から方向を決める
  if (origin.levelIndex < 0) {
    steps.push({
      kind: 'move',
      instruction: '改札のある階へ上がる',
      signpostedAs: leg.gateName,
      detail:
        leg.stairCount > 0
          ? `階段 約${leg.stairCount}段（エスカレーター併設の場合あり）`
          : 'エスカレーター／エレベーターで上がれます',
    })
  } else if (origin.levelIndex > 0) {
    steps.push({
      kind: 'move',
      instruction: '改札のある階へ下りる',
      signpostedAs: leg.gateName,
      detail:
        leg.stairCount > 0
          ? `階段 約${leg.stairCount}段（エスカレーター併設の場合あり）`
          : 'エスカレーター／エレベーターで下りられます',
    })
  } else {
    steps.push({
      kind: 'move',
      instruction: 'ホームから改札方面へ進む',
      signpostedAs: leg.gateName,
      detail: leg.stairCount > 0 ? `途中に階段 約${leg.stairCount}段` : undefined,
    })
  }

  // 2) 改札
  steps.push({
    kind: 'gate',
    instruction: `${leg.gateName}を出る`,
    signpostedAs: leg.signpostedAs,
  })

  // 3) コンコースを歩く
  //    目標は「案内表示を見なくてもたどり着ける」だが、この経路はまだ
  //    方向データ（direction）が未整備。嘘の方向を言い切らず、案内板に頼ると明言する。
  steps.push({
    kind: 'walk',
    instruction: `案内板「${candidate.exit.signpostedAs}」に従って進む`,
    signpostedAs: candidate.exit.signpostedAs,
    detail: `この経路は方向データ未整備のため、ここは案内板が頼りです。ホームからの目安 ${fmtMin(candidate.indoorSeconds)}（暫定値）`,
  })

  // 4) 出口
  steps.push({
    kind: 'exit',
    instruction: `${candidate.exit.name}から地上に出る`,
    signpostedAs: candidate.exit.signpostedAs,
  })

  return steps
}

/** 方向の表示（矢印と日本語）。矢印は「直前の動作を終えた向き」基準 */
export function directionDisplay(d: NonNullable<GuidanceStep['direction']>): { arrow: string; label: string } {
  switch (d) {
    case 'straight':     return { arrow: '↑', label: 'そのまま直進' }
    case 'left':         return { arrow: '←', label: '左へ' }
    case 'right':        return { arrow: '→', label: '右へ' }
    case 'slight-left':  return { arrow: '↖', label: '左ななめ前へ' }
    case 'slight-right': return { arrow: '↗', label: '右ななめ前へ' }
    case 'u-turn':       return { arrow: '↩', label: '折り返す' }
  }
}

/** ステップ種類の表示ラベル */
export function stepKindLabel(kind: GuidanceStep['kind']): string {
  switch (kind) {
    case 'orient': return '降車直後'
    case 'move': return '階の移動'
    case 'gate': return '改札'
    case 'walk': return 'コンコース'
    case 'exit': return '出口'
  }
}

/**
 * 階段のホーム上の位置を言葉にする。
 * 「新宿寄り」のような現地の乗車位置案内と同じ語彙を使う。
 * 未実測なら未実測と言う（勝手に「中ほど」と言い切らない）。
 */
export function stairsPositionLabel(
  ratio: number | undefined,
  platform: { platformEnds?: { a: string; b: string } },
): string {
  if (ratio == null) return '「位置未実測」'
  const ends = platform.platformEnds
  if (ratio < 0.33) return ends ? `${ends.a}側` : 'ホーム端寄り'
  if (ratio > 0.67) return ends ? `${ends.b}側` : 'ホーム端寄り'
  return 'ホーム中ほど'
}
