import type { Destination, Exit, Station } from '../types'
import { distanceMeters } from '../services/geo'
import { arrowHead, label, sv } from './svg'

/**
 * 駅周辺の実地図。国土地理院の「地理院タイル（淡色地図）」に
 * 出口の位置（OSM由来・暫定）を重ねて描く。
 *
 * - 地理院タイルは出典の明記だけで利用できるオープンデータ
 *   https://maps.gsi.go.jp/development/ichiran.html
 * - ユーザーの現在位置は描かない（測っていないため）
 */

const TILE = 256
const W = 680
const H = 480

function lngToX(lng: number, z: number): number {
  return ((lng + 180) / 360) * 2 ** z * TILE
}
function latToY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z * TILE
}

/** 全出口が収まる最大ズーム（15〜18） */
function pickZoom(station: Station): number {
  for (let z = 18; z >= 15; z--) {
    const cx = lngToX(station.position.lng, z)
    const cy = latToY(station.position.lat, z)
    const fits = station.exits.every(
      (e) =>
        Math.abs(lngToX(e.position.lng, z) - cx) <= W / 2 - 70 &&
        Math.abs(latToY(e.position.lat, z) - cy) <= H / 2 - 50,
    )
    if (fits) return z
  }
  return 15
}

export function stationMap(
  station: Station,
  targetExit: Exit,
  destination: Destination | null,
): SVGSVGElement {
  const z = pickZoom(station)
  const left = lngToX(station.position.lng, z) - W / 2
  const top = latToY(station.position.lat, z) - H / 2
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}` }, 'diagram mapdg')

  // 地理院タイルを敷き詰める
  const tx0 = Math.floor(left / TILE)
  const tx1 = Math.floor((left + W) / TILE)
  const ty0 = Math.floor(top / TILE)
  const ty1 = Math.floor((top + H) / TILE)
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      const img = sv('image', { x: tx * TILE - left, y: ty * TILE - top, width: TILE, height: TILE })
      img.setAttribute('href', `https://cyberjapandata.gsi.go.jp/xyz/pale/${z}/${tx}/${ty}.png`)
      svg.appendChild(img)
    }
  }

  const pt = (p: { lat: number; lng: number }) => ({
    x: lngToX(p.lng, z) - left,
    y: latToY(p.lat, z) - top,
  })

  // ほかの出口（小さく）
  station.exits.forEach((e) => {
    if (e.id === targetExit.id) return
    const p = pt(e.position)
    svg.appendChild(sv('circle', { cx: p.x, cy: p.y, r: 9 }, 'mp-exit'))
    svg.appendChild(label(p.x, p.y + 26, e.name, 'mp-small'))
  })

  // 目的地。画面内なら実位置にピン、画面外なら方角の矢印＋距離
  const t = pt(targetExit.position)
  if (destination) {
    const d = pt(destination.position)
    const inside = d.x > 40 && d.x < W - 40 && d.y > 30 && d.y < H - 40
    if (inside) {
      svg.appendChild(sv('line', { x1: t.x, y1: t.y, x2: d.x, y2: d.y }, 'mp-dest'))
      svg.appendChild(sv('circle', { cx: d.x, cy: d.y, r: 12 }, 'mp-destpin'))
      svg.appendChild(label(d.x, d.y - 18, destination.name, 'mp-label'))
    } else {
      const ux = d.x - t.x
      const uy = d.y - t.y
      const len = Math.hypot(ux, uy) || 1
      const ex = t.x + (ux / len) * 110
      const ey = t.y + (uy / len) * 110
      svg.appendChild(sv('line', { x1: t.x, y1: t.y, x2: ex, y2: ey }, 'mp-dest'))
      svg.appendChild(arrowHead(t.x, t.y, ex, ey, 16, 'mp-desthead'))
      const meters = Math.round(distanceMeters(targetExit.position, destination.position))
      const lx = Math.min(Math.max(ex, 100), W - 100)
      const ly = Math.min(Math.max(ey, 44), H - 60)
      svg.appendChild(label(lx, ly - 18, destination.name, 'mp-label'))
      svg.appendChild(label(lx, ly + 4, `直線 約${meters}m`, 'mp-small'))
    }
  }

  // 目指す出口（最前面）
  svg.appendChild(sv('circle', { cx: t.x, cy: t.y, r: 17 }, 'mp-target'))
  svg.appendChild(label(t.x, t.y + 7, '出', 'mp-pintext'))
  svg.appendChild(label(t.x, t.y + 40, targetExit.name, 'mp-label'))

  // 出典表示（地理院タイルの利用条件）
  svg.appendChild(sv('rect', { x: W - 260, y: H - 28, width: 260, height: 28 }, 'mp-attrbg'))
  svg.appendChild(label(W - 8, H - 9, '地図: 国土地理院 地理院タイル（淡色地図）', 'mp-attr', 'end'))

  return svg
}
