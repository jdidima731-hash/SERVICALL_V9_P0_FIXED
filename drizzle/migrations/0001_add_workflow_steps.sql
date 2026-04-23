-- Migration 0001: Ajout de la table workflow_steps manquante
CREATE TABLE IF NOT EXISTS "workflow_steps" (
"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflow_steps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
"workflow_id" integer NOT NULL,
"tenant_id" integer NOT NULL,
"step_order" integer NOT NULL DEFAULT 0,
"step_type" varchar(100) NOT NULL DEFAULT 'action',
"step_name" varchar(255),
"config" json,
"is_active" boolean DEFAULT true,
"created_at" timestamp DEFAULT now(),
"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_steps_workflow_id_idx" ON "workflow_steps" USING btree ("workflow_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_steps_tenant_id_idx" ON "workflow_steps" USING btree ("tenant_id");
