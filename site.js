/* ==========================================================================
   Pascal Sikorski — site behaviour
   - light/dark toggle (remembers your choice, otherwise follows the OS)
   - sidebar nav highlights whichever section you are reading
   - lazy hover media: videos are fetched on first hover / tap, then cross-faded
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;

  /* --- theme -------------------------------------------------------------- */
  var toggle = document.querySelector("[data-theme-toggle]");

  function systemPrefersDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function currentTheme() {
    return root.getAttribute("data-theme") || (systemPrefersDark() ? "dark" : "light");
  }

  function paintToggle() {
    if (!toggle) { return; }
    var dark = currentTheme() === "dark";
    toggle.textContent = dark ? "Light mode" : "Dark mode";
    toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  if (toggle) {
    paintToggle();
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      paintToggle();
    });
  }

  // follow the OS while the visitor has not picked a side
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  var onSchemeChange = function () {
    var stored = null;
    try { stored = localStorage.getItem("theme"); } catch (e) {}
    if (!stored) { paintToggle(); }
  };
  if (mq.addEventListener) { mq.addEventListener("change", onSchemeChange); }
  else if (mq.addListener) { mq.addListener(onSchemeChange); }

  /* --- nav highlighting --------------------------------------------------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav a[data-nav]"));
  var sections = navLinks
    .map(function (a) { return document.getElementById(a.dataset.nav); })
    .filter(Boolean);

  if (sections.length) {
    var marked = null;

    var mark = function (id) {
      if (id === marked) { return; }
      marked = id;
      navLinks.forEach(function (a) {
        if (a.dataset.nav === id) { a.setAttribute("aria-current", "true"); }
        else { a.removeAttribute("aria-current"); }
      });
    };

    // whichever section's heading has most recently passed the reading line.
    // getBoundingClientRect is viewport relative, so this does not care about
    // offsetParent and stays correct however the page is nested.
    var update = function () {
      var line = window.innerHeight * 0.28;
      var docHeight = document.documentElement.scrollHeight;

      // Only treat this as "scrolled to the bottom" once the page is actually
      // taller than the window. On first paint, before images have reserved
      // their space, the document can be shorter than the viewport and every
      // position looks like the bottom, which would pin the last section.
      var atBottom =
        docHeight > window.innerHeight + 4 &&
        window.innerHeight + window.scrollY >= docHeight - 2;

      if (atBottom) {
        mark(sections[sections.length - 1].id);
        return;
      }

      var active = null;
      for (var i = 0; i < sections.length; i++) {
        var box = sections[i].getBoundingClientRect();
        if (box.height === 0) { continue; }   // not laid out yet
        if (box.top <= line) { active = sections[i].id; }
      }
      mark(active || sections[0].id);
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("load", update);
    update();
  }

  /* --- hover media -------------------------------------------------------- */
  // <div class="media" data-hover="video" data-src="…mp4">  → lazy <video>
  // <div class="media" data-hover="image" data-src="…webp"> → lazy <img>
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  document.querySelectorAll(".media[data-hover]").forEach(function (box) {
    var swap = null;
    var hovering = false;

    function build() {
      if (swap) { return swap; }
      if (box.dataset.hover === "video") {
        swap = document.createElement("video");
        swap.muted = true;
        swap.loop = true;
        swap.playsInline = true;
        swap.setAttribute("muted", "");
        swap.setAttribute("playsinline", "");
        swap.preload = "auto";
        swap.src = box.dataset.src;
      } else {
        swap = document.createElement("img");
        swap.alt = "";
        swap.decoding = "async";
        swap.src = box.dataset.src;
      }
      swap.className = "swap";
      box.appendChild(swap);
      // force a style flush so the browser commits opacity:0 before the class
      // flips, otherwise there is no starting value and the swap snaps in
      void swap.offsetWidth;
      return swap;
    }

    function reveal() {
      if (hovering) { box.classList.add("is-playing"); }
    }

    function start() {
      hovering = true;
      var el = build();
      if (el.play) { var p = el.play(); if (p && p.catch) { p.catch(function () {}); } }

      // on the first hover the file may not have arrived yet; fading in an empty
      // <video> would show a black square, so wait for the first frame
      if (el.tagName === "VIDEO" && el.readyState < 2) {
        el.addEventListener("loadeddata", reveal, { once: true });
      } else if (el.tagName === "IMG" && !el.complete) {
        el.addEventListener("load", reveal, { once: true });
      } else {
        reveal();
      }
    }

    function stop() {
      hovering = false;
      box.classList.remove("is-playing");
      if (swap && swap.pause) { swap.pause(); }
    }

    if (canHover) {
      box.addEventListener("mouseenter", start);
      box.addEventListener("mouseleave", stop);
      box.addEventListener("focusin", start);
      box.addEventListener("focusout", stop);
    } else {
      box.setAttribute("role", "button");
      box.setAttribute("tabindex", "0");
      box.addEventListener("click", function () {
        box.classList.contains("is-playing") ? stop() : start();
      });
    }
  });
})();
