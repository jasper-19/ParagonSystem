function boundedInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name]?.trim();
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? Math.floor(Math.min(maximum, Math.max(minimum, value))) : fallback;
}

export const specialIssueUploadConfig = Object.freeze({
  concurrency: boundedInteger("SPECIAL_ISSUE_UPLOAD_CONCURRENCY", 4, 1, 16),
  receiveTimeoutMs: boundedInteger("SPECIAL_ISSUE_UPLOAD_TIMEOUT_MS", 300_000, 30_000, 600_000),
});
