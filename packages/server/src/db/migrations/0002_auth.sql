CREATE TABLE "oauth_states" (
	"nonce_hash" text PRIMARY KEY NOT NULL,
	"browser_binding_hash" text NOT NULL,
	"return_to" text NOT NULL,
	"verifier_enc" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"gh_id" bigint NOT NULL,
	"gh_login" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"token_generation" integer DEFAULT 0 NOT NULL,
	"csrf_secret" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
