/* ==========================================================================
   ZIQWEAR — password guard
   --------------------------------------------------------------------------
   Three jobs:
     1. Keep the admin password as a salted hash, never as plain text.
     2. Lock the admin out after too many wrong passwords.
     3. Keep a record of what happened.

   No email, no codes, no second factor. The policy (how many tries, how long
   the block lasts) is editable in Admin > Security and lives in
   settings.security.
   ========================================================================== */
(function (global) {
  "use strict";

  var KEY = "ziqwear.sec.v1";
  var LOG_MAX = 80;
  var DEFAULTS = { maxFails: 4, lockMinutes: 60 };

  /* Work factor for the password hash. High enough to make an offline guess
     against a stolen localStorage dump expensive, low enough that signing in
     still feels instant. Stored inside the hash string so it can be raised
     later without invalidating existing passwords. */
  var ITER = 6000;

  var memStore = null; // fallback when localStorage is unavailable

  /* ------------------------------------------------------------ sha-256 */
  /* Self-contained so hashing works on file:// and in any browser, with no
     dependency on crypto.subtle (which needs a secure context). */

  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function utf8Bytes(str) {
    var s = String(str), out = [], i, c, c2, cp;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        c2 = s.charCodeAt(++i);
        cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function sha256(str) {
    var bytes = utf8Bytes(str);
    var bitLen = bytes.length * 8;
    var i, t, a, b, c, d, e, f, g, h, s0, s1, S0, S1, ch, maj, t1, t2;
    var w = new Array(64);

    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);

    var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
    bytes.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
             0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

    for (i = 0; i < bytes.length; i += 64) {
      for (t = 0; t < 16; t++) {
        w[t] = (bytes[i + t * 4] << 24) | (bytes[i + t * 4 + 1] << 16) |
               (bytes[i + t * 4 + 2] << 8) | bytes[i + t * 4 + 3];
      }
      for (t = 16; t < 64; t++) {
        s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      a = H[0]; b = H[1]; c = H[2]; d = H[3];
      e = H[4]; f = H[5]; g = H[6]; h = H[7];

      for (t = 0; t < 64; t++) {
        S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        ch = (e & f) ^ (~e & g);
        t1 = (h + S1 + ch + K[t] + w[t]) | 0;
        S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }

    var out = "";
    for (i = 0; i < 8; i++) out += ("00000000" + (H[i] >>> 0).toString(16)).slice(-8);
    return out;
  }

  /* -------------------------------------------------- password hashing */

  function randomSalt() {
    var chars = "0123456789abcdef", out = "", i, buf;
    try {
      buf = new Uint8Array(16);
      global.crypto.getRandomValues(buf);
      for (i = 0; i < 16; i++) out += chars[buf[i] & 15];
      return out;
    } catch (e) {
      for (i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * 16)];
      return out;
    }
  }

  function stretch(pw, salt, iter) {
    var h = sha256(salt + "\u0001" + pw);
    for (var i = 0; i < iter; i++) h = sha256(h + salt);
    return h;
  }

  /* Constant-time string compare — stops an attacker from learning how much of
     the hash they guessed correctly by timing the response. */
  function same(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* Returns "sha256$<iterations>$<salt>$<hex>" — self-describing, so the work
     factor can be raised later without breaking existing passwords. */
  function makeHash(pw) {
    var salt = randomSalt();
    return "sha256$" + ITER + "$" + salt + "$" + stretch(String(pw), salt, ITER);
  }

  function isHash(v) {
    return /^sha256\$\d+\$[0-9a-f]{8,}\$[0-9a-f]{64}$/.test(String(v || ""));
  }

  function verifyPw(pw, stored) {
    if (!isHash(stored)) return false;
    var p = String(stored).split("$");
    var iter = parseInt(p[1], 10);
    if (!(iter >= 1 && iter <= 500000)) return false;
    return same(stretch(String(pw), p[2], iter), p[3]);
  }

  /* ---------------------------------------------------------------- storage */

  function blank() {
    return { login: { fails: 0, lockedUntil: 0 }, log: [] };
  }

  function read() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (!o.login) o.login = { fails: 0, lockedUntil: 0 };
        if (!Array.isArray(o.log)) o.log = [];
        return o;
      }
    } catch (e) { /* fall through */ }
    return memStore || (memStore = blank());
  }

  function write(o) {
    memStore = o;
    try { global.localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* quota / private mode */ }
  }

  /* ----------------------------------------------------------------- policy */

  function policy() {
    var s = (global.Store && global.Store.db && global.Store.db.settings) || {};
    var p = s.security || {};
    var max = parseInt(p.maxFails, 10);
    var mins = parseInt(p.lockMinutes, 10);
    if (!(max >= 1 && max <= 20)) max = DEFAULTS.maxFails;
    if (!(mins >= 1 && mins <= 1440)) mins = DEFAULTS.lockMinutes;
    return { maxFails: max, lockMinutes: mins, lockMs: mins * 60000 };
  }

  /* ------------------------------------------------------------- audit log */

  function audit(kind, note) {
    var db = read();
    db.log.unshift({ t: Date.now(), kind: kind, note: note || "" });
    if (db.log.length > LOG_MAX) db.log.length = LOG_MAX;
    write(db);
  }

  /* ------------------------------------------------------- login lockout */

  function lockRemaining() {
    var left = (read().login.lockedUntil || 0) - Date.now();
    return left > 0 ? left : 0;
  }

  function failsLeft() {
    if (lockRemaining()) return 0;
    return Math.max(0, policy().maxFails - (read().login.fails || 0));
  }

  function recordFail() {
    var db = read();
    var p = policy();
    db.login.fails = (db.login.fails || 0) + 1;

    if (db.login.fails >= p.maxFails) {
      db.login.lockedUntil = Date.now() + p.lockMs;
      db.login.fails = 0;
      audit("lockout", "Admin locked for " + p.lockMinutes + " minutes after " +
        p.maxFails + " wrong passwords.");
      write(db);
      return { locked: true, remaining: p.lockMs, failsLeft: 0 };
    }

    audit("login-fail", "Wrong admin password (" + db.login.fails + " of " + p.maxFails + ").");
    write(db);
    return { locked: false, remaining: 0, failsLeft: failsLeft() };
  }

  function recordSuccess() {
    var db = read();
    db.login.fails = 0;
    db.login.lockedUntil = 0;
    write(db);
    audit("login-ok", "Admin signed in.");
  }

  function unlock() {
    var db = read();
    db.login.fails = 0;
    db.login.lockedUntil = 0;
    write(db);
    audit("unlock", "Lockout cleared manually.");
  }

  function reset() {
    write(blank());
  }

  function log() { return read().log || []; }

  /* ------------------------------------------------ clickjacking guard */
  /* `frame-ancestors` is ignored when a CSP arrives via <meta>, so fall back
     to the classic frame-buster — on the admin page only. The storefront is
     deliberately left framable so previews and embeds still work. */
  function bustFrame() {
    var body = global.document && global.document.body;
    if (!body || !/(^|\s)adm-body(\s|$)/.test(body.className || "")) return;
    try {
      if (global.top && global.top !== global.self) {
        global.top.location = global.self.location.href;
      }
    } catch (e) { /* cross-origin parent — nothing more we can do from here */ }
  }

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", bustFrame);
  } else {
    bustFrame();
  }

  global.Sec = {
    DEFAULTS: DEFAULTS,
    sha256: sha256,
    makeHash: makeHash,
    verifyPw: verifyPw,
    isHash: isHash,
    policy: policy,
    lockRemaining: lockRemaining,
    failsLeft: failsLeft,
    recordFail: recordFail,
    recordSuccess: recordSuccess,
    unlock: unlock,
    audit: audit,
    log: log,
    reset: reset
  };
})(window);
