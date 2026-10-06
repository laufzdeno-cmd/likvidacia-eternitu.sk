export function exceedsTextCaptureLimit(currentBytes, chunkBytes, maxBytes) {
  return !Number.isFinite(currentBytes)
    || !Number.isFinite(chunkBytes)
    || !Number.isFinite(maxBytes)
    || currentBytes < 0
    || chunkBytes < 0
    || maxBytes < 0
    || currentBytes + chunkBytes > maxBytes;
}
