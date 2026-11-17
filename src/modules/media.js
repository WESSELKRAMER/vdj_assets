/* =========================================================================
   Bunny HLS video players
   - [data-bunny-background-init]  muted background video (was bunny.js)
   - [data-bunny-player-init]      player with controls/sound (was bunny.sound.js)
   Both clean up their hls.js instance and observers when the page leaves.
   ========================================================================= */
(function () {
  "use strict";
  const VDJ = window.VDJ;

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

    const isSafariNative = !!video.canPlayType("application/vnd.apple.mpegurl");
    const canUseHlsJs = !!(window.Hls && Hls.isSupported()) && !isSafariNative;

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
                abrEwmaDefaultEstimate: 500000,
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
        });
        player._hls = hls;
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

    // Autoplay: play while in view, pause when out of view
    if (autoplay) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0) {
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
      try { video.pause(); } catch (e) {}
      if (player._hls) { try { player._hls.destroy(); } catch (e) {} player._hls = null; }
      try { video.removeAttribute("src"); video.load(); } catch (e) {}
    };
  }

  VDJ.page("bunny-players", function (container) {
    const destroyers = [];
    container.querySelectorAll("[data-bunny-background-init]").forEach((p) => destroyers.push(setupPlayer(p, "background")));
    container.querySelectorAll("[data-bunny-player-init]").forEach((p) => destroyers.push(setupPlayer(p, "basic")));
    return () => destroyers.forEach((d) => d && d());
  });
})();
