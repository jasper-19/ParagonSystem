export type ImageVariant = 'thumbnail' | 'medium' | 'large';

export function imageVariant(
  url: string | null | undefined,
  variant: ImageVariant
): string {
  if (!url) return '';

  if (url.includes('/large.webp')) {
    return url.replace('/large.webp', `/${variant}.webp`);
  }

  if (url.includes('/original.webp')) {
    return url.replace('/original.webp', `/${variant}.webp`);
  }

  return url;
}
