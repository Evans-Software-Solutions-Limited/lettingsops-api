CREATE TABLE "agent_agency_map" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"agency_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_agency_map" ADD CONSTRAINT "agent_agency_map_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;