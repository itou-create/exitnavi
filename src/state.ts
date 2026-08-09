import type { AppState } from './types'

/**
 * ステート
 *
 * 状態管理ライブラリは入れない。軽量であること自体が企画の主張の一部
 * （大手が Unity/3D/ビーコンで解こうとして「初回表示が遅い」という課題を
 *  残した領域を、逆に削って解く、という対比が資料の売りになっている）。
 */

const initial: AppState = {
  screen: 'locating',
  station: null,
  stationChoices: [],
  locateNote: null,
  accuracy: null,
  guesses: [],
  origin: null,
  originSource: null,
  originTrain: null,
  boardedPosition: null,
  destination: null,
  candidates: [],
  guideSteps: [],
  guideIndex: 0,
  guideArrivalNote: null,
  usingMock: false,
  error: null,
}

let state: AppState = { ...initial }
type Listener = (s: AppState) => void
const listeners = new Set<Listener>()

export function getState(): AppState {
  return state
}

export function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn(state))
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function resetState(): void {
  state = { ...initial }
  listeners.forEach((fn) => fn(state))
}
