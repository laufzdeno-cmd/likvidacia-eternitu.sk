export class AnalyticsBodyTooLargeError extends Error {}

/** Bound received bytes, including chunked requests and dishonest Content-Length. */
export async function readAnalyticsRequestBody(request: Request, maximumBytes: number) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const bytes = new Uint8Array(maximumBytes);
  let size = 0;
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        return new TextDecoder().decode(bytes.subarray(0, size));
      }
      if (value.byteLength > maximumBytes - size) throw new AnalyticsBodyTooLargeError();
      bytes.set(value, size);
      size += value.byteLength;
    }
  } finally {
    // Do not wait on an untrusted sender's cancellation implementation.
    if (!complete) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
