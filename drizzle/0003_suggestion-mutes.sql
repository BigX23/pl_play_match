CREATE TABLE "suggestion_mutes" (
	"user_id" text NOT NULL,
	"muted_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "suggestion_mutes_user_id_muted_user_id_pk" PRIMARY KEY("user_id","muted_user_id")
);
--> statement-breakpoint
ALTER TABLE "suggestion_mutes" ADD CONSTRAINT "suggestion_mutes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_mutes" ADD CONSTRAINT "suggestion_mutes_muted_user_id_users_id_fk" FOREIGN KEY ("muted_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;