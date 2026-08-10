import type { AppState, BoardedPosition, Destination, ExitCandidate, GuidanceDirection, LatLng, OriginGuess, Platform, Station } from '../types'
import { DESTINATIONS, DESTINATION_RADIUS_METERS } from '../data/stations'
import { distanceMeters } from '../services/geo'
import { rankPlatformsForManualPick } from '../services/originGuess'
import { explain, fmtMin, TIE_THRESHOLD_SECONDS } from '../services/exitPicker'
import { placesSearchEnabled, searchPlaces } from '../services/places'
import { directionDisplay } from '../services/guide'
import { platformDiagram } from './diagram'
import { stationMap } from './map'
import { floorPlan } from './floorplans'
import { bearingDegrees } from '../services/geo'
import { startCompass } from '../services/compass'
import { startStepCounter, STRIDE_METERS } from '../services/steps'
import { startTurnDetector } from '../services/turn'
import { measuresFor, medianTotalSec } from '../services/telemetry'

/**
 * 描画
 *
 * 素のDOM操作。フレームワークは入れない。
 * 1画面1指示を守り、情報を詰め込みすぎないこと（設計原則）。
 */

export interface Handlers {
  onPickStation: (station: Station) => void
  /** 駅の近くにいない人向け。モックデータで一通りの流れを体験する */
  onStartDemo: () => void
  onAcceptGuess: (guess: OriginGuess) => void
  onOpenManualPick: () => void
  onPickPlatform: (platform: Platform) => void
  onPickDestination: (destination: Destination) => void
  onStartGuide: () => void
  onPickBoarded: (pos: BoardedPosition | null) => void
  onToggleAutoGuide: () => void
  onShareMeasurements: () => void
  onGuideStep: (delta: number) => void
  onGuideExit: () => void
  onCheckOutdoor: () => void
  onRestart: () => void
}

