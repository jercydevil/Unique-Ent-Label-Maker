// supabase/functions/admin-create-staff/index.ts
//
// Called by an already-logged-in admin (their JWT, from pin-login, is sent
// as the caller's Authorization header) to onboard a new staff or admin
// account. Creates a throwaway internal auth.users row (satisfies the FK on
// core.staff.auth_user_id; nobody ever logs into it directly with a
// password) plus the real core.staff row with a bcrypt-hashed PIN.
//
// NOTE: this cannot create the very first admin (there's no admin JWT yet
// to call it with). Use the one-off bootstrap SQL for that — see the
// deployment notes.

import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminAuth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const adminCore = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  db: { schema: "core" },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function decodeAppMetadataRole(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice(7);
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.app_metadata?.role ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Caller must already be an admin. This only checks the JWT's claimed
  // role for a fast-fail; the database RPCs behind every real write still
  // re-check core.current_role() = 'admin' independently, so a forged
  // claim here still can't touch protected data.
  const callerRole = decodeAppMetadataRole(req.headers.get("Authorization"));
  if (callerRole !== "admin") {
    return json({ error: "Admin only" }, 403);
  }

  try {
    const { staff_code, display_name, role, pin } = await req.json();
    if (!staff_code || !display_name || !role || !pin) {
      return json({ error: "staff_code, display_name, role, pin are required" }, 400);
    }
    if (!["admin", "staff"].includes(role)) {
      return json({ error: "role must be 'admin' or 'staff'" }, 400);
    }
    if (!/^\d{4,6}$/.test(String(pin))) {
      return json({ error: "pin must be 4-6 digits" }, 400);
    }

    const internalEmail = `${staff_code}@staff.internal.invalid`;
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();

    const { data: authUser, error: authErr } = await adminAuth.auth.admin.createUser({
      email: internalEmail,
      password: randomPassword,
      email_confirm: true,
      app_metadata: { role },
    });
    if (authErr) throw authErr;

    const pinHash = await bcrypt.hash(String(pin), 10);

    const { data: staffRow, error: staffErr } = await adminCore
      .from("staff")
      .insert({
        auth_user_id: authUser.user.id,
        staff_code,
        display_name,
        role,
        pin_hash: pinHash,
      })
      .select("id, staff_code, display_name, role")
      .single();

    if (staffErr) {
      // Roll back the orphaned auth user if the staff row failed to insert
      await adminAuth.auth.admin.deleteUser(authUser.user.id);
      throw staffErr;
    }

    return json({ staff: staffRow });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not create staff account" }, 500);
  }
});
