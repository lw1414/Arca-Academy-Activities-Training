// Called daily by pg_cron. Sends due follow-ups (max 3 per row, every 5 days).
// Requires header: x-cron-secret = MAGIC_LINK_SECRET (poor-man's auth)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sign } from "../_shared/token.ts";
import { followup1Value, followup2Testimonial, followup3Update } from "../_shared/emails.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const builders = [followup1Value, followup2Testimonial, followup3Update];

Deno.serve(async (req) => {
  // crude auth so randos can't trigger sends
  const secret = Deno.env.get("MAGIC_LINK_SECRET")!;
  if (req.headers.get("x-cron-secret") !== secret) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("form_submissions")
    .select("id,name,email,followup_count,last_followup,created_at")
    .eq("reply_status", "no_reply")
    .eq("newsletter", true)
    .lt("followup_count", 3)
    .lt("created_at", fiveDaysAgo)
    .or(`last_followup.is.null,last_followup.lt.${fiveDaysAgo}`)
    .limit(50);

  if (error) return json({ error: "query_failed", detail: error.message }, 500);
  if (!rows || rows.length === 0) return json({ ok: true, sent: 0 });

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const from = Deno.env.get("RESEND_FROM_EMAIL")!;
  const testTo = Deno.env.get("RESEND_TEST_TO_EMAIL")!;
  const apiKey = Deno.env.get("RESEND_API_KEY")!;

  let sent = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const count = row.followup_count ?? 0;
    const builder = builders[count];
    if (!builder) continue;

    const firstName = (row.name as string).split(" ")[0];
    const replyToken = await sign(row.id as string, "reply", secret);
    const unsubToken = await sign(row.id as string, "unsubscribe", secret);
    const replyUrl = `${supaUrl}/functions/v1/reply?id=${row.id}&token=${replyToken}`;
    const unsubUrl = `${supaUrl}/functions/v1/unsubscribe?id=${row.id}&token=${unsubToken}`;

    const { subject, html } = builder(firstName, replyUrl, unsubUrl);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [testTo], subject, html, reply_to: testTo }),
    });
    if (!r.ok) { errors.push(`${row.id}: ${await r.text()}`); continue; }

    const newCount = count + 1;
    const update: Record<string, unknown> = {
      followup_count: newCount,
      last_followup: new Date().toISOString(),
    };
    if (newCount >= 3) update.reply_status = "exhausted";

    const { error: upErr } = await supabase
      .from("form_submissions").update(update).eq("id", row.id);
    if (upErr) errors.push(`${row.id} update: ${upErr.message}`);
    else sent += 1;
  }

  return json({ ok: true, sent, errors });
});
