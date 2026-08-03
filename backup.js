(() => {
  "use strict";

  // 备份与主应用的数据分开保存在 IndexedDB：照片不会挤占 localStorage，
  // 发布新版本时也不会覆盖已有资料。仅保留最近 30 份，避免无限占用手机空间。
  const DB_NAME = "leo-emily-local-backups-v1";
  const STORE_NAME = "snapshots";
  const APP_VERSION = "20260803-daily-reminder";
  const MAX_BACKUPS = 30;
  const BOOT_MARKER_KEY = `leo-emily-backup-boot-${APP_VERSION}`;
  const DATA_KEYS = [
    "cute-date-invite-v1",
    "cute-date-invite-archive-v1",
    "cute-date-invite-anniversaries-v1",
    "cute-date-invite-100-things-v1",
    "cute-date-invite-couple-notes-v1",
    "cute-date-invite-future-letters-v1",
    "cute-date-invite-repair-v1",
    "cute-date-invite-shared-messages-v1",
  ];

  let databasePromise = null;
  const recentCaptures = new Map();

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }

  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (error) { return false; }
  }

  function safeRemove(key) {
    try { window.localStorage.removeItem(key); return true; } catch (error) { return false; }
  }

  function randomSuffix() {
    try {
      const bytes = new Uint32Array(1);
      crypto.getRandomValues(bytes);
      return bytes[0].toString(36);
    } catch (error) {
      return Math.random().toString(36).slice(2, 9);
    }
  }

  function createSnapshot(reason = "保存资料前") {
    const data = {};
    DATA_KEYS.forEach((key) => {
      const value = safeGet(key);
      if (typeof value === "string") data[key] = value;
    });
    if (!Object.keys(data).length) return null;
    const createdAt = Date.now();
    return {
      id: `${createdAt}-${randomSuffix()}`,
      createdAt,
      reason: String(reason || "保存资料前").slice(0, 60),
      appVersion: APP_VERSION,
      data,
    };
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    if (!("indexedDB" in window)) return Promise.resolve(null);
    databasePromise = new Promise((resolve) => {
      let request;
      try { request = window.indexedDB.open(DB_NAME, 1); } catch (error) { resolve(null); return; }
      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.objectStoreNames.contains(STORE_NAME)
          ? request.transaction.objectStore(STORE_NAME)
          : database.createObjectStore(STORE_NAME, { keyPath: "id" });
        if (!store.indexNames.contains("createdAt")) store.createIndex("createdAt", "createdAt");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return databasePromise;
  }

  function runTransaction(database, mode, work) {
    return new Promise((resolve) => {
      try {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        work(store, transaction);
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      } catch (error) { resolve(false); }
    });
  }

  async function trimSnapshots(database) {
    if (!database) return false;
    return new Promise((resolve) => {
      try {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const oldSnapshots = (request.result || [])
            .sort((left, right) => Number(right.createdAt) - Number(left.createdAt))
            .slice(MAX_BACKUPS);
          oldSnapshots.forEach((snapshot) => store.delete(snapshot.id));
        };
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => resolve(false);
        transaction.onabort = () => resolve(false);
      } catch (error) { resolve(false); }
    });
  }

  async function capture(reason = "保存资料前") {
    const label = String(reason || "保存资料前").slice(0, 60);
    const now = Date.now();
    // 连续输入文字会多次触发保存；同一种资料在 1.2 秒内只留一份“改动前”快照。
    if (now - Number(recentCaptures.get(label) || 0) < 1200) return false;
    const snapshot = createSnapshot(label);
    if (!snapshot) return false;
    recentCaptures.set(label, now);
    const database = await openDatabase();
    if (!database) return false;
    const saved = await runTransaction(database, "readwrite", (store) => store.put(snapshot));
    if (saved) trimSnapshots(database);
    return saved;
  }

  async function getLatest() {
    const database = await openDatabase();
    if (!database) return null;
    return new Promise((resolve) => {
      try {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => {
          const [latest] = (request.result || []).sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
          resolve(latest || null);
        };
        request.onerror = () => resolve(null);
      } catch (error) { resolve(null); }
    });
  }

  function downloadSnapshot(snapshot) {
    if (!snapshot) return false;
    try {
      const payload = { format: "leo-emily-backup-v1", exportedAt: new Date().toISOString(), snapshot };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Leo-Emily-备份-${new Date(snapshot.createdAt).toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return true;
    } catch (error) { return false; }
  }

  async function downloadLatest() {
    let snapshot = await getLatest();
    if (!snapshot) {
      await capture("手动下载备份");
      snapshot = await getLatest();
    }
    return downloadSnapshot(snapshot);
  }

  async function restoreLatest() {
    const snapshot = await getLatest();
    if (!snapshot?.data || typeof snapshot.data !== "object") return false;
    const readableDate = new Date(snapshot.createdAt).toLocaleString("zh-CN", { hour12: false });
    if (!window.confirm(`恢复 ${readableDate} 的本机备份吗？\n恢复会覆盖当前手机里相同类型的资料，并同步给共享房间中的另一台手机。`)) return false;
    await capture("恢复备份前的当前资料");
    DATA_KEYS.forEach((key) => {
      if (typeof snapshot.data[key] === "string") safeSet(key, snapshot.data[key]);
      else safeRemove(key);
    });
    window.dispatchEvent(new CustomEvent("shared-sync-applied"));
    return true;
  }

  function setBackupStatus(message) {
    const status = document.querySelector("#backup-status");
    if (status) status.textContent = message;
  }

  function bindControls() {
    const downloadButton = document.querySelector("#backup-download");
    const restoreButton = document.querySelector("#backup-restore");
    downloadButton?.addEventListener("click", async () => {
      downloadButton.disabled = true;
      setBackupStatus("正在准备备份文件…");
      const success = await downloadLatest();
      setBackupStatus(success ? "备份已下载到本机。" : "暂时无法生成备份，请稍后再试。 ");
      downloadButton.disabled = false;
    });
    restoreButton?.addEventListener("click", async () => {
      restoreButton.disabled = true;
      const restored = await restoreLatest();
      setBackupStatus(restored ? "已恢复最近备份，并会同步到共享房间。" : "没有恢复资料。 ");
      restoreButton.disabled = false;
    });
  }

  window.DateInviteBackups = { capture, getLatest, downloadLatest, restoreLatest, DATA_KEYS: [...DATA_KEYS] };

  function initialize() {
    bindControls();
    if (!safeGet(BOOT_MARKER_KEY)) {
      // 首次运行新版本时先保存现有数据，给后续升级多留一层保险。
      capture("打开新版本前的本机资料").finally(() => safeSet(BOOT_MARKER_KEY, "1"));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
