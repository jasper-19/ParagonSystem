import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import sharp from "sharp";
import { GhostscriptPdfProcessor, type GhostscriptProcessorOptions } from "../modules/special-issues/pdf-processing/ghostscript-pdf.processor";
import { CommandExecutionError, SpawnCommandRunner } from "../modules/special-issues/pdf-processing/command-runner";

function argument(name: string, fallback: string): string {
  return process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
}

/** Deterministic fixtures: searchable text, vector paths and uncompressed RGB images. */
export function syntheticPublication(kind: "text-heavy" | "image-heavy" | "mixed-content"): Buffer {
  const objects: Buffer[] = [];
  const add = (body: string | Buffer): number => { objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body)); return objects.length; };
  const stream = (dictionary: string, data: Buffer): Buffer => Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`), data, Buffer.from("\nendstream"),
  ]);
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  const count = kind === "text-heavy" ? 8 : 4;
  for (let page = 0; page < count; page++) {
    let image: number | undefined;
    if (kind !== "text-heavy") {
      const width = 1200, height = 900;
      const pixels = Buffer.alloc(width * height * 3);
      let seed = 12345 + page;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = seed >>> 27;
        const offset = (y * width + x) * 3;
        pixels[offset] = (x * 200 / width + noise) & 255;
        pixels[offset + 1] = (y * 200 / height + noise) & 255;
        pixels[offset + 2] = ((x + y) * 100 / (width + height) + noise) & 255;
      }
      image = add(stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8`, pixels));
    }
    const operations: string[] = [];
    if (image) operations.push("q 540 0 0 405 36 330 cm /Photo Do Q");
    if (kind !== "image-heavy") {
      operations.push("BT /F1 12 Tf 36 760 Td");
      const rows = kind === "text-heavy" ? 44 : 12;
      for (let row = 0; row < rows; row++) operations.push(`(PARAGON ${kind} page ${page + 1} line ${row + 1}: campus journalism and typography.) Tj 0 -15 Td`);
      operations.push("ET", "0.1 0.2 0.6 RG 2 w 36 45 m 560 45 l 560 80 l S");
    }
    const content = add(stream("", Buffer.from(operations.join("\n"))));
    pageIds.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> ${image ? `/XObject << /Photo ${image} 0 R >>` : ""} >> /Contents ${content} 0 R >>`));
  }
  objects[1] = Buffer.from(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] >>`);
  const chunks = [Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets = [0];
  let size = chunks[0]!.length;
  for (let index = 0; index < objects.length; index++) {
    offsets.push(size);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), objects[index]!, Buffer.from("\nendobj\n")]);
    chunks.push(chunk); size += chunk.length;
  }
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

