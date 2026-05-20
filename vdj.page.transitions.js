// -----------------------------------------
// VDJ PAGE TRANSITIONS
// -----------------------------------------

gsap.registerPlugin(CustomEase);

history.scrollRestoration = "manual";

let nextPage = document;
let onceFunctionsInitialized = false;

// Lenis is managed entirely by VDJ (window.lenis) — no separate instance here
const hasScrollTrigger = typeof window.ScrollTrigger !== "undefined";

const rmMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = rmMQ.matches;
rmMQ.addEventListener?.("change", e => (reducedMotion = e.matches));
rmMQ.addListener?.(e => (reducedMotion = e.matches));

const has = (s) => !!nextPage.querySelector(s);

let staggerDefault = 0.05;
let durationDefault = 0.6;

CustomEase.create("osmo", "0.625, 0.05, 0, 1");
gsap.defaults({ ease: "osmo", duration: durationDefault });



// -----------------------------------------
// FUNCTION REGISTRY
// -----------------------------------------

function initOnceFunctions() {
  if (onceFunctionsInitialized) return;
  onceFunctionsInitialized = true;

  // VDJ handles: Lenis, ScrollTrigger, canvas, text loops,
  // scroll animations, split text, navigation, footer parallax, etc.
  if (typeof VDJ !== "undefined") VDJ.init();
}

function initBeforeEnterFunctions(next) {
  nextPage = next || document;

  // Re-inject inline embed scripts so their functions get re-defined.
  // They won't auto-run (DOMContentLoaded already fired) — we call them
  // manually in initAfterEnterFunctions below.
  rerunEmbedScripts(next);
}

function initAfterEnterFunctions(next) {
  nextPage = next || document;

  // ── bunny.js ──────────────────────────────────────────────────────────────
  if (typeof initBunnyPlayerBackground === "function" && has("[data-bunny-background-init]")) {
    initBunnyPlayerBackground();
  }

  // ── highlight.text.js ─────────────────────────────────────────────────────
  if (typeof initHighlightText === "function" && has("[data-highlight-text]")) {
    initHighlightText();
  }

  // ── image.gallery.js ──────────────────────────────────────────────────────
  // No named init function — replicate the DOMContentLoaded call directly.
  if (typeof createLightbox === "function" && has("[data-gallery]")) {
    nextPage.querySelectorAll("[data-gallery]").forEach(wrapper => createLightbox(wrapper));
  }

  // ── parallax.scroll.content.js ────────────────────────────────────────────
  if (typeof VDJ_ParallaxImages !== "undefined" && has("[data-parallax]")) {
    VDJ_ParallaxImages.init(nextPage);
  }

  // ── people.flip.js ────────────────────────────────────────────────────────
  if (typeof initPersonalCutoutToGrid === "function" && has(".personal_cutout_wrapper")) {
    initPersonalCutoutToGrid();
  }

  // ── scribble.text.js ──────────────────────────────────────────────────────
  // No exposed function — replicated as initScribble() below.
  if (has("[data-scribble]")) {
    initScribble();
  }

  // ── Embed: initLayeredIllustration ────────────────────────────────────────
  // Re-defined by rerunEmbedScripts above, called manually here.
  if (typeof initLayeredIllustration === "function" && has(".sequence_section")) {
    initLayeredIllustration();
  }

  // ── Settle ────────────────────────────────────────────────────────────────
  if (window.lenis) window.lenis.resize();

  if (hasScrollTrigger) {
    ScrollTrigger.refresh();
  }
}

