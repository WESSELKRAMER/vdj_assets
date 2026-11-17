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
