import type { Station, Destination } from '../types'

/**
 * 駅データ
 *
 * ⚠️ ここの数値はすべて暫定値です。現地で確認していません。
 *    出口の座標、構内の所要時間、階段の段数——実測に置き換えるまで
 *    「実測済み」であるかのように扱わないこと（CLAUDE.md 参照）。
 *
 * 将来の姿：
 *   - platforms / exits → GTFS stops.txt（location_type = 2 が出入口）
 *   - legs             → pathways.txt を経路探索した結果に置き換わる
 *   - levelIndex       → levels.txt の level_index
 */

export const IKEBUKURO: Station = {
  id: 'ikebukuro',
  name: '池袋駅',
  odptStationCode: 'Ikebukuro',
  position: { lat: 35.7295, lng: 139.7109 }, // TODO: 実測
  officialMaps: [
    { label: 'JR東日本', url: 'https://www.jreast.co.jp/estation/station/info.aspx?StationCd=108' },
    { label: '東京メトロ', url: 'https://www.tokyometro.jp/station/ikebukuro/yardmap/index.html' },
  ],

  // ------------------------------------------------------------------
  // ホーム = 案内の起点。駅ではない。
  // 4事業者8路線、地上1Fから地下4Fまで散らばっている。
  // trainLocationAvailable は未確認（実測が最優先タスク）のため付けていない。
  // ------------------------------------------------------------------
  platforms: [
    {
      id: 'ikebukuro_jr_saikyo',
      stationId: 'ikebukuro',
      name: 'JR埼京線 ホーム',
      operator: 'JR東日本',
      line: '埼京線',
      odptRailway: 'odpt.Railway:JR-East.SaikyoLine',
      platformEnds: { a: '赤羽・大宮寄り', b: '新宿寄り' }, // TODO: 実測（現地の乗車位置案内の言葉に合わせる）
      // 行先 → 走り去る側の端。「電車が走り去った方向へ」案内の材料
      directionEnds: { Omiya: 'a', Kawagoe: 'a', Osaki: 'b', Shinjuku: 'b', Ebisu: 'b' },
      platformType: 'island', // 3・4番線の島式
      levelIndex: 0,
      color: '#00ac9a',
    },
    {
      id: 'ikebukuro_jr_yamanote',
      stationId: 'ikebukuro',
      name: 'JR山手線 ホーム',
      operator: 'JR東日本',
      line: '山手線',
      odptRailway: 'odpt.Railway:JR-East.Yamanote',
      platformEnds: { a: '大塚・田端寄り', b: '目白・新宿寄り' }, // TODO: 実測
      directionEnds: { Osaki: 'b', Shinjuku: 'b', Tabata: 'a', Ueno: 'a' },
      platformType: 'island',
      levelIndex: 0,
      color: '#9acd32',
    },
    {
      id: 'ikebukuro_jr_shonan',
      stationId: 'ikebukuro',
      name: 'JR湘南新宿ライン ホーム',
      operator: 'JR東日本',
      line: '湘南新宿ライン',
      odptRailway: 'odpt.Railway:JR-East.ShonanShinjuku',
      levelIndex: 0,
      color: '#e21f26',
    },
    {
      id: 'ikebukuro_seibu',
      stationId: 'ikebukuro',
      name: '西武池袋線 ホーム',
      operator: '西武鉄道',
      line: '池袋線',
      odptRailway: 'odpt.Railway:Seibu.Ikebukuro',
      levelIndex: 0,
      color: '#0072bc',
    },
    {
      id: 'ikebukuro_tobu',
      stationId: 'ikebukuro',
      name: '東武東上線 ホーム',
      operator: '東武鉄道',
      line: '東上線',
      odptRailway: 'odpt.Railway:Tobu.Tojo',
      levelIndex: 0,
      color: '#0067c0',
    },
    {
      id: 'ikebukuro_metro_marunouchi',
      stationId: 'ikebukuro',
      name: '東京メトロ丸ノ内線 ホーム',
      operator: '東京メトロ',
      line: '丸ノ内線',
      odptRailway: 'odpt.Railway:TokyoMetro.Marunouchi',
      levelIndex: -2,
      color: '#e60012',
    },
    {
      id: 'ikebukuro_metro_yurakucho',
      stationId: 'ikebukuro',
      name: '東京メトロ有楽町線 ホーム',
      operator: '東京メトロ',
      line: '有楽町線',
      odptRailway: 'odpt.Railway:TokyoMetro.Yurakucho',
      levelIndex: -3,
      color: '#c1a470',
    },
    {
      id: 'ikebukuro_metro_fukutoshin',
      stationId: 'ikebukuro',
      name: '東京メトロ副都心線 ホーム',
      operator: '東京メトロ',
      line: '副都心線',
      odptRailway: 'odpt.Railway:TokyoMetro.Fukutoshin',
      levelIndex: -4,
      color: '#9b7cb6',
    },
  ],

  // ------------------------------------------------------------------
  // 出入口（GTFS stops.txt の location_type = 2）
  // signpostedAs = 現地の案内板に実際に書かれている表記
  // ------------------------------------------------------------------
  exits: [
    {
      id: 'ikebukuro_east',
      stationId: 'ikebukuro',
      name: '東口',
      signpostedAs: '東口・サンシャインシティ方面', // TODO: 実測
      position: { lat: 35.73074, lng: 139.71244 }, // 出典: OSM「東口（北）」出入口ノード（ODbL, 2026-08取得）
      levelIndex: 0,
    },
    {
      id: 'ikebukuro_west',
      stationId: 'ikebukuro',
      name: '西口',
      signpostedAs: '西口・東京芸術劇場方面',       // TODO: 実測
      position: { lat: 35.73139, lng: 139.71108 }, // 出典: OSM「西口（北）」出入口ノード（ODbL, 2026-08取得）
      levelIndex: 0,
    },
    {
      id: 'ikebukuro_south',
      stationId: 'ikebukuro',
      name: '南口',
      signpostedAs: '南口',                         // TODO: 実測
      position: { lat: 35.7281, lng: 139.7108 },   // TODO: 実測
      levelIndex: 0,
    },
    {
      id: 'ikebukuro_seibu_south',
      stationId: 'ikebukuro',
      name: '西武南口',
      signpostedAs: '西武南口',                     // TODO: 実測
      position: { lat: 35.7283, lng: 139.7119 },   // TODO: 実測
      levelIndex: 0,
    },
    {
      id: 'ikebukuro_exit35',
      stationId: 'ikebukuro',
      name: '35番出口',
      signpostedAs: '35 サンシャインシティ方面',    // TODO: 実測
      position: { lat: 35.72984, lng: 139.71313 }, // 出典: OSM「池袋駅35」出入口ノード（ODbL, 2026-08取得）
      levelIndex: 0,
    },
  ],

  // ------------------------------------------------------------------
  // ホーム → 出口 の構内コスト
  //
  // ⚠️ 本来は pathways.txt を経路探索して求める値。
  //    pathways.txt がまだ無いので、暫定的に直接持たせている。
  //    ここが全部 TODO: 実測。
  //
  //    網羅していない組み合わせは exitPicker が「候補外」として扱う。
  // ------------------------------------------------------------------
  legs: [
    // --- JR埼京線 ---
    // steps は手書きステップ案内のサンプル。内容は未実測（TODO: 実測。
    // 階段の位置・左右などは現地確認するまで信用しないこと）
    {
      platformId: 'ikebukuro_jr_saikyo', exitId: 'ikebukuro_east', traversalTime: 210, stairCount: 18, gateName: '中央改札', signpostedAs: '中央改札・東口',
      stairsPositionRatio: 0.5, // TODO: 実測
      // direction / distanceMeters を含む手書きステップのサンプル。
      // ⚠️ 方向・距離はすべて未実測の仮値（TODO: 実測）。現地確認するまで
      //    「アプリだけでたどり着ける」品質を主張しないこと。
      steps: [
        { kind: 'orient', instruction: '電車を降りたら、ホーム中ほどの階段へ', signpostedAs: '中央改札', detail: '乗車位置によっては進行方向を戻る形になります（TODO: 実測）' },
        { kind: 'move', direction: 'straight', instruction: 'ホーム中ほどの階段を上がる', signpostedAs: '中央改札', detail: '約18段・エスカレーター併設（TODO: 実測）' },
        { kind: 'gate', direction: 'straight', distanceMeters: 40, instruction: '上がったら正面の中央改札を出る', signpostedAs: '中央改札', detail: '方向・距離は仮値（TODO: 実測）' },
        { kind: 'walk', direction: 'slight-right', distanceMeters: 60, instruction: '改札を出たら右ななめ前へ進む', signpostedAs: '東口・サンシャインシティ方面', detail: '方向・距離は仮値（TODO: 実測）' },
        { kind: 'exit', direction: 'straight', instruction: '正面の東口から地上に出る', signpostedAs: '東口' },
      ],
    },
    { platformId: 'ikebukuro_jr_saikyo', exitId: 'ikebukuro_west', traversalTime: 240, stairCount: 18, gateName: '中央改札', signpostedAs: '中央改札・西口' },
    { platformId: 'ikebukuro_jr_saikyo', exitId: 'ikebukuro_south', traversalTime: 270, stairCount: 22, gateName: '南改札', signpostedAs: '南改札' },
    // JRから35番出口は地下通路をかなり歩く。東口より遅くなる想定
    { platformId: 'ikebukuro_jr_saikyo', exitId: 'ikebukuro_exit35', traversalTime: 570, stairCount: 0, gateName: '中央改札', signpostedAs: '東口・地下通路' },

    // --- JR山手線 ---
    { platformId: 'ikebukuro_jr_yamanote', exitId: 'ikebukuro_east', traversalTime: 195, stairCount: 18, gateName: '中央改札', signpostedAs: '中央改札・東口' },
    { platformId: 'ikebukuro_jr_yamanote', exitId: 'ikebukuro_west', traversalTime: 225, stairCount: 18, gateName: '中央改札', signpostedAs: '中央改札・西口' },
    { platformId: 'ikebukuro_jr_yamanote', exitId: 'ikebukuro_south', traversalTime: 255, stairCount: 22, gateName: '南改札', signpostedAs: '南改札' },
    { platformId: 'ikebukuro_jr_yamanote', exitId: 'ikebukuro_exit35', traversalTime: 555, stairCount: 0, gateName: '中央改札', signpostedAs: '東口・地下通路' },

    // --- JR湘南新宿ライン ---
    { platformId: 'ikebukuro_jr_shonan', exitId: 'ikebukuro_east', traversalTime: 225, stairCount: 18, gateName: '中央改札', signpostedAs: '中央改札・東口' },
    { platformId: 'ikebukuro_jr_shonan', exitId: 'ikebukuro_west', traversalTime: 240, stairCount: 18, gateName: '中央改札', signpostedAs: '中央改札・西口' },
    { platformId: 'ikebukuro_jr_shonan', exitId: 'ikebukuro_south', traversalTime: 270, stairCount: 22, gateName: '南改札', signpostedAs: '南改札' },

    // --- 西武池袋線（東口まで構内を戻ることになる想定） ---
    { platformId: 'ikebukuro_seibu', exitId: 'ikebukuro_seibu_south', traversalTime: 150, stairCount: 12, gateName: '西武南口改札', signpostedAs: '西武南口' },
    { platformId: 'ikebukuro_seibu', exitId: 'ikebukuro_east', traversalTime: 330, stairCount: 24, gateName: '西武中央改札', signpostedAs: '東口・JR線方面' },
    { platformId: 'ikebukuro_seibu', exitId: 'ikebukuro_south', traversalTime: 240, stairCount: 16, gateName: '西武南口改札', signpostedAs: '南口' },

    // --- 東武東上線（西側） ---
    { platformId: 'ikebukuro_tobu', exitId: 'ikebukuro_west', traversalTime: 165, stairCount: 14, gateName: '東武中央改札', signpostedAs: '西口・東武百貨店' },
    { platformId: 'ikebukuro_tobu', exitId: 'ikebukuro_south', traversalTime: 285, stairCount: 20, gateName: '東武南改札', signpostedAs: '南口' },
    { platformId: 'ikebukuro_tobu', exitId: 'ikebukuro_east', traversalTime: 390, stairCount: 26, gateName: 'JR中央改札', signpostedAs: '東口' },

    // --- 丸ノ内線（B2F） ---
    { platformId: 'ikebukuro_metro_marunouchi', exitId: 'ikebukuro_east', traversalTime: 300, stairCount: 0, gateName: 'メトロ中央改札', signpostedAs: '東口・JR線方面' },
    { platformId: 'ikebukuro_metro_marunouchi', exitId: 'ikebukuro_west', traversalTime: 330, stairCount: 0, gateName: 'メトロ西改札', signpostedAs: '西口' },
    { platformId: 'ikebukuro_metro_marunouchi', exitId: 'ikebukuro_exit35', traversalTime: 390, stairCount: 0, gateName: 'メトロ東改札', signpostedAs: '35 サンシャインシティ方面' },

    // --- 有楽町線（B3F） ---
    { platformId: 'ikebukuro_metro_yurakucho', exitId: 'ikebukuro_exit35', traversalTime: 360, stairCount: 0, gateName: 'メトロ東改札', signpostedAs: '35 サンシャインシティ方面' },
    { platformId: 'ikebukuro_metro_yurakucho', exitId: 'ikebukuro_east', traversalTime: 345, stairCount: 0, gateName: 'メトロ中央改札', signpostedAs: '東口・JR線方面' },

    // --- 副都心線（B4F。地上に上がらず地下通路のほうが早いケース） ---
    { platformId: 'ikebukuro_metro_fukutoshin', exitId: 'ikebukuro_exit35', traversalTime: 420, stairCount: 0, gateName: 'メトロ東改札', signpostedAs: '35 サンシャインシティ方面' },
    { platformId: 'ikebukuro_metro_fukutoshin', exitId: 'ikebukuro_east', traversalTime: 450, stairCount: 0, gateName: 'メトロ中央改札', signpostedAs: '東口・JR線方面' },
    { platformId: 'ikebukuro_metro_fukutoshin', exitId: 'ikebukuro_west', traversalTime: 480, stairCount: 0, gateName: 'メトロ西改札', signpostedAs: '西口' },
  ],
}

