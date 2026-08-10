(() => {
  "use strict";

  /*
   * Leo And Emily 的云端共同空间。
   * 资料始终先写进本机；联网后才自动加密上传。首次只需要把“邀请她加入”链接发一次，
   * 之后两台手机都会记住同一个空间，不必重复输入房间码。
   */
  const CONFIG = window.LEO_EMILY_CLOUD_CONFIG;
  const SDK = window.cloudbase;
  const STATE_KEY = "leo-emily-cloud-sync-state-v2";
  const DEVICE_KEY = "leo-emily-cloud-device-v1";
  const PAIRING_KEY = "leo-emily-cloud-pairing-v2";
  // ===== 身份固定：昵称属于设备，角色属于首次配对 =====
  const IDENTITY_KEY = "leo-emily-cloud-identity-v1";
  const CLOUD_EVENT = "date-invite-cloud-status";
  const CLOUD_APPLIED_EVENT = "date-invite-cloud-sync-applied";
  const CHAT_EVENT = "date-invite-chat-changed";
  const IDENTITY_EVENT = "date-invite-identity-changed";
  const INLINE_LIMIT = 155000;
  const POLL_INTERVAL = 7000;
  const PRESENCE_INTERVAL = 24000;
  const PRESENCE_WINDOW = 75000;
  const TOMBSTONE_LIMIT = 500;
  const SYNC_KEYS = [
    "cute-date-invite-v1",
    "cute-date-invite-archive-v1",
    "cute-date-invite-anniversaries-v1",
    "cute-date-invite-100-things-v1",
    "cute-date-invite-couple-notes-v1",
    "cute-date-invite-future-letters-v1",
    "cute-date-invite-repair-v1",
    "cute-date-invite-cat-v1",
    "cute-date-invite-home-settings-v1",
    "cute-date-invite-shared-messages-v1",
    "cute-date-invite-polaroids-v1",
    "cute-date-invite-voice-postcards-v1",
    "cute-date-invite-mind-matches-v1",
    "cute-date-invite-message-wall-v1",
    "cute-date-invite-world-posts-v1"
  ];
  const SYNC_KEY_SET = new Set(SYNC_KEYS);
  const encoder = typeof TextEncoder === "function" ? new TextEncoder() : null;
  const decoder = typeof TextDecoder === "function" ? new TextDecoder() : null;

  const safeGet = (key) => {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  };
  const safeSet = (key, value) => {
    try { window.localStorage.setItem(key, value); return true; } catch (error) { return false; }
  };
  const safeRemove = (key) => {
    try { window.localStorage.removeItem(key); return true; } catch (error) { return false; }
  };
  const parseJSON = (raw, fallback) => {
    try { return JSON.parse(raw); } catch (error) { return fallback; }
  };
  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return value; }
  };
  const now = () => Date.now();

  function randomId(bytes = 18) {
    try {
      const values = new Uint8Array(bytes);
      crypto.getRandomValues(values);
      return bytesToBase64Url(values);
    } catch (error) {
      return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 18)}`;
    }
  }

  function bytesToBase64Url(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunk, bytes.length)));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(value) {
    const text = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = text + "=".repeat((4 - text.length % 4) % 4);
    const binary = atob(padded);
    const values = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) values[index] = binary.charCodeAt(index);
    return values;
  }

  function validPairing(value) {
    if (!value || typeof value !== "object") return null;
    const roomId = String(value.roomId || "");
    const secret = String(value.secret || "");
    if (!/^[A-Za-z0-9_-]{16,96}$/.test(roomId) || !/^[A-Za-z0-9_-]{32,96}$/.test(secret)) return null;
    return {
      version: 2,
      roomId,
      secret,
      role: value.role === "guest" ? "guest" : "host",
      createdAt: Number(value.createdAt) || now()
    };
  }

  function readPairing() {
    return validPairing(parseJSON(safeGet(PAIRING_KEY) || "null", null));
  }

  function writePairing(value) {
    const pairingValue = validPairing(value);
    if (!pairingValue || !safeSet(PAIRING_KEY, JSON.stringify(pairingValue))) return null;
    return pairingValue;
  }

  function makePairing(role = "host") {
    return validPairing({
      roomId: randomId(18),
      secret: randomId(32),
      role,
      createdAt: now()
    });
  }

  function incomingPairing() {
    try {
      const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
      const encoded = hash.get("leopair");
      if (!encoded) return null;
      const bytes = base64UrlToBytes(encoded);
      const raw = decoder ? decoder.decode(bytes) : decodeURIComponent(escape(String.fromCharCode(...bytes)));
      const parsed = validPairing(parseJSON(raw, null));
      if (!parsed) return null;
      return { ...parsed, role: "guest" };
    } catch (error) {
      return null;
    }
  }

  function removePairingHash() {
    try {
      const url = new URL(location.href);
      if (!url.hash.includes("leopair=")) return;
      url.hash = "";
      history.replaceState(history.state, document.title, url.pathname + url.search);
    } catch (error) { /* The hash is harmless when history is unavailable. */ }
  }

  let pairing = null;
  function ensurePairing() {
    const invited = incomingPairing();
    const existing = readPairing();
    // Reopening the same invitation on the host phone must not rewrite the
    // saved host role into guest. A role is assigned only when joining a room.
    if (invited && existing && existing.roomId === invited.roomId) {
      pairing = existing;
      removePairingHash();
      return pairing;
    }
    if (invited && !existing) {
      pairing = writePairing(invited) || invited;
      removePairingHash();
      return pairing;
    }
    if (invited && existing && existing.roomId !== invited.roomId) {
      const shouldSwitch = typeof window.confirm !== "function" || window.confirm("要加入这一个新的两人空间吗？当前手机已保存的共同空间不会被删除。");
      if (shouldSwitch) {
        pairing = writePairing(invited) || invited;
        removePairingHash();
        return pairing;
      }
      removePairingHash();
    }
    pairing = existing || writePairing(makePairing("host"));
    return pairing;
  }

  function invitationLink() {
    const current = pairing || ensurePairing();
    if (!current || !encoder) return "";
    try {
      const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ version: 2, roomId: current.roomId, secret: current.secret })));
      const url = new URL(location.href);
      url.hash = `leopair=${payload}`;
      return url.toString();
    } catch (error) { return ""; }
  }

  function readDeviceId() {
    const saved = String(safeGet(DEVICE_KEY) || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
    if (saved.length >= 12) return saved;
    const next = randomId(18);
    safeSet(DEVICE_KEY, next);
    return next;
  }

  function normalizeState(value) {
    const candidate = value && typeof value === "object" ? value : {};
    return {
      version: 2,
      keys: candidate.keys && typeof candidate.keys === "object" ? candidate.keys : {},
      documents: candidate.documents && typeof candidate.documents === "object" ? candidate.documents : {},
      seen: candidate.seen && typeof candidate.seen === "object" ? candidate.seen : {},
      itemIds: candidate.itemIds && typeof candidate.itemIds === "object" ? candidate.itemIds : {},
      tombstones: candidate.tombstones && typeof candidate.tombstones === "object" ? candidate.tombstones : {}
    };
  }

  function readState() {
    return normalizeState(parseJSON(safeGet(STATE_KEY) || "null", null));
  }

  let localState = readState();
  const deviceId = readDeviceId();
  let app = null;
  let db = null;
  let storage = null;
  let collection = null;
  let encryptionKey = null;
  let ready = false;
  let applyingRemote = false;
  let flushing = false;
  let pulling = false;
  let initializing = false;
  let flushTimer = null;
  let presenceTimer = null;
  let pollTimer = null;
  let retryTimer = null;
  let recoveryEventsBound = false;
  let presence = [];
  let identity = null;
  let identityControlsBound = false;
  const roomProfiles = { host: null, guest: null };
  let lastCloudContactAt = 0;
  let controlsBound = false;
  const pendingKeys = new Set();
  // 实时心有灵犀只在内存/短暂云文档中传输，不进入可合并的共享快照。
  const realtimeListeners = new Set();
  const realtimeSeen = new Set();
  const REALTIME_PACKET_MAX = 12000;
  const REALTIME_PACKET_TTL = 120000;
  let currentStatus = {
    ready: false,
    online: false,
    message: "正在准备你们的云端空间…",
    kind: "connecting",
    updatedAt: now()
  };

  function persistState() {
    safeSet(STATE_KEY, JSON.stringify(localState));
  }

  function currentRole() {
    return pairing?.role === "guest" ? "guest" : "host";
  }

  function cleanDisplayName(value) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 18);
  }

  function normalizeIdentity(value) {
    if (!value || typeof value !== "object") return null;
    const roomId = String(value.roomId || "");
    const ownerDeviceId = String(value.deviceId || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
    if (!/^[A-Za-z0-9_-]{16,96}$/.test(roomId) || ownerDeviceId.length < 12) return null;
    return {
      version: 1,
      roomId,
      deviceId: ownerDeviceId,
      role: value.role === "guest" ? "guest" : "host",
      name: cleanDisplayName(value.name),
      createdAt: Number(value.createdAt) || now(),
      updatedAt: Number(value.updatedAt) || now()
    };
  }

  function readIdentity() {
    return normalizeIdentity(parseJSON(safeGet(IDENTITY_KEY) || "null", null));
  }

  function persistIdentity(next) {
    const normalized = normalizeIdentity(next);
    if (!normalized || !safeSet(IDENTITY_KEY, JSON.stringify(normalized))) return null;
    identity = normalized;
    return identity;
  }

  // A device keeps its nickname when it deliberately joins another room,
  // but the host/guest side always comes from the saved pairing.
  function ensureIdentity() {
    const room = pairing || ensurePairing();
    if (!room) return null;
    if (roomProfiles.host?.roomId !== room.roomId) roomProfiles.host = null;
    if (roomProfiles.guest?.roomId !== room.roomId) roomProfiles.guest = null;
    const saved = identity || readIdentity();
    const sameBinding = saved
      && saved.deviceId === deviceId
      && saved.roomId === room.roomId
      && saved.role === currentRole();
    if (sameBinding) {
      identity = saved;
      return identity;
    }
    return persistIdentity({
      version: 1,
      roomId: room.roomId,
      deviceId,
      role: currentRole(),
      name: saved?.deviceId === deviceId ? saved.name : "",
      createdAt: saved?.deviceId === deviceId ? saved.createdAt : now(),
      updatedAt: now()
    });
  }

  function publicIdentity(profile) {
    const safe = normalizeIdentity(profile);
    if (!safe) return null;
    return {
      roomId: safe.roomId,
      deviceId: safe.deviceId,
      role: safe.role,
      name: safe.name,
      createdAt: safe.createdAt,
      updatedAt: safe.updatedAt
    };
  }

  function identitySnapshot() {
    const mine = ensureIdentity();
    return {
      me: publicIdentity(mine),
      profiles: {
        host: publicIdentity(roomProfiles.host),
        guest: publicIdentity(roomProfiles.guest)
      }
    };
  }

  function emitIdentityChange() {
    window.dispatchEvent(new CustomEvent(IDENTITY_EVENT, { detail: clone(identitySnapshot()) }));
  }

  function displayNameForRole(role) {
    const side = role === "guest" ? "guest" : "host";
    const mine = ensureIdentity();
    if (mine?.role === side && mine.name) return mine.name;
    const profile = roomProfiles[side];
    if (profile?.name) return profile.name;
    return mine?.role === side ? "我" : "对方";
  }

  function identityDocumentId(role = currentRole()) {
    const room = pairing || ensurePairing();
    return `profile_${String(room?.roomId || "unknown").slice(0, 96)}_${role === "guest" ? "guest" : "host"}`;
  }

  function identityConflict(profile) {
    const other = roomProfiles[profile?.role === "guest" ? "guest" : "host"];
    return Boolean(other && other.deviceId && other.deviceId !== deviceId && other.roomId === profile.roomId);
  }

  async function publishIdentity() {
    const mine = ensureIdentity();
    if (!mine?.name || !ready || !collection || !navigator.onLine) return { ok: false, pending: true };
    if (identityConflict(mine)) return { ok: false, conflict: true };
    try {
      const payload = await encryptText(JSON.stringify(publicIdentity(mine)));
      resultData(await collection.doc(identityDocumentId(mine.role)).set({
        roomId: mine.roomId,
        type: "identity",
        role: mine.role,
        deviceId,
        createdAt: mine.createdAt,
        updatedAt: mine.updatedAt,
        payload,
        encrypted: true,
        schemaVersion: CONFIG?.version || 2
      }), "身份保存失败");
      roomProfiles[mine.role] = publicIdentity(mine);
      emitIdentityChange();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || "身份暂时没有同步到云端" };
    }
  }

  async function saveDisplayName(value) {
    const name = cleanDisplayName(value);
    if (!name) return { ok: false, error: "请先写下你的名字" };
    const mine = ensureIdentity();
    if (!mine) return { ok: false, error: "正在准备你的双人空间，请稍后再试" };
    const saved = persistIdentity({ ...mine, name, updatedAt: now() });
    if (!saved) return { ok: false, error: "这台设备暂时无法保存名字" };
    const roleConflict = identityConflict(saved);
    if (!roleConflict) roomProfiles[saved.role] = publicIdentity(saved);
    emitIdentityChange();
    const published = roleConflict ? { ok: false, conflict: true } : await publishIdentity();
    return { ok: true, pending: !published.ok && !published.conflict, conflict: Boolean(published.conflict), identity: publicIdentity(saved) };
  }

  // 仅供旧版本曾把 host/guest 写反时使用。不会创建新房间，也不会清除任何
  // 共同资料；只是重新把这台手机绑定回正确的一侧。
  async function rebindIdentityRole(value) {
    const role = value === "guest" ? "guest" : "host";
    const room = pairing || ensurePairing();
    if (!room) return { ok: false, error: "共同空间还没有准备好，请稍后再试。" };
    if (ready && navigator.onLine) await pullRemote();
    const occupied = roomProfiles[role];
    if (occupied?.deviceId && occupied.deviceId !== deviceId) {
      return { ok: false, error: "这个身份正在被另一台手机使用，请在另一台手机选择正确身份。" };
    }
    const updated = writePairing({ ...room, role });
    if (!updated) return { ok: false, error: "这台手机暂时无法重新绑定身份。" };
    pairing = updated;
    encryptionKey = null;
    identity = null;
    roomProfiles.host = null;
    roomProfiles.guest = null;
    const rebound = ensureIdentity();
    if (!rebound) return { ok: false, error: "身份重新绑定失败，请再试一次。" };
    emitIdentityChange();
    const published = await publishIdentity();
    await writePresence();
    return { ok: true, pending: !published.ok, identity: publicIdentity(rebound) };
  }

  function updateStatus(message, kind) {
    const online = presence.some((item) => item.deviceId !== deviceId && now() - Number(item.updatedAt || 0) < PRESENCE_WINDOW);
    currentStatus = {
      ready,
      online,
      message: String(message || currentStatus.message || ""),
      kind: kind || currentStatus.kind || "connecting",
      updatedAt: now()
    };
    document.documentElement.classList.toggle("has-cloud-sync", ready);
    const statusNode = document.querySelector("#cloud-sync-status");
    if (statusNode) {
      statusNode.textContent = currentStatus.message;
      statusNode.dataset.state = currentStatus.kind;
      statusNode.dataset.tone = currentStatus.kind === "synced" ? "success" : currentStatus.kind === "connecting" ? "loading" : currentStatus.kind === "waiting" ? "error" : "";
    }
    const detailNode = document.querySelector("#cloud-sync-detail");
    if (detailNode) {
      detailNode.textContent = currentStatus.online ? "她也在这个共同空间里" : "邀请链接只需发给她一次，之后会自动连接";
    }
    const homeStatus = document.querySelector("#shared-home-status");
    if (homeStatus && ready) homeStatus.textContent = currentStatus.online ? "你们正在云端共同在线" : "云端已连接，打开即可同步";
    window.dispatchEvent(new CustomEvent(CLOUD_EVENT, { detail: clone(currentStatus) }));
  }

  function clearRetryTimer() {
    if (!retryTimer) return;
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  function scheduleReconnect(delay = 9000) {
    if (ready || retryTimer || !navigator.onLine) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      initialize();
    }, Math.max(1800, Number(delay) || 9000));
  }

  function bindRecoveryEvents() {
    if (recoveryEventsBound) return;
    recoveryEventsBound = true;
    window.addEventListener("online", () => {
      if (!ready) initialize();
      else { pullRemote(); writePresence(); flushPending(); }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      if (!ready) initialize();
      else { pullRemote(); writePresence(); flushPending(); }
    });
  }

  function keyHash(value) {
    let hash = 5381;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
    return (hash >>> 0).toString(36);
  }

  function documentIdFor(key) {
    const existing = String(localState.documents[key] || "");
    if (existing) return existing;
    const next = `device_${deviceId}_${keyHash(key)}`;
    localState.documents[key] = next;
    persistState();
    return next;
  }

  function localMeta(key) {
    const value = localState.keys[key];
    return value && typeof value === "object" ? value : { updatedAt: 0, deleted: false };
  }

  function setLocalMeta(key, patch) {
    localState.keys[key] = {
      updatedAt: Number(patch.updatedAt) || 0,
      deleted: Boolean(patch.deleted)
    };
    persistState();
  }

  function idsFromRaw(raw) {
    const values = parseJSON(raw, null);
    if (!Array.isArray(values) || !values.every((item) => item && typeof item === "object" && typeof item.id === "string")) return [];
    return [...new Set(values.map((item) => item.id.slice(0, 120)))];
  }

  function rememberItemIds(key, raw) {
    const ids = idsFromRaw(raw);
    if (ids.length) localState.itemIds[key] = ids.slice(-1000);
    else delete localState.itemIds[key];
    persistState();
    return ids;
  }

  function pruneTombstones(key) {
    const values = localState.tombstones[key];
    if (!values || typeof values !== "object") return;
    const entries = Object.entries(values)
      .filter(([id, stamp]) => typeof id === "string" && id.length <= 120 && Number(stamp) > 0)
      .sort((left, right) => Number(right[1]) - Number(left[1]))
      .slice(0, TOMBSTONE_LIMIT);
    localState.tombstones[key] = Object.fromEntries(entries);
  }

  function recordLocalRemovals(key, raw, stamp) {
    const previous = Array.isArray(localState.itemIds[key]) ? localState.itemIds[key] : [];
    const next = idsFromRaw(raw);
    if (!previous.length && !next.length) return false;
    let changed = false;
    if (previous.length) {
      const remaining = new Set(next);
      const tombstones = localState.tombstones[key] && typeof localState.tombstones[key] === "object" ? localState.tombstones[key] : {};
      previous.forEach((id) => {
        if (!remaining.has(id) && Number(tombstones[id] || 0) < stamp) {
          tombstones[id] = stamp;
          changed = true;
        }
      });
      if (changed) {
        localState.tombstones[key] = tombstones;
        pruneTombstones(key);
      }
    }
    if (next.length) localState.itemIds[key] = next.slice(-1000);
    else delete localState.itemIds[key];
    if (changed || previous.length || next.length) persistState();
    return changed;
  }

  function absorbTombstones(key, remoteValues) {
    if (!remoteValues || typeof remoteValues !== "object") return false;
    const local = localState.tombstones[key] && typeof localState.tombstones[key] === "object" ? localState.tombstones[key] : {};
    let changed = false;
    Object.entries(remoteValues).slice(0, TOMBSTONE_LIMIT).forEach(([id, stamp]) => {
      const time = Number(stamp) || 0;
      if (!id || id.length > 120 || !time || time <= Number(local[id] || 0)) return;
      local[id] = time;
      changed = true;
    });
    if (changed) {
      localState.tombstones[key] = local;
      pruneTombstones(key);
      persistState();
    }
    return changed;
  }

  function tombstoneTime(key, id) {
    return Number(localState.tombstones[key]?.[id] || 0);
  }

  function markLocalChange(key, deleted) {
    if (!SYNC_KEY_SET.has(String(key))) return;
    const stamp = now();
    if (!deleted) recordLocalRemovals(key, safeGet(key), stamp);
    else {
      delete localState.itemIds[key];
      persistState();
    }
    setLocalMeta(key, { updatedAt: stamp, deleted: Boolean(deleted) });
    pendingKeys.add(key);
    scheduleFlush();
  }

  function seedExistingData() {
    let changed = false;
    SYNC_KEYS.forEach((key) => {
      const raw = safeGet(key);
      const meta = localMeta(key);
      if (raw != null && !Number(meta.updatedAt)) {
        localState.keys[key] = { updatedAt: now(), deleted: false };
        rememberItemIds(key, raw);
        pendingKeys.add(key);
        changed = true;
      }
    });
    if (changed) persistState();
  }

  function installStorageObserver() {
    if (window.__leoEmilyCloudStorageObserver || !window.Storage || !Storage.prototype) return;
    const originalSet = Storage.prototype.setItem;
    const originalRemove = Storage.prototype.removeItem;
    try {
      Storage.prototype.setItem = function cloudObservedSet(key, value) {
        const result = originalSet.call(this, key, value);
        let isLocal = false;
        try { isLocal = this === window.localStorage; } catch (error) { isLocal = false; }
        if (isLocal && !applyingRemote && SYNC_KEY_SET.has(String(key))) markLocalChange(String(key), false);
        return result;
      };
      Storage.prototype.removeItem = function cloudObservedRemove(key) {
        const result = originalRemove.call(this, key);
        let isLocal = false;
        try { isLocal = this === window.localStorage; } catch (error) { isLocal = false; }
        if (isLocal && !applyingRemote && SYNC_KEY_SET.has(String(key))) markLocalChange(String(key), true);
        return result;
      };
      window.__leoEmilyCloudStorageObserver = true;
    } catch (error) {
      try {
        Storage.prototype.setItem = originalSet;
        Storage.prototype.removeItem = originalRemove;
      } catch (restoreError) { /* Storage can be read-only in private mode. */ }
    }
  }

  function resultData(result, fallback) {
    if (!result) throw new Error(fallback);
    if (result.error) throw new Error(result.error.message || result.error.code || fallback);
    // CloudBase's database and storage SDKs can return { code, message } on
    // failure instead of throwing. Treat that response as a real failure so
    // the UI never promises that data has synced when it has only stayed local.
    if (result.code && result.code !== "SUCCESS") throw new Error(result.message || result.code || fallback);
    return result.data === undefined ? result : result.data;
  }

  async function getEncryptionKey() {
    if (encryptionKey) return encryptionKey;
    const current = pairing || ensurePairing();
    if (!current || !encoder || !decoder || !crypto?.subtle) throw new Error("这台设备不支持安全加密，请使用较新的 Safari 或 Chrome");
    encryptionKey = await crypto.subtle.importKey("raw", base64UrlToBytes(current.secret), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    return encryptionKey;
  }

  async function encryptText(raw) {
    const key = await getEncryptionKey();
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(String(raw || "")));
    return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
  }

  async function decryptText(payload) {
    const text = String(payload || "");
    const parts = text.split(".");
    if (parts.length !== 3 || parts[0] !== "v1") throw new Error("云端资料无法安全验证");
    const key = await getEncryptionKey();
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64UrlToBytes(parts[1]) }, key, base64UrlToBytes(parts[2]));
    return decoder.decode(decrypted);
  }

  // ─── 实时心有灵犀包（云端配对模式）────────────────────────────────────
  function subscribeRealtime(listener) {
    if (typeof listener !== "function") return () => {};
    realtimeListeners.add(listener);
    return () => realtimeListeners.delete(listener);
  }

  function emitRealtime(packet) {
    realtimeListeners.forEach((listener) => {
      try { listener(packet); } catch (error) { /* 一个页面监听器出错不影响另一端收包。 */ }
    });
  }

  function sendRealtimePacket(packet) {
    if (!ready || !collection || !navigator.onLine || !pairing || !packet || typeof packet !== "object") return false;
    let serialized = "";
    try { serialized = JSON.stringify(packet); } catch (error) { return false; }
    if (!serialized || serialized.length > REALTIME_PACKET_MAX) return false;
    const packetId = `live_${deviceId}_${now()}_${randomId(8)}`;
    // API 保持同步返回，上传在后台进行；心有灵犀的本地状态不会等待网络而卡住按钮。
    Promise.resolve(encryptText(serialized))
      .then(async (payload) => resultData(await collection.doc(packetId).set({
        roomId: pairing.roomId,
        type: "realtime",
        packetId,
        deviceId,
        role: currentRole(),
        createdAt: now(),
        payload,
        encrypted: true,
        schemaVersion: CONFIG?.version || 2
      }), "实时互动暂时无法发送"))
      .then(() => window.setTimeout(() => {
        try {
          const removal = collection?.doc(packetId)?.remove?.();
          Promise.resolve(removal).catch(() => undefined);
        } catch (error) { /* 过期包清理失败不影响游戏。 */ }
      }, REALTIME_PACKET_TTL))
      .catch(() => undefined);
    return true;
  }

  async function applyRealtimeRecord(record) {
    const createdAt = Number(record?.createdAt || 0);
    if (!createdAt || now() - createdAt > REALTIME_PACKET_TTL || typeof record?.payload !== "string") return false;
    const raw = record.encrypted === false ? record.payload : await decryptText(record.payload);
    const packet = parseJSON(raw, null);
    if (!packet || typeof packet !== "object") return false;
    emitRealtime(packet);
    return true;
  }

  async function valueForCloud(key, raw) {
    if (raw == null) return { deleted: true, payloadMode: "none", payload: "", size: 0, encrypted: true };
    const encrypted = await encryptText(raw);
    if (encrypted.length <= INLINE_LIMIT) {
      return { deleted: false, payloadMode: "inline", payload: encrypted, size: raw.length, encrypted: true };
    }
    const room = pairing || ensurePairing();
    const path = `leo-emily/${room.roomId}/${deviceId}/${keyHash(key)}.enc`;
    const blob = new Blob([encrypted], { type: "text/plain;charset=utf-8" });
    const data = resultData(await storage.upload(path, blob, {
      contentType: "text/plain;charset=utf-8",
      cacheControl: "private, max-age=0",
      upsert: true
    }), "照片或媒体上传失败");
    const id = String(data?.id || data?.fileID || data?.fileId || "");
    if (!id) throw new Error("云存储没有返回文件编号");
    return { deleted: false, payloadMode: "storage", payload: id, size: raw.length, encrypted: true };
  }

  async function pushKey(key) {
    const meta = localMeta(key);
    if (!Number(meta.updatedAt) || !collection) return false;
    const raw = safeGet(key);
    const encoded = await valueForCloud(key, raw);
    const room = pairing || ensurePairing();
    const record = {
      roomId: room.roomId,
      type: "state",
      key,
      deviceId,
      role: currentRole(),
      updatedAt: Number(meta.updatedAt),
      deleted: Boolean(encoded.deleted || meta.deleted),
      payloadMode: encoded.payloadMode,
      payload: encoded.payload,
      encrypted: true,
      tombstones: clone(localState.tombstones[key] || {}),
      size: encoded.size,
      schemaVersion: CONFIG?.version || 2
    };
    resultData(await collection.doc(documentIdFor(key)).set(record), "云端保存失败");
    return true;
  }

  function scheduleFlush(delay) {
    if (!ready || flushTimer) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      flushPending();
    }, Number.isFinite(delay) ? delay : 550);
  }

  async function flushPending() {
    if (!ready || flushing || !navigator.onLine || !pendingKeys.size) return false;
    flushing = true;
    const keys = [...pendingKeys];
    pendingKeys.clear();
    let success = true;
    try {
      for (const key of keys) await pushKey(key);
      updateStatus("已加密保存到云端，双方打开网站就会看到最新内容。", "synced");
    } catch (error) {
      keys.forEach((key) => pendingKeys.add(key));
      success = false;
      updateStatus("本机已保存，网络恢复后会自动补传到云端。", "waiting");
    } finally {
      flushing = false;
      if (pendingKeys.size && success) scheduleFlush(900);
    }
    return success;
  }

  function normalizeDatePlan(value) {
    if (!value || typeof value !== "object") return null;
    const date = String(value.date || "").slice(0, 20);
    const time = String(value.time || "").slice(0, 12);
    const location = String(value.location || "").trim().slice(0, 120);
    const activity = String(value.activity || "").trim().slice(0, 80);
    const menu = String(value.menu || "").trim().slice(0, 80);
    if (!date && !time && !location && !activity && !menu) return null;
    return {
      id: String(value.id || value.recordId || "").slice(0, 120),
      date,
      time,
      location,
      activity,
      menu
    };
  }

  function attachmentFileId(value) {
    return String(value?.fileId || value?.storageId || "").trim().slice(0, 800);
  }

  function normalizeAttachment(value) {
    if (!value || typeof value !== "object") return null;
    const kind = ["image", "video", "audio"].includes(value.kind) ? value.kind : "";
    const data = typeof value.data === "string" ? value.data : "";
    const fileId = attachmentFileId(value);
    if (!kind || (!data && !fileId)) return null;
    const size = Number(value.size);
    return {
      kind,
      // data 是离线时保存在本机的原始 DataURL；云端图片只保留 fileId，避免撑爆 localStorage。
      data,
      fileId,
      name: String(value.name || "").slice(0, 180),
      mime: String(value.mime || "").slice(0, 120),
      size: Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0
    };
  }

  function normalizeMessage(value) {
    if (!value || typeof value !== "object") return null;
    const text = String(value.text || "").trim().slice(0, 500);
    const attachment = normalizeAttachment(value.attachment);
    const plan = value.type === "date-plan" || value.kind === "date-plan" ? normalizeDatePlan(value.plan) : null;
    if (!text && !attachment?.data && !attachment?.fileId && !plan) return null;
    return {
      id: String(value.id || `cloud-${now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 100),
      author: value.author === "guest" ? "guest" : "host",
      text,
      attachment,
      type: plan ? "date-plan" : "text",
      kind: plan ? "date-plan" : "text",
      plan,
      createdAt: Number(value.createdAt) || now()
    };
  }

  function cloudMessages() {
    const parsed = parseJSON(safeGet("cute-date-invite-shared-messages-v1") || "[]", []);
    return Array.isArray(parsed) ? parsed.map(normalizeMessage).filter(Boolean).sort((left, right) => left.createdAt - right.createdAt).slice(-100) : [];
  }

  function normalizePushSubscription(value) {
    const source = value && typeof value.toJSON === "function" ? value.toJSON() : value;
    if (!source || typeof source !== "object") return null;
    const endpoint = String(source.endpoint || "").trim().slice(0, 2048);
    const p256dh = String(source.keys?.p256dh || "").trim().slice(0, 256);
    const auth = String(source.keys?.auth || "").trim().slice(0, 256);
    if (!/^https:\/\//i.test(endpoint) || !p256dh || !auth) return null;
    return { endpoint, keys: { p256dh, auth } };
  }

  function partnerIsOnline() {
    return presence.some((item) => item.deviceId !== deviceId && now() - Number(item.updatedAt || 0) < PRESENCE_WINDOW);
  }

  function messagePushPreview(message) {
    const attachment = message?.attachment;
    if (attachment?.kind === "image") return "发来了一张照片";
    if (attachment?.kind === "video") return "发来了一段视频";
    if (attachment?.kind === "audio") return "发来了一段语音";
    if (message?.kind === "date-plan" || message?.type === "date-plan") return String(message.text || "发来了一份新的约会计划").trim().slice(0, 110);
    return String(message?.text || "发来了一条新消息").trim().slice(0, 110) || "发来了一条新消息";
  }

  function senderPushName() {
    return displayNameForRole(currentRole());
  }

  async function registerPushSubscription(subscription) {
    const normalized = normalizePushSubscription(subscription);
    if (!normalized) return { ok: false, error: "这台手机的通知订阅无效，请重新开启通知。" };
    if (!ready || !collection || !navigator.onLine) return { ok: false, error: "共同空间正在连接，稍后会自动再试。" };
    try {
      const room = pairing || ensurePairing();
      resultData(await collection.doc(`push_${deviceId}`).set({
        roomId: room.roomId,
        type: "push_subscription",
        deviceId,
        role: currentRole(),
        subscription: normalized,
        updatedAt: now(),
        schemaVersion: CONFIG?.version || 2
      }), "消息通知设备登记失败");
      return { ok: true };
    } catch (error) {
      return { ok: false, error: "消息通知设备暂时没登记成功，会在下次打开时自动重试。" };
    }
  }

  function requestPartnerPush(message) {
    if (!ready || !navigator.onLine || !app?.callFunction || !CONFIG?.pushFunction || partnerIsOnline()) return;
    const room = pairing || ensurePairing();
    const data = {
      roomId: room.roomId,
      senderDeviceId: deviceId,
      senderName: senderPushName(),
      messageId: String(message?.id || "").slice(0, 100),
      kind: String(message?.kind || message?.attachment?.kind || "text").slice(0, 32),
      text: messagePushPreview(message)
    };
    Promise.resolve(app.callFunction({ name: CONFIG.pushFunction, data }))
      .catch(() => undefined);
  }

  function sendCloudMessage(input) {
    const message = normalizeMessage({
      id: input && input.id ? input.id : `cloud-${now()}-${Math.random().toString(36).slice(2, 9)}`,
      author: currentRole(),
      text: input && input.text,
      attachment: input && input.attachment,
      type: input && input.type,
      kind: input && input.kind,
      plan: input && input.plan,
      createdAt: now()
    });
    if (!message) return { ok: false, error: "写一点话，或选择一张照片、视频吧。" };
    const messages = cloudMessages();
    if (!messages.some((item) => item.id === message.id)) messages.push(message);
    try { window.DateInviteBackups?.capture?.("发送聊天消息前"); } catch (error) { /* 备份不可用时仍可正常发消息。 */ }
    applyingRemote = true;
    const saved = safeSet("cute-date-invite-shared-messages-v1", JSON.stringify(messages.slice(-100)));
    applyingRemote = false;
    if (!saved) return { ok: false, error: "本机存储空间不足，消息没有保存。" };
    markLocalChange("cute-date-invite-shared-messages-v1", false);
    window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { messages } }));
    scheduleFlush(0);
    requestPartnerPush(message);
    return { ok: true, delivered: Boolean(ready && navigator.onLine), message };
  }

  function uploadableBlob(value) {
    return typeof Blob !== "undefined" && value instanceof Blob;
  }

  function mediaKindFor(file, requestedKind) {
    if (["image", "video", "audio"].includes(requestedKind)) return requestedKind;
    const mime = String(file?.type || "");
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "";
  }

  function mediaExtension(name, mime) {
    const matched = String(name || "").match(/\.([a-z0-9]{1,12})$/i);
    if (matched) return `.${matched[1].toLowerCase()}`;
    const byMime = {
      "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp", "image/heic": ".heic",
      "video/mp4": ".mp4", "video/quicktime": ".mov", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/wav": ".wav"
    };
    return byMime[String(mime || "").toLowerCase()] || "";
  }

  function mediaName(file, requestedName) {
    const raw = String(requestedName || file?.name || "照片").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
    return (raw || "照片").slice(0, 180);
  }

  async function uploadCloudAttachment(input = {}) {
    const file = input.file;
    const kind = mediaKindFor(file, input.kind);
    if (!uploadableBlob(file) || !kind) return { ok: false, error: "请选择一张照片、视频或语音文件。" };
    if (!ready || !storage || !navigator.onLine) {
      return { ok: false, offline: true, error: "云端暂时不可用，将尝试把原图保存在本机。" };
    }
    const name = mediaName(file, input.name);
    const mime = String(input.mime || file.type || "application/octet-stream").slice(0, 120);
    const room = pairing || ensurePairing();
    const path = `leo-emily/${room.roomId}/chat-media/${now()}-${randomId(12)}${mediaExtension(name, mime)}`;
    try {
      const data = resultData(await storage.upload(path, file, {
        contentType: mime,
        cacheControl: "private, max-age=0",
        upsert: false
      }), "原图上传失败");
      const fileId = String(data?.id || data?.fileID || data?.fileId || "").trim().slice(0, 800);
      if (!fileId) throw new Error("云存储没有返回照片编号");
      return {
        ok: true,
        attachment: { kind, data: "", fileId, name, mime, size: Number(file.size) || 0 }
      };
    } catch (error) {
      return {
        ok: false,
        offline: !navigator.onLine,
        error: error?.message || "原图上传失败，请稍后再试。"
      };
    }
  }

  async function sendCloudMediaMessage(input = {}) {
    const uploaded = await uploadCloudAttachment(input);
    if (!uploaded.ok) return uploaded;
    const sent = await Promise.resolve(sendCloudMessage({
      id: input.id,
      text: input.text,
      attachment: uploaded.attachment,
      type: input.type,
      kind: input.kind,
      plan: input.plan
    }));
    return sent?.ok ? { ...sent, attachment: uploaded.attachment } : sent;
  }

  async function downloadCloudAttachment(attachment) {
    const fileId = attachmentFileId(attachment);
    if (!fileId) throw new Error("没有找到这份原图。" );
    if (!ready || !storage) throw new Error("云端照片正在连接，请稍后再试。" );
    const downloaded = resultData(await storage.download(fileId), "云端原图下载失败");
    const source = downloaded?.fileContent || downloaded?.blob || downloaded?.data || downloaded;
    if (typeof Blob !== "undefined" && source instanceof Blob) {
      if (!source.type && attachment?.mime) return new Blob([source], { type: attachment.mime });
      return source;
    }
    return new Blob([source], { type: attachment?.mime || "application/octet-stream" });
  }

  function mergeArrays(key, localValue, remoteValue, localStamp, remoteStamp) {
    if (key === "cute-date-invite-100-things-v1") {
      const left = new Set(localValue.filter((item) => Number.isInteger(item)));
      const right = new Set(remoteValue.filter((item) => Number.isInteger(item)));
      if (remoteStamp > localStamp && right.size < left.size && [...right].every((item) => left.has(item))) return [...right];
      if (localStamp > remoteStamp && left.size < right.size && [...left].every((item) => right.has(item))) return [...left];
      return [...new Set([...left, ...right])];
    }
    const values = [...localValue, ...remoteValue];
    const withIds = values.length > 0 && values.every((item) => item && typeof item === "object" && typeof item.id === "string");
    if (!withIds) {
      const left = new Set(localValue.map((item) => JSON.stringify(item)));
      const right = new Set(remoteValue.map((item) => JSON.stringify(item)));
      if (remoteStamp > localStamp && right.size < left.size && [...right].every((item) => left.has(item))) return remoteValue;
      if (localStamp > remoteStamp && left.size < right.size && [...left].every((item) => left.has(item))) return localValue;
      return [...new Set([...left, ...right])].map((item) => parseJSON(item, item));
    }
    const merged = new Map();
    values.forEach((item) => {
      const previous = merged.get(item.id);
      if (!previous) { merged.set(item.id, item); return; }
      const previousTime = Number(previous.updatedAt || previous.createdAt || 0);
      const currentTime = Number(item.updatedAt || item.createdAt || 0);
      if (currentTime > previousTime || (currentTime === previousTime && remoteStamp >= localStamp)) merged.set(item.id, item);
    });
    return [...merged.values()].filter((item) => {
      const changedAt = Number(item.updatedAt || item.createdAt || 0);
      return tombstoneTime(key, item.id) < changedAt;
    });
  }

  function mergeRawValue(key, localRaw, remoteRaw, localStamp, remoteStamp) {
    const local = localMeta(key);
    if (local.deleted && Number(local.updatedAt || 0) >= remoteStamp) return localRaw;
    if (localRaw == null) return remoteRaw;
    if (remoteRaw == null) return localRaw;
    const localValue = parseJSON(localRaw, undefined);
    const remoteValue = parseJSON(remoteRaw, undefined);
    if (localValue === undefined || remoteValue === undefined) return remoteStamp >= localStamp ? remoteRaw : localRaw;
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) return JSON.stringify(mergeArrays(key, localValue, remoteValue, localStamp, remoteStamp));
    if (localValue && remoteValue && typeof localValue === "object" && typeof remoteValue === "object") {
      if (remoteStamp > localStamp) return remoteRaw;
      if (localStamp > remoteStamp) return localRaw;
      const nonEmptyRemote = Object.fromEntries(Object.entries(remoteValue).filter((entry) => entry[1] !== "" && entry[1] != null));
      return JSON.stringify({ ...localValue, ...nonEmptyRemote });
    }
    return remoteStamp >= localStamp ? remoteRaw : localRaw;
  }

  async function blobText(blob) {
    if (blob && typeof blob.text === "function") return blob.text();
    if (typeof blob === "string") return blob;
    if (blob?.fileContent && typeof blob.fileContent.text === "function") return blob.fileContent.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("云端文件读取失败"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsText(blob?.fileContent || blob);
    });
  }

  async function remoteRaw(record) {
    let payload = "";
    if (record.payloadMode === "inline") payload = typeof record.payload === "string" ? record.payload : "";
    else if (record.payloadMode === "storage" && record.payload) payload = await blobText(resultData(await storage.download(String(record.payload)), "云端照片或媒体下载失败"));
    else throw new Error("云端资料格式不完整");
    if (record.encrypted !== false) return decryptText(payload);
    return payload;
  }

  async function applyRemoteRecord(record) {
    const key = String(record.key || "");
    if (!SYNC_KEY_SET.has(key) || record.deviceId === deviceId) return false;
    const local = localMeta(key);
    const remoteStamp = Number(record.updatedAt) || 0;
    if (!remoteStamp) return false;
    const tombstonesChanged = absorbTombstones(key, record.tombstones);
    if (record.deleted) {
      if (remoteStamp < Number(local.updatedAt || 0)) return tombstonesChanged;
      const existed = safeGet(key) != null;
      applyingRemote = true;
      const removed = existed ? safeRemove(key) : true;
      applyingRemote = false;
      if (!removed) throw new Error("本机存储空间不足，无法应用云端删除");
      delete localState.itemIds[key];
      setLocalMeta(key, { updatedAt: remoteStamp, deleted: true });
      return existed || tombstonesChanged;
    }
    const remote = await remoteRaw(record);
    const localRaw = safeGet(key);
    const merged = mergeRawValue(key, localRaw, remote, Number(local.updatedAt || 0), remoteStamp);
    const shouldWrite = typeof merged === "string" && merged !== localRaw;
    if (shouldWrite) {
      try { window.DateInviteBackups?.capture?.("合并云端资料前"); } catch (error) { /* Backup cannot block sync. */ }
      applyingRemote = true;
      const saved = safeSet(key, merged);
      applyingRemote = false;
      if (!saved) throw new Error("本机存储空间不足，无法保存云端资料");
      rememberItemIds(key, merged);
    }
    if (shouldWrite || tombstonesChanged) {
      const nextStamp = Math.max(now(), Number(local.updatedAt || 0) + 1, remoteStamp + 1);
      setLocalMeta(key, { updatedAt: nextStamp, deleted: false });
      pendingKeys.add(key);
      scheduleFlush(250);
    } else {
      setLocalMeta(key, { updatedAt: Math.max(Number(local.updatedAt || 0), remoteStamp), deleted: false });
    }
    return shouldWrite || tombstonesChanged;
  }

  async function refreshRoomProfiles(records) {
    const room = pairing || ensurePairing();
    if (!room || !Array.isArray(records)) return false;
    let changed = false;
    const latest = { host: roomProfiles.host, guest: roomProfiles.guest };
    const identityRows = records
      .filter((record) => record && record.type === "identity" && record.roomId === room.roomId)
      .sort((left, right) => Number(left.updatedAt || 0) - Number(right.updatedAt || 0));

    for (const record of identityRows) {
      const side = record.role === "guest" ? "guest" : "host";
      try {
        const raw = record.encrypted === false ? String(record.payload || "") : await decryptText(String(record.payload || ""));
        const profile = normalizeIdentity(parseJSON(raw, null));
        if (!profile || profile.roomId !== room.roomId || profile.role !== side) continue;
        const previous = latest[side];
        const newer = !previous
          || Number(profile.updatedAt || 0) > Number(previous.updatedAt || 0)
          || (Number(profile.updatedAt || 0) === Number(previous.updatedAt || 0) && profile.deviceId === deviceId);
        if (newer) latest[side] = profile;
      } catch (error) {
        // A malformed profile must not stop memories or messages from syncing.
      }
    }

    ["host", "guest"].forEach((side) => {
      const previous = roomProfiles[side];
      const next = latest[side] || null;
      if (JSON.stringify(previous) !== JSON.stringify(next)) {
        roomProfiles[side] = next;
        changed = true;
      }
    });
    if (changed) emitIdentityChange();
    return changed;
  }

  function updatePresence(records) {
    const room = pairing || ensurePairing();
    presence = records
      .filter((item) => item && item.type === "presence" && item.roomId === room.roomId)
      .map((item) => ({
        deviceId: String(item.deviceId || ""),
        role: item.role === "guest" ? "guest" : "host",
        name: cleanDisplayName(item.name),
        updatedAt: Number(item.updatedAt) || 0
      }))
      .filter((item) => item.deviceId);
  }

  async function pullRemote() {
    if (!ready || pulling || !navigator.onLine) return false;
    pulling = true;
    let changed = false;
    let profilesChanged = false;
    let skippedRecords = 0;
    try {
      const room = pairing || ensurePairing();
      const records = resultData(await collection.where({ roomId: room.roomId }).limit(100).get(), "云端读取失败");
      const rows = Array.isArray(records) ? records : [];
      lastCloudContactAt = now();
      updatePresence(rows);
      profilesChanged = await refreshRoomProfiles(rows);
      // 实时心有灵犀包不写入 localStorage 快照，只在短轮询窗口内解密并转给互动模块。
      const realtimeRows = rows
        .filter((record) => record && record.type === "realtime" && record.deviceId !== deviceId)
        .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
      for (const record of realtimeRows) {
        const packetId = String(record.packetId || record._id || "").slice(0, 160);
        if (!packetId || realtimeSeen.has(packetId)) continue;
        if (now() - Number(record.createdAt || 0) > REALTIME_PACKET_TTL) { realtimeSeen.add(packetId); continue; }
        try {
          await applyRealtimeRecord(record);
          realtimeSeen.add(packetId);
          if (realtimeSeen.size > 300) realtimeSeen.clear();
        } catch (error) { /* 解密/网络暂时失败时不标记，下次轮询可恢复。 */ }
      }
      const states = rows.filter((record) => record && record.type === "state" && record.deviceId !== deviceId)
        .sort((left, right) => Number(left.updatedAt || 0) - Number(right.updatedAt || 0));
      for (const record of states) {
        const seenAt = Number(localState.seen[record._id] || 0);
        const updatedAt = Number(record.updatedAt || 0);
        if (seenAt >= updatedAt) continue;
        try {
          const applied = await applyRemoteRecord(record);
          localState.seen[record._id] = updatedAt;
          changed = changed || applied;
        } catch (error) {
          // A damaged attachment or a stale encrypted record must not prevent
          // every later item from reaching this phone. Leave it unmarked so a
          // later retry can recover it after the source is available again.
          skippedRecords += 1;
        }
      }
      persistState();
      if (changed) {
        window.dispatchEvent(new CustomEvent(CLOUD_APPLIED_EVENT, { detail: { source: "cloud" } }));
        window.dispatchEvent(new CustomEvent("shared-sync-applied", { detail: { source: "cloud" } }));
        window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { messages: cloudMessages() } }));
      }
      updateStatus(
        skippedRecords
          ? "大部分资料已同步，少量旧附件会在下次连接时自动重试。"
          : changed ? "云端内容已合并到这台手机。" : profilesChanged ? "你们的名字已准备好，资料会自动同步。" : "云端已连接，资料会自动同步。",
        skippedRecords ? "waiting" : "synced"
      );
      return changed;
    } catch (error) {
      updateStatus("本机资料安全保留，云端暂时连不上。", "waiting");
      return false;
    } finally {
      pulling = false;
    }
  }

  async function writePresence() {
    if (!ready || !navigator.onLine || !collection) return false;
    try {
      const room = pairing || ensurePairing();
      resultData(await collection.doc(`presence_${deviceId}`).set({
        roomId: room.roomId,
        type: "presence",
        deviceId,
        role: currentRole(),
        name: cleanDisplayName(ensureIdentity()?.name),
        updatedAt: now(),
        schemaVersion: CONFIG?.version || 2
      }), "在线状态保存失败");
      lastCloudContactAt = now();
      return true;
    } catch (error) { return false; }
  }

  async function ensureAnonymousSession() {
    const auth = app && app.auth;
    if (!auth) throw new Error("身份认证模块未加载");
    try {
      const existing = await auth.getSession();
      if (existing?.data?.session) return existing.data.session;
    } catch (error) { /* A new anonymous session will be created below. */ }
    const data = resultData(await auth.signInAnonymously(), "匿名登录失败");
    return data?.session || null;
  }

  function copyText(text) {
    if (!text) return Promise.resolve(false);
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    try {
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.append(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      return Promise.resolve(copied);
    } catch (error) { return Promise.resolve(false); }
  }

  function notify(message) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function identityDialogOpen(dialog) {
    return Boolean(dialog?.open || dialog?.hasAttribute("open"));
  }

  function openIdentityDialog(dialog) {
    if (!dialog || identityDialogOpen(dialog)) return;
    try {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } catch (error) { dialog.setAttribute("open", ""); }
  }

  function closeIdentityDialog(dialog) {
    if (!dialog || !identityDialogOpen(dialog)) return;
    try {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    } catch (error) { dialog.removeAttribute("open"); }
  }

  function openIdentitySetupIfNeeded() {
    const mine = ensureIdentity();
    if (!mine || mine.name) return;
    const dialog = document.querySelector("#identity-dialog");
    const input = document.querySelector("#identity-name-input");
    const error = document.querySelector("#identity-name-error");
    if (error) { error.textContent = ""; error.hidden = true; }
    if (input) input.value = "";
    openIdentityDialog(dialog);
    window.setTimeout(() => input?.focus(), 50);
  }

  function bindIdentitySetup() {
    if (identityControlsBound) return;
    identityControlsBound = true;
    const dialog = document.querySelector("#identity-dialog");
    const form = document.querySelector("#identity-form");
    const input = document.querySelector("#identity-name-input");
    const error = document.querySelector("#identity-name-error");
    const submit = document.querySelector("#identity-save");
    const repairToggle = document.querySelector("#identity-role-repair-toggle");
    const repairPanel = document.querySelector("#identity-role-repair");
    if (!dialog || !form || !input) return;

    const setRepairOpen = (open) => {
      if (repairPanel) repairPanel.hidden = !open;
      repairToggle?.setAttribute("aria-expanded", String(Boolean(open)));
    };
    repairToggle?.addEventListener("click", () => setRepairOpen(Boolean(repairPanel?.hidden)));
    repairPanel?.querySelectorAll("[data-identity-role]").forEach((button) => {
      button.addEventListener("click", async () => {
        const buttons = repairPanel.querySelectorAll("button");
        buttons.forEach((item) => { item.disabled = true; });
        const result = await rebindIdentityRole(button.dataset.identityRole);
        buttons.forEach((item) => { item.disabled = false; });
        if (!result.ok) {
          if (error) { error.textContent = result.error || "身份暂时无法重新绑定，请再试一次。"; error.hidden = false; }
          return;
        }
        setRepairOpen(false);
        if (result.identity?.name) {
          closeIdentityDialog(dialog);
          notify(result.pending ? "身份已重新绑定，联网后会同步给对方。" : "身份已重新绑定，不会再显示反了。");
        } else {
          if (error) { error.textContent = "身份已重新绑定，现在写下名字就好。"; error.hidden = false; }
          input.focus();
        }
      });
    });

    dialog.addEventListener("cancel", (event) => {
      if (!ensureIdentity()?.name) event.preventDefault();
    });
    dialog.addEventListener("close", () => {
      if (!ensureIdentity()?.name) window.setTimeout(openIdentitySetupIfNeeded, 0);
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = cleanDisplayName(input.value);
      if (!name) {
        if (error) { error.textContent = "请写下你的名字，再一起开始吧。"; error.hidden = false; }
        input.focus();
        return;
      }
      if (error) { error.textContent = ""; error.hidden = true; }
      if (submit) { submit.disabled = true; submit.textContent = "正在记住…"; }
      const result = await saveDisplayName(name);
      if (submit) { submit.disabled = false; submit.textContent = "记住我的名字"; }
      if (!result.ok) {
        if (error) { error.textContent = result.error || "名字暂时没有保存成功，请再试一次。"; error.hidden = false; }
        return;
      }
      if (result.conflict) {
        if (error) { error.textContent = "这台手机的身份和对方重了。展开下面的选项，重新选择发起者或加入者即可修复。"; error.hidden = false; }
        setRepairOpen(true);
        return;
      }
      closeIdentityDialog(dialog);
      notify(result.pending ? `已经记住你叫${name}，联网后会同步给对方。` : `已经记住你叫${name}，以后不会弄混啦。`);
      writePresence();
    });
  }

  function bindControls() {
    if (controlsBound) return;
    controlsBound = true;
    const copy = document.querySelector("#cloud-copy-link");
    const share = document.querySelector("#cloud-share-link");
    const action = async (allowShare) => {
      const url = invitationLink();
      if (!url) { notify("邀请链接暂时没有准备好，请稍后再试。"); return; }
      if (allowShare && navigator.share) {
        try {
          await navigator.share({ title: "Leo And Emily", text: "这是只属于我们的共同空间，打开一次就会自动连接。", url });
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      if (await copyText(url)) notify("邀请链接已复制，发给她打开一次就好。\n链接里有专属钥匙，请只发给她。");
      else notify("浏览器没有允许复制，请长按地址栏复制当前链接发给她。");
    };
    copy?.addEventListener("click", () => action(false));
    share?.addEventListener("click", () => action(true));
  }

  async function initialize() {
    pairing = ensurePairing();
    // ===== 身份固定：每台设备首次取名，角色只由首次配对决定 =====
    ensureIdentity();
    bindIdentitySetup();
    openIdentitySetupIfNeeded();
    installStorageObserver();
    bindControls();
    bindRecoveryEvents();
    if (ready || initializing) return;
    if (!CONFIG?.environmentId || !CONFIG?.publishableKey || !SDK) {
      updateStatus("云端组件暂未加载，本机资料仍会安全保存。", "waiting");
      return;
    }
    if (!pairing || !encoder || !decoder || !crypto?.subtle) {
      updateStatus("这台设备不支持安全云端同步，请使用较新的 Safari 或 Chrome。", "waiting");
      return;
    }
    updateStatus("正在连接你们的云端空间…", "connecting");
    initializing = true;
    try {
      app = SDK.init({
        env: CONFIG.environmentId,
        region: CONFIG.region || "ap-shanghai",
        accessKey: CONFIG.publishableKey,
        auth: { detectSessionInUrl: true }
      });
      await ensureAnonymousSession();
      db = app.database();
      storage = app.storage?.from?.();
      if (!storage) throw new Error("云存储模块未加载");
      collection = db.collection(CONFIG.collection || "couple_sync");
      ready = true;
      seedExistingData();
      await pullRemote();
      await publishIdentity();
      const presenceSaved = await writePresence();
      const hadPendingChanges = pendingKeys.size > 0;
      const pendingSaved = await flushPending();
      pollTimer = window.setInterval(() => { pullRemote(); flushPending(); }, POLL_INTERVAL);
      presenceTimer = window.setInterval(writePresence, PRESENCE_INTERVAL);
      clearRetryTimer();
      if (lastCloudContactAt && presenceSaved && (!hadPendingChanges || pendingSaved)) updateStatus("云端已连接，双方打开网站就会看到最新内容。", "synced");
      else updateStatus("本机资料已保存，正在等待云端重新连接。", "waiting");
    } catch (error) {
      ready = false;
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
      updateStatus("云端暂时不可用，本机资料仍会安全保存。", "waiting");
      scheduleReconnect();
    } finally {
      initializing = false;
    }
  }

  window.DateInviteCloud = {
    CLOUD_EVENT,
    CLOUD_APPLIED_EVENT,
    IDENTITY_EVENT,
    SYNC_KEYS: [...SYNC_KEYS],
    isReady: () => ready,
    isPaired: () => Boolean(pairing),
    isBothOnline: () => presence.some((item) => item.deviceId !== deviceId && now() - Number(item.updatedAt || 0) < PRESENCE_WINDOW),
    getRole: currentRole,
    getIdentity: () => identitySnapshot(),
    getDisplayName: displayNameForRole,
    setDisplayName: saveDisplayName,
    isIdentityReady: () => Boolean(ensureIdentity()?.name),
    getStatus: () => clone(currentStatus),
    getInviteLink: invitationLink,
    getMessages: cloudMessages,
    sendMessage: sendCloudMessage,
    sendMediaMessage: sendCloudMediaMessage,
    downloadAttachment: downloadCloudAttachment,
    sendRealtimePacket,
    subscribe: subscribeRealtime,
    subscribeRealtime,
    registerPushSubscription,
    queueKey: (key) => {
      if (!SYNC_KEY_SET.has(String(key))) return false;
      markLocalChange(String(key), safeGet(String(key)) == null);
      return true;
    },
    syncNow: async () => {
      if (!ready) return false;
      await pullRemote();
      await writePresence();
      return flushPending();
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
