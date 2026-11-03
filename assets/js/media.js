/* ===================================================================
   media.js — video clips picked in the admin, kept out of localStorage.

   A 20 MB clip cannot live in the settings blob: localStorage holds the whole
   store in one key and browsers cap it at roughly 5 MB, so saving a video there
   would destroy the products, orders and content along with it. IndexedDB has no
   such practical limit and stores the file as a Blob, so the settings keep only a
   short reference ("ziqmedia:<id>") and the clip is turned back into a blob: URL
   whenever a page wants to play it.
   =================================================================== */
(function (global) {
  "use strict";

  var DB_NAME = "ziqwear-media";
  var STORE = "files";
  var PREFIX = "ziqmedia:";
  var MAX_BYTES = 80 * 1024 * 1024;

  var urls = {};    // ref -> blob: URL, so one clip is not revoked while still shown
  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error("IndexedDB is not available in this browser")); return; }
      var req = global.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "ref" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("Could not open the media store")); };
      req.onblocked = function () { reject(new Error("Close the other admin tab and try again")); };
    });
    return dbPromise;
  }

  function tx(db, mode, fn) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(STORE, mode);
      var req = fn(t.objectStore(STORE));
      t.oncomplete = function () {
        // A read request only carries its record once the transaction is done.
        resolve(req && typeof req === "object" && "result" in req ? req.result : req);
      };
      t.onerror = function () { reject(t.error || new Error("Media store write failed")); };
      t.onabort = function () { reject(t.error || new Error("Media store write aborted")); };
    });
  }

  function isRef(value) {
    return String(value || "").indexOf(PREFIX) === 0;
  }

  function newRef() {
    var rand = "";
    try {
      var buf = new Uint8Array(8);
      global.crypto.getRandomValues(buf);
      for (var i = 0; i < buf.length; i++) rand += buf[i].toString(16).padStart(2, "0");
    } catch (e) {
      rand = Math.random().toString(16).slice(2, 18);
    }
    return PREFIX + Date.now().toString(36) + "-" + rand;
  }

  /* Puts a File in the store and hands back the reference to save in settings. */
  function put(file, cb) {
    cb = cb || function () {};
    if (!file) { cb(null, new Error("Choose a video file first")); return; }
    if (file.size > MAX_BYTES) {
      cb(null, new Error("That clip is " + Math.round(file.size / 1048576) +
        " MB — the limit is " + Math.round(MAX_BYTES / 1048576) + " MB"));
      return;
    }
    var ref = newRef();
    openDb().then(function (db) {
      return tx(db, "readwrite", function (store) {
        store.put({ ref: ref, name: file.name || "clip", type: file.type || "video/mp4",
          size: file.size, addedAt: Date.now(), blob: file });
        return ref;
      });
    }).then(function (saved) { cb(saved, null); }, function (err) { cb(null, err); });
  }

  /* Resolves a reference to something a <video src> can use. Plain paths and links
     are handed straight back, so the same field accepts both. */
  function url(value, cb) {
    cb = cb || function () {};
    var v = String(value || "").trim();
    if (!v) { cb(""); return; }
    if (!isRef(v)) { cb(v); return; }
    if (urls[v]) { cb(urls[v]); return; }
    openDb().then(function (db) {
      return tx(db, "readonly", function (store) { return store.get(v); });
    }).then(function (rec) {
      if (!rec || !rec.blob) { cb(""); return; }
      try { urls[v] = global.URL.createObjectURL(rec.blob); } catch (e) { urls[v] = ""; }
      cb(urls[v]);
    }, function () { cb(""); });
  }

  function remove(ref, cb) {
    cb = cb || function () {};
    if (!isRef(ref)) { cb(); return; }
    if (urls[ref]) {
      try { global.URL.revokeObjectURL(urls[ref]); } catch (e) {}
      delete urls[ref];
    }
    openDb().then(function (db) {
      return tx(db, "readwrite", function (store) { store.delete(ref); });
    }).then(function () { cb(); }, function () { cb(); });
  }

  /* Not `Media` — browsers already ship a native Media constructor on window. */
  global.ZiqMedia = { isRef: isRef, put: put, url: url, remove: remove, MAX_BYTES: MAX_BYTES };
})(window);
