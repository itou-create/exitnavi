/**
 * 走行位置APIのモックレスポンス
 *
 * ODPT の odpt:Train を模したもの。
 * APIキーが無いとき、および深夜・早朝で列車が走っていない時間帯に使う。
 *
 * ⚠️ 深夜に開発・デモできることは必須要件（CLAUDE.md）。
 *    実APIに繋いだあとも、このモックを消さないこと。
 */

export interface RawTrain {
  '@id': string
  'odpt:railway': string
  'odpt:toStation': string | null
  'odpt:fromStation': string | null
  'odpt:destinationStation': string[]
  'odpt:delay': number
  'dc:date': string
}

/**
 * 「いま池袋に着いたばかりの列車」を模したデータを返す。
 *
 * 実APIでは dc:date が固定の時刻になっているが、
 * モックでは呼び出し時刻からの相対で作らないと
 * 起点推定（直近90秒の到着列車を拾う）が動かないため、
 * 呼び出しのたびに現在時刻から逆算して生成する。
 */
export function mockTrains(now = new Date()): RawTrain[] {
  const at = (secondsAgo: number) => new Date(now.getTime() - secondsAgo * 1000).toISOString()

  return [
    // 31秒前に池袋着（埼京線）。これが本命として推定されるはず
    {
      '@id': 'urn:ucode:_mock_saikyo_1234M',
      'odpt:railway': 'odpt.Railway:JR-East.SaikyoLine',
      'odpt:toStation': 'odpt.Station:JR-East.SaikyoLine.Ikebukuro',
      'odpt:fromStation': null,
      'odpt:destinationStation': ['odpt.Station:JR-East.SaikyoLine.Omiya'],
      'odpt:delay': 0,
      'dc:date': at(31),
    },
    // 68秒前に池袋着（山手線）。次点
    {
      '@id': 'urn:ucode:_mock_yamanote_0912G',
      'odpt:railway': 'odpt.Railway:JR-East.Yamanote',
      'odpt:toStation': 'odpt.Station:JR-East.Yamanote.Ikebukuro',
      'odpt:fromStation': null,
      'odpt:destinationStation': ['odpt.Station:JR-East.Yamanote.Osaki'],
      'odpt:delay': 60,
      'dc:date': at(68),
    },
    // 池袋を出て次の駅へ向かっている列車。到着扱いにしてはいけない
    {
      '@id': 'urn:ucode:_mock_fukutoshin_5501',
      'odpt:railway': 'odpt.Railway:TokyoMetro.Fukutoshin',
      'odpt:toStation': 'odpt.Station:TokyoMetro.Fukutoshin.ZoshigayaEki',
      'odpt:fromStation': 'odpt.Station:TokyoMetro.Fukutoshin.Ikebukuro',
      'odpt:destinationStation': ['odpt.Station:TokyoMetro.Fukutoshin.Shibuya'],
      'odpt:delay': 0,
      'dc:date': at(45),
    },
    // 6分前の到着。古すぎるので候補から外れるはず
    {
      '@id': 'urn:ucode:_mock_seibu_2101',
      'odpt:railway': 'odpt.Railway:Seibu.Ikebukuro',
      'odpt:toStation': 'odpt.Station:Seibu.Ikebukuro.Ikebukuro',
      'odpt:fromStation': null,
      'odpt:destinationStation': ['odpt.Station:Seibu.Ikebukuro.Ikebukuro'],
      'odpt:delay': 0,
      'dc:date': at(360),
    },
  ]
}
