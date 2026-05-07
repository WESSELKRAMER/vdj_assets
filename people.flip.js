function initPersonalCutoutToGrid() {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  const hero = document.querySelector(".section_bigtext_hero");
  const items = gsap.utils.toArray(".personal_cutout_wrapper");
  const targets = gsap.utils.toArray(".personal_cutout_target");

  if (!hero || !items.length || targets.length < items.length) return;

  function getDelta(item, target) {
    const itemRect = item.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    return {
      x: targetRect.left + targetRect.width / 2 - (itemRect.left + itemRect.width / 2),
      y: targetRect.top + targetRect.height / 2 - (itemRect.top + itemRect.height / 2),
    };
  }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: "+=100%",
      scrub: true,
      invalidateOnRefresh: true,
    },
  });

  items.forEach((item, i) => {
  tl.to(
    item,
    {
      x: () => getDelta(item, targets[i]).x,
      y: () => getDelta(item, targets[i]).y,
      rotation: gsap.utils.random(-0, 0),
      scale: 0.9,
      opacity: 1,
      ease: "none",
    },
    0
  );
});
}

document.addEventListener("DOMContentLoaded", initPersonalCutoutToGrid);
