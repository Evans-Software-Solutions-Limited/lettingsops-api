CREATE TYPE "public"."conversation_type" AS ENUM('VIEWING_ENQUIRY', 'MAINTENANCE_REQUEST', 'GENERAL_ENQUIRY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('email', 'phone', 'portal', 'manual');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('NEW', 'CONTACTED', 'QUALIFYING', 'QUALIFIED', 'VIEWING_BOOKED', 'OFFER_STAGE', 'CONVERTED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."score_category" AS ENUM('LOW', 'MEDIUM', 'STRONG');--> statement-breakpoint
CREATE TYPE "public"."viewing_request_status" AS ENUM('PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'CONFIRMED');--> statement-breakpoint
CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"inbound_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agencies_inbound_email_unique" UNIQUE("inbound_email")
);
--> statement-breakpoint
CREATE TABLE "agency_required_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"field_label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"estate_agent_id" uuid,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"source" text NOT NULL,
	"message_id" text,
	"subject" text,
	"body" text,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"lead_id" uuid,
	"tenant_email" text NOT NULL,
	"conversation_type" "conversation_type" DEFAULT 'OTHER' NOT NULL,
	"thread_message_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"collected_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"calendar_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"property_ref" text,
	"property_rent" integer,
	"message" text,
	"source" "lead_source" NOT NULL,
	"status" "lead_status" DEFAULT 'NEW' NOT NULL,
	"score" integer,
	"score_category" "score_category",
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qualifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"category" "score_category" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "viewing_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"conversation_id" uuid,
	"status" "viewing_request_status" DEFAULT 'PENDING_REVIEW' NOT NULL,
	"assigned_agent_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "viewings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"property_ref" text NOT NULL,
	"slot_id" text NOT NULL,
	"calendar_event_id" text,
	"confirmed_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewing_request_id" uuid,
	"assigned_agent_id" uuid
);
--> statement-breakpoint
ALTER TABLE "agency_required_fields" ADD CONSTRAINT "agency_required_fields_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_estate_agent_id_estate_agents_id_fk" FOREIGN KEY ("estate_agent_id") REFERENCES "public"."estate_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_conversations" ADD CONSTRAINT "email_conversations_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_conversations" ADD CONSTRAINT "email_conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_agents" ADD CONSTRAINT "estate_agents_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_requests" ADD CONSTRAINT "viewing_requests_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_requests" ADD CONSTRAINT "viewing_requests_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_requests" ADD CONSTRAINT "viewing_requests_conversation_id_email_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."email_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_requests" ADD CONSTRAINT "viewing_requests_assigned_agent_id_estate_agents_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."estate_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_viewing_request_id_viewing_requests_id_fk" FOREIGN KEY ("viewing_request_id") REFERENCES "public"."viewing_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_assigned_agent_id_estate_agents_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."estate_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agency_required_fields_agency_id_field_key_idx" ON "agency_required_fields" USING btree ("agency_id","field_key");--> statement-breakpoint
CREATE UNIQUE INDEX "email_conversations_agency_id_tenant_email_idx" ON "email_conversations" USING btree ("agency_id","tenant_email");