CREATE TYPE "public"."call_type" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."customer_sentiment" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('photo', 'scan', 'contract', 'id_card', 'other');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('success', 'no_answer', 'voicemail', 'busy', 'failed');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."reminder_type" AS ENUM('email', 'sms', 'push');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('twilio_voice', 'twilio_sms', 'openai_token');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'superadmin', 'admin', 'manager', 'agent', 'agentIA', 'user');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('new', 'contacted', 'qualified', 'converted', 'lost');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('manual', 'scheduled', 'event');--> statement-breakpoint
CREATE TYPE "public"."type" AS ENUM('ai_qualification', 'human_appointment', 'hybrid_reception');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."urgency_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."business_type" AS ENUM('restaurant', 'hotel', 'real_estate', 'clinic', 'ecommerce', 'artisan', 'call_center', 'generic');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('product', 'service', 'property', 'room', 'appointment', 'menu_item', 'other');--> statement-breakpoint
CREATE TYPE "public"."candidate_source" AS ENUM('platform', 'manual', 'referral', 'job_board', 'other');--> statement-breakpoint
CREATE TYPE "public"."emotion" AS ENUM('confident', 'nervous', 'calm', 'stressed', 'enthusiastic', 'neutral', 'defensive', 'uncertain');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('pending', 'scheduled', 'in_progress', 'completed', 'reviewed', 'shortlisted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"user_id" integer,
	"action" varchar(255) NOT NULL,
	"details" json,
	"resource" varchar(255),
	"resource_id" integer,
	"resource_type" varchar(100),
	"changes" json,
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "calls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"agent_id" integer,
	"call_type" "call_type" DEFAULT 'outbound',
	"direction" varchar(20) DEFAULT 'outbound',
	"campaign_id" integer,
	"status" text DEFAULT 'scheduled',
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"duration" integer,
	"outcome" "outcome",
	"notes" text,
	"call_sid" varchar(255),
	"recording_url" text,
	"recording_key" text,
	"from_number" varchar(50),
	"to_number" varchar(50),
	"transcription" text,
	"summary" text,
	"quality_score" varchar(10),
	"sentiment" varchar(50),
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaigns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "type" DEFAULT 'hybrid_reception',
	"activity_type" varchar(100),
	"status" text DEFAULT 'active',
	"details" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"subscription_id" integer,
	"invoice_number" varchar(100) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR',
	"status" text DEFAULT 'pending',
	"stripe_invoice_id" varchar(255),
	"pdf_url" text,
	"due_date" timestamp,
	"paid_at" timestamp,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"workflow_id" integer,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"payload" json,
	"result" json,
	"retry_count" integer DEFAULT 0,
	"next_run_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"campaign_id" integer,
	"type" varchar(50) NOT NULL,
	"direction" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"external_sid" varchar(255),
	"error" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prospects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"email" text,
	"phone" text,
	"company" varchar(255),
	"job_title" varchar(255),
	"source" varchar(100),
	"status" "status" DEFAULT 'new',
	"assigned_to" integer,
	"notes" text,
	"priority" varchar(50) DEFAULT 'medium',
	"due_date" timestamp,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"plan" "plan" DEFAULT 'free',
	"status" text DEFAULT 'active',
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"stripe_subscription_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenant_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'agent',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255),
	"logo" text,
	"settings" json,
	"business_type" varchar(50),
	"ai_custom_script" text,
	"pos_provider" varchar(50),
	"pos_config" json,
	"pos_sync_enabled" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"open_id" varchar(255) NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"password_hash" varchar(255),
	"login_method" varchar(50),
	"role" "role" DEFAULT 'user',
	"last_signed_in" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_executions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflow_executions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workflow_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"trigger" varchar(100) NOT NULL,
	"input" json,
	"output" json,
	"error" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"trigger_type" "trigger_type" DEFAULT 'manual',
	"trigger_config" json,
	"actions" json NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_performance" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_performance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"period" varchar(50) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_calls" integer DEFAULT 0,
	"successful_calls" integer DEFAULT 0,
	"average_duration" integer,
	"average_score" numeric(3, 2),
	"metrics" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_switch_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_switch_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"from_role" varchar(50),
	"to_role" varchar(50) NOT NULL,
	"reason" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_suggestions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_suggestions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"type" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"confidence" numeric(3, 2),
	"status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointment_reminders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointment_reminders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"appointment_id" integer NOT NULL,
	"reminder_type" varchar(50) DEFAULT 'email',
	"scheduled_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"status" varchar(50) DEFAULT 'pending',
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"agent_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"scheduled_at" timestamp NOT NULL,
	"duration" integer DEFAULT 30,
	"status" varchar(50) DEFAULT 'scheduled',
	"location" varchar(255),
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_ai_usage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_ai_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"workflow_id" integer,
	"model" varchar(100),
	"tokens_used" integer,
	"cost" numeric(10, 6),
	"status" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blacklisted_numbers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "blacklisted_numbers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer,
	"phone_number" varchar(50) NOT NULL,
	"reason" text,
	"added_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "call_execution_metrics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "call_execution_metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"call_id" integer,
	"call_received_at" timestamp,
	"timestamps" json,
	"execution_time" integer,
	"api_calls" integer,
	"tokens_used" integer,
	"cost" numeric(10, 6),
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "call_scoring" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "call_scoring_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"call_id" integer,
	"overall_score" numeric(3, 2),
	"sentiment_score" numeric(3, 2),
	"clarity_score" numeric(3, 2),
	"professionalism_score" numeric(3, 2),
	"feedback" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "campaign_prospects" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaign_prospects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"campaign_id" integer NOT NULL,
	"prospect_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coaching_feedback" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coaching_feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"call_id" integer,
	"coach_id" integer,
	"feedback" text NOT NULL,
	"rating" integer,
	"strengths" json,
	"improvements" json,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "command_validations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "command_validations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"call_id" integer,
	"invoice_id" integer,
	"command" text NOT NULL,
	"validated_by" varchar(100) DEFAULT 'ai',
	"validated_by_user_id" integer,
	"confidence" numeric(3, 2),
	"validation_score" integer,
	"risk_level" varchar(50),
	"requires_human_review" boolean DEFAULT false,
	"reason" text,
	"status" varchar(50) DEFAULT 'pending',
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_alerts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "compliance_alerts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"alert_type" varchar(100) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'open',
	"severity" varchar(50) DEFAULT 'medium',
	"resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolution" text,
	"resource" varchar(100),
	"resource_id" varchar(255),
	"metadata" json,
	"detected_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "compliance_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"resource_type" varchar(100),
	"resource_id" integer,
	"description" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"checked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_invoices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_invoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"call_id" integer,
	"invoice_number" varchar(100) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0.00',
	"total_amount" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'EUR',
	"description" text,
	"template" varchar(100) DEFAULT 'default',
	"status" varchar(50) DEFAULT 'pending',
	"due_date" timestamp,
	"paid_at" timestamp,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"secure_token" text,
	"secure_link" text,
	"link_expires_at" timestamp,
	"payment_status" varchar(50) DEFAULT 'unpaid',
	"sent_at" timestamp,
	"accepted_at" timestamp,
	CONSTRAINT "customer_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"name" varchar(255) NOT NULL,
	"type" varchar(100),
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"uploaded_by" integer,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "failed_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "failed_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer,
	"job_type" varchar(100) NOT NULL,
	"payload" json,
	"error" text,
	"stack_trace" text,
	"failed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "message_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"subject" varchar(255),
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"product_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"order_number" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR',
	"payment_status" varchar(50) DEFAULT 'unpaid',
	"shipping_address" json,
	"billing_address" json,
	"notes" text,
	"tax" numeric(10, 2) DEFAULT '0.00',
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "predictive_scores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "predictive_scores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer NOT NULL,
	"invoice_id" integer,
	"score_type" varchar(100) DEFAULT 'payment_prediction' NOT NULL,
	"score" numeric(5, 4),
	"confidence" numeric(3, 2),
	"probability_acceptance" numeric(5, 4),
	"estimated_payment_delay" integer,
	"estimated_processing_time" integer,
	"recommended_channel" varchar(100),
	"recommended_time" varchar(100),
	"success_probability" numeric(5, 4),
	"risk_factors" json,
	"factors" json,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "processed_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source" varchar(255) NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"processed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recordings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"call_id" integer,
	"recording_sid" varchar(255),
	"recording_url" text,
	"duration" integer,
	"status" varchar(50) DEFAULT 'available',
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rgpd_consents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rgpd_consents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"consent_type" varchar(100) NOT NULL,
	"granted" boolean DEFAULT false,
	"granted_at" timestamp,
	"resolved_at" timestamp,
	"metadata" json,
	"detected_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "security_audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer,
	"user_id" integer,
	"event_type" varchar(100) NOT NULL,
	"severity" varchar(50) DEFAULT 'low',
	"description" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "simulated_calls" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"agent_id" integer,
	"scenario_id" varchar(255),
	"scenario_name" varchar(255),
	"status" text DEFAULT 'in_progress',
	"duration" integer DEFAULT 0,
	"score" integer DEFAULT 0,
	"transcript" json,
	"feedback" json,
	"objectives_achieved" json,
	"metadata" json,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stripe_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_id" varchar(255) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"tenant_id" integer,
	"payload" json NOT NULL,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "stripe_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"assigned_to" integer,
	"prospect_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'pending',
	"priority" varchar(50) DEFAULT 'medium',
	"due_date" timestamp,
	"completed_at" timestamp,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_ai_keys" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenant_ai_keys_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"provider" varchar(50) DEFAULT 'openai' NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_validated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenant_ai_keys_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_industry_config" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tenant_industry_config_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"industry_id" varchar(255) NOT NULL,
	"enabled_capabilities" json,
	"enabled_workflows" json,
	"ai_system_prompt" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenant_industry_config_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "usage_metrics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "usage_metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"cost" numeric(10, 6) DEFAULT '0' NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_2fa" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_2fa_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"secret" text NOT NULL,
	"is_enabled" boolean DEFAULT false,
	"backup_codes" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflow_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"industry_id" varchar(255) NOT NULL,
	"template_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"trigger_type" varchar(50),
	"steps" json NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bookings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"prospect_id" integer,
	"check_in" timestamp NOT NULL,
	"check_out" timestamp NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customers_extended" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customers_extended_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"prospect_id" integer NOT NULL,
	"preferences" json,
	"address" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "customers_extended_prospect_id_unique" UNIQUE("prospect_id")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "enrollments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"course_name" varchar(255) NOT NULL,
	"education_level" varchar(100),
	"status" varchar(50) DEFAULT 'interested',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "hotel_rooms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hotel_rooms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"room_number" varchar(50) NOT NULL,
	"room_type" varchar(100),
	"price_per_night" numeric(10, 2) NOT NULL,
	"available" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "interventions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "interventions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"type" varchar(100) NOT NULL,
	"description" text,
	"urgency" varchar(50) DEFAULT 'low',
	"scheduled_at" timestamp,
	"status" varchar(50) DEFAULT 'scheduled',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "job_offers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_offers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"department" varchar(100),
	"location" varchar(255),
	"salary_range" varchar(100),
	"contract_type" varchar(50),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "legal_cases" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "legal_cases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"case_type" varchar(100),
	"description" text,
	"status" varchar(50) DEFAULT 'open',
	"drive_folder_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "medical_appointments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "medical_appointments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"doctor_id" integer,
	"appointment_date" timestamp NOT NULL,
	"symptoms" text,
	"urgency_level" "urgency_level" DEFAULT 'low' NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menu_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"price" numeric(10, 2) NOT NULL,
	"available" boolean DEFAULT true,
	"allergens" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "real_estate_properties" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "real_estate_properties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"property_type" varchar(50),
	"price" numeric(12, 2) NOT NULL,
	"location" varchar(255) NOT NULL,
	"rooms" integer,
	"surface" numeric(10, 2),
	"available" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "restaurant_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "restaurant_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"order_number" varchar(50) NOT NULL,
	"items_json" json NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"delivery_address" text,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "restaurant_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shipments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"tracking_number" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"estimated_delivery" timestamp,
	"actual_delivery" timestamp,
	"shipping_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "shipments_tracking_number_unique" UNIQUE("tracking_number")
);
--> statement-breakpoint
CREATE TABLE "business_entities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "business_entities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"type" "entity_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(10, 2),
	"vat_rate" numeric(5, 2) DEFAULT '20.00',
	"availability_json" json,
	"metadata_json" json,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pos_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"crm_order_id" varchar(255),
	"pos_order_id" varchar(255),
	"provider" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"vat_amount" numeric(10, 2) NOT NULL,
	"sync_log" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_interviews" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "candidate_interviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"candidate_name" text,
	"candidate_email" text,
	"candidate_phone" text,
	"business_type" varchar(100) NOT NULL,
	"job_position" varchar(255) NOT NULL,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration" integer,
	"status" "interview_status" DEFAULT 'pending',
	"source" "candidate_source" DEFAULT 'platform',
	"call_sid" varchar(255),
	"recording_url" text,
	"transcript" text,
	"notes_json" json,
	"ai_summary" text,
	"ai_recommendation" varchar(50),
	"ai_confidence" numeric(5, 2),
	"metadata" json,
	"employer_notes" text,
	"employer_decision" varchar(50),
	"employer_decision_at" timestamp,
	"consent_given" boolean DEFAULT false,
	"data_retention_until" timestamp,
	"anonymized" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interview_questions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "interview_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer,
	"business_type" varchar(100) NOT NULL,
	"category" varchar(100) NOT NULL,
	"question" text NOT NULL,
	"expected_answer_type" varchar(50),
	"expected_keywords" json,
	"weight" numeric(5, 2) DEFAULT '1.00',
	"is_active" boolean DEFAULT true,
	"order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recruitment_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recruitment_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"business_type" varchar(100) NOT NULL,
	"min_global_score" numeric(5, 2) DEFAULT '6.00',
	"min_coherence_score" numeric(5, 2) DEFAULT '7.00',
	"min_honesty_score" numeric(5, 2) DEFAULT '7.00',
	"ai_model" varchar(100) DEFAULT 'gpt-4o-mini',
	"ai_temperature" numeric(3, 2) DEFAULT '0.70',
	"custom_intro_script" text,
	"custom_outro_script" text,
	"notify_on_completion" boolean DEFAULT true,
	"notification_email" text,
	"data_retention_days" integer DEFAULT 90,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"prospect_id" integer,
	"assigned_to" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"value" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'EUR',
	"status" varchar(50) DEFAULT 'open',
	"probability" integer DEFAULT 0,
	"expected_close_date" timestamp,
	"metadata" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_performance" ADD CONSTRAINT "agent_performance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_performance" ADD CONSTRAINT "agent_performance_agent_id_tenants_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_switch_history" ADD CONSTRAINT "agent_switch_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_switch_history" ADD CONSTRAINT "agent_switch_history_user_id_tenants_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_agent_id_tenants_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_ai_usage" ADD CONSTRAINT "audit_ai_usage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklisted_numbers" ADD CONSTRAINT "blacklisted_numbers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blacklisted_numbers" ADD CONSTRAINT "blacklisted_numbers_added_by_tenants_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_execution_metrics" ADD CONSTRAINT "call_execution_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_execution_metrics" ADD CONSTRAINT "call_execution_metrics_call_id_campaigns_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_scoring" ADD CONSTRAINT "call_scoring_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_scoring" ADD CONSTRAINT "call_scoring_call_id_campaigns_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_prospects" ADD CONSTRAINT "campaign_prospects_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_feedback" ADD CONSTRAINT "coaching_feedback_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_feedback" ADD CONSTRAINT "coaching_feedback_agent_id_tenants_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_feedback" ADD CONSTRAINT "coaching_feedback_call_id_campaigns_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_feedback" ADD CONSTRAINT "coaching_feedback_coach_id_tenants_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_validations" ADD CONSTRAINT "command_validations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_validations" ADD CONSTRAINT "command_validations_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_validations" ADD CONSTRAINT "command_validations_call_id_campaigns_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_validations" ADD CONSTRAINT "command_validations_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_alerts" ADD CONSTRAINT "compliance_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_logs" ADD CONSTRAINT "compliance_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_tenants_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failed_jobs" ADD CONSTRAINT "failed_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_scores" ADD CONSTRAINT "predictive_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_scores" ADD CONSTRAINT "predictive_scores_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_call_id_campaigns_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rgpd_consents" ADD CONSTRAINT "rgpd_consents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rgpd_consents" ADD CONSTRAINT "rgpd_consents_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_user_id_tenants_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_calls" ADD CONSTRAINT "simulated_calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulated_calls" ADD CONSTRAINT "simulated_calls_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD CONSTRAINT "stripe_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_tenants_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_ai_keys" ADD CONSTRAINT "tenant_ai_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_industry_config" ADD CONSTRAINT "tenant_industry_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_2fa" ADD CONSTRAINT "user_2fa_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_hotel_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."hotel_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers_extended" ADD CONSTRAINT "customers_extended_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_rooms" ADD CONSTRAINT "hotel_rooms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_appointments" ADD CONSTRAINT "medical_appointments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_appointments" ADD CONSTRAINT "medical_appointments_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_appointments" ADD CONSTRAINT "medical_appointments_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_properties" ADD CONSTRAINT "real_estate_properties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_orders" ADD CONSTRAINT "restaurant_orders_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_entities" ADD CONSTRAINT "business_entities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_interviews" ADD CONSTRAINT "candidate_interviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_settings" ADD CONSTRAINT "recruitment_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "calls_tenant_id_idx" ON "calls" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "calls_prospect_id_idx" ON "calls" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "calls_agent_id_idx" ON "calls" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "calls_status_idx" ON "calls" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "call_sid_idx" ON "calls" USING btree ("call_sid");--> statement-breakpoint
