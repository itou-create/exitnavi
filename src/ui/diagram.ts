import type { ConcourseLeg, Platform } from '../types'
import { arrowHead, label, sv } from './svg'

/**
 * ホーム模式図：降りた電車・ホーム・階段の位置・両端の方面
 *
 * ⚠️ 縮尺のある図ではない。
 *    - ユーザーの現在位置は描かない（測っていないため）
 *    - 未実測の設備位置は「未実測」と明記して描く
 */
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
