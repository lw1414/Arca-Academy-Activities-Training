// GET /functions/v1/reply?id=<uuid>&token=<hmac>
// Marks the row as replied + opts into newsletter, then 302-redirects to a static page on the site.
// (Supabase Edge Functions force text/plain + sandbox CSP on responses, so we redirect to Vercel-hosted HTML.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "../_shared/token.ts";

const redirect = (url: string) =>
  new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const secret = Deno.env.get("MAGIC_LINK_SECRET")!;
  const base = Deno.env.get("APP_BASE_URL") || "https://arca-academy-activities-training-u3.vercel.app";

  if (!id || !token) return redirect(`${base}/?error=invalid_link`);

  const ok = await verify(id, "reply", token, secret);
  if (!ok) return redirect(`${base}/?error=invalid_token`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await supabase
    .from("form_submissions")
    .update({ reply_status: "replied", replied_at: new Date().toISOString(), newsletter: true })
    .eq("id", id);

  if (error) return redirect(`${base}/?error=${encodeURIComponent(error.message)}`);
  return redirect(`${base}/reply-success.html`);
});
