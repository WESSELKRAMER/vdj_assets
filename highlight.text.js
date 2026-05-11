gsap.registerPlugin(ScrollTrigger, SplitText);

function initHighlightText() {
  const splitHeadingTargets = document.querySelectorAll("[data-highlight-text]");

  splitHeadingTargets.forEach((heading) => {
    const isHero = heading.getAttribute("data-highlight-hero") === "true";

    const scrollStart =
      heading.getAttribute("data-highlight-scroll-start") ||
      (isHero ? "top top" : "top 90%");

    const scrollEnd =
      heading.getAttribute("data-highlight-scroll-end") ||
      (isHero ? "+=60%" : "center 40%");

    const fadedValue = parseFloat(heading.getAttribute("data-highlight-fade")) || 0.2;
    const staggerValue = parseFloat(heading.getAttribute("data-highlight-stagger")) || 0.1;

    new SplitText(heading, {
      type: "words, chars",
      autoSplit: true,
      onSplit(self) {
        const ctx = gsap.context(() => {
          const tl = gsap.timeline({
            scrollTrigger: {
              scrub: true,
              trigger: isHero ? document.documentElement : heading,
              start: scrollStart,
              end: scrollEnd
            }
          });

          tl.from(self.chars, {
            autoAlpha: fadedValue,
            stagger: staggerValue,
            ease: "linear"
          });
        });

        return ctx;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initHighlightText();
});
