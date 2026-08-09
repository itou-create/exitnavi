import type { Station } from '../../types'

/**
 * 走行位置APIのモックレスポンス
 *
 * ODPT の odpt:Train を模したもの。
 * APIキーが無いとき、および深夜・早朝で列車が走っていない時間帯に使う。
 *
 * ⚠️ 深夜に開発・デモできることは必須要件（CLAUDE.md）。
 *    実APIに繋いだあとも、このモックを消さないこと。
 *
 * ⚠️ 仙台圏の走行位置は ODPT に実在しない（仙台市交通局はバスのみ提供）。
 *    ここにある仙台のモックは「もし提供されたらこう動く」というデモ用。
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
 * 「いまこの駅に着いたばかりの列車」を模したデータを返す。
 *
 * 実APIでは dc:date が固定の時刻になっているが、
 * モックでは呼び出し時刻からの相対で作らないと
 * 起点推定（直近90秒の到着列車を拾う）が動かないため、
 * 呼び出しのたびに現在時刻から逆算して生成する。
 */
export function mockTrains(station: Station, now = new Date()): RawTrain[] {
  const at = (secondsAgo: number) => new Date(now.getTime() - secondsAgo * 1000).toISOString()

  switch (station.id) {
    case 'ikebukuro':
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

    case 'sendai':
      return [
        // 28秒前に仙台着（南北線 泉中央行き）。本命
        {
          '@id': 'urn:ucode:_mock_namboku_1021',
          'odpt:railway': 'odpt.Railway:SendaiCity.Namboku',
          'odpt:toStation': 'odpt.Station:SendaiCity.Namboku.Sendai',
          'odpt:fromStation': null,
          'odpt:destinationStation': ['odpt.Station:SendaiCity.Namboku.IzumiChuo'],
          'odpt:delay': 0,
          'dc:date': at(28),
        },
        // 71秒前に仙台着（東西線 荒井行き）。次点
        {
          '@id': 'urn:ucode:_mock_tozai_0834',
          'odpt:railway': 'odpt.Railway:SendaiCity.Tozai',
          'odpt:toStation': 'odpt.Station:SendaiCity.Tozai.Sendai',
          'odpt:fromStation': null,
          'odpt:destinationStation': ['odpt.Station:SendaiCity.Tozai.Arai'],
          'odpt:delay': 0,
          'dc:date': at(71),
        },
        // 5分前の到着（仙石線）。古すぎるので候補から外れるはず
        {
          '@id': 'urn:ucode:_mock_senseki_1521S',
          'odpt:railway': 'odpt.Railway:JR-East.Senseki',
          'odpt:toStation': 'odpt.Station:JR-East.Senseki.Sendai',
          'odpt:fromStation': null,
          'odpt:destinationStation': ['odpt.Station:JR-East.Senseki.Ishinomaki'],
          'odpt:delay': 0,
          'dc:date': at(300),
        },
      ]

    case 'rokuchonome':
      return [
        // 25秒前に六丁の目着（東西線 荒井行き）。本命
        {
          '@id': 'urn:ucode:_mock_tozai_arai_0911',
          'odpt:railway': 'odpt.Railway:SendaiCity.Tozai',
          'odpt:toStation': 'odpt.Station:SendaiCity.Tozai.Rokuchonome',
          'odpt:fromStation': null,
          'odpt:destinationStation': ['odpt.Station:SendaiCity.Tozai.Arai'],
          'odpt:delay': 0,
          'dc:date': at(25),
        },
        // 六丁の目を出て卸町へ向かっている列車。到着扱いにしてはいけない
        {
          '@id': 'urn:ucode:_mock_tozai_yagiyama_0910',
          'odpt:railway': 'odpt.Railway:SendaiCity.Tozai',
          'odpt:toStation': 'odpt.Station:SendaiCity.Tozai.Oroshimachi',
          'odpt:fromStation': 'odpt.Station:SendaiCity.Tozai.Rokuchonome',
          'odpt:destinationStation': ['odpt.Station:SendaiCity.Tozai.YagiyamaZoologicalPark'],
          'odpt:delay': 0,
          'dc:date': at(40),
        },
      ]

    default:
      return []
  }
}
