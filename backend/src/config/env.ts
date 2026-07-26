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

  const jwtSecret = requireEnvironmentVariable("JWT_SECRET");
  if (Buffer.byteLength(jwtSecret, "utf8") < 32) {
    throw new Error("JWT_SECRET must be at least 32 bytes in production");
  }

  requireEnvironmentVariable("DATABASE_URL");
  requireEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");
  requireHttpsUrl("SUPABASE_URL");

  if (process.env.API_BASE_URL) {
    requireHttpsUrl("API_BASE_URL");
  }

  if (
    process.env.ALLOW_ENV_ADMIN === "true" &&
    (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH)
  ) {
    throw new Error(
      "ADMIN_USERNAME and ADMIN_PASSWORD_HASH are required when ALLOW_ENV_ADMIN is enabled"
    );
  }
}
