import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import * as jose from "https://deno.land/x/jose@v5.2.2/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "indranilgamer@gmail.com";
  const JWT_SECRET = Deno.env.get("SUPABASE_JWT_SECRET") || "super-secret-jwt-token-with-at-least-32-characters-long";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    return jsonResponse({ error: "Invalid form data" }, 400);
  }

  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString().trim();
  const phone = formData.get("phone")?.toString().trim();
  const dob = formData.get("dob")?.toString().trim();
  const gender = formData.get("gender")?.toString().trim();
  const address = formData.get("address")?.toString().trim();
  const idType = formData.get("id_type")?.toString().trim();
  const idNumber = formData.get("id_number")?.toString().trim();
  const qualification = formData.get("qualification")?.toString().trim();
  const experienceYears = parseInt(formData.get("experience_years")?.toString() || "0", 10);
  const motivation = formData.get("motivation")?.toString().trim();
  const languagesStr = formData.get("languages")?.toString() || "[]";
  const specializationStr = formData.get("specialization")?.toString() || "[]";
  
  const idProofFile = formData.get("id_proof") as File | null;

  if (!email || !password || !fullName || !idProofFile) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Create User
  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Bypass standard verification
    user_metadata: { full_name: fullName },
  });

  if (userErr || !userData.user) {
    return jsonResponse({ error: userErr?.message || "Could not create user" }, 400);
  }
  const newUserId = userData.user.id;

  // 2. Upload ID Proof
  const fileExt = idProofFile.name.split('.').pop();
  const filePath = `${newUserId}/id_proof.${fileExt}`;
  
  const { error: uploadErr } = await admin.storage
    .from('agent-documents')
    .upload(filePath, idProofFile, {
      contentType: idProofFile.type,
      upsert: true,
    });

  if (uploadErr) {
    await admin.auth.admin.deleteUser(newUserId);
    return jsonResponse({ error: "Failed to upload ID proof: " + uploadErr.message }, 400);
  }

  // Get signed URL for the admin to view
  const { data: urlData } = await admin.storage.from('agent-documents').createSignedUrl(filePath, 7 * 24 * 60 * 60);
  const idProofUrl = urlData?.signedUrl || "";

  // 3. Insert Agent Row
  let languages = [];
  let specialization = [];
  try { languages = JSON.parse(languagesStr); } catch(e) {}
  try { specialization = JSON.parse(specializationStr); } catch(e) {}

  const { data: agentRow, error: agentErr } = await admin
    .from("agents")
    .insert({
      auth_user_id: newUserId,
      full_name: fullName,
      email,
      phone,
      dob,
      gender,
      address,
      id_type: idType,
      id_number: idNumber,
      qualification,
      experience_years: experienceYears,
      motivation,
      languages,
      specialization,
      id_proof_url: filePath,
      is_approved: false,
      is_active: true,
    })
    .select()
    .single();

  if (agentErr || !agentRow) {
    await admin.storage.from('agent-documents').remove([filePath]);
    await admin.auth.admin.deleteUser(newUserId);
    return jsonResponse({ error: agentErr?.message || "Could not create agent row" }, 400);
  }

  // 4. Update App Metadata
  const { error: metaErr } = await admin.auth.admin.updateUserById(newUserId, {
    app_metadata: { role: "agent", agent_id: agentRow.id },
  });

  if (metaErr) {
    await admin.from("agents").delete().eq("id", agentRow.id);
    await admin.storage.from('agent-documents').remove([filePath]);
    await admin.auth.admin.deleteUser(newUserId);
    return jsonResponse({ error: metaErr.message }, 400);
  }

  // 5. Send Email to Admin
  if (RESEND_API_KEY) {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const alg = 'HS256';
    
    const approveToken = await new jose.SignJWT({ agent_id: agentRow.id, auth_id: newUserId, action: 'approve' })
      .setProtectedHeader({ alg })
      .setExpirationTime('7d')
      .sign(secret);

    const rejectToken = await new jose.SignJWT({ agent_id: agentRow.id, auth_id: newUserId, action: 'reject' })
      .setProtectedHeader({ alg })
      .setExpirationTime('7d')
      .sign(secret);

    // Get the origin URL for the links. In production, this should ideally be an env var.
    // For now, we'll try to guess it from the request or use a placeholder.
    // In Edge functions, req.url is the edge function URL. We'll use the origin of the edge function.
    const url = new URL(req.url);
    const approveUrl = `${url.origin}/admin-approve?token=${approveToken}`;
    const rejectUrl = `${url.origin}/admin-approve?token=${rejectToken}`;

    const emailHtml = `
      <h2>New Agent Application Pending Review</h2>
      <p>A new agent has applied to join WelfareConnect. Please review the details below.</p>
      <h3>Personal Details</h3>
      <ul>
        <li><strong>Name:</strong> ${fullName}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Phone:</strong> ${phone}</li>
        <li><strong>DOB:</strong> ${dob}</li>
        <li><strong>Gender:</strong> ${gender}</li>
        <li><strong>Address:</strong> ${address}</li>
      </ul>
      <h3>Identity Verification</h3>
      <ul>
        <li><strong>ID Type:</strong> ${idType}</li>
        <li><strong>ID Number:</strong> ${idNumber}</li>
        <li><strong>ID Proof:</strong> <a href="${idProofUrl}">View attached document</a></li>
      </ul>
      <h3>Professional Details</h3>
      <ul>
        <li><strong>Qualification:</strong> ${qualification}</li>
        <li><strong>Languages:</strong> ${languages.join(', ')}</li>
        <li><strong>Areas of Expertise:</strong> ${specialization.join(', ')}</li>
        <li><strong>Years of Experience:</strong> ${experienceYears}</li>
      </ul>
      <h3>Motivation</h3>
      <p>${motivation}</p>
      <hr />
      <div style="margin-top: 20px;">
        <a href="${approveUrl}" style="background-color: #16A34A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">✓ Approve Agent</a>
        <a href="${rejectUrl}" style="background-color: #DC2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">✗ Reject Application</a>
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
          to: ADMIN_EMAIL,
          subject: `New Agent Application — ${fullName}`,
          html: emailHtml
        })
      });
    } catch (err) {
      console.error("Failed to send email to admin:", err);
      // We don't fail the registration if email fails, but it's bad.
    }
  }

  return jsonResponse({ ok: true }, 200);
});
