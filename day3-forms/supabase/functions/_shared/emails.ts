// Email HTML templates. Dark/gold editorial to match the site.
// Each builder takes the recipient's name + the magic links.

const shell = (title: string, body: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;color:#f6f1e6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000">
    <tr><td align="center" style="padding:48px 24px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:linear-gradient(160deg,#161208,#0a0a0a);border:1px solid rgba(246,241,230,0.06);border-radius:18px">
        <tr><td style="padding:42px 42px 38px">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:300;letter-spacing:-0.02em;color:#E6B979;font-style:italic;margin-bottom:32px">Tester<span style="color:#E6B979">.io</span></div>
          ${body}
          <div style="margin-top:40px;padding-top:24px;border-top:1px solid rgba(246,241,230,0.06);font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6a6a6a">
            Tester.io &middot; QA, automated
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#E6B979,#C6A559);color:#0c0700;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase">${label}</a>`;

const linkLine = (href: string, label: string) =>
  `<a href="${href}" style="color:#9a9388;text-decoration:underline;font-size:11px;letter-spacing:0.18em;text-transform:uppercase">${label}</a>`;

export const welcomeEmail = (name: string, replyUrl: string, unsubUrl: string) => ({
  subject: "Thanks for reaching out — quick question for you",
  html: shell("Thanks for reaching out", `
    <h1 style="font-family:Georgia,serif;font-size:34px;font-weight:300;line-height:1.15;letter-spacing:-0.025em;margin:0 0 18px">Hey ${name} —</h1>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 18px">Got your note. A real engineer on the Tester.io team will read it and reply within one business day.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 28px">In the meantime — curious what made you reach out today? The more we know about what you're shipping, the faster we can route you to the right person.</p>
    <div style="margin:0 0 28px">${btn(replyUrl, "Yes, I'd like to chat →")}</div>
    <p style="font-size:13px;line-height:1.7;color:#8a8a8a;margin:0 0 8px">P.S. We'll send a couple of useful follow-ups over the next two weeks (testimonials, product updates). One click below opts you out anytime.</p>
    <div>${linkLine(unsubUrl, "Unsubscribe")}</div>
  `),
});

export const followup1Value = (name: string, replyUrl: string, unsubUrl: string) => ({
  subject: "Why teams trust Tester.io with every release",
  html: shell("Why teams love Tester.io", `
    <h1 style="font-family:Georgia,serif;font-size:30px;font-weight:300;line-height:1.2;letter-spacing:-0.025em;margin:0 0 18px">${name}, a quick note —</h1>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 18px">Most QA platforms tell you a test failed. Tester.io tells you <em>which diff caused the failure</em> and replays it — every time, on every commit.</p>
    <ul style="font-size:14.5px;line-height:1.85;color:#b8b2a4;padding-left:18px;margin:0 0 24px">
      <li>End-to-end runs in under 2 minutes (median)</li>
      <li>Flake-adjusted pass rate so green = actually green</li>
      <li>One pane for E2E, integration, visual, and contract suites</li>
    </ul>
    <div style="margin:0 0 28px">${btn(replyUrl, "I'm interested — let's chat →")}</div>
    <div>${linkLine(unsubUrl, "Unsubscribe")}</div>
  `),
});

export const followup2Testimonial = (name: string, replyUrl: string, unsubUrl: string) => ({
  subject: "How one team cut flake rate by 80%",
  html: shell("Customer story", `
    <h1 style="font-family:Georgia,serif;font-size:30px;font-weight:300;line-height:1.2;letter-spacing:-0.025em;margin:0 0 22px">From a customer last quarter:</h1>
    <blockquote style="border-left:2px solid #E6B979;padding-left:20px;margin:0 0 22px;font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.55;color:#f6f1e6">
      "We dropped from 14% flake rate to under 3% in six weeks. Our deploy frequency doubled because the team finally trusted the test signal."
    </blockquote>
    <p style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#9a9388;margin:0 0 28px">— Engineering Lead, Series B fintech</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 28px">${name} — if any of that resonates, happy to walk through how it'd apply to your stack.</p>
    <div style="margin:0 0 28px">${btn(replyUrl, "Let's talk →")}</div>
    <div>${linkLine(unsubUrl, "Unsubscribe")}</div>
  `),
});

// 5 cycling newsletters
export const newsletter1 = (name: string, unsubUrl: string) => ({
  subject: "01 / Field Notes — flake hunting in 2026",
  html: shell("Field Notes 01", `
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#E6B979;margin-bottom:14px">Issue 01 &middot; Field Notes</div>
    <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:300;line-height:1.15;letter-spacing:-0.025em;margin:0 0 18px">The flake-hunting playbook</h1>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px">Hey ${name} — quick read on the three patterns we see most often when teams have a "trustworthy CI" problem.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px"><strong style="color:#E6B979">1. Hidden waits.</strong> setTimeout(2000) hides a race condition. Replace with explicit waits-for-condition.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px"><strong style="color:#E6B979">2. Shared fixtures.</strong> Two tests touch the same row in DB; second one runs after the first cleans up. Isolate state per test.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 24px"><strong style="color:#E6B979">3. Network jitter.</strong> External APIs in test paths. Stub at the network layer, not the function layer.</p>
    <div>${linkLine(unsubUrl, "Unsubscribe")}</div>
  `),
});

export const newsletter2 = (name: string, unsubUrl: string) => ({
  subject: "02 / Field Notes — the 'green CI, broken prod' problem",
  html: shell("Field Notes 02", `
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#E6B979;margin-bottom:14px">Issue 02 &middot; Field Notes</div>
    <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:300;line-height:1.15;letter-spacing:-0.025em;margin:0 0 18px">When green CI lies</h1>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px">${name} — every team gets a "CI was green but prod is on fire" story eventually. Three usual suspects:</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px"><strong style="color:#E6B979">Environmental drift.</strong> Test DB has more lenient constraints than prod. Lock them down with the same migrations.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px"><strong style="color:#E6B979">Implicit caching.</strong> Tests warm a cache that prod's first request can't. Add a "cold start" test variant.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 24px"><strong style="color:#E6B979">Feature-flag skew.</strong> CI runs all flags on; prod ships them dark. Test both states explicitly.</p>
    <div>${linkLine(unsubUrl, "Unsubscribe")}</div>
  `),
});

export const newsletter3 = (name: string, unsubUrl: string) => ({
  subject: "03 / Field Notes — the test pyramid is dead",
  html: shell("Field Notes 03", `
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#E6B979;margin-bottom:14px">Issue 03 &middot; Field Notes</div>
    <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:300;line-height:1.15;letter-spacing:-0.025em;margin:0 0 18px">RIP test pyramid (1999—2024)</h1>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px">${name} — the classic pyramid (lots of unit, fewer integration, tiny e2e) was right for a slower-CI era. Modern infra changed the math.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px">Parallel cloud runners + fast browsers mean <strong style="color:#E6B979">end-to-end is cheap now</strong>. The bottleneck isn't runtime — it's confidence per test.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px">The honeycomb model wins: lots of integration tests, a thick band of e2e on user journeys, unit tests only where logic is genuinely complex.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 24px">Optimize for "this test would catch a real bug" — not "this test runs in 3ms."</p>
    <div>${linkLine(unsubUrl, "Unsubscribe")}</div>
  `),
});

export const newsletter4 = (name: string, unsubUrl: string) => ({
  subject: "04 / Field Notes — visual regression without the noise",
  html: shell("Field Notes 04", `
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#E6B979;margin-bottom:14px">Issue 04 &middot; Field Notes</div>
    <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:300;line-height:1.15;letter-spacing:-0.025em;margin:0 0 18px">Visual diffs that don't cry wolf</h1>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px">${name} — most visual regression setups fail because they alert on a 2-pixel font-rendering shift. Three ways to fix the noise:</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px"><strong style="color:#E6B979">Mask the dynamic.</strong> Timestamps, avatars, cursor blinks — ignore-regions, not threshold-tuning.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px"><strong style="color:#E6B979">Fix the fonts.</strong> Self-host the test fonts; never let Google Fonts cache state leak in.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 24px"><strong style="color:#E6B979">Perceptual diff.</strong> Pixel-exact is the wrong target; humans don't perceive that way. SSIM beats pixel-match.</p>
    <div>${linkLine(unsubUrl, "Unsubscribe")}</div>
  `),
});

export const newsletter5 = (name: string, unsubUrl: string) => ({
  subject: "05 / Field Notes — what 'shift left' actually means in 2026",
  html: shell("Field Notes 05", `
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#E6B979;margin-bottom:14px">Issue 05 &middot; Field Notes</div>
    <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:300;line-height:1.15;letter-spacing:-0.025em;margin:0 0 18px">"Shift left" without the buzzword</h1>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px">${name} — "shift left" got hollowed out by 2018. Here's what it actually means when done well:</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px"><strong style="color:#E6B979">Pre-commit, not pre-merge.</strong> Surface the problem on the developer's machine, not in PR review.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px"><strong style="color:#E6B979">Types over tests for the boring stuff.</strong> A discriminated union catches 100% of "did you handle this case" bugs at edit time.</p>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 24px"><strong style="color:#E6B979">Production telemetry as the lowest test.</strong> Real users are your most expensive but most accurate test suite. Sample them.</p>
    <div>${linkLine(unsubUrl, "Unsubscribe")}</div>
  `),
});

export const followup3Update = (name: string, replyUrl: string, unsubUrl: string) => ({
  subject: "What's new at Tester.io this month",
  html: shell("Product update", `
    <h1 style="font-family:Georgia,serif;font-size:30px;font-weight:300;line-height:1.2;letter-spacing:-0.025em;margin:0 0 18px">${name} — a short product update</h1>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 16px">A few things shipped recently that might be relevant:</p>
    <ul style="font-size:14.5px;line-height:1.85;color:#b8b2a4;padding-left:18px;margin:0 0 24px">
      <li><strong style="color:#E6B979">Visual diff v2</strong> — pixel-perfect cross-browser comparison with AI-assisted ignore regions</li>
      <li><strong style="color:#E6B979">Auto-retry for flake</strong> — runs are reattempted up to 3x with full traceback, scored against the diff</li>
      <li><strong style="color:#E6B979">Slack/Linear sync</strong> — failing tests open issues automatically, close themselves on green</li>
    </ul>
    <p style="font-size:15px;line-height:1.7;color:#b8b2a4;margin:0 0 28px">This is my last note for now. If any of this is useful, just hit reply or click below — otherwise, all the best with your shipping.</p>
    <div style="margin:0 0 28px">${btn(replyUrl, "Yes, let's chat →")}</div>
    <div>${linkLine(unsubUrl, "Unsubscribe")}</div>
  `),
});
