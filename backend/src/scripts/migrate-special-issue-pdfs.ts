import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import db from "../config/db";
import { pdfConfig } from "../config/pdf";
import { replaceIssuePdf } from "../modules/special-issues/special-issue.service";
import type { UploadedPdfFile } from "../modules/special-issues/special-issue-upload.middleware";

type LegacyPdfSummary = {
  issue_count: string;
  encoded_bytes: string;
};

function optionalLimit(): number | undefined {
  const argument = process.argv.find(value => value.startsWith("--limit="));
  if (!argument) return undefined;
  const parsed = Number(argument.slice("--limit=".length));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("--limit must be a positive integer");
  }
  return parsed;
}

function decodeLegacyPdf(dataUrl: string): Buffer {
  const match = dataUrl.match(
    /^data:application\/pdf;base64,([a-z0-9+/=\r\n]+)$/i
  );
  if (!match?.[1]) {
    throw new Error("Legacy value is not a valid PDF data URL");
  }

  const base64 = match[1].replace(/\s/g, "");
  const estimatedBytes = Math.floor((base64.length * 3) / 4);
  if (estimatedBytes > pdfConfig.maxUploadBytes) {
    throw new Error(
      `Decoded PDF exceeds the ${pdfConfig.maxUploadMb} MB upload limit`
    );
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > pdfConfig.maxUploadBytes) {
    throw new Error(
      `Decoded PDF exceeds the ${pdfConfig.maxUploadMb} MB upload limit`
    );
  }
  if (
    buffer.length < 5 ||
    buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
  ) {
    throw new Error("Decoded legacy value does not contain a PDF");
  }
  return buffer;
}

async function dryRun(limit: number | undefined): Promise<void> {
  const result = await db.query<LegacyPdfSummary>(
    `SELECT
       COUNT(*)::text AS issue_count,
       COALESCE(SUM(OCTET_LENGTH(pdf_url)), 0)::text AS encoded_bytes
     FROM (
       SELECT pdf_url
       FROM special_issues
       WHERE pdf_url LIKE 'data:application/pdf;base64,%'
         AND pdf_storage_path IS NULL
       ORDER BY created_at, id
       ${limit ? "LIMIT $1" : ""}
     ) AS candidates`,
    limit ? [limit] : []
  );
  const summary = result.rows[0]!;
  console.info(
    JSON.stringify({
      event: "special_issue_pdf_migration_dry_run",
      candidates: Number(summary.issue_count),
      encodedBytes: Number(summary.encoded_bytes),
      apply: false,
      nextStep:
        "Run the same command with --apply after reviewing this report.",
    })
  );
}

async function applyMigration(limit: number | undefined): Promise<void> {
  const candidates = await db.query<{ id: string }>(
    `SELECT id
     FROM special_issues
     WHERE pdf_url LIKE 'data:application/pdf;base64,%'
       AND pdf_storage_path IS NULL
     ORDER BY created_at, id
     ${limit ? "LIMIT $1" : ""}`,
    limit ? [limit] : []
  );
  await mkdir(pdfConfig.tempRoot, { recursive: true });
  let migrated = 0;
  let failed = 0;

  for (const candidate of candidates.rows) {
    const result = await db.query<{ pdf_url: string }>(
      `SELECT pdf_url
       FROM special_issues
       WHERE id = $1
         AND pdf_url LIKE 'data:application/pdf;base64,%'
         AND pdf_storage_path IS NULL`,
      [candidate.id]
    );
    const dataUrl = result.rows[0]?.pdf_url;
    if (!dataUrl) continue;

    const filePath = path.join(
      pdfConfig.tempRoot,
      `legacy-${randomUUID()}.pdf`
    );
    try {
      await writeFile(filePath, decodeLegacyPdf(dataUrl), { flag: "wx" });
      const details = await stat(filePath);
      const upload: UploadedPdfFile = {
        fieldname: "pdf",
        originalname: `${candidate.id}.pdf`,
        encoding: "7bit",
        mimetype: "application/pdf",
        destination: pdfConfig.tempRoot,
        filename: path.basename(filePath),
        path: filePath,
        size: details.size,
      };
      await replaceIssuePdf(String(candidate.id), upload);
      migrated += 1;
    } catch (error) {
      failed += 1;
      console.error(
        JSON.stringify({
          event: "special_issue_pdf_migration_item_failed",
          issueId: String(candidate.id),
          message: error instanceof Error ? error.message : "Unknown error",
        })
      );
    } finally {
      await unlink(filePath).catch(() => undefined);
    }
  }

  console.info(
    JSON.stringify({
      event: "special_issue_pdf_migration_completed",
      candidates: candidates.rowCount ?? candidates.rows.length,
      migrated,
      failed,
      apply: true,
    })
  );
  if (failed > 0) process.exitCode = 1;
}

async function main(): Promise<void> {
  const limit = optionalLimit();
  if (process.argv.includes("--apply")) {
    await applyMigration(limit);
  } else {
    await dryRun(limit);
  }
}

main()
  .catch(error => {
    console.error(
      error instanceof Error ? error.message : "PDF migration failed"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
