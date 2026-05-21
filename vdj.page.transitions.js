// -----------------------------------------
// VDJ PAGE TRANSITIONS
// -----------------------------------------

gsap.registerPlugin(CustomEase);

history.scrollRestoration = "manual";

// Lenis is managed entirely by VDJ (window.lenis) — no separate instance here
let nextPage = document;
let onceFunctionsInitialized = false;

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
  if (typeof VDJ !== "undefined") VDJ.init();
}

function initBeforeEnterFunctions(next) {
  nextPage = next || document;

  // Re-inject inline embed scripts so their functions get re-defined.
  // They won't auto-run (DOMContentLoaded already fired) — called manually below.
  rerunEmbedScripts(next);
}

function initAfterEnterFunctions(next) {
  nextPage = next || document;

  // ── Functions from site.bundle.min.js that run outside the VDJ IIFE ────────
  // These only fire on DOMContentLoaded and never re-run on Barba transitions,
  // so we need to call them manually here.

  // [data-animate] scroll animations
  if (typeof initScrollAnimations === "function") {
    initScrollAnimations();
  }

  // Draggable marquee (has built-in initialized guard)
  if (typeof initDraggableMarquee === "function" && has("[data-draggable-marquee-init]")) {
    initDraggableMarquee();
  }

  // Swiper (anonymous DOMContentLoaded in bundle — replicated here)
  if (typeof Swiper !== "undefined" && has("[data-swiper-id]")) {
    initSwiperInstances();
  }

  // Hover char stagger (has built-in initialized guard)
  if (typeof initHoverCharStagger === "function" && has("[data-hover-chars]")) {
    initHoverCharStagger();
  }

  // Hero folder card flip animations (anonymous DOMContentLoaded in bundle — replicated)
  if (has(".hero_list_item")) {
    initHeroFolderCards();
  }

  // Dynamic current year
  if (typeof initDynamicCurrentYear === "function") {
    initDynamicCurrentYear();
  }

  // ── GitHub scripts ────────────────────────────────────────────────────────

  // bunny.js
  if (typeof initBunnyPlayerBackground === "function" && has("[data-bunny-background-init]")) {
    initBunnyPlayerBackground();
  }

  // highlight.text.js
  if (typeof initHighlightText === "function" && has("[data-highlight-text]")) {
    initHighlightText();
  }

  // image.gallery.js — no named init, replicate DOMContentLoaded call
  if (typeof createLightbox === "function" && has("[data-gallery]")) {
    nextPage.querySelectorAll("[data-gallery]").forEach(wrapper => createLightbox(wrapper));
  }

  // parallax.scroll.content.js
  if (typeof VDJ_ParallaxImages !== "undefined" && has("[data-parallax]")) {
    VDJ_ParallaxImages.init(nextPage);
  }

  // people.flip.js
  if (typeof initPersonalCutoutToGrid === "function" && has(".personal_cutout_wrapper")) {
    initPersonalCutoutToGrid();
  }

  // scribble.text.js — no exposed function, replicated as initScribble()
  if (has("[data-scribble]")) {
    initScribble();
  }

  // Embed: initLayeredIllustration (re-defined by rerunEmbedScripts)
  if (typeof initLayeredIllustration === "function" && has(".sequence_section")) {
    initLayeredIllustration();
  }

  // ── Settle ────────────────────────────────────────────────────────────────
  if (window.lenis) window.lenis.resize();

  if (hasScrollTrigger) {
    ScrollTrigger.refresh();
  }
}

// Re-injects inline <script> tags so their code runs again after Barba swap.
function rerunEmbedScripts(container) {
  if (!container) return;
  container.querySelectorAll("script").forEach((old) => {
    const s = document.createElement("script");
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
}

// Remove elements appended to <body> during init that won't be removed with the container.
function cleanupBodyAppended() {
  document.querySelector(".pcg_modal_overlay")?.remove();
}

// Swiper init — anonymous DOMContentLoaded in site.bundle.min.js, replicated here.
function initSwiperInstances() {
  nextPage.querySelectorAll("[data-swiper-id]").forEach((section) => {
    const swiperEl = section.querySelector(".swiper");
    const nextEl = section.querySelector(".future-swiper-next");
    const prevEl = section.querySelector(".future-swiper-prev");
    if (!swiperEl || !nextEl || !prevEl) return;
    new Swiper(swiperEl, {
      slidesPerView: "auto",
      slidesPerGroup: 1,
      spaceBetween: 8,
      speed: 700,
      grabCursor: true,
      centeredSlides: false,
      loop: false,
      snapToSlideEdge: true,
      normalizeSlideIndex: true,
      watchOverflow: true,
      navigation: { nextEl, prevEl }
    });
  });
}

// Hero folder card flip — anonymous DOMContentLoaded in site.bundle.min.js, replicated here.
function initHeroFolderCards() {
  if (typeof gsap === "undefined") return;
  nextPage.querySelectorAll(".hero_list_item").forEach((item) => {
    const card = item.querySelector(".hero_folder_card");
    const link = item.querySelector(".hero_list_item_link");
    if (!card || !link) return;

    const front = card.querySelector(".hero_folder_front");
    const thumbs = Array.from(card.querySelectorAll(".hero_folder_thumb"));
    const layers = [front, ...thumbs].filter(Boolean);
    if (!front || !thumbs.length) return;

    thumbs.forEach((thumb, i) => { thumb.style.zIndex = 90 - i * 5; });
    front.style.zIndex = 100;

    gsap.set(layers, {
      rotationX: 0,
      y: 0,
      transformOrigin: "50% 100%",
      transformStyle: "preserve-3d",
      force3D: true
    });

    const tl = gsap.timeline({ paused: true });
    tl.to(layers, {
      duration: 0.45,
      ease: "power3.out",
      stagger: 0.03,
      rotationX: (i) => Math.min(-45 + i * 10, 0),
      y: (i) => i * -4,
      overwrite: true
    });

    const open = () => tl.play();
    const close = () => tl.reverse();

    link.addEventListener("mouseenter", open);
    link.addEventListener("mouseleave", close);
    link.addEventListener("focus", open);
    link.addEventListener("blur", close);
  });
}

// scribble.text.js — no exposed init function, replicated here with duplicate guard.
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
        scrollTrigger: { trigger: el, start: "top 80%" }
      });
    }
  });
}



