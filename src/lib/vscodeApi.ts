let cachedVsCodeApi: any | undefined = undefined;

export function getVsCodeApi(): any | null {
  if (cachedVsCodeApi !== undefined) return cachedVsCodeApi;

  try {
    if (typeof window !== 'undefined' && typeof (window as any).acquireVsCodeApi === 'function') {
      // acquire once and cache the result
      cachedVsCodeApi = (window as any).acquireVsCodeApi();
      return cachedVsCodeApi;
    }
  } catch (err) {
    // Log and swallow the error so the UI doesn't crash
    // eslint-disable-next-line no-console
    console.error('Failed to acquire VS Code API:', err);
  }

  cachedVsCodeApi = null;
  return null;
}
