import { arrowHead, label, sv } from './svg'

/**
 * 埋め込み用の構内図（アプリ独自作成）
 *
 * ⚠️ 著作権について：
 *   公式の構内図画像は各事業者の著作物なので、そのまま埋め込めない。
 *   ここにあるのは、公式構内図が示す「事実」（改札・出口・階の構成）を参照して
 *   アプリが独自に描き起こした簡略図。乗換案内各社と同じ方式で、
 *   事実は著作物ではないため権利上の問題はない。
 *
 * ⚠️ 内容は未実地確認（TODO: 実測）。参考にした公式ページは
 *   stations.ts の officialMaps に載せており、UIからリンクで開ける。
 *
 * 対応駅を増やすときは、この形式で1駅ずつ描き起こす。
 * （将来 GTFS-Pathways が整備されれば自動生成に置き換わる）
 */
export function floorPlan(stationId: string, targetExitId: string | null): SVGSVGElement | null {
  if (stationId === 'rokuchonome') return rokuchonomeB1(targetExitId)
  return null
}

/**
 * 六丁の目駅 地下1階（改札階）
 * 参考: 仙台市交通局 六丁の目駅ページの構内図（事実のみ参照して独自作図）
 */
function rokuchonomeB1(target: string | null): SVGSVGElement {
  const svg = sv('svg', { viewBox: '0 0 680 310' }, 'diagram')

  svg.appendChild(label(16, 30, '六丁の目駅 地下1階（改札階）', 'fp-title', 'start'))

  // コンコース（産業道路の地下に北東—南西方向）
  svg.appendChild(sv('rect', { x: 60, y: 60, width: 560, height: 150, rx: 12 }, 'fp-floor'))

  // 改札（1か所）
  svg.appendChild(sv('rect', { x: 310, y: 115, width: 60, height: 34, rx: 5 }, 'fp-gate'))
  svg.appendChild(label(340, 137, '改札', 'mp-pintext'))

  // ホームへの階段（改札の内側・下方向 = 地下3階へ）
  svg.appendChild(sv('rect', { x: 310, y: 168, width: 60, height: 30, rx: 5 }, 'fp-stairs'))
  svg.appendChild(label(340, 188, '階段', 'mp-pintext'))
  svg.appendChild(label(340, 232, 'ホーム（地下3階）へ', 'fp-small'))

  // 北1出口（北東側 = 図の右上）
  const n1 = target === 'rokuchonome_north1'
  svg.appendChild(sv('rect', { x: 556, y: 66, width: 56, height: 44, rx: 5 }, n1 ? 'fp-exit-target' : 'fp-exit'))
  svg.appendChild(label(584, 94, '北1', 'mp-pintext'))
  svg.appendChild(label(584, 128, '地上へ', n1 ? 'fp-label' : 'fp-small'))

  // 南1出口（南西側 = 図の左下）
  const s1 = target === 'rokuchonome_south1'
  svg.appendChild(sv('rect', { x: 68, y: 160, width: 56, height: 44, rx: 5 }, s1 ? 'fp-exit-target' : 'fp-exit'))
  svg.appendChild(label(96, 188, '南1', 'mp-pintext'))
  svg.appendChild(label(96, 152, '地上へ', s1 ? 'fp-label' : 'fp-small'))

  // 改札から目指す出口への矢印
  if (n1) {
    svg.appendChild(sv('line', { x1: 372, y1: 124, x2: 544, y2: 92 }, 'dg-route'))
    svg.appendChild(arrowHead(372, 124, 544, 92, 14, 'dg-route-head'))
  } else if (s1) {
    svg.appendChild(sv('line', { x1: 308, y1: 140, x2: 136, y2: 176 }, 'dg-route'))
    svg.appendChild(arrowHead(308, 140, 136, 176, 14, 'dg-route-head'))
  }

  // 方角の目安（出入口の実座標から: 北1が北東側）
  svg.appendChild(label(664, 30, '北東 ↗', 'fp-small', 'end'))
  svg.appendChild(label(16, 296, '公式構内図の事実情報を基にアプリが独自作成した簡略図です（未実地確認・暫定）', 'fp-note', 'start'))

  return svg
}
