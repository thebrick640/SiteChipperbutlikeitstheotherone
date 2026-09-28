/**
 * Shared layout loader for Coolbrador pages.
 */
(function () {
  window.addEventListener('error', function (event) {
    if (!(event.target instanceof HTMLScriptElement) || !event.target.src.endsWith('/js/social.js')) return;
    const root = document.getElementById('socialRoot');
    if (!root) return;
    root.innerHTML = '<p role="alert">The community could not connect. Check your connection and try again.</p><button type="button">Try again</button>';
    root.querySelector('button').onclick = function () { location.reload(); };
  }, true);
  // Apply palette + light/dark + rice ASAP (uses CoolbradorRice when loaded)
  (function applyThemeEarly() {
    try {
      if (window.CoolbradorRice) {
        window.CoolbradorRice.earlyBoot();
        return;
      }
      var KNOWN = ["default","green","ember","violet","ocean","rose","slate"];
      var t = localStorage.getItem("cb_theme") || "default";
      if (t === "certa-green") t = "green";
      if (t === "light") {
        t = "default";
        try {
          localStorage.setItem("cb_theme", "default");
          if (!localStorage.getItem("cb_mode")) localStorage.setItem("cb_mode", "light");
        } catch (_) {}
      }
      if (KNOWN.indexOf(t) === -1) t = "default";
      var mode = localStorage.getItem("cb_mode") === "light" ? "light" : "dark";
      var root = document.documentElement;
      root.dataset.theme = t;
      root.dataset.mode = mode;
      if (document.body) {
        Array.prototype.slice.call(document.body.classList).forEach(function (c) {
          if (c.indexOf("theme-") === 0 || c.indexOf("mode-") === 0) document.body.classList.remove(c);
        });
        if (t !== "default") document.body.classList.add("theme-" + t);
        document.body.classList.add("mode-" + mode);
      }
      var accent = localStorage.getItem("cb_custom_accent");
      if (accent) {
        root.style.setProperty("--cb-accent", accent);
        root.style.setProperty("--cb-link", accent);
        var h = String(accent).replace("#", "");
        if (h.length === 6) {
          root.style.setProperty("--cb-accent-rgb", parseInt(h.slice(0,2),16) + ", " + parseInt(h.slice(2,4),16) + ", " + parseInt(h.slice(4,6),16));
        }
      }
      var wall = localStorage.getItem("cb_wallpaper");
      if (wall) {
        root.classList.add("cb-has-wallpaper");
        root.style.setProperty("--cb-wallpaper", 'url("' + wall.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '")');
        root.style.setProperty("--cb-wallpaper-tint", (localStorage.getItem("cb_wallpaper_tint") || "55") + "%");
        root.style.setProperty("--cb-wallpaper-blur", (localStorage.getItem("cb_wallpaper_blur") || "0") + "px");
        if (document.body) document.body.classList.add("cb-has-wallpaper");
      }
    } catch (_) {}
  })();
  (function loadRice() {
    if (window.CoolbradorRice) return;
    var s = document.createElement("script");
    s.src = "/js/theme-rice.js";
    s.async = true;
    s.onload = function () {
      try {
        if (window.CoolbradorRice) window.CoolbradorRice.applyRice({ persist: false });
      } catch (_) {}
    };
    (document.head || document.documentElement).appendChild(s);
  })();
  const KNOWN = [
    { title: "Home", url: "/", hint: "Hub", section: "Pages" },
    { title: "Community", url: "/community.html", hint: "Boards and posts", section: "Discussions" },
    { title: "Simulations", url: "/simulations.html", hint: "LabradorSim civic lab", section: "Pages" },
    { title: "Notifications", url: "/notifications", hint: "Alerts", section: "Pages" },
    { title: "Messages", url: "/messages", hint: "DMs", section: "Pages" },
    { title: "Chipper", url: "/games/chipper.html", hint: "Play soon", section: "Games" },
    { title: "Polls", url: "/polls.html", hint: "Issues / Mutinies / Ideas", section: "Discussions" },
    { title: "Gift", url: "/gift.html", hint: "Community drawings and thank-yous", section: "Pages" },
    { title: "Safety & reports", url: "/safety.html", hint: "Rules and moderation decisions", section: "Pages" },
    { title: "Data & privacy", url: "/privacy.html", hint: "Your data controls", section: "Pages" },
    { title: "Support", url: "/support.html", hint: "Help", section: "Pages" },
    { title: "Settings", url: "/settings", hint: "Account, theme and preferences", section: "Pages" },
    { title: "Login", url: "/login.html", hint: "Sign in", section: "Pages" }
  ];

  const SIDEBAR_COLLAPSE_KEY = "cbSidebarCollapsed";

  function ensureFontAwesome() {
    if (document.querySelector('link[data-cb-fa]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css";
    link.crossOrigin = "anonymous";
    link.setAttribute("data-cb-fa", "1");
    document.head.appendChild(link);
  }

  function sharedPath(file) { return "/shared/" + file; }

  var SHELL_CACHE_KEY = "cb_shell_html_v5";
  var SHELL_FLAGS_KEY = "cb_shell_flags_v1";

  function readShellCache() {
    try {
      var raw = localStorage.getItem(SHELL_CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return null;
      return o;
    } catch (_) {
      return null;
    }
  }

  function writeShellCache(headerHtml, footerHtml, rightRailHtml) {
    try {
      var prev = readShellCache() || {};
      localStorage.setItem(SHELL_CACHE_KEY, JSON.stringify({
        header: String(headerHtml != null ? headerHtml : (prev.header || "")),
        footer: String(footerHtml != null ? footerHtml : (prev.footer || "")),
        rightRail: String(rightRailHtml != null ? rightRailHtml : (prev.rightRail || "")),
        v: 2
      }));
      // Drop legacy key once v2 is written.
      try { localStorage.removeItem("cb_shell_html_v2"); localStorage.removeItem("cb_shell_html_v3"); } catch (_) {}
    } catch (_) {}
  }

  function writeShellFlags() {
    try {
      var collapsed = false;
      try { collapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1"; } catch (_) {}
      localStorage.setItem(SHELL_FLAGS_KEY, JSON.stringify({
        rightRail: shouldShowRightRail(),
        sidebarCollapsed: collapsed
      }));
    } catch (_) {}
  }

  function readShellFlags() {
    try {
      var raw = localStorage.getItem(SHELL_FLAGS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function reserveShellSpace() {
    // Hold left/right gutters before chrome HTML arrives so page content does not jump.
    if (document.body.classList.contains("cb-share-solo")) {
      document.body.classList.remove("has-cb-sidebar", "has-cb-right-rail", "cb-sidebar-collapsed");
      return;
    }
    var flags = readShellFlags();
    if (shouldShowRightRail()) document.body.classList.add("has-cb-right-rail");
    else document.body.classList.remove("has-cb-right-rail");
    // Left sidebar is sitewide whenever shared-header is present (even on cold cache).
    if (document.getElementById("shared-header")) {
      document.body.classList.add("has-cb-sidebar");
      var collapsed = false;
      try { collapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1"; } catch (_) {}
      document.body.classList.toggle("cb-sidebar-collapsed", !!collapsed);
    }
  }

  function paintShellFromCache() {
    var cache = readShellCache();
    if (!cache) return false;
    var painted = false;
    var headerHost = document.getElementById("shared-header");
    var footerHost = document.getElementById("shared-footer");
    if (headerHost && cache.header && !headerHost.getAttribute("data-cb-shell")) {
      headerHost.innerHTML = cache.header;
      headerHost.setAttribute("data-cb-shell", "cache");
      painted = true;
    }
    if (footerHost && cache.footer && !footerHost.getAttribute("data-cb-shell")) {
      footerHost.innerHTML = cache.footer;
      footerHost.setAttribute("data-cb-shell", "cache");
      painted = true;
    }
    if (shouldShowRightRail() && cache.rightRail && !document.getElementById("cbRightRail")) {
      var wrap = document.createElement("div");
      wrap.innerHTML = cache.rightRail;
      var rail = wrap.firstElementChild;
      if (rail) {
        try {
          if (!isSignedIn()) {
            rail.querySelectorAll(".cb-rail-pack-nearby, .cb-rail-faces").forEach(function (n) {
              var block = n.classList.contains("cb-rail-block") ? n : n.closest(".cb-rail-block");
              if (block) block.remove();
              else n.remove();
            });
          }
        } catch (_) {}
        rail.setAttribute("data-cb-shell", "cache");
        document.body.appendChild(rail);
    try { enhanceBoardDebatesRail(); } catch (_) {}
        painted = true;
      }
    }
    return painted;
  }


  var authReady = false;
  var authLoading = true;
  var authListeners = [];

  function whenAuthReady(fn) {
    if (authReady) {
      try { fn(); } catch (_) {}
      return;
    }
    authListeners.push(fn);
  }

  function markAuthReady() {
    authReady = true;
    authLoading = false;
    var q = authListeners.splice(0, authListeners.length);
    q.forEach(function (fn) {
      try { fn(); } catch (_) {}
    });
    try {
      window.dispatchEvent(new CustomEvent("cb-auth-ready", { detail: { signedIn: isSignedIn(), userId: getSessionUserId() } }));
    } catch (_) {}
  }

  function clearLocalSession() {
    try {
      localStorage.removeItem("loggedIn");
      localStorage.removeItem("currentUserId");
      localStorage.removeItem("firebaseUid");
    } catch (_) {}
    try { clearAuthChromeCache(); } catch (_) {}
  }

  var AUTH_CHROME_CACHE_KEY = "cb_auth_chrome_v2";

  function readAuthChromeCache() {
    try {
      var raw = sessionStorage.getItem(AUTH_CHROME_CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return null;
      return o;
    } catch (_) {
      return null;
    }
  }

  function writeAuthChromeCache(snap) {
    try {
      // Fact-only cache: signed-in flag + id/username for chrome. Never store pfp/image blobs.
      sessionStorage.setItem(AUTH_CHROME_CACHE_KEY, JSON.stringify({
        userId: snap && snap.userId != null ? String(snap.userId) : "",
        username: snap && snap.username ? String(snap.username) : "",
        signedIn: !!(snap && snap.signedIn)
      }));
    } catch (_) {}
  }

  function clearAuthChromeCache() {
    try { sessionStorage.removeItem(AUTH_CHROME_CACHE_KEY); } catch (_) {}
  }

  function paintAuthChromeFromCache() {
    var c = readAuthChromeCache();
    if (!c) return false;
    // Stale chrome cache alone must not fake a login after sign-out.
    try {
      if (!getLocalUser() || c.userId !== localStorage.getItem("currentUserId")) {
        if (c.signedIn) clearAuthChromeCache();
        return false;
      }
    } catch (_) {}
    if (c.signedIn && c.userId) {
      // Resolve avatar path live from localStorage keys (not from chrome cache)
      var livePfp = "/users/default/pfp.jpg";
      try {
        livePfp = localStorage.getItem("pfp_" + c.userId) || livePfp;
        var u = JSON.parse(localStorage.getItem("user_" + c.userId) || "{}");
        if (u && u.profilePicture) livePfp = u.profilePicture;
      } catch (_) {}
      renderSignedInChrome({
        id: c.userId,
        username: c.username || "Labrador",
        pfp: livePfp,
        profileUrl: "/users/" + encodeURIComponent(c.userId)
      }, true);
      return true;
    }
    if (c.signedIn === false) {
      renderLoginLinks(true);
      return true;
    }
    return false;
  }


  function renderAuthSkeleton() {
    var deskHtml =
      '<div class="cb-auth-skel" aria-busy="true" aria-label="Loading account">' +
      '<span class="cb-skel-line"></span><span class="cb-skel-circle"></span></div>';
    var mobHtml =
      '<div class="cb-auth-skel cb-auth-skel-mobile" aria-busy="true" aria-label="Loading account">' +
      '<span class="cb-skel-circle"></span></div>';
    var desk = document.getElementById("userSection");
    if (desk) desk.innerHTML = deskHtml;
    var mob = document.getElementById("userSectionMobile");
    if (mob) mob.innerHTML = mobHtml;
    // Keep sidebar name slot stable; shimmer only if we have no cached name.
    var sideUser = document.getElementById("cbSidebarUser");
    if (sideUser) {
      sideUser.removeAttribute("hidden");
      var cacheName = "";
      try {
        var c = readAuthChromeCache();
        if (c && c.username) cacheName = c.username;
      } catch (_) {}
      if (!cacheName) {
        try {
          var loc = getLocalUser();
          if (loc && loc.username) cacheName = loc.username;
        } catch (_) {}
      }
      if (cacheName) {
        sideUser.classList.remove("cb-sidebar-user-skel");
        sideUser.removeAttribute("aria-busy");
        sideUser.classList.add("is-signed-in");
        sideUser.innerHTML =
          '<span class="cb-sidebar-user-name">' + escapeHtml(cacheName) + "</span>" +
          '<span class="cb-sidebar-user-initials" aria-hidden="true">' + escapeHtml(initialsFromName(cacheName)) + "</span>";
      } else {
        sideUser.classList.add("cb-sidebar-user-skel", "is-signed-in");
        sideUser.setAttribute("aria-busy", "true");
        sideUser.innerHTML = '<span class="cb-skel-line cb-skel-line-side"></span><span class="cb-sidebar-user-initials" aria-hidden="true">L</span>';
        sideUser.onclick = null;
        sideUser.style.cursor = "default";
        sideUser.title = "";
      }
    }
  }


  function getLocalUser() {
    // Cache only paints a loading hint. Firebase determines the real session.
    try {
      if(localStorage.getItem('loggedIn')!=='true')return null;
      const id=sanitizePublicUserId(localStorage.getItem('currentUserId'));if(!id)return null;
      const user=JSON.parse(localStorage.getItem('user_'+id)||'{}'),profile=JSON.parse(localStorage.getItem('profile_'+id)||'{}');
      const uid = localStorage.getItem('firebaseUid');
      const confirmed = window.CoolbradorAuth?.currentUser || window.CoolbradorSocial?.state.user;
      if (!uid || (profile.uid || user.uid) !== uid || (confirmed && confirmed.uid !== uid)) return null;
      return {id,username:profile.displayName||user.displayName||user.username||'Labrador',pfp:profile.avatar||user.profilePicture||'/users/default/pfp.jpg',profileUrl:'/users/'+encodeURIComponent(id)};
    }catch(_){return null;}
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function syncSignedOutChrome() {
    try {
      // Cached chrome is a rendering hint while Auth restores, never permission.
      var state = window.CoolbradorSocial?.state;
      var knownUser = state?.user || window.CoolbradorAuth?.currentUser;
      var out = state?.ready ? !knownUser : !(knownUser || getLocalUser());
      document.body.classList.toggle("cb-signed-out", out);
      document.body.classList.toggle("cb-signed-in", !out);
    } catch (_) {}
  }

  function renderLoginLinks(fromCache) {
    syncSignedOutChrome();
    document.querySelectorAll("#userSection, #userSectionMobile").forEach((el) => {
      if (!el) return;
      el.innerHTML = '<a href="/login.html" class="cb-login-link" style="color:var(--cb-accent);font-weight:bold;text-decoration:none;">Login</a>';
    });
    updateSidebarProfile(null);
    if (!fromCache) {
      writeAuthChromeCache({ userId: "", username: "", signedIn: false });
    }
  }

  function closeAllUserMenus() {
    document.querySelectorAll(".cb-user-menu-panel").forEach(function (p) {
      p.classList.remove("is-open");
      p.hidden = true;
    });
    document.querySelectorAll("[data-cb-user-menu]").forEach(function (b) {
      b.setAttribute("aria-expanded", "false");
    });
  }

  function openUserMenu(btn, panel) {
    closeAllUserMenus();
    panel.hidden = false;
    // force reflow so fade can play
    void panel.offsetWidth;
    panel.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
  }

  function scheduleCloseUserMenu(root, panel, btn) {
    clearTimeout(root._cbMenuCloseTimer);
    root._cbMenuCloseTimer = setTimeout(function () {
      panel.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      clearTimeout(root._cbMenuHideTimer);
      root._cbMenuHideTimer = setTimeout(function () {
        if (!panel.classList.contains("is-open")) panel.hidden = true;
      }, 160);
    }, 180);
  }

  function wireUserMenu(root) {
    if (!root || root.dataset.menuWired === "1") return;
    root.dataset.menuWired = "1";
    var btn = root.querySelector("[data-cb-user-menu]");
    var panel = root.querySelector(".cb-user-menu-panel");
    if (!btn || !panel) return;

    function cancelClose() {
      clearTimeout(root._cbMenuCloseTimer);
      clearTimeout(root._cbMenuHideTimer);
    }

    function onEnter() {
      cancelClose();
      openUserMenu(btn, panel);
    }
    function onLeave() {
      scheduleCloseUserMenu(root, panel, btn);
    }


    root.addEventListener("mouseleave", onLeave);

    panel.addEventListener("focusin", cancelClose);
    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { closeAllUserMenus(); btn.focus(); event.preventDefault(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); cancelClose(); openUserMenu(btn, panel);
        const items = Array.from(panel.querySelectorAll('a,button'));
        const index = items.indexOf(document.activeElement);
        items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    });
    panel.addEventListener("focusout", function (e) {
      if (!root.contains(e.relatedTarget)) onLeave();
    });

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = panel.hidden || !panel.classList.contains("is-open");
      if (open) {
        cancelClose();
        openUserMenu(btn, panel);
      } else {
        scheduleCloseUserMenu(root, panel, btn);
      }
    });

    if (!document.documentElement.dataset.cbUserMenuDoc) {
      document.documentElement.dataset.cbUserMenuDoc = "1";
      document.addEventListener("click", function () { closeAllUserMenus(); });
    }
    panel.addEventListener("click", function (e) { e.stopPropagation(); });
    var out = panel.querySelector("[data-cb-signout]");
    if (out) {
      out.addEventListener("click", function (e) {
        e.preventDefault();
        signOutFully();
      });
    }
  }

  function renderSignedInChrome(user, fromCache) {
    syncSignedOutChrome();
    var profileUrl = user.profileUrl;
    var name = user.username || "Labrador";
    var pfp = user.pfp || "/users/default/pfp.jpg";
    var uid = user.id != null ? String(user.id) : "";
    var desk = document.getElementById("userSection");
    if (desk) {
      desk.innerHTML =
        '<div class="cb-user-menu">' +
        '<button type="button" class="cb-user-menu-btn" data-cb-user-menu aria-haspopup="true" aria-expanded="false" title="' + escapeHtml(name) + '">' +
        '<span class="cb-user-menu-name">' + escapeHtml(name) + "</span>" +
        '<img src="' + escapeHtml(pfp) + '" alt="" class="cb-user-menu-pfp">' +
        "</button>" +
        '<div class="cb-user-menu-panel" hidden role="menu">' +
        '<a role="menuitem" href="' + profileUrl + '"><i class="fa-solid fa-user" aria-hidden="true"></i><span>Profile</span></a>' +
        '<a role="menuitem" href="/settings.html"><i class="fa-solid fa-gear" aria-hidden="true"></i><span>Settings</span></a>' +
        '<button type="button" role="menuitem" data-cb-signout><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span>Log out</span></button>' +
        "</div></div>";
      wireUserMenu(desk);
    }
    var mob = document.getElementById("userSectionMobile");
    if (mob) {
      mob.innerHTML =
        '<div class="cb-user-menu cb-user-menu-mobile">' +
        '<button type="button" class="cb-user-menu-btn" data-cb-user-menu aria-haspopup="true" aria-expanded="false">' +
        '<img src="' + escapeHtml(pfp) + '" alt="' + escapeHtml(name) + '" class="cb-user-menu-pfp">' +
        "</button>" +
        '<div class="cb-user-menu-panel" hidden role="menu">' +
        '<a role="menuitem" href="' + profileUrl + '"><i class="fa-solid fa-user" aria-hidden="true"></i><span>Profile</span></a>' +
        '<a role="menuitem" href="/settings.html"><i class="fa-solid fa-gear" aria-hidden="true"></i><span>Settings</span></a>' +
        '<button type="button" role="menuitem" data-cb-signout><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span>Log out</span></button>' +
        "</div></div>";
      wireUserMenu(mob);
    }
    updateSidebarProfile(profileUrl, name);
    if (!fromCache) {
      writeAuthChromeCache({ userId: uid, username: name, signedIn: true });
    }
  }

  function renderLocalProfile(user) {
    renderSignedInChrome(user);
  }


  /* Canonical demo roster ids "2".."23" (SnackBandit=18, BarkBroker=23; 0-1 reserved). */
  var DEMO_SEED_NAMES = {
    "2": "Cardbrador", "3": "BeeSid", "4": "Miguel", "5": "GyattToad", "6": "AnthonySpade",
    "7": "Barcat", "8": "EvilRobot", "9": "AbovegroundBro", "10": "NerdDog", "11": "OrangeTabby",
    "12": "EvilKid23", "13": "NoFilterBro", "14": "CoolDog", "15": "ANIMEGIRL",
    "16": "PantsWetterLabrador", "17": "RhombusRex", "18": "SnackBandit", "19": "BarTabby",
    "20": "PuddlePirate", "21": "TreatTaxer", "22": "SofaThief", "23": "BarkBroker"
  };

  function accountLooksDemo(rec) {
    if (!rec || typeof rec !== "object") return false;
    if (rec.demo === true) return true;
    var name = rec.displayName || rec.username || "";
    if (DEMO_SEED_NAMES && name && DEMO_SEED_NAMES[String(Object.keys(DEMO_SEED_NAMES).find(function (k) { return DEMO_SEED_NAMES[k] === name; }) || "")] === name) {
      // handled below via reverse lookup
    }
    var hasFirebase = !!(rec.uid || rec.firebaseUid);
    if (!hasFirebase && name) {
      for (var k in DEMO_SEED_NAMES) {
        if (Object.prototype.hasOwnProperty.call(DEMO_SEED_NAMES, k) && DEMO_SEED_NAMES[k] === name) return true;
      }
    }
    return false;
  }

  function isDemoAccountId(rawId) {
    var id = String(rawId == null ? "" : rawId).trim();
    if (!id || !/^\d+$/.test(id)) return false;
    var n = parseInt(id, 10);
    var demoBase = (window.CB_DEMO_ID_BASE != null) ? Number(window.CB_DEMO_ID_BASE) : 2;
    var demoEnd = demoBase + 21; // 2..23 when base is 2
    var u = {};
    var p = {};
    try { u = JSON.parse(localStorage.getItem("user_" + id) || "{}"); } catch (_) {}
    try { p = JSON.parse(localStorage.getItem("profile_" + id) || "null") || {}; } catch (_) {}
    if (u.demo === true || p.demo === true) return true;
    if (DEMO_SEED_NAMES[id]) {
      var seedName = DEMO_SEED_NAMES[id];
      var uname = u.displayName || u.username || p.displayName || "";
      var hasFirebase = !!(u.uid || u.firebaseUid || localStorage.getItem("firebaseUid"));
      // Known demo roster id without a firebase uid is a demo slot.
      if (!u.uid && !u.firebaseUid && (!uname || uname === seedName || accountLooksDemo(u) || accountLooksDemo(p))) return true;
      // Session pointing at demo id while account is flagged/named as demo.
      if ((uname === seedName || accountLooksDemo(u) || accountLooksDemo(p)) && !u.uid && !u.firebaseUid) return true;
    }
    if (n >= demoBase && n <= demoEnd) {
      if (u.demo === true || p.demo === true) return true;
      if (DEMO_SEED_NAMES[id] && !u.uid && !u.firebaseUid) return true;
    }
    return false;
  }

  function slotTakenByReal(n) {
    var id = String(n);
    var u = {};
    var p = {};
    try { u = JSON.parse(localStorage.getItem("user_" + id) || "{}"); } catch (_) {}
    try { p = JSON.parse(localStorage.getItem("profile_" + id) || "null") || {}; } catch (_) {}
    var hasU = u && Object.keys(u).length > 0;
    var hasP = p && Object.keys(p).length > 0;
    if (!hasU && !hasP) return false;
    if (u.demo === true || p.demo === true) return false;
    if (accountLooksDemo(u) || accountLooksDemo(p)) return false;
    if (DEMO_SEED_NAMES[id] && !u.uid && !u.firebaseUid) return false;
    return true;
  }

  function allocatePublicUserId() {
    var demoBase = (window.CB_DEMO_ID_BASE != null) ? Number(window.CB_DEMO_ID_BASE) : 2;
    var demoEnd = demoBase + 21; // inclusive end of demo band (23 when base=2)
    // Prefer reserved real slots 0 then 1 when not occupied by a real Labrador.
    for (var slot = 0; slot < demoBase; slot++) {
      if (!slotTakenByReal(slot)) return String(slot);
    }
    // Both 0 and 1 used by real users: allocate next free above demo band (24+).
    var usedHigh = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf("user_") !== 0) continue;
        var id = key.slice(5);
        if (!/^\d+$/.test(id)) continue;
        var n = parseInt(id, 10);
        if (n > demoEnd) usedHigh[n] = true;
      }
    } catch (_) {}
    var next = demoEnd + 1;
    while (usedHigh[next] || slotTakenByReal(next)) next++;
    return String(next);
  }

  function copyStoragePrefix(prefix, fromId, toId) {
    try {
      var raw = localStorage.getItem(prefix + fromId);
      if (raw == null) return;
      localStorage.setItem(prefix + toId, raw);
    } catch (_) {}
  }

  function ensureSessionNotDemo() {
    return window.CoolbradorSocial?.state.profile?.id || localStorage.getItem('currentUserId') || '';
  }

  function sanitizePublicUserId(raw) {
    var value = String(raw || '');
    return /^[a-zA-Z0-9_-]{1,128}$/.test(value) && value !== 'me' ? value : '';
  }

  function remapFriendId(id) {
    var s = String(id == null ? "" : id).trim();
    if (!s) return "";
    if (/^\d+$/.test(s)) {
      var n = parseInt(s, 10);
      var base = (window.CB_DEMO_ID_BASE != null) ? Number(window.CB_DEMO_ID_BASE) : 2;
      // Only lift true legacy ids below DEMO_ID_BASE (0/1 reserved when base is 2).
      if (n >= 0 && n < base) return String(base + n);
      return s;
    }
    return "";
  }

  function resolveFriendEntry(id) {
    var rid = remapFriendId(id);
    if (!rid) return null;
    var u = {};
    var p = {};
    try { u = JSON.parse(localStorage.getItem("user_" + rid) || "{}"); } catch (_) {}
    try { p = JSON.parse(localStorage.getItem("profile_" + rid) || "null") || {}; } catch (_) {}
    var seedName = DEMO_SEED_NAMES[rid] || "";
    var name = (p && p.displayName) || u.displayName || u.username || seedName;
    if (!name) return null; // skip empty/broken stubs
    var handle = (p && p.handle) || u.handle || String(name).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || ("lab" + rid);
    var pfp = (p && p.avatar) || u.profilePicture || localStorage.getItem("pfp_" + rid) ||
      (window.CB_DEMO_AVATARS && window.CB_DEMO_AVATARS[rid]) ||
      "/users/default/pfp.jpg";
    return { id: rid, name: name, handle: handle, pfp: pfp };
  }

  function hasLocalSession() {
    const state = window.CoolbradorSocial?.state;
    return !!state?.profile && state.user?.uid === window.CoolbradorAuth?.currentUser?.uid;
  }
  function isSignedIn() { return hasLocalSession(); }
  function getSessionUserId() { return window.CoolbradorSocial?.state.profile?.id || ''; }

  function requireSignedIn(what) {
    // Local session first: never block repost/discuss/compose when browser already knows the Labrador.
    if (hasLocalSession()) return true;
    if (isSignedIn() && getSessionUserId()) return true;
    if (authLoading && !authReady) {
      alert("Hang on, finishing sign-in.");
      return false;
    }
    alert("Log in to " + (what || "do that") + ".");
    return false;
  }

  async function signOutFully() {
    try {
      const mod = await import("/js/firebase.js");
      const auth = mod.auth;
      if (auth) {
        const { signOut } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js");
        await signOut(auth);
      }
    } catch (error) {
      console.error('Could not sign out', error);
      alert('Could not sign out. Please try again.');
      return;
    }
    clearLocalSession();
    clearAuthChromeCache();
    authReady = true;
    authLoading = false;
    renderLoginLinks();
    try {
      window.dispatchEvent(new CustomEvent("cb-auth-changed", { detail: { signedIn: false } }));
    } catch (_) {}
    try { location.href = "/"; } catch (_) {}
  }

  function initialsFromName(name) {
    var s = String(name || "L").trim();
    if (!s) return "L";
    var parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    return s.slice(0, 2).toUpperCase();
  }

  function closeSidebarUserMenu() {
    document.querySelectorAll(".cb-side-user-menu").forEach(function (p) { p.hidden = true; });
    document.querySelectorAll(".cb-sidebar-account-toggle, .cb-sidebar-user-collapsed").forEach(function (b) {
      b.setAttribute("aria-expanded", "false");
    });
  }

  function ensureSidebarUserMenuDoc() {
    if (document.documentElement.dataset.cbSideUserMenuDoc) return;
    document.documentElement.dataset.cbSideUserMenuDoc = "1";
    document.addEventListener("click", function () { closeSidebarUserMenu(); });
  }

  function wireSidebarUserMenu(userEl, profileUrl, name) {
    if (!userEl) return;
    ensureSidebarUserMenuDoc();
    var menu = userEl.querySelector(".cb-side-user-menu");
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "cb-side-user-menu";
      menu.hidden = true;
      menu.setAttribute("role", "menu");
      userEl.appendChild(menu);
    }
    menu.innerHTML =
      '<a role="menuitem" href="/settings.html">Settings</a>' +
      '<button type="button" role="menuitem" data-cb-side-signout>Log out</button>';
    menu.onclick = function (e) { e.stopPropagation(); };
    var out = menu.querySelector("[data-cb-side-signout]");
    if (out) {
      out.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeSidebarUserMenu();
        signOutFully();
      };
    }
    const trigger = userEl.querySelector(".cb-sidebar-account-toggle");
    if (!trigger) return;
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");
    trigger.onkeydown = function (e) {
      if (e.key === 'Escape') { closeSidebarUserMenu(); menu.hidden = true; trigger.setAttribute('aria-expanded','false'); }
      if (e.key === 'ArrowDown') { e.preventDefault(); menu.hidden = false; trigger.setAttribute('aria-expanded','true'); menu.querySelector('a,button')?.focus(); }
    };
    menu.onkeydown = function (e) { if (e.key === 'Escape') { e.preventDefault(); closeSidebarUserMenu(); trigger.setAttribute('aria-expanded','false'); trigger.focus(); } };
    userEl.style.cursor = "pointer";
    userEl.title = "Account menu";
    trigger.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = menu.hidden;
      closeSidebarUserMenu();
      menu.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
    };
  }

  function updateSidebarProfile(profileUrl, username) {
    const link = document.getElementById("cbSideProfile");
    const userEl = document.getElementById("cbSidebarUser");
    let name = username;
    let url = profileUrl || "";
    const local = getLocalUser();
    const cache = readAuthChromeCache();
    if (!name) {
      if (local) name = local.username;
      else if (cache && cache.username) name = cache.username;
    }
    if (!url) {
      if (local && local.profileUrl) url = local.profileUrl;
      else {
        const sid = getSessionUserId() || (cache && cache.userId) || "";
        if (sid) url = "/users/" + encodeURIComponent(sid);
      }
    }
    const signedHint = !!(hasLocalSession() || isSignedIn() || (cache && cache.signedIn && cache.userId) || (name && url));
    if (userEl) {
      userEl.classList.remove("cb-sidebar-user-skel");
      userEl.removeAttribute("aria-busy");
      // Keep slot in document flow so Home/Profile never jump (never use hidden while signed-in/loading).
      userEl.removeAttribute("hidden");
      if (signedHint && name) {
        userEl.classList.add("is-signed-in");
        userEl.classList.remove("is-signed-out");
        var sidePfp = "/users/default/pfp.jpg";
        try {
          var sid = getSessionUserId && getSessionUserId();
          if (!sid && cache && cache.userId) sid = cache.userId;
          if (local && local.pfp) sidePfp = local.pfp;
          else if (sid && window.CoolbradorPosts && window.CoolbradorPosts.getPfp) sidePfp = window.CoolbradorPosts.getPfp(sid);
          else if (sid) sidePfp = localStorage.getItem("pfp_" + sid) || sidePfp;
          else if (cache && cache.pfp) sidePfp = cache.pfp;
        } catch (_) {}
        userEl.innerHTML =
          '<button type="button" class="cb-sidebar-account-toggle" aria-label="' + escapeHtml('Account menu for ' + name) + '"><span class="cb-sidebar-user-name">' + escapeHtml(name) + "</span>" +
          '<img class="cb-sidebar-user-pfp" src="' + String(sidePfp).replace(/"/g, "") + '" alt="">' +
          '<span class="cb-sidebar-user-initials" aria-hidden="true">' + escapeHtml(initialsFromName(name)) + "</span></button>";
        wireSidebarUserMenu(userEl, url, name);
      } else if (signedHint) {
        // Known signed-in but name still resolving: reserve slot, optional shimmer over text area.
        userEl.classList.add("is-signed-in", "cb-sidebar-user-skel");
        userEl.classList.remove("is-signed-out");
        userEl.setAttribute("aria-busy", "true");
        userEl.innerHTML = '<span class="cb-skel-line cb-skel-line-side"></span><span class="cb-sidebar-user-initials" aria-hidden="true">L</span>';
        userEl.onclick = null;
        userEl.style.cursor = "default";
        userEl.title = "";
      } else {
        userEl.classList.remove("is-signed-in");
        userEl.classList.add("is-signed-out");
        userEl.innerHTML = "";
        userEl.onclick = null;
        userEl.style.cursor = "";
        userEl.title = "";
      }
    }
    if (!link) return;
    // Never leave Profile pointing at /users/me
    if (url && (/\/users\/me\b/i.test(url) || /\/users\/guest\b/i.test(url))) url = "";
    var sid = getSessionUserId() || (cache && sanitizePublicUserId(cache.userId)) || "";
    if (!url && sid) url = "/users/" + encodeURIComponent(sid);
    if (url && signedHint && sid) {
      link.href = "/users/" + encodeURIComponent(sid);
      link.setAttribute("data-signed-in", "1");
    } else if ((hasLocalSession() || isSignedIn()) && sid) {
      link.href = "/users/" + encodeURIComponent(sid);
      link.setAttribute("data-signed-in", "1");
    } else {
      link.href = "/login.html";
      link.removeAttribute("data-signed-in");
    }
  }

  function pathMatches(href, path, search) {
    const clean = (path || "/").replace(/\/+$/, "") || "/";
    if (href === "/" || href === "/index.html") {
      return clean === "/" || clean === "/index.html" || clean.endsWith("/index.html");
    }
    if (href.indexOf("/users/") === 0 || href.indexOf("/users/profile") === 0) {
      return clean.indexOf("/users/") === 0;
    }
    const base = href.split("?")[0];
    if (clean === base || clean.endsWith(base)) return true;
    if (base.endsWith(".html") && clean + ".html" === base) return true;
    return false;
  }

  function markActiveSidebar() {
    const path = location.pathname || "/";
    const search = location.search || "";
    document.querySelectorAll(".cb-side-link").forEach((a) => {
      const href = a.getAttribute("href") || "";
      let active = false;
      const nav = a.getAttribute("data-nav");
      if (nav === "home") active = pathMatches("/", path, search) || pathMatches("/index.html", path, search);
      else if (nav === "profile") active = path.indexOf("/users/") === 0 || path.indexOf("/login") === 0;
      else if (nav === "notifications") active = path.indexOf("/notifications") === 0;
      else if (nav === "messages") active = path.indexOf("/messages") === 0;
      else if (nav === "settings") active = path.indexOf("/settings") === 0;
      else if (nav === "simulations") active = path.indexOf("/simulations") === 0;
      else if (nav === "support") active = path.indexOf("/support") === 0;
      else active = pathMatches(href, path, search);
      a.classList.toggle("active", !!active);
      if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  function setSidebarOpen(open) {
    const sidebar = document.getElementById("cbSidebar");
    const backdrop = document.getElementById("cbSidebarBackdrop");
    const toggle = document.getElementById("cbSidebarToggle");
    if (!sidebar) return;
    document.body.classList.toggle("cb-sidebar-open", open);
    sidebar.classList.toggle("is-open", open);
    if (backdrop) {
      if (open) backdrop.removeAttribute("hidden");
      else backdrop.setAttribute("hidden", "");
    }
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) sidebar.querySelector('a,button')?.focus();
    else if (sidebar.contains(document.activeElement)) toggle?.focus();
  }

  function setSidebarCollapsed(collapsed) {
    document.body.classList.toggle("cb-sidebar-collapsed", collapsed);
    document.documentElement.classList.toggle("cb-shell-collapsed", collapsed);
    try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? "1" : "0"); } catch (_) {}
    const btn = document.getElementById("cbSidebarCollapse");
    if (btn) {
      btn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
      btn.title = collapsed ? "Expand" : "Collapse";
      const icon = btn.querySelector("i");
      if (icon) icon.className = collapsed ? "fa-solid fa-angles-right" : "fa-solid fa-angles-left";
    }
  }

  
  function ensureMessagesScript(cb) {
    function done() {
      try {
        if (window.CoolbradorMessages && window.CoolbradorMessages.seedIfNeeded) {
          window.CoolbradorMessages.seedIfNeeded();
        }
      } catch (_) {}
      if (typeof cb === "function") cb();
    }
    function loadMessages() {
      if (window.CoolbradorMessages) {
        done();
        return;
      }
      const existing = document.querySelector('script[data-cb-messages]');
      if (existing) {
        if (window.CoolbradorMessages) done();
        else existing.addEventListener("load", done);
        return;
      }
      const s = document.createElement("script");
      s.src = "/js/messages.js";
      s.async = true;
      s.dataset.cbMessages = "1";
      s.onload = done;
      document.head.appendChild(s);
    }
    function loadPostsThenMessages() {
      if (window.CoolbradorPosts) {
        loadMessages();
        return;
      }
      const existing = document.querySelector('script[data-cb-posts]');
      if (existing) {
        if (window.CoolbradorPosts) loadMessages();
        else existing.addEventListener("load", loadMessages);
        return;
      }
      const s = document.createElement("script");
      s.src = "/js/posts.js";
      s.async = true;
      s.dataset.cbPosts = "1";
      s.onload = loadMessages;
      document.head.appendChild(s);
    }
    loadPostsThenMessages();
  }

  function isMessagesPath() {
    const path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    return /^\/messages(\/|$)/i.test(path) || /messages\.html$/i.test(path);
  }

  function ensureMessagesDrawer() {
    let drawer = document.getElementById("cbMessagesDrawer");
    if (drawer) return drawer;
    drawer = document.createElement("div");
    drawer.id = "cbMessagesDrawer";
    drawer.className = "cb-messages-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "Messages");
    drawer.innerHTML =
      '<div class="cb-messages-drawer-head">' +
        "<strong>Messages</strong>" +
        '<div class="cb-messages-drawer-actions">' +
          '<a class="cb-messages-drawer-full" href="/messages">Full inbox</a>' +
          '<button type="button" class="cb-messages-drawer-close" aria-label="Close messages">&times;</button>' +
        "</div>" +
      "</div>" +
      '<div class="cb-messages-drawer-body" id="cbMessagesDrawerMount"></div>';
    document.body.appendChild(drawer);
    return drawer;
  }

  function closeMessagesDrawer() {
    const drawer = document.getElementById("cbMessagesDrawer");
    const fab = document.getElementById("cbMessagesFab");
    if (drawer) drawer.classList.remove("open");
    if (fab) {
      fab.classList.remove("is-open");
      fab.setAttribute("aria-expanded", "false");
    }
    try {
      if (window.CoolbradorMessages && window.CoolbradorMessages.unmountMini) {
        window.CoolbradorMessages.unmountMini();
      }
    } catch (_) {}
  }

  function openMessagesDrawer() {
    const drawer = ensureMessagesDrawer();
    const fab = document.getElementById("cbMessagesFab");
    drawer.classList.add("open");
    if (fab) {
      fab.classList.add("is-open");
      fab.setAttribute("aria-expanded", "true");
    }
    ensureMessagesScript(function () {
      const mount = document.getElementById("cbMessagesDrawerMount");
      if (mount && window.CoolbradorMessages && window.CoolbradorMessages.mountMini) {
        window.CoolbradorMessages.mountMini(mount);
      }
    });
  }

  function wireMessagesFab() {
    if (isMessagesPath()) {
      closeMessagesDrawer();
      const existingFab = document.getElementById("cbMessagesFab");
      if (existingFab) existingFab.remove();
      const existingDrawer = document.getElementById("cbMessagesDrawer");
      if (existingDrawer) existingDrawer.remove();
      return;
    }

    let fab = document.getElementById("cbMessagesFab");
    if (fab && fab.tagName === "A") {
      fab.remove();
      fab = null;
    }
    if (!fab) {
      fab = document.createElement("button");
      fab.type = "button";
      fab.id = "cbMessagesFab";
      fab.className = "cb-messages-fab";
      fab.setAttribute("aria-label", "Messages");
      fab.setAttribute("aria-expanded", "false");
      fab.setAttribute("aria-controls", "cbMessagesDrawer");
      fab.innerHTML = '<i class="fa-solid fa-comments" aria-hidden="true"></i><span>Messages</span>';
      document.body.appendChild(fab);
    }

    const drawer = ensureMessagesDrawer();

    if (fab.dataset.wired === "1") return;
    fab.dataset.wired = "1";

    fab.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (drawer.classList.contains("open")) closeMessagesDrawer();
      else openMessagesDrawer();
    });

    const closeBtn = drawer.querySelector(".cb-messages-drawer-close");
    if (closeBtn && !closeBtn.dataset.wired) {
      closeBtn.dataset.wired = "1";
      closeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeMessagesDrawer();
      });
    }

    if (!document.documentElement.dataset.cbMsgDrawerOutside) {
      document.documentElement.dataset.cbMsgDrawerOutside = "1";
      document.addEventListener("click", function (e) {
        const d = document.getElementById("cbMessagesDrawer");
        const f = document.getElementById("cbMessagesFab");
        if (!d || !d.classList.contains("open")) return;
        if (d.contains(e.target) || (f && f.contains(e.target))) return;
        closeMessagesDrawer();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeMessagesDrawer();
      });
    }
  }

  function shouldShowRightRail() {
    const path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    // Sitewide right rail; Simulations has its own panel; login stays clean.
    if (/login\.html$/i.test(path)) return false;
    if (/styles-login/i.test(path)) return false;
    if (/simulations\.html$/i.test(path) || /\/messages/i.test(path) || /messages\.html$/i.test(path)) return false;
    return true;
  }



  function ellipsizeWords(text, maxLen) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    if (raw.length <= maxLen) return raw;
    const cut = raw.slice(0, Math.max(0, maxLen - 1));
    const sp = cut.lastIndexOf(" ");
    const base = sp > Math.floor(maxLen * 0.45) ? cut.slice(0, sp) : cut;
    return base.replace(/[.,;:!\-]+$/, "") + "...";
  }

  function boardDescription(name) {
    const low = String(name || "").toLowerCase();
    const keys = [
      "boardmeta_/b/" + name,
      "boardmeta_/b/" + (name && name.charAt(0).toUpperCase() + name.slice(1)),
      low === "beesid" ? "boardmeta_/b/BeeSid" : "",
      low === "general" ? "boardmeta_/b/General" : ""
    ].filter(Boolean);
    for (let i = 0; i < keys.length; i++) {
      try {
        const meta = JSON.parse(localStorage.getItem(keys[i]) || "null");
        if (meta && meta.desc) return String(meta.desc);
      } catch (_) {}
    }
    const fallbacks = {
      general: "Shared front porch for the pack.",
      beesid: "BeeSid board chaos and signals.",
      starry: "Night-sky posts and vibe checks.",
      chippercorner: "Planet Chipper chatter before launch.",
      labradoria: "Sim talk for La Brador and the pack.",
      mutinydesk: "Receipts, charges, and plank energy.",
      giftdrive: "Seasonal gifts, stockings, charity bits.",
      farmreport: "For You farm posts and chill updates."
    };
    return fallbacks[low] || "A Coolbrador community board.";
  }
  function boardIconPath(name) {
    const raw = String(name || "").replace(/^\/+/, "").replace(/\/+$/, "");
    const low = raw.toLowerCase();
    if (low === "beesid") return "/b/BeeSid/icon.png";
    if (low === "general") return "/b/General/icon.png";
    if (low === "testboard") return "/img/Osaka_Stars.png";
    const canon = raw.charAt(0).toUpperCase() + raw.slice(1);
    // Prefer exact folder names used on disk
    const known = {
      starry: "Starry",
      chippercorner: "ChipperCorner",
      labradoria: "Labradoria",
      mutinydesk: "MutinyDesk",
      giftdrive: "GiftDrive",
      farmreport: "FarmReport",
      beesid: "BeeSid",
      general: "General"
    };
    const folder = known[low] || raw;
    return "/b/" + folder + "/icon.png";
  }
  function collectHotBoards() {
    const boards = [];
    const seen = {};
    function add(name) {
      const n = String(name || "").trim();
      if (!n) return;
      const low = n.toLowerCase();
      if (seen[low]) return;
      seen[low] = true;
      boards.push(n);
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("posts_/b/")) add(key.replace("posts_/b/", ""));
      if (key && key.startsWith("boardmeta_/b/")) add(key.replace("boardmeta_/b/", ""));
    }
    add("General");
    add("BeeSid");
        const prefer = ["General", "BeeSid", "Starry", "ChipperCorner", "Labradoria", "MutinyDesk", "GiftDrive", "FarmReport"];
    prefer.forEach((p) => add(p));
    boards.sort((a, b) => {
      const ia = prefer.findIndex((p) => p.toLowerCase() === String(a).toLowerCase());
      const ib = prefer.findIndex((p) => p.toLowerCase() === String(b).toLowerCase());
      const aa = ia < 0 ? 99 : ia;
      const bb = ib < 0 ? 99 : ib;
      if (aa !== bb) return aa - bb;
      return String(a).localeCompare(String(b));
    });
    return boards.filter((b) => String(b).toLowerCase() !== "testboard").slice(0, 10);
  }

  function currentProfileId() {
    try {
      if (localStorage.getItem("loggedIn") === "true") {
        const id = localStorage.getItem("currentUserId");
        if (id != null && String(id) !== "") return String(id);
      }
    } catch (_) {}
    return "0";
  }

  function loadFriendIdsForProfile(profileId) {
    const pid = String(profileId == null ? currentProfileId() : profileId);
    var base = (window.CB_DEMO_ID_BASE != null) ? Number(window.CB_DEMO_ID_BASE) : 2;
    var demoPack = [];
    for (var i = 0; i <= 13; i++) demoPack.push(String(base + i));
    try {
      const raw = JSON.parse(localStorage.getItem("friends_" + pid) || "[]");
      if (Array.isArray(raw) && raw.length) {
        var mapped = raw.map(remapFriendId).filter(Boolean);
        // Dedupe + drop self
        var seen = {};
        var out = [];
        mapped.forEach(function (id) {
          if (id === pid || seen[id]) return;
          seen[id] = true;
          out.push(id);
        });
        if (out.length) return out;
      }
    } catch (_) {}
    return demoPack.filter(function (id) { return id !== pid; });
  }

  function friendEntry(id) {
    return resolveFriendEntry(id) || { id: String(id), name: "Labrador", pfp: "/users/default/pfp.jpg" };
  }

  function collectFollowSuggestions() {
    return loadFriendIdsForProfile(currentProfileId()).map(resolveFriendEntry).filter(Boolean);
  }
  function isCrudePollTitle(title) {
    const t = String(title || "").toLowerCase();
    if (!t) return true;
    if (/pants|wet themselves|poop|pee|nsfw|sex|kill|slur|sample \(demo\)/.test(t)) return true;
    return false;
  }

  function collectHotPolls() {
    let polls = {};
    try { polls = JSON.parse(localStorage.getItem("coolbrador_polls_v1") || "{}"); } catch (_) { polls = {}; }
    const flat = [];
    ["issues", "mutinies", "ideas"].forEach((t) => {
      (polls[t] || []).forEach((p) => {
        const title = p.title || "";
        if (isCrudePollTitle(title)) return;
        flat.push({ title, type: t });
      });
    });
    if (!flat.length) {
      return [
        { title: "Keep the sky potato-friendly?", type: "issues" },
        { title: "Should General stay the front porch?", type: "mutinies" },
        { title: "Board stickers that jiggle?", type: "ideas" }
      ];
    }
    return flat.slice(0, 6);
  }

  
  function currentBoardFromPage() {
    try {
      if (window.__cbCurrentBoard) return String(window.__cbCurrentBoard);
      if (document.body && document.body.dataset && document.body.dataset.cbBoard) {
        return document.body.dataset.cbBoard;
      }
      var parts = (location.pathname || "").split("/").filter(Boolean);
      if (parts[0] === "b" && parts[1]) return decodeURIComponent(parts[1]);
    } catch (_) {}
    return "";
  }

  function enhanceBoardDebatesRail() {
    var board = currentBoardFromPage();
    if (!board) return;
    var rail = document.getElementById("cbRightRail");
    if (!rail) return;
    var kickers = rail.querySelectorAll(".cb-rail-kicker");
    kickers.forEach(function (el) {
      if (/open debates/i.test(el.textContent || "")) {
        el.textContent = String(board).replace(/[-_]/g, " ").toUpperCase() + " DEBATES";
      }
    });
  }

