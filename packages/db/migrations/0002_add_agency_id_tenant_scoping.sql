-- Block E.0 — add `agency_id` to leads / qualifications / viewings /
-- communication_logs / audit_logs so the repository layer can enforce
-- tenant scoping in Block E proper.
--
-- The DEFAULT on each new column is a transitional safety net: existing
-- rows get backfilled to the legacy agency in-place (Postgres applies a
-- DEFAULT when ADD COLUMN ... NOT NULL is run on a non-empty table), and
-- writes that haven't yet been migrated to constructor-injected agencyId
-- still land somewhere valid. The DEFAULT is removed in Block E proper
-- once every caller passes an explicit agencyId. Grep `LEGACY_AGENCY_ID`
-- to find every removal site.
--
-- The legacy agency row must exist before the FK constraints land,
-- otherwise the backfilled rows fail the FK check.

INSERT INTO "agencies" ("id", "name", "inbound_email")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Legacy Migration Agency',
  'legacy-migration@lettingsops.local'
)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

ALTER TABLE "audit_logs" ADD COLUMN "agency_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "communication_logs" ADD COLUMN "agency_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "agency_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "qualifications" ADD COLUMN "agency_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "viewings" ADD COLUMN "agency_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;