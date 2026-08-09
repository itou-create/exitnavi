import type { GuidanceStepKind } from '../types'
import { arrowHead, label, sv } from './svg'

/**
 * 埋め込み用の構内図＝立体図（アプリ独自作成）
 *
 * 「3Dで案内できないか」への回答としての実装。
 * WebGLの本物の3Dは、①駅構内の3Dモデルがオープンデータに存在しない、
 * ②軽量Webであること自体が企画の主張（CLAUDE.md）、の2点から採らない。
 * 代わりに、3Dが本当に伝えたい「駅の縦の構造」（ホーム階→改札階→地上）を
 * アイソメトリックの立体断面図で描く。JR公式の「立体図」と同じ考え方。
 *
 * ⚠️ 著作権について：
 *   公式の構内図画像は各事業者の著作物なので、そのまま埋め込めない。
 *   ここにあるのは、公式構内図が示す「事実」（改札・出口・階の構成）を参照して
 *   アプリが独自に描き起こした図。事実は著作物ではないため権利上の問題はない。
 *
 * ⚠️ 内容は未実地確認（TODO: 実測）。参考にした公式ページは
 *   stations.ts の officialMaps に載せており、UIからリンクで開ける。
 *
 * currentKind を渡すと、いま進んでいる区間だけを強調表示する。
 * （現在位置の測位ではない。ユーザーの「次へ」申告に連動しているだけ）
 */
export function floorPlan(
  stationId: string,
  targetExitId: string | null,
  currentKind: GuidanceStepKind | null = null,
): SVGSVGElement | null {
  if (stationId === 'rokuchonome') return rokuchonomeIso(targetExitId, currentKind)
  return null
}

/** 六丁の目駅 立体図（B3ホーム → B1改札 → 地上） */
function rokuchonomeIso(target: string | null, kind: GuidanceStepKind | null): SVGSVGElement {
  const svg = sv('svg', { viewBox: '0 0 680 600' }, 'diagram')

  svg.appendChild(label(16, 32, '六丁の目駅 立体図（独自作成・暫定）', 'fp-title', 'start'))

  // ---- 3つの階（上から 地上 / B1 / B3）。ずらした平行四辺形で立体感を出す ----
  const floor = (yTop: number, cls: string) =>
    sv('polygon', {
      points: `${140},${yTop} ${660},${yTop} ${600},${yTop + 90} ${80},${yTop + 90}`,
    }, cls)

  svg.appendChild(floor(70, 'iso-ground'))
  svg.appendChild(floor(250, 'iso-floor'))
  svg.appendChild(floor(430, 'iso-floor'))

  svg.appendChild(label(16, 120, '地上', 'fp-label', 'start'))
  svg.appendChild(label(16, 300, '地下1階', 'fp-label', 'start'))
  svg.appendChild(label(16, 316, '（改札階）', 'fp-small', 'start'))
  svg.appendChild(label(16, 480, '地下3階', 'fp-label', 'start'))
  svg.appendChild(label(16, 496, '（ホーム）', 'fp-small', 'start'))

  // ---- 地上：産業道路と2つの出口 ----
  svg.appendChild(label(370, 100, '産業道路（県道137号）', 'fp-small'))
  const n1 = target === 'rokuchonome_north1'
  const s1 = target === 'rokuchonome_south1'
  svg.appendChild(sv('rect', { x: 497, y: 112, width: 46, height: 30, rx: 4 }, n1 ? 'fp-exit-target' : 'fp-exit'))
  svg.appendChild(label(520, 132, '北1', 'mp-pintext'))
  svg.appendChild(label(556, 132, '（北東側）', 'fp-small', 'start'))
  svg.appendChild(sv('rect', { x: 117, y: 112, width: 46, height: 30, rx: 4 }, s1 ? 'fp-exit-target' : 'fp-exit'))
  svg.appendChild(label(140, 132, '南1', 'mp-pintext'))
  svg.appendChild(label(112, 132, '（南西側）', 'fp-small', 'end'))

  // ---- B1：改札・出口への階段 ----
  svg.appendChild(sv('rect', { x: 310, y: 284, width: 60, height: 30, rx: 4 }, 'fp-gate'))
  svg.appendChild(label(340, 304, '改札', 'mp-pintext'))
  svg.appendChild(sv('rect', { x: 120, y: 284, width: 40, height: 26 }, 'fp-stairs'))
  svg.appendChild(sv('rect', { x: 500, y: 284, width: 40, height: 26 }, 'fp-stairs'))

  // ---- B3：ホームと降りた電車 ----
  svg.appendChild(sv('rect', { x: 130, y: 458, width: 420, height: 26, rx: 6 }, 'dg-train'))
  svg.appendChild(label(340, 476, '降りた電車（乗車位置は測りません）', 'fp-small'))
  svg.appendChild(sv('rect', { x: 360, y: 492, width: 40, height: 22 }, 'fp-stairs'))
  svg.appendChild(label(340, 540, 'ホーム中ほどに改札階への階段（暫定）', 'fp-small'))

  // ---- 縦のつながり（点線） ----
  svg.appendChild(sv('line', { x1: 380, y1: 492, x2: 380, y2: 314 }, 'iso-vert'))
  svg.appendChild(sv('line', { x1: 140, y1: 284, x2: 140, y2: 142 }, 'iso-vert'))
  svg.appendChild(sv('line', { x1: 520, y1: 284, x2: 520, y2: 142 }, 'iso-vert'))

  // ---- 経路。いま進んでいる区間だけ強調（測位ではなく「次へ」連動） ----
  const tx = n1 ? 520 : s1 ? 140 : null
  if (tx != null) {
    type Seg = { kinds: GuidanceStepKind[]; el: () => SVGElement[] }
    const segs: Seg[] = [
      {
        kinds: ['orient', 'move'],
        el: () => [sv('line', { x1: 380, y1: 500, x2: 380, y2: 318 }, 'iso-route')],
      },
      {
        kinds: ['gate'],
        el: () => [sv('line', { x1: 380, y1: 318, x2: 344, y2: 300 }, 'iso-route')],
      },
      {
        kinds: ['walk'],
        el: () => [sv('line', { x1: 336, y1: 298, x2: tx, y2: 297 }, 'iso-route')],
      },
      {
        kinds: ['exit'],
        el: () => [
          sv('line', { x1: tx, y1: 290, x2: tx, y2: 150 }, 'iso-route'),
          arrowHead(tx, 290, tx, 150, 13, 'dg-route-head'),
        ],
      },
    ]
    segs.forEach((seg) => {
      const isCurrent = kind != null && seg.kinds.includes(kind)
      const isOverview = kind == null
      seg.el().forEach((e) => {
        if (!isOverview && !isCurrent) e.classList.add('iso-route-dim')
        if (isCurrent) e.classList.add('iso-route-now')
        svg.appendChild(e)
      })
    })
  }

  svg.appendChild(label(16, 586,
    '公式構内図の事実情報を基にアプリが独自作成した立体図です（未実地確認・暫定）', 'fp-note', 'start'))

  return svg
}
