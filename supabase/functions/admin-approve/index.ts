import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import * as jose from "https://deno.land/x/jose@v5.2.2/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return htmlResponse("Method not allowed", 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const JWT_SECRET = Deno.env.get("MY_JWT_SECRET") || "super-secret-jwt-token-with-at-least-32-characters-long";
  const APP_URL = Deno.env.get("APP_URL") || "https://paradox-welfare.vercel.app";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return htmlResponse("<h1>Server misconfigured</h1>", 500);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return htmlResponse("<h1>Missing token</h1>", 400);
  }

  let payload;
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload: decoded } = await jose.jwtVerify(token, secret);
    payload = decoded as { agent_id: string; auth_id: string; action: 'approve' | 'reject' };
  } catch (err) {
    return htmlResponse("<h1>Invalid or expired token</h1>", 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: agentData, error: agentErr } = await admin
    .from("agents")
    .select("id, full_name, email")
    .eq("id", payload.agent_id)
    .single();

  if (agentErr || !agentData) {
    return htmlResponse("<h1>Agent not found</h1>", 404);
  }

  const { action } = payload;

  if (action === "approve") {
    const { error: updateErr } = await admin
      .from("agents")
      .update({ is_approved: true })
      .eq("id", payload.agent_id);

    if (updateErr) {
      return htmlResponse(`<h1>Failed to approve agent</h1><p>${updateErr.message}</p>`, 500);
    }

    if (RESEND_API_KEY) {
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #16A34A;">Your WelfareConnect agent account has been approved! ✅</h2>
          <p>Hi ${agentData.full_name},</p>
          <p>Great news — your application to become a WelfareConnect agent has been approved!</p>
          <p>You can now log in to your agent dashboard and start helping citizens access government welfare schemes.</p>
          <div style="margin: 30px 0;">
            <a href="${APP_URL}/agent/login" style="background-color: #2E5FA3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Log in to Agent Dashboard</a>
          </div>
          <p><strong>What's next?</strong></p>
          <ul>
            <li>Complete your agent profile</li>
            <li>Review the agent guidelines and code of conduct</li>
            <li>Wait for your first citizen application notification</li>
          </ul>
          <p>Welcome to the WelfareConnect team. If you have any questions, reach out to us at support@welfareconnect.com.</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #666;">Powered by WelfareConnect</p>
        </div>
      `;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'WelfareConnect <onboarding@resend.dev>', // Change in prod
            to: agentData.email,
            subject: 'Your WelfareConnect agent account has been approved! ✅',
            html: emailHtml
          })
        });
      } catch (e) {
        console.error("Failed to send approval email", e);
      }
    }

    return htmlResponse(`
      <div style="font-family: sans-serif; max-width: 500px; margin: 50px auto; text-align: center;">
        <h1 style="color: #16A34A;">✅ Agent Approved</h1>
        <p>${agentData.full_name} has been approved and can now log in to the agent portal.</p>
      </div>
    `);
  } else if (action === "reject") {
    // Soft delete or mark as rejected. For now, let's just delete the auth user and agent row
    // so they can apply again later.
    await admin.from("agents").delete().eq("id", payload.agent_id);
    await admin.auth.admin.deleteUser(payload.auth_id);

    if (RESEND_API_KEY) {
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Update on your WelfareConnect agent application</h2>
          <p>Hi ${agentData.full_name},</p>
          <p>Thank you for your interest in becoming a WelfareConnect agent.</p>
          <p>Unfortunately, after carefully reviewing your application, we are unable to approve your account at this time.</p>
          <p>You are welcome to re-apply after 30 days if your circumstances change.</p>
          <p>Best regards,<br>The WelfareConnect Team</p>
        </div>
      `;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'WelfareConnect <onboarding@resend.dev>',
            to: agentData.email,
            subject: 'Update on your WelfareConnect agent application',
            html: emailHtml
          })
        });
      } catch (e) {
        console.error("Failed to send rejection email", e);
      }
    }

    return htmlResponse(`
      <div style="font-family: sans-serif; max-width: 500px; margin: 50px auto; text-align: center;">
        <h1 style="color: #DC2626;">❌ Application Rejected</h1>
        <p>${agentData.full_name}'s application has been rejected and their pending account was deleted.</p>
      </div>
    `);
  }

  return htmlResponse("<h1>Invalid action</h1>", 400);
});