/**
 * 仙台駅
 *
 * ⚠️ ODPT のデータ提供状況（2026-08 にカタログで確認）：
 *   - 仙台市交通局が ODPT に出しているのは「バス」の GTFS-JP / GTFS-RT のみ。
 *     地下鉄（南北線・東西線）の走行位置は提供されていない。
 *   - JR東日本の走行位置（odpt:Train）は首都圏在来線のみ。東北エリアは対象外。
 *   → 全路線 trainLocationAvailable: false。この駅では起点の自動推定はできず、
 *     手動選択が正規ルートになる（UIで正直に示す）。モック時のみ推定デモが動く。
 *
 * 地下鉄路線の odptRailway は ODPT 未登録のため仮のID。実在しない。
 */
export const SENDAI: Station = {
  id: 'sendai',
  name: '仙台駅',
  odptStationCode: 'Sendai',
  position: { lat: 38.2602, lng: 140.8822 }, // TODO: 実測
  officialMaps: [
    { label: 'JR東日本', url: 'https://www.jreast.co.jp/estation/station/info.aspx?StationCd=913' },
    { label: '仙台市地下鉄', url: 'https://www.kotsu.city.sendai.jp/subway/station/' },
  ],

  platforms: [
    {
      id: 'sendai_shinkansen',
      stationId: 'sendai',
      name: '東北新幹線 ホーム',
      operator: 'JR東日本',
      line: '東北新幹線',
      odptRailway: 'odpt.Railway:JR-East.TohokuShinkansen',
      trainLocationAvailable: false, // 新幹線の走行位置は ODPT 非提供
      levelIndex: 2, // 新幹線ホームは3F
      color: '#00a95f',
    },
    {
      id: 'sendai_jr_tohoku',
      stationId: 'sendai',
      name: 'JR東北本線 ホーム',
      operator: 'JR東日本',
      line: '東北本線（常磐線・空港アクセス線直通含む）',
      odptRailway: 'odpt.Railway:JR-East.Tohoku',
      trainLocationAvailable: false, // JR東の走行位置提供は首都圏のみ
      levelIndex: 0,
      color: '#3cb371',
    },
    {
      id: 'sendai_jr_senzan',
      stationId: 'sendai',
      name: 'JR仙山線 ホーム',
      operator: 'JR東日本',
      line: '仙山線',
      odptRailway: 'odpt.Railway:JR-East.Senzan',
      trainLocationAvailable: false,
      levelIndex: 0,
      color: '#d35d8e',
    },
    {
      id: 'sendai_jr_senseki',
      stationId: 'sendai',
      name: 'JR仙石線 ホーム（地下）',
      operator: 'JR東日本',
      line: '仙石線',
      odptRailway: 'odpt.Railway:JR-East.Senseki',
      trainLocationAvailable: false,
      platformEnds: { a: 'あおば通寄り', b: '榴ケ岡・石巻寄り' }, // TODO: 実測
      platformType: 'island', // 1面2線
      levelIndex: -2, // 地下2階 TODO: 実測
      color: '#00aeef',
    },
    {
      id: 'sendai_subway_namboku',
      stationId: 'sendai',
      name: '地下鉄南北線 ホーム',
      operator: '仙台市地下鉄',
      line: '南北線',
      odptRailway: 'odpt.Railway:SendaiCity.Namboku', // 仮ID（ODPT未登録）
      trainLocationAvailable: false, // 仙台市交通局の ODPT 提供はバスのみ
      platformEnds: { a: '泉中央寄り', b: '富沢寄り' }, // TODO: 実測
      directionEnds: { IzumiChuo: 'a', Tomizawa: 'b' },
      platformType: 'island', // 1面2線
      levelIndex: -3, // 地下3階
      color: '#109e49',
    },
    {
      id: 'sendai_subway_tozai',
      stationId: 'sendai',
      name: '地下鉄東西線 ホーム',
      operator: '仙台市地下鉄',
      line: '東西線',
      odptRailway: 'odpt.Railway:SendaiCity.Tozai', // 仮ID（ODPT未登録）
      trainLocationAvailable: false,
      platformEnds: { a: '八木山動物公園寄り', b: '荒井寄り' }, // TODO: 実測
      directionEnds: { Arai: 'b', YagiyamaZoologicalPark: 'a' },
      platformType: 'island', // 1面2線
      levelIndex: -4, // 地下4階
      color: '#0072bc',
    },
  ],

  exits: [
    {
      id: 'sendai_west',
      stationId: 'sendai',
      name: '西口',
      signpostedAs: '西口・ペデストリアンデッキ',   // TODO: 実測
      position: { lat: 38.2604, lng: 140.8807 },   // TODO: 実測
      levelIndex: 0,
    },
    {
      id: 'sendai_east',
      stationId: 'sendai',
      name: '東口',
      signpostedAs: '東口・ヨドバシカメラ方面',     // TODO: 実測
      position: { lat: 38.2599, lng: 140.8840 },   // TODO: 実測
      levelIndex: 0,
    },
    {
      id: 'sendai_south_underground',
      stationId: 'sendai',
      name: '地下南出口（青葉通方面）',
      signpostedAs: '南1出口',                      // TODO: 実測（地下鉄出口番号を現地確認）
      position: { lat: 38.25955, lng: 140.87996 }, // 出典: OSM「地下鉄仙台駅南1出入口」（ODbL, 2026-08取得）
      levelIndex: 0,
    },
  ],

  legs: [
    // --- 東北新幹線（3F。中央改札から西口/東口へ） TODO: 実測 ---
    { platformId: 'sendai_shinkansen', exitId: 'sendai_west', traversalTime: 330, stairCount: 0, gateName: '新幹線中央改札', signpostedAs: '西口' },
    { platformId: 'sendai_shinkansen', exitId: 'sendai_east', traversalTime: 300, stairCount: 0, gateName: '新幹線東改札', signpostedAs: '東口' },

    // --- 東北本線（地上2Fコンコース経由） TODO: 実測 ---
    { platformId: 'sendai_jr_tohoku', exitId: 'sendai_west', traversalTime: 240, stairCount: 20, gateName: '中央改札', signpostedAs: '西口' },
    { platformId: 'sendai_jr_tohoku', exitId: 'sendai_east', traversalTime: 300, stairCount: 20, gateName: '中央改札', signpostedAs: '東西自由通路・東口' },

    // --- 仙山線 TODO: 実測 ---
    { platformId: 'sendai_jr_senzan', exitId: 'sendai_west', traversalTime: 270, stairCount: 20, gateName: '中央改札', signpostedAs: '西口' },
    { platformId: 'sendai_jr_senzan', exitId: 'sendai_east', traversalTime: 330, stairCount: 20, gateName: '中央改札', signpostedAs: '東西自由通路・東口' },

    // --- 仙石線（地下ホーム。西側の地下コンコースに近い） TODO: 実測 ---
    { platformId: 'sendai_jr_senseki', exitId: 'sendai_west', traversalTime: 300, stairCount: 0, gateName: '仙石線北改札', signpostedAs: '西口方面' },
    { platformId: 'sendai_jr_senseki', exitId: 'sendai_east', traversalTime: 420, stairCount: 12, gateName: '仙石線南改札', signpostedAs: '東口方面' },
    { platformId: 'sendai_jr_senseki', exitId: 'sendai_south_underground', traversalTime: 360, stairCount: 0, gateName: '仙石線南改札', signpostedAs: '地下鉄連絡通路' },

    // --- 地下鉄南北線（B3F。地下自由通路で西口側に直結） TODO: 実測 ---
    { platformId: 'sendai_subway_namboku', exitId: 'sendai_west', traversalTime: 300, stairCount: 0, gateName: '南北線北改札', signpostedAs: 'JR仙台駅・西口方面' },
    { platformId: 'sendai_subway_namboku', exitId: 'sendai_south_underground', traversalTime: 240, stairCount: 0, gateName: '南北線南改札', signpostedAs: '青葉通・南出口' },
    { platformId: 'sendai_subway_namboku', exitId: 'sendai_east', traversalTime: 480, stairCount: 10, gateName: '南北線北改札', signpostedAs: '東西自由通路・東口' },

    // --- 地下鉄東西線（B4F。最深部） TODO: 実測 ---
    { platformId: 'sendai_subway_tozai', exitId: 'sendai_west', traversalTime: 360, stairCount: 0, gateName: '東西線改札', signpostedAs: 'JR仙台駅・西口方面' },
    { platformId: 'sendai_subway_tozai', exitId: 'sendai_south_underground', traversalTime: 300, stairCount: 0, gateName: '東西線改札', signpostedAs: '青葉通・南出口' },
    { platformId: 'sendai_subway_tozai', exitId: 'sendai_east', traversalTime: 480, stairCount: 10, gateName: '東西線改札', signpostedAs: '東西自由通路・東口' },
  ],
}

