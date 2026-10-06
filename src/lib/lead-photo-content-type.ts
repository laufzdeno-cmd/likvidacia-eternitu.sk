const mimeByExtension: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export function leadPhotoExtension(fileName: string) {
  return fileName.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] ?? '';
}

export function leadPhotoContentType(fileName: string, declaredType: string) {
  const extension = leadPhotoExtension(fileName);
  const extensionType = mimeByExtension[extension] ?? '';
  if (!extensionType) return '';

  const normalizedType = declaredType.trim().toLowerCase();
  if (!normalizedType || normalizedType === 'application/octet-stream') return extensionType;
  return normalizedType === extensionType ? normalizedType : '';
}
