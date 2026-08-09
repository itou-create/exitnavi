import type { LatLng, Station } from '../types'
import { STATIONS } from '../data/stations'

/**
 * 位置情報
 *
 * ⚠️ 設計原則（CLAUDE.md）：現在地を「測らない」。
 *
 * ここで測ってよいのは2つだけ。
 *   1. どの駅にいるか（数百m粒度）— 地下でもWi-Fi・基地局で取れることが多い
 *   2. 地上に出たかどうか（accuracy の急改善で判定）
 *
 * 「改札のどちら側か」のような数m粒度は取れない前提で設計すること。
 */

export interface Fix {
  position: LatLng
  /** 測位精度（m）。この値自体が重要な情報になる */
  accuracy: number
}

/** 地上に出たと判断する精度のしきい値（m） */
export const OUTDOOR_ACCURACY_THRESHOLD = 30

export function isOutdoor(accuracy: number): boolean {
  return accuracy <= OUTDOOR_ACCURACY_THRESHOLD
}

export function getCurrentFix(timeoutMs = 8000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('この端末では位置情報が使えません'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
        })
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? '位置情報の利用が許可されていません'
            : err.code === err.POSITION_UNAVAILABLE
              ? '現在地を取得できませんでした'
              : '位置情報の取得がタイムアウトしました'
        reject(new Error(msg))
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    )
  })
}

/** a から b への方位角（度、北=0・時計回り）。コンパス矢印に使う */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLng = toRad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat))
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** 2点間の距離（m）。Haversine */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * 最寄り駅を返す。
 *
 * GTFS の stops.txt だけでできる処理。外部APIは要らない。
 * accuracy が悪くても、駅の間隔より十分小さければ判定できる。
 */
export function nearestStations(from: LatLng, limit = 3): Array<{ station: Station; meters: number }> {
  return STATIONS.map((station) => ({ station, meters: distanceMeters(from, station.position) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit)
}