/**
 * 六丁の目駅（仙台市地下鉄東西線 T12）
 *
 * 島式1面2線・地下駅。出入口は北1・南1の2つ（Wikipedia 調べ。TODO: 現地確認）。
 * 走行位置データは仙台駅と同じく非提供（仙台市交通局はバスのみ）。
 */
export const ROKUCHONOME: Station = {
  id: 'rokuchonome',
  name: '六丁の目駅',
  odptStationCode: 'Rokuchonome',
  position: { lat: 38.2510, lng: 140.9356 }, // Wikipedia の座標。TODO: 実測
  officialMaps: [
    { label: '仙台市地下鉄', url: 'https://www.kotsu.city.sendai.jp/subway/station/list/rokuchonome/' },
  ],

  platforms: [
    {
      id: 'rokuchonome_subway_tozai',
      stationId: 'rokuchonome',
      name: '地下鉄東西線 ホーム',
      operator: '仙台市地下鉄',
      line: '東西線',
      odptRailway: 'odpt.Railway:SendaiCity.Tozai', // 仮ID（ODPT未登録）
      trainLocationAvailable: false,
      platformEnds: { a: '八木山動物公園寄り', b: '荒井寄り' }, // TODO: 実測
      directionEnds: { Arai: 'b', YagiyamaZoologicalPark: 'a' },
      platformType: 'island', // 1面2線
      levelIndex: -3, // 地下3階 TODO: 実測
      color: '#0072bc',
    },
  ],

  exits: [
    {
      id: 'rokuchonome_north1',
      stationId: 'rokuchonome',
      name: '北1出口',
      signpostedAs: '北1',                          // TODO: 実測
      position: { lat: 38.25114, lng: 140.93582 }, // 出典: OSM 六丁の目駅出入口ノード・北東側（ODbL, 2026-08取得）
      levelIndex: 0,
    },
    {
      id: 'rokuchonome_south1',
      stationId: 'rokuchonome',
      name: '南1出口',
      signpostedAs: '南1',                          // TODO: 実測
      position: { lat: 38.25074, lng: 140.93533 }, // 出典: OSM 六丁の目駅出入口ノード・南西側（ODbL, 2026-08取得）
      levelIndex: 0,
    },
  ],

  legs: [
    // 改札は1つ。B3ホーム → B1改札 → 地上。 TODO: 実測（所要時間）
    // gateToExitDirection: 2026-08-09 利用者の現地指摘により修正（北1=左・南1=右）
    { platformId: 'rokuchonome_subway_tozai', exitId: 'rokuchonome_north1', traversalTime: 150, stairCount: 0, gateName: '改札', signpostedAs: '北1出口', gateToExitDirection: 'left' },
    { platformId: 'rokuchonome_subway_tozai', exitId: 'rokuchonome_south1', traversalTime: 160, stairCount: 0, gateName: '改札', signpostedAs: '南1出口', gateToExitDirection: 'right' },
  ],
}

