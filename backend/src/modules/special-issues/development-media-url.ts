/** Match URLs emitted by the local media library, without allowing arbitrary HTTP. */
export function isDevelopmentMediaFileUrl(value: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(value);
    const base = new URL(process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`);
    const rawPath = value.match(/^http:\/\/[^/?#]+(\/[^?#]*)?$/i)?.[1] || "/";
    if (url.protocol !== "http:" || url.origin !== base.origin ||
        url.username || url.password || url.search || url.hash ||
        rawPath !== url.pathname || /%(?:2e|2f|5c)/i.test(value) || value.includes("\\")) return false;
    const prefix = `${base.pathname.replace(/\/$/, "")}/api/media/`;
    return url.pathname.startsWith(prefix) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/file$/i.test(url.pathname.slice(prefix.length));
  } catch {
    return false;
  }
}
