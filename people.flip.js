function initPersonalCutoutToGrid() {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  const hero = document.querySelector(".section_bigtext_hero");
  const items = gsap.utils.toArray(".personal_cutout_wrapper[data-cutout]");
  const targets = gsap.utils.toArray(".personal_cutout_target[data-target]");
  if (!hero || !items.length || !targets.length) return;

  const targetMap = new Map();
  targets.forEach((target) => {
    const name = target.getAttribute("data-target");
    if (name) targetMap.set(name, target);
  });

  function isMobile() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  // ── Modal portal ─────────────────────────────────────────────────────────────

  const modalOverlay = document.createElement("div");
  modalOverlay.className = "pcg_modal_overlay";

  const modalBg = document.createElement("div");
  modalBg.className = "pcg_modal_bg";

  const modalBox = document.createElement("div");
  modalBox.className = "pcg_modal_box";

  modalOverlay.appendChild(modalBg);
  modalOverlay.appendChild(modalBox);
  document.body.appendChild(modalOverlay);

  const modalStyles = document.createElement("style");
  modalStyles.textContent = `
    .pcg_modal_overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      opacity: 0;
    }
    .pcg_modal_overlay.is-open {
      pointer-events: auto;
    }
    .pcg_modal_bg {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .pcg_modal_box {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    @media (max-width: 767px) {
      .personal_cutout_wrapper.is-hover-active {
        cursor: pointer;
      }
    }
  `;
  document.head.appendChild(modalStyles);

  let isOpen = false;
  let modalTween = null;

  function openModal(detailsWrapper) {
    if (isOpen) closeModal(true);
    isOpen = true;

    const clone = detailsWrapper.cloneNode(true);

    gsap.set(clone, {
      opacity: 1,
      visibility: "visible",
      display: "",
      x: 0,
      y: 0,
      scale: 1
    });

    modalBox.innerHTML = "";
    modalBox.appendChild(clone);
    modalOverlay.classList.add("is-open");

    if (modalTween) modalTween.kill();

    gsap.set(modalOverlay, { opacity: 0 });
    gsap.set(modalBox, { scale: 0.9, y: 20, opacity: 0 });

    modalTween = gsap.timeline();
    modalTween
      .to(modalOverlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(modalBox, { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 0.05);
  }

  function closeModal(immediate = false) {
    if (!isOpen) return;
    isOpen = false;

    if (modalTween) modalTween.kill();

    if (immediate) {
      gsap.set(modalOverlay, { opacity: 0 });
      modalOverlay.classList.remove("is-open");
      modalBox.innerHTML = "";
      return;
    }

    modalTween = gsap.timeline({
      onComplete: () => {
        modalOverlay.classList.remove("is-open");
        modalBox.innerHTML = "";
      }
    });

    modalTween
      .to(modalBox, { scale: 0.9, y: 20, opacity: 0, duration: 0.25, ease: "power2.in" })
      .to(modalOverlay, { opacity: 0, duration: 0.22, ease: "power2.in" }, 0.04);
  }

  modalBg.addEventListener("click", () => closeModal());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // ── Cutout click handlers (mobile only) ──────────────────────────────────────

  items.forEach((item) => {
    item.classList.remove("is-hover-active");

    const details = item.querySelector(".personal_details_wrapper");
    if (!details) return;

    item.addEventListener("click", () => {
      if (!isMobile()) return;
      if (!item.classList.contains("is-hover-active")) return;
      openModal(details);
    });
  });

  // ── Scroll animation ──────────────────────────────────────────────────────────

  function getDelta(item, target) {
    const itemRect = item.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return {
      x: targetRect.left + targetRect.width / 2 - (itemRect.left + itemRect.width / 2),
      y: targetRect.top + targetRect.height / 2 - (itemRect.top + itemRect.height / 2)
    };
  }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: "+=100%",
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const active = self.progress > 0.92;
        items.forEach((item) => {
          // Only apply is-hover-active on desktop
          item.classList.toggle("is-hover-active", active && !isMobile());
        });
      }
    }
  });

  items.forEach((item) => {
    const name = item.getAttribute("data-cutout");
    const target = targetMap.get(name);
    if (!target) return;

    tl.to(
      item,
      {
        x: () => getDelta(item, target).x,
        y: () => getDelta(item, target).y,
        rotation: 0,
        scale: 0.9,
        opacity: 1,
        ease: "none"
      },
      0
    );
  });
}

document.addEventListener("DOMContentLoaded", initPersonalCutoutToGrid);