// -----------------------------------------
// PAGE TRANSITIONS
// -----------------------------------------

function runPageOnceAnimation(next) {
  const tl = gsap.timeline();
  tl.call(() => resetPage(next), null, 0);
  return tl;
}

function runPageLeaveAnimation(current) {
  const tl = gsap.timeline({
    onComplete: () => {
      // Old page fully invisible — safe to destroy with no visible snapping
      if (typeof VDJ !== "undefined") VDJ.destroy();
      cleanupBodyAppended();
      current.remove();
    }
  });

  if (reducedMotion) {
    return tl.set(current, { autoAlpha: 0 });
  }

  tl.to(current, { autoAlpha: 0, duration: 0.4 });

  return tl;
}

// Enter animation runs VDJ.init() and all page inits BEFORE fading in —
// this prevents SplitText and other effects from flashing in their
// "natural" state before being hidden by their initial animation values.
// Waits for document.fonts.ready before init so SplitText measures
// correctly — fixes stutter on first visit before fonts are cached.
async function runPageEnterAnimation(next) {
  if (reducedMotion) {
    gsap.set(next, { autoAlpha: 1 });
    resetPage(next);
    return;
  }

  await new Promise(resolve => requestAnimationFrame(resolve));

  // Wait for fonts to load before SplitText measures anything.
  // On repeat visits this resolves instantly (fonts are cached).
  // On first visit it waits just long enough to measure correctly.
  await document.fonts.ready;

  // Init while page is still invisible — SplitText, ScrollTrigger, and all
  // effects set their initial states before anyone can see them
  if (typeof VDJ !== "undefined") VDJ.init();
  initAfterEnterFunctions(next);

  if (window.lenis) {
    window.lenis.resize();
    window.lenis.start();
  }

  if (hasScrollTrigger) {
    ScrollTrigger.refresh();
  }

  // Fade in — everything already in its correct initial state
  await new Promise(resolve => {
    gsap.fromTo(next,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.5, onComplete: resolve }
    );
  });

  resetPage(next);
}



// -----------------------------------------
// BARBA HOOKS + INIT
// -----------------------------------------

// Fires before everything — hides and positions new container
// before the leave animation even starts, preventing any flash.
barba.hooks.before(data => {
  gsap.set(data.next.container, {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    autoAlpha: 0
  });
});

barba.hooks.beforeEnter(data => {
  if (window.lenis) window.lenis.stop();
  initBeforeEnterFunctions(data.next.container);
  applyThemeFrom(data.next.container);
});

barba.hooks.afterLeave(() => {
  // Intentionally empty — destroy happens in runPageLeaveAnimation onComplete,
  // init happens inside runPageEnterAnimation before the fade-in
});

barba.hooks.enter(data => {
  initBarbaNavUpdate(data);
});

barba.hooks.afterEnter(() => {
  // Safety net — VDJ.init() and inits already ran inside runPageEnterAnimation
  if (window.lenis) {
    window.lenis.resize();
    window.lenis.start();
  }
});

barba.init({
  debug: false,
  timeout: 7000,
  preventRunning: true,
  transitions: [
    {
      name: "default",
      sync: false, // Sequential: leave fully completes before enter starts

      // First page load
      async once(data) {
        initOnceFunctions();
        return runPageOnceAnimation(data.next.container);
      },

      // Current page leaves
      async leave(data) {
        return runPageLeaveAnimation(data.current.container);
      },

      // New page enters — inits run before fade-in
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
  light: { nav: "dark", transition: "light" },
  dark: { nav: "light", transition: "dark" }
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
  let last = innerWidth, timer;
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
