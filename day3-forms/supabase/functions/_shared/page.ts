// Shared styled HTML page for reply/unsubscribe confirmations.
// Editorial dark/gold aesthetic matching the rest of Tester.io.

type Opts = {
  title: string;
  eyebrow: string;
  heading: string;
  message: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
  variant?: "success" | "neutral" | "error";
};

const COLORS = {
  success: { dot: "#5dd06a", glow: "rgba(93,208,106,0.55)" },
  neutral: { dot: "#E6B979", glow: "rgba(230,185,121,0.55)" },
  error:   { dot: "#ff8a8a", glow: "rgba(255,138,138,0.55)" },
};

export function page({ title, eyebrow, heading, message, primary, secondary, variant = "success" }: Opts): Response {
  const c = COLORS[variant];
  const body = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Montserrat:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#000;--ink:#f6f1e6;--muted:#9a9388;--hair:rgba(246,241,230,0.06);
    --gold-1:#C6A559;--gold-2:#E6B979;
    --gold-gradient:linear-gradient(135deg,#E6B979,#C6A559);
    --serif:'Fraunces','Times New Roman',serif;
    --sans:'Montserrat',system-ui,sans-serif;
    --mono:'JetBrains Mono',ui-monospace,monospace;
    --status-dot:${c.dot};
    --status-glow:${c.glow};
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-weight:300;-webkit-font-smoothing:antialiased;min-height:100vh}
  body{
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:60px 24px;position:relative;overflow:hidden;text-align:center;
    background:
      radial-gradient(900px 700px at 50% 28%, rgba(198,165,89,0.13), transparent 60%),
      radial-gradient(700px 500px at 50% 92%, rgba(230,185,121,0.06), transparent 70%),
      #000;
  }
  body::before{
    content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.05;mix-blend-mode:overlay;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  }
  body::after{
    content:"";position:fixed;left:0;right:0;top:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(230,185,121,0.35),transparent);
    z-index:1;
  }
  .card{position:relative;z-index:2;max-width:560px;width:100%}
  .brand{
    font-family:var(--serif);font-style:italic;font-weight:500;font-size:22px;letter-spacing:-0.02em;
    color:var(--ink);margin-bottom:48px;display:inline-flex;align-items:center;gap:8px;
  }
  .brand .tld{
    background:var(--gold-gradient);-webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 0 8px rgba(230,185,121,0.55));
  }
  .eyebrow{
    display:inline-flex;align-items:center;gap:14px;
    font-family:var(--mono);font-size:10.5px;letter-spacing:0.4em;text-transform:uppercase;color:var(--gold-2);
    margin-bottom:32px;
  }
  .eyebrow::before,.eyebrow::after{content:"";width:32px;height:1px;background:var(--gold-2);opacity:.6}
  .badge{
    width:96px;height:96px;border-radius:50%;
    background:linear-gradient(135deg,var(--gold-2),var(--gold-1));
    display:inline-flex;align-items:center;justify-content:center;margin:0 auto 36px;
    box-shadow:0 0 60px var(--status-glow),inset 0 1px 0 rgba(255,255,255,0.45);
    position:relative;animation:pop .7s cubic-bezier(.2,.8,.2,1) both;
  }
  .badge::after{
    content:"";position:absolute;inset:-12px;border-radius:50%;
    border:1px solid rgba(230,185,121,0.28);animation:ping 2.6s cubic-bezier(0,0,0.2,1) infinite;
  }
  @keyframes pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes ping{0%{transform:scale(.9);opacity:.7}75%,100%{transform:scale(1.7);opacity:0}}
  .badge svg{width:44px;height:44px;color:#0c0700;z-index:2}
  h1{
    font-family:var(--serif);font-weight:300;font-size:clamp(40px,7vw,72px);
    letter-spacing:-0.03em;line-height:1;margin:0 0 22px;
  }
  h1 em{font-style:italic;background:var(--gold-gradient);-webkit-background-clip:text;background-clip:text;color:transparent}
  p.lede{
    font-size:15.5px;line-height:1.75;color:#b8b2a4;max-width:46ch;margin:0 auto 44px;font-weight:300;
  }
  .ctas{display:inline-flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-bottom:60px}
  .btn{
    font-family:var(--sans);font-size:11px;letter-spacing:0.26em;text-transform:uppercase;font-weight:500;
    padding:14px 28px;border-radius:999px;text-decoration:none;
    display:inline-flex;align-items:center;gap:10px;
    transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease;
  }
  .btn.primary{
    color:#0c0700;background:linear-gradient(135deg,var(--gold-2),var(--gold-1));
    box-shadow:0 14px 38px -12px rgba(230,185,121,0.55),inset 0 1px 0 rgba(255,255,255,0.4);
  }
  .btn.primary:hover{transform:translateY(-1px);box-shadow:0 20px 48px -12px rgba(230,185,121,0.75)}
  .btn.ghost{
    color:var(--gold-2);background:transparent;border:1px solid rgba(230,185,121,0.45);
  }
  .btn.ghost:hover{background:rgba(230,185,121,0.08);border-color:var(--gold-2)}
  .btn .arr{transition:transform .3s cubic-bezier(.2,.8,.2,1)}
  .btn:hover .arr{transform:translateX(4px)}
  .meta{
    font-family:var(--mono);font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#5a5a5a;
    display:inline-flex;gap:18px;align-items:center;
  }
  .meta i{font-style:normal;color:#3a3a3a}
  .live{display:inline-flex;align-items:center;gap:8px;color:#9adba6}
  .live::before{
    content:"";width:7px;height:7px;border-radius:50%;background:var(--status-dot);
    box-shadow:0 0 12px var(--status-glow);animation:livePulse 2.2s ease-in-out infinite;
  }
  @keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @media (max-width:560px){
    .card{padding:0 4px}
    .ctas{margin-bottom:48px}
  }
</style></head>
<body>
  <div class="card">
    <div class="brand">Tester<span class="tld">.io</span></div>
    <div class="eyebrow">${eyebrow}</div>
    <div class="badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        ${variant === "error"
          ? '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'
          : '<path d="M5 12.5l4.5 4.5L19 7"/>'}
      </svg>
    </div>
    <h1>${heading}</h1>
    <p class="lede">${message}</p>
    ${(primary || secondary) ? `<div class="ctas">
      ${primary ? `<a class="btn primary" href="${primary.href}"><span>${primary.label}</span><span class="arr">→</span></a>` : ""}
      ${secondary ? `<a class="btn ghost" href="${secondary.href}">${secondary.label}</a>` : ""}
    </div>` : ""}
    <div class="meta">
      <span class="live">Status: ${variant}</span><i>·</i>
      <span>Tester.io</span><i>·</i>
      <span>QA, automated</span>
    </div>
  </div>
</body></html>`;

  const headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(body, { status: 200, headers });
}
