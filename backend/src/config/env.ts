import { productionDatabaseConfig } from './database-tls';

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function requireHttpsUrl(name: string): void {
  const value = requireEnvironmentVariable(name);
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production`);
  }
}

export function validateEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (process.env.ALLOW_ENV_ADMIN === "true") {
    throw new Error("ALLOW_ENV_ADMIN must be disabled in production");
  }

  const jwtSecret = requireEnvironmentVariable("JWT_SECRET");
  if (Buffer.byteLength(jwtSecret, "utf8") < 32) {
    throw new Error("JWT_SECRET must be at least 32 bytes in production");
  }

  productionDatabaseConfig(process.env);
  requireEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");
  requireHttpsUrl("SUPABASE_URL");

  requireHttpsUrl("API_BASE_URL");
  const pdfBucket = process.env.SUPABASE_PDF_STORAGE_BUCKET || 'paragon-pdfs';
  if (!/^[a-zA-Z0-9_-]+$/.test(pdfBucket) || pdfBucket === (process.env.SUPABASE_STORAGE_BUCKET || 'paragon-media')) {
    throw new Error('PDF storage must use a separate private bucket');
  }

}
