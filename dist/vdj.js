/*! Vandejong site scripts | built 2026-11-18 */
/* ---- src/core.js ---- */
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

/* ---- src/modules/text.js ---- */
/* =========================================================================
   Text effects: split reveal, highlight text, hover chars, disappear,
   current year
   ========================================================================= */
(function () {
  "use strict";
  const VDJ = window.VDJ;

  /* ----------------------------------------------------------------------- */
  /* Mask reveal on [data-split="heading"]                                    */
  /*   data-split-reveal="lines|words|chars"  (default lines)                 */
  /*   data-split-immediate="true"            animate on load, not on scroll  */
  /* Headings are split right away (not lazily) so nothing flashes unsplit.   */
  /* ----------------------------------------------------------------------- */
  const splitConfig = {
    lines: { duration: 0.8, stagger: 0.08 },
    words: { duration: 0.6, stagger: 0.06 },
    chars: { duration: 0.4, stagger: 0.01 }
  };

  VDJ.splitHeading = function (heading) {
    if (heading.dataset.splitDone === "true") return null;
    heading.dataset.splitDone = "true";

    const type = ["lines", "words", "chars"].includes(heading.dataset.splitReveal)
      ? heading.dataset.splitReveal
      : "lines";
    const isImmediate = heading.dataset.splitImmediate === "true";
    const typesToSplit = type === "lines" ? ["lines"] : type === "words" ? ["lines", "words"] : ["lines", "words", "chars"];
    let played = false;

    const split = SplitText.create(heading, {
      type: typesToSplit.join(","),
      mask: "lines",
      autoSplit: true,
      linesClass: "line",
      wordsClass: "word",
      charsClass: "letter",
      onSplit(instance) {
        const targets = instance[type];
        const config = splitConfig[type];
        if (!targets || !targets.length) return;

        // Re-split after a resize / font load: don't replay the intro
        if (played && isImmediate) return;

        const animation = {
          yPercent: 110,
          duration: config.duration,
          stagger: config.stagger,
          ease: "expo.out"
        };

        if (isImmediate) {
          played = true;
          return gsap.from(targets, { ...animation, delay: 0.2 });
        }

        return gsap.from(targets, {
          ...animation,
          scrollTrigger: { trigger: heading, start: "top 80%", once: true }
        });
      }
    });

    return split;
  };

  VDJ.page("split-headings", function (container) {
    if (typeof SplitText === "undefined") return;
    const splits = [];
    const headings = container.querySelectorAll('[data-split="heading"]');
    headings.forEach((heading) => {
      const s = VDJ.splitHeading(heading);
      if (s) splits.push(s);
    });

    return () => {
      splits.forEach((s) => { try { s.revert(); } catch (e) {} });
      headings.forEach((h) => delete h.dataset.splitDone);
    };
  });

  /* ----------------------------------------------------------------------- */
  /* Highlight text: characters fade in while scrolling                       */
  /* ----------------------------------------------------------------------- */
  VDJ.page("highlight-text", function (container) {
    if (typeof SplitText === "undefined") return;
    const splits = [];

    container.querySelectorAll("[data-highlight-text]").forEach((heading) => {
      const isHero = heading.getAttribute("data-highlight-hero") === "true";
      const scrollStart = heading.getAttribute("data-highlight-scroll-start") || (isHero ? "top top" : "top 90%");
      const scrollEnd = heading.getAttribute("data-highlight-scroll-end") || (isHero ? "+=60%" : "center 40%");
      const fadedValue = parseFloat(heading.getAttribute("data-highlight-fade")) || 0.2;
      const staggerValue = parseFloat(heading.getAttribute("data-highlight-stagger")) || 0.1;

      splits.push(
        new SplitText(heading, {
          type: "words, chars",
          autoSplit: true,
          onSplit(self) {
            gsap.set(self.chars, { autoAlpha: fadedValue });
            const tl = gsap.timeline({
              scrollTrigger: {
                scrub: true,
                trigger: isHero ? document.documentElement : heading,
                start: scrollStart,
                end: scrollEnd,
                invalidateOnRefresh: true
              }
            });
            tl.fromTo(self.chars, { autoAlpha: fadedValue, immediateRender: true }, { autoAlpha: 1, stagger: staggerValue, ease: "linear" });
            return tl;
          }
        })
      );
    });

    return () => splits.forEach((s) => { try { s.revert(); } catch (e) {} });
  });

  /* ----------------------------------------------------------------------- */
  /* Hover chars (CSS does the animation, we only wrap characters)            */
  /* ----------------------------------------------------------------------- */
  VDJ.page("hover-chars", function (container) {
    container.querySelectorAll("[data-hover-chars]").forEach((el) => {
      if (el.dataset.splitInitialized === "true") return;
      el.dataset.splitInitialized = "true";

      const text = el.textContent;
      el.textContent = "";
      [...text].forEach((char, index) => {
        const span = document.createElement("span");
        span.textContent = char === " " ? " " : char;
        span.style.transitionDelay = `${index * 0.015}s`;
        el.appendChild(span);
      });
    });
  });

  /* ----------------------------------------------------------------------- */
  /* Current year                                                             */
  /* ----------------------------------------------------------------------- */
  VDJ.page("current-year", function (container) {
    const year = String(new Date().getFullYear());
    container.querySelectorAll("[data-current-year]").forEach((el) => (el.textContent = year));
  });

  /* ----------------------------------------------------------------------- */
  /* Fade-in on scroll: [data-animate="fade|fade-up|fade-down|..."]           */
  /* ----------------------------------------------------------------------- */
  VDJ.page("scroll-animations", function (container) {
    container.querySelectorAll("[data-animate]").forEach((el) => {
      const type = el.dataset.animate || "fade";
      const fromVars = { opacity: 0 };
      if (type === "fade-up") fromVars.y = 40;
      if (type === "fade-down") fromVars.y = -40;
      if (type === "fade-left") fromVars.x = 40;
      if (type === "fade-right") fromVars.x = -40;
      if (type === "zoom") fromVars.scale = 0.9;

      gsap.fromTo(el, fromVars, {
        opacity: 1, x: 0, y: 0, scale: 1,
        duration: parseFloat(el.dataset.duration) || 0.8,
        delay: parseFloat(el.dataset.delay) || 0,
        ease: el.dataset.ease || "expo.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true }
      });
    });
  });
})();

/* ---- src/modules/globals.js ---- */
/* =========================================================================
   Global modules: live outside the page container and survive transitions
   ========================================================================= */
(function () {
  "use strict";
  const VDJ = window.VDJ;

  /* ----------------------------------------------------------------------- */
  /* Hamburger navigation                                                     */
  /* ----------------------------------------------------------------------- */
  VDJ.global("navigation", function () {
    const navStatusEl = document.querySelector("[data-navigation-status]");
    const navigation = document.querySelector(".navigation");
    if (!navStatusEl || !navigation) return;

    const menuItems = Array.from(navigation.querySelectorAll(".hamburger-nav__li"));
    const menuLinks = Array.from(navigation.querySelectorAll(".hamburger-nav__a"));
    let openTween = null;

    const isActive = () => navStatusEl.getAttribute("data-navigation-status") === "active";

    function setClosedState() {
      gsap.set(menuItems, { opacity: 0, y: 32 });
      gsap.set(menuLinks, { opacity: 1 });
    }

    function animateOpen() {
      if (openTween) openTween.kill();
      openTween = gsap.to(menuItems, {
        opacity: 1, y: 0, duration: 0.75, stagger: 0.095, ease: "power3.out", delay: 0.28
      });
    }

    function resetLinkOpacity() {
      gsap.to(menuLinks, { opacity: 1, duration: 0.22, ease: "power2.out", overwrite: true });
    }

    function dimOtherLinks(activeLink) {
      gsap.to(menuLinks, {
        opacity: (i, el) => (el === activeLink ? 1 : 0.3),
        duration: 0.22, ease: "power2.out", overwrite: true
      });
    }

    // The toggle is a <div> in Webflow (a Block can't be a <button>), so we
    // give it button semantics: focusable, Enter/Space, aria-expanded.
    const toggles = Array.from(document.querySelectorAll('[data-navigation-toggle="toggle"]'));
    const menuGroup = navigation.querySelector(".hamburger-nav__group");
    if (menuGroup && !menuGroup.id) menuGroup.id = "vdj-menu";

    toggles.forEach((btn) => {
      if (btn.tagName !== "BUTTON") {
        btn.setAttribute("role", "button");
        btn.setAttribute("tabindex", "0");
      }
      if (menuGroup) btn.setAttribute("aria-controls", menuGroup.id);
      btn.setAttribute("aria-expanded", "false");
    });

    function syncToggleState() {
      const open = isActive();
      toggles.forEach((btn) => btn.setAttribute("aria-expanded", open ? "true" : "false"));
    }

    function openNavigation() {
      navStatusEl.setAttribute("data-navigation-status", "active");
      syncToggleState();
      animateOpen();
    }

    function closeNavigation() {
      if (openTween) openTween.kill();
      navStatusEl.setAttribute("data-navigation-status", "not-active");
      syncToggleState();
      resetLinkOpacity();
      setClosedState();
    }

    toggles.forEach((btn) => {
      btn.addEventListener("click", () => (isActive() ? closeNavigation() : openNavigation()));
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault(); // no page scroll on Space
          btn.click();
          // opened from the keyboard: start on the first menu link
          if (isActive() && menuLinks[0]) setTimeout(() => menuLinks[0].focus(), 50);
        }
      });
    });

    // While the menu is open, Tab cycles through the menu links and the toggle
    // (in the HTML the toggle comes after the menu, so Tab would leave it)
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Tab" || !isActive()) return;
      const order = [...menuLinks, ...toggles.slice(0, 1)];
      const i = order.indexOf(document.activeElement);
      if (i === -1) return;
      e.preventDefault();
      const next = order[(i + (e.shiftKey ? -1 : 1) + order.length) % order.length];
      next.focus();
    });
    document.querySelectorAll('[data-navigation-toggle="close"]').forEach((btn) => {
      btn.addEventListener("click", closeNavigation);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !isActive()) return;
      const focusWasInMenu = menuGroup && menuGroup.contains(document.activeElement);
      closeNavigation();
      // keyboard users land back on the toggle instead of somewhere random
      if (focusWasInMenu || toggles.includes(document.activeElement)) toggles[0] && toggles[0].focus();
    });

    menuLinks.forEach((link) => {
      const dim = () => isActive() && dimOtherLinks(link);
      const reset = () => isActive() && resetLinkOpacity();
      link.addEventListener("mouseenter", dim);
      link.addEventListener("mouseleave", reset);
      link.addEventListener("focus", dim);
      link.addEventListener("blur", reset);
    });

    setClosedState();

    // Used by the page transition: close the menu and wait for its CSS transition
    VDJ.closeNavigation = function (timeout) {
      if (!isActive()) return Promise.resolve();
      closeNavigation();
      return new Promise((resolve) => setTimeout(resolve, timeout || 450));
    };
  });

  /* ----------------------------------------------------------------------- */
  /* Cursor bubble                                                            */
  /* ----------------------------------------------------------------------- */
  VDJ.global("cursor", function () {
    const cursor = document.querySelector("[data-cursor]");
    const cursorTextTarget = document.querySelector("[data-cursor-text-target]");
    if (!cursor || !VDJ.mq("(hover: hover) and (pointer: fine)")) return;

    const bubble = cursor.querySelector(".cursor-bubble");
    let mouseX = 0;
    let mouseY = 0;
    let hasMouseMoved = false;
    let rafId = null;

    const xTo = gsap.quickTo(cursor, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.4, ease: "power3.out" });

    function updateCursor() {
      rafId = null;
      const hoverItem = document.elementFromPoint(mouseX, mouseY)?.closest("[data-cursor-hover]");
      const isEdge = cursor.getBoundingClientRect().right >= window.innerWidth;

      cursor.setAttribute("data-cursor", hoverItem ? (isEdge ? "active-edge" : "active") : "");

      if (hoverItem && cursorTextTarget) {
        const text = hoverItem.getAttribute("data-cursor-text");
        if (text) {
          cursorTextTarget.textContent = text;
          const isComingSoon = hoverItem.getAttribute("data-coming-soon") === "true";
          if (bubble) {
            bubble.style.backgroundColor = isComingSoon ? "rgba(192, 192, 192, 0.8)" : "";
            bubble.style.color = isComingSoon ? "#000" : "";
          }
        }
      }
    }

    function schedule() {
      if (!rafId) rafId = requestAnimationFrame(updateCursor);
    }

    window.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      hasMouseMoved = true;
      xTo(mouseX);
      yTo(mouseY);
      schedule();
    });

    window.addEventListener("scroll", () => hasMouseMoved && schedule(), { passive: true });

    // Hide the bubble while pages swap, re-check once the new page is in
    document.addEventListener("vdj:unmount", () => cursor.setAttribute("data-cursor", ""));
    document.addEventListener("vdj:mount", () => hasMouseMoved && VDJ.afterPaint(schedule));
  });

  /* ----------------------------------------------------------------------- */
  /* Scroll progress bar (click to jump)                                      */
  /* The scrubbed bar itself is per page, see pages.js                        */
  /* ----------------------------------------------------------------------- */
  VDJ.global("progress-bar-click", function () {
    const wrap = document.querySelector(".progress-bar-wrap");
    if (!wrap) return;

    wrap.addEventListener("click", (event) => {
      const progress = event.clientX / wrap.offsetWidth;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      VDJ.scrollTo(progress * max, { duration: 0.8 });
    });
  });

  /* ----------------------------------------------------------------------- */
  /* Split headings outside the container (logo tagline)                      */
  /* ----------------------------------------------------------------------- */
  VDJ.global("split-headings-outside", function () {
    if (typeof SplitText === "undefined") return;
    const headings = Array.from(document.querySelectorAll('[data-split="heading"]')).filter(
      (h) => !h.closest('[data-barba="container"], [data-transition-container]')
    );
    if (!headings.length) return;
    // play the intro together with the page fade-in, not while it's still hidden
    document.addEventListener("vdj:reveal", () => headings.forEach((h) => VDJ.splitHeading(h)), { once: true });
  });
})();

