import type { ArrivedTrain, Station } from '../types'
import { mockTrains, type RawTrain } from '../data/mock/trains'

/**
 * ODPT（公共交通オープンデータセンター）クライアント
 *
 * ⚠️ APIキーが無くても全画面が動くこと。これは開発の都合であると同時に、
 *    深夜・早朝など列車が走っていない時間帯にデモするために必須（CLAUDE.md）。
 *
 * キーの取得: https://developer.odpt.org/
 */

const TOKEN = import.meta.env.VITE_ODPT_TOKEN as string | undefined
const FORCE_MOCK = String(import.meta.env.VITE_FORCE_MOCK) === 'true'

/** 開発時は vite.config.ts の proxy 経由（CORS 回避）、本番は直叩き */
const BASE = import.meta.env.DEV ? '/odpt' : 'https://api.odpt.org/api/v4'

/** 「デモにしますか？」でユーザーが選んだデモモード。リスタートで解除する */
let demoMode = false

export function setDemoMode(on: boolean): void {
  demoMode = on
}

export function usingMock(): boolean {
  return FORCE_MOCK || demoMode || !TOKEN
}

/**
 * 「この駅に着いたばかりの列車」を取り出す。
 *
 * ★ このプロジェクトの核心。
 *   走行位置APIを「遅延表示」ではなく「ユーザーの現在地推定」に使う。
 *   列車の位置から人の位置を逆算する、という筋。
 *
 * @param station      対象の駅
 * @param withinSeconds 何秒前までの到着を候補に含めるか
 */
export async function fetchArrivedTrains(
  station: Station,
  withinSeconds = 90,
): Promise<{ trains: ArrivedTrain[]; mocked: boolean }> {
  // trainLocationAvailable === false の路線（非提供を確認済み）には問い合わせない
  const railways = [
    ...new Set(
      station.platforms
        .filter((p) => p.trainLocationAvailable !== false)
        .map((p) => p.odptRailway),
    ),
  ]

  let raw: RawTrain[]
  let mocked = false

  if (usingMock()) {
    raw = mockTrains(station)
    mocked = true
  } else if (railways.length === 0) {
    // この駅の全路線が走行位置を出していない。推定できないことを正直に返す。
    // （モックにすり替えない——実運用で嘘の推定を出さないため）
    raw = []
  } else {
    try {
      raw = await fetchReal(railways)
    } catch (e) {
      // 実APIが落ちていてもアプリは止めない。モックに落ちて、UIに明示する。
      console.warn('[odpt] 実APIの取得に失敗したためモックに切り替えます', e)
      raw = mockTrains(station)
      mocked = true
    }
  }

  return { trains: toArrived(raw, station, withinSeconds), mocked }
}

async function fetchReal(railways: string[]): Promise<RawTrain[]> {
  // odpt:Train は路線ごとに問い合わせる
  const results = await Promise.all(
    railways.map(async (railway) => {
      const url = `${BASE}/odpt:Train?odpt:railway=${encodeURIComponent(railway)}&acl:consumerKey=${TOKEN}`
      const res = await fetch(url)
      if (!res.ok) {
        // 404 は「その事業者が走行位置を出していない」ことを意味する場合がある。
        // TODO: 池袋4事業者のうちどこが対応しているか実測して、ここに記録する
        if (res.status === 404) return [] as RawTrain[]
        throw new Error(`ODPT ${res.status} (${railway})`)
      }
      return (await res.json()) as RawTrain[]
    }),
  )
  return results.flat()
}

/**
 * 生の odpt:Train を「この駅に到着した列車」に絞り込む。
 *
 * 判定：
 *   - toStation がこの駅（＝この駅に向かっている／着いた）
 *   - fromStation がこの駅のものは除外（＝すでに発車している）
 *   - dc:date が withinSeconds 以内
 */
function toArrived(raw: RawTrain[], station: Station, withinSeconds: number): ArrivedTrain[] {
  const now = Date.now()
  const railwayToPlatform = new Map(station.platforms.map((p) => [p.odptRailway, p.id]))

  const suffix = `.${station.odptStationCode}`

  return raw
    .filter((t) => {
      const to = t['odpt:toStation'] ?? ''
      const from = t['odpt:fromStation'] ?? ''
      const arrivedHere = to.endsWith(suffix)
      const alreadyLeft = from.endsWith(suffix)
      if (!arrivedHere || alreadyLeft) return false

      const age = (now - new Date(t['dc:date']).getTime()) / 1000
      return age >= 0 && age <= withinSeconds
    })
    .map((t) => ({
      id: t['@id'],
      railway: t['odpt:railway'],
      destination: t['odpt:destinationStation']?.[0] ?? '',
      arrivedAt: t['dc:date'],
      platformId: railwayToPlatform.get(t['odpt:railway']),
    }))
    .sort((a, b) => new Date(b.arrivedAt).getTime() - new Date(a.arrivedAt).getTime())
}

/** 'odpt.Station:JR-East.SaikyoLine.Omiya' → '大宮' 相当の表示名にしたい */
export function shortStationName(odptId: string): string {
  const last = odptId.split('.').pop() ?? odptId
  // TODO: odpt:Station の dc:title を引いて日本語名にする（いまはローマ字のまま）
  return last
}
