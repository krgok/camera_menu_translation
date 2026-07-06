export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 25000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`リクエストがタイムアウトしました (${timeoutMs / 1000}秒)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
