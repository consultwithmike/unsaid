import { Webhook } from "svix";

import { sql } from "@/lib/db";
import { readEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

interface ClerkEvent {
  type: string;
  data: {
    id?: string;
    email_addresses?: Array<{ email_address?: string; id?: string }>;
    primary_email_address_id?: string;
    first_name?: string | null;
  };
}

/**
 * POST /api/clerk/webhook — public, Svix signature only.
 *
 * `user.deleted` enqueues the same purge path as `DELETE /api/account`
 * (PRIVACY retention table).
 */
export async function POST(request: Request) {
  const secret = readEnv("CLERK_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[clerk:webhook] CLERK_WEBHOOK_SECRET is not configured");
    return Response.json({ received: false }, { status: 500 });
  }

  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };

  let event: ClerkEvent;
  try {
    event = new Webhook(secret).verify(payload, headers) as ClerkEvent;
  } catch (error) {
    console.error("[clerk:webhook] signature verification failed", error);
    return Response.json(
      { code: "VALIDATION", message: "Invalid signature." },
      { status: 400 },
    );
  }

  const clerkUserId = event.data.id;
  if (!clerkUserId) return Response.json({ received: true });

  try {
    switch (event.type) {
      case "user.deleted": {
        await sql()`
          UPDATE profiles
             SET deleted_at = COALESCE(deleted_at, now()), updated_at = now()
           WHERE clerk_user_id = ${clerkUserId}
        `;
        await sql()`
          INSERT INTO deletion_queue (subject_type, subject_id, reason)
          VALUES ('clerk_user', ${clerkUserId}, 'clerk_user_deleted')
        `;
        break;
      }
      case "user.created":
      case "user.updated": {
        const primary = event.data.email_addresses?.find(
          (entry) => entry.id === event.data.primary_email_address_id,
        );
        const email =
          primary?.email_address ?? event.data.email_addresses?.[0]?.email_address;
        if (email) {
          await sql()`
            INSERT INTO profiles (clerk_user_id, email, first_name)
            VALUES (${clerkUserId}, ${email.toLowerCase()}, ${event.data.first_name ?? ""})
            ON CONFLICT (clerk_user_id) DO UPDATE
              SET email = EXCLUDED.email, updated_at = now()
          `;
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`[clerk:webhook] handler failed for ${event.type}`, error);
    return Response.json({ received: false }, { status: 500 });
  }

  return Response.json({ received: true });
}
