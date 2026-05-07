function initPersonalCutoutFlipGrid() {
  if (
    typeof gsap === "undefined" ||
    typeof ScrollTrigger === "undefined" ||
    typeof Flip === "undefined"
  ) return;

  gsap.registerPlugin(ScrollTrigger, Flip);

  const hero = document.querySelector(".section_bigtext_hero");
  const originalParent = document.querySelector(".future_hero_inner");
  const grid = document.querySelector(".personal_cutout_grid");
  const items = gsap.utils.toArray(".personal_cutout_wrapper");

  if (!hero || !originalParent || !grid || !items.length) return;

  const state = Flip.getState(items);

  items.forEach((item) => grid.appendChild(item));

  const flip = Flip.from(state, {
    absolute: true,
    ease: "none",
    stagger: 0.03,
    paused: true,
  });

  ScrollTrigger.create({
    trigger: hero,
    start: "top top",
    endTrigger: grid,
    end: "top center",
    scrub: true,
    animation: flip,
  });
}

document.addEventListener("DOMContentLoaded", initPersonalCutoutFlipGrid);
