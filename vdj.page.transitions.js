gsap.registerPlugin(CustomEase);
CustomEase.create("osmo", "0.625, 0.05, 0, 1");
gsap.defaults({ ease: "osmo" });

const TRANSITION_KEY = "vdj:transition";
const CONTAINER_SELECTOR = "[data-transition-container]";
const rmMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = rmMQ.matches;
rmMQ.addEventListener?.("change", (e) => (reducedMotion = e.matches));
rmMQ.addListener?.((e) => (reducedMotion = e.matches));

let isLeaving = false;

function isInternalLink(a, e) {
  if (!a || e.defaultPrevented) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;

  const href = a.getAttribute("href");
  if (!href || href.startsWith("#")) return false;

  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (url.pathname === location.pathname && url.search === location.search) return false;

  return true;
}

function playEnter(container) {
  const shouldPlay = sessionStorage.getItem(TRANSITION_KEY) === "1";
  sessionStorage.removeItem(TRANSITION_KEY);

  if (!shouldPlay || reducedMotion) {
    gsap.set(container, { autoAlpha: 1, clearProps: "all" });
    return;
  }

  gsap.set(container, { autoAlpha: 0 });
  gsap.to(container, {
    autoAlpha: 1,
    duration: 1.1,
    ease: "power2.out"
  });
}

function playLeaveAndGo(url, container) {
  if (isLeaving) return;
  isLeaving = true;

  sessionStorage.setItem(TRANSITION_KEY, "1");

  if (reducedMotion) {
    location.href = url;
    return;
  }

  gsap.to(container, {
    autoAlpha: 0,
    duration: 0.7,
    ease: "power2.in",
    onComplete: () => (location.href = url)
  });
}

// Boot
const container = document.querySelector(CONTAINER_SELECTOR) || document.body;
playEnter(container);

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!isInternalLink(a, e)) return;

  e.preventDefault();
  playLeaveAndGo(a.href, container);
});
