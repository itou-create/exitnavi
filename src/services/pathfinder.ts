import type { GuidanceStep, PathEdge, PathNode, Station } from '../types'

/**
 * 構内ネットワークの経路探索とステップ生成
 *
 * 下車ホーム → 階段 → 改札 → 分岐 → 出口 をノード/エッジのグラフで持ち、
 * ダイクストラ法で最短経路を引く（GTFS-Pathways の pathways.txt と同じ考え方。
 * 将来 pathways.txt が整備されたら、そのままこのグラフに読み込める）。
 *
 * 利点:
 *   - どのホーム × どの改札 × どの出口 の組み合わせも同じデータから引ける
 *   - 実測（歩数・秒数）がエッジ単位で蓄積されるため、
 *     共通区間の実測が「その区間を通る全パターン」の精度に効く
 */

export function findPath(station: Station, fromNodeId: string, toNodeId: string): PathEdge[] | null {
  const edges = station.pathEdges ?? []
  if (edges.length === 0) return null

  // ダイクストラ（グラフは小さいので単純実装で十分）
  const dist = new Map<string, number>()
  const prevEdge = new Map<string, PathEdge>()
  const visited = new Set<string>()
  dist.set(fromNodeId, 0)

  while (true) {
    let current: string | null = null
    let best = Infinity
    dist.forEach((d, id) => {
      if (!visited.has(id) && d < best) {
        best = d
        current = id
      }
    })
    if (current == null) break
    if (current === toNodeId) break
    visited.add(current)

    for (const e of edges) {
      if (e.from !== current) continue
      const alt = best + e.traversalSec
      if (alt < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, alt)
        prevEdge.set(e.to, e)
      }
    }
  }

  if (!dist.has(toNodeId)) return null
  const path: PathEdge[] = []
  let cursor = toNodeId
  while (cursor !== fromNodeId) {
    const e = prevEdge.get(cursor)
    if (!e) return null
    path.unshift(e)
    cursor = e.from
  }
  return path
}

/** 経路の合計所要秒数（出口ランキングにも使う） */
export function pathSeconds(path: PathEdge[]): number {
  return path.reduce((sum, e) => sum + e.traversalSec, 0)
}

function nodeOf(station: Station, id: string): PathNode | undefined {
  return station.pathNodes?.find((n) => n.id === id)
}

const DIR_WORD = {
  straight: 'そのまま直進し',
  left: '左へ曲がり',
  right: '右へ曲がり',
  'slight-left': '左ななめ前へ進み',
  'slight-right': '右ななめ前へ進み',
  'u-turn': '折り返して',
} as const

/** 経路（エッジ列）をステップ案内に変換する */
export function stepsFromPath(station: Station, path: PathEdge[]): GuidanceStep[] {
  return path.map((edge) => {
    const to = nodeOf(station, edge.to)
    const toName = to?.name ?? ''
    const isExit = to?.kind === 'exit'
    const dirPrefix = edge.direction ? DIR_WORD[edge.direction] : null

    switch (edge.kind) {
      case 'stairs-up':
      case 'escalator': {
        const how = edge.kind === 'escalator' ? 'エスカレーター' : '階段'
        return {
          kind: isExit ? 'exit' : 'move',
          edgeId: edge.id,
          direction: edge.direction,
          stairCount: edge.stairCount,
          instruction: isExit ? `${how}を上がって${toName}から地上へ` : `${how}を上がって${toName}へ`,
          signpostedAs: edge.signpostedAs,
          detail: [
            edge.stairCount ? `約${edge.stairCount}段` : undefined,
            edge.note,
            `目安${edge.traversalSec}秒（暫定）`,
          ].filter(Boolean).join('。'),
        } satisfies GuidanceStep
      }
      case 'stairs-down':
        return {
          kind: isExit ? 'exit' : 'move',
          edgeId: edge.id,
          direction: edge.direction,
          stairCount: edge.stairCount,
          instruction: isExit ? `階段を下りて${toName}から外へ` : `階段を下りて${toName}へ`,
          signpostedAs: edge.signpostedAs,
          detail: [edge.note, `目安${edge.traversalSec}秒（暫定）`].filter(Boolean).join('。'),
        } satisfies GuidanceStep
      case 'gate-pass':
        return {
          kind: 'gate',
          edgeId: edge.id,
          direction: edge.direction,
          instruction: `${edge.signpostedAs ?? '改札'}を出る`,
          signpostedAs: edge.signpostedAs,
          detail: edge.note,
        } satisfies GuidanceStep
      default: // walk
        return {
          kind: isExit ? 'exit' : 'walk',
          edgeId: edge.id,
          direction: edge.direction,
          distanceMeters: edge.distanceMeters,
          instruction: dirPrefix ? `${dirPrefix}、${toName}へ` : `${toName}へ進む`,
          signpostedAs: edge.signpostedAs,
          detail: [
            edge.distanceMeters ? `約${edge.distanceMeters}m` : undefined,
            edge.note,
            `目安${edge.traversalSec}秒（暫定）`,
          ].filter(Boolean).join('。'),
        } satisfies GuidanceStep
    }
  })
}
