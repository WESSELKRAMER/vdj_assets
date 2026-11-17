/* =========================================================================
   VDJ core
   - Module registry with a per-page lifecycle (mount / unmount)
   - GSAP + Lenis setup
   - Page reveal (no FOUC)

   Modules register themselves:
     VDJ.global(name, fn)          runs once for elements outside the page
                                   container (nav, cursor, progress bar)
     VDJ.page(name, fn)            runs for every page container. fn receives
                                   the container and may return a cleanup fn.
                                   Everything GSAP creates synchronously inside
                                   fn is reverted automatically on unmount.
   ========================================================================= */
(function () {
  "use strict";

  const VDJ = (window.VDJ = window.VDJ || {});
  const globalModules = [];
  const pageModules = [];

  let pageCtx = null;
  let pageCleanups = [];

  VDJ.state = {
    path: normalizePath(location.pathname),
    container: null,
    mounted: false
  };

  /* ----------------------------------------------------------------------- */
  /* Helpers                                                                  */
  /* ----------------------------------------------------------------------- */

  function normalizePath(p) {
    return (p || "/").replace(/\/+$/, "") || "/";
  }

  VDJ.normalizePath = normalizePath;
  VDJ.path = () => VDJ.state.path;
  VDJ.isPath = (p) => VDJ.state.path === normalizePath(p);
  VDJ.mq = (query) => window.matchMedia(query).matches;
  VDJ.isTouch = () => VDJ.mq("(hover: none) and (pointer: coarse)");

  /** addEventListener that returns its own remover */
  VDJ.on = function (target, type, fn, opts) {
    if (!target) return () => {};
    target.addEventListener(type, fn, opts);
    return () => target.removeEventListener(type, fn, opts);
  };

  /** run a callback two frames from now (after layout + paint) */
  VDJ.afterPaint = function (fn) {
    requestAnimationFrame(() => requestAnimationFrame(fn));
  };

  VDJ.refreshScroll = function () {
    if (window.lenis) window.lenis.resize();
    if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
  };

  /** scroll helper that respects Lenis */
  VDJ.scrollTo = function (target, opts) {
    opts = opts || {};
    if (window.lenis) {
      window.lenis.scrollTo(target, {
        duration: opts.duration ?? 1.2,
        immediate: !!opts.immediate,
        force: true,
        offset: opts.offset || 0,
        lock: !!opts.lock,
        onComplete: opts.onComplete
      });
      return;
    }
    const y = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y + (opts.offset || 0), behavior: opts.immediate ? "auto" : "smooth" });
    if (opts.onComplete) setTimeout(opts.onComplete, opts.immediate ? 0 : 600);
  };

  function safeRun(name, fn, arg) {
    try {
      return fn(arg);
    } catch (err) {
      console.error(`[VDJ] ${name} failed:`, err);
      return null;
    }
  }

  /* ----------------------------------------------------------------------- */
  /* Registry + lifecycle                                                     */
  /* ----------------------------------------------------------------------- */

  VDJ.global = (name, fn) => globalModules.push({ name, fn });
  VDJ.page = (name, fn) => pageModules.push({ name, fn });

  VDJ.mountGlobals = function () {
    globalModules.forEach((m) => safeRun(m.name, m.fn));
  };

  VDJ.mount = function (container, path) {
    if (VDJ.state.mounted) VDJ.unmount();

    VDJ.state.container = container;
    VDJ.state.path = normalizePath(path || location.pathname);
    VDJ.state.mounted = true;
    pageCleanups = [];

    pageCtx = gsap.context(() => {
      pageModules.forEach((m) => {
        const cleanup = safeRun(m.name, m.fn, container);
        if (typeof cleanup === "function") pageCleanups.push({ name: m.name, fn: cleanup });
      });
    });

    document.dispatchEvent(new CustomEvent("vdj:mount", { detail: { container, path: VDJ.state.path } }));
  };

  VDJ.unmount = function () {
    if (!VDJ.state.mounted) return;
    document.dispatchEvent(new CustomEvent("vdj:unmount", { detail: { container: VDJ.state.container } }));

    pageCleanups.reverse().forEach((c) => safeRun(`${c.name} cleanup`, c.fn));
    pageCleanups = [];

    if (pageCtx) {
      safeRun("context revert", () => pageCtx.revert());
      pageCtx = null;
    }

    VDJ.state.mounted = false;
    VDJ.state.container = null;
  };

  /** register a GSAP object created later (e.g. in a click handler) with the page context */
  VDJ.track = function (fn) {
    if (pageCtx) return pageCtx.add(fn);
    return fn();
  };

  /* ----------------------------------------------------------------------- */
  /* GSAP + Lenis                                                             */
  /* ----------------------------------------------------------------------- */

  VDJ.setupGsap = function () {
    const plugins = ["ScrollTrigger", "SplitText", "Flip", "Observer", "ScrollToPlugin", "CustomEase", "Draggable"]
      .map((n) => window[n])
      .filter(Boolean);
    gsap.registerPlugin(...plugins);

    if (window.CustomEase) CustomEase.create("osmo", "0.625, 0.05, 0, 1");
    // Same effective defaults as before (gallery set duration, transitions set ease)
    gsap.defaults({ ease: window.CustomEase ? "osmo" : "power4.inOut", duration: 0.8 });

    // iOS: the address bar showing/hiding resizes the viewport. Without this,
    // every resize triggers a ScrollTrigger refresh which makes the page jump.
    ScrollTrigger.config({ ignoreMobileResize: true });

    watchPageHeight();
  };

  /**
   * ScrollTriggers measure their start/end once. When the page grows later
   * (lazy images, videos getting their size, fonts), everything below is
   * measured too high: the footer parallax was already finished before the
   * footer came into view, by up to 1300px on Over ons. Re-measure whenever
   * the page height changes.
   */
  function watchPageHeight() {
    if (typeof ResizeObserver === "undefined") return;
    let lastHeight = document.documentElement.scrollHeight;
    let timer = null;
    const ro = new ResizeObserver(() => {
      const h = document.documentElement.scrollHeight;
      if (Math.abs(h - lastHeight) < 2) return;
      lastHeight = h;
      clearTimeout(timer);
      timer = setTimeout(() => {
        lastHeight = document.documentElement.scrollHeight;
        VDJ.refreshScroll();
      }, 200);
    });
    ro.observe(document.body);
  }

  VDJ.setupLenis = function () {
    if (window.lenis || typeof Lenis === "undefined") return;

    const lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 0.75,
      touchMultiplier: 0.95,
      smoothWheel: true
    });
    window.lenis = lenis;

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  };

  /* ----------------------------------------------------------------------- */
  /* Reveal (FOUC)                                                            */
  /* The head snippet adds html.vdj-loading, which hides the page container   */
  /* with CSS until we reveal it here. A failsafe in the head removes the     */
  /* class after 4s in case this script never runs.                          */
  /* ----------------------------------------------------------------------- */

  VDJ.fontsReady = function (timeout) {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, timeout || 800))]);
  };

  VDJ.reducedMotion = () => VDJ.mq("(prefers-reduced-motion: reduce)");

  /**
   * Everything that belongs to the page (not the persistent nav, progress bar
   * or cursor). Matches the selector in the Webflow head snippet, which hides
   * these until the reveal. Works on pages with and without a Barba container.
   */
  const PERSISTENT = ".navbar_wrapper, .progress-bar-wrap, .cursor, .pcg_modal_overlay, script, style, link, noscript, template";
  VDJ.pageParts = function () {
    return Array.from(document.body.children).filter((el) => !el.matches(PERSISTENT));
  };

  VDJ.reveal = function (targets, opts) {
    opts = opts || {};
    targets = targets || VDJ.pageParts();
    const html = document.documentElement;
    gsap.set(targets, { autoAlpha: 0 });
    html.classList.remove("vdj-loading");
    html.classList.add("vdj-ready");
    clearTimeout(window.__vdjFailsafe);
    document.dispatchEvent(new CustomEvent("vdj:reveal"));

    if (VDJ.reducedMotion()) {
      gsap.set(targets, { clearProps: "opacity,visibility" });
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      gsap.to(targets, {
        autoAlpha: 1,
        duration: opts.duration || 0.9,
        ease: "power2.out",
        overwrite: true,
        onComplete: () => {
          gsap.set(targets, { clearProps: "opacity,visibility" });
          resolve();
        }
      });
    });
  };

  /** fade the page out (before leaving) */
  VDJ.fadeOut = function (targets, opts) {
    opts = opts || {};
    targets = targets || VDJ.pageParts();
    if (VDJ.reducedMotion()) return Promise.resolve();
    return new Promise((resolve) => {
      gsap.to(targets, {
        autoAlpha: 0,
        duration: opts.duration || 0.6,
        ease: "power2.in",
        overwrite: true,
        onComplete: resolve
      });
      // never hang on a background tab (no animation frames there)
      setTimeout(resolve, ((opts.duration || 0.6) + 0.4) * 1000);
    });
  };
})();
