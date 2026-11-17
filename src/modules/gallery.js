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