/* ---- src/modules/pages.js ---- */
/* =========================================================================
   Page modules shared by several pages: progress bar, footer parallax,
   image parallax, draggable marquee, swiper, hero folder cards
   ========================================================================= */
(function () {
  "use strict";
  const VDJ = window.VDJ;

  /* ----------------------------------------------------------------------- */
  /* Scroll progress bar (the bar sits outside the container)                 */
  /* ----------------------------------------------------------------------- */
  VDJ.page("progress-bar", function () {
    const bar = document.querySelector(".progress-bar");
    if (!bar) return;
    gsap.fromTo(bar, { scaleX: 0 }, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.5 }
    });
  });

  /* ----------------------------------------------------------------------- */
  /* Footer parallax                                                          */
  /* On touch devices the inner translate is skipped: iOS scrolls natively    */
  /* (Lenis doesn't smooth touch), so a scrubbed transform at the very end of */
  /* the page lags a frame behind and jitters during the bounce. The dark     */
  /* overlay fade stays. Add data-footer-parallax-touch="true" to force it.   */
  /* ----------------------------------------------------------------------- */
  VDJ.page("footer-parallax", function (container) {
    container.querySelectorAll("[data-footer-parallax]").forEach((el) => {
      const inner = el.querySelector("[data-footer-parallax-inner]");
      const dark = el.querySelector("[data-footer-parallax-dark]");
      if (!inner && !dark) return;

      const allowTranslate = !VDJ.isTouch() || el.getAttribute("data-footer-parallax-touch") === "true";

      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top bottom", end: "top top", scrub: true, invalidateOnRefresh: true }
      });
      if (inner && allowTranslate) tl.fromTo(inner, { yPercent: -25 }, { yPercent: 0, ease: "none" }, 0);
      if (dark) tl.fromTo(dark, { opacity: 0.5 }, { opacity: 1, ease: "none" }, 0);
    });
  });

  /* ----------------------------------------------------------------------- */
  /* Image parallax: [data-parallax] > [data-parallax-media]                  */
  /*   data-parallax-speed (yPercent, default 15)                             */
  /*   data-parallax-direction="up|down"                                      */
  /* (was parallax.scroll.content.js, which was never loaded on the site)     */
  /* ----------------------------------------------------------------------- */
  VDJ.page("image-parallax", function () {
    // whole document: on the case template the hero sits outside the container
    document.querySelectorAll("[data-parallax]").forEach((wrap) => {
      const media = wrap.querySelector("[data-parallax-media]");
      if (!media) return;

      const speedAttr = parseFloat(wrap.getAttribute("data-parallax-speed"));
      const speed = Number.isFinite(speedAttr) ? speedAttr : 15;
      const direction = (wrap.getAttribute("data-parallax-direction") || "up").toLowerCase() === "down" ? 1 : -1;

      gsap.fromTo(media, { yPercent: direction * -speed }, {
        yPercent: direction * speed,
        ease: "none",
        scrollTrigger: { trigger: wrap, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true }
      });
    });
  });

  /* ----------------------------------------------------------------------- */
  /* Draggable marquee                                                        */
  /* ----------------------------------------------------------------------- */
  VDJ.page("draggable-marquee", function (container) {
    if (typeof Observer === "undefined") return;
    const observers = [];

    const num = (el, name, fallback) => {
      const v = parseFloat(el.getAttribute(name));
      return Number.isFinite(v) ? v : fallback;
    };

    container.querySelectorAll("[data-draggable-marquee-init]").forEach((wrapper) => {
      const collection = wrapper.querySelector("[data-draggable-marquee-collection]");
      const list = wrapper.querySelector("[data-draggable-marquee-list]");
      if (!collection || !list) return;

      const multiplier = num(wrapper, "data-multiplier", 40);
      const sensitivity = num(wrapper, "data-sensitivity", 0.01);

      const wrapperWidth = wrapper.getBoundingClientRect().width;
      const listWidth = list.scrollWidth || list.getBoundingClientRect().width;
      if (!wrapperWidth || !listWidth) return;

      const minRequiredWidth = wrapperWidth + listWidth + 2;
      let guard = 0;
      while (collection.scrollWidth < minRequiredWidth && guard++ < 50) {
        const clone = list.cloneNode(true);
        clone.setAttribute("data-draggable-marquee-clone", "");
        clone.setAttribute("aria-hidden", "true");
        collection.appendChild(clone);
      }

      const wrapX = gsap.utils.wrap(-listWidth, 0);
      gsap.set(collection, { x: 0 });

      const marqueeLoop = gsap.to(collection, {
        x: -listWidth,
        duration: 80,
        ease: "none",
        repeat: -1,
        onReverseComplete: () => marqueeLoop.progress(1),
        modifiers: { x: (x) => wrapX(parseFloat(x)) + "px" }
      });

      const baseDirection = (wrapper.getAttribute("data-direction") || "left").toLowerCase() === "right" ? -1 : 1;
      const timeScale = { value: baseDirection };
      if (baseDirection < 0) marqueeLoop.progress(1);

      function applyTimeScale() {
        marqueeLoop.timeScale(timeScale.value);
        wrapper.setAttribute("data-direction", timeScale.value < 0 ? "right" : "left");
      }
      applyTimeScale();

      const observer = Observer.create({
        target: wrapper,
        type: "pointer,touch",
        preventDefault: true,
        debounce: false,
        onChangeX: (e) => {
          const v = gsap.utils.clamp(-multiplier, multiplier, e.velocityX * -sensitivity);
          gsap.killTweensOf(timeScale);
          VDJ.track(() => {
            gsap.timeline({ onUpdate: applyTimeScale })
              .to(timeScale, { value: v, duration: 0.1, overwrite: true })
              .to(timeScale, { value: v < 0 ? -1 : 1, duration: 1.0 });
          });
        }
      });
      observers.push(observer);

      const run = () => { marqueeLoop.resume(); applyTimeScale(); observer.enable(); };
      const stop = () => { marqueeLoop.pause(); observer.disable(); };
      ScrollTrigger.create({
        trigger: wrapper, start: "top bottom", end: "bottom top",
        onEnter: run, onEnterBack: run, onLeave: stop, onLeaveBack: stop
      });

      wrapper.setAttribute("data-draggable-marquee-init", "initialized");
    });

    return () => {
      observers.forEach((o) => o.kill());
      container.querySelectorAll("[data-draggable-marquee-clone]").forEach((c) => c.remove());
    };
  });

  /* ----------------------------------------------------------------------- */
  /* Swiper sliders: [data-swiper-id] with .swiper + prev/next buttons        */
  /* ----------------------------------------------------------------------- */
  VDJ.page("swipers", function (container) {
    if (typeof Swiper === "undefined") return;
    const swipers = [];
    const offs = [];

    container.querySelectorAll("[data-swiper-id]").forEach((section) => {
      const swiperEl = section.querySelector(".swiper");
      const nextEl = section.querySelector(".future-swiper-next");
      const prevEl = section.querySelector(".future-swiper-prev");
      if (!swiperEl || !nextEl || !prevEl) return;

      // Slide widths come from the images (fixed height, natural ratio), so
      // load them all up front and let Swiper re-measure as each one arrives.
      const imgs = Array.from(swiperEl.querySelectorAll(".swiper-slide:not(.is--video) img"));
      const firstSlide = swiperEl.querySelector(".swiper-slide");
      const slideH = firstSlide ? firstSlide.getBoundingClientRect().height : 0;
      imgs.forEach((img) => {
        img.loading = "eager";
        // widest expected image (landscape ~16:9) at this height, for srcset
        if (slideH && img.srcset) img.sizes = `${Math.ceil(slideH * 1.8)}px`;
      });

      const swiper = new Swiper(swiperEl, {
        slidesPerView: "auto",
        slidesPerGroup: 1,
        spaceBetween: 8,
        speed: 700,
        grabCursor: true,
        centeredSlides: false,
        loop: false,
        normalizeSlideIndex: true,
        watchOverflow: true,
        autoHeight: false,
        navigation: { nextEl, prevEl }
      });
      swipers.push(swiper);

      let raf = null;
      const update = () => {
        if (raf) return;
        raf = requestAnimationFrame(() => { raf = null; if (!swiper.destroyed) swiper.update(); });
      };
      imgs.forEach((img) => {
        if (!(img.complete && img.naturalWidth)) {
          offs.push(VDJ.on(img, "load", update), VDJ.on(img, "error", update));
        }
      });

      // Video slides: width from the video's own ratio, like the images
      swiperEl.querySelectorAll(".swiper-slide.is--video").forEach((slide) => {
        const video = slide.querySelector("video");
        const box = slide.querySelector(".video_div") || slide;
        if (!video) return;
        const applyRatio = () => {
          if (!video.videoWidth || !video.videoHeight) return;
          box.style.setProperty("--vdj-ar", (video.videoWidth / video.videoHeight).toFixed(4));
          update();
        };
        if (video.readyState >= 1) applyRatio();
        offs.push(VDJ.on(video, "loadedmetadata", applyRatio));
      });
    });

    return () => {
      offs.forEach((off) => off());
      swipers.forEach((s) => { try { s.destroy(true, true); } catch (e) {} });
    };
  });

  /* ----------------------------------------------------------------------- */
  /* Hero list folder cards (home list mode)                                  */
  /* Desktop: open on hover. Mobile: the card closest to the viewport centre. */
  /* ----------------------------------------------------------------------- */
  VDJ.page("hero-folder-cards", function (container) {
    const timelines = [];
    const offs = [];
    const mobileQuery = window.matchMedia("(max-width: 991px)");

    container.querySelectorAll(".hero_list_item").forEach((item) => {
      const card = item.querySelector(".hero_folder_card");
      const link = item.querySelector(".hero_list_item_link");
      if (!card || !link) return;

      const front = card.querySelector(".hero_folder_front");
      const thumbs = Array.from(card.querySelectorAll(".hero_folder_thumb"));
      if (!front || !thumbs.length) return;
      const layers = [front, ...thumbs];

      thumbs.forEach((thumb, i) => (thumb.style.zIndex = 90 - i * 5));
      front.style.zIndex = 100;

      gsap.set(layers, { rotationX: 0, y: 0, transformOrigin: "50% 100%", transformStyle: "preserve-3d", force3D: true });

      const tl = gsap.timeline({ paused: true }).to(layers, {
        duration: 0.45, ease: "power3.out", stagger: 0.03,
        rotationX: (i) => Math.min(-45 + i * 10, 0),
        y: (i) => i * -4
      });
      timelines.push({ item, tl });

      const open = () => tl.play();
      const close = () => tl.reverse();
      offs.push(VDJ.on(link, "mouseenter", open), VDJ.on(link, "mouseleave", close), VDJ.on(link, "focus", open), VDJ.on(link, "blur", close));
    });

    if (!timelines.length) return;

    let activeIndex = -1;
    let rafId = null;

    function updateCenterItem() {
      rafId = null;
      if (!mobileQuery.matches) return;
      const center = window.innerHeight / 2;
      let closest = -1;
      let best = Infinity;
      timelines.forEach(({ item }, i) => {
        const r = item.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - center);
        if (d < best) { best = d; closest = i; }
      });
      if (closest === activeIndex) return;
      if (activeIndex !== -1) timelines[activeIndex].tl.reverse();
      activeIndex = closest;
      if (activeIndex !== -1) timelines[activeIndex].tl.play();
    }

    const onScroll = () => { if (!rafId) rafId = requestAnimationFrame(updateCenterItem); };
    const onBreakpoint = () => {
      if (!mobileQuery.matches && activeIndex !== -1) {
        timelines[activeIndex].tl.reverse();
        activeIndex = -1;
      } else updateCenterItem();
    };

    offs.push(VDJ.on(window, "scroll", onScroll, { passive: true }), VDJ.on(mobileQuery, "change", onBreakpoint));
    updateCenterItem();

    return () => {
      offs.forEach((off) => off());
      if (rafId) cancelAnimationFrame(rafId);
    };
  });
})();

/* ---- src/modules/media.js ---- */
/* =========================================================================
   Bunny HLS video players
   - [data-bunny-background-init]  muted background video (was bunny.js)
   - [data-bunny-player-init]      player with controls/sound (was bunny.sound.js)
   Both clean up their hls.js instance and observers when the page leaves.
   ========================================================================= */
