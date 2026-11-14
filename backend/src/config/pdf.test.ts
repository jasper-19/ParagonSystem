import assert from "node:assert/strict";
import test from "node:test";
import { resolveBoundedPdfNumber, resolveCompressionProfile } from "./pdf";

test("PDF profiles retain legacy presets and accept descriptive quality names", () => {
  for (const profile of ["screen", "ebook", "printer", "prepress", "default", "balanced", "maximum"] as const) {
    assert.equal(resolveCompressionProfile(profile), profile);
  }
  assert.equal(resolveCompressionProfile(" High Quality "), "high-quality");
  assert.equal(resolveCompressionProfile("HIGH_QUALITY"), "high-quality");
  assert.equal(resolveCompressionProfile(undefined), "ebook");
  assert.equal(resolveCompressionProfile("untrusted-option"), "ebook");
});

test("empty or invalid numeric PDF settings use defaults and bounds preserve zero", () => {
  for (const value of [undefined, "", "   ", "NaN", "Infinity", "one"]) {
    assert.equal(resolveBoundedPdfNumber(value, 256, 0, 1024), 256);
  }
  assert.equal(resolveBoundedPdfNumber("0", 256, 0, 1024), 0);
  assert.equal(resolveBoundedPdfNumber("-1", 256, 0, 1024), 0);
  assert.equal(resolveBoundedPdfNumber("2000", 256, 0, 1024), 1024);
});
