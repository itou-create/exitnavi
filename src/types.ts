/**
 * 型定義
 *
 * GTFS / GTFS-Pathways の語彙にできるだけ寄せている。
 * 将来 pathways.txt を読み込むようになったとき、
 * ここの型がそのまま受け皿になるのが望ましい。
 */

/** 緯度経度 */
export interface LatLng {
  lat: number
  lng: number
}

/**
 * ホーム（GTFS でいう boarding area / platform）
 *
 * これが案内の「起点」になる。駅ではない。
 * 池袋は4事業者8路線あり、ホームは地上1Fから地下4Fまで散らばっている。
 */
export interface Platform {
  /** GTFS の stop_id 相当。将来 pathways.txt の from_stop_id として使う */
  id: string
  /** 所属する駅 */
  stationId: string
  /** 表示名（例: "JR埼京線 4番線"） */
  name: string
  /** 事業者名（例: "JR東日本"） */
  operator: string
  /** 路線名（例: "埼京線"） */
  line: string
  /** ODPT の odpt:Railway 値。走行位置APIとの突き合わせに使う */
  odptRailway: string
  /** 階層。GTFS levels.txt の level_index。0 = 地上階、-1 = 地下1階 */
  levelIndex: number
  /** 路線カラー（UI用） */
  color: string
}

/** 駅の出入口（GTFS stops.txt の location_type = 2） */
export interface Exit {
  id: string
  stationId: string
  /** 表示名（例: "東口"） */
  name: string
  /**
   * 現地の案内板に実際に書かれている表記。
   * GTFS-Pathways の signposted_as に相当する。
   * アプリの指示と目の前の案内板の言葉を揃えるための最重要フィールド。
   */
  signpostedAs: string
  /** 地上に出た地点の座標 */
  position: LatLng
  /** 階層 */
  levelIndex: number
}

/**
 * ホーム → 出口 の構内経路コスト
 *
 * 本来は GTFS-Pathways の pathways.txt から経路探索して求めるもの。
 * pathways.txt がまだ存在しないため、暫定的に直接コストを持たせている。
 *
 * pathways.txt が手に入ったら、このテーブルは経路探索の結果に置き換わる。
 */
export interface ConcourseLeg {
  platformId: string
  exitId: string
  /** 構内の所要秒数（GTFS-Pathways の traversal_time 相当） */
  traversalTime: number
  /** 階段の段数の合計（stair_count 相当）。0 ならエスカレーター/EVのみ */
  stairCount: number
  /** 経路上でくぐる改札の名前 */
  gateName: string
  /** 途中の案内板の表記 */
  signpostedAs: string
}

/** 駅 */
export interface Station {
  id: string
  name: string
  /** 駅の代表座標。最寄り駅判定に使う */
  position: LatLng
  platforms: Platform[]
  exits: Exit[]
  legs: ConcourseLeg[]
}

/** 目的地 */
export interface Destination {
  id: string
  name: string
  position: LatLng
  emoji: string
}

/**
 * 走行位置API から取り出した「この駅に到着した列車」
 * ODPT の odpt:Train を、起点推定に必要な分だけ削ったもの。
 */
export interface ArrivedTrain {
  /** odpt:Train の @id */
  id: string
  /** odpt:railway */
  railway: string
  /** 行先（odpt:destinationStation） */
  destination: string
  /** 到着時刻の推定（ISO文字列） */
  arrivedAt: string
  /** 到着したホームの platformId（解決できた場合） */
  platformId?: string
}

/** 起点推定の結果 */
export interface OriginGuess {
  platform: Platform
  /** 0〜1。高いほど確からしい */
  confidence: number
  /** 推定の根拠（UIにそのまま出す） */
  evidence: Evidence[]
  /** 元になった列車（あれば） */
  train?: ArrivedTrain
}

/** 推定の根拠1件 */
export interface Evidence {
  label: string
  value: string
}

/** 出口の算出結果 */
export interface ExitCandidate {
  exit: Exit
  /** 構内の所要秒数 */
  indoorSeconds: number
  /** 地上を歩く秒数 */
  outdoorSeconds: number
  /** 合計秒数 */
  totalSeconds: number
  /** 地上の距離（m） */
  outdoorMeters: number
  stairCount: number
  gateName: string
  signpostedAs: string
}

/**
 * 起点がどうやって決まったか。
 *
 * 事前起動は「必須」ではなく「上乗せ」。
 * ここで分岐して体験を強化するが、guessed / manual でも完全に成立させること。
 */
export type OriginSource =
  | 'guessed'   // 降車後に起動し、走行位置APIの推定をユーザーが承認した
  | 'manual'    // ユーザーが一覧から選んだ
  | 'onboard'   // 乗車中にアプリを開いていたので自動確定した

/** 画面 */
export type ScreenId =
  | 'locating'      // 駅を探している
  | 'guessOrigin'   // 「この電車で来ましたか？」
  | 'pickOrigin'    // 路線の選び直し
  | 'pickDest'      // 目的地の選択
  | 'result'        // 出口の算出結果
  | 'error'

/** アプリ全体の状態 */
export interface AppState {
  screen: ScreenId
  station: Station | null
  /** 位置情報の精度（m）。地上に出たかの判定にも使う */
  accuracy: number | null
  guesses: OriginGuess[]
  origin: Platform | null
  originSource: OriginSource | null
  destination: Destination | null
  candidates: ExitCandidate[]
  /** モックデータで動いているか。UIに明示する（嘘の精度を出さないため） */
  usingMock: boolean
  error: string | null
}
