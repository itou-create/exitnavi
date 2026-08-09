import type { AppState, ExitCandidate, OriginGuess, Platform } from '../types'
import { DESTINATIONS } from '../data/stations'
import { rankPlatformsForManualPick } from '../services/originGuess'
import { explain, fmtMin, TIE_THRESHOLD_SECONDS } from '../services/exitPicker'

/**
 * 描画
 *
 * 素のDOM操作。フレームワークは入れない。
 * 1画面1指示を守り、情報を詰め込みすぎないこと（設計原則）。
 */

export interface Handlers {
  onAcceptGuess: (guess: OriginGuess) => void
  onOpenManualPick: () => void
  onPickPlatform: (platform: Platform) => void
  onPickDestination: (id: string) => void
  onRestart: () => void
}

export function render(root: HTMLElement, s: AppState, h: Handlers): void {
  root.innerHTML = ''
  root.appendChild(statusBar(s))

  const body = el('div', 'body')
  switch (s.screen) {
    case 'locating':    body.appendChild(locating(s)); break
    case 'guessOrigin': body.appendChild(guessOrigin(s, h)); break
    case 'pickOrigin':  body.appendChild(pickOrigin(s, h)); break
    case 'pickDest':    body.appendChild(pickDest(s, h)); break
    case 'result':      body.appendChild(result(s, h)); break
    case 'error':       body.appendChild(errorView(s, h)); break
  }
  root.appendChild(body)
}

/* ------------------------------------------------------------------ */

function statusBar(s: AppState): HTMLElement {
  const bar = el('div', 'statusbar')
  bar.appendChild(text('span', 'brand', '出口ナビ'))

  const right = el('span', 'chips')
  if (s.accuracy != null) {
    // 嘘の精度を表示しない。測位精度はそのまま出す。
    const cls = s.accuracy <= 30 ? 'chip ok' : 'chip warn'
    right.appendChild(text('span', cls, `測位 ±${Math.round(s.accuracy)}m`))
  }
  if (s.usingMock) {
    // モックで動いていることを必ず明示する
    right.appendChild(text('span', 'chip mock', 'モックデータ'))
  }
  bar.appendChild(right)
  return bar
}

function locating(_s: AppState): HTMLElement {
  const w = el('div', 'center')
  w.appendChild(text('div', 'pulse', '📍'))
  w.appendChild(text('h2', '', '駅を探しています'))
  w.appendChild(text('p', 'sub', 'GPS・Wi-Fi・基地局から現在地を推定しています'))
  w.appendChild(text('p', 'hint', '地下でも「どの駅か」までは取れることが多い一方、「改札のどちら側か」は取れません。'))
  return w
}

/** ★ 起点の推定。当てにいって、違えば1タップで直せる */
function guessOrigin(s: AppState, h: Handlers): HTMLElement {
  const w = el('div', '')
  const g = s.guesses[0]

  w.appendChild(here(s.station?.name ?? '—', '駅は特定できましたが、ホームはまだ分かりません'))

  if (!g) {
    w.appendChild(text('h2', 'ask', 'どの路線で来ましたか？'))
    w.appendChild(text('p', 'sub', '直近の到着列車が見つからなかったため、選んでください。'))
    w.appendChild(platformList(s, h))
    return w
  }

  w.appendChild(text('h2', 'ask', 'この電車で来ましたか？'))

  const card = el('div', 'guesscard')
  card.appendChild(text('div', 'rtlabel', '● リアルタイム走行位置APIから推定'))
  card.appendChild(text('div', 'guessname', `${g.platform.operator} ${g.platform.line}`))
  card.appendChild(text('div', 'guesssub', g.platform.name))
  w.appendChild(card)

  const ev = el('div', 'evidence')
  ev.appendChild(text('div', 'evtitle', '推定の根拠'))
  g.evidence.forEach((e) => {
    const row = el('div', 'evrow')
    row.appendChild(text('span', '', e.label))
    row.appendChild(text('b', '', e.value))
    ev.appendChild(row)
  })
  ev.appendChild(rowOf('確からしさ', `${Math.round(g.confidence * 100)}%`))
  w.appendChild(ev)

  w.appendChild(text('div', 'narrow',
    `候補 ${s.station?.platforms.length ?? 0}路線 → ${s.guesses.length}本に絞り込み`))

  const yes = button('primary', 'はい、これです', () => h.onAcceptGuess(g))
  yes.appendChild(text('small', '', `${g.platform.name}から案内を始めます`))
  w.appendChild(yes)

  w.appendChild(button('ghost', 'ちがう路線で来た', () => h.onOpenManualPick()))
  return w
}

function pickOrigin(s: AppState, h: Handlers): HTMLElement {
  const w = el('div', '')
  w.appendChild(text('h2', 'ask', 'どの路線で来ましたか？'))
  w.appendChild(text('p', 'sub',
    `${s.station?.name ?? ''}は複数の事業者が乗り入れています。ホームの位置がまったく違います。`))
  w.appendChild(platformList(s, h))
  return w
}

function platformList(s: AppState, h: Handlers): HTMLElement {
  const list = el('div', 'list')
  if (!s.station) return list

  rankPlatformsForManualPick(s.station, s.guesses).forEach(({ platform, hasArrival }) => {
    const row = el('button', 'lrow')
    const bar = el('span', 'lbar')
    bar.style.background = platform.color
    row.appendChild(bar)

    const t = el('span', 'ltext')
    t.appendChild(text('span', 'n1', `${platform.operator} ${platform.line}`))
    t.appendChild(text('span', 'n2', `${platform.name} ／ ${levelLabel(platform.levelIndex)}`))
    row.appendChild(t)

    row.appendChild(text('span', hasArrival ? 'tag hit' : 'tag no',
      hasArrival ? 'この時刻に到着' : '該当なし'))
    row.addEventListener('click', () => h.onPickPlatform(platform))
    list.appendChild(row)
  })
  return list
}