(function () {
  "use strict";
  const VDJ = window.VDJ;
  const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS

  function safePlay(video) {
    const p = video.play();
    if (p && typeof p.then === "function") p.catch(() => {});
  }

  function readyIfIdle(player, pendingPlay) {
    if (!pendingPlay &&
        player.getAttribute("data-player-activated") !== "true" &&
        player.getAttribute("data-player-status") === "idle") {
      player.setAttribute("data-player-status", "ready");
    }
  }

  function bestLevel(levels) {
    if (!levels || !levels.length) return null;
    return levels.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a), levels[0]);
  }

  function setBeforeRatio(player, updateSize, w, h) {
    if (updateSize !== "true" || !w || !h) return;
    const before = player.querySelector("[data-player-before]");
    if (before) before.style.paddingTop = (h / w) * 100 + "%";
  }

  function resolveUrl(base, rel) {
    try { return new URL(rel, base).toString(); } catch (e) { return rel; }
  }

  /** duration + aspect without attaching playback (lazy="meta") */
  function getSourceMeta(src, useHlsJs) {
    return new Promise((resolve) => {
      const empty = { width: 0, height: 0, duration: NaN };

      if (useHlsJs && window.Hls && Hls.isSupported()) {
        try {
          const tmp = new Hls();
          const out = { ...empty };
          const done = () => { try { tmp.destroy(); } catch (e) {} resolve(out); };
          const timer = setTimeout(done, 8000);
          tmp.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
            const best = bestLevel((data && data.levels) || tmp.levels || []);
            if (best && best.width && best.height) { out.width = best.width; out.height = best.height; }
          });
          tmp.on(Hls.Events.LEVEL_LOADED, (e, data) => {
            if (data && data.details && isFinite(data.details.totalduration)) out.duration = data.details.totalduration;
            clearTimeout(timer);
            done();
          });
          tmp.on(Hls.Events.ERROR, () => { clearTimeout(timer); done(); });
          tmp.loadSource(src);
          return;
        } catch (e) {
          resolve(empty);
          return;
        }
      }

      fetch(src, { credentials: "omit", cache: "no-store" })
        .then((r) => { if (!r.ok) throw new Error("master"); return r.text(); })
        .then((master) => {
          const lines = master.split(/\r?\n/);
          let bestW = 0, bestH = 0, media = null, lastInf = null;
          lines.forEach((line) => {
            if (line.indexOf("#EXT-X-STREAM-INF:") === 0) lastInf = line;
            else if (lastInf && line && line[0] !== "#") {
              if (!media) media = line.trim();
              const m = /RESOLUTION=(\d+)x(\d+)/.exec(lastInf);
              if (m && parseInt(m[1], 10) > bestW) { bestW = parseInt(m[1], 10); bestH = parseInt(m[2], 10); }
              lastInf = null;
            }
          });
          if (!media) return resolve({ width: bestW, height: bestH, duration: NaN });
          return fetch(resolveUrl(src, media), { credentials: "omit", cache: "no-store" })
            .then((r) => { if (!r.ok) throw new Error("media"); return r.text(); })
            .then((text) => {
              let dur = 0, m;
              const re = /#EXTINF:([\d.]+)/g;
              while ((m = re.exec(text))) dur += parseFloat(m[1]);
              resolve({ width: bestW, height: bestH, duration: dur });
            });
        })
        .catch(() => resolve(empty));
    });
  }

  /**
   * Shared player setup.
   * mode "background": eager unless lazy="true", big buffer, no hover/ratio
   * mode "basic": supports lazy="meta", update-size, hover state
   */
  function setupPlayer(player, mode) {
    const src = player.getAttribute("data-player-src");
    const video = player.querySelector("video");
    if (!src || !video) return null;

    const isBasic = mode === "basic";
    const offs = [];
    let io = null;

    try { video.pause(); } catch (e) {}
    try { video.removeAttribute("src"); video.load(); } catch (e) {}

    const setStatus = (s) => player.getAttribute("data-player-status") !== s && player.setAttribute("data-player-status", s);
    const setActivated = (v) => player.setAttribute("data-player-activated", v ? "true" : "false");
    if (!player.hasAttribute("data-player-activated")) setActivated(false);

    const updateSize = isBasic ? player.getAttribute("data-player-update-size") : null;
    const lazyMode = player.getAttribute("data-player-lazy");
    const isLazyTrue = lazyMode === "true";
    const isLazyMeta = isBasic && lazyMode === "meta";
    const autoplay = player.getAttribute("data-player-autoplay") === "true";

    let pendingPlay = false;
    let isAttached = false;
    let lastPauseBy = "";

    if (autoplay) { video.muted = true; video.loop = true; video.autoplay = false; }
    else video.muted = isBasic ? false : player.getAttribute("data-player-muted") === "true";

    if (!isBasic || autoplay) video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.playsInline = true;
    if (typeof video.disableRemotePlayback !== "undefined") video.disableRemotePlayback = true;

    // Which engine: hls.js wherever it's supported, except iPhone/iPad where
    // native HLS is the reliable path. Recent Chrome also plays HLS natively,
    // but with the Bunny CDN that fails intermittently
    // (ERR_CONTENT_DECODING_FAILED -> video stuck), so we don't use it there.
    const nativeHls = !!video.canPlayType("application/vnd.apple.mpegurl");
    const hlsJsSupported = !!(window.Hls && Hls.isSupported());
    const isSafariNative = nativeHls && (IS_IOS || !hlsJsSupported);
    const canUseHlsJs = hlsJsSupported && !isSafariNative;
    let nativeRetries = 0;
    let hlsRecoveries = 0;

    function useHlsJs() {
      if (player._hls) { try { player._hls.destroy(); } catch (e) {} player._hls = null; }
      try { video.removeAttribute("src"); video.load(); } catch (e) {}
      const hls = new Hls(
        isBasic
          ? { maxBufferLength: 10 }
          : {
              // Background loops are short: 30s ahead is plenty and keeps
              // memory down on pages with many videos
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              maxBufferSize: 60 * 1000 * 1000,
              maxBufferHole: 0.3,
              autoStartLoad: true,
              startLevel: -1, // automatic quality
              // start from a realistic bandwidth guess instead of 500 kbps,
              // so the first frames aren't the blurry lowest rendition
              abrEwmaDefaultEstimate: 3000000,
              backBufferLength: 30,
              lowLatencyMode: false
            }
      );
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(src));
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        readyIfIdle(player, pendingPlay);
        if (updateSize === "true") {
          const best = bestLevel(hls.levels || []);
          if (best && best.width && best.height) setBeforeRatio(player, updateSize, best.width, best.height);
        }
        if (pendingPlay || (autoplay && lastPauseBy === "" && isInView)) safePlay(video);
      });
      // recover instead of getting stuck on a failed request or decode
      hls.on(Hls.Events.ERROR, (e, data) => {
        if (!data || !data.fatal) return;
        if (hlsRecoveries++ >= 3) { try { hls.destroy(); } catch (err) {} player._hls = null; return; }
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) setTimeout(() => hls.startLoad(), 1000);
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else setTimeout(useHlsJs, 1000);
      });
      player._hls = hls;
    }

    // native playback failed: fall back to hls.js, or retry once
    offs.push(VDJ.on(video, "error", () => {
      if (!isAttached || player._hls) return;
      if (hlsJsSupported && !player._hls) { useHlsJs(); return; }
      if (nativeRetries++ < 2) {
        setTimeout(() => {
          video.src = src;
          video.load();
          if (pendingPlay || isInView) safePlay(video);
        }, 800 * nativeRetries);
      }
    }));

    let isInView = false;

    function attachMediaOnce() {
      if (isAttached) return;
      isAttached = true;
      if (player._hls) { try { player._hls.destroy(); } catch (e) {} player._hls = null; }

      if (isSafariNative) {
        video.preload = "auto";
        video.src = src;
        video.addEventListener("loadedmetadata", () => {
          readyIfIdle(player, pendingPlay);
          if (updateSize === "true") setBeforeRatio(player, updateSize, video.videoWidth, video.videoHeight);
        }, { once: true });
      } else if (canUseHlsJs) {
        useHlsJs();
      } else {
        video.preload = "auto";
        video.src = src;
      }
    }

    // Initial attach strategy
    if (isLazyMeta) {
      if (updateSize === "true") {
        getSourceMeta(src, canUseHlsJs).then((meta) => {
          if (meta.width && meta.height) setBeforeRatio(player, updateSize, meta.width, meta.height);
          readyIfIdle(player, pendingPlay);
        });
      }
      video.preload = "none";
    } else if (isLazyTrue) {
      video.preload = "none";
    } else {
      video.preload = "auto";
      attachMediaOnce();
    }

    function togglePlay() {
      if (video.paused || video.ended) {
        if ((isLazyTrue || isLazyMeta) && !isAttached) attachMediaOnce();
        pendingPlay = true;
        lastPauseBy = "";
        setStatus("loading");
        safePlay(video);
      } else {
        lastPauseBy = "manual";
        video.pause();
      }
    }

    function toggleMute() {
      video.muted = !video.muted;
      player.setAttribute("data-player-muted", video.muted ? "true" : "false");
    }

    offs.push(
      VDJ.on(player, "click", (e) => {
        const btn = e.target.closest("[data-player-control]");
        if (!btn || !player.contains(btn)) return;
        const type = btn.getAttribute("data-player-control");
        if (type === "play" || type === "pause" || type === "playpause") togglePlay();
        else if (type === "mute") toggleMute();
      }),
      VDJ.on(video, "play", () => { setActivated(true); setStatus("playing"); }),
      VDJ.on(video, "playing", () => { pendingPlay = false; setStatus("playing"); }),
      VDJ.on(video, "pause", () => { pendingPlay = false; setStatus("paused"); }),
      VDJ.on(video, "waiting", () => setStatus("loading")),
      VDJ.on(video, "canplay", () => readyIfIdle(player, pendingPlay)),
      // first frame is there: show the video (CSS fades it in), even if it
      // hasn't started playing yet
      VDJ.on(video, "loadeddata", () => player.setAttribute("data-player-frame", "true")),
      VDJ.on(video, "ended", () => { pendingPlay = false; setStatus("paused"); setActivated(false); })
    );

    if (isBasic) {
      const setHover = (state) => player.getAttribute("data-player-hover") !== state && player.setAttribute("data-player-hover", state);
      const setRatioFromVideo = () => {
        if (updateSize === "true" && video.videoWidth && video.videoHeight) setBeforeRatio(player, updateSize, video.videoWidth, video.videoHeight);
      };
      offs.push(
        VDJ.on(player, "pointerenter", () => setHover("active")),
        VDJ.on(player, "pointerleave", () => setHover("idle")),
        VDJ.on(video, "loadedmetadata", setRatioFromVideo),
        VDJ.on(video, "loadeddata", setRatioFromVideo)
      );
    }

    // Lazy players: start loading about one screen before they scroll into
    // view, so they're ready (not popping in) by the time you see them
    let preloadIo = null;
    if ((isLazyTrue || isLazyMeta) && autoplay) {
      preloadIo = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          attachMediaOnce();
          preloadIo.disconnect();
        }
      }, { rootMargin: "100% 0px 100% 0px" });
      preloadIo.observe(player);
    }

    // Autoplay: play while in view, pause when out of view
    if (autoplay) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          isInView = entry.isIntersecting && entry.intersectionRatio > 0;
          if (isInView) {
            if ((isLazyTrue || isLazyMeta) && !isAttached) attachMediaOnce();
            if (lastPauseBy === "io" || (video.paused && lastPauseBy !== "manual")) {
              setStatus("loading");
              if (video.paused) togglePlay();
              lastPauseBy = "";
            }
          } else if (!video.paused && !video.ended) {
            lastPauseBy = "io";
            video.pause();
          }
        });
      }, { threshold: 0.1 });
      io.observe(player);
    }

    return function destroy() {
      offs.forEach((off) => off());
      if (io) io.disconnect();
      if (preloadIo) preloadIo.disconnect();
      try { video.pause(); } catch (e) {}
      if (player._hls) { try { player._hls.destroy(); } catch (e) {} player._hls = null; }
      try { video.removeAttribute("src"); video.load(); } catch (e) {}
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Images                                                                   */
  /* Webflow gives every image sizes="100vw", so a 450px image downloads the  */
  /* full-screen version. We set sizes to the real rendered width and start   */
  /* loading lazy images a screen early. Images that still arrive late fade   */
  /* in instead of popping in.                                                */
  /* ----------------------------------------------------------------------- */
  VDJ.page("images", function () {
    const images = Array.from(document.querySelectorAll("img")).filter(
      (img) => !img.closest(".navbar_wrapper, .project_cards_source") && !(img.complete && img.naturalWidth)
    );
    if (!images.length) return;

    images.forEach((img) => {
      // real width for srcset selection (only for responsive images)
      if (img.srcset && (!img.sizes || img.sizes === "100vw")) {
        const w = Math.ceil(img.getBoundingClientRect().width || img.parentElement?.getBoundingClientRect().width || 0);
        if (w > 0) img.sizes = `${w}px`;
      }
      img.classList.add("vdj-img-loading");
    });

    // fade in when loaded. Listening on the document (capture) also covers
    // copies made later, e.g. the cards the home canvas clones.
    const done = (e) => {
      const img = e.target;
      if (!img || img.tagName !== "IMG" || !img.classList.contains("vdj-img-loading")) return;
      // transition only while fading in, so it never slows down GSAP
      // animations on images later
      img.classList.add("vdj-img-fade");
      img.classList.remove("vdj-img-loading");
      setTimeout(() => img.classList.remove("vdj-img-fade"), 600);
    };
    const offs = [VDJ.on(document, "load", done, true), VDJ.on(document, "error", done, true)];
    // never leave an image hidden
    const failsafe = setTimeout(() => {
      document.querySelectorAll("img.vdj-img-loading").forEach((img) => img.classList.remove("vdj-img-loading"));
    }, 8000);
    const timers = [failsafe];

    const lazy = images.filter((img) => img.loading === "lazy");
    let io = null;
    if (lazy.length && "IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.loading = "eager"; // starts the download now
          io.unobserve(entry.target);
        });
      }, { rootMargin: "150% 0px 150% 0px" });
      lazy.forEach((img) => io.observe(img));
    }

    return () => {
      offs.forEach((off) => off());
      timers.forEach(clearTimeout);
      if (io) io.disconnect();
      document.querySelectorAll("img.vdj-img-loading").forEach((img) => img.classList.remove("vdj-img-loading"));
    };
  });

  VDJ.page("bunny-players", function (container) {
    const destroyers = [];
    container.querySelectorAll("[data-bunny-background-init]").forEach((p) => destroyers.push(setupPlayer(p, "background")));
    container.querySelectorAll("[data-bunny-player-init]").forEach((p) => destroyers.push(setupPlayer(p, "basic")));
    return () => destroyers.forEach((d) => d && d());
  });
})();

/* ---- src/modules/gallery.js ---- */
/* =========================================================================
   Image gallery lightbox: [data-gallery] (was image.gallery.js)
   ========================================================================= */
