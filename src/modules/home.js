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
      initDisappearText(container)
    ].filter(Boolean);

    return () => cleanups.reverse().forEach((fn) => fn());
  });
})();
