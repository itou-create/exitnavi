/**
 * 方位センサー（コンパス）
 *
 * 「地上に出た後、目的地はどっちか」を端末の向きに追随する矢印で示すために使う。
 *
 * ⚠️ 使いどころの制約（設計原則との整合）:
 *   - 屋内・改札内では鉄骨・電気設備で磁気が乱れ不正確。地上に出る最終ステップ限定
 *   - 誤差があるセンサーなので、UIには必ず「目安」と明記する
 *   - iOS はユーザー操作起点の許可が必要（ボタンタップから呼ぶこと）
 */

type Cleanup = () => void

let cleanup: Cleanup | null = null

export type CompassResult = 'ok' | 'denied' | 'unsupported'

export async function startCompass(onHeading: (headingDeg: number) => void): Promise<CompassResult> {
  stopCompass()

  if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported'

  // iOS 13+ は明示的な許可が必要
  const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
  if (typeof D.requestPermission === 'function') {
    try {
      if ((await D.requestPermission()) !== 'granted') return 'denied'
    } catch {
      return 'denied'
    }
  }

  const handler = (e: DeviceOrientationEvent) => {
    // iOS: webkitCompassHeading（北=0・時計回り）
    // その他: absolute な alpha（反時計回り）から換算
    const webkit = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading
    let heading: number | null = null
    if (typeof webkit === 'number' && !Number.isNaN(webkit)) {
      heading = webkit
    } else if (e.absolute && e.alpha != null) {
      heading = (360 - e.alpha) % 360
    }
    if (heading != null) onHeading(heading)
  }

  const eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
  window.addEventListener(eventName, handler as EventListener, true)
  cleanup = () => window.removeEventListener(eventName, handler as EventListener, true)
  return 'ok'
}

export function stopCompass(): void {
  cleanup?.()
  cleanup = null
}
