/* =========================================================================
   Text effects: split reveal, highlight text, hover chars, disappear,
   current year
   ========================================================================= */
(function () {
  "use strict";
  const VDJ = window.VDJ;

  /* ----------------------------------------------------------------------- */
  /* Mask reveal on [data-split="heading"]                                    */
  /*   data-split-reveal="lines|words|chars"  (default lines)                 */
  /*   data-split-immediate="true"            animate on load, not on scroll  */
  /* Headings are split right away (not lazily) so nothing flashes unsplit.   */
  /* ----------------------------------------------------------------------- */
  const splitConfig = {
    lines: { duration: 0.8, stagger: 0.08 },
    words: { duration: 0.6, stagger: 0.06 },
    chars: { duration: 0.4, stagger: 0.01 }
  };

  VDJ.splitHeading = function (heading) {
    if (heading.dataset.splitDone === "true") return null;
    heading.dataset.splitDone = "true";

    const type = ["lines", "words", "chars"].includes(heading.dataset.splitReveal)
      ? heading.dataset.splitReveal
      : "lines";
    const isImmediate = heading.dataset.splitImmediate === "true";
    const typesToSplit = type === "lines" ? ["lines"] : type === "words" ? ["lines", "words"] : ["lines", "words", "chars"];
    let played = false;

    const split = SplitText.create(heading, {
      type: typesToSplit.join(","),
      mask: "lines",
      autoSplit: true,
      linesClass: "line",
      wordsClass: "word",
      charsClass: "letter",
      onSplit(instance) {
        const targets = instance[type];
        const config = splitConfig[type];
        if (!targets || !targets.length) return;

        // Re-split after a resize / font load: don't replay the intro
        if (played && isImmediate) return;

        const animation = {
          yPercent: 110,
          duration: config.duration,
          stagger: config.stagger,
          ease: "expo.out"
        };

        if (isImmediate) {
          played = true;
          return gsap.from(targets, { ...animation, delay: 0.2 });
        }

        return gsap.from(targets, {
          ...animation,
          scrollTrigger: { trigger: heading, start: "top 80%", once: true }
        });
      }
    });

    return split;
  };

  VDJ.page("split-headings", function (container) {
    if (typeof SplitText === "undefined") return;
    const splits = [];
    const headings = container.querySelectorAll('[data-split="heading"]');
    headings.forEach((heading) => {
      const s = VDJ.splitHeading(heading);
      if (s) splits.push(s);
    });

    return () => {
      splits.forEach((s) => { try { s.revert(); } catch (e) {} });
      headings.forEach((h) => delete h.dataset.splitDone);
    };
  });

  /* ----------------------------------------------------------------------- */
  /* Highlight text: characters fade in while scrolling                       */
  /* ----------------------------------------------------------------------- */
  VDJ.page("highlight-text", function (container) {
    if (typeof SplitText === "undefined") return;
    const splits = [];

    container.querySelectorAll("[data-highlight-text]").forEach((heading) => {
      const isHero = heading.getAttribute("data-highlight-hero") === "true";
      const scrollStart = heading.getAttribute("data-highlight-scroll-start") || (isHero ? "top top" : "top 90%");
      const scrollEnd = heading.getAttribute("data-highlight-scroll-end") || (isHero ? "+=60%" : "center 40%");
      const fadedValue = parseFloat(heading.getAttribute("data-highlight-fade")) || 0.2;
      const staggerValue = parseFloat(heading.getAttribute("data-highlight-stagger")) || 0.1;

      splits.push(
        new SplitText(heading, {
          type: "words, chars",
          autoSplit: true,
          onSplit(self) {
            gsap.set(self.chars, { autoAlpha: fadedValue });
            const tl = gsap.timeline({
              scrollTrigger: {
                scrub: true,
                trigger: isHero ? document.documentElement : heading,
                start: scrollStart,
                end: scrollEnd,
                invalidateOnRefresh: true
              }
            });
            tl.fromTo(self.chars, { autoAlpha: fadedValue, immediateRender: true }, { autoAlpha: 1, stagger: staggerValue, ease: "linear" });
            return tl;
          }
        })
      );
    });

    return () => splits.forEach((s) => { try { s.revert(); } catch (e) {} });
  });

  /* ----------------------------------------------------------------------- */
  /* Hover chars (CSS does the animation, we only wrap characters)            */
  /* ----------------------------------------------------------------------- */
  VDJ.page("hover-chars", function (container) {
    container.querySelectorAll("[data-hover-chars]").forEach((el) => {
      if (el.dataset.splitInitialized === "true") return;
      el.dataset.splitInitialized = "true";

      const text = el.textContent;
      el.textContent = "";
      [...text].forEach((char, index) => {
        const span = document.createElement("span");
        span.textContent = char === " " ? " " : char;
        span.style.transitionDelay = `${index * 0.015}s`;
        el.appendChild(span);
      });
    });
  });

  /* ----------------------------------------------------------------------- */
  /* Current year                                                             */
  /* ----------------------------------------------------------------------- */
  VDJ.page("current-year", function (container) {
    const year = String(new Date().getFullYear());
    container.querySelectorAll("[data-current-year]").forEach((el) => (el.textContent = year));
  });

  /* ----------------------------------------------------------------------- */
  /* Fade-in on scroll: [data-animate="fade|fade-up|fade-down|..."]           */
  /* ----------------------------------------------------------------------- */
  VDJ.page("scroll-animations", function (container) {
    container.querySelectorAll("[data-animate]").forEach((el) => {
      const type = el.dataset.animate || "fade";
      const fromVars = { opacity: 0 };
      if (type === "fade-up") fromVars.y = 40;
      if (type === "fade-down") fromVars.y = -40;
      if (type === "fade-left") fromVars.x = 40;
      if (type === "fade-right") fromVars.x = -40;
      if (type === "zoom") fromVars.scale = 0.9;

      gsap.fromTo(el, fromVars, {
        opacity: 1, x: 0, y: 0, scale: 1,
        duration: parseFloat(el.dataset.duration) || 0.8,
        delay: parseFloat(el.dataset.delay) || 0,
        ease: el.dataset.ease || "expo.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true }
      });
    });
  });
})();
