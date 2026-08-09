import type { ConcourseLeg, Destination, Exit, LatLng, Platform, Station } from '../types'
import { distanceMeters } from '../services/geo'

/**
 * 図面（模式図）の描画
 *
 * ⚠️ ここで描くのは「模式図」であって縮尺のある構内図ではない。
 *    設計原則（嘘の精度を表示しない）に従い：
 *    - ユーザーの現在位置は描かない（測っていないため）
 *    - 未実測の設備位置は「未実測」と明記して描く
 *    - 駅俯瞰図は実座標（暫定値）から方位を計算して描く。北が上
 *
 * 将来 GTFS-Pathways / 歩行空間ネットワークデータが手に入れば、
 * ここが実データ由来の構内図に置き換わる。
 */

const NS = 'http://www.w3.org/2000/svg'

function sv<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  cls?: string,
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v))
  if (cls) n.setAttribute('class', cls)
  return n
}

function label(x: number, y: number, content: string, cls = 'dg-label', anchor = 'middle'): SVGTextElement {
  const t = sv('text', { x, y, 'text-anchor': anchor })
  t.setAttribute('class', cls)
  t.textContent = content
  return t
}

/* ------------------------------------------------------------------ */
/* ホーム模式図：降りた電車・ホーム・階段の位置・両端の方面              */
/* ------------------------------------------------------------------ */

export function platformDiagram(platform: Platform, leg: ConcourseLeg): SVGSVGElement {
  const svg = sv('svg', { viewBox: '0 0 320 136' }, 'diagram')

  // 降りた電車。どの車両にいたかは分からないので、位置は描かない
  svg.appendChild(sv('rect', { x: 22, y: 14, width: 276, height: 24, rx: 6 }, 'dg-train'))
  svg.appendChild(label(160, 30, '降りた電車（乗っていた位置は測りません）', 'dg-small'))

  // ホーム
  svg.appendChild(sv('rect', { x: 22, y: 46, width: 276, height: 30, rx: 4 }, 'dg-plat'))
  svg.appendChild(label(38, 65, 'ホーム', 'dg-label', 'start'))

  // 階段。位置が未実測なら中央に「未実測」として描く
  const known = leg.stairsPositionRatio != null
  const ratio = leg.stairsPositionRatio ?? 0.5
  const sx = 22 + 276 * Math.min(Math.max(ratio, 0.06), 0.94)
  svg.appendChild(
    sv('rect', { x: sx - 16, y: 50, width: 32, height: 22, rx: 4 }, known ? 'dg-stairs' : 'dg-stairs-unknown'),
  )
  svg.appendChild(label(sx, 65, '階段', 'dg-stairstext'))
  // 階段から改札への向き
  svg.appendChild(label(sx, 92, known ? `↑ ${leg.gateName}へ` : `↑ ${leg.gateName}へ（位置は未実測）`, 'dg-label'))

  // 両端の方面表記
  if (platform.platformEnds) {
    svg.appendChild(label(22, 116, `◀ ${platform.platformEnds.a}`, 'dg-small', 'start'))
    svg.appendChild(label(298, 116, `${platform.platformEnds.b} ▶`, 'dg-small', 'end'))
  } else {
    svg.appendChild(label(160, 116, '両端の方面表記は未整備', 'dg-small'))
  }

  return svg
}

/* ------------------------------------------------------------------ */
/* 駅俯瞰図：改札・全出口・目指す出口・目的地の方角。北が上              */
/* ------------------------------------------------------------------ */

/** 緯度経度→メートル座標（駅中心基準の近似平面） */
function toMeters(p: LatLng, center: LatLng): { x: number; y: number } {
  const x = (p.lng - center.lng) * 111320 * Math.cos((center.lat * Math.PI) / 180)
  const y = (p.lat - center.lat) * 110540
  return { x, y }
}

export function stationDiagram(
  station: Station,
  targetExit: Exit,
  gateName: string | null,
  destination: Destination | null,
): SVGSVGElement {
  const W = 320
  const H = 190
  const cx = W / 2
  const cy = H / 2
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}` }, 'diagram')

  // 出口が収まるスケールを決める（模式図なので最小・最大だけ守る）
  const pts = station.exits.map((e) => toMeters(e.position, station.position))
  const maxAbs = Math.max(40, ...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))
  const scale = 62 / maxAbs

  const toScreen = (p: { x: number; y: number }) => ({ x: cx + p.x * scale, y: cy - p.y * scale })

  // 方位（北が上）
  svg.appendChild(label(W - 14, 16, '北 ▲', 'dg-small', 'end'))

  // 目指す出口への線（駅中心＝改札のあたりから）
  const target = toScreen(toMeters(targetExit.position, station.position))
  const route = sv('line', { x1: cx, y1: cy, x2: target.x, y2: target.y }, 'dg-route')
  svg.appendChild(route)

  // 目的地の方角（目指す出口から外向きの矢印。距離は縮尺外なので数字で示す）
  if (destination) {
    const dm = toMeters(destination.position, station.position)
    const ex = toMeters(targetExit.position, station.position)
    const dirX = dm.x - ex.x
    const dirY = dm.y - ex.y
    const len = Math.hypot(dirX, dirY) || 1
    const ux = dirX / len
    const uy = dirY / len
    const ax1 = target.x
    const ay1 = target.y
    const ax2 = target.x + ux * 34 * 1
    const ay2 = target.y - uy * 34
    svg.appendChild(sv('line', { x1: ax1, y1: ay1, x2: ax2, y2: ay2 }, 'dg-dest'))
    // 矢じり
    const angle = Math.atan2(ay2 - ay1, ax2 - ax1)
    const tip = (a: number) =>
      `${ax2 - 8 * Math.cos(angle + a)},${ay2 - 8 * Math.sin(angle + a)}`
    svg.appendChild(sv('polygon', { points: `${ax2},${ay2} ${tip(0.5)} ${tip(-0.5)}` }, 'dg-dest-head'))

    const meters = Math.round(distanceMeters(targetExit.position, destination.position))
    const lx = Math.min(Math.max(ax2 + ux * 10, 40), W - 40)
    const ly = Math.min(Math.max(ay2 - uy * 10, 22), H - 8)
    svg.appendChild(label(lx, ly, `${destination.name}（直線 約${meters}m）`, 'dg-small'))
  }

  // 全出口。目指す出口だけ強調
  station.exits.forEach((e) => {
    const p = toScreen(toMeters(e.position, station.position))
    const isTarget = e.id === targetExit.id
    svg.appendChild(sv('circle', { cx: p.x, cy: p.y, r: isTarget ? 10 : 7 }, isTarget ? 'dg-exit-target' : 'dg-exit'))
    svg.appendChild(label(p.x, p.y + (isTarget ? 24 : 20), e.name, isTarget ? 'dg-label-strong' : 'dg-small'))
  })

  // 駅の中心（改札のあたり）
  svg.appendChild(sv('circle', { cx, cy, r: 6 }, 'dg-center'))
  svg.appendChild(label(cx, cy - 12, gateName ?? '改札', 'dg-label'))

  return svg
}
