/* =================================================================
   Sights — multi-section scroll-driven canvas frame scrubber
   Currently wired to: La Sagrada Familia + Leaning Tower of Pisa
   Pattern adapted from js/product.js. Vanilla JS, no frameworks.
   ================================================================= */

(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initScrollScrub(cfg) {
    const canvas = document.getElementById(cfg.canvasId);
    const track = document.querySelector(cfg.trackSel);
    const phases = Array.from(document.querySelectorAll(cfg.phasesSel));
    const loader = document.getElementById(cfg.loaderId);
    const loaderFill = document.getElementById(cfg.loaderFillId);
    if (!canvas || !track) return null;

    const FRAME_COUNT = cfg.frameCount;
    const FRAME_PATH = cfg.framePath;
    const FIRST_CHUNK = cfg.firstChunk || 12;

    const frames = new Array(FRAME_COUNT);
    let framesReady = 0;
    let currentFrame = -1;
    let ctx = null;

    const PHASE_RANGES = cfg.phaseRanges || [
      { idx: 0, start: 0.04, end: 0.30 },
      { idx: 1, start: 0.34, end: 0.62 },
      { idx: 2, start: 0.66, end: 0.96 },
    ];

    const sizeCanvas = () => {
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
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale, dh = ih * scale;
      const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);
    };

    const updatePhases = (p) => {
      for (const r of PHASE_RANGES) {
        const el = phases[r.idx];
        if (!el) continue;
        el.classList.toggle("visible", p >= r.start && p <= r.end);
      }
    };

    const updateScrub = () => {
      const rect = track.getBoundingClientRect();
      const total = track.offsetHeight - window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      const p = total > 0 ? Math.min(1, scrolled / total) : 0;
      const idx = Math.min(FRAME_COUNT - 1, Math.floor(p * (FRAME_COUNT - 1)));
      if (idx !== currentFrame && frames[idx]) {
        currentFrame = idx;
        drawFrame(idx);
      }
      updatePhases(p);
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
        img.src = FRAME_PATH(i + 1);
      });

    const startPreload = async () => {
      sizeCanvas();
      const first = [];
      for (let i = 0; i < Math.min(FIRST_CHUNK, FRAME_COUNT); i++) first.push(loadFrame(i));
      await Promise.all(first);
      currentFrame = -1;
      updateScrub();
      for (let i = FIRST_CHUNK; i < FRAME_COUNT; i++) {
        loadFrame(i).then(() => {
          if (framesReady === FRAME_COUNT && loader) loader.classList.add("is-done");
          if (i === currentFrame) drawFrame(i);
        });
      }
    };

    const drawLastFrameOnly = async () => {
      sizeCanvas();
      await loadFrame(FRAME_COUNT - 1);
      drawFrame(FRAME_COUNT - 1);
      if (loader) loader.classList.add("is-done");
      phases.forEach((el) => el.classList.add("visible"));
    };

    const api = {
      onScrollTick: updateScrub,
      onResize: () => {
        sizeCanvas();
        if (currentFrame >= 0) drawFrame(currentFrame);
        updateScrub();
      },
    };

    if (prefersReduced) drawLastFrameOnly();
    else startPreload();

    return api;
  }

  const sections = [
    {
      canvasId: "pisa-canvas",
      trackSel: "#pisa-tower .scrub-track",
      phasesSel: "#pisa-tower .scrub-phases .phase",
      loaderId: "pisa-loader",
      loaderFillId: "pisa-loader-fill",
      frameCount: 160,
      framePath: (i) => `pisa-frames/frame_${String(i).padStart(4, "0")}.webp`,
    },
  ].map(initScrollScrub).filter(Boolean);

  /* ─── Pisa tilt video · autoplay on viewport entry, tagline on last beat ─── */
  const tiltVideo = document.getElementById("pisa-tilt-video");
  const tiltTagline = document.getElementById("pisa-tilt-tagline");
  if (tiltVideo && tiltTagline) {
    const TAGLINE_AT = 0.62; // show tagline once playback passes 62% of duration
    const showTagline = () => tiltTagline.classList.add("visible");
    const hideTagline = () => tiltTagline.classList.remove("visible");
    tiltVideo.addEventListener("timeupdate", () => {
      const d = tiltVideo.duration || 8;
      const p = tiltVideo.currentTime / d;
      if (p >= TAGLINE_AT) showTagline(); else hideTagline();
    });
    tiltVideo.addEventListener("seeked", hideTagline);
    // Start playback only when section is in view to save bandwidth on long pages
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          tiltVideo.play().catch(() => {});
        } else {
          tiltVideo.pause();
        }
      }
    }, { threshold: 0.25 });
    io.observe(tiltVideo);
    if (prefersReduced) {
      // Don't autoplay; jump to last frame so the tagline shows over the finished tower.
      tiltVideo.addEventListener("loadedmetadata", () => {
        tiltVideo.currentTime = (tiltVideo.duration || 8) - 0.05;
        showTagline();
      });
      io.disconnect();
    }
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      for (const s of sections) s.onScrollTick();
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    for (const s of sections) s.onResize();
  }, { passive: true });
})();
