import "dotenv/config";

function baseUrl(): string {
  const value = process.env.SMOKE_BASE_URL?.trim().replace(/\/+$/, "");
  if (!value) throw new Error("SMOKE_BASE_URL is required");
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
  ) {
    throw new Error("SMOKE_BASE_URL must use HTTPS except for localhost");
  }
  return url.toString().replace(/\/+$/, "");
}

async function expectJson(
  url: string,
  init?: RequestInit
): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(
      `Smoke request failed with HTTP ${response.status} at ${new URL(url).pathname}`
    );
  }
  return { response, body };
}

async function main(): Promise<void> {
  const api = baseUrl();
  const health = await expectJson(`${api}/health`);
  const ready = await expectJson(`${api}/ready`);
  const published = await expectJson(
    `${api}/api/special-issues?limit=1`
  );

  if (
    typeof health.body !== "object" ||
    health.body === null ||
    !("ok" in health.body)
  ) {
    throw new Error("Health response contract is invalid");
  }
  if (
    typeof ready.body !== "object" ||
    ready.body === null ||
    !("ready" in ready.body)
  ) {
    throw new Error("Readiness response contract is invalid");
  }
  if (!Array.isArray(published.body)) {
    throw new Error("Published Special Issue response must be an array");
  }
  if (
    published.response.headers.get("x-page-size") !== "1" ||
    !published.response.headers.has("x-has-more")
  ) {
    throw new Error("Published list pagination headers are missing");
  }

  const adminToken = process.env.SMOKE_ADMIN_BEARER_TOKEN?.trim();
  if (adminToken) {
    const admin = await expectJson(
      `${api}/api/special-issues/admin?limit=1`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    if (!Array.isArray(admin.body)) {
      throw new Error("Admin Special Issue response must be an array");
    }
  }

  console.info(
    JSON.stringify({
      event: "special_issue_smoke_passed",
      health: true,
      readiness: true,
      publicList: true,
      adminList: Boolean(adminToken),
    })
  );
}

main().catch(error => {
  console.error(
    error instanceof Error ? error.message : "Special Issue smoke test failed"
  );
  process.exitCode = 1;
});
