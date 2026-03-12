/**
 * Usage: npx ts-node src/scripts/hashPassword.ts yourNewPassword
 * Paste the printed hash into ADMIN_PASSWORD_HASH in .env
 */
import bcrypt from "bcrypt";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npx ts-node src/scripts/hashPassword.ts <password>");
  process.exit(1);
}

bcrypt.hash(password, 12).then(hash => {
  console.log("\nBcrypt hash (paste into .env as ADMIN_PASSWORD_HASH):\n");
  console.log(hash);
  console.log();
});
