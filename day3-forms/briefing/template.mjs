// Email-safe HTML template for the morning briefing.
// Uses inline styles + table layout because Gmail/Outlook strip most modern CSS.
// Matches the Tester.io gold/serif brand language.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const fmtWhen = (iso, tz) => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz, dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(iso));
  } catch { return new Date(iso).toLocaleString(); }
};

const fmtDate = (d, tz) => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }).format(d);
  } catch { return d.toDateString(); }
};

export function renderEmail({
  headline = 'Your morning briefing',
  generated_at = new Date(),
  tz = 'UTC',
  total = 0,
  top_picks = [],     // [{ name, email, company, why }]
  notable_companies = [],
  all_leads = [],     // [{ name, email, company, created_at }]
  cta_url = 'http://localhost:3000/dashboard.html',
  brand = { name: 'Tester.io', tagline: 'Testing that moves with your release' },
} = {}) {
  const dateLabel = fmtDate(new Date(generated_at), tz);
  const picksHtml = top_picks.length ? top_picks.map((p, i) => `
    <tr>
      <td style="vertical-align:top;padding:0 14px 0 0;width:32px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#C6A559;letter-spacing:0.08em;padding-top:4px">0${i + 1}</td>
      <td style="vertical-align:top;padding-bottom:18px">
        <div style="font-family:'Fraunces','Times New Roman',serif;font-weight:500;font-size:18px;letter-spacing:-0.01em;color:#0c0700;margin:0 0 2px">${esc(p.name || 'Unknown')}${p.company ? ` <span style="font-style:italic;color:#a59c83">— ${esc(p.company)}</span>` : ''}</div>
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#7a7468;margin-bottom:6px">${esc(p.email || '')}</div>
        <div style="font-family:'Montserrat',system-ui,sans-serif;font-size:13.5px;line-height:1.6;color:#3a352a">${esc(p.why || '')}</div>
      </td>
    </tr>`).join('') : `
    <tr><td style="padding:18px 0;color:#a59c83;font-style:italic;font-family:'Fraunces',serif;font-size:15px">No standout signals today — the suite caught up.</td></tr>`;

  const allHtml = all_leads.length ? all_leads.map(l => `
    <tr>
      <td style="padding:9px 14px 9px 0;font-family:'Montserrat',system-ui,sans-serif;font-size:13px;color:#0c0700;border-bottom:1px solid #ece8dc">${esc(l.name || '')}</td>
      <td style="padding:9px 14px 9px 0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#5a5448;border-bottom:1px solid #ece8dc">${esc(l.email || '')}</td>
      <td style="padding:9px 14px 9px 0;font-family:'Montserrat',system-ui,sans-serif;font-size:12px;color:#7a7468;border-bottom:1px solid #ece8dc">${esc(l.company || '')}</td>
      <td style="padding:9px 0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#a59c83;border-bottom:1px solid #ece8dc;white-space:nowrap;text-align:right">${esc(fmtWhen(l.created_at, tz))}</td>
    </tr>`).join('') : '';

  const companyChips = notable_companies.slice(0, 8).map(c => `
    <span style="display:inline-block;padding:4px 10px;border:1px solid rgba(198,165,89,0.4);border-radius:999px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#8a6f33;background:rgba(230,185,121,0.08);margin:0 6px 6px 0">${esc(c)}</span>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${esc(headline)} — ${esc(brand.name)}</title>
</head>
<body style="margin:0;padding:0;background:#f4efe2;font-family:'Montserrat',system-ui,sans-serif;color:#0c0700;-webkit-font-smoothing:antialiased">

<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(headline)} · ${total} signups · ${esc(dateLabel)}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4efe2;padding:36px 16px">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;background:#fffaf0;border-radius:18px;border:1px solid #ece2c8;overflow:hidden;box-shadow:0 24px 60px -28px rgba(198,165,89,0.35)">

      <!-- Banner -->
      <tr><td style="background:#000;padding:32px 36px;color:#f6f1e6">
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:0.28em;text-transform:uppercase;color:#E6B979">Morning briefing · ${esc(dateLabel)}</div>
        <div style="font-family:'Fraunces','Times New Roman',serif;font-weight:400;font-size:32px;line-height:1.1;letter-spacing:-0.02em;margin-top:10px;color:#f6f1e6">${esc(headline)}</div>
      </td></tr>

      <!-- Counters -->
      <tr><td style="padding:26px 36px 4px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:top;padding-right:24px;width:33%">
              <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:0.18em;text-transform:uppercase;color:#a59c83">New signups · 24h</div>
              <div style="font-family:'Fraunces',serif;font-weight:500;font-size:34px;color:#0c0700;line-height:1;margin-top:6px">${total}</div>
            </td>
            <td style="vertical-align:top;padding-right:24px;width:33%">
              <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:0.18em;text-transform:uppercase;color:#a59c83">Top picks</div>
              <div style="font-family:'Fraunces',serif;font-weight:500;font-size:34px;color:#0c0700;line-height:1;margin-top:6px">${top_picks.length}</div>
            </td>
            <td style="vertical-align:top;width:33%">
              <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:0.18em;text-transform:uppercase;color:#a59c83">Notable companies</div>
              <div style="font-family:'Fraunces',serif;font-weight:500;font-size:34px;color:#0c0700;line-height:1;margin-top:6px">${notable_companies.length}</div>
            </td>
          </tr>
        </table>
      </td></tr>

      ${companyChips ? `<tr><td style="padding:18px 36px 4px">${companyChips}</td></tr>` : ''}

      <!-- Top picks -->
      <tr><td style="padding:26px 36px 8px">
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:0.22em;text-transform:uppercase;color:#C6A559;margin-bottom:14px">— Today's top picks</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${picksHtml}</table>
      </td></tr>

      ${all_leads.length ? `
      <!-- All leads table -->
      <tr><td style="padding:18px 36px 8px">
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:0.22em;text-transform:uppercase;color:#a59c83;margin-bottom:10px">— All signups · last 24h (${all_leads.length})</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${allHtml}</table>
      </td></tr>` : ''}

      <!-- CTA -->
      <tr><td align="center" style="padding:28px 36px 36px">
        <a href="${esc(cta_url)}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:#0c0700;color:#E6B979;font-family:'Montserrat',system-ui,sans-serif;font-weight:500;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;text-decoration:none">Open dashboard →</a>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f6f1e6;padding:18px 36px;border-top:1px solid #ece2c8">
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:0.18em;text-transform:uppercase;color:#a59c83">
          ${esc(brand.name)} · ${esc(brand.tagline)}
        </div>
        <div style="font-family:'Montserrat',system-ui,sans-serif;font-size:11px;color:#a59c83;margin-top:6px">
          Generated by <span style="font-family:'JetBrains Mono',ui-monospace,monospace">morning-briefing.mjs</span> at ${esc(fmtWhen(generated_at, tz))} (${esc(tz)}).
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>

</body>
</html>`;
}
