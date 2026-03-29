/**
 * Create an app user (no public signup). Run after db/migrations/006_app_users_and_daily_reports.sql.
 * Run migrations through 008 (adds bidders.app_user_id) so each new user gets a linked bidder.
 *
 * Usage (PowerShell):
 *   $env:APP_USER_EMAIL="you@example.com"; $env:APP_USER_PASSWORD="your-secure-password"; npm run create-user
 *
 * Optional: APP_USER_NAME, APP_USER_BIDDER_ID (UUID of existing bidders row — links that row instead of creating "self")
 *
 * If APP_USER_BIDDER_ID is omitted, inserts a bidder named "self" (administrator) linked to the new login.
 */
import "dotenv/config";
import { hashPassword } from "../lib/auth/password";
import { getSql } from "../lib/db/neon-sql";

const email = process.env.APP_USER_EMAIL?.trim().toLowerCase();
const password = process.env.APP_USER_PASSWORD;
const name = process.env.APP_USER_NAME?.trim() || null;
const linkBidderIdRaw = process.env.APP_USER_BIDDER_ID?.trim();
const linkBidderId =
  linkBidderIdRaw &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(linkBidderIdRaw)
    ? linkBidderIdRaw
    : null;

if (linkBidderIdRaw && !linkBidderId) {
  console.error("APP_USER_BIDDER_ID must be a valid UUID.");
  process.exit(1);
}

if (!email || !password) {
  console.error("Set APP_USER_EMAIL and APP_USER_PASSWORD (and DATABASE_URL).");
  process.exit(1);
}

const hash = await hashPassword(password);
const sql = getSql();

try {
  const inserted = (await sql`
    INSERT INTO app_users (email, password_hash, name)
    VALUES (${email}, ${hash}, ${name})
    RETURNING id
  `) as { id: string }[];
  const newId = inserted[0]?.id;
  if (!newId) {
    console.error("Insert returned no user id.");
    process.exit(1);
  }

  if (linkBidderId) {
    const updated = (await sql`
      UPDATE bidders
      SET app_user_id = ${newId}::uuid
      WHERE id = ${linkBidderId}::uuid
        AND (app_user_id IS NULL OR app_user_id = ${newId}::uuid)
      RETURNING id
    `) as { id: string }[];
    if (updated.length === 0) {
      console.error(
        "Could not link bidder: missing bidder id, or that bidder already has a different app user linked."
      );
      await sql`DELETE FROM app_users WHERE id = ${newId}::uuid`;
      process.exit(1);
    }
  } else {
    let selfBidderId: string | undefined;
    try {
      const selfRows = (await sql`
        INSERT INTO bidders (name, country, rate_currency, rate_amount, status, role, note, app_user_id)
        VALUES (
          'self',
          'Internal',
          'USD',
          0,
          'active',
          'Administrator',
          '',
          ${newId}::uuid
        )
        RETURNING id
      `) as { id: string }[];
      selfBidderId = selfRows[0]?.id;
      if (!selfBidderId) {
        throw new Error("no_self_bidder_id");
      }
      await sql`
        INSERT INTO bidder_contacts (bidder_id, label, value, sort_order)
        VALUES (${selfBidderId}::uuid, 'Email', ${email}, 0)
      `;
    } catch (e) {
      if (selfBidderId) {
        await sql`DELETE FROM bidders WHERE id = ${selfBidderId}::uuid`;
      }
      await sql`DELETE FROM app_users WHERE id = ${newId}::uuid`;
      if (e instanceof Error && e.message === "no_self_bidder_id") {
        console.error("Insert returned no bidder id for self row.");
        process.exit(1);
      }
      throw e;
    }
  }

  console.log(
    "Created user:",
    email,
    linkBidderId ? `(linked bidder ${linkBidderId})` : '(admin bidder "self")'
  );
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("unique") || msg.includes("duplicate")) {
    console.error("A user with this email already exists.");
    process.exit(1);
  }
  if (msg.includes("app_user_id") && msg.includes("does not exist")) {
    console.error(
      "Run db/migrations/008_bidder_work_per_profile.sql (adds bidders.app_user_id). Required for new users (self bidder) and for APP_USER_BIDDER_ID."
    );
    process.exit(1);
  }
  throw e;
}
