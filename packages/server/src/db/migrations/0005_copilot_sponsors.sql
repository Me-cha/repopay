CREATE TABLE "copilot_sponsor_states" (
	"nonce_hash" text PRIMARY KEY NOT NULL,
	"browser_binding_hash" text NOT NULL,
	"session_id" text NOT NULL,
	"actor_gh_id" bigint NOT NULL,
	"repo_id" bigint NOT NULL,
	"installation_id" bigint NOT NULL,
	"verifier_enc" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "copilot_sponsors" (
	"repo_id" bigint PRIMARY KEY NOT NULL,
	"installation_id" bigint NOT NULL,
	"sponsor_gh_id" bigint NOT NULL,
	"sponsor_login" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"token_generation" integer DEFAULT 0 NOT NULL,
	"model_id" text NOT NULL,
	"model_verified_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copilot_sponsor_model_check" CHECK ("copilot_sponsors"."model_id" <> '' and lower("copilot_sponsors"."model_id") <> 'auto')
);
