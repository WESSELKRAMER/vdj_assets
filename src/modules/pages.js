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
