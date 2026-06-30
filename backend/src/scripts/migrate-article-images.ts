import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import db from "../config/db";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const bucket = process.env.SUPABASE_STORAGE_BUCKET || "paragon-media";

function parseBase64Image(dataUrl: string): {
  buffer: Buffer;
  mimeType: string;
  extension: string;
} | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match || !match[1] || !match[2]) return null;

  const mimeType = match[1];
  const base64 = match[2];

  const extension =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
      ? "webp"
      : mimeType === "image/gif"
      ? "gif"
      : "jpg";

  return {
    buffer: Buffer.from(base64, "base64"),
    mimeType,
    extension,
  };
}

async function main() {
  const result = await db.query(`
    SELECT id, title, image
    FROM articles
    WHERE image LIKE 'data:image/%;base64,%'
  `);

  console.log(`Found ${result.rows.length} base64 images.`);

  for (const article of result.rows) {
    const parsed = parseBase64Image(article.image);

    if (!parsed) {
      console.warn(`Skipped invalid image: ${article.id}`);
      continue;
    }

    const path = `articles/${article.id}/original.${parsed.extension}`;

    const upload = await supabase.storage
      .from(bucket)
      .upload(path, parsed.buffer, {
        contentType: parsed.mimeType,
        upsert: true,
      });

    if (upload.error) {
      console.error(`Upload failed for ${article.id}:`, upload.error.message);
      continue;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = data.publicUrl;

    await db.query(
      `
      UPDATE articles
      SET image = $1
      WHERE id = $2
      `,
      [publicUrl, article.id]
    );

    console.log(`Migrated: ${article.title}`);
  }

  console.log("Base64 image migration complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));