(function () {
  "use strict";
  const VDJ = window.VDJ;

  function createLightbox(container) {
    const el = {
      wrapper: container.querySelector('[data-lightbox="wrapper"]'),
      triggers: container.querySelectorAll('[data-lightbox="trigger"]'),
      triggerParents: container.querySelectorAll('[data-lightbox="trigger-parent"]'),
      items: container.querySelectorAll('[data-lightbox="item"]'),
      nav: container.querySelectorAll('[data-lightbox="nav"]'),
      current: container.querySelector('[data-lightbox="counter-current"]'),
      total: container.querySelector('[data-lightbox="counter-total"]'),
      prev: container.querySelector('[data-lightbox="prev"]'),
      next: container.querySelector('[data-lightbox="next"]'),
      close: container.querySelector('[data-lightbox="close"]')
    };
    if (!el.wrapper || !el.items.length) return null;

    const offs = [];
    const mainTimeline = gsap.timeline();
    const isActive = () => el.wrapper.classList.contains("is-active");

    if (el.total) el.total.textContent = el.triggers.length;

    function updateActiveItem(index) {
      el.items.forEach((item) => item.classList.remove("is-active"));
      el.items[index].classList.add("is-active");
      if (el.current) el.current.textContent = index + 1;
    }

    function closeLightbox() {
      if (!isActive()) return;
      container.removeEventListener("click", handleOutsideClick);
      mainTimeline.clear();
      gsap.killTweensOf([el.wrapper, el.nav, el.triggerParents, el.items, container.querySelector('[data-lightbox="original"]')]);

      const originalItem = container.querySelector('[data-lightbox="original"]');
      const originalParent = container.querySelector('[data-lightbox="original-parent"]');
      if (originalItem && originalParent) {
        gsap.set(originalItem, { clearProps: "all" });
        originalParent.appendChild(originalItem);
        originalParent.removeAttribute("data-lightbox");
        originalItem.removeAttribute("data-lightbox");
      }

      const activeSlide = container.querySelector('[data-lightbox="item"].is-active');

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        onComplete: () => {
          el.wrapper.classList.remove("is-active");
          el.items.forEach((item) => {
            item.classList.remove("is-active");
            const img = item.querySelector("img");
            if (img) img.style.display = "";
          });
          if (originalParent && originalParent.parentElement) originalParent.parentElement.style.removeProperty("height");
        }
      });

      tl.to(el.triggerParents, { autoAlpha: 1, duration: 0.5, stagger: 0.03, overwrite: true })
        .to(el.nav, { autoAlpha: 0, y: "1rem", duration: 0.4, stagger: 0 }, "<")
        .to(el.wrapper, { backgroundColor: "rgba(0,0,0,0)", duration: 0.4 }, "<");
      if (activeSlide) tl.to(activeSlide, { autoAlpha: 0, duration: 0.4 }, "<");
      tl.set([el.items, el.triggerParents], { clearProps: "all" });

      mainTimeline.add(tl);
    }

    function handleOutsideClick(event) {
      if (event.detail === 0) return; // keyboard "click"
      const inside = event.target.closest(
        '[data-lightbox="item"].is-active img, [data-lightbox="nav"], [data-lightbox="close"], [data-lightbox="trigger"]'
      );
      if (!inside) closeLightbox();
    }

    el.triggers.forEach((trigger, index) => {
      offs.push(
        VDJ.on(trigger, "click", () => {
          if (typeof Flip === "undefined") return;
          const img = trigger.querySelector("img");
          if (!img) return;

          VDJ.track(() => {
            mainTimeline.clear();
            gsap.killTweensOf([el.wrapper, el.nav, el.triggerParents]);

            const state = Flip.getState(img);
            trigger.parentElement.style.height = `${trigger.getBoundingClientRect().height}px`;
            trigger.setAttribute("data-lightbox", "original-parent");
            img.setAttribute("data-lightbox", "original");
            updateActiveItem(index);

            // listen on the next frame so this click doesn't close it again
            requestAnimationFrame(() => container.addEventListener("click", handleOutsideClick));

            el.wrapper.classList.add("is-active");
            const targetItem = el.items[index];
            const lightboxImage = targetItem.querySelector("img");
            if (lightboxImage) lightboxImage.style.display = "none";

            el.triggerParents.forEach((other) => {
              if (other !== trigger) gsap.to(other, { autoAlpha: 0, duration: 0.4, overwrite: true });
            });

            const tl = gsap.timeline();
            if (!targetItem.contains(img)) {
              targetItem.appendChild(img);
              tl.add(Flip.from(state, { targets: img, absolute: true, duration: 0.6, ease: "power2.inOut" }), 0);
            }
            tl.to(el.wrapper, { backgroundColor: "rgba(0,0,0,0.75)", duration: 0.6 }, 0)
              .fromTo(el.nav, { autoAlpha: 0, y: "1rem" }, { autoAlpha: 1, y: "0rem", duration: 0.6, stagger: { each: 0.05, from: "center" } }, 0.2);
            mainTimeline.add(tl);
          });
        })
      );
    });

    const step = (dir) => {
      const i = Array.from(el.items).findIndex((item) => item.classList.contains("is-active"));
      updateActiveItem((i + dir + el.items.length) % el.items.length);
    };
    if (el.next) offs.push(VDJ.on(el.next, "click", () => step(1)));
    if (el.prev) offs.push(VDJ.on(el.prev, "click", () => step(-1)));
    if (el.close) offs.push(VDJ.on(el.close, "click", closeLightbox));

    offs.push(
      VDJ.on(document, "keydown", (e) => {
        if (!isActive()) return;
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      })
    );

    return () => {
      offs.forEach((off) => off());
      container.removeEventListener("click", handleOutsideClick);
      mainTimeline.kill();
    };
  }

  VDJ.page("gallery", function (container) {
    const cleanups = [];
    container.querySelectorAll("[data-gallery]").forEach((wrap) => {
      const c = createLightbox(wrap);
      if (c) cleanups.push(c);
    });
    return () => cleanups.forEach((c) => c());
  });
})();

/* ---- src/modules/home.js ---- */
/* =========================================================================
   Home + /ons-werk: project canvas, list mode, mode switcher, text loop,
   overlap fade, project card hover, cutout shake, disappear text
   ========================================================================= */
