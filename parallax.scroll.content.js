(function () {
  "use strict";

  function initParallaxImages(scope = document) {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

    gsap.registerPlugin(ScrollTrigger);

    const instances = [];

    const wrappers = scope.querySelectorAll("[data-parallax]");

    wrappers.forEach((wrap) => {
      if (wrap.dataset.parallaxInitialized === "true") return;

      const media = wrap.querySelector("[data-parallax-media]");
      if (!media) return;

      wrap.dataset.parallaxInitialized = "true";

      const speedAttr = parseFloat(wrap.getAttribute("data-parallax-speed"));
      const speed = Number.isFinite(speedAttr) ? speedAttr : 15;

      const directionAttr = (wrap.getAttribute("data-parallax-direction") || "up").toLowerCase();
      const direction = directionAttr === "down" ? 1 : -1;

      const fromY = direction * -speed;
      const toY = direction * speed;

      gsap.set(media, { yPercent: fromY });

      const tween = gsap.to(media, {
        yPercent: toY,
        ease: "none",
        scrollTrigger: {
          trigger: wrap,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true
        }
      });

      instances.push({
        wrap,
        media,
        tween
      });
    });

    return function destroyParallaxImages() {
      instances.forEach((instance) => {
        try {
          if (instance.tween.scrollTrigger) instance.tween.scrollTrigger.kill();
          instance.tween.kill();
        } catch (e) {}

        instance.wrap.dataset.parallaxInitialized = "false";
      });
    };
  }

  window.VDJ_ParallaxImages = {
    init: initParallaxImages
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initParallaxImages(document);
    });
  } else {
    initParallaxImages(document);
  }
})();
