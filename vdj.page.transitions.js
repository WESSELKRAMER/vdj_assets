gsap.registerPlugin(CustomEase);

history.scrollRestoration = "manual";

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



function initOnceFunctions() {
  if (onceFunctionsInitialized) return;
  onceFunctionsInitialized = true;
  if (typeof VDJ !== "undefined") VDJ.init();
}

function initBeforeEnterFunctions(next) {
  nextPage = next || document;
  rerunEmbedScripts(next);
}

function initAfterEnterFunctions(next) {
  nextPage = next || document;

  if (typeof initScrollAnimations === "function") {
    initScrollAnimations();
  }

  if (typeof initDraggableMarquee === "function" && has("[data-draggable-marquee-init]")) {
    initDraggableMarquee();
  }

  if (typeof Swiper !== "undefined" && has("[data-swiper-id]")) {
    initSwiperInstances();
  }

  if (typeof initHoverCharStagger === "function" && has("[data-hover-chars]")) {
    initHoverCharStagger();
  }

  if (has(".hero_list_item")) {
    initHeroFolderCards();
  }

  if (typeof initDynamicCurrentYear === "function") {
    initDynamicCurrentYear();
  }

  if (typeof initBunnyPlayerBackground === "function" && has("[data-bunny-background-init]")) {
    initBunnyPlayerBackground();
  }

  if (typeof initHighlightText === "function" && has("[data-highlight-text]")) {
    initHighlightText();
  }

  if (typeof createLightbox === "function" && has("[data-gallery]")) {
    nextPage.querySelectorAll("[data-gallery]").forEach(wrapper => createLightbox(wrapper));
  }

  if (typeof VDJ_ParallaxImages !== "undefined" && has("[data-parallax]")) {
    VDJ_ParallaxImages.init(nextPage);
  }

  if (typeof initPersonalCutoutToGrid === "function" && has(".personal_cutout_wrapper")) {
    initPersonalCutoutToGrid();
  }

  if (has("[data-scribble]")) {
    initScribble();
  }

  if (typeof initLayeredIllustration === "function" && has(".sequence_section")) {
    initLayeredIllustration();
  }

  if (window.lenis) window.lenis.resize();

  if (hasScrollTrigger) {
    ScrollTrigger.refresh();
  }
}

function rerunEmbedScripts(container) {
  if (!container) return;
  container.querySelectorAll("script").forEach((old) => {
    const s = document.createElement("script");
    s.textContent = old.textContent;
    old.replaceWith(s);
  });
}

function cleanupBodyAppended() {
  document.querySelector(".pcg_modal_overlay")?.remove();
}

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



function runPageOnceAnimation(next) {
  const tl = gsap.timeline();
  tl.call(() => resetPage(next), null, 0);
  return tl;
}

function runPageLeaveAnimation(current) {
  const tl = gsap.timeline({
    onComplete: () => {
      if (typeof VDJ !== "undefined") VDJ.destroy();
      cleanupBodyAppended();
      current.remove();
    }
  });

  if (reducedMotion) {
    return tl.set(current, { autoAlpha: 0 });
  }

  tl.to(current, { autoAlpha: 0, duration: 0.5 });

  return tl;
}

async function runPageEnterAnimation(next) {
  if (reducedMotion) {
    gsap.set(next, { autoAlpha: 1 });
    resetPage(next);
    initAfterEnterFunctions(next);
    return;
  }

  await new Promise(resolve => requestAnimationFrame(resolve));

  await Promise.race([
    document.fonts.ready,
    new Promise(resolve => setTimeout(resolve, 500))
  ]);

  if (typeof VDJ !== "undefined") VDJ.init();

  if (window.lenis) {
    window.lenis.resize();
    window.lenis.start();
  }

  const fadeTl = gsap.timeline();

  fadeTl.fromTo(next,
    { autoAlpha: 0 },
    { autoAlpha: 0.15, duration: 0.45, ease: "power2.in" }
  );

  initAfterEnterFunctions(next);

  fadeTl.to(next, { autoAlpha: 1, duration: 1, ease: "power2.out" });

  await new Promise(resolve => fadeTl.call(resolve));

  resetPage(next);
}



barba.hooks.before(data => {
  const navStatusEl = document.querySelector("[data-navigation-status]");
  if (navStatusEl?.getAttribute("data-navigation-status") === "active") {
    document.querySelector('[data-navigation-toggle="close"]')?.click();
  }

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

barba.hooks.afterLeave(() => {});

barba.hooks.enter(data => {
  initBarbaNavUpdate(data);
});

barba.hooks.afterEnter(() => {
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
      sync: false,

      async once(data) {
        initOnceFunctions();
        return runPageOnceAnimation(data.next.container);
      },

      async leave(data) {
        return runPageLeaveAnimation(data.current.container);
      },

      async enter(data) {
        return runPageEnterAnimation(data.next.container);
      }
    }
  ],
});



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
