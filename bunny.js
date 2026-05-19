function initBunnyPlayerBackground() {
  document.querySelectorAll("[data-bunny-background-init]").forEach(function (player) {
    var src = player.getAttribute("data-player-src");
    if (!src) return;

    var video = player.querySelector("video");
    if (!video) return;

    try { video.pause(); } catch (_) {}
    try { video.removeAttribute("src"); video.load(); } catch (_) {}

    function setStatus(s) {
      if (player.getAttribute("data-player-status") !== s) {
        player.setAttribute("data-player-status", s);
      }
    }

    function setActivated(v) {
      player.setAttribute("data-player-activated", v ? "true" : "false");
    }

    if (!player.hasAttribute("data-player-activated")) setActivated(false);
    if (!player.hasAttribute("data-player-status")) setStatus("idle");

    var lazyMode = player.getAttribute("data-player-lazy");
    var isLazyTrue = lazyMode === "true";
    var autoplay = player.getAttribute("data-player-autoplay") === "true";
    var initialMuted = player.getAttribute("data-player-muted") === "true";

    var pendingPlay = false;
    var isAttached = false;
    var lastPauseBy = "";

    video.muted = autoplay ? true : initialMuted;
    video.loop = autoplay;
    video.preload = isLazyTrue ? "none" : "auto";

    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.playsInline = true;

    if (typeof video.disableRemotePlayback !== "undefined") {
      video.disableRemotePlayback = true;
    }

    if (autoplay) video.autoplay = false;

    var ua = navigator.userAgent.toLowerCase();
    var isSafari =
      ua.indexOf("safari") > -1 &&
      ua.indexOf("chrome") === -1 &&
      ua.indexOf("crios") === -1 &&
      ua.indexOf("chromium") === -1 &&
      ua.indexOf("android") === -1;

    var isSafariNative =
      isSafari && !!video.canPlayType("application/vnd.apple.mpegurl");

    var canUseHlsJs =
      !!(window.Hls && Hls.isSupported()) && !isSafariNative;

    console.log("Bunny player debug", {
      src: src,
      isSafari: isSafari,
      isSafariNative: isSafariNative,
      hasHls: !!window.Hls,
      hlsSupported: !!(window.Hls && Hls.isSupported()),
      canUseHlsJs: canUseHlsJs,
      lazy: isLazyTrue,
      autoplay: autoplay
    });

    function attachMediaOnce() {
      if (isAttached) return;
      isAttached = true;

      console.log("Bunny attach media:", src);

      if (player._hls) {
        try { player._hls.destroy(); } catch (_) {}
        player._hls = null;
      }

      if (canUseHlsJs) {
        var hls = new Hls({
          startLevel: -1,
          capLevelToPlayerSize: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          abrEwmaFastVoD: 2,
          abrEwmaSlowVoD: 5,
          abrEwmaFastLive: 2,
          abrEwmaSlowLive: 5,
          abrBandWidthFactor: 0.95,
          abrBandWidthUpFactor: 0.9,
          maxStarvationDelay: 4,
          maxLoadingDelay: 4
        });

        hls.attachMedia(video);

        hls.on(Hls.Events.MEDIA_ATTACHED, function () {
          console.log("HLS.js attached, loading:", src);
          hls.loadSource(src);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          console.log("HLS manifest parsed");

          if (hls.levels && hls.levels.length) {
            console.table(
              hls.levels.map(function (level, index) {
                return {
                  index: index,
                  width: level.width,
                  height: level.height,
                  bitrate: level.bitrate
                };
              })
            );

            var highestLevel = hls.levels.length - 1;

            hls.loadLevel = highestLevel;
            hls.nextLevel = highestLevel;
            hls.currentLevel = highestLevel;

            console.log("Forced HLS level:", highestLevel);
          } else {
            console.warn("No HLS levels found.");
          }

          readyIfIdle(player, pendingPlay);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, function (_, data) {
          var level = hls.levels && hls.levels[data.level];

          console.log("HLS level switched", {
            level: data.level,
            width: level && level.width,
            height: level && level.height,
            bitrate: level && level.bitrate
          });
        });

        hls.on(Hls.Events.ERROR, function (_, data) {
          console.warn("HLS error", data);

          if (!data || !data.fatal) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            try { hls.startLoad(); } catch (_) {}
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            try { hls.recoverMediaError(); } catch (_) {}
          } else {
            try { hls.destroy(); } catch (_) {}
          }
        });

        player._hls = hls;

      } else if (isSafariNative) {
        console.log("Using Safari/native HLS. HLS.js quality forcing will not run.");

        video.src = src;

        video.addEventListener("loadedmetadata", function () {
          console.log("Native video metadata loaded", {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
          });

          readyIfIdle(player, pendingPlay);
        }, { once: true });

      } else {
        console.warn("HLS.js unavailable. Falling back to direct video src:", src);

        video.src = src;

        video.addEventListener("loadedmetadata", function () {
          console.log("Fallback video metadata loaded", {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
          });

          readyIfIdle(player, pendingPlay);
        }, { once: true });
      }
    }

    if (!isLazyTrue) {
      attachMediaOnce();
    }

    function togglePlay() {
      if (video.paused || video.ended) {
        if (isLazyTrue && !isAttached) attachMediaOnce();

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

    player.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-player-control]");
      if (!btn || !player.contains(btn)) return;

      var type = btn.getAttribute("data-player-control");

      if (type === "play" || type === "pause" || type === "playpause") {
        togglePlay();
      } else if (type === "mute") {
        toggleMute();
      }
    });

    video.addEventListener("play", function () {
      setActivated(true);
      setStatus("playing");
    });

    video.addEventListener("playing", function () {
      pendingPlay = false;
      setStatus("playing");
    });

    video.addEventListener("pause", function () {
      pendingPlay = false;
      setStatus("paused");
    });

    video.addEventListener("waiting", function () {
      setStatus("loading");
    });

    video.addEventListener("canplay", function () {
      readyIfIdle(player, pendingPlay);
    });

    video.addEventListener("loadedmetadata", function () {
      console.log("Video element metadata", {
        src: src,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
    });

    video.addEventListener("ended", function () {
      pendingPlay = false;
      setStatus("paused");
      setActivated(false);
    });

    if (autoplay) {
      if (player._io) {
        try { player._io.disconnect(); } catch (_) {}
      }

      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var inView = entry.isIntersecting && entry.intersectionRatio > 0;

          if (inView) {
            if (isLazyTrue && !isAttached) attachMediaOnce();

            if (lastPauseBy === "io" || (video.paused && lastPauseBy !== "manual")) {
              setStatus("loading");

              if (video.paused) {
                pendingPlay = true;
                safePlay(video);
              }

              lastPauseBy = "";
            }
          } else {
            if (!video.paused && !video.ended) {
              lastPauseBy = "io";
              video.pause();
            }
          }
        });
      }, { threshold: 0.1 });

      io.observe(player);
      player._io = io;
    }
  });

  function readyIfIdle(player, pendingPlay) {
    if (
      !pendingPlay &&
      player.getAttribute("data-player-activated") !== "true" &&
      player.getAttribute("data-player-status") === "idle"
    ) {
      player.setAttribute("data-player-status", "ready");
    }
  }

  function safePlay(video) {
    var p = video.play();

    if (p && typeof p.then === "function") {
      p.catch(function (err) {
        console.warn("Video play blocked or failed", err);
      });
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initBunnyPlayerBackground();
});
