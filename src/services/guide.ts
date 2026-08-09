import type { ArrivedTrain, BoardedPosition, ExitCandidate, GuidanceStep, Platform, Station } from '../types'
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

export interface GuideOptions {
  /** 起点が推定由来のときの列車。走り去った方向の計算に使う */
  train?: ArrivedTrain | null
  /** 乗車位置（進行方向基準）。ユーザーの1タップ申告 */
  boardedPosition?: BoardedPosition | null
}

/**
 * 列車が走り去る側のホーム端（a/b）。
 * 行先とホームの directionEnds データから引く。データが無ければ null。
 */
export function travelEndOf(train: ArrivedTrain | null | undefined, platform: Platform): 'a' | 'b' | null {
  if (!train || !platform.directionEnds) return null
  const last = train.destination.split('.').pop() ?? ''
  return platform.directionEnds[last] ?? null
}

/** 降車直後の個別化案内が可能か（askBoarded 画面を出すかの判定） */
export function canPersonalizeOrient(
  station: Station,
  origin: Platform,
  candidate: ExitCandidate | undefined,
  train: ArrivedTrain | null | undefined,
): boolean {
  if (!candidate) return false
  const leg = station.legs.find((l) => l.platformId === origin.id && l.exitId === candidate.exit.id)
  return !!leg && leg.stairsPositionRatio != null && travelEndOf(train, origin) != null
}

/**
 * 降車直後の一歩目を、利用者が観察できる言葉で作る。
 *
 * 利用者が確実に知っているのは「自分が電車のどのあたりに乗っていたか」、
 * 観察できるのは「電車がどっちへ走り去ったか」だけ。この2つと
 * 階段のホーム上の位置から、「走り去った方向へ／と逆へ」を言い切る。
 * 現在地の測位はしない。
 */
function personalizedOrient(
  origin: Platform,
  leg: { stairsPositionRatio?: number; gateName: string },
  travelEnd: 'a' | 'b',
  boarded: BoardedPosition,
): GuidanceStep {
  const stairs = leg.stairsPositionRatio ?? 0.5
  // 進行方向の先頭は「走り去る側の端」に近い
  const offsets: Record<BoardedPosition, number> = { front: 0.15, middle: 0.5, rear: 0.85 }
  const userRatio = travelEnd === 'a' ? offsets[boarded] : 1 - offsets[boarded]

  const delta = stairs - userRatio
  const dist = Math.abs(delta)

  if (dist < 0.15) {
    return {
      kind: 'orient',
      instruction: '降りた場所のすぐ近くに階段があります',
      detail: '周りを見回して階段を探してください（暫定データ）',
      signpostedAs: leg.gateName,
    }
  }

  const walkTowardEnd: 'a' | 'b' = delta < 0 ? 'a' : 'b'
  const sameAsTravel = walkTowardEnd === travelEnd
  const howFar = dist >= 0.5 ? 'ホームをしばらく歩きます' : '少し歩きます'

  // ホーム形式が分かれば「電車を背にして右／左」まで言い切れる。
  // 左側通行のため、島式ホームでは進行方向右側のドアが開く。
  // 「電車を背にして立つ」= 開いたドアの向きを向いて立つ、なので：
  //   島式（右ドア）で進行方向側へ歩く → 左、逆へ歩く → 右
  //   相対式（左ドア）はその反転
  const doorSide =
    origin.platformType === 'island' ? 'right' : origin.platformType === 'side' ? 'left' : null

  if (doorSide) {
    const leftRight: 'left' | 'right' =
      (doorSide === 'right') === sameAsTravel ? 'left' : 'right'
    return {
      kind: 'orient',
      direction: leftRight,
      directionBase: '「降りた電車を背にした向き」が基準です',
      instruction: `電車を背にして、${leftRight === 'left' ? '左' : '右'}へ進む`,
      detail: `${howFar}。階段は${stairsPositionLabel(leg.stairsPositionRatio, origin)}（暫定データ）`,
      signpostedAs: leg.gateName,
    }
  }

  return {
    kind: 'orient',
    direction: sameAsTravel ? 'straight' : 'u-turn',
    directionBase: '「電車が走り去った方向」が基準です',
    instruction: sameAsTravel
      ? '電車が走り去った方向へ進む'
      : '電車が走り去った方向と逆へ進む',
    detail: `${howFar}。階段は${stairsPositionLabel(leg.stairsPositionRatio, origin)}（暫定データ）`,
    signpostedAs: leg.gateName,
  }
}

