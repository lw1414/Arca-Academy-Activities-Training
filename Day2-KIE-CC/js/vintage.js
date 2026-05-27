/* =================================================================
   Heritage — vintage.js
   Vanilla JS, no frameworks.
   Adapted from js/product.js with the canvas frame-scrub hero removed.
   Keeps: nav scroll state, section reveals, stat counters, marquee
   parallax, feature-visual parallax, video → callouts fade.
   ================================================================= */

(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReduced) document.documentElement.classList.add("js-anim");

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
        if (marqueeText && marqueeWrap) {
          const rect = marqueeWrap.getBoundingClientRect();
          const vh = window.innerHeight;
          const total = vh + rect.height;
          const p = 1 - Math.max(0, Math.min(1, (rect.top + rect.height) / total));
          marqueeText.style.transform = `translate3d(${-p * 28}%, 0, 0)`;
        }
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
  window.addEventListener("resize", onScroll, { passive: true });

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

  /* ─── Film — fade callouts while video plays ────────── */
  const video = document.getElementById("film-video");
  const callouts = document.getElementById("film-callouts");
  if (video && callouts) {
    video.addEventListener("play", () => callouts.classList.add("is-hidden"));
    video.addEventListener("pause", () => callouts.classList.remove("is-hidden"));
    video.addEventListener("ended", () => callouts.classList.remove("is-hidden"));
  }

  onScroll();
})();
