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

  function getDelta(item, target) {
    const itemRect = item.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    return {
      x: targetRect.left + targetRect.width / 2 - (itemRect.left + itemRect.width / 2),
      y: targetRect.top + targetRect.height / 2 - (itemRect.top + itemRect.height / 2)
    };
  }

  items.forEach((item) => {
    item.classList.remove("is-hover-active");
  });

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
          item.classList.toggle("is-hover-active", active);
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
