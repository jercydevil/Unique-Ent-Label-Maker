// supabase/functions/pin-login/index.ts
//
// Authenticates a staff or admin member using their staff_code and numeric PIN.
// Signs a standard Supabase HS256 JWT using node:crypto and JWT_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signSupabaseJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const sHeader = base64url(Buffer.from(JSON.stringify(header)));
  const sPayload = base64url(Buffer.from(JSON.stringify(payload)));
  const key = Buffer.from(secret, "utf8");
  const signature = base64url(
    crypto.createHmac("sha256", key).update(`${sHeader}.${sPayload}`).digest()
  );
  return `${sHeader}.${sPayload}.${signature}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const rawSecret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET") || "";
    const jwtSecret = rawSecret.replace(/^["']+|["']+$/g, "").trim();

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
    }

    if (!jwtSecret) {
      return json({ error: "Missing JWT_SECRET configuration" }, 500);
    }

    const { staff_code, pin } = await req.json();

    if (!staff_code || !pin) {
      return json({ error: "staff_code and pin are required" }, 400);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Verify credentials in Postgres via verify_staff_pin
    const { data: rows, error: rpcErr } = await supabaseAdmin.rpc("verify_staff_pin", {
      p_staff_code: String(staff_code).trim(),
      p_pin: String(pin).trim(),
    });

    if (rpcErr) {
      console.error("RPC error:", rpcErr);
      return json({ error: `Database error: ${rpcErr.message}` }, 500);
    }

    if (!rows || rows.length === 0) {
      return json({ error: "Invalid staff code or PIN" }, 401);
    }

    const staff = rows[0];
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + 7 * 24 * 60 * 60; // 7 days expiration

    const payload = {
      aud: "authenticated",
      role: "authenticated",
      iss: "supabase",
      iat: nowSec,
      exp: expSec,
      sub: staff.auth_user_id,
      email: `${staff.staff_code}@staff.internal.invalid`,
      app_metadata: {
        provider: "email",
        providers: ["email"],
        role: staff.role,
      },
      user_metadata: {
        staff_id: staff.staff_id,
        staff_code: staff.staff_code,
        display_name: staff.display_name,
        role: staff.role,
      },
    };

    const token = signSupabaseJwt(payload, jwtSecret);

    return json({
      access_token: token,
      token_type: "bearer",
      expires_in: 7 * 24 * 60 * 60,
      expires_at: expSec,
      user: {
        id: staff.auth_user_id,
        staff_id: staff.staff_id,
        staff_code: staff.staff_code,
        display_name: staff.display_name,
        role: staff.role,
      },
    });
  } catch (err: any) {
    console.error("Login exception:", err);
    return json({ error: err?.message || String(err) }, 500);
  }
});