export function render(root: HTMLElement, s: AppState, h: Handlers): void {
  root.innerHTML = ''
  root.appendChild(statusBar(s))

  const body = el('div', 'body')
  switch (s.screen) {
    case 'locating':    body.appendChild(locating(s)); break
    case 'pickStation': body.appendChild(pickStation(s, h)); break
    case 'guessOrigin': body.appendChild(guessOrigin(s, h)); break
    case 'pickOrigin':  body.appendChild(pickOrigin(s, h)); break
    case 'pickDest':    body.appendChild(pickDest(s, h)); break
    case 'result':      body.appendChild(result(s, h)); break
    case 'askBoarded':  body.appendChild(askBoarded(s, h)); break
    case 'guide':       body.appendChild(guide(s, h)); break
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

/**
 * 駅の選択。自動判定できなかったときだけ出す画面。
 * 「対応駅の圏外なのに池袋として案内する」という嘘をつかないための画面でもある。
 */
function pickStation(s: AppState, h: Handlers): HTMLElement {
  const w = el('div', '')
  w.appendChild(text('h2', 'ask', 'どの駅にいますか？'))
  if (s.locateNote) w.appendChild(text('p', 'sub', s.locateNote))

  const list = el('div', 'list')
  s.stationChoices.forEach(({ station, meters }) => {
    const row = el('button', 'drow')
    row.appendChild(text('span', 'dic', '🚉'))
    const t = el('span', 'ltext')
    t.appendChild(text('span', 'n1', station.name))
    t.appendChild(text('span', 'n2',
      meters != null ? `現在地から約${fmtDistance(meters)}` : `${station.platforms.length}路線`))
    row.appendChild(t)
    row.appendChild(text('span', 'arrow', '›'))
    row.addEventListener('click', () => h.onPickStation(station))
    list.appendChild(row)
  })
  w.appendChild(list)

  // 駅の近くにいない人には、実データの代わりにデモを提案する
  const demo = button('ghost', 'デモにしますか？（モックデータで体験）', () => h.onStartDemo())
  demo.appendChild(text('small', '', '池袋駅に着いた想定で、推定→出口案内の流れを試せます'))
  w.appendChild(demo)

  return w
}

function fmtDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)}km`
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
    s.station && s.station.platforms.length > 1
      ? `${s.station.name}は複数の路線が乗り入れています。ホームの位置がまったく違います。`
      : `${s.station?.name ?? ''}のホームを確認してください。`))

  // 走行位置データが無い駅では、自動推定できない事実を隠さない
  if (s.station && !s.usingMock && s.station.platforms.every((p) => p.trainLocationAvailable === false)) {
    w.appendChild(text('p', 'hint',
      'この駅の路線は走行位置データが未提供のため、到着列車からの自動推定はできません。'))
  }

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

  // フリーワード検索（Google Places）。キー未設定なら出さない
  if (s.station && placesSearchEnabled()) {
    w.appendChild(searchBlock(s.station, h))
  }

  // 現在の駅から歩ける目的地だけを出す（別の街のPOIを混ぜない）
  const near = s.station
    ? DESTINATIONS.filter(
        (d) => distanceMeters(d.position, s.station!.position) <= DESTINATION_RADIUS_METERS,
      )
    : DESTINATIONS

  const list = el('div', 'list')
  near.forEach((d) => {
    list.appendChild(destinationRow(d, null, h))
  })
  w.appendChild(list)
  return w
}

/**
 * 目的地のフリーワード検索。
 *
 * 再描画で入力が消えないよう、結果はこのブロック内のDOMを直接書き換える
 * （setState を経由しない。画面遷移するのは目的地を選んだ瞬間だけ）。
 * コスト管理のため、オートコンプリートにはせず明示的な検索実行のみ。
 */
function searchBlock(station: Station, h: Handlers): HTMLElement {
  const box = el('div', 'searchbox')

  const form = el('form', 'searchrow')
  const input = el('input', 'searchinput')
  input.type = 'search'
  input.placeholder = '行き先を検索（店名・施設名）'
  input.enterKeyHint = 'search'
  const btn = el('button', 'searchbtn')
  btn.type = 'submit'
  btn.textContent = '検索'
  form.appendChild(input)
  form.appendChild(btn)
  box.appendChild(form)

  const out = el('div', 'searchout')
  box.appendChild(out)

  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    const query = input.value.trim()
    if (!query) return

    btn.disabled = true
    btn.textContent = '検索中…'
    out.innerHTML = ''

    searchPlaces(query, station.position)
      .then((results) => {
        out.innerHTML = ''
        if (results.length === 0) {
          out.appendChild(text('p', 'sub', `「${query}」は見つかりませんでした。`))
          return
        }
        const list = el('div', 'list')
        results.forEach((d) => list.appendChild(destinationRow(d, station, h)))
        out.appendChild(list)
        // Google Places の結果を地図なしで出すときに必要な帰属表示
        out.appendChild(text('p', 'attribution', 'Powered by Google'))
      })
      .catch((e) => {
        out.innerHTML = ''
        out.appendChild(text('p', 'sub', e instanceof Error ? e.message : String(e)))
      })
      .finally(() => {
        btn.disabled = false
        btn.textContent = '検索'
      })
  })

  return box
}

/** 目的地1件の行。station を渡すと駅からの距離を添える */
function destinationRow(d: Destination, station: Station | null, h: Handlers): HTMLElement {
  const row = el('button', 'drow')
  row.appendChild(text('span', 'dic', d.emoji))
  const t = el('span', 'ltext')
  t.appendChild(text('span', 'n1', d.name))

  const subParts: string[] = []
  if (station) subParts.push(`駅から約${fmtDistance(distanceMeters(d.position, station.position))}`)
  if (d.address) subParts.push(d.address)
  if (subParts.length > 0) t.appendChild(text('span', 'n2', subParts.join(' ／ ')))

  row.appendChild(t)
  row.appendChild(text('span', 'arrow', '›'))
  row.addEventListener('click', () => h.onPickDestination(d))
  return row
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

  // 独自作成の構内図（描き起こし済みの駅のみ）と、実地図（地理院タイル）
  if (s.station) {
    const fp = floorPlan(s.station.id, best.exit.id)
    if (fp) {
      w.appendChild(fp)
      w.appendChild(text('p', 'dgcap',
        '駅の立体図（公式構内図の事実情報を基に独自作成・未実地確認）。緑の線がホームから出口までの経路です。'))
    }
    w.appendChild(stationMap(s.station, best.exit, s.destination))
    w.appendChild(text('p', 'dgcap',
      '実際の地図（国土地理院 地理院タイル）に出口位置（OpenStreetMap由来・暫定）を重ねています。現在位置は表示していません。'))
    s.station.officialMaps?.forEach((m) => {
      w.appendChild(linkButton(`公式の構内図を開く（${m.label}）`, m.url))
    })
  }

  if (s.candidates.length > 1) {
    const cmp = el('div', 'compare')
    cmp.appendChild(text('div', 'evtitle', 'ほかの出口'))
    s.candidates.slice(1, 4).forEach((c) => cmp.appendChild(compareRow(c, best)))
    w.appendChild(cmp)
  }

  // 数値が暫定であることを隠さない。この端末の実測があればそれも見せる
  const myMeasures = s.station && s.origin
    ? measuresFor(s.station.id, s.origin.id, best.exit.id)
    : []
  const myMedian = medianTotalSec(myMeasures)
  if (myMedian != null) {
    w.appendChild(text('p', 'why',
      `この経路のあなたの実測: 中央値 約${fmtMin(myMedian)}（${myMeasures.length}回の歩行記録より）`))
  }
  w.appendChild(text('p', 'hint',
    '構内の所要時間は暫定値です（pathways.txt 未整備のため手入力）。実測に置き換えるまで参考値として扱ってください。'))

  const go = button('primary', 'この出口へ案内を始める', h.onStartGuide)
  go.appendChild(text('small', '', '改札から出口まで、1画面1指示で案内します'))
  w.appendChild(go)

  w.appendChild(button('ghost', '最初にもどる', h.onRestart))
  return w
}

/**
 * 「どのあたりに乗っていましたか？」
 *
 * 降りた本人が確実に知っている唯一の位置情報（乗車位置）を1タップで聞く。
 * これと「電車が走り去った方向」から、降車直後の一歩目を言い切れる。
 * 答えたくなければ「わからない」で従来の案内に落ちる。
 */
function askBoarded(s: AppState, h: Handlers): HTMLElement {
  const w = el('div', '')
  w.appendChild(here(s.origin?.name ?? '—', s.originTrain ? '直近の到着列車から案内を組み立てます' : ''))
  w.appendChild(text('h2', 'ask', 'どのあたりに乗っていましたか？'))
  w.appendChild(text('p', 'sub', '進行方向に対しての位置です。だいたいで構いません。'))

  const options: Array<{ pos: BoardedPosition | null; icon: string; t1: string; t2: string }> = [
    { pos: 'front', icon: '🔜', t1: '前のほう', t2: '進行方向の先頭寄り' },
    { pos: 'middle', icon: '🚃', t1: '真ん中あたり', t2: '' },
    { pos: 'rear', icon: '🔙', t1: '後ろのほう', t2: '進行方向の最後尾寄り' },
    { pos: null, icon: '🤷', t1: 'わからない', t2: '乗車位置を使わずに案内します' },
  ]

  const list = el('div', 'list')
  options.forEach((o) => {
    const row = el('button', 'drow')
    row.appendChild(text('span', 'dic', o.icon))
    const t = el('span', 'ltext')
    t.appendChild(text('span', 'n1', o.t1))
    if (o.t2) t.appendChild(text('span', 'n2', o.t2))
    row.appendChild(t)
    row.appendChild(text('span', 'arrow', '›'))
    row.addEventListener('click', () => h.onPickBoarded(o.pos))
    list.appendChild(row)
  })
  w.appendChild(list)
  return w
}

/**
 * ステップ案内（第2段階）
 *
 * 現在地は測らない・描かない。「次に何をするか」を1画面1指示で出し、
 * 進行はユーザーの「次へ」で申告してもらう。
 * 最終ステップだけ、許可されている測位（地上に出たかの判定）を任意で使える。
 */
function guide(s: AppState, h: Handlers): HTMLElement {
  const w = el('div', '')
  const step = s.guideSteps[s.guideIndex]
  const total = s.guideSteps.length

  if (!step) {
    w.appendChild(text('h2', 'ask', 'この経路のステップ案内データがありません'))
    w.appendChild(button('ghost', '結果にもどる', h.onGuideExit))
    return w
  }

  w.appendChild(text('div', 'crumb',
    `${s.origin?.name ?? ''} → ${s.candidates[0]?.exit.name ?? ''}` +
    (s.destination ? `（${s.destination.name}方面）` : '') +
    ` ／ ${s.guideIndex + 1}/${total}`))

  // 旅程のどこにいるか（路線図風）。位置の測位ではなく「次へ」の申告に連動
  w.appendChild(journeyStrip(step.kind))

  // 自動判定モード。ONなら歩数・ジャイロ・測位が自動で動き、条件を満たすと次へ進む
  if (s.autoGuide) {
    const box = el('div', 'autoline')
    box.appendChild(text('span', 'autodot', '●'))
    const stat = text('span', 'autostat', '自動判定を開始しています…')
    stat.id = 'autostatus'
    box.appendChild(stat)
    const off = el('button', 'autooff')
    off.textContent = 'OFF'
    off.addEventListener('click', () => h.onToggleAutoGuide())
    box.appendChild(off)
    w.appendChild(box)
  } else {
    w.appendChild(button('ghost', '自動判定モードをON（歩数・ジャイロで自動で進む）', () => h.onToggleAutoGuide()))
  }

  // 方向と距離が主役。案内表示を見なくても次の一歩が決まるようにする
  if (step.direction) {
    const d = directionDisplay(step.direction)
    const dir = el('div', 'dirbox')
    dir.appendChild(text('span', 'dirarrow', d.arrow))
    const dt = el('span', 'ltext')
    dt.appendChild(text('span', 'dirlabel', d.label))
    dt.appendChild(text('span', 'dirsub',
      (step.distanceMeters != null ? `約${step.distanceMeters}m ／ ` : '') +
      (step.directionBase ?? '直前の動作を終えた向きが基準です')))
    dir.appendChild(dt)
    w.appendChild(dir)
  }

  // 指示本体（1画面1指示）
  w.appendChild(text('div', 'stepinst', step.instruction))
  if (step.detail) w.appendChild(text('p', 'stepdetail', step.detail))

  // 案内板の表記は「答え合わせ」用。主役ではない
  if (step.signpostedAs) {
    const sign = el('div', 'sign')
    sign.appendChild(text('div', 's1', '確認用 — 近くにこの表記があれば合っています'))
    sign.appendChild(text('div', 's2', step.signpostedAs))
    w.appendChild(sign)
  }

  // 図面。ステップの局面に合わせて出し分ける
  const best = s.candidates[0]
  const leg =
    s.station && s.origin && best
      ? s.station.legs.find((l) => l.platformId === s.origin!.id && l.exitId === best.exit.id)
      : undefined
  if (step.kind === 'orient' || step.kind === 'move') {
    if (s.origin && leg) {
      w.appendChild(platformDiagram(s.origin, leg))
      w.appendChild(text('p', 'dgcap', 'ホームの模式図です。縮尺はありません。あなたの現在位置は測っていないため描いていません。'))
    }
  } else if (s.station && best) {
    // 改札〜構内は立体図（あれば）で現在の区間を強調、地上に出るステップは実地図
    const fp = step.kind !== 'exit' ? floorPlan(s.station.id, best.exit.id, step.kind) : null
    if (fp) {
      w.appendChild(fp)
      w.appendChild(text('p', 'dgcap',
        '駅の立体図。太く光っている区間がこのステップで進むところです（測位ではなく「次へ」に連動）。'))
    } else {
      w.appendChild(stationMap(s.station, best.exit, step.kind === 'exit' ? s.destination : null))
      w.appendChild(text('p', 'dgcap', '実際の地図（国土地理院 地理院タイル）。現在位置は表示していません。'))
    }
    const om = s.station.officialMaps?.[0]
    if (om) w.appendChild(linkButton('公式の構内図を開く', om.url))
  }

  const last = s.guideIndex === total - 1

  // 手動のセンサーボタンは自動判定モード中は出さない（重複するため）
  if (!s.autoGuide) {
    // 歩数による進み具合（構内での精度向上）。歩く系のステップにだけ出す
    if (step.kind === 'orient' || step.kind === 'walk' || step.kind === 'gate') {
      w.appendChild(walkProgressBlock(step.distanceMeters ?? null))
    }
    // ジャイロによる曲がり確認。方向指示のあるステップにだけ出す
    if (step.direction) {
      w.appendChild(turnCheckBlock(step.direction))
    }
  }

  if (!last) {
    w.appendChild(text('p', 'stepnext', `次：${s.guideSteps[s.guideIndex + 1].instruction}`))
  } else {
    if (s.guideArrivalNote) w.appendChild(text('p', 'why', s.guideArrivalNote))
    w.appendChild(button('ghost', '地上に出たか確認する（測位）', h.onCheckOutdoor))

    // 実測データの提供（クラウドソーシング）。歩いたこと自体が計測になっている
    const share = button('ghost', '📊 この歩行の計測データを提供する', h.onShareMeasurements)
    share.appendChild(text('small', '',
      '各ステップの秒数・歩数・回転角だけを共有します（位置の履歴は含みません）'))
    w.appendChild(share)
    if (s.destination) {
      const exit = s.candidates[0]?.exit
      // 地上に出た後の「で、どっち？」に、端末の向きに追随する矢印で答える
      if (exit) w.appendChild(compassBlock(exit.position, s.destination))
      const a = el('a', 'btn ghost')
      a.textContent = `Googleマップで${s.destination.name}まで徒歩経路を開く`
      a.href =
        'https://www.google.com/maps/dir/?api=1' +
        (exit ? `&origin=${exit.position.lat},${exit.position.lng}` : '') +
        `&destination=${s.destination.position.lat},${s.destination.position.lng}&travelmode=walking`
      a.target = '_blank'
      a.rel = 'noopener'
      w.appendChild(a)
    }
  }

  w.appendChild(text('p', 'hint',
    'この案内は暫定データから生成しています。実際の構内では現地の案内板を優先してください。現在地の測位はしていません。'))

  // 実地フィードバック。「違った」の報告がそのままデータ修正になる仕組み
  if (s.station && s.origin && best) {
    const title = `[実地報告] ${s.station.name} ${s.origin.line} → ${best.exit.name}（ステップ${s.guideIndex + 1}/${total}）`
    const body = [
      '## 表示されていた案内',
      `- 指示: ${step.instruction}`,
      `- 方向: ${step.direction ?? '（表示なし）'}`,
      step.detail ? `- 補足: ${step.detail}` : '',
      '',
      '## 実際はどうだったか（ここに書いてください）',
      '- ',
      '',
      '## 修正対象データ（開発用メモ）',
      `- stations.ts の leg: platformId=${s.origin.id}, exitId=${best.exit.id}`,
    ].filter((l) => l !== '').join('\n')
    w.appendChild(linkButton('実際と違っていたら報告する',
      `https://github.com/itou-create/exitnavi/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`))
  }

  if (!last) {
    w.appendChild(button('primary', 'できた — 次へ', () => h.onGuideStep(1)))
  } else {
    w.appendChild(button('primary', '案内を終える', h.onRestart))
  }
  if (s.guideIndex > 0) w.appendChild(button('ghost', 'ひとつ戻る', () => h.onGuideStep(-1)))
  w.appendChild(button('ghost', '案内をやめる', h.onGuideExit))
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

