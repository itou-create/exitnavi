/**
 * 曲がり検知（ジャイロ／方位の相対変化）
 *
 * 「左へ曲がる」という指示に対して、実際に曲がれたかを検知する。
 * 絶対方位（磁気コンパス）は駅構内で乱れるが、**相対的な回転量**は
 * ジャイロ由来なので構内でも信頼できる。開始時点からの累積回転角
 * （右回り正・度）を返す。
 *
 * iOS は DeviceOrientationEvent.requestPermission が必要（ボタンタップから呼ぶ）。
 */

type Cleanup = () => void
let cleanup: Cleanup | null = null

export type TurnResult = 'ok' | 'denied' | 'unsupported'

export async function startTurnDetector(onTurn: (cumulativeDeg: number) => void): Promise<TurnResult> {
  stopTurnDetector()

  if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported'

  const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
  if (typeof D.requestPermission === 'function') {
    try {
      if ((await D.requestPermission()) !== 'granted') return 'denied'
    } catch {
      return 'denied'
    }
  }

  let last: number | null = null
  let cumulative = 0

  const handler = (e: DeviceOrientationEvent) => {
    if (e.alpha == null) return
    const heading = (360 - e.alpha) % 360 // 右回り正に揃える
    if (last != null) {
      let d = heading - last
      if (d > 180) d -= 360
      if (d < -180) d += 360
      cumulative += d
      onTurn(cumulative)
    }
    last = heading
  }

  window.addEventListener('deviceorientation', handler, true)
  cleanup = () => window.removeEventListener('deviceorientation', handler, true)
  return 'ok'
}

export function stopTurnDetector(): void {
  cleanup?.()
  cleanup = null
}
