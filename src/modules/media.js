/* =========================================================================
   Bunny HLS video players
   - [data-bunny-background-init]  muted background video (was bunny.js)
   - [data-bunny-player-init]      player with controls/sound (was bunny.sound.js)
   Both clean up their hls.js instance and observers when the page leaves.
   ========================================================================= */
(function () {
  "use strict";
  const VDJ = window.VDJ;
  const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS

  function safePlay(video) {
    const p = video.play();
    if (p && typeof p.then === "function") p.catch(() => {});
  }

  function readyIfIdle(player, pendingPlay) {
    if (!pendingPlay &&
        player.getAttribute("data-player-activated") !== "true" &&
        player.getAttribute("data-player-status") === "idle") {
      player.setAttribute("data-player-status", "ready");
    }
  }

  function bestLevel(levels) {
    if (!levels || !levels.length) return null;
    return levels.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a), levels[0]);
  }

  function setBeforeRatio(player, updateSize, w, h) {
    if (updateSize !== "true" || !w || !h) return;
    const before = player.querySelector("[data-player-before]");
    if (before) before.style.paddingTop = (h / w) * 100 + "%";
  }

  function resolveUrl(base, rel) {
    try { return new URL(rel, base).toString(); } catch (e) { return rel; }
  }

  /** duration + aspect without attaching playback (lazy="meta") */
  function getSourceMeta(src, useHlsJs) {
    return new Promise((resolve) => {
      const empty = { width: 0, height: 0, duration: NaN };

      if (useHlsJs && window.Hls && Hls.isSupported()) {
        try {
          const tmp = new Hls();
          const out = { ...empty };
          const done = () => { try { tmp.destroy(); } catch (e) {} resolve(out); };
          const timer = setTimeout(done, 8000);
          tmp.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
            const best = bestLevel((data && data.levels) || tmp.levels || []);
            if (best && best.width && best.height) { out.width = best.width; out.height = best.height; }
          });
          tmp.on(Hls.Events.LEVEL_LOADED, (e, data) => {
            if (data && data.details && isFinite(data.details.totalduration)) out.duration = data.details.totalduration;
            clearTimeout(timer);
            done();
          });
          tmp.on(Hls.Events.ERROR, () => { clearTimeout(timer); done(); });
          tmp.loadSource(src);
          return;
        } catch (e) {
          resolve(empty);
          return;
        }
      }

      fetch(src, { credentials: "omit", cache: "no-store" })
        .then((r) => { if (!r.ok) throw new Error("master"); return r.text(); })
        .then((master) => {
          const lines = master.split(/\r?\n/);
          let bestW = 0, bestH = 0, media = null, lastInf = null;
          lines.forEach((line) => {
            if (line.indexOf("#EXT-X-STREAM-INF:") === 0) lastInf = line;
            else if (lastInf && line && line[0] !== "#") {
              if (!media) media = line.trim();
              const m = /RESOLUTION=(\d+)x(\d+)/.exec(lastInf);
              if (m && parseInt(m[1], 10) > bestW) { bestW = parseInt(m[1], 10); bestH = parseInt(m[2], 10); }
              lastInf = null;
            }
          });
          if (!media) return resolve({ width: bestW, height: bestH, duration: NaN });
          return fetch(resolveUrl(src, media), { credentials: "omit", cache: "no-store" })
            .then((r) => { if (!r.ok) throw new Error("media"); return r.text(); })
            .then((text) => {
              let dur = 0, m;
              const re = /#EXTINF:([\d.]+)/g;
              while ((m = re.exec(text))) dur += parseFloat(m[1]);
              resolve({ width: bestW, height: bestH, duration: dur });
            });
        })
        .catch(() => resolve(empty));
    });
  }

  /**
   * Shared player setup.
   * mode "background": eager unless lazy="true", big buffer, no hover/ratio
   * mode "basic": supports lazy="meta", update-size, hover state
   */
  function setupPlayer(player, mode) {
    const src = player.getAttribute("data-player-src");
    const video = player.querySelector("video");
    if (!src || !video) return null;

    const isBasic = mode === "basic";
    const offs = [];
    let io = null;

    try { video.pause(); } catch (e) {}
    try { video.removeAttribute("src"); video.load(); } catch (e) {}

    const setStatus = (s) => player.getAttribute("data-player-status") !== s && player.setAttribute("data-player-status", s);
    const setActivated = (v) => player.setAttribute("data-player-activated", v ? "true" : "false");
    if (!player.hasAttribute("data-player-activated")) setActivated(false);

    const updateSize = isBasic ? player.getAttribute("data-player-update-size") : null;
    const lazyMode = player.getAttribute("data-player-lazy");
    const isLazyTrue = lazyMode === "true";
    const isLazyMeta = isBasic && lazyMode === "meta";
    const autoplay = player.getAttribute("data-player-autoplay") === "true";

    let pendingPlay = false;
    let isAttached = false;
    let lastPauseBy = "";

    if (autoplay) { video.muted = true; video.loop = true; video.autoplay = false; }
    else video.muted = isBasic ? false : player.getAttribute("data-player-muted") === "true";

    if (!isBasic || autoplay) video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.playsInline = true;
    if (typeof video.disableRemotePlayback !== "undefined") video.disableRemotePlayback = true;

    // Which engine: hls.js wherever it's supported, except iPhone/iPad where
    // native HLS is the reliable path. Recent Chrome also plays HLS natively,
    // but with the Bunny CDN that fails intermittently
    // (ERR_CONTENT_DECODING_FAILED -> video stuck), so we don't use it there.
    const nativeHls = !!video.canPlayType("application/vnd.apple.mpegurl");
    const hlsJsSupported = !!(window.Hls && Hls.isSupported());
    const isSafariNative = nativeHls && (IS_IOS || !hlsJsSupported);
    const canUseHlsJs = hlsJsSupported && !isSafariNative;
    let nativeRetries = 0;
    let hlsRecoveries = 0;

    function useHlsJs() {
      if (player._hls) { try { player._hls.destroy(); } catch (e) {} player._hls = null; }
      try { video.removeAttribute("src"); video.load(); } catch (e) {}
      const hls = new Hls(
        isBasic
          ? { maxBufferLength: 10 }
          : {
              // Background loops are short: 30s ahead is plenty and keeps
              // memory down on pages with many videos
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              maxBufferSize: 60 * 1000 * 1000,
              maxBufferHole: 0.3,
              autoStartLoad: true,
              startLevel: -1, // automatic quality
              // start from a realistic bandwidth guess instead of 500 kbps,
              // so the first frames aren't the blurry lowest rendition
              abrEwmaDefaultEstimate: 3000000,
              backBufferLength: 30,
              lowLatencyMode: false
            }
      );
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(src));
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        readyIfIdle(player, pendingPlay);
        if (updateSize === "true") {
          const best = bestLevel(hls.levels || []);
          if (best && best.width && best.height) setBeforeRatio(player, updateSize, best.width, best.height);
        }
        if (pendingPlay || (autoplay && lastPauseBy === "" && isInView)) safePlay(video);
      });
      // recover instead of getting stuck on a failed request or decode
      hls.on(Hls.Events.ERROR, (e, data) => {
        if (!data || !data.fatal) return;
        if (hlsRecoveries++ >= 3) { try { hls.destroy(); } catch (err) {} player._hls = null; return; }
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) setTimeout(() => hls.startLoad(), 1000);
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else setTimeout(useHlsJs, 1000);
      });
      player._hls = hls;
    }

    // native playback failed: fall back to hls.js, or retry once
    offs.push(VDJ.on(video, "error", () => {
      if (!isAttached || player._hls) return;
      if (hlsJsSupported && !player._hls) { useHlsJs(); return; }
      if (nativeRetries++ < 2) {
        setTimeout(() => {
          video.src = src;
          video.load();
          if (pendingPlay || isInView) safePlay(video);
        }, 800 * nativeRetries);
      }
    }));

    let isInView = false;

    function attachMediaOnce() {
      if (isAttached) return;
      isAttached = true;
      if (player._hls) { try { player._hls.destroy(); } catch (e) {} player._hls = null; }

      if (isSafariNative) {
        video.preload = "auto";
        video.src = src;
        video.addEventListener("loadedmetadata", () => {
          readyIfIdle(player, pendingPlay);
          if (updateSize === "true") setBeforeRatio(player, updateSize, video.videoWidth, video.videoHeight);
        }, { once: true });
      } else if (canUseHlsJs) {
        useHlsJs();
      } else {
        video.preload = "auto";
        video.src = src;
      }
    }

    // Initial attach strategy
    if (isLazyMeta) {
      if (updateSize === "true") {
        getSourceMeta(src, canUseHlsJs).then((meta) => {
          if (meta.width && meta.height) setBeforeRatio(player, updateSize, meta.width, meta.height);
          readyIfIdle(player, pendingPlay);
        });
      }
      video.preload = "none";
    } else if (isLazyTrue) {
      video.preload = "none";
    } else {
      video.preload = "auto";
      attachMediaOnce();
    }

    function togglePlay() {
      if (video.paused || video.ended) {
        if ((isLazyTrue || isLazyMeta) && !isAttached) attachMediaOnce();
        pendingPlay = true;
        lastPauseBy = "";
        setStatus("loading");
        safePlay(video);
      } else {
        lastPauseBy = "manual";
        video.pause();
      }
    }

    function toggleMute() {
      video.muted = !video.muted;
      player.setAttribute("data-player-muted", video.muted ? "true" : "false");
    }

    offs.push(
      VDJ.on(player, "click", (e) => {
        const btn = e.target.closest("[data-player-control]");
        if (!btn || !player.contains(btn)) return;
        const type = btn.getAttribute("data-player-control");
        if (type === "play" || type === "pause" || type === "playpause") togglePlay();
        else if (type === "mute") toggleMute();
      }),
      VDJ.on(video, "play", () => { setActivated(true); setStatus("playing"); }),
      VDJ.on(video, "playing", () => { pendingPlay = false; setStatus("playing"); }),
      VDJ.on(video, "pause", () => { pendingPlay = false; setStatus("paused"); }),
      VDJ.on(video, "waiting", () => setStatus("loading")),
      VDJ.on(video, "canplay", () => readyIfIdle(player, pendingPlay)),
      // first frame is there: show the video (CSS fades it in), even if it
      // hasn't started playing yet
      VDJ.on(video, "loadeddata", () => player.setAttribute("data-player-frame", "true")),
      VDJ.on(video, "ended", () => { pendingPlay = false; setStatus("paused"); setActivated(false); })
    );

    if (isBasic) {
      const setHover = (state) => player.getAttribute("data-player-hover") !== state && player.setAttribute("data-player-hover", state);
      const setRatioFromVideo = () => {
        if (updateSize === "true" && video.videoWidth && video.videoHeight) setBeforeRatio(player, updateSize, video.videoWidth, video.videoHeight);
      };
      offs.push(
        VDJ.on(player, "pointerenter", () => setHover("active")),
        VDJ.on(player, "pointerleave", () => setHover("idle")),
        VDJ.on(video, "loadedmetadata", setRatioFromVideo),
        VDJ.on(video, "loadeddata", setRatioFromVideo)
      );
    }

    // Lazy players: start loading about one screen before they scroll into
    // view, so they're ready (not popping in) by the time you see them
    let preloadIo = null;
    if ((isLazyTrue || isLazyMeta) && autoplay) {
      preloadIo = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          attachMediaOnce();
          preloadIo.disconnect();
        }
      }, { rootMargin: "100% 0px 100% 0px" });
      preloadIo.observe(player);
    }

    // Autoplay: play while in view, pause when out of view
    if (autoplay) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          isInView = entry.isIntersecting && entry.intersectionRatio > 0;
          if (isInView) {
            if ((isLazyTrue || isLazyMeta) && !isAttached) attachMediaOnce();
            if (lastPauseBy === "io" || (video.paused && lastPauseBy !== "manual")) {
              setStatus("loading");
              if (video.paused) togglePlay();
              lastPauseBy = "";
            }
          } else if (!video.paused && !video.ended) {
            lastPauseBy = "io";
            video.pause();
          }
        });
      }, { threshold: 0.1 });
      io.observe(player);
    }

    return function destroy() {
      offs.forEach((off) => off());
      if (io) io.disconnect();
      if (preloadIo) preloadIo.disconnect();
      try { video.pause(); } catch (e) {}
      if (player._hls) { try { player._hls.destroy(); } catch (e) {} player._hls = null; }
      try { video.removeAttribute("src"); video.load(); } catch (e) {}
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Images                                                                   */
  /* Webflow gives every image sizes="100vw", so a 450px image downloads the  */
  /* full-screen version. We set sizes to the real rendered width and start   */
  /* loading lazy images a screen early. Images that still arrive late fade   */
  /* in instead of popping in.                                                */
  /* ----------------------------------------------------------------------- */
  VDJ.page("images", function () {
    const images = Array.from(document.querySelectorAll("img")).filter(
      (img) => !img.closest(".navbar_wrapper, .project_cards_source") && !(img.complete && img.naturalWidth)
    );
    if (!images.length) return;

    images.forEach((img) => {
      // real width for srcset selection (only for responsive images)
      if (img.srcset && (!img.sizes || img.sizes === "100vw")) {
        const w = Math.ceil(img.getBoundingClientRect().width || img.parentElement?.getBoundingClientRect().width || 0);
        if (w > 0) img.sizes = `${w}px`;
      }
      img.classList.add("vdj-img-loading");
    });

    // fade in when loaded. Listening on the document (capture) also covers
    // copies made later, e.g. the cards the home canvas clones.
    const done = (e) => {
      const img = e.target;
      if (!img || img.tagName !== "IMG" || !img.classList.contains("vdj-img-loading")) return;
      // transition only while fading in, so it never slows down GSAP
      // animations on images later
      img.classList.add("vdj-img-fade");
      img.classList.remove("vdj-img-loading");
      setTimeout(() => img.classList.remove("vdj-img-fade"), 600);
    };
    const offs = [VDJ.on(document, "load", done, true), VDJ.on(document, "error", done, true)];
    // never leave an image hidden
    const failsafe = setTimeout(() => {
      document.querySelectorAll("img.vdj-img-loading").forEach((img) => img.classList.remove("vdj-img-loading"));
    }, 8000);
    const timers = [failsafe];

    const lazy = images.filter((img) => img.loading === "lazy");
    let io = null;
    if (lazy.length && "IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.loading = "eager"; // starts the download now
          io.unobserve(entry.target);
        });
      }, { rootMargin: "150% 0px 150% 0px" });
      lazy.forEach((img) => io.observe(img));
    }

    return () => {
      offs.forEach((off) => off());
      timers.forEach(clearTimeout);
      if (io) io.disconnect();
      document.querySelectorAll("img.vdj-img-loading").forEach((img) => img.classList.remove("vdj-img-loading"));
    };
  });

  VDJ.page("bunny-players", function (container) {
    const destroyers = [];
    container.querySelectorAll("[data-bunny-background-init]").forEach((p) => destroyers.push(setupPlayer(p, "background")));
    container.querySelectorAll("[data-bunny-player-init]").forEach((p) => destroyers.push(setupPlayer(p, "basic")));
    return () => destroyers.forEach((d) => d && d());
  });
})();
