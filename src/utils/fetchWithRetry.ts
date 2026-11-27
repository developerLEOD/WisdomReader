export interface FetchWithRetryOptions {
  retries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
}

const TRANSIENT_STATUSES = new Set([408, 429, 502, 503, 504]);

function isTransientNetworkError(err: unknown): boolean {
  if (!err) return false;
  const name = err instanceof Error ? err.name : '';
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    name === 'AbortError' ||
    name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed') ||
    msg.includes('fetch') ||
    msg.includes('timed out') ||
    msg.includes('timeout')
  );
}

/**
 * Resilient fetch wrapper with per-attempt timeout and automatic retries for
 * transient network drops ("Failed to fetch") or gateway timeouts (502/503/504).
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { retries = 2, timeoutMs = 50_000, retryDelayMs = 1_200 } = options;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (TRANSIENT_STATUSES.has(response.status) && attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      if (attempt < retries && isTransientNetworkError(err)) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        continue;
      }

      if (isTransientNetworkError(err)) {
        throw new Error(
          'Network connection was interrupted while waiting for the server. Please check your connection and try again.'
        );
      }

      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Network request failed after retries. Please try again.');
}

/**
 * Converts a data: URL directly into a Blob in memory without invoking fetch(),
 * avoiding CSP or browser data-URI fetch restrictions.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    throw new Error('Invalid image data URL.');
  }
  const header = parts[0];
  const base64Data = parts[1];
  const mimeMatch = header.match(/data:([^;]+);base64/i);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
