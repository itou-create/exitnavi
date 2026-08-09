import type { ArrivedTrain, Evidence, OriginGuess, Platform, Station } from '../types'
import { fetchArrivedTrains, shortStationName } from './odpt'

/**
 * ★★ 起点推定 — このプロジェクトの核心
 *
 * 問題：
 *   GTFS-Pathways で経路を引くには from_stop_id が要る。これは駅IDではなく
 *   ホームのID。池袋は4事業者8路線あり、どのホームから来たかで最適な出口が変わる。
 *   駅を特定しただけでは案内が始まらない。
 *
 * 解き方：
 *   走行位置APIと時刻表を、アプリ起動時刻で突き合わせて「たぶんこの列車で来た」を当てにいく。
 *   当たれば操作ゼロ、外れても一覧から選び直すだけ。だから推定を先に出せる。
 *
 * 設計原則（CLAUDE.md 2）：
 *   推定を先に出し、訂正は1タップ。ユーザーに最初から質問リストを見せない。
 */

/** 何秒前までの到着を候補に含めるか */
const WINDOW_SECONDS = 90

export interface GuessResult {
  guesses: OriginGuess[]
  /** モックデータで動いているか。UIに明示する（嘘の精度を出さないため） */
  mocked: boolean
  /** 候補が何本から何本に絞れたか。UIの「候補8路線 → 1本」表示に使う */
  narrowedFrom: number
}

export async function guessOrigin(
  station: Station,
  opts: { accuracy?: number | null; levelHint?: number | null } = {},
): Promise<GuessResult> {
  const { trains, mocked } = await fetchArrivedTrains(station, WINDOW_SECONDS)

  const guesses = trains
    .map((train) => buildGuess(train, station, opts))
    .filter((g): g is OriginGuess => g !== null)
    .sort((a, b) => b.confidence - a.confidence)

  return { guesses, mocked, narrowedFrom: station.platforms.length }
}

function buildGuess(
  train: ArrivedTrain,
  station: Station,
  opts: { accuracy?: number | null; levelHint?: number | null },
): OriginGuess | null {
  const platform = station.platforms.find((p) => p.id === train.platformId)
  if (!platform) return null

  const ageSeconds = Math.round((Date.now() - new Date(train.arrivedAt).getTime()) / 1000)

  const evidence: Evidence[] = [
    { label: '到着時刻', value: formatTime(train.arrivedAt) },
    { label: 'アプリ起動までの経過', value: `${ageSeconds}秒` },
    { label: '路線', value: `${platform.operator} ${platform.line}` },
    { label: '行先', value: shortStationName(train.destination) },
  ]

  let confidence = baseConfidence(ageSeconds)

  // 気圧センサーなどから階層の見当がついていれば、それを加点／減点に使う。
  // 副都心線（B4F）と埼京線（1F）を取り違えないための材料。
  if (opts.levelHint != null) {
    const diff = Math.abs(platform.levelIndex - opts.levelHint)
    if (diff === 0) {
      confidence += 0.15
      evidence.push({ label: '階層の推定', value: `${levelLabel(platform.levelIndex)}（一致）` })
    } else if (diff >= 2) {
      confidence -= 0.25
      evidence.push({ label: '階層の推定', value: `${levelLabel(opts.levelHint)}（不一致）` })
    }
  }

  if (opts.accuracy != null) {
    evidence.push({ label: '測位精度', value: `±${Math.round(opts.accuracy)}m` })
  }

  return {
    platform,
    confidence: clamp(confidence, 0, 1),
    evidence,
    train,
  }
}

/**
 * 到着からの経過時間で確からしさを決める。
 *
 * 降りてすぐ開いた人ほど、その列車で来た可能性が高い。
 * 時間が経つほど「改札を出てから開いた」可能性が混ざるので下げる。
 */
function baseConfidence(ageSeconds: number): number {
  if (ageSeconds <= 45) return 0.85
  if (ageSeconds <= 90) return 0.6
  if (ageSeconds <= 180) return 0.35
  return 0.15
}

function levelLabel(index: number): string {
  if (index === 0) return '地上1F'
  if (index > 0) return `${index + 1}F`
  return `地下${-index}F`
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * 推定が使えるかどうか。
 *
 * 確からしさが低いときは「当てにいく」画面を出さず、
 * いきなり一覧から選ばせたほうが速い。推定は主、入力は保険。
 * ただし「推定が外れて訂正させられた」体験を増やしすぎないための線引き。
 */
export function isGuessUsable(guess: OriginGuess | undefined): guess is OriginGuess {
  return !!guess && guess.confidence >= 0.5
}

/** 一覧表示用。走行位置APIで該当があった路線を上に出す */
export function rankPlatformsForManualPick(
  station: Station,
  guesses: OriginGuess[],
): Array<{ platform: Platform; hasArrival: boolean }> {
  const hit = new Set(guesses.map((g) => g.platform.id))
  return station.platforms
    .map((platform) => ({ platform, hasArrival: hit.has(platform.id) }))
    .sort((a, b) => Number(b.hasArrival) - Number(a.hasArrival))
}
