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
  const COLOR_STAGGER = 0.12;
  const COLOR_DURATION = 0.3;
  const COLOR_TOTAL = (COLOR_COUNT - 1) * COLOR_STAGGER + COLOR_DURATION;
  const BUBBLE_VISIBLE_DURATION = 0.295;
  const BUBBLE_END_CAP = 0.63;

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
        colorWrap.appendChild(img);
        layers.push(img);
      }
      gsap.set(layers, { opacity: 0 });

      const tl = gsap.timeline({ scrollTrigger: { ...range, scrub: true } });
      layers.forEach((layer, i) => tl.to(layer, { opacity: 1, ease: "none", duration: COLOR_DURATION }, i * COLOR_STAGGER));
      offs.push(() => layers.forEach((img) => img.remove()));
    }

    /* Speech bubbles ------------------------------------------------------ */
    section.querySelectorAll("[data-bubble]").forEach((bubble) => {
      const layerIndex = parseInt(bubble.dataset.layer, 10) || 0;
      const start = colorLayerStart(layerIndex) + 0.01;
      const end = Math.min(start + BUBBLE_VISIBLE_DURATION, BUBBLE_END_CAP);

      gsap.set(bubble, { opacity: 0, y: 3 });
      gsap.timeline({ scrollTrigger: { ...range, scrub: true } })
        .to(bubble, { opacity: 1, y: 0, ease: "none", duration: 0.03, immediateRender: false }, start)
        .to(bubble, { opacity: 0, y: -3, ease: "none", duration: 0.03, immediateRender: false }, end - 0.03);
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