/**
 * ジャーニーバー（路線図風の現在地表現）。
 * ホーム→階段→改札→通路→出口の5駅を並べ、いまの局面を光らせる。
 * ⚠️ 現在地の測位ではない。ユーザーの「次へ」申告に連動しているだけ。
 */
function journeyStrip(current: AppState['guideSteps'][number]['kind']): HTMLElement {
  const stages = [
    { kind: 'orient', icon: '🚃', label: 'ホーム' },
    { kind: 'move',   icon: '🪜', label: '階段' },
    { kind: 'gate',   icon: '🎫', label: '改札' },
    { kind: 'walk',   icon: '🚶', label: '通路' },
    { kind: 'exit',   icon: '🌤', label: '出口' },
  ] as const

  const idx = Math.max(0, stages.findIndex((st) => st.kind === current))
  const wrap = el('div', 'journey')

  const line = el('div', 'jline')
  const fill = el('div', 'jlinefill')
  fill.style.width = `${(idx / (stages.length - 1)) * 100}%`
  line.appendChild(fill)
  wrap.appendChild(line)

  stages.forEach((st, i) => {
    const node = el('div', `jnode ${i < idx ? 'done' : i === idx ? 'now' : ''}`)
    node.appendChild(text('span', 'jdot', i < idx ? '✓' : st.icon))
    node.appendChild(text('span', 'jlabel', st.label))
    if (i === idx) node.appendChild(text('span', 'jhere', 'いまここ'))
    wrap.appendChild(node)
  })

  return wrap
}