function wireRightRail() {
    document.getElementById('cbRightRail')?.remove();
    if(!shouldShowRightRail()){document.body.classList.remove('has-cb-right-rail');return;}
    const rail=document.createElement('aside');rail.id='cbRightRail';rail.className='cb-right-rail';rail.setAttribute('aria-label','Explore Coolbrador');
    const shortcuts=[['/community.html','Communities','Find a board and join the conversation.'],['/friends.html','Find your pack','Meet people and manage friendships.'],['/polls.html','Community polls','Ask questions and explore voting history.'],['/b/BeeSid','Chipper board','Drawings and posts shared with the game.'],['/games/chipper.html','Chipper','Follow the game and its community.']];
    rail.innerHTML='<div class="cb-rail-block"><p class="cb-rail-kicker">Explore</p>'+shortcuts.map(([url,title,description])=>'<a class="cb-rail-link" href="'+url+'"><span><strong>'+title+'</strong><small>'+description+'</small></span></a>').join('')+'</div>';
    document.body.append(rail);document.body.classList.add('has-cb-right-rail');writeShellCache(null,null,rail.outerHTML);
  }

  function ensureNotificationsScript() { /* Shared notifications are loaded by the social application. */ }

  function wireSidebar() {
    const sidebar = document.getElementById("cbSidebar");
    if (!sidebar) return;

    document.body.classList.add("has-cb-sidebar");

    let collapsed = false;
    try { collapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1"; } catch (_) {}
    setSidebarCollapsed(collapsed);

    // Prefer cache/local so Profile href and name never wait on Firebase.
    var bootLocal = getLocalUser();
    if (bootLocal) updateSidebarProfile(bootLocal.profileUrl, bootLocal.username);
    else updateSidebarProfile(null);
    markActiveSidebar();

    const toggle = document.getElementById("cbSidebarToggle");
    const backdrop = document.getElementById("cbSidebarBackdrop");
    const collapseBtn = document.getElementById("cbSidebarCollapse");

    if (toggle && !toggle.dataset.wired) {
      toggle.dataset.wired = "1";
      toggle.addEventListener("click", () => {
        const open = !document.body.classList.contains("cb-sidebar-open");
        setSidebarOpen(open);
      });
    }
    if (backdrop && !backdrop.dataset.wired) {
      backdrop.dataset.wired = "1";
      backdrop.addEventListener("click", () => setSidebarOpen(false));
    }
    if (collapseBtn && !collapseBtn.dataset.wired) {
      collapseBtn.dataset.wired = "1";
      collapseBtn.addEventListener("click", () => {
        setSidebarCollapsed(!document.body.classList.contains("cb-sidebar-collapsed"));
      });
    }

    sidebar.querySelectorAll(".cb-side-link").forEach((a) => {
      a.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
      });
    });

    if (!sidebar.dataset.keyboardWired) {
      sidebar.dataset.keyboardWired = '1';
      document.addEventListener('keydown', event => {
        if (!document.body.classList.contains('cb-sidebar-open')) return;
        if (event.key === 'Escape') { event.preventDefault(); setSidebarOpen(false); }
        if (event.key === 'Tab') {
          const focusable = Array.from(sidebar.querySelectorAll('a,button,[tabindex="0"]')).filter(el => el.getClientRects().length);
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      });
    }
    window.addEventListener("resize", () => {
      if (window.matchMedia("(min-width: 768px)").matches) setSidebarOpen(false);
    });
  }

  var socialAuthWired = false;
  var socialBadgeUid = null, socialBadgeStops = [];
  function liveBadge(nav, count, description) {
    const link = document.querySelector('.cb-side-link[data-nav="' + nav + '"]');
    if (!link) return;
    link.querySelector('.cb-live-count')?.remove();
    if (count) {
      const badge = document.createElement('span'); badge.className = 'cb-live-count'; badge.textContent = count > 99 ? '99+' : String(count); badge.setAttribute('aria-label', count + ' ' + description); link.append(badge);
    }
  }
  async function updateUserProfile() {
    if (socialAuthWired) return;
    socialAuthWired = true;
    try {
      const api = await import('/js/social-api.js');
      window.CoolbradorSocial = api;
      window.CoolbradorAuth = api.auth;
      api.watchAuth(function (state) {
        if (state.profile && state.user) {
          renderSignedInChrome({ id: state.profile.id, username: state.profile.displayName,
            pfp: state.profile.avatarUrl || '/users/default/pfp.jpg', profileUrl: '/users/' + encodeURIComponent(state.profile.id) });
        } else if (!state.user) {
          clearLocalSession(); renderLoginLinks();
        } else {
          // A failed profile request is not a Firebase sign-out.
          const cached = getLocalUser();
          if (cached && localStorage.getItem('firebaseUid') === state.user.uid) renderLocalProfile(cached);
          else renderSignedInChrome({ id: '', username: state.user.displayName || 'Account',
            pfp: state.user.photoURL || '/users/default/pfp.jpg', profileUrl: '/settings' }, true);
        }
        const badgeUid = state.profile && state.user ? state.user.uid : null;
        if (socialBadgeUid !== badgeUid) {
          socialBadgeStops.forEach(stop => stop()); socialBadgeStops = [];
          socialBadgeUid = badgeUid;
          liveBadge('notifications', 0); liveBadge('friends', 0); liveBadge('messages', 0);
          if (state.profile && state.user) {
            socialBadgeStops.push(api.watchUnreadNotifications(count => liveBadge('notifications', count, 'Unread notifications'), () => {}));
            socialBadgeStops.push(api.watchFriends(rows => liveBadge('friends', rows.filter(f => f.status === 'pending' && f.requester !== state.user.uid).length, 'Pending friend requests'), () => {}));
            let threads=[], reads=new Map();
            const updateMessages=()=>liveBadge('messages',threads.filter(t=>t.lastSenderId && t.lastSenderId!==state.user.uid && api.timestamp(t.updatedAt)>(reads.get(t.id)||0)).length,'Unread conversations');
            socialBadgeStops.push(api.watchConversations(rows=>{threads=rows;updateMessages();},()=>{}));
            socialBadgeStops.push(api.watchConversationReads(rows=>{reads=rows;updateMessages();},()=>{}));
          }
        }
        markAuthReady();
        window.dispatchEvent(new CustomEvent('cb-auth-changed', { detail: { signedIn: !!state.profile, userId: state.profile?.id || '' } }));
      });
    } catch (error) {
      // Offline/module failures must not erase a persisted account hint.
      const cached = getLocalUser();
      if (cached) renderLocalProfile(cached); else renderLoginLinks();
      markAuthReady();
      console.error('Could not restore session', error);
    }
  }

  function collectSearchTargets() {
    return KNOWN.map(p=>({...p,...(p.title==='Chipper'?{photo:'/img/PlanetChipperHomepage.png'}:{})}));
  }

  function searchItemIconHtml(p, sec) {
    var icon = sectionIcon(sec);
    var src = p.photo || "";
    if (!src && p.userId != null && p.userId !== "") {
      try {
        src = (window.CoolbradorPosts && window.CoolbradorPosts.getPfp)
          ? window.CoolbradorPosts.getPfp(p.userId)
          : (localStorage.getItem("pfp_" + p.userId) || "/users/default/pfp.jpg");
      } catch (_) {
        src = "/users/default/pfp.jpg";
      }
    }
    if (src) {
      return '<span class="search-item-icon search-item-photo" data-fallback-icon="' + escapeHtml(icon) + '">' +
        '<img src="' + escapeHtml(src) + '" alt="" onerror="var h=this.parentNode;if(!h)return;h.classList.remove(\'search-item-photo\');h.innerHTML=\'<i class=&quot;\'+h.getAttribute(\'data-fallback-icon\')+\'&quot;></i>\';">' +
        "</span>";
    }
    return '<span class="search-item-icon"><i class="' + icon + '"></i></span>';
  }
