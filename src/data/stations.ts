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
  position: { lat: 35.7295, lng: 139.7109 }, // TODO: 実測

  // ------------------------------------------------------------------
  // ホーム = 案内の起点。駅ではない。
  // 4事業者8路線、地上1Fから地下4Fまで散らばっている。
  // ------------------------------------------------------------------
  platforms: [
    {
      id: 'ikebukuro_jr_saikyo',
      stationId: 'ikebukuro',
      name: 'JR埼京線 ホーム',
      operator: 'JR東日本',
      line: '埼京線',
      odptRailway: 'odpt.Railway:JR-East.SaikyoLine',
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
      position: { lat: 35.7292, lng: 139.7124 },   // TODO: 実測
      levelIndex: 0,
    },
    {
      id: 'ikebukuro_west',
      stationId: 'ikebukuro',
      name: '西口',
      signpostedAs: '西口・東京芸術劇場方面',       // TODO: 実測
      position: { lat: 35.7301, lng: 139.7090 },   // TODO: 実測
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
      position: { lat: 35.7289, lng: 139.7156 },   // TODO: 実測
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
    { platformId: 'ikebukuro_jr_saikyo', exitId: 'ikebukuro_east', traversalTime: 210, stairCount: 18, gateName: '中央改札', signpostedAs: '中央改札・東口' },
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

export const STATIONS: Station[] = [IKEBUKURO]

/**
 * 目的地
 * TODO: OSM の POI から引くようにする（いまは決め打ち）
 */
export const DESTINATIONS: Destination[] = [
  { id: 'sunshine_aqua', name: 'サンシャイン水族館', position: { lat: 35.7289, lng: 139.7195 }, emoji: '🐧' },
  { id: 'geigeki', name: '東京芸術劇場', position: { lat: 35.7309, lng: 139.7037 }, emoji: '🎭' },
  { id: 'parco', name: '池袋パルコ', position: { lat: 35.7301, lng: 139.7128 }, emoji: '🏬' },
]
