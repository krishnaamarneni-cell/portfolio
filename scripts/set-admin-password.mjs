#!/usr/bin/env node
/**
 * Resets the admin password in .env.local
 * Usage:  node scripts/set-admin-password.mjs "NewPassword!"
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/set-admin-password.mjs "<new password>"');
  process.exit(1);
}

const envPath = path.join(process.cwd(), ".env.local");
let content = "";
if (existsSync(envPath)) {
  content = readFileSync(envPath, "utf8");
} else {
  console.warn(".env.local not found — creating a new one.");
}

const hash = createHash("sha256").update(password).digest("hex");

function upsertLine(text, key, value) {
  const lines = text.split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(key + "=")) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  return next.join("\n");
}

content = upsertLine(content, "ADMIN_PASSWORD_HASH", hash);

// If there's no SESSION_SECRET yet, drop one in too.
if (!/^SESSION_SECRET=.+$/m.test(content)) {
  const secret = randomBytes(32).toString("hex");
  content = upsertLine(content, "SESSION_SECRET", secret);
  console.log("Added a fresh SESSION_SECRET (32 bytes).");
}

writeFileSync(envPath, content, "utf8");

console.log("✓ Admin password updated.");
console.log("  Hash:", hash.slice(0, 12) + "…" + hash.slice(-6));
console.log("\nRestart the dev server so Next.js picks up the new env:");
console.log("  npm run dev");
