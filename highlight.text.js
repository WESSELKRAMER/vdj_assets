gsap.registerPlugin(ScrollTrigger, SplitText);

function initHighlightText() {
  const splitHeadingTargets = document.querySelectorAll("[data-highlight-text]");

  splitHeadingTargets.forEach((heading) => {
    const scrollStart = heading.getAttribute("data-highlight-scroll-start") || "top 90%";
    const scrollEnd = heading.getAttribute("data-highlight-scroll-end") || "center 40%";
    const fadedValue = parseFloat(heading.getAttribute("data-highlight-fade")) || 0.2;
    const staggerValue = parseFloat(heading.getAttribute("data-highlight-stagger")) || 0.1;

    const isImmediate = heading.getAttribute("data-highlight-immediate") === "true";
    const immediateDelay = parseFloat(heading.getAttribute("data-highlight-delay")) || 0.2;
    const immediateDuration = parseFloat(heading.getAttribute("data-highlight-duration")) || 1.2;

    new SplitText(heading, {
      type: "words, chars",
      autoSplit: true,
      onSplit(self) {
        const ctx = gsap.context(() => {
          if (isImmediate) {
            gsap.from(self.chars, {
              autoAlpha: fadedValue,
              stagger: staggerValue,
              duration: immediateDuration,
              delay: immediateDelay,
              ease: "power2.out"
            });

            return;
          }

          const tl = gsap.timeline({
            scrollTrigger: {
              scrub: true,
              trigger: heading,
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
