// Sends the next newsletter (cycles 1..5 via modulo) to every subscribed row.
// Header: x-cron-secret = MAGIC_LINK_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sign } from "../_shared/token.ts";
import {
  newsletter1, newsletter2, newsletter3, newsletter4, newsletter5,
} from "../_shared/emails.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const builders = [newsletter1, newsletter2, newsletter3, newsletter4, newsletter5];

Deno.serve(async (req) => {
  const secret = Deno.env.get("MAGIC_LINK_SECRET")!;
  if (req.headers.get("x-cron-secret") !== secret) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rows, error } = await supabase
    .from("form_submissions")
    .select("id,name,newsletter_count")
    .eq("newsletter", true)
    .limit(100);

  if (error) return json({ error: "query_failed", detail: error.message }, 500);
  if (!rows || rows.length === 0) return json({ ok: true, sent: 0 });

  const from = Deno.env.get("RESEND_FROM_EMAIL")!;
  const testTo = Deno.env.get("RESEND_TEST_TO_EMAIL")!;
  const apiKey = Deno.env.get("RESEND_API_KEY")!;
  const supaUrl = Deno.env.get("SUPABASE_URL")!;

  let sent = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const count = row.newsletter_count ?? 0;
    const idx = count % 5;
    const builder = builders[idx];
    const firstName = (row.name as string).split(" ")[0];
    const unsubToken = await sign(row.id as string, "unsubscribe", secret);
    const unsubUrl = `${supaUrl}/functions/v1/unsubscribe?id=${row.id}&token=${unsubToken}`;

    const { subject, html } = builder(firstName, unsubUrl);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [testTo], subject, html, reply_to: testTo }),
    });
    if (!r.ok) { errors.push(`${row.id}: ${await r.text()}`); continue; }

    const { error: upErr } = await supabase
      .from("form_submissions")
      .update({ newsletter_count: count + 1, last_newsletter: new Date().toISOString() })
      .eq("id", row.id);
    if (upErr) errors.push(`${row.id} update: ${upErr.message}`);
    else sent += 1;
  }

  return json({ ok: true, sent, errors, issue: (rows[0].newsletter_count ?? 0) % 5 + 1 });
});
