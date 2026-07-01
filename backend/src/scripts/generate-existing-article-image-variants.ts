import "dotenv/config";
import sharp from "sharp";
import db from "../config/db";
import { supabase, storageBucket } from "../config/storage";

type Variant = "thumbnail" | "medium" | "large";

const VARIANTS: Record<Variant, { width: number; quality: number }> = {
  thumbnail: { width: 400, quality: 78 },
  medium: { width: 900, quality: 80 },
  large: { width: 1600, quality: 82 },
};

function getStoragePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${storageBucket}/`;
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.slice(index + marker.length));
}

async function createVariant(buffer: Buffer, variant: Variant): Promise<Buffer> {
  const config = VARIANTS[variant];

  return sharp(buffer)
    .rotate()
    .resize({
      width: config.width,
      withoutEnlargement: true,
    })
    .webp({
      quality: config.quality,
      effort: 4,
    })
    .toBuffer();
}

async function main() {
  const result = await db.query(`
    SELECT id, title, image
    FROM articles
    WHERE image LIKE '%/storage/v1/object/public/%'
      AND image NOT LIKE '%/large.webp'
  `);

  console.log(`Found ${result.rows.length} existing article images to process.`);

  for (const article of result.rows) {
    const imageUrl = String(article.image || "");
    const originalPath = getStoragePathFromPublicUrl(imageUrl);

    if (!originalPath) {
      console.warn(`Skipped invalid storage URL: ${article.title}`);
      continue;
    }

    const folder = originalPath.split("/").slice(0, -1).join("/");

    if (!folder) {
      console.warn(`Skipped invalid path: ${originalPath}`);
      continue;
    }

    console.log(`Processing: ${article.title}`);

    const downloaded = await supabase.storage
      .from(storageBucket)
      .download(originalPath);

    if (downloaded.error || !downloaded.data) {
      console.error(`Download failed for ${article.title}:`, downloaded.error?.message);
      continue;
    }

    const arrayBuffer = await downloaded.data.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    const thumbnail = await createVariant(originalBuffer, "thumbnail");
    const medium = await createVariant(originalBuffer, "medium");
    const large = await createVariant(originalBuffer, "large");

    const paths = {
      thumbnail: `${folder}/thumbnail.webp`,
      medium: `${folder}/medium.webp`,
      large: `${folder}/large.webp`,
    };

    const uploads = await Promise.all([
      supabase.storage.from(storageBucket).upload(paths.thumbnail, thumbnail, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      }),
      supabase.storage.from(storageBucket).upload(paths.medium, medium, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      }),
      supabase.storage.from(storageBucket).upload(paths.large, large, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      }),
    ]);

    const failed = uploads.find((upload) => upload.error);

    if (failed?.error) {
      console.error(`Upload failed for ${article.title}:`, failed.error.message);
      continue;
    }

    const { data } = supabase.storage.from(storageBucket).getPublicUrl(paths.large);

    await db.query(
      `
      UPDATE articles
      SET image = $1
      WHERE id = $2
      `,
      [data.publicUrl, article.id]
    );

    console.log(`Done: ${article.title}`);
  }

  console.log("Existing article image variant generation complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => process.exit(0));