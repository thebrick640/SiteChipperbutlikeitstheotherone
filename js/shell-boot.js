/* Coolbrador early shell boot: runs right after #shared-header, before main content parses. */
(function () {
  try {
    if (document.documentElement.classList.contains("cb-share-solo") ||
        (document.body && document.body.classList.contains("cb-share-solo"))) {
      return;
    }
    var FLAGS = "cb_shell_flags_v1";
    var SHELL = "cb_shell_html_v5";
    var COLLAPSE = "cbSidebarCollapsed";

    var flags = null;
    try { flags = JSON.parse(localStorage.getItem(FLAGS) || "null"); } catch (_) {}
    var shell = null;
    try { shell = JSON.parse(localStorage.getItem(SHELL) || "null"); } catch (_) {}

    var path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    var noRail = /login\.html$/i.test(path) || /styles-login/i.test(path) ||
      /simulations\.html$/i.test(path) || /\/messages/i.test(path) || /messages\.html$/i.test(path);

    var body = document.body;
    if (!body) return;

    // Early guest chrome so Pack nearby / friends don't flash from shell cache.
    var signedIn = false;
    try {
      signedIn = localStorage.getItem("loggedIn") === "true" && !!String(localStorage.getItem("currentUserId") || "").trim();
    } catch (_) {}
    body.classList.toggle("cb-signed-out", !signedIn);
    body.classList.toggle("cb-signed-in", signedIn);

    if (document.getElementById("shared-header")) {
      body.classList.add("has-cb-sidebar");
      document.documentElement.classList.add("cb-shell-sidebar");
      var collapsed = false;
      try { collapsed = localStorage.getItem(COLLAPSE) === "1"; } catch (_) {}
      body.classList.toggle("cb-sidebar-collapsed", !!collapsed);
      document.documentElement.classList.toggle("cb-shell-collapsed", !!collapsed);
    }

    if (!noRail) {
      body.classList.add("has-cb-right-rail");
      document.documentElement.classList.add("cb-shell-right-rail");
    }

    var headerHost = document.getElementById("shared-header");
    if (headerHost && shell && shell.header && !headerHost.getAttribute("data-cb-shell")) {
      headerHost.innerHTML = shell.header;
      headerHost.setAttribute("data-cb-shell", "cache");
    }

    var footerHost = document.getElementById("shared-footer");
    if (footerHost && shell && shell.footer && !footerHost.getAttribute("data-cb-shell")) {
      footerHost.innerHTML = shell.footer;
      footerHost.setAttribute("data-cb-shell", "cache");
    }

    if (!noRail && shell && shell.rightRail && !document.getElementById("cbRightRail")) {
      var wrap = document.createElement("div");
      wrap.innerHTML = shell.rightRail;
      var rail = wrap.firstElementChild;
      if (rail) {
        if (!signedIn) {
          try {
            rail.querySelectorAll(".cb-rail-pack-nearby, .cb-rail-faces").forEach(function (n) {
              var block = n.classList.contains("cb-rail-block") ? n : n.closest(".cb-rail-block");
              if (block) block.remove();
              else n.remove();
            });
          } catch (_) {}
        }
        rail.setAttribute("data-cb-shell", "cache");
        body.appendChild(rail);
      }
    }
  } catch (_) {}
})();
