#!/usr/bin/env node
/**
 * One-time setup: create the admin user inside your Supabase Auth project.
 * Usage:
 *   node scripts/setup-supabase-admin.mjs email@example.com "Password!"
 * Re-running with the same email updates the password.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Usage: node scripts/setup-supabase-admin.mjs <email> <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

// Lightweight .env.local loader so we don't need dotenv.
const envPath = path.join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2];
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in .env.local"
  );
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function findUser(email) {
  // Page through up to 1000 users — fine for single-tenant setups.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  return data.users.find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase()
  );
}

(async () => {
  const existing = await findUser(email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    console.log(`✓ Updated password for existing user ${email}`);
  } else {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    console.log(`✓ Created admin user ${email}`);
  }
  console.log("\nNext steps:");
  console.log("  1. Make sure ADMIN_EMAIL in .env.local matches:", email);
  console.log("  2. Restart 'npm run dev' so server-side auth picks up the change");
  console.log("  3. Sign in at /admin/login");
})().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
