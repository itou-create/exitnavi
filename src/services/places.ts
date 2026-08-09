import type { Destination, LatLng } from '../types'

/**
 * 目的地のフリーワード検索（Google Places API (New) / Text Search）
 *
 * - キー（VITE_GOOGLE_PLACES_KEY）が未設定なら機能ごと無効。
 *   検索が無くてもプリセットの目的地で全画面が動くことを崩さない（CLAUDE.md）。
 * - キーは公開バンドルに埋め込まれるため、Google Cloud 側で必ず
 *   「HTTPリファラ制限 + Places API (New) のみ」に制限すること。
 * - サーバは立てない。places.googleapis.com はブラウザからの CORS を許可している。
 * - コストを抑えるため、オートコンプリートではなく明示的な検索実行のみ。
 */

const KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string | undefined

/** 検索結果を駅からこの半径に寄せる（バイアスであって絞り込みではない） */
const BIAS_RADIUS_METERS = 3000

export function placesSearchEnabled(): boolean {
  return !!KEY
}

interface RawPlace {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
}

export async function searchPlaces(query: string, near: LatLng): Promise<Destination[]> {
  if (!KEY) return []

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'ja',
      regionCode: 'JP',
      pageSize: 8,
      locationBias: {
        circle: {
          center: { latitude: near.lat, longitude: near.lng },
          radius: BIAS_RADIUS_METERS,
        },
      },
    }),
  })

  if (!res.ok) {
    // 403 はキーの制限ミス（リファラ・API制限）の可能性が高い
    throw new Error(`検索に失敗しました（Google Places ${res.status}）`)
  }

  const data = (await res.json()) as { places?: RawPlace[] }

  return (data.places ?? [])
    .filter((p) => p.location)
    .map((p) => ({
      id: `google:${p.id}`,
      name: p.displayName?.text ?? '（名称不明）',
      address: p.formattedAddress,
      position: { lat: p.location!.latitude, lng: p.location!.longitude },
      emoji: '📍',
    }))
}
