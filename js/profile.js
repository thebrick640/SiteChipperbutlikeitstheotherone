(function () {
  var DEMO_AVATARS = {
    "2": "/shared/TestImages/ProfilePhotos/Cardbrador.png",
    "3": "/shared/TestImages/ProfilePhotos/BeeSid.png",
    "4": "/shared/TestImages/ProfilePhotos/Miguel.webp",
    "5": "/shared/TestImages/ProfilePhotos/GyattToad.png",
    "6": "/shared/TestImages/ProfilePhotos/AnthonySpade.png",
    "7": "/shared/TestImages/ProfilePhotos/Barcat.png",
    "8": "/shared/TestImages/ProfilePhotos/EvilRobot.jpg",
    "9": "/shared/TestImages/ProfilePhotos/AbovegroundBro.png",
    "10": "/shared/TestImages/ProfilePhotos/NerdDog.png",
    "11": "/shared/TestImages/ProfilePhotos/OrangeTabby.png",
    "12": "/shared/TestImages/ProfilePhotos/EvilKid23.png",
    "13": "/shared/TestImages/ProfilePhotos/NoFilterBro.png",
    "14": "/shared/TestImages/ProfilePhotos/CoolDog.png",
    "15": "/shared/TestImages/ProfilePhotos/ANIMEGIRL.png",
    "16": "/shared/TestImages/ProfilePhotos/CoolDog.png",
    "17": "/shared/TestImages/ProfilePhotos/EvilRobot.jpg",
    "18": "/shared/TestImages/ProfilePhotos/GyattToad.png",
    "19": "/shared/TestImages/ProfilePhotos/OrangeTabby.png",
    "20": "/shared/TestImages/ProfilePhotos/Miguel.webp",
    "21": "/shared/TestImages/ProfilePhotos/Barcat.png",
    "22": "/shared/TestImages/ProfilePhotos/NerdDog.png",
    "23": "/shared/TestImages/ProfilePhotos/AbovegroundBro.png"
  };
  var IMAGE_MAX_BYTES = 20 * 1024 * 1024; // ~20MB
  var SOCIAL_DEFS = [
    { key: "website", label: "Website", icon: "fa-solid fa-globe" },
    { key: "youtube", label: "YouTube", icon: "fa-brands fa-youtube" },
    { key: "discord", label: "Discord", icon: "fa-brands fa-discord" },
    { key: "x", label: "X", icon: "fa-brands fa-x-twitter" },
    { key: "instagram", label: "Instagram", icon: "fa-brands fa-instagram" },
    { key: "roblox", label: "Roblox", icon: "fa-solid fa-gamepad" },
    { key: "twitch", label: "Twitch", icon: "fa-brands fa-twitch" },
    { key: "tiktok", label: "TikTok", icon: "fa-brands fa-tiktok" },
    { key: "github", label: "GitHub", icon: "fa-brands fa-github" },
    { key: "steam", label: "Steam", icon: "fa-brands fa-steam" },
    { key: "spotify", label: "Spotify", icon: "fa-brands fa-spotify" },
    { key: "custom", label: "Custom", icon: "fa-solid fa-link" }
  ];
  var SOCIAL_DEF_MAP = SOCIAL_DEFS.reduce(function (acc, def) {
    acc[def.key] = def;
    return acc;
  }, {});

  function demoBandKey(id) {
    // Roster keys are already "2".."23"; no n-1 remap.
    return String(id == null ? "" : id);
  }
  function demoAvatar(id) {
    var key = demoBandKey(id);
    return (window.CB_DEMO_AVATARS && window.CB_DEMO_AVATARS[key]) ||
      DEMO_AVATARS[key] || "/users/default/pfp.jpg";
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function parseRoute() {
    var parts = location.pathname.split("/").filter(Boolean);
    var id = null;
    var layout = "profile";
    if (parts[0] === "users") {
      if (parts[1] === "profile") {
        var last = parts[parts.length - 1];
        if (last && /^\d+$/.test(last)) id = last;
      } else if (parts[1] && parts[1] !== "index.html") {
        id = parts[1];
        if (parts[2] === "card" || parts[2] === "links" || parts[2] === "profile") layout = parts[2];
      }
    }
    var qLayout = qs("layout");
    if (qLayout === "card" || qLayout === "links" || qLayout === "profile") layout = qLayout;
    if (id === "profile" || id === "index.html" || id === "index") id = null;
    return { id: id, layout: layout };
  }

  function getSessionUserId() {
    try {
      if (window.CoolbradorLayout && typeof window.CoolbradorLayout.getSessionUserId === "function") {
        var a = window.CoolbradorLayout.getSessionUserId();
        if (a) return String(a);
      }
    } catch (e) {}
    try {
      if (window.CoolbradorSession && typeof window.CoolbradorSession.getSessionUserId === "function") {
        var b = window.CoolbradorSession.getSessionUserId();
        if (b) return String(b);
      }
    } catch (e) {}
    return localStorage.getItem("currentUserId") || "";
  }
  function isSignedIn() {
    try {
      if (window.CoolbradorLayout && typeof window.CoolbradorLayout.isSignedIn === "function") {
        if (window.CoolbradorLayout.isSignedIn()) return true;
      }
    } catch (e) {}
    try {
      if (window.CoolbradorSession && typeof window.CoolbradorSession.isSignedIn === "function") {
        if (window.CoolbradorSession.isSignedIn()) return true;
      }
    } catch (e) {}
    var id = localStorage.getItem("currentUserId") || "";
    return localStorage.getItem("loggedIn") === "true" && !!id;
  }

  var DEFAULT_BANNER = "/img/PlanetChipperHomepage.png";

  function sessionNumericId() {
    var sid = "";
    try {
      if (window.CoolbradorSession && typeof window.CoolbradorSession.getSessionUserId === "function") {
        sid = String(window.CoolbradorSession.getSessionUserId() || "");
      }
    } catch (e) {}
    if (!sid) {
      try { sid = String(localStorage.getItem("currentUserId") || ""); } catch (e2) {}
    }
    if (sid && /^\d+$/.test(sid)) return sid;
    return "";
  }

  function resolvePublicId(raw) {
    var id = String(raw == null ? "" : raw).trim();
    if (!id || id === "me" || id === "guest" || id === "index.html" || id === "profile") {
      // Prefer signed-in numeric id; never invent 0 for unknown/"me"
      return sessionNumericId();
    }
    if (/^\d+$/.test(id)) return id;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf("user_") !== 0) continue;
        var uidKey = key.slice(5);
        var u = {};
        try { u = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) {}
        if (
          String(u.uid || "") === id ||
          String(u.firebaseUid || "") === id ||
          String(u.username || "").toLowerCase() === id.toLowerCase() ||
          String(u.displayName || "").toLowerCase() === id.toLowerCase()
        ) {
          if (/^\d+$/.test(uidKey)) return uidKey;
        }
      }
    } catch (e) {}
    // Do not map unknown handles to 0 (that collided with demo Cardbrador / first real Labrador)
    return "";
  }

  function showProfileNotFound(raw) {
    var root = document.getElementById("profileRoot");
    if (!root) return;
    document.title = "Profile not found - Coolbrador";
    root.innerHTML =
      '<div class="cb-profile-missing" style="max-width:520px;margin:64px auto;text-align:center;padding:32px">' +
      '<h1 style="margin-bottom:8px">No Labrador here</h1>' +
      '<p style="opacity:.8">We couldn\'t find a profile for <strong>' + escapeHtml(String(raw || "")) + '</strong>.</p>' +
      '<p><a href="/community.html">Back to Community</a></p></div>';
  }

  function toast(msg) {
    if (msg == null) return;
    try {
      if (window.CoolbradorPosts && typeof window.CoolbradorPosts.showToast === "function") {
        window.CoolbradorPosts.showToast(msg);
        return;
      }
    } catch (e) {}
    var t = document.getElementById("cbToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "cbToast";
      t.className = "cb-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }


  function defaultSocials() {
    return [];
  }

  function socialDefFor(type) {
    return SOCIAL_DEF_MAP[type] || SOCIAL_DEF_MAP.custom;
  }

  function normalizeSocials(socials) {
    if (Array.isArray(socials)) {
      return socials.map(function (row, i) {
        if (!row || typeof row !== "object") return null;
        var type = String(row.type || row.key || "custom").toLowerCase();
        if (!SOCIAL_DEF_MAP[type]) type = "custom";
        var url = String(row.url != null ? row.url : (row.value != null ? row.value : "")).trim();
        var label = String(row.label || (SOCIAL_DEF_MAP[type] && SOCIAL_DEF_MAP[type].label) || "Link").trim();
        if (!url && type !== "custom") {
          /* keep empty rows out of render; editor may still add blanks */
        }
        return { type: type, label: label, url: url, id: row.id || ("soc_" + i) };
      }).filter(function (row) { return row && row.url; });
    }
    if (socials && typeof socials === "object") {
      var out = [];
      SOCIAL_DEFS.forEach(function (def) {
        if (def.key === "custom") return;
        var val = socials[def.key];
        if (val) out.push({ type: def.key, label: def.label, url: String(val).trim(), id: "soc_" + def.key });
      });
      if (Array.isArray(socials.extras)) {
        socials.extras.forEach(function (row, i) {
          if (!row) return;
          var type = String(row.type || "custom").toLowerCase();
          if (!SOCIAL_DEF_MAP[type]) type = "custom";
          var url = String(row.url || "").trim();
          if (!url) return;
          out.push({
            type: type,
            label: String(row.label || socialDefFor(type).label).trim(),
            url: url,
            id: row.id || ("soc_extra_" + i)
          });
        });
      }
      Object.keys(socials).forEach(function (k) {
        if (k === "extras" || SOCIAL_DEF_MAP[k] || k === "custom") return;
        var val = socials[k];
        if (typeof val === "string" && val.trim()) {
          out.push({ type: "custom", label: k, url: val.trim(), id: "soc_legacy_" + k });
        }
      });
      return out;
    }
    return [];
  }

  function socialsToObject(list) {
    var obj = defaultSocialObject();
    (list || []).forEach(function (row) {
      if (!row || !row.url) return;
      var type = row.type || "custom";
      if (type !== "custom" && Object.prototype.hasOwnProperty.call(obj, type) && !obj[type]) {
        obj[type] = row.url;
      } else {
        obj.extras.push({
          type: type,
          label: row.label || socialDefFor(type).label,
          url: row.url,
          id: row.id
        });
      }
    });
    return obj;
  }

  function defaultSocialObject() {
    return {
      website: "", youtube: "", discord: "", x: "", instagram: "", roblox: "",
      twitch: "", tiktok: "", github: "", steam: "", spotify: "",
      extras: []
    };
  }

  function readEditorSocials() {
    var list = document.getElementById("editSocialList");
    if (!list) return [];
    var rows = [];
    list.querySelectorAll(".cb-edit-social-row").forEach(function (row, i) {
      var typeEl = row.querySelector("[data-social-type]");
      var urlEl = row.querySelector("[data-social-url]");
      var labelEl = row.querySelector("[data-social-label]");
      var type = typeEl ? typeEl.value : "custom";
      var url = urlEl ? urlEl.value.trim() : "";
      if (!url) return;
      var label = labelEl && labelEl.value.trim()
        ? labelEl.value.trim()
        : (socialDefFor(type).label || "Link");
      rows.push({ type: type, label: label, url: url, id: row.getAttribute("data-id") || ("soc_" + i) });
    });
    return rows;
  }

  function socialTypeOptions(selected) {
    return SOCIAL_DEFS.map(function (def) {
      return '<option value="' + def.key + '"' + (def.key === selected ? " selected" : "") + ">" +
        escapeHtml(def.label) + "</option>";
    }).join("");
  }

  function buildSocialEditorRow(row) {
    row = row || { type: "website", label: "", url: "", id: "soc_" + Date.now().toString(36) };
    var type = row.type || "website";
    var showLabel = type === "custom";
    var labelVal = row.label || (showLabel ? "" : socialDefFor(type).label);
    return '<div class="cb-edit-social-row" data-id="' + escapeHtml(row.id || "") + '" data-custom="' + (showLabel ? "1" : "0") + '">' +
      '<select data-social-type aria-label="Network">' + socialTypeOptions(type) + "</select>" +
      '<div class="cb-edit-social-fields">' +
        '<input data-social-label placeholder="Label"' + (showLabel ? "" : " hidden") + ' value="' + escapeHtml(labelVal) + '">' +
        '<input data-social-url placeholder="https://" value="' + escapeHtml(row.url || "") + '">' +
      "</div>" +
      '<button type="button" class="cb-social-remove" data-social-remove aria-label="Remove link">Remove</button>' +
      "</div>";
  }

  function wireSocialEditor() {
    var list = document.getElementById("editSocialList");
    var addBtn = document.getElementById("editSocialAdd");
    var pick = document.getElementById("editSocialPick");
    if (!list) return;
    list.querySelectorAll("[data-social-remove]").forEach(function (btn) {
      btn.onclick = function () {
        var row = btn.closest(".cb-edit-social-row");
        if (row) row.remove();
      };
    });
    list.querySelectorAll("[data-social-type]").forEach(function (sel) {
      sel.onchange = function () {
        var row = sel.closest(".cb-edit-social-row");
        if (!row) return;
        var label = row.querySelector("[data-social-label]");
        var type = sel.value;
        if (!label) return;
        if (type === "custom") {
          label.hidden = false;
          label.placeholder = "Label";
          row.setAttribute("data-custom", "1");
          if (!label.value || (SOCIAL_DEF_MAP[String(label.value).toLowerCase()])) label.value = "";
        } else {
          label.hidden = true;
          label.value = socialDefFor(type).label;
          row.setAttribute("data-custom", "0");
        }
      };
    });
    if (addBtn && !addBtn.dataset.wired) {
      addBtn.dataset.wired = "1";
      addBtn.onclick = function () {
        var type = (pick && pick.value) || "website";
        var wrap = document.createElement("div");
        wrap.innerHTML = buildSocialEditorRow({
          type: type,
          label: type === "custom" ? "" : socialDefFor(type).label,
          url: "",
          id: "soc_" + Date.now().toString(36)
        });
        list.appendChild(wrap.firstChild);
        wireSocialEditor();
      };
    }
  }

  function fillSocialEditor(socials) {
    var list = document.getElementById("editSocialList");
    if (!list) return;
    var rows = normalizeSocials(socials);
    /* Show existing; if empty seed one blank website row for convenience */
    if (!rows.length) {
      list.innerHTML = buildSocialEditorRow({ type: "website", label: "Website", url: "", id: "soc_new" });
    } else {
      list.innerHTML = rows.map(function (r) { return buildSocialEditorRow(r); }).join("");
    }
    wireSocialEditor();
  }

  function defaultProfile(id) {
    // Canonical roster 2-23 (0/1 reserved for real Labradors). SnackBandit=18, BarkBroker=23.
    var demos = {
      "2": { displayName: "Cardbrador", handle: "cardbrador", bio: "Welcome aboard.", about: "Official-ish demo pup." },
      "3": { displayName: "BeeSid", handle: "beesid", bio: "Rhombus enjoyer.", about: "Lives in the header glow." },
      "4": { displayName: "Miguel", handle: "miguel", bio: "Mutiny correspondent.", about: "Keeps receipts." },
      "5": { displayName: "GyattToad", handle: "gyatttoad", bio: "Pitch machine.", about: "Ideas tab forever." },
      "6": { displayName: "AnthonySpade", handle: "anthonyspade", bio: "Gift drive booster.", about: "Stockings full of rhombuses." },
      "7": { displayName: "Barcat", handle: "barcat", bio: "Lounge lookout.", about: "Always on the rail." },
      "8": { displayName: "EvilRobot", handle: "evilrobot", bio: "Beep boop menace.", about: "Mostly jokes." },
      "9": { displayName: "AbovegroundBro", handle: "abovegroundbro", bio: "Above-ground vibes.", about: "Test mesh enjoyer." },
      "10": { displayName: "NerdDog", handle: "nerddog", bio: "Specs and snacks.", about: "8x the polish." },
      "11": { displayName: "OrangeTabby", handle: "orangetabby", bio: "Triple leverage vibes.", about: "Charts and stars." },
      "12": { displayName: "EvilKid23", handle: "evilkids23", bio: "Spooky soft launch.", about: "Friendly haunt." },
      "13": { displayName: "NoFilterBro", handle: "nofilterbro", bio: "Raw feed only.", about: "What you see is what you get." },
      "14": { displayName: "CoolDog", handle: "cooldog", bio: "Cool by default.", about: "Name is the vibe." },
      "15": { displayName: "ANIMEGIRL", handle: "animegirl", bio: "Main character energy.", about: "Frame-perfect poses." },
      "16": { displayName: "PantsWetterLabrador", handle: "pantswetter", bio: "Hydration is a lifestyle.", about: "Check your pants." },
      "17": { displayName: "RhombusRex", handle: "rhombusrex", bio: "Angles only.", about: "Header glow fan." },
      "18": { displayName: "SnackBandit", handle: "snackbandit", bio: "Treat heist specialist.", about: "Will work for biscuits." },
      "19": { displayName: "BarTabby", handle: "bartabby", bio: "Bar shifts and soft paws.", about: "Speed is kindness." },
      "20": { displayName: "PuddlePirate", handle: "puddlepirate", bio: "Splash tax collector.", about: "Boots optional." },
      "21": { displayName: "TreatTaxer", handle: "treattaxer", bio: "IRS of snacks.", about: "Pay the biscuit." },
      "22": { displayName: "SofaThief", handle: "sofathief", bio: "Cushion conqueror.", about: "Your seat is my seat." },
      "23": { displayName: "BarkBroker", handle: "barkbroker", bio: "Market of woofs.", about: "Bullish on pets." },
      guest: { displayName: "Guest", handle: "guest", bio: "Just looking around.", about: "Log in to claim a cooler profile." }
    };
    var base = demos[id] || {
      displayName: id === "me" ? "You" : ("User " + id),
      handle: String(id || "user").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "user",
      bio: "Coolbrador explorer.",
      about: "No extra details yet."
    };
    return {
      id: id,
      displayName: base.displayName,
      handle: base.handle,
      bio: base.bio,
      about: base.about,
      avatar: localStorage.getItem("pfp_" + id) || demoAvatar(id),
      banner: DEFAULT_BANNER,
      aboutImage: "/img/favicon3.ico",
      layoutPreset: "profile",
      socials: defaultSocials(),
      media: [],
      sections: [],
      joined: Date.now() - 86400000 * 40
    };
  }

  function loadProfile(id) {
    try {
      var stored = JSON.parse(localStorage.getItem("profile_" + id) || "null");
      if (stored) {
        stored.id = id;
        if (!stored.avatar) stored.avatar = localStorage.getItem("pfp_" + id) || demoAvatar(id);
        if (!stored.aboutImage) stored.aboutImage = "/img/favicon3.ico";
        if (!stored.banner) stored.banner = DEFAULT_BANNER;
        if (!stored.socials) stored.socials = defaultSocials();
        else stored.socials = normalizeSocials(stored.socials);
        if (!stored.layoutPreset) stored.layoutPreset = "profile";
        if (!Array.isArray(stored.media)) stored.media = [];
        if (!Array.isArray(stored.sections)) stored.sections = [];
        return stored;
      }
    } catch (e) {}
    try {
      var user = JSON.parse(localStorage.getItem("user_" + id) || "{}");
      if (user.username || user.displayName) {
        var name = user.username || user.displayName;
        return {
          id: id,
          displayName: name,
          handle: String(name || "user").toLowerCase().replace(/\s+/g, ""),
          bio: user.bio || "Coolbrador explorer.",
          about: user.about || "Member of the Coolbrador cosmos.",
          avatar: user.profilePicture || localStorage.getItem("pfp_" + id) || demoAvatar(id),
          banner: user.banner || DEFAULT_BANNER,
          aboutImage: user.aboutImage || "/img/favicon3.ico",
          layoutPreset: user.layoutPreset || "profile",
          socials: user.socials || defaultSocials(),
          media: user.media || [],
          sections: [],
          joined: user.joined || Date.now()
        };
      }
    } catch (e) {}
    return defaultProfile(id);
  }

  function saveProfile(profile) {
    localStorage.setItem("profile_" + profile.id, JSON.stringify(profile));
    if (profile.avatar) localStorage.setItem("pfp_" + profile.id, profile.avatar);
    try {
      var user = JSON.parse(localStorage.getItem("user_" + profile.id) || "{}");
      user.username = profile.displayName;
      user.displayName = profile.displayName;
      user.bio = profile.bio;
      user.about = profile.about;
      user.profilePicture = profile.avatar;
      user.banner = profile.banner || "";
      user.aboutImage = profile.aboutImage || "/img/favicon3.ico";
      user.socials = profile.socials || defaultSocials();
      user.layoutPreset = profile.layoutPreset || "profile";
      localStorage.setItem("user_" + profile.id, JSON.stringify(user));
    } catch (e) {}
    // Refresh visible composer / post avatars for this Labrador
    try {
      var src = profile.avatar || localStorage.getItem("pfp_" + profile.id) || "";
      if (src) {
        document.querySelectorAll("#currentUserPfp, .create-post-container .post-avatar img").forEach(function (img) {
          img.src = src;
        });
        document.querySelectorAll('.post-avatar[data-profile="' + profile.id + '"] img, a.post-avatar[data-profile="' + profile.id + '"] img').forEach(function (img) {
          img.src = src;
        });
      }
      try {
        window.dispatchEvent(new CustomEvent("cb-auth-changed", { detail: { signedIn: true, userId: profile.id } }));
      } catch (e2) {}
    } catch (e3) {}
  }

  // Persists the signed-in user's own profile to Firestore so everyone sees it.
  function saveProfileToCloud(profile) {
    if (!window.CBCloudReady) return Promise.reject(new Error("offline"));
    return window.CBCloudReady.then(function (cloud) {
      return cloud.saveMyProfile(profile);
    });
  }

  function countActivity(userId) {
    var posts = 0, yeahs = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || !key.startsWith("posts_")) continue;
      try {
        var list = JSON.parse(localStorage.getItem(key) || "[]");
        list.forEach(function (p) {
          if (String(p.userId) === String(userId)) posts += 1;
          if ((p.yeahs || []).map(String).indexOf(String(userId)) !== -1) yeahs += 1;
        });
      } catch (e) {}
    }
    return { posts: posts, yeahs: yeahs };
  }

  function collectPosts(userId, mode) {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || !key.startsWith("posts_")) continue;
      try {
        var list = JSON.parse(localStorage.getItem(key) || "[]");
        list.forEach(function (p) {
          var board = key.replace("posts_", "");
          if (mode === "posts") {
            if (String(p.userId) === String(userId)) {
              var copy = Object.assign({}, p);
              copy.board = board;
              copy.kind = "post";
              copy.yeahs = copy.yeahs || [];
              copy.replies = copy.replies || [];
              out.push(copy);
            }
          } else {
            (p.replies || []).forEach(function (r) {
              if (String(r.userId) === String(userId)) {
                out.push({
                  id: r.id || (p.id + "_r"),
                  userId: r.userId,
                  username: r.username || r.displayName || "Lab",
                  text: r.text || "",
                  timestamp: r.timestamp,
                  board: board,
                  kind: "reply",
                  parentText: p.text || "",
                  parentId: p.id,
                  media: r.media || null,
                  image: r.image || null,
                  video: r.video || null,
                  yeahs: r.yeahs || [],
                  replies: [],
                  views: r.views || 0
                });
              }
            });
          }
        });
      } catch (e) {}
    }
    return out.sort(function (a, b) { return (b.id || 0) - (a.id || 0); }).slice(0, 24);
  }

  function collectReposts(userId) {
    var list = [];
    if (window.CoolbradorPosts && typeof window.CoolbradorPosts.getReposts === "function") {
      list = window.CoolbradorPosts.getReposts(userId) || [];
    } else {
      try { list = JSON.parse(localStorage.getItem("reposts_" + userId) || "[]"); } catch (e) { list = []; }
    }
    return (list || []).slice(0, 24);
  }

  function collectMedia(profile, opts) {
    opts = opts || {};
    var items = [];
    // Media tab should only show committed gallery items while drafting.
    // Avatar/banner preview on the profile chrome is fine; gallery waits for Save.
    var includeChrome = opts.includeChrome === true;
    if (includeChrome) {
      if (profile.avatar) items.push({ url: profile.avatar, type: "image", label: "Photo" });
      if (profile.banner) items.push({ url: profile.banner, type: "image", label: "Banner" });
      if (profile.aboutImage && profile.aboutImage.indexOf("favicon") === -1) {
        items.push({ url: profile.aboutImage, type: "image", label: "About" });
      }
    }
    (profile.media || []).forEach(function (m) {
      if (m && m.url) items.push(m);
    });
    var seen = {};
    return items.filter(function (m) {
      if (!m.url || seen[m.url]) return false;
      seen[m.url] = true;
      return true;
    });
  }

  function remapFriendId(id) {
    var s = String(id == null ? "" : id).trim();
    if (!s || !/^\d+$/.test(s)) return "";
    var n = parseInt(s, 10);
    var base = (window.CB_DEMO_ID_BASE != null) ? Number(window.CB_DEMO_ID_BASE) : 2;
    if (n >= 0 && n < base) return String(base + n);
    return s;
  }

  function resolveFriend(id) {
    var rid = remapFriendId(id);
    if (!rid) return null;
    var u = {};
    var p = {};
    try { u = JSON.parse(localStorage.getItem("user_" + rid) || "{}"); } catch (e) {}
    try { p = JSON.parse(localStorage.getItem("profile_" + rid) || "null") || {}; } catch (e) {}
    var seed = defaultProfile(rid);
    var name = (p && p.displayName) || u.displayName || u.username || (seed && seed.displayName) || "";
    if (!name || /^Lab\s*\d+$/i.test(name) || /^User\s+/i.test(name)) {
      // Prefer seed demo name over Lab N stubs
      if (seed && seed.displayName && seed.displayName.indexOf("User ") !== 0) name = seed.displayName;
    }
    if (!name) return null;
    return {
      id: rid,
      name: name,
      pfp: (p && p.avatar) || u.profilePicture || localStorage.getItem("pfp_" + rid) || demoAvatar(rid)
    };
  }

  function loadFriends(profileId) {
    var ids = [];
    var base = (window.CB_DEMO_ID_BASE != null) ? Number(window.CB_DEMO_ID_BASE) : 2;
    try {
      var raw = JSON.parse(localStorage.getItem("friends_" + profileId) || "[]");
      if (Array.isArray(raw) && raw.length) ids = raw.map(String);
    } catch (e) {}
    if (!ids.length) {
      for (var i = 0; i <= 12; i++) {
        var did = String(base + i);
        if (did !== String(profileId)) ids.push(did);
      }
      ids = ids.slice(0, 8);
    }
    var seen = {};
    var out = [];
    ids.forEach(function (id) {
      var f = resolveFriend(id);
      if (!f || seen[f.id] || f.id === String(profileId)) return;
      seen[f.id] = true;
      out.push(f);
    });
    return out.slice(0, 12);
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error("No file"));
      if (file.size > IMAGE_MAX_BYTES) return reject(new Error("File too large (max ~20MB)."));
      var okType = (file.type || "").indexOf("image/") === 0 || (file.type || "").indexOf("video/") === 0;
      if (!okType) return reject(new Error("Please choose an image or video file."));
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(new Error("Could not read that file.")); };
      reader.readAsDataURL(file);
    });
  }

  /** Crop presets: avatar 1:1 circle, banner 3:1, about 4:3. */
  var CROP_PRESETS = {
    avatar: { aspect: 1, shape: "circle", maxEdge: 512, mime: "image/png" },
    banner: { aspect: 3, shape: "rect", maxEdge: 1600, mime: "image/jpeg" },
    about: { aspect: 4 / 3, shape: "rect", maxEdge: 1200, mime: "image/jpeg" }
  };

  function openImageCrop(opts) {
    if (!window.CoolbradorImageCrop || typeof window.CoolbradorImageCrop.open !== "function") {
      return Promise.reject(new Error("Image crop unavailable."));
    }
    return window.CoolbradorImageCrop.open(opts || {});
  }

  function socialHref(key, value) {
    var v = String(value || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (key === "discord" && v.indexOf("discord.") === -1) return "https://discord.com/users/" + encodeURIComponent(v);
    if (key === "x" && v.charAt(0) === "@") return "https://x.com/" + encodeURIComponent(v.slice(1));
    if (key === "instagram" && v.charAt(0) === "@") return "https://instagram.com/" + encodeURIComponent(v.slice(1));
    if (key === "tiktok" && v.charAt(0) === "@") return "https://www.tiktok.com/@" + encodeURIComponent(v.slice(1));
    if (key === "github" && v.indexOf("/") === -1) return "https://github.com/" + encodeURIComponent(v);
    if (key === "twitch" && v.indexOf(".") === -1) return "https://twitch.tv/" + encodeURIComponent(v);
    if (key === "steam" && v.indexOf(".") === -1) return "https://steamcommunity.com/id/" + encodeURIComponent(v);
    if (key === "spotify" && v.indexOf(".") === -1) return "https://open.spotify.com/user/" + encodeURIComponent(v);
    return "https://" + v.replace(/^\/+/, "");
  }

  function renderSocials(target, socials) {
    if (!target) return;
    var rows = normalizeSocials(socials);
    var html = rows.map(function (row) {
      var def = socialDefFor(row.type);
      var href = socialHref(row.type, row.url);
      if (!href) return "";
      var label = row.label || def.label || "Link";
      return '<a class="cb-social-link" href="' + escapeHtml(href) + '" target="_blank" rel="noopener">' +
        '<i class="' + def.icon + '" aria-hidden="true"></i><span>' + escapeHtml(label) + "</span></a>";
    }).filter(Boolean).join("");
    target.innerHTML = html || '<p class="empty-feed">No links yet.</p>';
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (e) { reject(e); }
      ta.remove();
    });
  }

  function openMedia(url, type, playlistOpts) {
    playlistOpts = playlistOpts || {};
    var items = Array.isArray(playlistOpts.items) ? playlistOpts.items : null;
    var index = playlistOpts.index != null ? Number(playlistOpts.index) : 0;
    if (window.CoolbradorMediaViewer) {
      var payload = { url: url, type: type || "image" };
      if (items && items.length) {
        payload.items = items.map(function (m) {
          return {
            url: m.url,
            type: (m.type === "video" ? "video" : "image"),
            name: m.name || m.label || "coolbrador-media"
          };
        });
        payload.index = isFinite(index) ? index : 0;
      }
      window.CoolbradorMediaViewer.open(payload);
    } else {
      window.open(url, "_blank", "noopener");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Share card/links: chrome-free solo view
    try {
      var path0 = String(location.pathname || "");
      var q0 = new URLSearchParams(location.search || "");
      var solo = /\/users\/[^/]+\/(card|links)\/?$/i.test(path0) ||
        q0.get("share") === "1" || q0.get("solo") === "1" ||
        q0.get("layout") === "card" || q0.get("layout") === "links";
      if (solo) {
        document.body.classList.add("cb-share-solo");
        document.documentElement.classList.add("cb-share-solo");
      }
    } catch (e) {}

    var route = parseRoute();
    var currentUserId = getSessionUserId();
    var loggedIn = isSignedIn() && !!currentUserId;
    if (!currentUserId) currentUserId = localStorage.getItem("currentUserId") || "";
    if (!loggedIn) loggedIn = localStorage.getItem("loggedIn") === "true" && !!currentUserId;

    // Prefer route id; fall back to session currentUserId so empty resolve never blanks the redesign layout
    var sessionPublicId = sessionNumericId();
    if (!sessionPublicId) sessionPublicId = resolvePublicId(currentUserId || "");
    if (!sessionPublicId && currentUserId && /^\d+$/.test(String(currentUserId))) {
      sessionPublicId = String(currentUserId);
    }
    var routeRaw = route.id || qs("id") || "";
    // /users/<handle> resolves through Firestore; never fall back to your own profile.
    if (routeRaw && !/^\d+$/.test(String(routeRaw)) && String(routeRaw).toLowerCase() !== "me" && !resolvePublicId(routeRaw)) {
      if (window.CBCloudReady) {
        window.CBCloudReady.then(function (cloud) { return cloud.getProfileByHandle(routeRaw); }).then(function (p) {
          if (p && p.publicId) location.replace("/users/" + encodeURIComponent(p.publicId) + (route.layout && route.layout !== "profile" ? "/" + route.layout : ""));
          else showProfileNotFound(routeRaw);
        }).catch(function () { showProfileNotFound(routeRaw); });
      } else {
        showProfileNotFound(routeRaw);
      }
      return;
    }
    // Never keep /users/me in the address bar
    if (String(routeRaw).toLowerCase() === "me" && sessionPublicId) {
      var dest = "/users/" + encodeURIComponent(sessionPublicId);
      if (route.layout && route.layout !== "profile") dest += "/" + route.layout;
      history.replaceState({ profile: true, id: sessionPublicId, layout: route.layout || "profile" }, "", dest);
      routeRaw = sessionPublicId;
      route.id = sessionPublicId;
    }
    var viewId = resolvePublicId(routeRaw || currentUserId || sessionPublicId || "");
    if (!viewId) viewId = sessionPublicId;
    if (!viewId && currentUserId && /^\d+$/.test(String(currentUserId))) viewId = String(currentUserId);
    var isOwn = loggedIn && viewId && sessionPublicId && String(viewId) === String(sessionPublicId);
    var profile = viewId ? loadProfile(viewId) : {
      id: "",
      displayName: "Labrador",
      handle: "",
      bio: "",
      about: "",
      avatar: "/users/default/pfp.jpg",
      banner: DEFAULT_BANNER,
      layoutPreset: "profile",
      media: [],
      sections: [],
      socials: typeof defaultSocials === "function" ? defaultSocials() : {}
    };
    // Ensure own profile never shows blank Labrador placeholder
    if (isOwn && viewId && (!profile.handle || profile.displayName === "Labrador" || profile.displayName === "You")) {
      try {
        var uOwn = JSON.parse(localStorage.getItem("user_" + viewId) || "{}");
        if (uOwn.displayName || uOwn.username) {
          profile.displayName = uOwn.displayName || uOwn.username;
          profile.handle = profile.handle || String(profile.displayName).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
        }
      } catch (e3) {}
    }
    var activeLayout = route.layout || profile.layoutPreset || "profile";
    if (activeLayout !== "profile" && activeLayout !== "card" && activeLayout !== "links") activeLayout = "profile";
    var feedTab = "posts";

    // Refresh real (non-mascot) profiles from Firestore after the cached first paint.
    if (viewId && Number(viewId) >= 100 && window.CBCloudReady) {
      window.CBCloudReady.then(function (cloud) {
        return cloud.getProfileByPublicId(viewId, { fresh: true });
      }).then(function (p) {
        if (!p) {
          if (!isOwn) showProfileNotFound(viewId);
          return;
        }
        if (profileDraft) return;
        profile = loadProfile(viewId);
        try { paint(); } catch (_) {}
      }).catch(function (err) {
        console.warn("[profile] cloud refresh failed", err && (err.code || err.message));
      });
    }

    function setText(id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value == null ? "" : String(value);
    }
    function setSrc(id, value) {
      var el = document.getElementById(id);
      if (el) el.src = value || "/users/default/pfp.jpg";
    }

    function syncBanner() {
      var img = document.getElementById("profileBannerImg");
      var btn = document.getElementById("bannerOpenBtn");
      var banner = document.getElementById("profileBanner");
      var src = profile.banner || DEFAULT_BANNER;
      if (img) {
        img.src = src;
        img.hidden = false;
      }
      if (btn) btn.hidden = false;
      if (banner) banner.style.backgroundImage = "none";
    }

    function renderFeed() {
      var box = document.getElementById("profileFeed");
      if (!box) return;
      box.classList.add("hub-feed");

      var CP = window.CoolbradorPosts;
      var useCards = CP && typeof CP.renderPostCard === "function";

      function wireFeed() {
        if (CP && typeof CP.bindFeedInteractions === "function") {
          CP.bindFeedInteractions(box, {
            reload: renderFeed,
            onYeah: function () { renderFeed(); }
          });
        }
      }

      if (feedTab === "reposts") {
        var reposts = collectReposts(viewId);
        if (!reposts.length) {
          box.innerHTML = '<p class="empty-feed">No reposts yet.</p>';
          return;
        }
        if (useCards) {
          box.innerHTML = reposts.map(function (rp) {
            var snap = rp.snapshot || {};
            var live = null;
            if (typeof CP.findPostRecord === "function") {
              try { live = CP.findPostRecord(rp.board || snap.board || "", rp.originalPostId || snap.id); } catch (eRp) { live = null; }
            }
            var src = (live && live.post) ? live.post : snap;
            var post = {
              id: src.id || snap.id || rp.originalPostId || rp.postId || rp.id,
              userId: src.userId || snap.userId || "",
              username: src.username || snap.username || "Lab",
              text: src.text != null ? src.text : (snap.text || ""),
              timestamp: src.timestamp || snap.timestamp,
              board: rp.board || snap.board || src.board || "",
              media: src.media || snap.media || null,
              image: src.image || snap.image || null,
              video: src.video || snap.video || null,
              yeahs: src.yeahs || snap.yeahs || [],
              replies: src.replies || snap.replies || [],
              views: src.views || snap.views || 0
            };
            return CP.renderPostCard(post, {
              board: post.board,
              showBoard: true,
              className: "cb-repost-card",
              repostBy: {
                userId: rp.userId || viewId,
                username: rp.username || (profile && profile.displayName) || "Lab"
              }
            });
          }).join("");
          wireFeed();
          return;
        }
        box.innerHTML = reposts.map(function (rp) {
          var snap = rp.snapshot || {};
          var board = (rp.board || snap.board || "").split("/").pop();
          var who = (String(rp.userId || viewId) === String(currentUserId)) ? "You" : (rp.username || (profile && profile.displayName) || "Lab");
          var origWho = snap.username || "Lab";
          var body = escapeHtml(snap.text || "").replace(/\n/g, "<br>");
          var pid = escapeHtml(String(snap.id || rp.originalPostId || ""));
          var pboard = escapeHtml(String(rp.board || snap.board || ""));
          return '<div class="post cb-repost-card is-repost" style="cursor:default;" data-id="' + pid + '" data-board="' + pboard + '">' +
            '<div class="cb-repost-context"><i class="fa-solid fa-retweet" aria-hidden="true"></i> <strong>' + escapeHtml(who) + "</strong> reposted</div>" +
            '<div class="post-body">' +
              '<div class="post-header"><strong>' + escapeHtml(origWho) + "</strong>" +
                '<span class="post-meta">' + escapeHtml(String(snap.timestamp || rp.timestamp || "").slice(0, 10)) + "</span>" +
                (board ? '<a class="post-board" href="/b/' + encodeURIComponent(board) + '/board.html">' + escapeHtml(board) + "</a>" : "") +
              "</div>" +
              '<div class="post-text">' + body + "</div>" +
            "</div></div>";
        }).join("");
        return;
      }

      var items = collectPosts(viewId, feedTab);
      if (!items.length) {
        box.innerHTML = '<p class="empty-feed">' + (feedTab === "replies" ? "No replies yet." : "No posts yet.") + "</p>";
        return;
      }

      if (useCards) {
        box.innerHTML = items.map(function (p) {
          var opts = { board: p.board, showBoard: true };
          if (p.kind === "reply") {
            opts.className = "cb-reply-card";
            opts.headerExtra = '<span class="post-board">Reply</span>';
            if (p.parentText) {
              opts.textHtml =
                '<div class="post-text" style="opacity:.75;font-size:.9em;margin-bottom:6px;">' +
                escapeHtml(String(p.parentText).slice(0, 120)) +
                "</div>" +
                escapeHtml(p.text || "").replace(/\n/g, "<br>");
            }
          }
          return CP.renderPostCard(p, opts);
        }).join("");
        wireFeed();
        return;
      }

      box.innerHTML = items.map(function (p) {
        var board = (p.board || "").split("/").pop();
        var extra = p.kind === "reply" && p.parentText
          ? '<div class="post-header"><span class="post-board">Reply on ' + escapeHtml(board) + "</span></div>" +
            '<div class="post-text" style="opacity:.75;font-size:.9em;margin-bottom:6px;">' + escapeHtml(String(p.parentText).slice(0, 120)) + "</div>"
          : '<div class="post-header"><span class="post-board">' + escapeHtml(board) + "</span></div>";
        return '<div class="post" style="cursor:default;"><div class="post-body">' + extra +
          '<div class="post-text">' + escapeHtml(p.text || "").replace(/\n/g, "<br>") + "</div></div></div>";
      }).join("");
    }

    function renderMedia() {
      var grid = document.getElementById("profileMediaGrid");
      if (!grid) return;
      var items = collectMedia(profile, { includeChrome: false }).slice(0, 6);
      if (!items.length) {
        grid.innerHTML = '<p class="empty-feed" style="grid-column:1/-1;padding:8px 0;margin:0;">No media yet.</p>';
        return;
      }
      grid.innerHTML = items.map(function (m, idx) {
        var isVid = m.type === "video" || /\.(mp4|webm|ogg)(\?|$)/i.test(m.url || "");
        var inner = isVid
          ? '<video src="' + escapeHtml(m.url) + '" muted playsinline></video>'
          : '<img src="' + escapeHtml(m.url) + '" alt="">';
        return '<button type="button" data-media-idx="' + idx + '">' + inner + "</button>";
      }).join("");
      grid.querySelectorAll("[data-media-idx]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = Number(btn.getAttribute("data-media-idx"));
          var m = items[idx];
          if (!m) return;
          openMedia(m.url, m.type === "video" ? "video" : "image", { items: items, index: idx });
        });
      });
    }

    function renderFriends() {
      var box = document.getElementById("profileFriends");
      if (!box) return;
      var friends = loadFriends(viewId);
      box.innerHTML = friends.map(function (f) {
        return '<a class="cb-friend-row" href="/users/' + encodeURIComponent(f.id) + '">' +
          '<img src="' + escapeHtml(f.pfp) + '" alt="">' +
          "<span>" + escapeHtml(f.name) + "</span></a>";
      }).join("") || '<p class="empty-feed" style="margin:0;">No friends listed.</p>';
    }

    function moveTabInk() {
      var ink = document.getElementById("profileTabInk");
      var active = document.querySelector('.cb-profile-tab.is-active');
      if (!ink || !active) return;
      ink.style.width = active.offsetWidth + "px";
      ink.style.transform = "translateX(" + active.offsetLeft + "px)";
    }

    function setLayout(layout, push) {
      activeLayout = layout;
      document.getElementById("profileRoot").setAttribute("data-layout", layout);
      document.querySelectorAll(".cb-profile-tab").forEach(function (btn) {
        btn.classList.toggle("is-active", btn.getAttribute("data-layout-tab") === layout);
      });
      document.querySelectorAll(".cb-profile-pane").forEach(function (pane) {
        var on = pane.getAttribute("data-pane") === layout;
        pane.hidden = !on;
        pane.classList.toggle("is-active", on);
      });
      moveTabInk();
      if (push) {
        var base = "/users/" + encodeURIComponent(viewId);
        var url = layout === "profile" ? base : (base + "/" + layout);
        history.replaceState({ profile: true, id: viewId, layout: layout }, "", url);
      }
    }

    
    var profileDraft = null;
    var profileSavedSnapshot = null;

    function cloneProfile(p) {
      try { return JSON.parse(JSON.stringify(p)); } catch (_) { return p; }
    }

    function ensureProfileSaveBar() {
      var bar = document.getElementById("cbProfileSaveBar");
      if (bar) return bar;
      bar = document.createElement("div");
      bar.id = "cbProfileSaveBar";
      bar.className = "cb-profile-savebar";
      bar.hidden = true;
      bar.innerHTML =
        '<div class="cb-profile-savebar-inner">' +
        '<button type="button" class="cb-cancel-btn" data-cb-profile-cancel>Cancel</button>' +
        '<button type="button" class="cb-save-btn" data-cb-profile-save>Save</button>' +
        "</div>";
      document.body.appendChild(bar);
      bar.querySelector("[data-cb-profile-cancel]").addEventListener("click", function () {
        cancelProfileDraft();
      });
      bar.querySelector("[data-cb-profile-save]").addEventListener("click", function () {
        commitProfileDraft();
      });
      return bar;
    }

    function showProfileSaveBar(show) {
      var bar = ensureProfileSaveBar();
      bar.hidden = !show;
    }

    
    function wireProfileDraftFields() {
      ["editDisplay", "editBio", "editAbout"].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el || el.dataset.cbDraftWired) return;
        el.dataset.cbDraftWired = "1";
        el.addEventListener("input", function () { beginProfileDraft(); });
      });
    }

    function beginProfileDraft() {
      if (!profileDraft) {
        profileSavedSnapshot = cloneProfile(profile);
        profileDraft = cloneProfile(profile);
      }
      showProfileSaveBar(true);
    }

    function cancelProfileDraft() {
      if (profileSavedSnapshot) profile = cloneProfile(profileSavedSnapshot);
      profileDraft = null;
      profileSavedSnapshot = null;
      showProfileSaveBar(false);
      try { paint(); } catch (_) {}
      try { toast("Changes discarded"); } catch (_) {}
    }

    function commitProfileDraft() {
      // Sync any open edit fields first if edit panel exists
      try {
        var ed = document.getElementById("editDisplay");
        if (ed) profile.displayName = (ed.value || "").trim() || profile.displayName;
        var bio = document.getElementById("editBio");
        if (bio) profile.bio = (bio.value || "").trim();
        var about = document.getElementById("editAbout");
        if (about) profile.about = (about.value || "").trim();
      } catch (_) {}
      if (profile._pendingAvatarMedia) {
        profile.media = profile.media || [];
        profile.media.unshift(profile._pendingAvatarMedia);
        delete profile._pendingAvatarMedia;
      }
      try { saveProfile(profile); } catch (_) {}
      profileDraft = null;
      profileSavedSnapshot = cloneProfile(profile);
      showProfileSaveBar(false);
      try { paint(); } catch (_) {}
      try { toast("Saving..."); } catch (_) {}
      saveProfileToCloud(profile).then(function (saved) {
        if (saved && String(saved.publicId) === String(profile.id)) {
          profile = loadProfile(profile.id);
          profileSavedSnapshot = cloneProfile(profile);
          try { paint(); } catch (_) {}
        }
        try { toast("Saved"); } catch (_) {}
      }).catch(function (err) {
        console.warn("[profile] save failed", err);
        try { toast("Couldn't save to your account: " + ((err && (err.code || err.message)) || "error")); } catch (_) {}
      });
    }


    function applyCroppedImage(kind, dataUrl) {
      beginProfileDraft();
      if (kind === "avatar") {
        profile.avatar = dataUrl;
        // Keep media gallery clean until Save — stash pending only.
        profile._pendingAvatarMedia = { url: dataUrl, type: "image", label: "Photo" };
      } else if (kind === "banner") {
        profile.banner = dataUrl;
      } else if (kind === "about") {
        profile.aboutImage = dataUrl;
      }
      paint();
      toast("Ready. Hit Save to keep changes.");
    }

    /** File picker first; cancel does nothing. Then crop the chosen file. */
    function openOwnerCrop(kind) {
      var preset = CROP_PRESETS[kind] || CROP_PRESETS.avatar;
      var input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.hidden = true;
      document.body.appendChild(input);
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        try { input.remove(); } catch (err) {}
        if (!file) return;
        if ((file.type || "").indexOf("image/") !== 0) {
          toast("Please choose an image file.");
          return;
        }
        readFileAsDataUrl(file).then(function (dataUrl) {
          return openImageCrop({
            src: dataUrl,
            aspect: preset.aspect,
            shape: preset.shape,
            maxEdge: preset.maxEdge,
            mime: preset.mime,
            onApply: function (cropped) {
              applyCroppedImage(kind, cropped);
            }
          });
        }).catch(function (err) {
          if (err) toast(err.message || "Crop failed.");
        });
      });
      input.click();
    }

    function paint() {
      document.title = profile.displayName + " - Coolbrador";
      setText("profileDisplayName", profile.displayName);
      setText("profileHandle", "@" + (profile.handle || ""));
      setText("profileBio", profile.bio || "");
      setText("profileAbout", profile.about || "No extra details yet.");
      setSrc("profileAvatar", profile.avatar || demoAvatar(viewId));
      document.querySelectorAll(".cb-inline-edit").forEach(function (b) { b.remove(); });
      if (isOwn) {
        var avBtn = document.getElementById("avatarOpenBtn");
        if (avBtn) avBtn.classList.add("cb-crop-editable");
        var bannerBtnOwn = document.getElementById("bannerOpenBtn");
        if (bannerBtnOwn) bannerBtnOwn.classList.add("cb-crop-editable");
        var aboutImgOwn = document.getElementById("profileAboutImg");
        if (aboutImgOwn) aboutImgOwn.classList.add("cb-crop-editable");
      }
      setSrc("profileAboutImg", profile.aboutImage || "/img/favicon3.ico");
      setSrc("cardAvatar", profile.avatar || demoAvatar(viewId));
      setText("cardDisplayName", profile.displayName);
      setText("cardHandle", "@" + profile.handle);
      setText("cardBio", profile.bio || "");
      setText("cardAbout", profile.about || "");
      setSrc("cardAboutImg", profile.aboutImage || "/img/favicon3.ico");
      setSrc("linksAvatar", profile.avatar || demoAvatar(viewId));
      setText("linksDisplayName", profile.displayName);
      setText("linksHandle", "@" + profile.handle);
      setText("linksBio", profile.bio || "");
      renderSocials(document.getElementById("cardSocials"), profile.socials);
      renderSocials(document.getElementById("linksSocials"), profile.socials);
      syncBanner();

      var stats = countActivity(viewId);
      setText("statPosts", stats.posts);
      setText("statYeahs", stats.yeahs);
      setText("statJoined", new Date(profile.joined || Date.now()).toLocaleDateString());

      var actions = document.getElementById("profileActions");
      var blockedThem = false;
      try {
        if (!isOwn && window.CoolbradorPosts && typeof window.CoolbradorPosts.isBlockedUser === "function") {
          blockedThem = !!window.CoolbradorPosts.isBlockedUser(viewId);
        }
      } catch (e) {}
      var blockBtnHtml = "";
      if (!isOwn && viewId) {
        blockBtnHtml = blockedThem
          ? '<button type="button" class="ghost" id="profileUnblockBtn">Unblock</button>'
          : '<button type="button" class="ghost" id="profileBlockBtn">Block</button>';
      }
      // Build share menu inside wrap so re-renders never destroy a reparented orphan menu.
      actions.innerHTML =
        (isOwn ? '<button type="button" class="primary" id="editToggle"><i class="fa-solid fa-pen" aria-hidden="true"></i> Edit</button>' : "") +
        blockBtnHtml +
        '<div class="cb-share-wrap" id="shareWrap">' +
          '<button type="button" class="cb-icon-btn ghost" id="shareToggle" title="Share" aria-label="Share" aria-haspopup="true" aria-expanded="false"><i class="fa-solid fa-ellipsis-vertical"></i></button>' +
          '<div class="cb-share-menu" id="shareMenu" hidden role="menu">' +
            '<button type="button" data-share="profile">Share Profile <span class="cb-share-eg">/users/<span data-share-id>' + escapeHtml(String(viewId)) + '</span></span></button>' +
            '<button type="button" data-share="card">Share Card <span class="cb-share-eg">/users/<span data-share-id>' + escapeHtml(String(viewId)) + '</span>/card</span></button>' +
            '<button type="button" data-share="links">Share Links <span class="cb-share-eg">/users/<span data-share-id>' + escapeHtml(String(viewId)) + '</span>/links</span></button>' +
          "</div>" +
        "</div>";


      renderFeed();
      renderMedia();
      renderFriends();
      setLayout(activeLayout, false);
      wireActions();
    }

    function fillEditor() {
      document.getElementById("editDisplay").value = profile.displayName || "";
      document.getElementById("editBio").value = profile.bio || "";
      document.getElementById("editAbout").value = profile.about || "";
      document.getElementById("editLayoutPreset").value = profile.layoutPreset || "profile";
      fillSocialEditor(profile.socials || defaultSocials());
      var list = document.getElementById("builderSections");
      var sections = profile.sections && profile.sections.length
        ? profile.sections
        : [
            { id: "banner", label: "Banner" },
            { id: "about", label: "About me" },
            { id: "socials", label: "Socials" },
            { id: "feed", label: "Posts feed" }
          ];
      profile.sections = sections.map(function (sec, i) {
        return { id: sec.id || ("sec_" + i), label: sec.label || sec.id || ("Section " + (i + 1)), style: sec.style || "surface" };
      });
      list.innerHTML = profile.sections.map(function (sec, idx) {
        return "<li><span>" + escapeHtml(sec.label) + " · token " + escapeHtml(sec.style || "surface") + "</span>" +
          '<button type="button" class="ghost" data-move="' + idx + '">Up</button></li>';
      }).join("");
      list.querySelectorAll("[data-move]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var i = Number(btn.getAttribute("data-move"));
          if (i <= 0) return;
          var tmp = profile.sections[i - 1];
          profile.sections[i - 1] = profile.sections[i];
          profile.sections[i] = tmp;
          fillEditor();
        });
      });
    }

    function wireActions() {
      document.querySelectorAll(".cb-profile-tab").forEach(function (btn) {
        btn.onclick = function () {
          setLayout(btn.getAttribute("data-layout-tab"), true);
        };
      });
      document.querySelectorAll(".cb-box-tab").forEach(function (btn) {
        btn.onclick = function () {
          feedTab = btn.getAttribute("data-feed-tab");
          document.querySelectorAll(".cb-box-tab").forEach(function (b) {
            b.classList.toggle("is-active", b === btn);
          });
          renderFeed();
        };
      });

      var avatarBtn = document.getElementById("avatarOpenBtn");
      if (avatarBtn) {
        avatarBtn.onclick = function () {
          if (isOwn) openOwnerCrop("avatar");
          else openMedia(profile.avatar || demoAvatar(viewId), "image");
        };
      }
      var bannerBtn = document.getElementById("bannerOpenBtn");
      if (bannerBtn) {
        bannerBtn.onclick = function () {
          if (isOwn) openOwnerCrop("banner");
          else openMedia(profile.banner || DEFAULT_BANNER, "image");
        };
      }
      var aboutImgBtn = document.getElementById("profileAboutImg");
      if (aboutImgBtn) {
        aboutImgBtn.onclick = function () {
          if (isOwn) openOwnerCrop("about");
          else openMedia(profile.aboutImage || "/img/favicon3.ico", "image");
        };
      }
      var seeAll = document.getElementById("seeAllMedia");
      if (seeAll) {
        seeAll.onclick = function () {
          var items = collectMedia(profile);
          if (!items.length) { alert("No media yet."); return; }
          openMedia(items[0].url, items[0].type === "video" ? "video" : "image", { items: items, index: 0 });
        };
      }

      var shareBtn = document.getElementById("shareToggle");
      var shareMenu = document.getElementById("shareMenu");
      var shareWrap = document.getElementById("shareWrap");
      if (shareMenu && shareWrap && shareMenu.parentElement !== shareWrap) {
        shareWrap.appendChild(shareMenu);
      }
      if (shareBtn && shareMenu) {
        shareMenu.querySelectorAll("[data-share-id]").forEach(function (el) { el.textContent = viewId; });
        shareMenu.style.top = "";
        shareMenu.style.left = "";
        shareMenu.style.zIndex = "4000";
        shareBtn.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          var open = shareMenu.hasAttribute("hidden") || shareMenu.hidden;
          if (open) {
            shareMenu.hidden = false;
            shareMenu.removeAttribute("hidden");
            shareBtn.setAttribute("aria-expanded", "true");
          } else {
            shareMenu.hidden = true;
            shareMenu.setAttribute("hidden", "");
            shareBtn.setAttribute("aria-expanded", "false");
          }
        };
        shareMenu.onclick = function (e) { e.stopPropagation(); };
        shareMenu.querySelectorAll("[data-share]").forEach(function (btn) {
          btn.onclick = function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            var kind = btn.getAttribute("data-share");
            var path = "/users/" + encodeURIComponent(viewId) + (kind === "profile" ? "" : ("/" + kind));
            var url = location.origin + path;
            var done = function () {
              toast("Copied " + path);
              shareMenu.hidden = true;
              shareMenu.setAttribute("hidden", "");
              shareBtn.setAttribute("aria-expanded", "false");
            };
            if (window.CoolbradorPosts && typeof window.CoolbradorPosts.copyText === "function") {
              window.CoolbradorPosts.copyText(url, "Copied " + path);
              shareMenu.hidden = true;
              shareMenu.setAttribute("hidden", "");
              shareBtn.setAttribute("aria-expanded", "false");
              toast("Copied " + path);
              return;
            }
            copyText(url).then(done).catch(function () {
              try {
                var ta = document.createElement("textarea");
                ta.value = url;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                ta.remove();
                done();
              } catch (err) {
                toast("Could not copy link");
              }
            });
          };
        });
        if (!document.documentElement.dataset.cbShareMenuDoc) {
          document.documentElement.dataset.cbShareMenuDoc = "1";
          document.addEventListener("click", function () {
            var m = document.getElementById("shareMenu");
            var b = document.getElementById("shareToggle");
            if (m) { m.hidden = true; m.setAttribute("hidden", ""); }
            if (b) b.setAttribute("aria-expanded", "false");
          });
        }
      }

      var blockBtn = document.getElementById("profileBlockBtn");
      var unblockBtn = document.getElementById("profileUnblockBtn");
      function refreshBlockActions() {
        // Re-paint action row block/unblock label without full profile reload.
        try {
          if (typeof paint === "function") paint();
        } catch (e) {}
      }
      if (blockBtn && window.CoolbradorPosts && window.CoolbradorPosts.setUserBlocked) {
        blockBtn.onclick = function () {
          window.CoolbradorPosts.setUserBlocked(viewId, true);
          toast("Blocked");
          refreshBlockActions();
        };
      }
      if (unblockBtn && window.CoolbradorPosts && window.CoolbradorPosts.setUserBlocked) {
        unblockBtn.onclick = function () {
          window.CoolbradorPosts.setUserBlocked(viewId, false);
          toast("Unblocked");
          refreshBlockActions();
        };
      }

      if (!isOwn) return;
      var editToggle = document.getElementById("editToggle");
      var panel = document.getElementById("editPanel");
      if (editToggle && panel) {
        editToggle.onclick = function () {
          panel.hidden = false;
          fillEditor();
        };
      }
      document.getElementById("editCancel").onclick = function () {
        document.getElementById("editPanel").hidden = true;
      };
      document.getElementById("builderAddSection").onclick = function () {
        var label = prompt("Section label", "New section");
        if (!label) return;
        profile.sections = profile.sections || [];
        profile.sections.push({ id: "sec_" + Date.now().toString(36), label: label, style: "surface" });
        fillEditor();
      };
      document.getElementById("builderReorderHint").onclick = function () {
        alert("Use Up on a section to reorder. Styles use theme tokens like surface and accent. Full Canva builder comes later.");
      };

      document.getElementById("editSave").onclick = function () {
        beginProfileDraft();
        profile.displayName = (document.getElementById("editDisplay").value || "").trim() || profile.displayName;
        profile.bio = (document.getElementById("editBio").value || "").trim();
        profile.about = (document.getElementById("editAbout").value || "").trim();
        commitProfileDraft();
      };
    }

    paint();
    window.addEventListener("resize", moveTabInk);
    requestAnimationFrame(moveTabInk);

    if (window.CoolbradorSession && typeof window.CoolbradorSession.whenAuthReady === "function") {
      window.CoolbradorSession.whenAuthReady(function () {
        var sid = getSessionUserId();
        var nowOwn = isSignedIn() && sid && String(viewId) === String(resolvePublicId(sid));
        if (nowOwn !== isOwn) {
          isOwn = nowOwn;
          currentUserId = sid;
          paint();
        }
      });
    }
  });
})();
