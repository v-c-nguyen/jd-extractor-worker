/**
 * Create an app user (no public signup). Run after db/migrations/006_app_users_and_daily_reports.sql.
 *
 * Usage (PowerShell):
 *   $env:APP_USER_EMAIL="you@example.com"; $env:APP_USER_PASSWORD="your-secure-password"; npm run create-user
 *
 * Optional: APP_USER_NAME="Your Name"
 */
import "dotenv/config";
import { hashPassword } from "../lib/auth/password";
import { getSql } from "../lib/db/neon-sql";

const email = process.env.APP_USER_EMAIL?.trim().toLowerCase();
const password = process.env.APP_USER_PASSWORD;
const name = process.env.APP_USER_NAME?.trim() || null;

if (!email || !password) {
  console.error("Set APP_USER_EMAIL and APP_USER_PASSWORD (and DATABASE_URL).");
  process.exit(1);
}

const hash = await hashPassword(password);
const sql = getSql();

try {
  await sql`
    INSERT INTO app_users (email, password_hash, name)
    VALUES (${email}, ${hash}, ${name})
  `;
  console.log("Created user:", email);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("unique") || msg.includes("duplicate")) {
    console.error("A user with this email already exists.");
    process.exit(1);
  }
  throw e;
}
