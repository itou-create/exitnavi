/**
 * 歩数カウント（加速度センサー）
 *
 * 「地上に出るまでの案内の精度を上げたい」への回答の第1弾。
 * 屋内で絶対位置は取れないが、「指示どおりに進めているか」は分かる：
 * 歩数 × 歩幅で歩いた距離を推定し、ステップの目安距離と比べて
 * 「そろそろ次の目印」と伝える。
 *
 * - 加速度の上下動のピークを数える簡易な歩数計。精度は目安（±2割程度）
 * - ジャイロと違い磁気の影響を受けないので、駅構内でも動く
 * - iOS は DeviceMotionEvent.requestPermission が必要（ボタンタップから呼ぶ）
 *
 * 将来（第2弾の候補）: ジャイロで「曲がったこと」の検知、
 * WebXR の相対トラッキング（Android限定・実験）。
 */

/** 歩幅の仮定値（m）。TODO: 設定で変えられるようにする */
export const STRIDE_METERS = 0.7

type Cleanup = () => void
let cleanup: Cleanup | null = null

export type StepCounterResult = 'ok' | 'denied' | 'unsupported'

export async function startStepCounter(onStep: (steps: number) => void): Promise<StepCounterResult> {
  stopStepCounter()

  if (typeof DeviceMotionEvent === 'undefined') return 'unsupported'

  const D = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
  if (typeof D.requestPermission === 'function') {
    try {
      if ((await D.requestPermission()) !== 'granted') return 'denied'
    } catch {
      return 'denied'
    }
  }

  let steps = 0
  let ema = 9.8 // 重力込み加速度の移動平均
  let aboveThreshold = false
  let lastStepAt = 0

  const handler = (e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity
    if (!acc || acc.x == null || acc.y == null || acc.z == null) return
    const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2)
    ema = ema * 0.9 + mag * 0.1

    const now = performance.now()
    const delta = mag - ema
    // 山（踏み込み）を1歩と数える。連続検出は300ms空ける
    if (!aboveThreshold && delta > 1.2 && now - lastStepAt > 300) {
      aboveThreshold = true
      lastStepAt = now
      steps += 1
      onStep(steps)
    } else if (aboveThreshold && delta < 0.4) {
      aboveThreshold = false
    }
  }

  window.addEventListener('devicemotion', handler, true)
  cleanup = () => window.removeEventListener('devicemotion', handler, true)
  return 'ok'
}

export function stopStepCounter(): void {
  cleanup?.()
  cleanup = null
}
