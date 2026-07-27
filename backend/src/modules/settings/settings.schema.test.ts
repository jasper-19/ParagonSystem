import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_MAINTENANCE_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_PUBLISHING_MEDIA_SETTINGS,
} from "./settings.defaults";
import {
  generalSettingsSchema,
  maintenanceSettingsSchema,
  notificationSettingsSchema,
  publishingMediaSettingsSchema,
} from "./settings.schema";

test("global settings defaults satisfy every server schema", () => {
  assert.doesNotThrow(() => generalSettingsSchema.parse(DEFAULT_GENERAL_SETTINGS));
  assert.doesNotThrow(() =>
    publishingMediaSettingsSchema.parse(DEFAULT_PUBLISHING_MEDIA_SETTINGS)
  );
  assert.doesNotThrow(() =>
    notificationSettingsSchema.parse(DEFAULT_NOTIFICATION_SETTINGS)
  );
  assert.doesNotThrow(() =>
    maintenanceSettingsSchema.parse(DEFAULT_MAINTENANCE_SETTINGS)
  );
});

test("general settings reject non-HTTPS logo URLs", () => {
  const result = generalSettingsSchema.safeParse({
    ...DEFAULT_GENERAL_SETTINGS,
    logoUrl: "http://example.com/logo.png",
  });
  assert.equal(result.success, false);
});

test("media policy requires an accepted format and a bounded file limit", () => {
  assert.equal(
    publishingMediaSettingsSchema.safeParse({
      ...DEFAULT_PUBLISHING_MEDIA_SETTINGS,
      allowedMimeTypes: [],
    }).success,
    false
  );
  assert.equal(
    publishingMediaSettingsSchema.safeParse({
      ...DEFAULT_PUBLISHING_MEDIA_SETTINGS,
      maxUploadSizeMb: 101,
    }).success,
    false
  );
});

test("maintenance mode requires a useful public message", () => {
  assert.equal(
    maintenanceSettingsSchema.safeParse({
      ...DEFAULT_MAINTENANCE_SETTINGS,
      message: "Offline",
    }).success,
    false
  );
});

