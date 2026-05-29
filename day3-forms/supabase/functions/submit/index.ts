// POST /functions/v1/submit
// body: { name, email, message }
// 1) inserts into form_submissions
// 2) sends Resend welcome email with magic links

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sign } from "../_shared/token.ts";
import { welcomeEmail } from "../_shared/emails.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { name?: string; email?: string; message?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const message = (body.message ?? "").trim();
  if (!name || name.length > 120) return json({ error: "invalid_name" }, 400);
  if (!emailRe.test(email) || email.length > 200) return json({ error: "invalid_email" }, 400);
  if (!message || message.length > 2000) return json({ error: "invalid_message" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("form_submissions")
    .insert({ name, email, message })
    .select("id")
    .single();
  if (error) return json({ error: "insert_failed", detail: error.message }, 500);

  const id = data.id as string;
  const secret = Deno.env.get("MAGIC_LINK_SECRET")!;
  const supaUrl = Deno.env.get("SUPABASE_URL")!;

  const replyToken = await sign(id, "reply", secret);
  const unsubToken = await sign(id, "unsubscribe", secret);
  const replyUrl = `${supaUrl}/functions/v1/reply?id=${id}&token=${replyToken}`;
  const unsubUrl = `${supaUrl}/functions/v1/unsubscribe?id=${id}&token=${unsubToken}`;

  const testTo = Deno.env.get("RESEND_TEST_TO_EMAIL")!;
  const from = Deno.env.get("RESEND_FROM_EMAIL")!;
  const { subject, html } = welcomeEmail(name.split(" ")[0], replyUrl, unsubUrl);

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [testTo], subject, html, reply_to: testTo }),
  });

  // best-effort: record this send attempt in email_log so the dashboard sees it
  const logRow = {
    to_email: testTo,
    subject,
    body_html: html,
    source: "submit_welcome",
    status: r.ok ? "sent" : "failed",
    error: r.ok ? null : await r.clone().text(),
    related_id: id,
  };
  try { await supabase.from("email_log").insert(logRow); } catch (_) { /* table may not exist */ }

  if (!r.ok) {
    const detail = logRow.error;
    return json({ ok: true, id, email_warning: detail });
  }

  return json({ ok: true, id });
});
