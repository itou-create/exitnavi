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
  /**
   * ODPT がこの路線の走行位置（odpt:Train）を提供しているか。
   *   true  = 提供を確認済み
   *   false = 非提供を確認済み（例: 仙台市地下鉄はバスのみ提供）
   *   undefined = 未確認（実測待ち。実APIでは問い合わせを試みる）
   * false の路線は実APIに問い合わせない。推定できないことを UI で正直に示す。
   */
  trainLocationAvailable?: boolean
  /** 階層。GTFS levels.txt の level_index。0 = 地上階、-1 = 地下1階 */
  levelIndex: number
  /** 路線カラー（UI用） */
  color: string
  /**
   * ホーム両端の方面表記（ホーム模式図用）。
   * a = 図面の左端、b = 右端。「◯◯寄り」の言い方に使う。
   * 現地の乗車位置案内と同じ言葉にすること。
   */
  platformEnds?: { a: string; b: string }
  /**
   * 行先 → 列車が走り去る側の端。
   * キーは odpt の行先駅IDの末尾（例: 'Omiya'）。
   * 「電車が走り去った方向へ／と逆へ」という、降りた人が実際に観察できる
   * 言葉で案内するために使う（利用者目線の降車直後案内の要）。
   */
  directionEnds?: Record<string, 'a' | 'b'>
  /**
   * ホームの形式。降車時にどちら側のドアが開くかが決まる事実データ。
   *   island（島式・線路に挟まれる）= 左側通行なので進行方向の右側ドアが開く
   *   side（相対式）= 進行方向の左側ドアが開く
   * これがあると「電車を背にして右／左へ」まで言い切れる。
   * 両側扉扱いなど例外のある駅では設定しない（TODO: 現地確認）。
   */
  platformType?: 'island' | 'side'
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
  /**
   * この経路で最初に使う階段/エスカレーターの、ホーム上の位置。
   * 0 = platformEnds.a の端、1 = b の端、0.5 = 中ほど。
   * 未設定 = 未実測（図面には「位置は未実測」と正直に描く）。
   */
  stairsPositionRatio?: number
  /**
   * ステップ案内（第2段階）。手書きの詳細ステップ。
   * 無ければ leg の情報から汎用ステップを自動生成する（services/guide.ts）。
   */
  steps?: GuidanceStep[]
}

/** ステップ案内の1歩の種類 */
export type GuidanceStepKind =
  | 'orient' // 降車直後。階段の位置と進む向きを確かめる
  | 'move'   // 階段・エスカレーターで階を移動
  | 'gate'   // 改札を通る
  | 'walk'   // 案内板に従ってコンコースを歩く
  | 'exit'   // 出口から地上へ

/**
 * 進む方向。「直前の動作を終えたときの向き」基準。
 * （階段を上がりきった向き・改札を抜けた向き。測位せずに方向を伝える唯一の方法）
 */
export type GuidanceDirection =
  | 'straight'     // 直進
  | 'left'         // 左へ
  | 'right'        // 右へ
  | 'slight-left'  // 左ななめ前
  | 'slight-right' // 右ななめ前
  | 'u-turn'       // 折り返す

/**
 * ステップ案内の1歩
 *
 * ★ このアプリの目標：案内表示を見なくても目的の出口にたどり着けること。
 *   だから direction / distanceMeters がこの型の主役。アプリが方向と距離を
 *   言い切り、signpostedAs（案内板の表記）は答え合わせ用に格下げ。
 *   方向データが無いステップでは、嘘を言わずに「案内板に頼る」へフォールバックする。
 *
 * 設計原則（CLAUDE.md 1）：現在地を測らない。
 * 「いまどこにいるか」を描く代わりに「次に何をするか」だけを出し、
 * ユーザーが「次へ」で進める。進行はユーザーの申告であって測位ではない。
 */
export interface GuidanceStep {
  kind: GuidanceStepKind
  /** 大きく出す指示（例: 「中央改札を出る」） */
  instruction: string
  /** 進む方向（direction の基準は directionBase、省略時は「直前の動作を終えた向き」） */
  direction?: GuidanceDirection
  /** direction の基準の説明を差し替える（例: 「電車が走り去った方向」が基準です） */
  directionBase?: string
  /** 歩く距離の目安（m）。無ければ未整備 */
  distanceMeters?: number
  /** 現地の案内板の表記（signposted_as）。答え合わせ（確認）用 */
  signpostedAs?: string
  /** 補足（例: 「約18段・エスカレーター併設」） */
  detail?: string
}

/** 駅 */
export interface Station {
  id: string
  name: string
  /**
   * ODPT の駅IDの末尾（例: 'Ikebukuro', 'Sendai'）。
   * odpt:Train の toStation / fromStation との突き合わせに使う。
   */
  odptStationCode: string
  /** 駅の代表座標。最寄り駅判定に使う */
  position: LatLng
  /**
   * 公式の構内図ページ。図面そのものは各事業者の著作物なので
   * アプリに埋め込まず、リンクで開く。
   */
  officialMaps?: Array<{ label: string; url: string }>
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
  /** 住所（検索結果のみ。プリセットには無い） */
  address?: string
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
  | 'pickStation'   // 駅の選択（圏外・測位失敗時。池袋と偽らない）
  | 'guessOrigin'   // 「この電車で来ましたか？」
  | 'pickOrigin'    // 路線の選び直し
  | 'pickDest'      // 目的地の選択
  | 'result'        // 出口の算出結果
  | 'askBoarded'    // 「どのあたりに乗っていましたか？」（降車直後案内の個別化）
  | 'guide'         // 改札から出口までのステップ案内（第2段階）
  | 'error'

/** 乗車位置（進行方向基準）。降りた本人が確実に知っている唯一の位置情報 */
export type BoardedPosition = 'front' | 'middle' | 'rear'

/** アプリ全体の状態 */
export interface AppState {
  screen: ScreenId
  station: Station | null
  /** pickStation 画面の選択肢。meters は現在地からの距離（測位失敗時は null） */
  stationChoices: Array<{ station: Station; meters: number | null }>
  /** pickStation 画面に出す理由（圏外・測位失敗）。嘘をつかないための説明 */
  locateNote: string | null
  /** 位置情報の精度（m）。地上に出たかの判定にも使う */
  accuracy: number | null
  guesses: OriginGuess[]
  origin: Platform | null
  originSource: OriginSource | null
  /** 起点が推定由来のとき、その列車。走り去った方向の計算に使う */
  originTrain: ArrivedTrain | null
  /** 乗車位置（進行方向基準）。ユーザーの1タップ申告 */
  boardedPosition: BoardedPosition | null
  destination: Destination | null
  candidates: ExitCandidate[]
  /** ステップ案内（第2段階）。案内中でなければ空配列 */
  guideSteps: GuidanceStep[]
  /** いま表示しているステップの添字 */
  guideIndex: number
  /** 最終ステップでの「地上に出たか」測位チェックの結果表示 */
  guideArrivalNote: string | null
  /** モックデータで動いているか。UIに明示する（嘘の精度を出さないため） */
  usingMock: boolean
  error: string | null
}
