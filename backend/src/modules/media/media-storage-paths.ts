/** Only our generated variant layout has implicit sibling objects. */
export function mediaStoragePaths(storagePath: string): string[] {
  if (!/^media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/large\.webp$/i.test(storagePath)) {
    return [storagePath];
  }
  return [storagePath, storagePath.replace(/large\.webp$/, 'medium.webp'), storagePath.replace(/large\.webp$/, 'thumbnail.webp')];
}