(function () {
  "use strict";
  const VDJ = window.VDJ;

  /* ----------------------------------------------------------------------- */
  /* Project card hover (also used for cards cloned into the canvas)          */
  /* ----------------------------------------------------------------------- */
  function initProjectCardHover(scope) {
    const offs = [];
    scope.querySelectorAll(".project_card").forEach((card) => {
      const details = card.querySelector(".project_details_wrapper");
      if (!details || card.dataset.hoverInitialized === "true") return;
      card.dataset.hoverInitialized = "true";

      gsap.set(details, { opacity: 0, y: 12 });
      let tween = null;
      const show = () => { if (tween) tween.kill(); tween = gsap.to(details, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }); };
      const hide = () => { if (tween) tween.kill(); tween = gsap.to(details, { opacity: 0, y: 12, duration: 0.25, ease: "power2.out" }); };
      offs.push(VDJ.on(card, "mouseenter", show), VDJ.on(card, "mouseleave", hide));
    });
    return () => offs.forEach((off) => off());
  }

  /* ----------------------------------------------------------------------- */
  /* Text loop (vertical ticker with the centred item highlighted)            */
  /* ----------------------------------------------------------------------- */
  function initTextLoop(container) {
    const inner = container.querySelector(".text_loop_inner");
    if (!inner) return;
    const label = inner.querySelector("h2");
    const itemsWrap = inner.querySelector(".text_loop_items");
    const listFlex = inner.querySelector(".text_loop_list_flex");
    if (!label || !itemsWrap || !listFlex) return;

    const originalItems = Array.from(listFlex.querySelectorAll(".text_loop_item"));
    if (!originalItems.length) return;

    let loopTween = null;
    let hoveredItem = null;
    let resizeTimer = null;

    const centerY = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };

    function updateActiveItem() {
      const allItems = listFlex.querySelectorAll(".text_loop_item");
      if (!allItems.length) return;
      if (hoveredItem) {
        allItems.forEach((item) => (item.style.opacity = item === hoveredItem ? "1" : "0.25"));
        return;
      }
      const ref = VDJ.mq("(max-width: 991px)") ? itemsWrap : label;
      const refY = centerY(ref);
      let closest = null;
      let best = Infinity;
      allItems.forEach((item) => {
        const d = Math.abs(centerY(item) - refY);
        if (d < best) { best = d; closest = item; }
      });
      allItems.forEach((item) => (item.style.opacity = item === closest ? "1" : "0.25"));
    }

    function setHeight(items) {
      const styles = getComputedStyle(listFlex);
      const gap = parseFloat(styles.rowGap || styles.gap) || 0;
      return items.reduce((t, item, i) => t + item.offsetHeight + (i < items.length - 1 ? gap : 0), 0);
    }

    function buildLoop() {
      if (loopTween) { loopTween.kill(); loopTween = null; }
      hoveredItem = null;
      gsap.set(listFlex, { y: 0 });
      listFlex.innerHTML = "";
      originalItems.forEach((item) => listFlex.appendChild(item));

      const originalSetHeight = setHeight(originalItems);
      const visibleHeight = itemsWrap.offsetHeight;
      if (!originalSetHeight || !visibleHeight) return;

      const minTotalHeight = visibleHeight + originalSetHeight * 2;
      let currentHeight = originalSetHeight;
      let repeats = 0;
      while (currentHeight < minTotalHeight && repeats < 50) {
        originalItems.forEach((item) => {
          const clone = item.cloneNode(true);
          clone.setAttribute("aria-hidden", "true");
          listFlex.appendChild(clone);
        });
        repeats++;
        currentHeight = originalSetHeight * (repeats + 1);
      }

      const wrapY = gsap.utils.wrap(-originalSetHeight, 0);
      loopTween = gsap.to(listFlex, {
        y: -originalSetHeight,
        duration: 28,
        ease: "none",
        repeat: -1,
        modifiers: { y: (v) => wrapY(parseFloat(v)) + "px" },
        onUpdate: updateActiveItem
      });
      updateActiveItem();
    }

    const onMouseOver = (e) => {
      const item = e.target.closest(".text_loop_item");
      if (!item || !listFlex.contains(item)) return;
      hoveredItem = item;
      if (loopTween) loopTween.pause();
      updateActiveItem();
    };
    const onMouseOut = (e) => {
      const item = e.target.closest(".text_loop_item");
      if (!item || !listFlex.contains(item)) return;
      if (e.relatedTarget && item.contains(e.relatedTarget)) return;
      hoveredItem = null;
      if (loopTween) loopTween.resume();
      updateActiveItem();
    };
    let lastWidth = window.innerWidth;
    const onResize = () => {
      // ignore height-only resizes (mobile address bar)
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => VDJ.track(buildLoop), 150);
    };

    const offs = [VDJ.on(listFlex, "mouseover", onMouseOver), VDJ.on(listFlex, "mouseout", onMouseOut), VDJ.on(window, "resize", onResize)];
    buildLoop();

    return () => {
      offs.forEach((off) => off());
      clearTimeout(resizeTimer);
      if (loopTween) loopTween.kill();
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Mode switcher pill (canvas <-> list)                                     */
  /* ----------------------------------------------------------------------- */
  function initModeSwitcherPill(container, api) {
    const switcherInner = container.querySelector(".mode_switcher_inner");
    if (!switcherInner) return;
    const items = Array.from(switcherInner.querySelectorAll(".mode_switcher_left, .mode_switcher_right"));
    if (items.length < 2) return;

    if (!items.some((item) => item.classList.contains("is--active"))) items[0].classList.add("is--active");

    let pill = switcherInner.querySelector(".mode_switcher_pill");
    if (!pill) {
      pill = document.createElement("div");
      pill.className = "mode_switcher_pill";
      switcherInner.insertBefore(pill, switcherInner.firstChild);
    }

    let pillVisible = false;
    switcherInner.style.position = "relative";
    switcherInner.style.overflow = "hidden";
    gsap.set(pill, { position: "absolute", left: 0, top: 0, zIndex: 0, pointerEvents: "none", borderRadius: "999em", autoAlpha: 0 });
    items.forEach((item) => { item.style.position = "relative"; item.style.zIndex = "1"; });

    const getActiveItem = () => switcherInner.querySelector(".mode_switcher_left.is--active, .mode_switcher_right.is--active") || items[0];
    const revealPill = () => { pillVisible = true; gsap.to(pill, { autoAlpha: 1, duration: 0.35, ease: "power2.out", overwrite: "auto" }); };
    const hidePill = () => { pillVisible = false; gsap.set(pill, { autoAlpha: 0 }); };

    function movePill(animate) {
      const innerRect = switcherInner.getBoundingClientRect();
      const r = getActiveItem().getBoundingClientRect();
      gsap.to(pill, {
        x: r.left - innerRect.left, y: r.top - innerRect.top, width: r.width, height: r.height,
        duration: animate ? 0.55 : 0, ease: "expo.out", overwrite: true
      });
    }

    const offs = items.map((item) =>
      VDJ.on(item, "click", () => requestAnimationFrame(() => { movePill(true); if (pillVisible) revealPill(); }))
    );

    const mo = new MutationObserver(() => movePill(true));
    items.forEach((item) => mo.observe(item, { attributes: true, attributeFilter: ["class"] }));
    const ro = new ResizeObserver(() => movePill(false));
    ro.observe(switcherInner);
    items.forEach((item) => ro.observe(item));

    const initial = gsap.delayedCall(0.3, () => requestAnimationFrame(() => movePill(false)));
    let refreshCall = null;

    api.refreshPill = function (delay, animate) {
      hidePill();
      if (refreshCall) refreshCall.kill();
      refreshCall = gsap.delayedCall(delay || 0, () => {
        movePill(!!animate);
        requestAnimationFrame(() => { movePill(!!animate); revealPill(); });
      });
    };

    return () => {
      offs.forEach((off) => off());
      mo.disconnect();
      ro.disconnect();
      initial.kill();
      if (refreshCall) refreshCall.kill();
      api.refreshPill = null;
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Overlap fade: text loop section slides over the fixed hero canvas        */
  /* ----------------------------------------------------------------------- */
  function initOverlapFade(container, api) {
    const heroVisual = container.querySelector(".hero_canvas");
    const sections = container.querySelectorAll('.section_text_loop[data-overlap="true"]');
    if (!sections.length) return;

    const fns = [];
    const offs = [];
    sections.forEach((section) => {
      section.style.marginTop = "100vh";
      const inner = section.querySelector(".section_text_inner") || section;
      gsap.set(inner, { y: "2vh" });

      const onScroll = () => {
        if (api.isHeroListMode) return;
        const rect = section.getBoundingClientRect();
        const entryScrollY = Math.max(window.scrollY + rect.top - window.innerHeight * 0.3, 1);
        const progress = gsap.utils.clamp(0, 1, window.scrollY / entryScrollY);
        if (heroVisual) gsap.set(heroVisual, { opacity: 1 - progress });
        gsap.set(inner, { y: `${2 - progress * 2}vh` });
      };
      fns.push(onScroll);
      offs.push(VDJ.on(window, "scroll", onScroll, { passive: true }));
    });

    api.syncOverlap = () => fns.forEach((fn) => fn());

    return () => {
      offs.forEach((off) => off());
      sections.forEach((s) => (s.style.marginTop = ""));
      api.syncOverlap = null;
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Project canvas                                                           */
  /* ----------------------------------------------------------------------- */
  function initCanvas(container, api) {
    const viewport = container.querySelector(".canvas_viewport");
    const stage = container.querySelector(".canvas_stage");
    const source = container.querySelector(".project_cards_source");
    const overlay = container.querySelector(".canvas_overlay_content");
    const disappearTriggers = container.querySelectorAll('[data-pressed="disappear"]');
    const worldOverlay = container.querySelector(".canvas_world_overlay");
    if (!viewport || !stage || !source) return;

    if (worldOverlay) {
      worldOverlay.style.pointerEvents = "none";
      worldOverlay.querySelectorAll("a, button, input, textarea, select, [data-overlay-interactive]").forEach((el) => (el.style.pointerEvents = "auto"));
    }

    const sourceCards = Array.from(source.querySelectorAll(".project_card"));
    if (!sourceCards.length) return;

    const shouldStartInPanMode = VDJ.isPath("/ons-werk");

    const CARD_RATIO = 26 / 20;
    const BP = { mobile: 767, tablet: 991, smallDesktop: 1280 };
    const CANVAS_IDLE_SCALE = 0.9;
    const CANVAS_ACTIVE_SCALE = 0.99;
    const FLOAT_DISTANCE = 6;
    const FLOAT_ROTATION = 0.5;
    const PAN_LERP = 0.04;

    const state = { x: 0, y: 0, scale: CANVAS_IDLE_SCALE };
    const target = { x: 0, y: 0 };
    const bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    let cardWidth = 0, cardHeight = 0, gap = 0, padding = 0;
    let cols = 0, rows = 0, gridWidth = 0, gridHeight = 0, contentWidth = 0, contentHeight = 0;
    let floatingTweens = [];
    let idleRunning = false;
    let resizeTimer = null;
    let destroyed = false;
    let panEnabled = false;
    let dragTouch = null;
    let lastRendered = "";
    let cardHoverOff = null;
    const offs = [];
    const timers = [];

    const switcher = container.querySelector(".canvas_mode_switcher_wrapper");

    function render() {
      const t = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
      if (t === lastRendered) return; // nothing moved: skip the style write
      lastRendered = t;
      stage.style.transformOrigin = "50% 50%";
      stage.style.transform = t;
    }

    function computeBounds() {
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      if (contentWidth <= vw) bounds.minX = bounds.maxX = (vw - contentWidth) / 2;
      else { bounds.minX = vw - contentWidth; bounds.maxX = 0; }
      if (contentHeight <= vh) bounds.minY = bounds.maxY = (vh - contentHeight) / 2;
      else { bounds.minY = vh - contentHeight; bounds.maxY = 0; }
    }

    function clampPosition() {
      state.x = gsap.utils.clamp(bounds.minX, bounds.maxX, state.x);
      state.y = gsap.utils.clamp(bounds.minY, bounds.maxY, state.y);
    }

    const getCenterTarget = () => ({
      x: (viewport.clientWidth - contentWidth) / 2,
      y: (viewport.clientHeight - contentHeight) / 2
    });

    function computeLayoutMetrics() {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const vw = Math.max(viewport.clientWidth, 1);
      const vh = Math.max(viewport.clientHeight, 1);

      const mobile = vw <= BP.mobile;
      const tablet = vw > BP.mobile && vw <= BP.tablet;
      const smallDesktop = vw > BP.tablet && vw <= BP.smallDesktop;

      const minCardWidthRem = mobile ? 6 : tablet ? 11 : smallDesktop ? 12.5 : 15;
      const maxCardWidthRem = mobile ? 12 : tablet ? 15 : smallDesktop ? 16 : 18;
      const gapRem = mobile ? 4 : tablet ? 4 : smallDesktop ? 4.5 : 5.5;
      const paddingRem = mobile ? 2 : tablet ? 5 : smallDesktop ? 6 : 8;
      const worldMinScaleX = mobile ? 1.15 : tablet ? 1.15 : smallDesktop ? 1.2 : 1.45;
      const worldMinScaleY = mobile ? 1.2 : tablet ? 1.15 : smallDesktop ? 1.2 : 1.45;

      const minCardWidth = minCardWidthRem * rem;
      const maxCardWidth = maxCardWidthRem * rem;
      const baseGap = gapRem * rem;
      const basePadding = paddingRem * rem;
      const availableWidth = Math.max(vw - basePadding * 2, minCardWidth);
      const maxColsByWidth = Math.max(1, Math.floor((availableWidth + baseGap) / (minCardWidth + baseGap)));

      if (mobile) cols = Math.min(sourceCards.length, 2);
      else if (tablet) cols = Math.min(sourceCards.length, 4, maxColsByWidth);
      else cols = Math.min(sourceCards.length, 5, maxColsByWidth);
      rows = Math.ceil(sourceCards.length / cols);

      cardWidth = cols > 1
        ? Math.min(maxCardWidth, (availableWidth - baseGap * (cols - 1)) / cols)
        : Math.min(maxCardWidth, availableWidth);
      cardHeight = cardWidth * CARD_RATIO;
      gap = baseGap;
      padding = basePadding;

      gridWidth = cols * cardWidth + Math.max(cols - 1, 0) * gap;
      gridHeight = rows * cardHeight + Math.max(rows - 1, 0) * gap;
      contentWidth = gridWidth + padding * 2;
      contentHeight = gridHeight + padding * 2;

      const scaleX = (vw * worldMinScaleX) / Math.max(contentWidth, 1);
      const scaleY = (vh * worldMinScaleY) / Math.max(contentHeight, 1);
      const worldScale = mobile
        ? Math.max(1.0, Math.min(1.25, Math.max(scaleX, scaleY)))
        : tablet
        ? Math.max(1, Math.min(1.18, Math.max(scaleX, scaleY)))
        : smallDesktop
        ? Math.max(1, Math.min(1.22, Math.max(scaleX, scaleY)))
        : Math.max(1, scaleX, scaleY);

      cardWidth *= worldScale;
      cardHeight *= worldScale;
      gap *= worldScale;
      padding *= worldScale;

      gridWidth = cols * cardWidth + Math.max(cols - 1, 0) * gap;
      gridHeight = rows * cardHeight + Math.max(rows - 1, 0) * gap;
      contentWidth = gridWidth + padding * 2;
      contentHeight = gridHeight + padding * 2;

      computeBounds();
    }

    function centerView() {
      const c = getCenterTarget();
      state.x = target.x = c.x;
      state.y = target.y = c.y;
      render();
    }

    function buildWorld() {
      if (cardHoverOff) cardHoverOff();
      stage.innerHTML = "";
      Object.assign(stage.style, { position: "absolute", width: `${contentWidth}px`, height: `${contentHeight}px`, left: "0px", top: "0px" });

      sourceCards.forEach((sourceCard, index) => {
        const card = sourceCard.cloneNode(true);
        delete card.dataset.hoverInitialized;
        const col = index % cols;
        const row = Math.floor(index / cols);
        const cardsInRow = row === rows - 1 ? sourceCards.length - row * cols : cols;
        const rowWidth = cardsInRow * cardWidth + (cardsInRow - 1) * gap;
        const xOffset = (gridWidth - rowWidth) / 2;

        Object.assign(card.style, {
          position: "absolute",
          left: `${padding + xOffset + col * (cardWidth + gap)}px`,
          top: `${padding + row * (cardHeight + gap)}px`,
          width: `${cardWidth}px`,
          height: `${cardHeight}px`
        });
        stage.appendChild(card);
      });

      cardHoverOff = initProjectCardHover(stage);
    }

    function panTick() {
      const dx = target.x - state.x;
      const dy = target.y - state.y;
      if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
        state.x = target.x;
        state.y = target.y;
      } else {
        state.x += dx * PAN_LERP;
        state.y += dy * PAN_LERP;
      }
      render();
    }

    function onMouseMove(e) {
      if (!panEnabled) return;
      const nx = e.clientX / viewport.clientWidth;
      const ny = e.clientY / viewport.clientHeight;
      target.x = gsap.utils.mapRange(0, 1, bounds.maxX, bounds.minX, nx);
      target.y = gsap.utils.mapRange(0, 1, bounds.maxY, bounds.minY, ny);
    }

    function onTouchStart(e) {
      if (!panEnabled || !e.touches.length) return;
      const t = e.touches[0];
      dragTouch = { id: t.identifier, lastX: t.clientX, lastY: t.clientY };
    }

    function onTouchMove(e) {
      if (!panEnabled || !dragTouch) return;
      const t = Array.from(e.touches).find((x) => x.identifier === dragTouch.id);
      if (!t) return;
      const dx = t.clientX - dragTouch.lastX;
      const dy = t.clientY - dragTouch.lastY;
      dragTouch.lastX = t.clientX;
      dragTouch.lastY = t.clientY;
      target.x = gsap.utils.clamp(bounds.minX, bounds.maxX, target.x + dx);
      target.y = gsap.utils.clamp(bounds.minY, bounds.maxY, target.y + dy);
    }

    function onTouchEnd(e) {
      if (!dragTouch) return;
      if (!Array.from(e.touches).some((x) => x.identifier === dragTouch.id)) dragTouch = null;
    }

    function onWheel(e) {
      if (panEnabled) e.preventDefault();
    }

    function setPanEnabled(enabled) {
      panEnabled = enabled;

      const scrollWrapper = container.querySelector(".scroll_wrapper");
      if (scrollWrapper) gsap.to(scrollWrapper, { opacity: enabled ? 0 : 0.4, duration: 0.5, ease: "power2.out" });

      if (enabled) {
        document.body.style.overflow = "hidden";
        if (window.lenis) {
          window.lenis.scrollTo(0, {
            duration: 0.6,
            force: true,
            onComplete: () => { if (panEnabled && !destroyed) window.lenis.stop(); }
          });
        } else window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        if (window.lenis) window.lenis.start();
        document.body.style.overflow = "";
      }

      gsap.to(state, {
        scale: enabled ? CANVAS_ACTIVE_SCALE : CANVAS_IDLE_SCALE,
        duration: enabled ? 0.9 : 0.55,
        ease: enabled ? "expo.out" : "power3.out",
        overwrite: true,
        onUpdate: render
      });

      if (!enabled) {
        dragTouch = null;
        const c = getCenterTarget();
        target.x = c.x;
        target.y = c.y;
      }

      refreshIdleAnimation();
    }

    function isOverlayVisible() {
      if (!overlay || overlay.style.display === "none") return false;
      return getComputedStyle(overlay).display !== "none";
    }

    function startIdleAnimation() {
      if (idleRunning) return;
      floatingTweens = Array.from(stage.querySelectorAll(".project_card")).map((card, i) =>
        gsap.to(card, {
          x: FLOAT_DISTANCE * (0.45 + (i % 5) * 0.14) * (i % 2 === 0 ? 1 : -1),
          y: FLOAT_DISTANCE * (0.55 + (i % 4) * 0.12) * (i % 3 === 0 ? -1 : 1),
          rotation: FLOAT_ROTATION * (i % 2 === 0 ? 1 : -1),
          duration: 3.4 + (i % 6) * 0.35,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: i * 0.04
        })
      );
      idleRunning = true;
    }

    function stopIdleAnimation() {
      if (!idleRunning) return;
      floatingTweens.forEach((t) => t.kill());
      floatingTweens = [];
      gsap.to(stage.querySelectorAll(".project_card"), { x: 0, y: 0, rotation: 0, duration: 0.45, ease: "power3.out", overwrite: true });
      idleRunning = false;
    }

    function refreshIdleAnimation() {
      if (isOverlayVisible() && !panEnabled) startIdleAnimation();
      else stopIdleAnimation();
    }

    function showCanvasControlsImmediately() {
      const left = switcher && switcher.querySelector(".mode_switcher_left");
      const right = switcher && switcher.querySelector(".mode_switcher_right");
      const texts = switcher ? switcher.querySelectorAll(".text_eye") : [];
      const worldTexts = worldOverlay ? worldOverlay.querySelectorAll(".overlay_text_wrapper > *") : [];

      if (switcher) gsap.set(switcher, { opacity: 1, y: 0, pointerEvents: "auto" });
      if (left) gsap.set(left, { opacity: 1, x: 0 });
      if (right) gsap.set(right, { opacity: 1, x: 0 });
      if (texts.length) gsap.set(texts, { opacity: 1, y: 0 });
      if (worldOverlay) gsap.set(worldOverlay, { opacity: 1, y: 0, filter: "blur(0px)", pointerEvents: "none" });
      if (worldTexts.length) gsap.set(worldTexts, { opacity: 1, y: 0, filter: "blur(0px)" });
      if (api.refreshPill) api.refreshPill(0.05, false);
    }

    function hideOverlayImmediately() {
      if (!overlay) return;
      Object.assign(overlay.style, { transition: "", opacity: "0", display: "none", pointerEvents: "none" });
    }

    function showOpeningState() {
      const overlayInner = overlay && overlay.querySelector(".canvas_overlay_inner");
      const textWrapper = overlay && overlay.querySelector(".overlay_text_wrapper");
      const buttonWrapper = overlay && overlay.querySelector(".button_wrapper");
      const overlayTexts = textWrapper
        ? Array.from(textWrapper.children).filter((c) => c !== buttonWrapper && !c.contains(buttonWrapper))
        : [];
      const overlayBlur = overlay && overlay.querySelector(".canvas_overlay_bg_blur");

      if (switcher) gsap.to(switcher, { opacity: 0, y: 20, duration: 0.35, pointerEvents: "none", ease: "power3.out" });
      if (worldOverlay) gsap.to(worldOverlay, { opacity: 0, y: 16, filter: "blur(8px)", duration: 0.35, pointerEvents: "none", ease: "power3.out" });
      if (!overlay) return;

      overlay.style.display = "";
      overlay.style.pointerEvents = "auto";
      gsap.set(overlay, { opacity: 0 });
      if (overlayInner) gsap.set(overlayInner, { opacity: 0, y: -18, filter: "blur(10px)" });
      if (overlayBlur) gsap.set(overlayBlur, { opacity: 0, filter: "blur(18px)" });
      if (overlayTexts.length) gsap.set(overlayTexts, { opacity: 0, y: 18 });
      if (buttonWrapper) gsap.set(buttonWrapper, { opacity: 0, y: 14 });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" }, onComplete: refreshIdleAnimation });
      tl.to(overlay, { opacity: 1, duration: 0.45 }, 0);
      if (overlayBlur) tl.to(overlayBlur, { opacity: 1, filter: "blur(0px)", duration: 0.55 }, 0.05);
      if (overlayInner) tl.to(overlayInner, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6 }, 0.08);
      if (overlayTexts.length) tl.to(overlayTexts, { opacity: 1, y: 0, duration: 0.55, stagger: 0.055 }, 0.16);
      if (buttonWrapper) tl.to(buttonWrapper, { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, 0.12);
    }

    function resetToOpeningState() {
      stopIdleAnimation();
      dragTouch = null;
      if (api.resetHeroListMode) api.resetHeroListMode();
      setPanEnabled(false);
      centerView();
      showOpeningState();
    }

    function rebuildScene(preservePosition) {
      computeLayoutMetrics();
      buildWorld();
      if (preservePosition) { clampPosition(); render(); }
      else centerView();
      refreshIdleAnimation();
    }

    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    function onResize() {
      // Mobile address bar changes only the height by a few px: don't rebuild
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === lastWidth && Math.abs(h - lastHeight) < 120) return;
      lastWidth = w;
      lastHeight = h;

      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (destroyed) return;
        VDJ.track(() => {
          stopIdleAnimation();
          rebuildScene(false);
          refreshIdleAnimation();
          if (api.refreshPill) api.refreshPill(0, false);
        });
        VDJ.refreshScroll();
      }, 120);
    }

    function wireDisappearTriggers() {
      if (!disappearTriggers.length || !overlay) return;

      const overlayInner = overlay.querySelector(".canvas_overlay_inner");
      const textWrapper = overlay.querySelector(".overlay_text_wrapper");
      const overlayHeading = textWrapper ? textWrapper.querySelector("h1") : null;
      const buttonWrapper = overlay.querySelector(".button_wrapper");
      const overlayBlur = overlay.querySelector(".canvas_overlay_bg_blur");
      const worldOverlayInner = worldOverlay && worldOverlay.querySelector(".canvas_overlay_inner");
      const worldOverlayTexts = worldOverlay ? worldOverlay.querySelectorAll(".overlay_text_wrapper > *") : [];
      const switcherInner = switcher && switcher.querySelector(".mode_switcher_inner");
      const switcherLeft = switcher && switcher.querySelector(".mode_switcher_left");
      const switcherRight = switcher && switcher.querySelector(".mode_switcher_right");
      const switcherTexts = switcher ? switcher.querySelectorAll(".text_eye") : [];
      const leftIcon = switcherLeft && switcherLeft.querySelector(".eye_icon");
      const rightIcon = switcherRight && switcherRight.querySelector(".eye_icon");
      const leftPaths = leftIcon ? leftIcon.querySelectorAll("path") : [];
      const rightPaths = rightIcon ? rightIcon.querySelectorAll("path") : [];

      let transitionTween = null;

      function prepIconPaths(paths) {
        paths.forEach((path) => {
          try {
            const len = path.getTotalLength() + 4;
            Object.assign(path.style, { strokeDasharray: len, strokeDashoffset: len, opacity: "1", strokeLinecap: "round", strokeLinejoin: "round" });
          } catch (e) {}
        });
      }

      if (!shouldStartInPanMode) {
        if (switcher) gsap.set(switcher, { opacity: 0, y: 20, pointerEvents: "none" });
        const pill = switcher && switcher.querySelector(".mode_switcher_pill");
        if (pill) gsap.set(pill, { autoAlpha: 0 });
        if (worldOverlay) gsap.set(worldOverlay, { opacity: 0, y: 16, filter: "blur(8px)", pointerEvents: "none" });
        if (worldOverlayTexts.length) gsap.set(worldOverlayTexts, { opacity: 0, y: 12, filter: "blur(10px)" });
        if (switcherInner) gsap.set(switcherInner, { opacity: 1 });
        if (switcherLeft) gsap.set(switcherLeft, { opacity: 0, x: -14 });
        if (switcherRight) gsap.set(switcherRight, { opacity: 0, x: 14 });
        if (switcherTexts.length) gsap.set(switcherTexts, { opacity: 0, y: 8 });
        if (leftIcon) { gsap.set(leftIcon, { opacity: 1, scale: 1, transformOrigin: "50% 50%" }); prepIconPaths(leftPaths); }
        if (rightIcon) { gsap.set(rightIcon, { opacity: 1, scale: 1, transformOrigin: "50% 50%" }); prepIconPaths(rightPaths); }
      }

      const handler = (e) => {
        if (e) e.preventDefault();
        if (transitionTween) transitionTween.kill();

        VDJ.track(() => {
          const pill = switcher && switcher.querySelector(".mode_switcher_pill");
          if (pill) gsap.set(pill, { autoAlpha: 0 });
          stopIdleAnimation();

          overlay.style.pointerEvents = "none";
          overlay.style.willChange = "opacity";
          if (overlayInner) overlayInner.style.willChange = "transform, opacity, filter";
          if (overlayBlur) overlayBlur.style.willChange = "opacity, filter";
          if (worldOverlay) worldOverlay.style.willChange = "transform, opacity, filter";
          if (worldOverlayInner) worldOverlayInner.style.willChange = "transform, opacity, filter";

          let headingSplit = null;
          let headingTargets = null;
          if (overlayHeading && typeof SplitText !== "undefined") {
            headingSplit = SplitText.create(overlayHeading, { type: "lines,words", mask: "lines", autoSplit: false, linesClass: "line", wordsClass: "word" });
            headingTargets = headingSplit.words && headingSplit.words.length ? headingSplit.words : headingSplit.lines;
          }

          prepIconPaths(leftPaths);
          prepIconPaths(rightPaths);

          transitionTween = gsap.timeline({
            defaults: { ease: "power3.out" },
            onComplete: () => {
              Object.assign(overlay.style, { display: "none", opacity: "0", pointerEvents: "none", willChange: "" });
              [overlayInner, overlayBlur, worldOverlay, worldOverlayInner].forEach((el) => el && (el.style.willChange = ""));
              if (headingSplit) { try { headingSplit.revert(); } catch (err) {} }
              transitionTween = null;
              setPanEnabled(true);
              refreshIdleAnimation();
            }
          });

          const t = transitionTween;
          if (headingTargets && headingTargets.length) t.to(headingTargets, { yPercent: -110, opacity: 0, duration: 0.75, stagger: 0.035, ease: "expo.inOut" }, 0);
          else if (overlayHeading) t.to(overlayHeading, { y: -18, opacity: 0, duration: 0.6, ease: "expo.inOut" }, 0);
          if (buttonWrapper) t.to(buttonWrapper, { y: 14, opacity: 0, duration: 0.35, ease: "power2.out" }, 0.28);
          if (overlayBlur) t.to(overlayBlur, { opacity: 0, filter: "blur(18px)", duration: 0.55, ease: "power2.out" }, 0.58);
          if (overlayInner) t.to(overlayInner, { y: -18, opacity: 0, filter: "blur(10px)", duration: 0.55, ease: "power2.out" }, 0.62);
          t.to(overlay, { opacity: 0, duration: 0.42, ease: "power2.out" }, 0.68);
          if (switcher) t.to(switcher, { opacity: 1, y: 0, duration: 0.5, pointerEvents: "auto", ease: "power3.out" }, 0.78);
          if (worldOverlay) t.to(worldOverlay, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, pointerEvents: "none", ease: "power3.out" }, 0.84);
          if (worldOverlayTexts.length) t.to(worldOverlayTexts, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, stagger: 0.08, ease: "power2.out" }, 0.96);
          if (switcherLeft) t.to(switcherLeft, { opacity: 1, x: 0, duration: 0.42 }, 0.9);
          if (switcherRight) t.to(switcherRight, { opacity: 1, x: 0, duration: 0.42 }, 0.96);
          if (leftPaths.length) t.to(leftPaths, { strokeDashoffset: 0, duration: 0.34, stagger: 0.06, ease: "power2.out" }, 0.98);
          if (rightPaths.length) t.to(rightPaths, { strokeDashoffset: 0, duration: 0.32, stagger: 0.055, ease: "power2.out" }, 1.04);
          if (switcherTexts.length) t.to(switcherTexts, { opacity: 1, y: 0, duration: 0.34, stagger: 0.08, ease: "power2.out" }, 1.08);
          t.call(() => api.refreshPill && api.refreshPill(0.3, false), null, 1.12);
        });
      };

      disappearTriggers.forEach((el) => offs.push(VDJ.on(el, "click", handler)));
    }

    function buildWhenReady(attempt) {
      if (destroyed) return;
      if ((!viewport.clientWidth || !viewport.clientHeight) && attempt < 40) {
        requestAnimationFrame(() => buildWhenReady(attempt + 1));
        return;
      }

      VDJ.track(() => {
        rebuildScene(false);

        if (shouldStartInPanMode) {
          setPanEnabled(true);
          hideOverlayImmediately();
          showCanvasControlsImmediately();
          VDJ.afterPaint(() => {
            if (destroyed) return;
            VDJ.track(() => { rebuildScene(true); showCanvasControlsImmediately(); });
            timers.push(setTimeout(() => {
              if (destroyed) return;
              VDJ.track(() => {
                rebuildScene(true);
                showCanvasControlsImmediately();
                if (api.refreshPill) api.refreshPill(0, false);
              });
              VDJ.refreshScroll();
            }, 80));
          });
        } else {
          setPanEnabled(false);
        }
        refreshIdleAnimation();
      });
    }

    api.setPanEnabled = setPanEnabled;

    gsap.ticker.add(panTick);
    offs.push(
      VDJ.on(window, "mousemove", onMouseMove),
      VDJ.on(viewport, "touchstart", onTouchStart, { passive: true }),
      VDJ.on(viewport, "touchmove", onTouchMove, { passive: true }),
      VDJ.on(viewport, "touchend", onTouchEnd, { passive: true }),
      VDJ.on(viewport, "touchcancel", onTouchEnd, { passive: true }),
      VDJ.on(viewport, "wheel", onWheel, { passive: false }),
      VDJ.on(window, "resize", onResize)
    );

    container.querySelectorAll("[data-canvas-reset]").forEach((btn) =>
      offs.push(VDJ.on(btn, "click", () => VDJ.track(resetToOpeningState)))
    );

    wireDisappearTriggers();
    buildWhenReady(0);

    return () => {
      destroyed = true;
      stopIdleAnimation();
      floatingTweens.forEach((t) => t.kill());
      clearTimeout(resizeTimer);
      timers.forEach(clearTimeout);
      gsap.ticker.remove(panTick);
      offs.forEach((off) => off());
      if (cardHoverOff) cardHoverOff();
      if (window.lenis) window.lenis.start();
      document.body.style.overflow = "";
      api.setPanEnabled = null;
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Hero list mode (switcher right = list, left = canvas)                    */
  /* ----------------------------------------------------------------------- */
  function initHeroListToggle(container, api) {
    const heroList = container.querySelector(".hero_list");
    const heroCanvas = container.querySelector(".hero_canvas");
    const switcherRight = container.querySelector(".mode_switcher_right");
    const switcherLeft = container.querySelector(".mode_switcher_left");
    const textLoopSection = container.querySelector(".section_text_loop");
    if (!heroList || !switcherRight || !switcherLeft) return;

    let toggleTween = null;
    let isOpen = false;
    const overlapSections = () => container.querySelectorAll('.section_text_loop[data-overlap="true"]');

    gsap.set(heroList, { opacity: 0, pointerEvents: "none" });

    function openHeroList() {
      if (isOpen) return;
      isOpen = true;
      api.isHeroListMode = true;
      if (api.setPanEnabled) api.setPanEnabled(false);
      if (toggleTween) toggleTween.kill();

      switcherRight.classList.add("is--active");
      switcherLeft.classList.remove("is--active");
      if (textLoopSection) textLoopSection.style.display = "none";
      overlapSections().forEach((s) => (s.style.marginTop = "0"));

      VDJ.track(() => {
        toggleTween = gsap.timeline({ onComplete: () => VDJ.afterPaint(VDJ.refreshScroll) });
        if (heroCanvas) toggleTween.to(heroCanvas, { opacity: 0, duration: 0.3, ease: "power2.out", pointerEvents: "none" }, 0);
        toggleTween.set(heroList, { pointerEvents: "auto" }, 0.3);
        toggleTween.to(heroList, { opacity: 1, duration: 0.3, ease: "power2.out" }, 0.3);
      });
    }

    function closeHeroList() {
      if (!isOpen) return;
      isOpen = false;
      api.isHeroListMode = false;
      if (api.setPanEnabled) api.setPanEnabled(true);
      if (toggleTween) toggleTween.kill();

      switcherRight.classList.remove("is--active");
      switcherLeft.classList.add("is--active");
      if (textLoopSection) textLoopSection.style.display = "";
      overlapSections().forEach((s) => (s.style.marginTop = "100vh"));

      VDJ.track(() => {
        toggleTween = gsap.timeline({
          onComplete: () => {
            if (api.syncOverlap) api.syncOverlap();
            VDJ.afterPaint(VDJ.refreshScroll);
          }
        });
        toggleTween.to(heroList, { opacity: 0, duration: 0.3, ease: "power2.out" }, 0);
        toggleTween.set(heroList, { pointerEvents: "none" }, 0.3);
        if (heroCanvas) toggleTween.to(heroCanvas, { opacity: 1, duration: 0.3, ease: "power2.out", pointerEvents: "auto" }, 0.3);
      });
    }

    api.resetHeroListMode = function () {
      if (toggleTween) toggleTween.kill();
      isOpen = false;
      api.isHeroListMode = false;
      switcherRight.classList.remove("is--active");
      switcherLeft.classList.add("is--active");
      if (textLoopSection) textLoopSection.style.display = "";
      overlapSections().forEach((s) => (s.style.marginTop = "100vh"));
      gsap.set(heroList, { opacity: 0, pointerEvents: "none" });
      if (heroCanvas) gsap.set(heroCanvas, { opacity: 1, pointerEvents: "auto" });
      if (api.refreshPill) api.refreshPill(0, false);
      if (api.syncOverlap) api.syncOverlap();
    };

    const offs = [VDJ.on(switcherRight, "click", openHeroList), VDJ.on(switcherLeft, "click", closeHeroList)];
    return () => {
      offs.forEach((off) => off());
      if (toggleTween) toggleTween.kill();
      api.resetHeroListMode = null;
    };
  }

  /* ----------------------------------------------------------------------- */
  /* "Ontdek wat we maken" (#drag_active) fades out [data-disappear] items    */
  /* ----------------------------------------------------------------------- */
  function initDisappearText(container) {
    const btn = container.querySelector("#drag_active");
    if (!btn) return;
    const timers = [];
    const off = VDJ.on(btn, "click", () => {
      container.querySelectorAll("[data-disappear]").forEach((el) => {
        const delay = parseFloat(el.getAttribute("data-disappear-delay")) || 2000;
        timers.push(setTimeout(() => gsap.to(el, { opacity: 0, duration: 0.9, ease: "power2.out" }), delay));
      });
    });
    return () => { off(); timers.forEach(clearTimeout); };
  }

  /* ----------------------------------------------------------------------- */
  /* Home H1 ("Werk aan de wereld"): subtle depth                             */
  /* Desktop: the heading tilts a few degrees towards the mouse and drifts a  */
  /* few px. Everywhere: a slow float. Pauses once the overlay is gone.       */
  /* ----------------------------------------------------------------------- */
  function initHeadingMotion(container) {
    const h1 = container.querySelector(".canvas_overlay_content .overlay_text_wrapper h1");
    if (!h1 || VDJ.reducedMotion()) return;

    const MAX_TILT_X = 5; // deg
    const MAX_TILT_Y = 7; // deg
    const MAX_SHIFT = 10; // px
    const overlay = h1.closest(".canvas_overlay_content");
    const offs = [];

    gsap.set(h1.parentElement, { perspective: 900 });
    gsap.set(h1, { transformOrigin: "50% 50%", force3D: true });

    // slow float (yPercent, so it adds to the mouse shift on y)
    const float = gsap.to(h1, { yPercent: -3, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 });

    if (VDJ.mq("(hover: hover) and (pointer: fine)")) {
      const opts = { duration: 1.4, ease: "power3.out" };
      const rx = gsap.quickTo(h1, "rotationX", opts);
      const ry = gsap.quickTo(h1, "rotationY", opts);
      const x = gsap.quickTo(h1, "x", opts);
      const y = gsap.quickTo(h1, "y", opts);

      const onMove = (e) => {
        if (overlay && getComputedStyle(overlay).display === "none") return;
        const nx = (e.clientX / window.innerWidth) * 2 - 1; // -1..1
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        ry(nx * MAX_TILT_Y);
        rx(-ny * MAX_TILT_X);
        x(nx * MAX_SHIFT);
        y(ny * MAX_SHIFT * 0.6);
      };
      const onLeave = () => { rx(0); ry(0); x(0); y(0); };
      offs.push(VDJ.on(window, "mousemove", onMove, { passive: true }), VDJ.on(document.documentElement, "mouseleave", onLeave));
    }

    return () => {
      offs.forEach((off) => off());
      float.kill();
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Mount                                                                    */
  /* ----------------------------------------------------------------------- */
  VDJ.page("home", function (container) {
    // shared state between the home modules, fresh for every page view
    const api = { isHeroListMode: false };

    if (VDJ.isPath("/ons-werk")) {
      const left = container.querySelector(".mode_switcher_left");
      const right = container.querySelector(".mode_switcher_right");
      if (left) left.classList.add("is--active");
      if (right) right.classList.remove("is--active");
    }

    const cleanups = [
      initTextLoop(container),
      initOverlapFade(container, api),
      initModeSwitcherPill(container, api),
      initCanvas(container, api),
      initHeroListToggle(container, api),
      initDisappearText(container),
      initHeadingMotion(container)
    ].filter(Boolean);

    return () => cleanups.reverse().forEach((fn) => fn());
  });
})();

/* ---- src/modules/about.js ---- */
/* =========================================================================
   Over ons: office illustration sequence (with skip button),
   people cutouts flying into the grid, cutout shake on mobile
   ========================================================================= */
(function () {
  "use strict";
  const VDJ = window.VDJ;

  /* ----------------------------------------------------------------------- */
  /* Office illustration                                                      */
  /* Markup + CSS stay in the Webflow embed (.sequence_section).              */
  /* Scroll length: data-sequence-length on .sequence_section, in vh          */
  /* (desktop) and data-sequence-length-mobile. Was 2400vh / 1750vh.          */
  /* ----------------------------------------------------------------------- */
  const ASSET_BASE = "https://cdn.jsdelivr.net/gh/WESSELKRAMER/vdj_assets@92e957c/animations";
  const DEFAULT_LENGTH = 1000;
  const DEFAULT_LENGTH_MOBILE = 800;

  const COLOR_COUNT = 11;
  // Layers 4, 8 and 9 are wall/floor fills. They fade in after some detail
  // layers (paint splat, plants) but belong underneath them, as in the final
  // composites (10, 11). Without this the splat faded in, got covered by the
  // wall, and came back with layer 10.
  const BACKGROUND_LAYERS = [4, 8, 9];
  const COMPOSITE_LAYERS = [10, 11];
  const layerZ = (n) => (BACKGROUND_LAYERS.includes(n) ? 1 : COMPOSITE_LAYERS.includes(n) ? 3 : 2);
  const COLOR_STAGGER = 0.12;
  const COLOR_DURATION = 0.3;
  const COLOR_TOTAL = (COLOR_COUNT - 1) * COLOR_STAGGER + COLOR_DURATION;
  const BUBBLE_FADE = 0.02; // share of the scroll range a bubble takes to fade in

  // The 12 line frames are 4 unique drawings in a fixed order
  const LINE_FILES = [1, 2, 3, 5];
  const LINE_SEQUENCE = [1, 2, 3, 2, 5, 1, 3, 5, 3, 1, 5, 2];

  const pad = (n) => String(n).padStart(4, "0");
  const colorLayerStart = (i) => (i * COLOR_STAGGER) / COLOR_TOTAL;

  function initSequence(container) {
    const section = container.querySelector(".sequence_section");
    if (!section) return;

    const offs = [];
    const sticky = section.querySelector(".sequence_sticky") || section;

    // Shorter section = faster animation
    const isMobile = VDJ.mq("(max-width: 767px)");
    const length = parseFloat(section.getAttribute(isMobile ? "data-sequence-length-mobile" : "data-sequence-length")) ||
      (isMobile ? DEFAULT_LENGTH_MOBILE : DEFAULT_LENGTH);
    section.style.height = `${length}vh`;

    // Same scroll range as before; only the section got shorter
    const range = { trigger: section, start: "top top", end: "bottom top", invalidateOnRefresh: true };

    /* Colour layers ------------------------------------------------------- */
    const colorWrap = section.querySelector(".sequence_color_layers");
    if (colorWrap) {
      colorWrap.querySelectorAll("img[data-gsap]").forEach((img) => img.remove());
      const layers = [];
      for (let i = 1; i <= COLOR_COUNT; i++) {
        const img = document.createElement("img");
        img.src = `${ASSET_BASE}/colors/color_${pad(i)}.avif`;
        img.alt = "";
        img.decoding = "async";
        img.dataset.gsap = "true";
        img.style.zIndex = String(layerZ(i));
        colorWrap.appendChild(img);
        layers.push(img);
      }
      gsap.set(layers, { opacity: 0 });

      const tl = gsap.timeline({ scrollTrigger: { ...range, scrub: true } });
      layers.forEach((layer, i) => tl.to(layer, { opacity: 1, ease: "none", duration: COLOR_DURATION }, i * COLOR_STAGGER));
      offs.push(() => layers.forEach((img) => img.remove()));
    }

    /* Speech bubbles ------------------------------------------------------ */
    // Each bubble appears together with its colour layer (data-layer) and
    // stays until the illustration scrolls away, where the whole bubble stack
    // fades out. Before, each bubble had its own timeline length, which put
    // the last one at ~90% of the scroll: after the illustration unpins once
    // the section got shorter, so you barely saw it.
    section.querySelectorAll("[data-bubble]").forEach((bubble) => {
      const layerIndex = parseInt(bubble.dataset.layer, 10) || 0;
      const start = colorLayerStart(layerIndex) + 0.01;

      gsap.set(bubble, { opacity: 0, y: 3 });
      gsap.timeline({ scrollTrigger: { ...range, scrub: true } })
        .to(bubble, { opacity: 1, y: 0, ease: "none", duration: BUBBLE_FADE, immediateRender: false }, start)
        .set({}, {}, 1); // timeline runs 0..1 = the whole scroll range, same as the colour layers
    });

    const bubbleWrap = section.querySelector(".sequence_bubbles");
    if (bubbleWrap) {
      gsap.to(bubbleWrap, {
        opacity: 0,
        ease: "none",
        immediateRender: false,
        scrollTrigger: { trigger: section, start: "bottom bottom", end: "bottom center", scrub: true, invalidateOnRefresh: true }
      });
    }

    /* Line drawing loop (time based, plays while in view) ---------------- */
    const canvas = section.querySelector(".sequence_canvas.is-lines");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const images = {};
      LINE_FILES.forEach((n) => {
        const img = new Image();
        img.decoding = "async";
        img.src = `${ASSET_BASE}/lines/lines_${pad(n)}.avif`;
        img.onload = () => { if (n === LINE_SEQUENCE[0]) render(true); };
        images[n] = img;
      });

      const seq = { frame: 0 };
      let lastFrame = -1;
      let cssW = 0;
      let cssH = 0;

      function sizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cssW = rect.width;
        cssH = rect.height;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function render(force) {
        const frame = Math.round(seq.frame) % LINE_SEQUENCE.length;
        if (frame === lastFrame && !force) return;
        const img = images[LINE_SEQUENCE[frame]];
        if (!img || !img.complete || !img.naturalWidth) return;
        lastFrame = frame;
        if (!cssW) sizeCanvas();
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.drawImage(img, 0, 0, cssW, cssH);
      }

      sizeCanvas();
      const loop = gsap.to(seq, {
        frame: LINE_SEQUENCE.length - 1,
        duration: LINE_SEQUENCE.length / 4,
        repeat: -1,
        ease: "none",
        snap: "frame",
        paused: true,
        onUpdate: render
      });

      ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => (self.isActive ? loop.play() : loop.pause())
      });

      offs.push(VDJ.on(window, "resize", () => { sizeCanvas(); render(true); }, { passive: true }));
    }

    /* Skip button ---------------------------------------------------------- */
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "sequence_skip";
    skip.setAttribute("aria-label", "Animatie overslaan");
    skip.innerHTML = '<span>Overslaan</span><span class="sequence_skip_icon" aria-hidden="true">↓</span>';
    sticky.appendChild(skip);

    // visible while the illustration is pinned
    ScrollTrigger.create({
      trigger: section,
      start: "top+=10 top",
      end: "bottom-=10 bottom",
      onToggle: (self) => skip.classList.toggle("is-visible", self.isActive)
    });

    offs.push(
      VDJ.on(skip, "click", () => {
        // land on the content after the illustration
        const endY = section.getBoundingClientRect().bottom + window.scrollY;
        const distance = Math.max(endY - window.scrollY, 0);
        // fast-forward: the animation plays out quickly instead of jumping
        VDJ.scrollTo(endY, { duration: gsap.utils.clamp(0.9, 1.8, distance / 5000), lock: true });
      }),
      () => skip.remove(),
      () => (section.style.height = "")
    );

    return () => offs.forEach((off) => off());
  }

  /* ----------------------------------------------------------------------- */
  /* People cutouts fly from the hero into the grid (was people.flip.js)      */
  /* Desktop: hover shows details. Mobile: tap opens the details in a modal.  */
  /* ----------------------------------------------------------------------- */
  function initPersonalCutoutToGrid(container) {
    const hero = container.querySelector(".section_bigtext_hero");
    const items = Array.from(container.querySelectorAll(".personal_cutout_wrapper[data-cutout]"));
    const targets = Array.from(container.querySelectorAll(".personal_cutout_target[data-target]"));
    if (!hero || !items.length || !targets.length) return;

    const targetMap = new Map();
    targets.forEach((t) => t.getAttribute("data-target") && targetMap.set(t.getAttribute("data-target"), t));

    const isMobile = () => VDJ.mq("(max-width: 767px)");
    const offs = [];

    // Modal lives on <body> so it isn't clipped; removed again on unmount
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "pcg_modal_overlay";
    const modalBg = document.createElement("div");
    modalBg.className = "pcg_modal_bg";
    const modalBox = document.createElement("div");
    modalBox.className = "pcg_modal_box";
    modalOverlay.append(modalBg, modalBox);
    document.body.appendChild(modalOverlay);

    let isOpen = false;
    let modalTween = null;
    let scrollActive = false;

    function openModal(details) {
      if (isOpen) closeModal(true);
      isOpen = true;
      const clone = details.cloneNode(true);
      gsap.set(clone, { opacity: 1, visibility: "visible", display: "", x: 0, y: 0, scale: 1 });
      modalBox.innerHTML = "";
      modalBox.appendChild(clone);
      modalOverlay.classList.add("is-open");
      if (modalTween) modalTween.kill();
      gsap.set(modalOverlay, { opacity: 0 });
      gsap.set(modalBox, { scale: 0.9, y: 20, opacity: 0 });
      modalTween = gsap.timeline()
        .to(modalOverlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
        .to(modalBox, { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 0.05);
    }

    function closeModal(immediate) {
      if (!isOpen) return;
      isOpen = false;
      if (modalTween) modalTween.kill();
      if (immediate === true) {
        gsap.set(modalOverlay, { opacity: 0 });
        modalOverlay.classList.remove("is-open");
        modalBox.innerHTML = "";
        return;
      }
      modalTween = gsap.timeline({ onComplete: () => { modalOverlay.classList.remove("is-open"); modalBox.innerHTML = ""; } })
        .to(modalBox, { scale: 0.9, y: 20, opacity: 0, duration: 0.25, ease: "power2.in" })
        .to(modalOverlay, { opacity: 0, duration: 0.22, ease: "power2.in" }, 0.04);
    }

    offs.push(
      VDJ.on(modalBg, "click", () => closeModal()),
      VDJ.on(document, "keydown", (e) => e.key === "Escape" && closeModal())
    );

    items.forEach((item) => {
      item.classList.remove("is-hover-active");
      const details = item.querySelector(".personal_details_wrapper");
      if (!details) return;
      offs.push(VDJ.on(item, "click", () => { if (isMobile() && scrollActive) openModal(details); }));
    });

    const delta = (item, target) => {
      const a = item.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      return { x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2) };
    };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "+=100%",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          scrollActive = self.progress > 0.92;
          const hoverOn = scrollActive && !isMobile();
          items.forEach((item) => item.classList.toggle("is-hover-active", hoverOn));
        }
      }
    });

    items.forEach((item) => {
      const target = targetMap.get(item.getAttribute("data-cutout"));
      if (!target) return;
      tl.to(item, { x: () => delta(item, target).x, y: () => delta(item, target).y, rotation: 0, scale: 0.9, opacity: 1, ease: "none" }, 0);
    });

    return () => {
      offs.forEach((off) => off());
      if (modalTween) modalTween.kill();
      modalOverlay.remove();
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Small shake on the cutouts (tablet + mobile)                            */
  /* ----------------------------------------------------------------------- */
  function initCutoutShake(container) {
    if (!VDJ.mq("(max-width: 991px)")) return;
    const calls = [];

    container.querySelectorAll(".personal_cutout_wrapper").forEach((wrapper, i) => {
      const img = wrapper.querySelector("img, [src]");
      if (!img) return;

      const shake = () => {
        if (!VDJ.mq("(max-width: 991px)")) return;
        gsap.timeline()
          .to(img, { rotation: 1.5, duration: 0.1, ease: "power1.inOut" })
          .to(img, { rotation: -1.5, duration: 0.1, ease: "power1.inOut" })
          .to(img, { rotation: 1, duration: 0.1, ease: "power1.inOut" })
          .to(img, { rotation: 0, duration: 0.1, ease: "power1.out" });
      };

      const interval = 4 + i * 0.6;
      const repeat = () => { shake(); calls.push(gsap.delayedCall(interval, repeat)); };
      calls.push(gsap.delayedCall(1.2 + i * 0.4, repeat));
    });

    return () => calls.forEach((c) => c.kill());
  }

  VDJ.page("about", function (container) {
    const cleanups = [initSequence(container), initPersonalCutoutToGrid(container), initCutoutShake(container)].filter(Boolean);
    return () => cleanups.reverse().forEach((fn) => fn());
  });
})();