/**
 * 歩数による進み具合。屋内で絶対位置は取れないが、
 * 「指示どおりに進めているか」は歩数×歩幅の推定で伝えられる。
 * 目安距離（distanceMeters）があれば進捗バーと「そろそろ」通知を出す。
 */
function walkProgressBlock(targetMeters: number | null): HTMLElement {
  const box = el('div', 'walkbox')
  const note = text('p', 'compassnote',
    targetMeters != null
      ? `このステップの目安は約${targetMeters}mです。歩数で進み具合を出せます`
      : '歩数で歩いた距離の目安を出せます')
  const bar = el('div', 'stepbar')
  const fill = el('div', 'stepfill')
  bar.appendChild(fill)
  bar.style.display = 'none'

  const btn = button('ghost', '歩数で進み具合を表示', () => {
    void startStepCounter((steps) => {
      const meters = Math.round(steps * STRIDE_METERS)
      if (targetMeters != null) {
        bar.style.display = ''
        const ratio = Math.min(meters / targetMeters, 1)
        fill.style.width = `${Math.round(ratio * 100)}%`
        note.textContent =
          ratio >= 1
            ? `約${meters}m歩きました — そろそろ次の目印です（歩幅${STRIDE_METERS}m換算の目安）`
            : `約${meters}m / 目安${targetMeters}m（歩幅${STRIDE_METERS}m換算）`
      } else {
        note.textContent = `ここまで約${meters}m（${steps}歩 × 歩幅${STRIDE_METERS}m の目安）`
      }
    }).then((res) => {
      if (res === 'denied') note.textContent = 'モーションセンサーの利用が許可されませんでした'
      else if (res === 'unsupported') note.textContent = 'この端末ではモーションセンサーを使えません'
      else btn.style.display = 'none'
    })
  })

  box.appendChild(note)
  box.appendChild(bar)
  box.appendChild(btn)
  return box
}

