/* eslint-disable @typescript-eslint/no-explicit-any */
export interface VSCodeAPI {
  postMessage: (message: unknown) => void;
  setState: <T>(newState: T) => void;
  getState: <T>() => T | undefined;
}
function createGetter() {
  let cached: VSCodeAPI | null = null;
  return (): VSCodeAPI | null => {
    if (cached) return cached;
    const w = globalThis as any;
    if (w && typeof w.acquireVsCodeApi === "function") {
      cached = w.acquireVsCodeApi();
    }
    return cached;
  };
}
const getVSCodeAPI = createGetter();
export const vscode = {
  available(): boolean { return !!getVSCodeAPI(); },
  postMessage(message: unknown): void { getVSCodeAPI()?.postMessage(message); },
  setState<T>(state: T): void { getVSCodeAPI()?.setState(state); },
  getState<T>(): T | undefined { return getVSCodeAPI()?.getState<T>(); },
};