function sectionIcon(section) {
    if (section === "Games") return "fa-solid fa-gamepad";
    if (section === "People") return "fa-solid fa-user";
    if (section === "Discussions") return "fa-solid fa-users";
    return "fa-solid fa-compass";
  }


  function parseProfilePathQuery(raw) {
    var q = String(raw || "").trim();
    if (!q) return null;
    try {
      if (/^https?:\/\//i.test(q)) {
        var u = new URL(q);
        q = u.pathname || "";
      }
    } catch (e) {}
    q = q.split("?")[0].split("#")[0];
    var m = q.match(/^\/?users\/([A-Za-z0-9_-]+)(?:\/(card|links|profile))?\/?$/i);
    if (!m) return null;
    var id = m[1];
    var layout = (m[2] || "profile").toLowerCase();
    if (layout === "profile") {
      return { url: "/users/" + id, title: "Profile /users/" + id, hint: "Open profile", section: "People" };
    }
    return {
      url: "/users/" + id + "/" + layout,
      title: (layout === "card" ? "Card" : "Links") + " /users/" + id + "/" + layout,
      hint: "Open " + layout + " layout",
      section: "People"
    };
  }

  function wireSearch(rootEl) {
    if (!rootEl) return;
    const input = rootEl.querySelector("input");
    if (!input || input.dataset.cbSearchWired) return;
    input.dataset.cbSearchWired = "1";

    let overlay = rootEl.querySelector(".search-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "search-overlay";
      rootEl.appendChild(overlay);
    }

    function render(q) {
      const query = (q || "").trim().toLowerCase();
      const all = collectSearchTargets();
      const pathHit = parseProfilePathQuery(q || input.value);
      let matches = query
        ? all.filter((p) => p.title.toLowerCase().includes(query) || (p.hint || "").toLowerCase().includes(query) || p.url.toLowerCase().includes(query) || (p.section || "").toLowerCase().includes(query))
        : all.filter((p) => p.section === "Games" || p.section === "People" || p.title === "Home" || p.title === "Community" || p.title === "Messages").slice(0, 8);
      if (pathHit) {
        matches = [pathHit].concat(matches.filter(function (p) { return p.url !== pathHit.url; }));
      }

      // Dedupe by url+title, cap length
      const seen = {};
      matches = matches.filter(function (p) {
        const k = (p.url || "") + "|" + (p.title || "");
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      }).slice(0, 10);

      if (!matches.length) {
        overlay.innerHTML = '<a class="search-item" href="/search?q='+encodeURIComponent(q.trim())+'">Search public posts and people →</a>';
        overlay.classList.add("open");
        return;
      }

      if(query)matches.unshift({title:'Search public posts and people',url:'/search?q='+encodeURIComponent(q.trim()),hint:q.trim(),section:'People'});
      const order = ["People", "Discussions", "Pages", "Games"];
      const grouped = {};
      matches.forEach((m) => {
        const sec = m.section || "Pages";
        if (!grouped[sec]) grouped[sec] = [];
        if (grouped[sec].length < 5) grouped[sec].push(m);
      });

      let html = "";
      order.forEach((sec) => {
        if (!grouped[sec] || !grouped[sec].length) return;
        html += '<div class="search-section"><div class="search-section-label"><i class="' + sectionIcon(sec) + '"></i> ' + escapeHtml(sec) + "</div>";
        html += grouped[sec].map((p) =>
          '<a class="search-item" href="' + escapeHtml(p.url) + '">' +
          searchItemIconHtml(p, sec) +
          '<span class="search-item-text"><strong>' + escapeHtml(p.title) + "</strong><small>" + escapeHtml(p.hint || p.url) + "</small></span>" +
          "</a>"
        ).join("");
        html += "</div>";
      });

      overlay.innerHTML = html;
      overlay.classList.add("open");
    }
    input.addEventListener("focus", () => render(input.value));
    input.addEventListener("input", () => render(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") overlay.classList.remove("open");
      if (e.key === "Enter") {
        const pathHit = parseProfilePathQuery(input.value);
        if (pathHit) {
          e.preventDefault();
          location.href = pathHit.url;
          return;
        }
        const first = overlay.querySelector(".search-item");
        if (first) {
          e.preventDefault();
          location.href = first.getAttribute("href");
        }
      }
    });
    document.addEventListener("click", (e) => {
      if (!rootEl.contains(e.target)) overlay.classList.remove("open");
    });
  }

  function wireAllSearch() {
    document.querySelectorAll(".header-search").forEach(wireSearch);
  }


  function applySiteTheme() {
    try {
      if (window.CoolbradorRice) {
        window.CoolbradorRice.applyRice({ persist: false });
        return;
      }
      applyThemeEarlyFallback();
    } catch (_) {}
  }

  function applyThemeEarlyFallback() {
    var KNOWN = ["default","green","ember","violet","ocean","rose","slate"];
    var t = localStorage.getItem("cb_theme") || "default";
    if (t === "certa-green") t = "green";
    if (t === "light") t = "default";
    if (KNOWN.indexOf(t) === -1) t = "default";
    var mode = localStorage.getItem("cb_mode") === "light" ? "light" : "dark";
    var root = document.documentElement;
    root.dataset.theme = t;
    root.dataset.mode = mode;
    if (document.body) {
      Array.prototype.slice.call(document.body.classList).forEach(function (c) {
        if (c.indexOf("theme-") === 0 || c.indexOf("mode-") === 0) document.body.classList.remove(c);
      });
      if (t !== "default") document.body.classList.add("theme-" + t);
      document.body.classList.add("mode-" + mode);
    }
  }

  function applyShareSoloChrome() {
    try {
      var path = String(location.pathname || "");
      var q = new URLSearchParams(location.search || "");
      var shareSolo = /\/users\/[^/]+\/(card|links)\/?$/i.test(path) ||
        q.get("share") === "1" || q.get("solo") === "1" || q.get("layout") === "card" || q.get("layout") === "links";
      document.body.classList.toggle("cb-share-solo", !!shareSolo);
      if (shareSolo) {
        document.documentElement.classList.add("cb-share-solo");
      }
    } catch (_) {}
  }

  async function loadLayout() {
    ensureFontAwesome();
    applySiteTheme();
    applyShareSoloChrome();
    reserveShellSpace();
    syncSignedOutChrome();
    paintShellFromCache();
    // Auth chrome + sidebar wiring from cache before network, so middle content stays put.
    try { ensureSessionNotDemo(); } catch (_) {}
    if (document.getElementById("cbSidebar")) {
      if (!paintAuthChromeFromCache()) {
        var localBootEarly = getLocalUser();
        if (localBootEarly) renderLocalProfile(localBootEarly);
        else renderAuthSkeleton();
      }
      try { wireSidebar(); } catch (_) {}
    }
    const headerHost = document.getElementById("shared-header");
    const footerHost = document.getElementById("shared-footer");
    const jobs = [];
    var fetchedHeader = null;
    var fetchedFooter = null;
    if (headerHost) {
      jobs.push(
        fetch(sharedPath("header.html")).then((r) => { if (!r.ok) throw new Error("Header unavailable"); return r.text(); }).then((html) => {
          fetchedHeader = html;
          if (!headerHost.querySelector('#cbSidebar')) headerHost.innerHTML = html;
          headerHost.setAttribute("data-cb-shell", "live");
        }).catch((err) => console.error("Header load failed", err))
      );
    }
    if (footerHost) {
      jobs.push(
        fetch(sharedPath("footer.html")).then((r) => r.text()).then((html) => {
          fetchedFooter = html;
          footerHost.innerHTML = html;
          footerHost.setAttribute("data-cb-shell", "live");
        }).catch((err) => console.error("Footer load failed", err))
      );
    }
    await Promise.all(jobs);
    if (fetchedHeader != null || fetchedFooter != null) {
      var prev = readShellCache() || {};
      writeShellCache(
        fetchedHeader != null ? fetchedHeader : (prev.header || ""),
        fetchedFooter != null ? fetchedFooter : (prev.footer || "")
      );
    }
    writeShellFlags();
    applySiteTheme();
    try { ensureSessionNotDemo(); } catch (_) {}
    if (!paintAuthChromeFromCache()) {
      var localBoot = getLocalUser();
      if (localBoot) renderLocalProfile(localBoot);
      else renderAuthSkeleton();
    }
    wireSidebar();
    ensureNotificationsScript();
    if (!document.body.classList.contains("social-page")) wireRightRail();
    writeShellFlags();

    await updateUserProfile();
    wireAllSearch();
    window.addEventListener("storage", function (event) {
      if (event.key === 'loggedIn' && event.newValue !== 'true') {
        clearAuthChromeCache();
        document.body.classList.remove('cb-signed-in');
        document.body.classList.add('cb-signed-out');
        closeAllUserMenus(); closeSidebarUserMenu();
      }
    });
  }

  window.CoolbradorSession = { isSignedIn, hasLocalSession, getSessionUserId, requireSignedIn, signOut: signOutFully, whenAuthReady, ensureSessionNotDemo, isDemoAccountId, get authReady() { return authReady; }, get authLoading() { return authLoading; } };
  
  /* batch2 collapsed pfp img */
  function syncCollapsedSidebarPfp() {
    try {
      var btn = document.querySelector(".cb-sidebar-user-collapsed");
      if (!btn) return;
      var img = btn.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        img.className = "cb-collapsed-pfp";
        img.alt = "";
        btn.insertBefore(img, btn.firstChild);
      }
      var src = "";
      var main = document.querySelector("#cbSidebarUser img, .cb-side-user-avatar img, .cb-sidebar-user img");
      if (main && main.src) src = main.src;
      if (!src && window.CoolbradorPosts && CoolbradorPosts.getPfp) {
        var uid = localStorage.getItem("currentUserId") || "";
        src = CoolbradorPosts.getPfp(uid);
      }
      if (src) img.src = src;
      var initials = btn.querySelector(".cb-side-user-initials");
      if (initials) initials.hidden = !!src;
    } catch (_) {}
  }
  try { document.addEventListener("DOMContentLoaded", syncCollapsedSidebarPfp); } catch (_) {}
  try { setTimeout(syncCollapsedSidebarPfp, 0); setTimeout(syncCollapsedSidebarPfp, 400); } catch (_) {}

  
  /* batch2 header user menu */
  function wireHeaderUserMenuSameAsSidebar() {
    try {
      var headerUser = document.querySelector(".cb-header-user, #cbHeaderUser, .shared-header .user-chip, .main-header .user-area, a.header-profile, .cb-header-pfp, .cb-header-name");
      // Prefer concrete header pfp + name if present
      var targets = document.querySelectorAll(".cb-header-pfp, .cb-header-name, #headerProfileLink, .header-user-btn");
      if (!targets.length) {
        var h = document.querySelector("#shared-header, .main-header, header");
        if (h) targets = h.querySelectorAll("img.avatar, img.pfp, .user-name, [data-header-user]");
      }
      var side = document.getElementById("cbSidebarUser") || document.querySelector(".cb-sidebar-user-collapsed");
      if (!side || !targets.length) return;
      targets.forEach(function (el) {
        if (el.dataset.cbHeaderMenuWired) return;
        el.dataset.cbHeaderMenuWired = "1";
        el.addEventListener("click", function (e) {
          // Let explicit profile links middle-click / modified clicks alone
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
          e.preventDefault();
          e.stopPropagation();
          try { (side.querySelector(".cb-sidebar-account-toggle") || side).click(); } catch (_) {}
        });
      });
    } catch (_) {}
  }
  try { document.addEventListener("DOMContentLoaded", wireHeaderUserMenuSameAsSidebar); } catch (_) {}
  try { setTimeout(wireHeaderUserMenuSameAsSidebar, 200); setTimeout(wireHeaderUserMenuSameAsSidebar, 800); } catch (_) {}

  window.CoolbradorLayout = { loadLayout, updateUserProfile, wireAllSearch, wireSidebar, wireRightRail, isSignedIn, getSessionUserId, requireSignedIn, applySiteTheme, signOut: signOutFully, whenAuthReady, allocatePublicUserId, sanitizePublicUserId, resolveFriendEntry, remapFriendId, applyShareSoloChrome, ensureSessionNotDemo, isDemoAccountId };

  // Paint cached header/sidebars as soon as this file runs (hosts are usually already in the DOM).
  try {
    applyShareSoloChrome();
    reserveShellSpace();
    syncSignedOutChrome();
    if (!document.body.classList.contains("cb-share-solo")) {
      paintShellFromCache();
      if (document.getElementById('cbSidebar')) {
        if (!paintAuthChromeFromCache()) {
          const local = getLocalUser();
          if (local) renderLocalProfile(local); else renderLoginLinks(true);
        }
        wireSidebar();
      }
    }
  } catch (_) {}

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadLayout);
  else loadLayout();
})();