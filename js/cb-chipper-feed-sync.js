/* Coolbrador Chipper feed sync — derive feed from BeeSid LS posts and
 * debounced-push to Firestore chipper/feed (write store for future
 * coolbrador.com Cloud Function). Chipper must GET coolbrador.com
 * /data/chipper_game_board_feed.json (or chipper-miiverse.json) only —
 * never Firestore. Static hosting is current until Blaze Functions.
 */
(function (global) {
  "use strict";

  var BEE_KEYS = ["posts_/b/BeeSid", "posts_/b/beesid", "posts_/b/BEESID", "posts_/b/Beesid"];
  var MIRROR_KEY = "chipper_game_board_feed_mirror";
  var BOARD_MIRROR_KEY = "cb_boards_BeeSid_mirror";
  var SITE = "https://coolbrador.com";
  var FS_BASE = "https://firestore.googleapis.com/v1/projects/coolbrador/databases/(default)/documents/chipper";
  var FS_KEY = "AIzaSyDcxFPQU10CvAR8aEas54DEo7foxynsaeM";
  var DEBOUNCE_MS = 900;
  var _timer = null;
  var _inflight = null;
  var _lastPushAt = 0;
  var _lastError = null;

  var SENSITIVITY = {
    webDefault: "show",
    chipperDefault: "hide",
    adultHiddenByDefault: true,
    pornHardBlocked: true,
    note: "Illegal/porn media hard-blocked sitewide. 18+ hidden by default. Sensitive speech: web SHOW, Chipper HIDE. Seed posts are funny/clean only."
  };

  function yeahCount(p) {
    if (!p) return 0;
    if (Array.isArray(p.yeahs)) return p.yeahs.length;
    var n = Number(p.yeahs);
    return isFinite(n) && n >= 0 ? n : 0;
  }

  function viewCount(p) {
    var n = Number(p && p.views);
    return isFinite(n) && n >= 0 ? n : 0;
  }

  function absUrl(url) {
    var s = String(url || "").trim();
    if (!s) return "";
    if (s.indexOf("data:") === 0 || s.indexOf("blob:") === 0) return s;
    if (s.indexOf("//") === 0) return "https:" + s;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.charAt(0) === "/") return SITE + s;
    return SITE + "/" + s.replace(/^\.\//, "");
  }

  function mediaList(p) {
    var m = p && p.media;
    if (!m) {
      if (p && (p.mediaUrl || p.image)) {
        return [{ url: absUrl(p.mediaUrl || p.image), type: "image" }];
      }
      return [];
    }
    if (Array.isArray(m)) {
      return m.map(function (item) {
        if (!item) return null;
        if (typeof item === "string") return { url: absUrl(item), type: "image" };
        if (item.url) return { url: absUrl(item.url), type: item.type || "image" };
        return null;
      }).filter(Boolean);
    }
    if (m && m.url) return [{ url: absUrl(m.url), type: m.type || "image" }];
    if (typeof m === "string") return [{ url: absUrl(m), type: "image" }];
    return [];
  }

  function chronoSort(posts) {
    return (posts || []).slice().sort(function (a, b) {
      var ta = Date.parse((a && a.timestamp) || "") || Number(a && a.id) || 0;
      var tb = Date.parse((b && b.timestamp) || "") || Number(b && b.id) || 0;
      if (ta !== tb) return ta - tb;
      return (Number(a && a.id) || 0) - (Number(b && b.id) || 0);
    });
  }

  function readBeePosts() {
    var best = [];
    var bestKey = BEE_KEYS[0];
    for (var i = 0; i < BEE_KEYS.length; i++) {
      try {
        var raw = localStorage.getItem(BEE_KEYS[i]);
        if (!raw) continue;
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length >= best.length) {
          best = arr;
          bestKey = BEE_KEYS[i];
        }
      } catch (e) {}
    }
    return { posts: best, key: bestKey };
  }

  function boardVersionHint(posts) {
    try {
      var raw = localStorage.getItem("boardmeta_/b/BeeSid");
      if (raw) {
        var meta = JSON.parse(raw);
        if (meta && meta.version != null && isFinite(Number(meta.version))) {
          return Number(meta.version);
        }
      }
    } catch (e) {}
    try {
      if (localStorage.getItem("cb_beesid_miiverse_v5") === "1") return 5;
    } catch (e2) {}
    return Math.max(1, (posts && posts.length) ? 5 : 1);
  }

  function buildFeedFromPosts(posts, boardVersion) {
    var chrono = chronoSort(posts);
    var out = [];
    for (var i = 0; i < chrono.length; i++) {
      var p = chrono[i];
      var n = i + 1;
      var yc = yeahCount(p);
      var author = (p && (p.username || p.displayName)) || "unknown";
      var handle = String((p && p.handle) || author).replace(/^@/, "").toLowerCase();
      var display = (p && p.displayName) || author;
      var cgId = "cg-" + (n < 10 ? "0" + n : String(n));
      out.push({
        id: cgId,
        author: author,
        display_name: display,
        handle: handle,
        username: handle,
        avatar_url: absUrl((p && p.avatar_url) || ""),
        feeling: (p && p.feeling) || "happy",
        body: p && p.text != null ? String(p.text) : String((p && p.body) || ""),
        media: mediaList(p),
        likes: yc,
        yeahs: yc,
        views: viewCount(p),
        url: SITE + "/b/BeeSid/post/" + n + "/comments/",
        sensitive: !!(p && p.sensitive),
        contentWarnings: Array.isArray(p && p.contentWarnings) ? p.contentWarnings : [],
        boardPostId: String((p && p.id) || ""),
        timestamp: p && p.timestamp
      });
    }
    out.reverse();
    var ver = boardVersion != null ? Number(boardVersion) : boardVersionHint(posts);
    if (!isFinite(ver)) ver = 1;
    return {
      board: "chipper-game-board",
      version: ver,
      meta: {
        source: "derived-from-boards/BeeSid.json",
        derivedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        boardVersion: ver,
        note: "yeahs/likes = len(board.yeahs); views = board.views. Do not hardcode.",
        mirror: true,
        autoPush: true
      },
      sensitivity: SENSITIVITY,
      posts: out
    };
  }

  function buildBoardDoc(posts, boardVersion) {
    var ver = boardVersion != null ? Number(boardVersion) : boardVersionHint(posts);
    if (!isFinite(ver)) ver = 1;
    return {
      board: "BeeSid",
      version: ver,
      meta: {
        source: "auto-push-beesid-save",
        note: "Chipper Game Board posts. Feed yeahs/likes/views are derived from this file.",
        gameBoard: true,
        gameBoardLabel: "Chipper Game Board"
      },
      posts: chronoSort(posts).map(function (p) {
        var media = p.media || null;
        if (media && media.url) {
          media = { url: absUrl(media.url), type: media.type || "image" };
        } else if (!media && (p.mediaUrl || p.image)) {
          media = { url: absUrl(p.mediaUrl || p.image), type: "image" };
        }
        return {
          id: String(p.id),
          username: p.username,
          displayName: p.displayName || p.username,
          userId: p.userId != null ? String(p.userId) : "",
          text: p.text != null ? p.text : (p.body || ""),
          body: p.body != null ? p.body : (p.text || ""),
          media: media,
          timestamp: p.timestamp,
          yeahs: Array.isArray(p.yeahs) ? p.yeahs.map(String) : [],
          replies: Array.isArray(p.replies) ? p.replies : [],
          views: viewCount(p),
          avatar_url: absUrl(p.avatar_url || ""),
          handle: p.handle || "",
          feeling: p.feeling || "happy",
          tags: p.tags || [],
          pinned: !!p.pinned,
          isGameBoardNote: !!p.isGameBoardNote,
          boardNote: !!p.boardNote
        };
      })
    };
  }

  function firestorePatchOrCreate(docId, body) {
    var fieldPaths = Object.keys(body.fields || {});
    var mask = fieldPaths.map(function (f) {
      return "&updateMask.fieldPaths=" + encodeURIComponent(f);
    }).join("");
    var url = FS_BASE + "/" + encodeURIComponent(docId) + "?key=" + encodeURIComponent(FS_KEY) + mask;
    return fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    }).then(function (r) {
      if (r.ok) return r.json();
      if (r.status === 404) {
        var createUrl = FS_BASE + "?documentId=" + encodeURIComponent(docId) + "&key=" + encodeURIComponent(FS_KEY);
        return fetch(createUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store"
        }).then(function (r2) {
          if (!r2.ok) throw new Error("HTTP " + r2.status);
          return r2.json();
        });
      }
      return r.text().then(function (txt) {
        throw new Error("HTTP " + r.status + " " + String(txt || "").slice(0, 160));
      });
    });
  }

  function pushToFirestore(feed, boardDoc) {
    var nowIso = new Date().toISOString();
    feed = feed || {};
    feed.meta = Object.assign({}, feed.meta || {}, {
      publishedAt: nowIso,
      source: "auto-push-beesid-save",
      replaced: true
    });
    var body = {
      fields: {
        payload: { stringValue: JSON.stringify(feed) },
        board: { stringValue: JSON.stringify(boardDoc || {}) },
        updatedAt: { timestampValue: nowIso },
        postCount: { integerValue: String((feed.posts || []).length) },
        boardName: { stringValue: "BeeSid" }
      }
    };
    return firestorePatchOrCreate("feed", body).then(function (doc) {
      _lastPushAt = Date.now();
      _lastError = null;
      try {
        global.dispatchEvent(new CustomEvent("cb-chipper-feed-pushed", {
          detail: { postCount: (feed.posts || []).length, at: nowIso }
        }));
      } catch (e) {}
      return doc;
    }).catch(function (err) {
      _lastError = err;
      throw err;
    });
  }

  function mirrorFromBoard(opts) {
    opts = opts || {};
    var packed = readBeePosts();
    var posts = packed.posts;
    if (!posts.length && !opts.allowEmpty) return null;
    var feed = buildFeedFromPosts(posts);
    var boardDoc = buildBoardDoc(posts, feed.meta && feed.meta.boardVersion);
    try {
      localStorage.setItem(MIRROR_KEY, JSON.stringify(feed));
      localStorage.setItem(BOARD_MIRROR_KEY, JSON.stringify(boardDoc));
    } catch (e) {}
    // Anonymous visitors used to push their whole local board to the shared
    // chipper/feed doc here (last writer wins). Publishing is now an explicit,
    // authenticated moderator action; only an opts.immediate caller pushes.
    if (opts.immediate) schedulePush(0);
    return feed;
  }

  function schedulePush(delayMs) {
    if (_timer) {
      try { clearTimeout(_timer); } catch (e) {}
      _timer = null;
    }
    var wait = delayMs == null ? DEBOUNCE_MS : delayMs;
    _timer = setTimeout(function () {
      _timer = null;
      pushLiveNow();
    }, Math.max(0, wait));
  }

  function pushLiveNow() {
    var packed = readBeePosts();
    var posts = packed.posts;
    if (!posts.length) {
      return Promise.resolve({ skipped: true, reason: "no-posts" });
    }
    var feed = buildFeedFromPosts(posts);
    var boardDoc = buildBoardDoc(posts, feed.meta && feed.meta.boardVersion);
    try {
      localStorage.setItem(MIRROR_KEY, JSON.stringify(feed));
      localStorage.setItem(BOARD_MIRROR_KEY, JSON.stringify(boardDoc));
    } catch (e) {}
    if (_inflight) {
      return _inflight.then(function () { return pushToFirestore(feed, boardDoc); });
    }
    _inflight = pushToFirestore(feed, boardDoc).then(function (doc) {
      _inflight = null;
      return { ok: true, postCount: (feed.posts || []).length, doc: doc };
    }, function (err) {
      _inflight = null;
      try { console.warn("[cb-chipper-feed-sync] push failed", err); } catch (e2) {}
      return { ok: false, error: err };
    });
    return _inflight;
  }

  function onBeeSidWrite(boardHint) {
    var b = String(boardHint || "");
    if (b && !/BeeSid/i.test(b) && !/posts_\/b\/BeeSid/i.test(b)) return;
    mirrorFromBoard();
  }

  global.CoolbradorChipperFeed = {
    mirrorFromBoard: mirrorFromBoard,
    buildFeedFromPosts: buildFeedFromPosts,
    buildBoardDoc: buildBoardDoc,
    pushLiveNow: pushLiveNow,
    schedulePush: schedulePush,
    onBeeSidWrite: onBeeSidWrite,
    yeahCount: yeahCount,
    viewCount: viewCount,
    FS_DOC_URL: FS_BASE + "/feed",
    getLastPushAt: function () { return _lastPushAt; },
    getLastError: function () { return _lastError; }
  };
})(typeof window !== "undefined" ? window : this);