/**
 * 船橋駅
 *
 * JR（総武線快速・中央総武線各駅停車）と東武アーバンパークライン。いずれも高架。
 * 京成船橋駅は約150m南の別駅舎（ペデストリアンデッキ接続）。第1段階では未収録。
 *
 * JR総武線系統は首都圏なので走行位置APIの対象になっている可能性が高いが、
 * 未実測のため trainLocationAvailable は付けていない（池袋と同じ扱い）。
 */
export const FUNABASHI: Station = {
  id: 'funabashi',
  name: '船橋駅',
  odptStationCode: 'Funabashi',
  position: { lat: 35.7017, lng: 139.9853 }, // TODO: 実測
  officialMaps: [
    { label: 'JR東日本', url: 'https://www.jreast.co.jp/estation/station/info.aspx?StationCD=1382' },
  ],

  platforms: [
    {
      id: 'funabashi_jr_sobu_rapid',
      stationId: 'funabashi',
      name: 'JR総武線快速 ホーム',
      operator: 'JR東日本',
      line: '総武線快速',
      odptRailway: 'odpt.Railway:JR-East.SobuRapid',
      platformEnds: { a: '東京・横浜寄り', b: '千葉寄り' }, // TODO: 実測
      directionEnds: { Kurihama: 'a', Zushi: 'a', Tokyo: 'a', Chiba: 'b' },
      platformType: 'island',
      levelIndex: 1, // 高架
      color: '#0074be',
    },
    {
      id: 'funabashi_jr_sobu_local',
      stationId: 'funabashi',
      name: 'JR中央・総武線各駅停車 ホーム',
      operator: 'JR東日本',
      line: '中央・総武線各駅停車',
      odptRailway: 'odpt.Railway:JR-East.ChuoSobuLocal',
      platformEnds: { a: '中野・新宿寄り', b: '千葉寄り' }, // TODO: 実測
      directionEnds: { Nakano: 'a', Mitaka: 'a', Chiba: 'b', Tsudanuma: 'b' },
      platformType: 'island',
      levelIndex: 1,
      color: '#ffd400',
    },
    {
      id: 'funabashi_tobu_urbanpark',
      stationId: 'funabashi',
      name: '東武アーバンパークライン ホーム',
      operator: '東武鉄道',
      line: 'アーバンパークライン（野田線）',
      odptRailway: 'odpt.Railway:Tobu.Noda', // TODO: ODPT上の正式な路線IDを確認
      levelIndex: 1,
      color: '#00a7db',
    },
  ],

  exits: [
    {
      id: 'funabashi_north',
      stationId: 'funabashi',
      name: '北口',
      signpostedAs: '北口・東武百貨店',            // TODO: 実測
      position: { lat: 35.70298, lng: 139.98546 }, // 出典: OSM「船橋駅北口」出入口ノード（ODbL, 2026-08取得）
      levelIndex: 0,
    },
    {
      id: 'funabashi_south',
      stationId: 'funabashi',
      name: '南口',
      signpostedAs: '南口・京成船橋駅方面',        // TODO: 実測
      position: { lat: 35.70143, lng: 139.98578 }, // 出典: OSM 出入口ノード・南側/名称なし（ODbL, 2026-08取得。南口かどうか要現地確認）
      levelIndex: 0,
    },
  ],

  legs: [
    // --- JR総武線快速 TODO: 実測 ---
    { platformId: 'funabashi_jr_sobu_rapid', exitId: 'funabashi_north', traversalTime: 240, stairCount: 18, gateName: '中央改札', signpostedAs: '北口' },
    { platformId: 'funabashi_jr_sobu_rapid', exitId: 'funabashi_south', traversalTime: 220, stairCount: 18, gateName: '中央改札', signpostedAs: '南口' },

    // --- JR中央・総武線各駅停車 TODO: 実測 ---
    { platformId: 'funabashi_jr_sobu_local', exitId: 'funabashi_north', traversalTime: 210, stairCount: 18, gateName: '中央改札', signpostedAs: '北口' },
    { platformId: 'funabashi_jr_sobu_local', exitId: 'funabashi_south', traversalTime: 200, stairCount: 18, gateName: '中央改札', signpostedAs: '南口' },

    // --- 東武アーバンパークライン（改札は北口側。百貨店に直結） TODO: 実測 ---
    { platformId: 'funabashi_tobu_urbanpark', exitId: 'funabashi_north', traversalTime: 150, stairCount: 12, gateName: '東武改札', signpostedAs: '北口・東武百貨店' },
    { platformId: 'funabashi_tobu_urbanpark', exitId: 'funabashi_south', traversalTime: 300, stairCount: 16, gateName: '東武改札', signpostedAs: '自由通路・南口' },
  ],
}