async function main(): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "paragon-pdf-benchmark-"));
  const output = path.resolve(argument("output", "node_modules/.cache/pdf-benchmark.json"));
  const executable = argument("ghostscript", process.env.PDF_GHOSTSCRIPT_PATH || (process.platform === "win32" ? "gswin64c" : "gs"));
  const qpdfExecutable = argument("qpdf", process.env.PDF_QPDF_PATH || "qpdf");
  const runner = new SpawnCommandRunner();
  const commandOptions = { timeoutMs: 120_000, maxOutputBytes: 64 * 1024 };
  const versions = {
    ghostscript: (await runner.run(executable, ["--version"], commandOptions)).stdout.trim(),
    qpdf: (await runner.run(qpdfExecutable, ["--version"], commandOptions)).stdout.trim(),
    node: process.version,
  };
  const rows: Record<string, unknown>[] = [];
  const kinds = ["text-heavy", "image-heavy", "mixed-content"] as const;
  const fixtures = kinds.map(kind => ({ kind, label: String(kind), bytes: syntheticPublication(kind) }));
  if (process.argv.includes("--publication-only")) fixtures.length = 0;
  if (process.argv.includes("--include-publication") || process.argv.includes("--publication-only")) {
    fixtures.push({ kind: "mixed-content", label: "repository-publication", bytes: await readFile(path.resolve("../frontend/ParagonWebApp/src/assets/pdfs/wanderlust.pdf")) });
  }
  const profiles = argument("profiles", "baseline,high-quality,balanced,maximum").split(",");
  const productionBudgets = process.argv.includes("--production-budgets");
  if (profiles.some(profile => !["baseline", "high-quality", "balanced", "maximum"].includes(profile))) throw new Error("Unsupported benchmark profile");
  for (let index = 0; index < fixtures.length; index++) {
    const fixture = fixtures[index]!;
    const inputPath = path.join(directory, `${index}-${fixture.kind}.pdf`);
    await writeFile(inputPath, fixture.bytes);
    const textPath = `${inputPath}.txt`;
    await runner.run(executable, ["-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-sDEVICE=txtwrite", `-sOutputFile=${textPath}`, inputPath], commandOptions);
    const normalizedText = (value: Buffer) => value.toString().replace(/\s+/g, " ").trim();
    const originalText = normalizedText(await readFile(textPath));
    for (const profile of profiles as Array<"baseline" | "high-quality" | "balanced" | "maximum">) {
      const options: Partial<GhostscriptProcessorOptions> = {
        executable, qpdfExecutable, allowedRoot: directory,
        profile: profile === "baseline" ? "ebook" : profile,
        qpdfEnabled: profile !== "baseline",
        minCompressionInputBytes: profile === "baseline" ? 0 : 256 * 1024,
        minCompressionBytesPerPage: profile === "baseline" ? 0 : 64 * 1024,
        timeoutMs: productionBudgets ? 45_000 : 120_000,
        totalTimeoutMs: productionBudgets ? 90_000 : 300_000,
      };
      const startedAt = performance.now();
      const result = await new GhostscriptPdfProcessor(options).process(inputPath, path.basename(inputPath));
      const elapsedMs = performance.now() - startedAt;
      let qpdfValidation = "passed";
      try { await runner.run(qpdfExecutable, ["--check", result.filePath], commandOptions); }
      catch (error) {
        // A legacy original may have pre-existing hint-table warnings. Record
        // them explicitly, without counting retention as successful optimization.
        if (result.filePath === inputPath && error instanceof CommandExecutionError && error.exitCode === 3) qpdfValidation = "original-has-warnings";
        else throw error;
      }
      const outputTextPath = `${inputPath}.${profile}.txt`;
      await runner.run(executable, ["-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-sDEVICE=txtwrite", `-sOutputFile=${outputTextPath}`, result.filePath], commandOptions);
      const textPreserved = originalText === normalizedText(await readFile(outputTextPath));
      const images: Buffer[] = [];
      for (const [label, pdfPath] of [["original", inputPath], [profile, result.filePath]] as const) {
        const rasterPath = `${inputPath}.${label}.png`;
        await runner.run(executable, ["-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-sDEVICE=png16m", "-r72", "-dFirstPage=1", "-dLastPage=1", `-sOutputFile=${rasterPath}`, pdfPath], commandOptions);
        images.push(await sharp(rasterPath).removeAlpha().raw().toBuffer());
      }
      let squaredError = 0;
      if (images[0]!.length !== images[1]!.length) throw new Error("Rendered page dimensions changed");
      for (let pixel = 0; pixel < images[0]!.length; pixel++) squaredError += (images[0]![pixel]! - images[1]![pixel]!) ** 2;
      rows.push({ fixture: fixture.label, profile, originalBytes: fixture.bytes.length,
        optimizedBytes: result.optimizedSizeBytes, reductionPercent: result.compressionPercent,
        processingMs: Number(elapsedMs.toFixed(2)), pageCount: result.pageCount,
        status: result.status, processor: result.processor, optimizationReason: result.optimizationReason,
        qpdfStatus: result.qpdfStatus, qpdfValidation, textPreserved, firstPageRgbRmse: Number(Math.sqrt(squaredError / images[0]!.length).toFixed(4)),
        outputPath: result.filePath,
      });
      if (!textPreserved) throw new Error(`Extracted text changed for ${fixture.kind}/${profile}`);
    }
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ measuredAt: new Date().toISOString(), versions, fixtureDirectory: directory,
    productionBudgets,
    methodology: "One sequential run per fixture/profile with a fresh processor; host/tool caches may be warm and host load varies. Synthetic RGB gradients/noise, Helvetica text and vector paths; no font-embedding claim. Baseline emulates prior ebook profile with current safety checks. Native qpdf validation, extracted-text comparison, first-page 72dpi RGB RMSE. Not browser/network/production measurements.", rows }, null, 2));
  console.table(rows.map(({ outputPath: _path, ...row }) => row));
  console.info(`Benchmark report: ${output}`);
  console.info(`Fixtures and verified outputs retained for inspection: ${directory}`);
}

if (require.main === module) void main().catch(error => { console.error(error instanceof Error ? error.message : "Benchmark failed"); process.exitCode = 1; });
