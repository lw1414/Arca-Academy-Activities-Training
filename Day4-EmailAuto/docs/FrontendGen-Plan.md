# Front-End Design Concept Generator — Build Plan

## Context
This plan is a self-contained brief to hand to Claude Code inside VS Code so it can build the activity described in `Front End Design Concept Generator act.pdf`. The deliverable is a single-file web app (`Frontend.html`) that lets the user enter an Idea / Theme / Products, then generates **six homepage moodboard concepts** (2 Minimalist, 2 Contemporary, 2 Dynamic) with images produced via the **kie.ai** API. Output is moodboards — NOT a working website.

Hand this file to Claude Code and say: *"Build the activity described in this plan."*

---

## Goal
Produce **`Frontend.html`** — a single HTML file (inline CSS + JS, no build step) that:
1. Collects three inputs from the user: **Idea**, **Theme**, **Products**.
2. On **Generate Now**, builds six homepage concept descriptions (2 Minimalist, 2 Contemporary, 2 Dynamic) — each with a concept name, description, front image prompt, and back image prompt.
3. Calls **kie.ai** with each prompt to generate the front + back images.
4. Renders 6 concept cards in the page, each showing: design number, style category, concept name, description, generated images, and the saved image prompt text.
5. Provides an **Export as HTML** button on each card that downloads that card as a standalone `.html` file.
6. Persists all inputs, prompts, and generated image URLs to `localStorage` so everything survives a page refresh.

What this is NOT:
- Not a real website builder.
- Not multi-page. Single `Frontend.html`.
- Do not call Gemini or Anthropic image APIs directly — image generation goes through kie.ai only.

---

## Page Layout (single file: `Frontend.html`)

### Header
- Title text: **FrontEnd**
- Subtitle: "AI Design Concept Generator — 6 homepage moodboards across 3 style directions"

### Input panel
Three text inputs (with placeholders):
- **Idea** — e.g., "A community platform for Filipino divers to share spots and trips"
- **Theme** — e.g., "Ocean, adventure, tropical, dark teal"
- **Products** — e.g., "Hero, Community Feed, Events, Map"

Buttons:
- **Generate Now** (primary) — runs the full generation flow
- **Test API Connection** (secondary) — pings kie.ai to verify the API key works
- **Clear Saved Data** (tertiary, with confirm) — wipes `localStorage`

### Results area
A grid of 6 cards, grouped by style category in this order:
1. Minimalist (2 cards)
2. Contemporary (2 cards)
3. Dynamic (2 cards)