export const STATIONS: Station[] = [IKEBUKURO, SENDAI, ROKUCHONOME, FUNABASHI]

/**
 * 目的地
 * TODO: OSM の POI から引くようにする（いまは決め打ち）
 * 座標はすべて暫定。TODO: 実測
 */
export const DESTINATIONS: Destination[] = [
  // --- 池袋 ---
  { id: 'sunshine_aqua', name: 'サンシャイン水族館', position: { lat: 35.7289, lng: 139.7195 }, emoji: '🐧' },
  { id: 'geigeki', name: '東京芸術劇場', position: { lat: 35.7309, lng: 139.7037 }, emoji: '🎭' },
  { id: 'parco', name: '池袋パルコ', position: { lat: 35.7301, lng: 139.7128 }, emoji: '🏬' },

  // --- 仙台 ---
  { id: 'hapina', name: 'ハピナ名掛丁アーケード', position: { lat: 38.2617, lng: 140.8797 }, emoji: '🏮' },
  { id: 'yodobashi_sendai', name: 'ヨドバシカメラ仙台', position: { lat: 38.2598, lng: 140.8846 }, emoji: '📷' },
  { id: 'sendai_asaichi', name: '仙台朝市', position: { lat: 38.2578, lng: 140.8797 }, emoji: '🐟' },
  { id: 'anpanman_sendai', name: '仙台アンパンマンこどもミュージアム', position: { lat: 38.2622, lng: 140.8927 }, emoji: '🍞' },

  // --- 六丁の目 ---
  { id: 'frespo_rokuchonome', name: 'フレスポ六丁の目', position: { lat: 38.2527, lng: 140.9367 }, emoji: '🛍️' },
  { id: 'sendai_seikei', name: '仙台整形外科病院', position: { lat: 38.2497, lng: 140.9343 }, emoji: '🏥' },

  // --- 船橋 ---
  { id: 'tobu_dept_funabashi', name: '東武百貨店 船橋店', position: { lat: 35.7024, lng: 139.9843 }, emoji: '🏬' },
  { id: 'funabashi_face', name: '船橋フェイス', position: { lat: 35.7008, lng: 139.9857 }, emoji: '🏢' },
  { id: 'funabashi_cityhall', name: '船橋市役所', position: { lat: 35.6947, lng: 139.9826 }, emoji: '🏛️' },
]

/** その駅から現実的に歩ける目的地だけを出す（暫定: 直線3km以内） */
export const DESTINATION_RADIUS_METERS = 3000
