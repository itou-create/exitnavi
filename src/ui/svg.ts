/** SVG 生成の共通ヘルパー（図面・地図・構内図で共用） */

const NS = 'http://www.w3.org/2000/svg'

export function sv<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  cls?: string,
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v))
  if (cls) n.setAttribute('class', cls)
  return n
}

/** 白フチ付きテキスト。地図やラベル同士の重なりの上でも読めるようにする */
export function label(
  x: number,
  y: number,
  content: string,
  cls = 'dg-label',
  anchor = 'middle',
): SVGTextElement {
  const t = sv('text', { x, y, 'text-anchor': anchor }, `${cls} dg-halo`)
  t.textContent = content
  return t
}

/** 矢じり（線の終端に付ける三角形） */
export function arrowHead(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
  cls: string,
): SVGPolygonElement {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const p = (a: number) => `${x2 - size * Math.cos(angle + a)},${y2 - size * Math.sin(angle + a)}`
  return sv('polygon', { points: `${x2},${y2} ${p(0.45)} ${p(-0.45)}` }, cls)
}
