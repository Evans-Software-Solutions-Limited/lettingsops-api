CREATE TABLE "agency_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"crm_adapter_kind" text DEFAULT 'noop' NOT NULL,
	"crm_credentials_secret" text,
	"slot_adapter_kind" text DEFAULT 'mock' NOT NULL,
	"slot_credentials_secret" text,
	"slot_granularity_minutes" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_integrations_agency_id_unique" UNIQUE("agency_id")
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"call" text NOT NULL,
	"ref_id" text,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_external_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"crm_kind" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "viewing_external_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"viewing_id" uuid NOT NULL,
	"crm_kind" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_integrations" ADD CONSTRAINT "agency_integrations_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_external_refs" ADD CONSTRAINT "lead_external_refs_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_external_refs" ADD CONSTRAINT "lead_external_refs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_external_refs" ADD CONSTRAINT "viewing_external_refs_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_external_refs" ADD CONSTRAINT "viewing_external_refs_viewing_id_viewings_id_fk" FOREIGN KEY ("viewing_id") REFERENCES "public"."viewings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_external_refs_lead_kind_idx" ON "lead_external_refs" USING btree ("lead_id","crm_kind");--> statement-breakpoint
CREATE UNIQUE INDEX "viewing_external_refs_viewing_kind_idx" ON "viewing_external_refs" USING btree ("viewing_id","crm_kind");--> statement-breakpoint
-- Backfill: every existing agency gets a default agency_integrations row
-- so they keep working before an operator configures real adapters.
-- ON CONFLICT (agency_id) DO NOTHING keeps this idempotent — drizzle
-- runs each migration once via its journal, but a hand-applied or
-- re-run scenario won't error.
INSERT INTO "agency_integrations" ("agency_id")
SELECT "id" FROM "agencies"
ON CONFLICT ("agency_id") DO NOTHING;