Each card shows:
- Design number (#01–#06)
- Style category badge (Minimalist / Contemporary / Dynamic)
- Concept name (e.g., "Pure Form", "White Silence")
- Concise visual-direction description
- **Front image** (homepage layout)
- **Back image** (inner sections / supporting visuals)
- Collapsible **Image Prompt** block showing the saved prompt text
- **Export as HTML** button
- **Regenerate** button (re-calls kie.ai for that card only)

---

## Generation Logic

When the user clicks **Generate Now**:

1. Read `idea`, `theme`, `products` from the inputs. If any is empty, show an inline error.
2. Build an array of **6 concept specs** in JS (no LLM call needed for this step — the concepts are templated from the inputs):

```
const STYLES = [
  { category: "Minimalist",   traits: "clean, whitespace-forward, restrained palette" },
  { category: "Minimalist",   traits: "clean, whitespace-forward, restrained palette" },
  { category: "Contemporary", traits: "modern design trends, expressive but professional" },
  { category: "Contemporary", traits: "modern design trends, expressive but professional" },
  { category: "Dynamic",      traits: "high contrast, bold typography, visually striking layouts" },
  { category: "Dynamic",      traits: "high contrast, bold typography, visually striking layouts" },
];
```

3. For each of the 6 specs, generate a unique **concept name** + **description** + **front prompt** + **back prompt**. Use deterministic templating so output stays consistent:

   - **Front prompt template**:
     `"Ultra-detailed homepage UI design mockup of a website about {idea}. Visual theme: {theme}. Key sections: {products}. Style: {traits}. Full-page hero layout, realistic web design, high fidelity, viewed on a desktop browser frame, no lorem ipsum, render readable English headings."`
   - **Back prompt template**:
     `"Inner-page sections and supporting visuals for the same website about {idea}. Theme: {theme}. Sections: {products}. Style: {traits}. Multiple stacked sections (features, gallery, footer), high fidelity desktop UI mockup."`

   Concept names per style (pick one per card, never reuse):
   - Minimalist: "Pure Form", "White Silence", "Quiet Grid"
   - Contemporary: "Soft Modern", "Editorial Flow", "Warm Studio"
   - Dynamic: "Bold Pulse", "Neon Cut", "High Voltage"

4. Save the array of 6 concepts to `localStorage` under key `frontend.concepts.v1` BEFORE any network calls so refresh recovers the prompts even if images haven't returned.

5. For each concept, call kie.ai twice (front + back). Show a per-card spinner while pending. On success, store the returned image URL on the concept object and re-save to `localStorage`. On failure, show the error inline on that card with a Retry button.

6. Render the cards as images come back (do not block the whole grid on one slow call).

---

## kie.ai Integration

- **API key**: prompt the user once via a modal on first load, then store under `localStorage` key `kie.apiKey`. Add a small "Change API key" link in the footer.
- Endpoint and request shape: **Claude Code, look up the current kie.ai image-generation endpoint and request body from kie.ai docs and wire it up.** The PDF says to use the user's existing kie.ai API key and that kie.ai routes to GPT-4o Image / Gemini under the hood — we call kie.ai, not those providers directly.
- Implementation requirements:
  - All calls from the browser via `fetch`. Send `Authorization: Bearer <key>`.
  - Handle async job pattern if kie.ai returns a job ID + poll URL (poll every 2s up to 60s).
  - On HTTP error, surface the status code + body text in the card's error state.
- **Test API Connection** button: make a minimal call (e.g., tiny prompt) and show "OK" / error.

---

## Persistence (localStorage)

| Key | Value |
|---|---|
| `kie.apiKey` | string |
| `frontend.inputs.v1` | `{ idea, theme, products }` |
| `frontend.concepts.v1` | array of 6 concept objects: `{ id, category, name, description, frontPrompt, backPrompt, frontImageUrl, backImageUrl, status }` |

On page load: rehydrate inputs and the concept grid from `localStorage` so a refresh restores the full session.

---

## Export as HTML

Per-card **Export as HTML** button:
- Generates a standalone `.html` string containing the concept name, description, both images (use `<img src="...">` pointing at the kie.ai URL — do NOT inline base64 unless straightforward), and the saved image prompt text in a styled block.
- Triggers a download via `Blob` + `URL.createObjectURL` + a temporary `<a download="...">` click.
- Filename: `concept-{number}-{kebab-case-name}.html`.

---

## Styling Direction

Match the sample screenshot vibe in the PDF:
- Dark theme by default (near-black background, cyan/teal accent buttons).
- Large serif display headline ("FrontEnd") + clean sans-serif body.
- Card grid: 2 columns on desktop, 1 column on mobile.
- Use plain CSS in a `<style>` block. No framework, no build step.

---

## File Structure

Just one file in the project root:

```
Frontend.html
```

If Claude Code prefers to split, it may also create:
```
Frontend.html
frontend.css   (optional)
frontend.js    (optional)
```
…but a single self-contained `Frontend.html` is preferred for portability.

---

## Verification Checklist

Before declaring done, Claude Code should manually verify:
1. Open `Frontend.html` in a browser directly (file://). Page loads with header, inputs, buttons.
2. Click **Test API Connection** with a valid kie.ai key → success toast.
3. Fill in Idea / Theme / Products → click **Generate Now**.
4. Six cards appear: 2 Minimalist, 2 Contemporary, 2 Dynamic, in that order, numbered 01–06.
5. Each card eventually shows two images (front + back), a description, the prompt text, and Export / Regenerate buttons.
6. Refresh the page → inputs, prompts, and image URLs all restore from localStorage.
7. Click **Export as HTML** on one card → a `.html` file downloads and opens correctly in the browser standalone.
8. Click **Regenerate** on one card → only that card's images refresh.
9. Click **Clear Saved Data** → grid empties, inputs clear, localStorage keys removed.

---

## Reference

The original brief lives at:
`C:\Users\Aerest\Desktop\Front End Design Concept Generator act.pdf`

Notable: Step 1 of the PDF is missing in the source document — it likely covered initial kie.ai account / API key setup. This plan handles that via the in-app API-key modal.
