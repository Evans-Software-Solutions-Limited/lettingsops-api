-- Case-insensitive uniqueness for agencies.inbound_email.
--
-- Inspector Brad HIGH finding on PR #41 (Block I-PR-B+C 3rd sweep):
-- the resolver query uses `lower(inbound_email)` but the table's
-- UNIQUE constraint is byte-exact, so two rows with case-variant
-- addresses can legally coexist and the resolver's `.limit(1)` then
-- routes inbound mail to whichever Postgres chose first — a
-- cross-tenant hijack vector.
--
-- Three statements together close the gap:
--   1. Backfill existing rows to canonical (lower-cased) form so the
--      DDL below can be applied without violating its own predicates.
--   2. UNIQUE INDEX on `lower(inbound_email)` — blocks new
--      case-variant rows AND lets the planner index-scan the
--      resolver query.
--   3. CHECK constraint requiring stored values to already be
--      canonical so future INSERTs from admin/seed paths can't
--      regress.
--
-- If the backfill UPDATE fails with a unique violation, two rows in
-- production already have case-variant inbound_email addresses (e.g.
-- `Foo@x.com` and `foo@x.com` both exist). Resolve manually before
-- re-running the migration — pick the canonical owner, delete or
-- rename the loser. We deliberately do NOT auto-merge here.

UPDATE "agencies"
   SET "inbound_email" = lower(trim("inbound_email"))
 WHERE "inbound_email" <> lower(trim("inbound_email"));
--> statement-breakpoint
CREATE UNIQUE INDEX "agencies_inbound_email_lower_idx" ON "agencies" USING btree (lower("inbound_email"));--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_inbound_email_canonical" CHECK ("agencies"."inbound_email" = lower("agencies"."inbound_email"));
