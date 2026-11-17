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

    function openNavigation() {
      navStatusEl.setAttribute("data-navigation-status", "active");
      animateOpen();
    }

    function closeNavigation() {
      if (openTween) openTween.kill();
      navStatusEl.setAttribute("data-navigation-status", "not-active");
      resetLinkOpacity();
      setClosedState();
    }

    document.querySelectorAll('[data-navigation-toggle="toggle"]').forEach((btn) => {
      btn.addEventListener("click", () => (isActive() ? closeNavigation() : openNavigation()));
    });
    document.querySelectorAll('[data-navigation-toggle="close"]').forEach((btn) => {
      btn.addEventListener("click", closeNavigation);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isActive()) closeNavigation();
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
