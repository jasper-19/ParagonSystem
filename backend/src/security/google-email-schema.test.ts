import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertGoogleEmailSchema } from './google-email-schema';

test('startup rejects a partially applied Google/email authentication schema', async () => {
  const ready = { tables_ready: true, factor_version_ready: true, email_trigger_ready: true };
  for (const field of Object.keys(ready)) {
    await assert.rejects(() => assertGoogleEmailSchema({ query: async () => ({ rows: [{ ...ready, [field]: false }] }) }));
  }
  await assertGoogleEmailSchema({ query: async () => ({ rows: [ready] }) });
});
