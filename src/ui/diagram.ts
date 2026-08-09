import type { ConcourseLeg, Destination, Exit, LatLng, Platform, Station } from '../types'
import { distanceMeters } from '../services/geo'

/**
 * 図面（模式図）の描画
 *
 * ⚠️ ここで描くのは「模式図」であって縮尺のある構内図ではない。
 *    設計原則（嘘の精度を表示しない）に従い：
 *    - ユーザーの現在位置は描かない（測っていないため）
 *    - 未実測の設備位置は「未実測」と明記して描く
 *    - 駅俯瞰図は実座標（暫定値・OSM由来）から方位を計算して描く。北が上
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

/** 白フチ付きテキスト。ラベル同士が重なっても読めるようにする */
function label(x: number, y: number, content: string, cls = 'dg-label', anchor = 'middle'): SVGTextElement {
  const t = sv('text', { x, y, 'text-anchor': anchor }, `${cls} dg-halo`)
  t.textContent = content
  return t
}

/** 矢じり（線の終端に付ける三角形） */
function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number, cls: string): SVGPolygonElement {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const p = (a: number) => `${x2 - size * Math.cos(angle + a)},${y2 - size * Math.sin(angle + a)}`
  return sv('polygon', { points: `${x2},${y2} ${p(0.45)} ${p(-0.45)}` }, cls)
}

/* ------------------------------------------------------------------ */
/* ホーム模式図：降りた電車・ホーム・階段の位置・両端の方面              */
/* ------------------------------------------------------------------ */

export function platformDiagram(platform: Platform, leg: ConcourseLeg): SVGSVGElement {
  const svg = sv('svg', { viewBox: '0 0 340 150' }, 'diagram')

  // 降りた電車。どの車両にいたかは分からないので、位置は描かない
  svg.appendChild(sv('rect', { x: 24, y: 14, width: 292, height: 30, rx: 8 }, 'dg-train'))
  svg.appendChild(label(170, 33, '降りた電車', 'dg-label'))

  // ホーム
  svg.appendChild(sv('rect', { x: 24, y: 52, width: 292, height: 36, rx: 5 }, 'dg-plat'))
  svg.appendChild(label(44, 74, 'ホーム', 'dg-label', 'start'))

  // 階段。位置が未実測なら中央に灰色で描き、未実測と明記する
  const known = leg.stairsPositionRatio != null
  const ratio = leg.stairsPositionRatio ?? 0.5
  const sx = 24 + 292 * Math.min(Math.max(ratio, 0.08), 0.92)
  svg.appendChild(
    sv('rect', { x: sx - 21, y: 56, width: 42, height: 28, rx: 5 }, known ? 'dg-stairs' : 'dg-stairs-unknown'),
  )
  svg.appendChild(label(sx, 75, '階段', 'dg-stairstext'))

  // 階段から改札へ（上向き矢印＋改札名）
  svg.appendChild(sv('line', { x1: sx, y1: 104, x2: sx, y2: 92 }, 'dg-route'))
  svg.appendChild(arrowHead(sx, 116, sx, 92, 8, 'dg-route-head'))
  svg.appendChild(label(sx, 118, known ? `${leg.gateName}へ` : `${leg.gateName}へ（階段の位置は未実測）`, 'dg-label'))

  // 両端の方面表記
  if (platform.platformEnds) {
    svg.appendChild(label(24, 140, `◀ ${platform.platformEnds.a}`, 'dg-small', 'start'))
    svg.appendChild(label(316, 140, `${platform.platformEnds.b} ▶`, 'dg-small', 'end'))
  } else {
    svg.appendChild(label(170, 140, '両端の方面表記は未整備', 'dg-small'))
  }

  return svg
}

