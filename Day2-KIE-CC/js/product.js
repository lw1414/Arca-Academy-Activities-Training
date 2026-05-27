/* =================================================================
   Tester Smart Watch Pro — product.js
   Vanilla JS. No frameworks.
   - Hero: scroll-scrub canvas frame sequence (121 WebP frames)
   - IntersectionObserver reveals (CSS-driven)
   - IntersectionObserver-driven stat counters
   - rAF-throttled scroll handler for nav + hero frame + text fade + marquee
   - Native HTML5 video event hooks for dissection callouts
   ================================================================= */

(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReduced) document.documentElement.classList.add("js-anim");

  /* ─── HERO FRAME SCRUB ──────────────────────────────── */
  const FRAME_COUNT = 121;
  const FRAME_PATH = (i) =>
    `frames/frame_${String(i).padStart(4, "0")}.webp`;
  const FIRST_CHUNK = 10; // load this many before first paint
  const SCRUB_EXIT_AT = 0.92; // last 8% of hero scroll → fade text out

  const canvas = document.getElementById("hero-canvas");
  const heroSection = document.querySelector(".hero");
  const heroInner = document.querySelector(".hero-inner");
  const loader = document.getElementById("hero-loader");
  const loaderFill = document.getElementById("hero-loader-fill");

  const frames = new Array(FRAME_COUNT);
  let framesReady = 0;
  let firstChunkReady = false;
  let currentFrame = -1;
  let ctx = null;

  const sizeCanvas = () => {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  };

  const drawFrame = (i) => {
    if (!ctx || !frames[i]) return;
    const img = frames[i];
    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return;
    /* Padded-cover at 0.88 — leaves a thin black border that blends into page bg */
    const scale = Math.max(cw / iw, ch / ih) * 0.88;
    const dw = iw * scale, dh = ih * scale;
    const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  };

  const updateHero = () => {
    if (!heroSection) return;
    const rect = heroSection.getBoundingClientRect();
    const total = heroSection.offsetHeight - window.innerHeight;
    const scrolled = Math.max(0, -rect.top);
    const p = total > 0 ? Math.min(1, scrolled / total) : 0;
    /* Frame index — accelerate slightly so reveal completes by ~92% scroll */
    const accel = Math.min(1, p / SCRUB_EXIT_AT);
    const idx = Math.min(FRAME_COUNT - 1, Math.floor(accel * (FRAME_COUNT - 1)));
    if (idx !== currentFrame && frames[idx]) {
      currentFrame = idx;
      drawFrame(idx);
    }
    /* Text fade-out near the end so the watch reveal stands alone */
    const fadeStart = 0.55;
    const textOpacity = p < fadeStart ? 1 : Math.max(0, 1 - (p - fadeStart) / (1 - fadeStart));
    document.documentElement.style.setProperty("--hero-text-opacity", textOpacity.toFixed(3));
  };

  const loadFrame = (i) =>
    new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        frames[i] = img;
        framesReady++;
        if (loaderFill) {
          loaderFill.style.width = Math.round((framesReady / FRAME_COUNT) * 100) + "%";
        }
        resolve();
      };
      img.onerror = () => { framesReady++; resolve(); };
      img.src = FRAME_PATH(i + 1); // file naming is 1-based
    });

  const startPreload = async () => {
    if (!canvas) return;
    sizeCanvas();
    /* Phase 1: first chunk for fast paint */
    const first = [];
    for (let i = 0; i < Math.min(FIRST_CHUNK, FRAME_COUNT); i++) first.push(loadFrame(i));
    await Promise.all(first);
    firstChunkReady = true;
    currentFrame = -1;
    updateHero();
    /* Phase 2: rest in background, no await; render as they arrive */
    for (let i = FIRST_CHUNK; i < FRAME_COUNT; i++) {
      loadFrame(i).then(() => {
        if (framesReady === FRAME_COUNT && loader) loader.classList.add("is-done");
        /* Repaint if the just-loaded frame is the one we currently want */
        if (i === currentFrame) drawFrame(i);
      });
    }
  };

  /* ─── NAV + scroll-driven updates ───────────────────── */
  const nav = document.getElementById("nav");
  const marqueeText = document.querySelector(".marquee-text");
  const marqueeWrap = document.querySelector(".marquee-wrap");
  const parallaxEls = Array.from(document.querySelectorAll("[data-parallax]")).map((el) => ({
    el,
    factor: parseFloat(el.dataset.parallax) || 0,
  }));

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY || window.pageYOffset;
      if (nav) nav.classList.toggle("scrolled", y > 40);

      if (!prefersReduced) {
        updateHero();
        if (marqueeText && marqueeWrap) {
          const rect = marqueeWrap.getBoundingClientRect();
          const vh = window.innerHeight;
          const total = vh + rect.height;
          const p = 1 - Math.max(0, Math.min(1, (rect.top + rect.height) / total));
          marqueeText.style.transform = `translate3d(${-p * 28}%, 0, 0)`;
        }
        /* Feature-visual parallax — translate as section moves through viewport */
        const vh2 = window.innerHeight;
        for (const { el, factor } of parallaxEls) {
          const r = el.getBoundingClientRect();
          const center = r.top + r.height / 2;
          const offset = (center - vh2 / 2) * factor;
          el.style.setProperty("--vpar", `${offset.toFixed(1)}px`);
        }
      }
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { sizeCanvas(); drawFrame(currentFrame); onScroll(); }, { passive: true });

  /* Anchor links — smooth scroll with fixed-nav offset */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const navH = nav ? nav.offsetHeight + 10 : 70;
      const top = target.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo({ top, behavior: prefersReduced ? "auto" : "smooth" });
    });
  });

  /* ─── Section reveals ───────────────────────────────── */
  if (!prefersReduced && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    document.querySelectorAll(".scroll-section").forEach((s) => io.observe(s));
    setTimeout(() => {
      document.querySelectorAll(".scroll-section:not(.in-view)").forEach((s) =>
        s.classList.add("in-view")
      );
    }, 600);
  }

  /* ─── Stat counters ─────────────────────────────────── */
  const numEls = document.querySelectorAll(".stat-number");
  if (!prefersReduced && "IntersectionObserver" in window) {
    const countObs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          const target = parseFloat(el.dataset.value);
          const decimals = parseInt(el.dataset.decimals || "0", 10);
          const dur = 1800;
          const t0 = performance.now();
          const tick = (now) => {
            const p = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = (target * eased).toFixed(decimals);
            if (p < 1) requestAnimationFrame(tick);
            else el.textContent = target.toFixed(decimals);
          };
          requestAnimationFrame(tick);
          countObs.unobserve(el);
        }
      },
      { threshold: 0.4 }
    );
    numEls.forEach((el) => countObs.observe(el));
    setTimeout(() => {
      numEls.forEach((el) => {
        if (el.textContent === "0") {
          const target = parseFloat(el.dataset.value);
          const decimals = parseInt(el.dataset.decimals || "0", 10);
          el.textContent = target.toFixed(decimals);
        }
      });
    }, 800);
  } else {
    numEls.forEach((el) => {
      const target = parseFloat(el.dataset.value);
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      el.textContent = target.toFixed(decimals);
    });
  }

  /* ─── Dissection — fade callouts while video plays ───── */
  const video = document.getElementById("dissection-video");
  const callouts = document.getElementById("callouts");
  if (video && callouts) {
    video.addEventListener("play", () => callouts.classList.add("is-hidden"));
    video.addEventListener("pause", () => callouts.classList.remove("is-hidden"));
    video.addEventListener("ended", () => callouts.classList.remove("is-hidden"));
  }

  /* ─── Boot ──────────────────────────────────────────── */
  startPreload();
})();
