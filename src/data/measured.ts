/**
 * コミュニティ実測データ（提供された歩行記録の集約）
 *
 * 利用者が「計測データを提供する」で送ってくれた歩行記録の中央値を、
 * 経路×ステップ単位でここに集約する。デプロイすると全員のアプリで
 * 自動判定・所要時間の精度が上がる。
 *
 * 運用:
 *   1. 提供された JSON（services/telemetry.ts の RouteMeasure）を集める
 *   2. 同じ経路の記録が2件以上たまったら、ステップごとの中央値をここに追記
 *   3. samples を更新してデプロイ
 *
 * 個人を特定できる情報は含まれない（秒数・歩数・回転角のみ）。
 */

export interface CommunityStep {
  /** ステップの種類（照合用） */
  kind: string
  /** 所要秒数の中央値 */
  sec?: number
  /** 歩数の中央値 */
  steps?: number
}

export interface CommunityRoute {
  stationId: string
  platformId: string
  exitId: string
  /** 集約に使った歩行記録の件数 */
  samples: number
  /** ステップごとの中央値（buildGuideSteps の生成順と対応） */
  steps: CommunityStep[]
}

/** 提供された実測データの集約。現在 0 経路（提供が集まり次第ここに追記） */
export const COMMUNITY_MEASURES: CommunityRoute[] = []

/**
 * エッジ（構内ネットワークの区間）単位の集約。
 * どの経路の歩行記録からでも、同じ区間の実測はここに合算される。
 */
export interface CommunityEdge {
  edgeId: string
  samples: number
  sec?: number
  steps?: number
}

/** 提供された実測のエッジ単位集約。現在 0 件 */
export const COMMUNITY_EDGES: CommunityEdge[] = []

export function communityEdgeFor(edgeId: string): CommunityEdge | null {
  return COMMUNITY_EDGES.find((e) => e.edgeId === edgeId) ?? null
}

export function communityRouteFor(
  stationId: string,
  platformId: string,
  exitId: string,
): CommunityRoute | null {
  return (
    COMMUNITY_MEASURES.find(
      (m) => m.stationId === stationId && m.platformId === platformId && m.exitId === exitId,
    ) ?? null
  )
}
