const DEFAULT_PRODUCTION_FRONTEND =
  "https://paragon-system-gvlg.vercel.app";

function normalizeOrigin(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

export function getAllowedOrigins(): string[] {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.FRONTEND_URLS?.split(",") ?? []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeOrigin)
    .filter((value): value is string => Boolean(value));

  const defaults =
    process.env.NODE_ENV === "production"
      ? [DEFAULT_PRODUCTION_FRONTEND]
      : [
          "http://localhost:4200",
          "http://localhost:3000",
        ];

  return [...new Set([...defaults, ...configuredOrigins])];
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return false;
  }

  const normalized = normalizeOrigin(origin);
  return Boolean(normalized && getAllowedOrigins().includes(normalized));
}