export function buildGuideSteps(
  station: Station,
  origin: Platform,
  candidate: ExitCandidate,
  opts: GuideOptions = {},
): GuidanceStep[] {
  const leg = station.legs.find(
    (l) => l.platformId === origin.id && l.exitId === candidate.exit.id,
  )
  if (!leg) return []

  // 降車直後の個別化（乗車位置 × 走り去った方向）ができるなら最優先で使う
  const travelEnd = travelEndOf(opts.train, origin)
  const personal =
    travelEnd && opts.boardedPosition && leg.stairsPositionRatio != null
      ? personalizedOrient(origin, leg, travelEnd, opts.boardedPosition)
      : null

  // 手書きステップがあれば最優先（個別化できた場合は orient だけ差し替える）
  if (leg.steps && leg.steps.length > 0) {
    if (personal) return [personal, ...leg.steps.filter((s) => s.kind !== 'orient')]
    return leg.steps
  }

  // --- 汎用ステップの自動生成 ---
  const steps: GuidanceStep[] = []

  // 改札が1か所・出口が2方向以下の単純な駅では、
  // どの階段を上がっても必ず改札に着く。案内表示に頼らせる必要がない。
  const gateCount = new Set(station.legs.map((l) => l.gateName)).size
  const isSimpleStation = gateCount === 1 && station.exits.length <= 2

  // 0) 降車直後。個別化できなくても「探させる」案内にはしない。
  const hasStairsPos = leg.stairsPositionRatio != null
  steps.push(
    personal ?? {
      kind: 'orient',
      instruction: hasStairsPos
        ? `電車を降りたら、${stairsPositionLabel(leg.stairsPositionRatio, origin)}の階段へ`
        : isSimpleStation
          ? '電車を降りたら、いちばん近い階段へ'
          : `電車を降りたら、${leg.gateName}方面の階段へ`,
      signpostedAs: leg.gateName,
      detail: hasStairsPos
        ? 'ホームの図で階段の位置を確認してください（暫定データ）'
        : isSimpleStation
          ? 'この駅の改札は1か所だけです。どの階段・エスカレーターを上がっても必ず改札に着きます'
          : '階段のホーム上の位置は未実測です（TODO: 実測で解消予定）',
    },
  )

  // 1) 階の移動。ホームの階層から方向を決める
  if (origin.levelIndex < 0) {
    steps.push({
      kind: 'move',
      instruction: '改札のある階へ上がる',
      signpostedAs: leg.gateName,
      detail:
        `地下${-origin.levelIndex}階のホームから改札階へ上がります。` +
        (leg.stairCount > 0
          ? `階段 約${leg.stairCount}段（エスカレーター併設の場合あり）`
          : 'エスカレーター／エレベーターで上がれます'),
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

  // 3) コンコースを歩く。「案内板に従う」ではなく行き先と方向を主語にする。
  //    gateToExitDirection があれば「改札を出たら右へ」と言い切る。
  //    無ければ方向は言わず、図で示す（嘘の方向を言い切らない）。
  const g2e = leg.gateToExitDirection
  const dirWord: Record<NonNullable<typeof g2e>, string> = {
    straight: 'そのまま直進し',
    left: '左へ曲がり',
    right: '右へ曲がり',
    'slight-left': '左ななめ前へ進み',
    'slight-right': '右ななめ前へ進み',
    'u-turn': '折り返して',
  }
  steps.push({
    kind: 'walk',
    direction: g2e,
    directionBase: g2e ? '「改札を抜けた向き」が基準です' : undefined,
    instruction: g2e
      ? `改札を出たら${dirWord[g2e]}、${candidate.exit.name}へ`
      : `改札を出て、${candidate.exit.name}へ進む`,
    signpostedAs: candidate.exit.signpostedAs,
    detail: isSimpleStation
      ? `出口は${station.exits.map((e) => e.name).join('と')}の2方向だけです。下の図で向きを確認してください（目安 ${fmtMin(candidate.indoorSeconds)}・暫定値）`
      : `${g2e ? '方向は暫定値です。' : '曲がる方向のデータは未整備です（TODO: 実測で解消予定）。'}目安 ${fmtMin(candidate.indoorSeconds)}（暫定値）`,
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
