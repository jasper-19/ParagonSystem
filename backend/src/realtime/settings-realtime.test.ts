import assert from "node:assert/strict";
import test from "node:test";
import { emitGlobalSettingsUpdated } from "./socket.events";

test("a settings save can notify before the optional socket transport starts", () => {
  assert.doesNotThrow(() => emitGlobalSettingsUpdated({
    section: "general", version: 2, updatedAt: "2026-11-15T00:00:00Z",
  }));
});