/**
 * ジャイロによる曲がり確認。
 * 絶対方位は構内で乱れるが、相対的な回転量はジャイロ由来なので構内でも使える。
 * 「指示どおり曲がれたか」をその場で確かめられる。
 */
function turnCheckBlock(direction: GuidanceDirection): HTMLElement {
  const box = el('div', 'walkbox')
  const note = text('p', 'compassnote', 'ジャイロで「指示どおり曲がれたか」を確認できます')

  const targetDeg = direction === 'u-turn' ? 150 : direction.startsWith('slight') ? 30 : 60
  const wantRight = direction === 'right' || direction === 'slight-right'
  const wantLeft = direction === 'left' || direction === 'slight-left'

  const btn = button('ghost', '曲がりをジャイロで確認', () => {
    void startTurnDetector((cum) => {
      const deg = Math.round(Math.abs(cum))
      const turned = cum > 0 ? '右' : '左'
      if (direction === 'straight') {
        note.textContent =
          Math.abs(cum) < 45
            ? `ほぼまっすぐ進めています（回転 ${turned}${deg}°）`
            : `⚠ 直進の指示ですが、${turned}へ${deg}°曲がっています`
        return
      }
      const ok =
        direction === 'u-turn'
          ? Math.abs(cum) >= targetDeg
          : wantRight
            ? cum >= targetDeg
            : wantLeft
              ? cum <= -targetDeg
              : false
      note.textContent = ok
        ? `✓ 指示どおり曲がれました（${turned}へ${deg}°）`
        : `いま${turned}へ${deg}°回転（指示: ${wantRight ? '右' : wantLeft ? '左' : '折り返し'}へ約${targetDeg}°以上）`
    }).then((res) => {
      if (res === 'denied') note.textContent = 'モーションセンサーの利用が許可されませんでした'
      else if (res === 'unsupported') note.textContent = 'この端末ではジャイロを使えません'
      else btn.style.display = 'none'
    })
  })

  box.appendChild(note)
  box.appendChild(btn)
  return box
}