CREATE INDEX "calls_tenant_created_idx" ON "calls" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "calls_tenant_status_idx" ON "calls" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "calls_tenant_user_idx" ON "calls" USING btree ("tenant_id","agent_id");--> statement-breakpoint
CREATE INDEX "campaigns_tenant_id_idx" ON "campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "campaigns_activity_idx" ON "campaigns" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "invoices_tenant_id_idx" ON "invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_tenant_created_idx" ON "invoices" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invoices_tenant_status_idx" ON "invoices" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "jobs_tenant_id_idx" ON "jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "jobs_workflow_created_idx" ON "jobs" USING btree ("workflow_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "messages_tenant_id_idx" ON "messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "messages_prospect_id_idx" ON "messages" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "messages_status_idx" ON "messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "messages_tenant_created_idx" ON "messages" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_tenant_status_idx" ON "messages" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "prospects_tenant_id_idx" ON "prospects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "prospects_status_idx" ON "prospects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prospects_assigned_to_idx" ON "prospects" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_prospects_lookup" ON "prospects" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "prospects_tenant_created_idx" ON "prospects" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "prospects_tenant_status_idx" ON "prospects" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "prospects_tenant_user_idx" ON "prospects" USING btree ("tenant_id","assigned_to");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_user_unique" ON "tenant_users" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "tenant_users_user_id_idx" ON "tenant_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_users_tenant_id_idx" ON "tenant_users" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "open_id_idx" ON "users" USING btree ("open_id");--> statement-breakpoint
CREATE INDEX "workflow_executions_workflow_id_idx" ON "workflow_executions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_executions_tenant_id_idx" ON "workflow_executions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_executions_created_at_idx" ON "workflow_executions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workflows_tenant_id_idx" ON "workflows" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workflows_is_active_idx" ON "workflows" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workflows_tenant_created_idx" ON "workflows" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workflows_tenant_status_idx" ON "workflows" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "workflows_tenant_user_idx" ON "workflows" USING btree ("tenant_id","created_by");--> statement-breakpoint
CREATE INDEX "idx_agent_performance_tenant_id_idx" ON "agent_performance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_agent_performance_agent_id_idx" ON "agent_performance" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_performance_period_idx" ON "agent_performance" USING btree ("period");--> statement-breakpoint
CREATE INDEX "idx_agent_performance_period_start_idx" ON "agent_performance" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "idx_agent_switch_history_tenant_id_idx" ON "agent_switch_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_agent_switch_history_user_id_idx" ON "agent_switch_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_agent_switch_history_created_at_idx" ON "agent_switch_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_suggestions_tenant_id_idx" ON "ai_suggestions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_appointment_reminders_tenant_id_idx" ON "appointment_reminders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_appointment_reminders_appointment_id_idx" ON "appointment_reminders" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "idx_appointment_reminders_scheduled_at_idx" ON "appointment_reminders" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_appointment_reminders_status_idx" ON "appointment_reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_appointments_tenant_id_idx" ON "appointments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_prospect_id_idx" ON "appointments" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_agent_id_idx" ON "appointments" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_scheduled_at_idx" ON "appointments" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_appointments_status_idx" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_audit_ai_usage_tenant_id_idx" ON "audit_ai_usage" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_ai_usage_created_at_idx" ON "audit_ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_blacklisted_numbers_phone_unique" ON "blacklisted_numbers" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "idx_blacklisted_numbers_tenant_id_idx" ON "blacklisted_numbers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_call_execution_metrics_tenant_id_idx" ON "call_execution_metrics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_call_execution_metrics_call_id_idx" ON "call_execution_metrics" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "idx_call_scoring_tenant_id_idx" ON "call_scoring" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_call_scoring_call_id_idx" ON "call_scoring" USING btree ("call_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_campaign_prospects_unique" ON "campaign_prospects" USING btree ("campaign_id","prospect_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_prospects_campaign_id_idx" ON "campaign_prospects" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_prospects_prospect_id_idx" ON "campaign_prospects" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_prospects_status_idx" ON "campaign_prospects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_coaching_feedback_tenant_id_idx" ON "coaching_feedback" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_coaching_feedback_agent_id_idx" ON "coaching_feedback" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_coaching_feedback_call_id_idx" ON "coaching_feedback" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "idx_command_validations_tenant_id_idx" ON "command_validations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_command_validations_prospect_id_idx" ON "command_validations" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_command_validations_call_id_idx" ON "command_validations" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "idx_command_validations_status_idx" ON "command_validations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_compliance_alerts_tenant_id_idx" ON "compliance_alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_alerts_alert_type_idx" ON "compliance_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_compliance_alerts_status_idx" ON "compliance_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_compliance_alerts_severity_idx" ON "compliance_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_compliance_logs_tenant_id_idx" ON "compliance_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_logs_event_type_idx" ON "compliance_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_compliance_logs_created_at_idx" ON "compliance_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_customer_invoices_tenant_id_idx" ON "customer_invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_customer_invoices_prospect_id_idx" ON "customer_invoices" USING btree ("prospect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_customer_invoices_invoice_number_unique" ON "customer_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "idx_customer_invoices_status_idx" ON "customer_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_documents_tenant_id_idx" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_documents_prospect_id_idx" ON "documents" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_documents_type_idx" ON "documents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_failed_jobs_tenant_id_idx" ON "failed_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_failed_jobs_job_type_idx" ON "failed_jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "idx_failed_jobs_failed_at_idx" ON "failed_jobs" USING btree ("failed_at");--> statement-breakpoint
CREATE INDEX "idx_message_templates_tenant_id_idx" ON "message_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_orders_tenant_id_idx" ON "orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_orders_prospect_id_idx" ON "orders" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_orders_order_number_idx_unique" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "idx_predictive_scores_tenant_id_idx" ON "predictive_scores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_predictive_scores_prospect_id_idx" ON "predictive_scores" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_predictive_scores_score_type_idx" ON "predictive_scores" USING btree ("score_type");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_processed_event_idx" ON "processed_events" USING btree ("source","event_id");--> statement-breakpoint
CREATE INDEX "idx_processed_events_source_idx" ON "processed_events" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_processed_events_processed_at_idx" ON "processed_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "idx_recordings_tenant_id_idx" ON "recordings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_recordings_call_id_idx" ON "recordings" USING btree ("call_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_recordings_recording_sid_unique" ON "recordings" USING btree ("recording_sid");--> statement-breakpoint
CREATE INDEX "idx_rgpd_consents_tenant_id_idx" ON "rgpd_consents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_rgpd_consents_prospect_id_idx" ON "rgpd_consents" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_rgpd_consents_consent_type_idx" ON "rgpd_consents" USING btree ("consent_type");--> statement-breakpoint
CREATE INDEX "idx_security_audit_logs_tenant_id_idx" ON "security_audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_security_audit_logs_event_type_idx" ON "security_audit_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_security_audit_logs_severity_idx" ON "security_audit_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_security_audit_logs_created_at_idx" ON "security_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_simulated_calls_tenant_id_idx" ON "simulated_calls" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_simulated_calls_agent_id_idx" ON "simulated_calls" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_simulated_calls_scenario_id_idx" ON "simulated_calls" USING btree ("scenario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_stripe_events_event_id_unique" ON "stripe_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_stripe_events_event_type_idx" ON "stripe_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_stripe_events_processed_idx" ON "stripe_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_tasks_tenant_id_idx" ON "tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_assigned_to_idx" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_tasks_prospect_id_idx" ON "tasks" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tasks_priority_idx" ON "tasks" USING btree ("priority");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_ai_keys_tenant_id_unique" ON "tenant_ai_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_ai_keys_provider_idx" ON "tenant_ai_keys" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_industry_config_tenant_id_unique" ON "tenant_industry_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_usage_metrics_tenant_id_idx" ON "usage_metrics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_usage_metrics_resource_type_idx" ON "usage_metrics" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "idx_usage_metrics_created_at_idx" ON "usage_metrics" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_2fa_user_id_idx" ON "user_2fa" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_template_idx" ON "workflow_templates" USING btree ("industry_id","template_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_templates_industry_id_idx" ON "workflow_templates" USING btree ("industry_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_tenant_id" ON "bookings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_room_id" ON "bookings" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_prospect_id" ON "bookings" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bookings_check_in" ON "bookings" USING btree ("check_in");--> statement-breakpoint
CREATE INDEX "idx_bookings_check_out" ON "bookings" USING btree ("check_out");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cust_ext_prospect_id_unique" ON "customers_extended" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_enroll_tenant_id" ON "enrollments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_enroll_course" ON "enrollments" USING btree ("course_name");--> statement-breakpoint
CREATE INDEX "idx_hotel_rooms_tenant_id" ON "hotel_rooms" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_hotel_rooms_number" ON "hotel_rooms" USING btree ("room_number");--> statement-breakpoint
CREATE INDEX "idx_hotel_rooms_available" ON "hotel_rooms" USING btree ("available");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hotel_rooms_tenant_number" ON "hotel_rooms" USING btree ("tenant_id","room_number");--> statement-breakpoint
CREATE INDEX "idx_interv_tenant_id" ON "interventions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_interv_status" ON "interventions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_jobs_tenant_id" ON "job_offers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_active" ON "job_offers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_legal_cases_tenant_id" ON "legal_cases" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_legal_cases_prospect_id" ON "legal_cases" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_medical_app_tenant_id" ON "medical_appointments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_medical_app_prospect_id" ON "medical_appointments" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_medical_app_doctor_id" ON "medical_appointments" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_medical_app_status" ON "medical_appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_medical_app_date" ON "medical_appointments" USING btree ("appointment_date");--> statement-breakpoint
CREATE INDEX "idx_medical_app_urgency" ON "medical_appointments" USING btree ("urgency_level");--> statement-breakpoint
CREATE INDEX "idx_menu_items_tenant_id" ON "menu_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_menu_items_category" ON "menu_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_menu_items_available" ON "menu_items" USING btree ("available");--> statement-breakpoint
CREATE INDEX "idx_menu_items_tenant_category" ON "menu_items" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "idx_re_prop_tenant_id" ON "real_estate_properties" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_re_prop_type" ON "real_estate_properties" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_re_prop_location" ON "real_estate_properties" USING btree ("location");--> statement-breakpoint
CREATE INDEX "idx_re_prop_price" ON "real_estate_properties" USING btree ("price");--> statement-breakpoint
CREATE INDEX "idx_orders_tenant_id" ON "restaurant_orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_orders_prospect_id" ON "restaurant_orders" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "restaurant_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_orders_number_unique" ON "restaurant_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "idx_orders_tenant_created" ON "restaurant_orders" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_shipments_tenant_id" ON "shipments" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_shipments_tracking_unique" ON "shipments" USING btree ("tracking_number");--> statement-breakpoint
CREATE INDEX "idx_business_entities_tenant_id" ON "business_entities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_business_entities_type" ON "business_entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_business_entities_is_active" ON "business_entities" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_business_entities_tenant_type" ON "business_entities" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "idx_business_entities_tenant_active" ON "business_entities" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_pos_orders_tenant_id" ON "pos_orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_pos_orders_crm_id" ON "pos_orders" USING btree ("crm_order_id");--> statement-breakpoint
CREATE INDEX "idx_pos_orders_pos_id" ON "pos_orders" USING btree ("pos_order_id");--> statement-breakpoint
CREATE INDEX "idx_pos_orders_tenant_provider" ON "pos_orders" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX "candidate_interviews_tenant_id_idx" ON "candidate_interviews" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "candidate_interviews_tenant_business_idx" ON "candidate_interviews" USING btree ("tenant_id","business_type");--> statement-breakpoint
CREATE INDEX "candidate_interviews_tenant_status_idx" ON "candidate_interviews" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "candidate_interviews_status_idx" ON "candidate_interviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "candidate_interviews_business_type_idx" ON "candidate_interviews" USING btree ("business_type");--> statement-breakpoint
CREATE INDEX "candidate_interviews_scheduled_at_idx" ON "candidate_interviews" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "candidate_interviews_created_at_idx" ON "candidate_interviews" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "candidate_interviews_tenant_business_status_idx" ON "candidate_interviews" USING btree ("tenant_id","business_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_interviews_call_sid_idx" ON "candidate_interviews" USING btree ("call_sid");--> statement-breakpoint
CREATE INDEX "interview_questions_business_type_idx" ON "interview_questions" USING btree ("business_type");--> statement-breakpoint
CREATE INDEX "interview_questions_tenant_business_idx" ON "interview_questions" USING btree ("tenant_id","business_type");--> statement-breakpoint
CREATE INDEX "interview_questions_is_active_idx" ON "interview_questions" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "recruitment_settings_tenant_business_unique_idx" ON "recruitment_settings" USING btree ("tenant_id","business_type");--> statement-breakpoint
CREATE INDEX "recruitment_settings_tenant_id_idx" ON "recruitment_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_deals_tenant_id_idx" ON "deals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_deals_prospect_id_idx" ON "deals" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_deals_assigned_to_idx" ON "deals" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_deals_status_idx" ON "deals" USING btree ("status");