/* ---- src/barba.js ---- */
/* =========================================================================
   Page transitions with Barba + boot
   Needs on every page (Webflow): data-barba="wrapper" on <body> (already set)
   and data-barba="container" on the element that wraps all page content.
   Without Barba (or without a container) the site still works: it mounts
   the page and reveals it, links do a normal page load.
   ========================================================================= */
(function () {
  "use strict";

  const VDJ = window.VDJ;
  const CONTAINER_SELECTOR = '[data-barba="container"]';
  const scrollMemory = new Map();

  /* ----------------------------------------------------------------------- */
  /* Helpers                                                                  */
  /* ----------------------------------------------------------------------- */

  function fallbackContainer() {
    return (
      document.querySelector(CONTAINER_SELECTOR) ||
      document.querySelector("[data-transition-container]") ||
      document.querySelector("main") ||
      document.body
    );
  }

  function updateHead(html) {
    if (!html) return;
    const doc = new DOMParser().parseFromString(html, "text/html");

    // Webflow uses data-wf-page for forms and interactions
    const nextPage = doc.documentElement.getAttribute("data-wf-page");
    if (nextPage) document.documentElement.setAttribute("data-wf-page", nextPage);

    const selectors = [
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:image"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
      'meta[name="twitter:image"]',
      'link[rel="canonical"]'
    ];
    selectors.forEach((sel) => {
      const next = doc.head.querySelector(sel);
      const current = document.head.querySelector(sel);
      if (next && current) current.replaceWith(next.cloneNode(true));
      else if (next) document.head.appendChild(next.cloneNode(true));
      else if (current) current.remove();
    });
  }

  function updateCurrentLinks(path) {
    const current = VDJ.normalizePath(path);
    document.querySelectorAll("a[href]").forEach((a) => {
      if (a.closest(CONTAINER_SELECTOR)) return; // fresh from the server already
      let linkPath;
      try {
        const url = new URL(a.href, location.href);
        if (url.origin !== location.origin) return;
        linkPath = VDJ.normalizePath(url.pathname);
      } catch (e) {
        return;
      }
      const isCurrent = linkPath === current;
      a.classList.toggle("w--current", isCurrent);
      if (isCurrent) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function reinitWebflow() {
    if (!window.Webflow) return;
    try {
      Webflow.destroy();
      Webflow.ready();
      const ix2 = Webflow.require && Webflow.require("ix2");
      if (ix2 && ix2.init) ix2.init();
      // Webflow forms wait for a jQuery "ready" event before rendering
      // Turnstile. That event only fires once per page load, so re-fire it.
      if (window.jQuery) window.jQuery(document).trigger("ready");
    } catch (err) {
      console.warn("[VDJ] Webflow re-init failed:", err);
    }
  }

  /**
   * Barba only swaps the container. If the next page has different elements
   * outside it (e.g. a template where the hero sits outside the container),
   * swapping would show the wrong page, so we do a normal page load instead.
   */
  function outsideSignature(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc.querySelector(CONTAINER_SELECTOR)) return null;
    return Array.from(doc.body.children)
      .filter((el) => !/^(SCRIPT|STYLE|NOSCRIPT|LINK|TEMPLATE)$/.test(el.tagName))
      .filter((el) => !el.matches(`${CONTAINER_SELECTOR}, .w-webflow-badge`))
      .map((el) => el.tagName + "." + (el.getAttribute("class") || "").trim().split(/\s+/).sort().join("."))
      .sort()
      .join("|");
  }

  // Layout of the current page as served. Taken at boot (before modules add
  // things like modals to <body>) and from each fetched page after that.
  let currentLayout = null;

  function sameLayout(nextHtml) {
    if (!nextHtml) return false;
    const next = outsideSignature(nextHtml);
    return next !== null && next === currentLayout;
  }

  function resetScroll() {
    if (window.lenis) window.lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
  }

  function scrollToHash(hash) {
    if (!hash) return false;
    let target = null;
    try {
      target = document.getElementById(decodeURIComponent(hash.replace(/^#/, "")));
    } catch (e) {}
    if (!target) return false;
    VDJ.scrollTo(target, { immediate: true });
    return true;
  }

  /* ----------------------------------------------------------------------- */
  /* Transition                                                               */
  /* ----------------------------------------------------------------------- */

  const transition = {
    name: "vdj-fade",

    async once({ next }) {
      VDJ.mount(next.container, next.url.path);
      await VDJ.fontsReady(800);
      VDJ.refreshScroll();
      // not awaited: Barba ignores clicks while a transition runs, and you
      // should be able to click away during the intro fade
      VDJ.reveal(VDJ.pageParts(), { duration: 1.1 });
    },

    async leave({ current }) {
      scrollMemory.set(current.url.href, window.scrollY);
      if (window.lenis) window.lenis.stop();
      if (VDJ.closeNavigation) await VDJ.closeNavigation();
      // all page parts, not only the container (some templates have content
      // outside it, and those pages are opened with a full load)
      await VDJ.fadeOut(VDJ.pageParts());
    },

    afterLeave({ current, next }) {
      if (!sameLayout(next.html)) {
        // page is already faded out, so a full load looks the same
        location.replace(next.url.href);
        return new Promise(() => {}); // stop the Barba transition here
      }
      VDJ.unmount();
      // Let Barba remember where the container sat, then take it out so
      // modules only ever see one container in the document.
      barba.dom.removeContainer(current.container);
    },

    beforeEnter({ next, trigger }) {
      gsap.set(next.container, { autoAlpha: 0 });
      currentLayout = outsideSignature(next.html);

      updateHead(next.html);
      updateCurrentLinks(next.url.path);
      resetScroll();
      reinitWebflow();

      VDJ.mount(next.container, next.url.path);

      const isHistoryNav = trigger === "back" || trigger === "forward" || trigger === "popstate";
      const savedY = isHistoryNav ? scrollMemory.get(next.url.href) : null;

      VDJ.refreshScroll();
      if (savedY) VDJ.scrollTo(savedY, { immediate: true });
      else scrollToHash(next.url.hash ? "#" + next.url.hash : "");
    },

    enter({ next }) {
      if (window.lenis) window.lenis.start();
      // fonts are cached after the first page; refresh once they're surely in
      VDJ.fontsReady(500).then(VDJ.refreshScroll);

      if (VDJ.reducedMotion()) {
        gsap.set(next.container, { clearProps: "opacity,visibility" });
        return;
      }
      // not awaited, so the next click is handled by Barba right away
      gsap.to(next.container, {
        autoAlpha: 1,
        duration: 0.8,
        ease: "power2.out",
        onComplete: () => gsap.set(next.container, { clearProps: "opacity,visibility" })
      });
    },

    after() {
      VDJ.afterPaint(VDJ.refreshScroll);
    }
  };

  function preventBarba({ el, href }) {
    if (!el) return false;
    if (el.closest("[data-barba-prevent]")) return true;
    if (el.hasAttribute("download")) return true;
    let url;
    try {
      url = new URL(href, location.href);
    } catch (e) {
      return true;
    }
    if (url.origin !== location.origin) return true;
    // Files and Webflow system paths
    if (/\.(pdf|zip|jpe?g|png|gif|webp|avif|svg|mp4|mov|webm)$/i.test(url.pathname)) return true;
    return false;
  }

  /* ----------------------------------------------------------------------- */
  /* Boot                                                                     */
  /* ----------------------------------------------------------------------- */

  function boot() {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
      console.error("[VDJ] GSAP or ScrollTrigger missing");
      document.documentElement.classList.remove("vdj-loading");
      return;
    }

    history.scrollRestoration = "manual";
    VDJ.setupGsap();
    VDJ.setupLenis();
    VDJ.mountGlobals();

    let hasBarba =
      typeof barba !== "undefined" &&
      document.querySelector(CONTAINER_SELECTOR) &&
      document.querySelector('[data-barba="wrapper"]');

    if (hasBarba) {
      currentLayout = outsideSignature(document.documentElement.outerHTML);
      try {
        initBarba();
      } catch (err) {
        console.warn("[VDJ] Barba could not start, using normal page loads:", err);
        hasBarba = false;
      }
    }

    if (!hasBarba) startWithoutBarba();

    // Back/forward from the browser cache: the page may still be faded out
    window.addEventListener("pageshow", (e) => {
      if (!e.persisted) return;
      leaving = false;
      if (window.lenis) window.lenis.start();
      gsap.set(VDJ.pageParts(), { clearProps: "opacity,visibility" });
    });

    window.addEventListener("load", () => VDJ.refreshScroll(), { once: true });
  }

  function initBarba() {
      barba.init({
        transitions: [transition],
        prevent: preventBarba,
        preventRunning: true,
        timeout: 10000,
        requestError: (trigger, action, url) => {
          // Couldn't fetch the page (or it has no container): fall back to a normal page load
          if (action === "click" || action === "popstate") barba.force(url);
          return false;
        }
      });
  }

  // No Barba on this page: classic page loads, but with the same fade out /
  // fade in as the Barba transition
  function startWithoutBarba() {
    const container = fallbackContainer();
    VDJ.mount(container, location.pathname);
    VDJ.fontsReady(800).then(() => {
      VDJ.refreshScroll();
      VDJ.reveal(VDJ.pageParts(), { duration: 1.1 });
    });
    document.addEventListener("click", onFallbackLinkClick);
  }

  let leaving = false;

  function onFallbackLinkClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[href]");
    if (!a || (a.target && a.target !== "_self")) return;
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || preventBarba({ el: a, href: a.href })) return;
    const url = new URL(a.href, location.href);
    if (url.pathname === location.pathname && url.search === location.search) return; // same page / anchor

    e.preventDefault();
    if (leaving) return;
    leaving = true;
    (VDJ.closeNavigation ? VDJ.closeNavigation() : Promise.resolve())
      .then(() => VDJ.fadeOut(VDJ.pageParts()))
      .then(() => { location.href = url.href; });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
