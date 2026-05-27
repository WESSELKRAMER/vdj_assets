(function () {
  const s = document.createElement("style");
  s.id = "vdj-fouc-hide";
  s.textContent = "[data-transition-container]{opacity:0;visibility:hidden}";
  (document.head || document.documentElement).appendChild(s);
})();

gsap.registerPlugin(CustomEase);
CustomEase.create("osmo", "0.625, 0.05, 0, 1");
gsap.defaults({ ease: "osmo" });
history.scrollRestoration = "manual";
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
  const samePage = url.pathname === location.pathname && url.search === location.search;
  if (samePage) return false;
  return true;
}
function closeHamburgerBeforeLeave(timeout = 700) {
  const statusEl = document.querySelector("[data-navigation-status]");
  const closeBtn = document.querySelector('[data-navigation-toggle="close"]');
  const isActive = () => statusEl?.getAttribute("data-navigation-status") === "active";
  if (!isActive()) return Promise.resolve();
  closeBtn?.click();
  return new Promise((resolve) => {
    const start = performance.now();
    function check() {
      if (!isActive()) return resolve();
      if (performance.now() - start >= timeout) return resolve();
      requestAnimationFrame(check);
    }
    check();
  });
}
function playEnter(container) {
  const isTransitionEnter = sessionStorage.getItem(TRANSITION_KEY) === "1";
  const navEntry = performance.getEntriesByType("navigation")[0];
  const isBrowserLoad =
    !!navEntry && (navEntry.type === "navigate" || navEntry.type === "reload");
  sessionStorage.removeItem(TRANSITION_KEY);
  // Remove the FOUC-prevention style — GSAP inline styles take over from here
  document.getElementById("vdj-fouc-hide")?.remove();
  if (reducedMotion || (!isTransitionEnter && !isBrowserLoad)) {
    gsap.set(container, { autoAlpha: 1, clearProps: "opacity,visibility" });
    return;
  }
  gsap.set(container, { autoAlpha: 0 });
  gsap.to(container, {
    autoAlpha: 1,
    duration: isBrowserLoad ? 1.2 : 1.1,
    ease: "power2.out",
    onComplete: () => gsap.set(container, { clearProps: "opacity,visibility" })
  });
}
async function playLeaveAndGo(url, container) {
  if (isLeaving) return;
  isLeaving = true;
  await closeHamburgerBeforeLeave();
  sessionStorage.setItem(TRANSITION_KEY, "1");
  if (reducedMotion) {
    location.href = url;
    return;
  }
  gsap.to(container, {
    autoAlpha: 0,
    duration: 0.7,
    ease: "power2.in",
    onComplete: () => {
      location.href = url;
    }
  });
}
function initTransitions() {
  const container = document.querySelector(CONTAINER_SELECTOR) || document.body;
  playEnter(container);
  // Fires when page is restored from bfcache (back/forward navigation)
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    isLeaving = false;
    gsap.killTweensOf(container);
    gsap.set(container, { autoAlpha: 1, clearProps: "opacity,visibility" });
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!isInternalLink(a, e)) return;
    e.preventDefault();
    playLeaveAndGo(a.href, container);
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTransitions);
} else {
  initTransitions();
}