// Re-injects inline <script> tags from the new Barba container so their
// code executes again. Needed because Barba swaps HTML but doesn't re-run scripts.
function rerunEmbedScripts(container) {
  if (!container) return;
  container.querySelectorAll("script").forEach((old) => {
    const s = document.createElement("script");
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
}

// Remove elements that were appended to <body> during init and won't be
// removed automatically when Barba swaps the container.
function cleanupBodyAppended() {
  document.querySelector(".pcg_modal_overlay")?.remove();
}

// scribble.text.js has no exposed init function so we replicate it here.
// Includes a guard so already-initialized elements are skipped.
function initScribble() {
  const scribbles = [
    "M4 12 C70 8, 140 16, 296 10",
    "M4 12 C60 14, 120 6, 296 11",
    "M4 12 C80 9, 180 18, 296 10"
  ];

  nextPage.querySelectorAll("[data-scribble]").forEach((el, index) => {
    if (el.querySelector(".scribble_wrap")) return;

    const wrapper = document.createElement("span");
    wrapper.className = "scribble_wrap";
    wrapper.textContent = el.textContent;
    el.textContent = "";
    el.appendChild(wrapper);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "scribble_line");
    svg.setAttribute("viewBox", "0 0 300 20");
    svg.setAttribute("preserveAspectRatio", "none");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", scribbles[Math.floor(Math.random() * scribbles.length)]);
    svg.appendChild(path);
    wrapper.appendChild(svg);

    const length = path.getTotalLength();
    path.style.strokeDasharray = length;
    path.style.strokeDashoffset = length;

    if (typeof gsap !== "undefined") {
      gsap.to(path, {
        strokeDashoffset: 0,
        duration: 1,
        ease: "power2.out",
        delay: index * 0.15,
        scrollTrigger: {
          trigger: el,
          start: "top 80%"
        }
      });
    }
  });
}



// -----------------------------------------
// PAGE TRANSITIONS
// -----------------------------------------

function runPageOnceAnimation(next) {
  const tl = gsap.timeline();

  tl.call(() => {
    resetPage(next);
  }, null, 0);

  return tl;
}

function runPageLeaveAnimation(current) {
  const tl = gsap.timeline({
    onComplete: () => {
      current.remove();
    }
  });

  if (reducedMotion) {
    return tl.set(current, { autoAlpha: 0 });
  }

  tl.to(current, { autoAlpha: 0, duration: 0.4 });

  return tl;
}

function runPageEnterAnimation(next) {
  const tl = gsap.timeline();

  if (reducedMotion) {
    tl.set(next, { autoAlpha: 1 });
    tl.add("pageReady");
    tl.call(resetPage, [next], "pageReady");
    return new Promise(resolve => tl.call(resolve, null, "pageReady"));
  }

  tl.add("startEnter", 0);

  tl.fromTo(next, {
    autoAlpha: 0,
  }, {
    autoAlpha: 1,
    duration: 0.5,
  }, "startEnter");

  tl.add("pageReady");
  tl.call(resetPage, [next], "pageReady");

  return new Promise(resolve => {
    tl.call(resolve, null, "pageReady");
  });
}



// -----------------------------------------
// BARBA HOOKS + INIT
// -----------------------------------------

barba.hooks.beforeEnter(data => {
  // Position incoming container on top during transition
  gsap.set(data.next.container, {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
  });

  // Stop smooth scroll during transition
  if (window.lenis) window.lenis.stop();

  initBeforeEnterFunctions(data.next.container);
  applyThemeFrom(data.next.container);
});

barba.hooks.afterLeave(() => {
  // Intentionally empty — destroy/init happens in afterEnter
  // so nothing is killed while animations are still running
});

barba.hooks.enter(data => {
  initBarbaNavUpdate(data);
});

barba.hooks.afterEnter(data => {
  // Both animations are fully complete — now safe to destroy and re-init
  if (typeof VDJ !== "undefined") {
    VDJ.destroy();
    VDJ.init();
  }

  if (hasScrollTrigger) {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  }

  cleanupBodyAppended();

  // Re-init all page-specific functions
  initAfterEnterFunctions(data.next.container);

  if (window.lenis) {
    window.lenis.resize();
    window.lenis.start();
  }

  if (hasScrollTrigger) {
    ScrollTrigger.refresh();
  }
});

barba.init({
  debug: false,
  timeout: 7000,
  preventRunning: true,
  transitions: [
    {
      name: "default",
      sync: true,

      // First page load
      async once(data) {
        initOnceFunctions();
        return runPageOnceAnimation(data.next.container);
      },

      // Current page leaves
      async leave(data) {
        return runPageLeaveAnimation(data.current.container);
      },

      // New page enters
      async enter(data) {
        return runPageEnterAnimation(data.next.container);
      }
    }
  ],
});



// -----------------------------------------
// GENERIC + HELPERS
// -----------------------------------------

const themeConfig = {
  light: {
    nav: "dark",
    transition: "light"
  },
  dark: {
    nav: "light",
    transition: "dark"
  }
};

function applyThemeFrom(container) {
  const pageTheme = container?.dataset?.pageTheme || "light";
  const config = themeConfig[pageTheme] || themeConfig.light;

  document.body.dataset.pageTheme = pageTheme;

  const transitionEl = document.querySelector('[data-theme-transition]');
  if (transitionEl) transitionEl.dataset.themeTransition = config.transition;

  const nav = document.querySelector('[data-theme-nav]');
  if (nav) nav.dataset.themeNav = config.nav;
}

function resetPage(container) {
  window.scrollTo(0, 0);
  gsap.set(container, { clearProps: "position,top,left,right" });

  if (window.lenis) {
    window.lenis.resize();
    window.lenis.start();
  }
}

function debounceOnWidthChange(fn, ms) {
  let last = innerWidth,
    timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (innerWidth !== last) {
        last = innerWidth;
        fn.apply(this, args);
      }
    }, ms);
  };
}

function initBarbaNavUpdate(data) {
  var tpl = document.createElement('template');
  tpl.innerHTML = data.next.html.trim();
  var nextNodes = tpl.content.querySelectorAll('[data-barba-update]');
  var currentNodes = document.querySelectorAll('nav [data-barba-update]');

  currentNodes.forEach(function (curr, index) {
    var next = nextNodes[index];
    if (!next) return;

    var newStatus = next.getAttribute('aria-current');
    if (newStatus !== null) {
      curr.setAttribute('aria-current', newStatus);
    } else {
      curr.removeAttribute('aria-current');
    }

    var newClassList = next.getAttribute('class') || '';
    curr.setAttribute('class', newClassList);
  });
}