/**
 * コンパス。目的地の方角を、端末の向きに追随する矢印で示す。
 * 屋内では磁気が乱れるため、地上に出る最終ステップ限定で表示している。
 * センサーの目安であることを常に明記する（嘘の精度を出さない）。
 */
function compassBlock(from: LatLng, destination: Destination): HTMLElement {
  const box = el('div', 'compassbox')
  const dial = el('div', 'compassdial')
  const needle = el('div', 'compassneedle')
  needle.textContent = '⬆'
  dial.appendChild(needle)
  const note = text('p', 'compassnote',
    '地上に出てからボタンを押すと、矢印が目的地の方角を指します（磁気センサーの目安）')

  const btn = button('ghost', 'コンパスで方角を示す（屋外で）', () => {
    const bearing = bearingDegrees(from, destination.position)
    void startCompass((heading) => {
      needle.style.transform = `rotate(${(bearing - heading + 360) % 360}deg)`
    }).then((res) => {
      if (res === 'ok') {
        note.textContent = `矢印が「${destination.name}」の方角です（目安。屋内・改札内では狂います）`
      } else if (res === 'denied') {
        note.textContent = '方位センサーの利用が許可されませんでした'
      } else {
        note.textContent = 'この端末では方位センサーを使えません'
      }
    })
  })

  box.appendChild(dial)
  box.appendChild(note)
  box.appendChild(btn)
  return box
}

/** 外部リンクをボタンの見た目で開く（新しいタブ） */
function linkButton(label: string, url: string): HTMLElement {
  const a = el('a', 'btn ghost')
  a.textContent = label
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  return a
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