/* ------------------------------------------------------------------ */
/* 駅俯瞰図：駅構内の面・全出口・目指す出口・目的地の方角。北が上        */
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
  const W = 340
  const H = 232
  const cx = W / 2
  const cy = H / 2 + 6
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}` }, 'diagram')

  // 出口が収まるスケール
  const pts = station.exits.map((e) => toMeters(e.position, station.position))
  const maxAbs = Math.max(40, ...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))
  const scale = 74 / maxAbs
  const toScreen = (p: { x: number; y: number }) => ({ x: cx + p.x * scale, y: cy - p.y * scale })

  // 駅構内（改札の中）を面として描く。出口の広がり＋余白
  const xs = pts.map((p) => toScreen(p).x)
  const ys = pts.map((p) => toScreen(p).y)
  const pad = 20
  const bx = Math.min(...xs, cx) - pad
  const by = Math.min(...ys, cy) - pad
  const bw = Math.max(...xs, cx) - bx + pad
  const bh = Math.max(...ys, cy) - by + pad
  svg.appendChild(sv('rect', { x: bx, y: by, width: bw, height: bh, rx: 16 }, 'dg-body'))
  svg.appendChild(label(bx + 10, by + 16, `${station.name}の構内（模式図）`, 'dg-small', 'start'))

  // 方位（北が上）
  svg.appendChild(label(W - 12, 16, '北 ▲', 'dg-label', 'end'))

  // 改札（駅の中心に置く。実位置は未実測）
  svg.appendChild(sv('rect', { x: cx - 7, y: cy - 7, width: 14, height: 14, rx: 3 }, 'dg-center'))
  svg.appendChild(label(cx, cy + 24, gateName ?? '改札', 'dg-label'))

  // 目指す出口への太い矢印
  const target = toScreen(toMeters(targetExit.position, station.position))
  svg.appendChild(sv('line', { x1: cx, y1: cy, x2: target.x, y2: target.y }, 'dg-route'))
  svg.appendChild(arrowHead(cx, cy, target.x, target.y, 11, 'dg-route-head'))

  // 出口。目指す出口だけ大きく緑、他は小さく淡く
  station.exits.forEach((e, i) => {
    const p = toScreen(pts[i])
    const isTarget = e.id === targetExit.id
    // ラベルは中心から外向きに逃がす（重なり対策）
    const dx = p.x - cx
    const dy = p.y - cy
    const len = Math.hypot(dx, dy) || 1
    const off = isTarget ? 20 : 14
    const lx = p.x + (dx / len) * off
    const ly = p.y + (dy / len) * off + 4
    const anchor = dx > 12 ? 'start' : dx < -12 ? 'end' : 'middle'

    svg.appendChild(sv('circle', { cx: p.x, cy: p.y, r: isTarget ? 11 : 5 }, isTarget ? 'dg-exit-target' : 'dg-exit'))
    if (isTarget) svg.appendChild(label(p.x, p.y + 4, '出', 'dg-stairstext'))
    svg.appendChild(label(lx, ly, e.name, isTarget ? 'dg-label-strong' : 'dg-small', anchor))
  })

  // 目的地の方角（目指す出口から外向きの点線矢印。距離は数字で示す）
  if (destination) {
    const dm = toMeters(destination.position, station.position)
    const ex = toMeters(targetExit.position, station.position)
    const ux = dm.x - ex.x
    const uy = dm.y - ex.y
    const len = Math.hypot(ux, uy) || 1
    const dx2 = target.x + (ux / len) * 44
    const dy2 = target.y - (uy / len) * 44
    svg.appendChild(sv('line', { x1: target.x, y1: target.y, x2: dx2, y2: dy2 }, 'dg-dest'))
    svg.appendChild(arrowHead(target.x, target.y, dx2, dy2, 9, 'dg-dest-head'))

    const meters = Math.round(distanceMeters(targetExit.position, destination.position))
    const lx = Math.min(Math.max(dx2 + (ux / len) * 8, 54), W - 54)
    const ly = Math.min(Math.max(dy2 - (uy / len) * 8, 18), H - 10)
    svg.appendChild(label(lx, ly, `${destination.name}`, 'dg-label-strong'))
    svg.appendChild(label(lx, ly + 13, `直線 約${meters}m`, 'dg-small'))
  }

  return svg
}