function pickDest(s: AppState, h: Handlers): HTMLElement {
  const w = el('div', '')
  w.appendChild(here(s.origin?.name ?? '—',
    `起点が確定しました ／ from_stop_id = ${s.origin?.id ?? '—'}`))
  w.appendChild(text('h2', 'ask', 'どこへ行きますか？'))

  const list = el('div', 'list')
  DESTINATIONS.forEach((d) => {
    const row = el('button', 'drow')
    row.appendChild(text('span', 'dic', d.emoji))
    const t = el('span', 'ltext')
    t.appendChild(text('span', 'n1', d.name))
    row.appendChild(t)
    row.appendChild(text('span', 'arrow', '›'))
    row.addEventListener('click', () => h.onPickDestination(d.id))
    list.appendChild(row)
  })
  w.appendChild(list)
  return w
}

function result(s: AppState, h: Handlers): HTMLElement {
  const w = el('div', '')
  const best = s.candidates[0]

  if (!best) {
    w.appendChild(text('h2', 'ask', '案内できる出口が見つかりませんでした'))
    w.appendChild(text('p', 'sub',
      `${s.origin?.name ?? ''}から${s.destination?.name ?? ''}への構内データが未整備です。`))
    w.appendChild(button('ghost', '最初にもどる', h.onRestart))
    return w
  }

  w.appendChild(text('div', 'crumb',
    `${s.origin?.operator ?? ''} ${s.origin?.line ?? ''} → ${s.destination?.name ?? ''}`))

  const big = el('div', 'bigexit')
  big.appendChild(text('div', 'pre', `${s.destination?.name ?? ''}へは`))
  big.appendChild(text('div', 'exname', best.exit.name))
  w.appendChild(big)

  // 現地の案内板の表記（GTFS-Pathways の signposted_as）。
  // アプリの言葉と目の前の案内板の言葉を揃えるのが企画の要。
  const sign = el('div', 'sign')
  sign.appendChild(text('div', 's1', '現地の案内板の表記'))
  sign.appendChild(text('div', 's2', best.signpostedAs))
  w.appendChild(sign)

  const facts = el('div', 'facts')
  facts.appendChild(fact(fmtMin(best.totalSeconds), '目的地まで'))
  facts.appendChild(fact(best.stairCount === 0 ? '階段なし' : `${best.stairCount}段`, '構内の階段'))
  facts.appendChild(fact(`${best.outdoorMeters}m`, '地上を歩く'))
  facts.appendChild(fact(best.gateName, 'くぐる改札'))
  w.appendChild(facts)

  w.appendChild(text('p', 'why', explain(best, s.candidates[1], s.origin!)))

  if (s.candidates.length > 1) {
    const cmp = el('div', 'compare')
    cmp.appendChild(text('div', 'evtitle', 'ほかの出口'))
    s.candidates.slice(1, 4).forEach((c) => cmp.appendChild(compareRow(c, best)))
    w.appendChild(cmp)
  }

  // 数値が暫定であることを隠さない
  w.appendChild(text('p', 'hint',
    '構内の所要時間は暫定値です（pathways.txt 未整備のため手入力）。実測に置き換えるまで参考値として扱ってください。'))

  w.appendChild(button('ghost', '最初にもどる', h.onRestart))
  return w
}

function compareRow(c: ExitCandidate, best: ExitCandidate): HTMLElement {
  const row = el('div', 'crow')
  row.appendChild(text('span', '', c.exit.name))
  const diff = c.totalSeconds - best.totalSeconds
  const label = diff < TIE_THRESHOLD_SECONDS ? 'ほぼ同じ' : `+${fmtMin(diff)}`
  row.appendChild(text('b', diff < TIE_THRESHOLD_SECONDS ? 'tie' : '', label))
  return row
}

function errorView(s: AppState, h: Handlers): HTMLElement {
  const w = el('div', 'center')
  w.appendChild(text('div', 'pulse', '⚠️'))
  w.appendChild(text('h2', '', 'うまくいきませんでした'))
  w.appendChild(text('p', 'sub', s.error ?? ''))
  w.appendChild(button('ghost', 'もう一度ためす', h.onRestart))
  return w
}

/* ---------------------------- helpers ---------------------------- */

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  return n
}

function text(tag: keyof HTMLElementTagNameMap, cls: string, content: string): HTMLElement {
  const n = el(tag, cls)
  n.textContent = content
  return n
}

function button(cls: string, label: string, onClick: () => void): HTMLElement {
  const b = el('button', `btn ${cls}`)
  b.appendChild(text('span', '', label))
  b.addEventListener('click', onClick)
  return b
}

function here(title: string, sub: string): HTMLElement {
  const box = el('div', 'here')
  box.appendChild(text('div', 'herename', title))
  box.appendChild(text('div', 'heresub', sub))
  return box
}

function fact(value: string, label: string): HTMLElement {
  const f = el('div', 'fact')
  f.appendChild(text('div', 'fv', value))
  f.appendChild(text('div', 'fl', label))
  return f
}

function rowOf(label: string, value: string): HTMLElement {
  const row = el('div', 'evrow')
  row.appendChild(text('span', '', label))
  row.appendChild(text('b', '', value))
  return row
}

function levelLabel(index: number): string {
  if (index === 0) return '地上1F'
  if (index > 0) return `${index + 1}F`
  return `地下${-index}F`
}
