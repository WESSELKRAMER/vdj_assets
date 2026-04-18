document.addEventListener("DOMContentLoaded", () => {
  const scribbles = [
    `M4 12 C70 8, 140 16, 296 10`,
    `M4 12 C60 14, 120 6, 296 11`,
    `M4 12 C80 9, 180 18, 296 10`
  ];

  const elements = document.querySelectorAll("[data-scribble]");

  elements.forEach((el, index) => {
    // wrap content
    const wrapper = document.createElement("span");
    wrapper.className = "scribble_wrap";

    // move text into wrapper
    wrapper.textContent = el.textContent;
    el.textContent = "";
    el.appendChild(wrapper);

    // create SVG
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "scribble_line");
    svg.setAttribute("viewBox", "0 0 300 20");
    svg.setAttribute("preserveAspectRatio", "none");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // random path
    const randomPath = scribbles[Math.floor(Math.random() * scribbles.length)];
    path.setAttribute("d", randomPath);

    svg.appendChild(path);
    wrapper.appendChild(svg);

    // setup stroke animation
    const length = path.getTotalLength();
    path.style.strokeDasharray = length;
    path.style.strokeDashoffset = length;

    // animate with GSAP if available
    if (typeof gsap !== "undefined") {
      gsap.to(path, {
        strokeDashoffset: 0,
        duration: 1,
        ease: "power2.out",
        delay: index * 0.15,
        scrollTrigger: {
          trigger: el,
          start: "top 80%"
        }
      });
    }
  });
});
