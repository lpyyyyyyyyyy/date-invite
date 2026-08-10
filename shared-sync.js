(() => {
  "use strict";

  /*
   * 双人同步是一个轻量的 WebRTC 房间：页面仍然可以完全离线使用，
   * 只有打开共享房间时才加载 PeerJS。这样静态 GitHub Pages 也能让两部
   * 手机直接互传内容，不需要把账号、密码或照片上传到我们的服务器。
   */
  const ROOM_KEY = "cute-date-invite-shared-room-v1";
  const META_KEY = "cute-date-invite-shared-meta-v1";
  const CHAT_KEY = "cute-date-invite-shared-messages-v1";
  const INTERACTION_KEYS = [
    "cute-date-invite-polaroids-v1",
    "cute-date-invite-voice-postcards-v1",
    "cute-date-invite-mind-matches-v1",
    "cute-date-invite-message-wall-v1",
    "cute-date-invite-world-posts-v1",
  ];
  const META_ROOM_KEY = `${META_KEY}-room`;
  const CHAT_ROOM_KEY = `${CHAT_KEY}-room`;
  const SYNC_KEYS = [
    "cute-date-invite-v1",
    "cute-date-invite-archive-v1",
    "cute-date-invite-anniversaries-v1",
    "cute-date-invite-100-things-v1",
    "cute-date-invite-couple-notes-v1",
    "cute-date-invite-future-letters-v1",
    "cute-date-invite-repair-v1",
    "cute-date-invite-home-settings-v1",
    CHAT_KEY,
    ...INTERACTION_KEYS,
  ];
  const SYNC_KEY_SET = new Set(SYNC_KEYS);
  // CloudBase is the primary source for saved couple data. Keeping the old
  // peer-to-peer storage observer active at the same time can resend a cloud
  // update into an old room (and vice versa), so it is reserved for live game
  // packets only when cloud sync has been configured.
  const CLOUD_PRIMARY = Boolean(window.LEO_EMILY_CLOUD_CONFIG?.environmentId);
  const PEER_SOURCES = [
    "https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js",
    "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js",
  ];
  const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  // DataChannel 在 iOS Safari 等环境中的单条消息上限并不一致。
  // 发送前必须保证 JSON 没有被半截截断，否则对方会把损坏的数据写进本地存储。
  // 约会照片在应用内已经压缩过；给三张照片和文字留出足够空间，
  // 同时把整包控制在移动端 DataChannel 比较稳妥的范围内。
  const MAX_SNAPSHOT_VALUE_CHARS = 2400000;
  const MAX_SNAPSHOT_TOTAL_CHARS = 7000000;
  const MAX_SYNC_PHOTO_CHARS = 900000;
  const MAX_CHAT_ATTACHMENT_CHARS = 1600000;
  const MAX_PACKET_CHARS = 64000;
  const MAX_PACKET_CHUNKS = 180;
  const MAX_PENDING_PACKET_AGE = 45000;
  const ROOM_EVENT = "date-invite-room-changed";
  const CHAT_EVENT = "date-invite-chat-changed";

  const dialog = document.querySelector("#shared-dialog");
  const openButtons = [...document.querySelectorAll(".shared-open")];
  const closeButton = document.querySelector("#shared-close");
  const joinPanel = document.querySelector("#shared-join-panel");
  const roomPanel = document.querySelector("#shared-room-panel");
  const roomInput = document.querySelector("#shared-room-input");
  const createButton = document.querySelector("#shared-create-button");
  const joinButton = document.querySelector("#shared-join-button");
  const roomCode = document.querySelector("#shared-room-code");
  const connectionPill = document.querySelector("#shared-connection-pill");
  const sharedStatus = document.querySelector("#shared-status");
  const homeStatus = document.querySelector("#shared-home-status");
  const copyLinkButton = document.querySelector("#shared-copy-link");
  const shareLinkButton = document.querySelector("#shared-share-link");
  const leaveButton = document.querySelector("#shared-leave-button");
  const messageForm = document.querySelector("#shared-message-form");
  const messageInput = document.querySelector("#shared-message-input");
  const messagesView = document.querySelector("#shared-messages");

  if (!dialog || !roomInput || !createButton || !joinButton) return;

  let peer = null;
  let connection = null;
  let activeRoom = loadRoom();
  let myRole = activeRoom?.role === "guest" ? "guest" : "host";
  let loadingPeer = null;
  let storageBroadcastTimer = null;
  let reconnectTimer = null;
  let applyingRemote = false;
  let roomWasOpened = false;
  // 每次关闭/重建 Peer 都递增。防止网络抖动时，旧的异步连接回调覆盖新连接。
  let connectionGeneration = 0;
  let hostUnavailableAttempts = 0;
  let lastStatus = { message: "还没有共享房间", kind: "offline" };
  const packetListeners = new Set();
  const pendingPackets = new Map();

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }

  function backupBeforeSync(key) {
    if (!SYNC_KEY_SET.has(String(key))) return;
    try { window.DateInviteBackups?.capture?.("共享同步前"); } catch (error) { /* 备份失败不影响同步 */ }
  }

  function safeSet(key, value) {
    backupBeforeSync(key);
    try { window.localStorage.setItem(key, value); return true; } catch (error) { return false; }
  }

  function safeRemove(key) {
    backupBeforeSync(key);
    try { window.localStorage.removeItem(key); return true; } catch (error) { return false; }
  }

  function readMeta() {
    try {
      const parsed = JSON.parse(safeGet(META_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) { return {}; }
  }

  let keyMeta = readMeta();
  // 删除操作需要一个可同步的墓碑；仅发送 null 无法区分“没初始化”与“用户刚删除”。
  let keyTombstones = {};
  try {
    const savedTombstones = JSON.parse(safeGet(`${META_KEY}-deleted`) || "{}");
    if (savedTombstones && typeof savedTombstones === "object") keyTombstones = savedTombstones;
  } catch (error) { keyTombstones = {}; }
  let syncRoomCode = String(safeGet(META_ROOM_KEY) || "");

  function scopeRoomData(code, preserveUnscoped = false) {
    const normalized = normalizeCode(code);
    if (!normalized) return;
    const previous = syncRoomCode;
    const previousChatRoom = String(safeGet(CHAT_ROOM_KEY) || "");
    if (previous && previous !== normalized) {
      keyMeta = {};
      keyTombstones = {};
      // 小纸条属于房间；切换房间时不要把上一对人的私密聊天带过去。
      try { window.DateInviteBackups?.capture?.("切换共享房间前"); } catch (error) { /* 不影响切换 */ }
      applyingRemote = true;
      try { safeRemove(CHAT_KEY); } finally { applyingRemote = false; }
    } else if (!previous && !preserveUnscoped) {
      // 新建/加入房间时，旧版本留下的全局时间戳不应影响首次合并。
      keyMeta = {};
      keyTombstones = {};
      if (previousChatRoom && previousChatRoom !== normalized) {
        applyingRemote = true;
        try { safeRemove(CHAT_KEY); } finally { applyingRemote = false; }
      }
    } else if (!previous && !previousChatRoom && preserveUnscoped) {
      // 兼容旧版本：第一次启用共享时保留已有本地纸条。
    }
    syncRoomCode = normalized;
    safeSet(META_ROOM_KEY, normalized);
    safeSet(CHAT_ROOM_KEY, normalized);
    persistMeta();
  }

  function persistMeta() {
    safeSet(META_KEY, JSON.stringify(keyMeta));
    safeSet(`${META_KEY}-deleted`, JSON.stringify(keyTombstones));
  }

  function touchKey(key, at = Date.now(), deleted = false) {
    if (!SYNC_KEY_SET.has(key)) return;
    const stamp = Number.isFinite(at) ? at : Date.now();
    keyMeta[key] = stamp;
    if (deleted) keyTombstones[key] = stamp;
    else delete keyTombstones[key];
    persistMeta();
  }

  function patchStorage() {
    if (CLOUD_PRIMARY) return;
    if (window.__dateInviteSharedStoragePatched) return;
    if (!window.Storage || !Storage.prototype) return;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    try {
      Storage.prototype.setItem = function patchedSetItem(key, value) {
        const result = originalSetItem.call(this, key, value);
        let isLocal = false;
        try { isLocal = this === window.localStorage; } catch (error) { isLocal = false; }
        if (isLocal && !applyingRemote && SYNC_KEY_SET.has(String(key))) {
          touchKey(String(key), Date.now(), false);
          scheduleSnapshotBroadcast();
        }
        return result;
      };
      Storage.prototype.removeItem = function patchedRemoveItem(key) {
        const result = originalRemoveItem.call(this, key);
        let isLocal = false;
        try { isLocal = this === window.localStorage; } catch (error) { isLocal = false; }
        if (isLocal && !applyingRemote && SYNC_KEY_SET.has(String(key))) {
          // 记录删除标记，避免删除操作在另一台手机上被旧数组重新合并回来。
          touchKey(String(key), Date.now(), true);
          scheduleSnapshotBroadcast();
        }
        return result;
      };
      window.__dateInviteSharedStoragePatched = true;
    } catch (error) {
      // 某些隐私模式会把 Storage 原型设为只读；同步不可用时不能阻塞主应用。
      try {
        Storage.prototype.setItem = originalSetItem;
        Storage.prototype.removeItem = originalRemoveItem;
      } catch (restoreError) { /* ignore */ }
      window.__dateInviteSharedStoragePatched = false;
    }
  }

  function randomCode() {
    let output = "";
    try {
      const bytes = new Uint8Array(6);
      crypto.getRandomValues(bytes);
      bytes.forEach((byte) => { output += CODE_ALPHABET[byte % CODE_ALPHABET.length]; });
    } catch (error) {
      for (let index = 0; index < 6; index += 1) output += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return output;
  }

  function normalizeCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }

  function makeHostId(code) {
    return `leo-emily-${code.toLowerCase()}`;
  }

  function normalizeHostId(value, code) {
    const candidate = String(value || "").trim().toLowerCase();
    // 只接受本应用生成的 PeerJS ID，避免旧链接/手工输入的非法 ID 让 PeerJS 直接报错。
    return /^leo-emily-[a-z0-9]{6,8}$/.test(candidate) && candidate.endsWith(code.toLowerCase())
      ? candidate
      : makeHostId(code);
  }

  function readInviteFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = normalizeCode(params.get("room"));
    if (code.length < 6) return null;
    return { code, hostId: normalizeHostId(params.get("host"), code) };
  }

  function clearInviteFromUrl() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("room") && !url.searchParams.has("host")) return;
      url.searchParams.delete("room");
      url.searchParams.delete("host");
      window.history?.replaceState?.(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch (error) {
      // 旧版或受限 WebView 不支持 History API 时，退出房间仍然只清本机恢复状态。
    }
  }

  function loadRoom() {
    try {
      const saved = JSON.parse(safeGet(ROOM_KEY) || "null");
      if (!saved || typeof saved !== "object") return null;
      const code = normalizeCode(saved.code);
      if (!code || !["host", "guest"].includes(saved.role)) return null;
      return {
        code,
        role: saved.role,
        hostId: normalizeHostId(saved.hostId, code),
        updatedAt: Number(saved.updatedAt) || Date.now(),
      };
    } catch (error) { return null; }
  }

  function saveRoom() {
    if (activeRoom) safeSet(ROOM_KEY, JSON.stringify(activeRoom));
    else safeRemove(ROOM_KEY);
  }

  function getPublicRoomState() {
    return {
      room: activeRoom ? { code: activeRoom.code, role: activeRoom.role, hostId: activeRoom.hostId } : null,
      role: myRole,
      online: Boolean(activeRoom && connection?.open),
      message: lastStatus.message,
      kind: lastStatus.kind,
    };
  }

  function announceRoomState() {
    window.dispatchEvent(new CustomEvent(ROOM_EVENT, { detail: getPublicRoomState() }));
  }

  function setStatus(message, kind = "waiting") {
    lastStatus = { message: String(message || ""), kind };
    if (sharedStatus) sharedStatus.textContent = message;
    if (connectionPill) {
      connectionPill.className = `shared-connection-pill is-${kind}`;
      connectionPill.textContent = kind === "online" ? "已连接" : kind === "waiting" ? "等待加入" : "未连接";
    }
    if (homeStatus) {
      homeStatus.textContent = activeRoom
        ? (kind === "online" ? `房间 ${activeRoom.code} 已连接，消息会实时同步` : `房间 ${activeRoom.code} 等待另一部手机加入`)
        : "创建房间，把消息和保存的内容同步给彼此";
    }
    announceRoomState();
  }

  function renderRoomUI() {
    const hasRoom = Boolean(activeRoom);
    if (joinPanel) joinPanel.hidden = hasRoom;
    if (roomPanel) roomPanel.hidden = !hasRoom;
    if (roomInput && hasRoom) roomInput.value = activeRoom.code;
    if (roomCode) roomCode.textContent = activeRoom?.code || "------";
    renderMessages();
    if (!hasRoom) setStatus("还没有共享房间", "offline");
  }

  function openSharedDialog() {
    roomWasOpened = true;
    const invite = readInviteFromUrl();
    renderRoomUI();
    if (!activeRoom && invite) setStatus("这是一个共享邀请，正在为你打开房间。", "waiting");
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    // 主机在等待对方加入时没有 DataConnection 也属于正常状态；不要因为再次打开弹窗
    // 就销毁已监听的主机 Peer。访客则只在尚未创建连接时重连。
    const peerUnavailable = !peer || peer.destroyed || peer.disconnected;
    const guestNeedsConnection = activeRoom?.role === "guest" && !connection;
    if (!CLOUD_PRIMARY && activeRoom && (peerUnavailable || guestNeedsConnection)) connectSavedRoom();
  }

  function closeSharedDialog() {
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function ensurePeerLibrary() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (loadingPeer) return loadingPeer;
    loadingPeer = new Promise((resolve, reject) => {
      let index = 0;
      const tryNext = () => {
        if (window.Peer) return resolve(window.Peer);
        if (index >= PEER_SOURCES.length) return reject(new Error("暂时无法连接共享服务"));
        const script = document.createElement("script");
        script.src = PEER_SOURCES[index++];
        script.async = true;
        script.onload = () => window.Peer ? resolve(window.Peer) : tryNext();
        script.onerror = tryNext;
        document.head.append(script);
      };
      tryNext();
    }).finally(() => { loadingPeer = null; });
    return loadingPeer;
  }

  function closePeer() {
    connectionGeneration += 1;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (storageBroadcastTimer) { clearTimeout(storageBroadcastTimer); storageBroadcastTimer = null; }
    if (connection) {
      try { connection.close(); } catch (error) { /* ignore */ }
      connection = null;
    }
    if (peer) {
      try { peer.destroy(); } catch (error) { /* ignore */ }
      peer = null;
    }
  }

  function makeRoom() {
    const code = randomCode();
    scopeRoomData(code);
    activeRoom = { code, role: "host", hostId: makeHostId(code), updatedAt: Date.now() };
    myRole = "host";
    hostUnavailableAttempts = 0;
    saveRoom();
    renderRoomUI();
    connectHost();
  }

  function joinRoom() {
    const code = normalizeCode(roomInput.value);
    if (code.length < 6) {
      setStatus("房间码需要至少 6 位，请再看一下邀请信息。", "offline");
      roomInput.focus();
      return;
    }
    const queryHost = new URLSearchParams(window.location.search).get("host");
    scopeRoomData(code);
    activeRoom = { code, role: "guest", hostId: normalizeHostId(queryHost, code), updatedAt: Date.now() };
    myRole = "guest";
    hostUnavailableAttempts = 0;
    saveRoom();
    renderRoomUI();
    connectGuest();
  }

  async function connectHost() {
    closePeer();
    const generation = connectionGeneration;
    const room = activeRoom;
    if (!room) return;
    setStatus("正在创建房间…", "waiting");
    try {
      await ensurePeerLibrary();
      if (generation !== connectionGeneration || activeRoom !== room) return;
      const nextPeer = new window.Peer(room.hostId, { debug: 0 });
      if (generation !== connectionGeneration || activeRoom !== room) {
        try { nextPeer.destroy(); } catch (error) { /* ignore */ }
        return;
      }
      peer = nextPeer;
      nextPeer.on("open", () => {
        if (generation !== connectionGeneration || peer !== nextPeer) return;
        hostUnavailableAttempts = 0;
        setStatus("房间已创建，把邀请链接发给她吧。", "waiting");
      });
      nextPeer.on("connection", (incoming) => {
        if (generation !== connectionGeneration || peer !== nextPeer) {
          try { incoming.close(); } catch (error) { /* ignore */ }
          return;
        }
        if (connection && connection.open) {
          incoming.close();
          return;
        }
        attachConnection(incoming, generation, nextPeer);
      });
      nextPeer.on("error", (error) => {
        if (generation !== connectionGeneration || peer !== nextPeer) return;
        if (error?.type === "unavailable-id") {
          // 恢复已有房间时不能擅自换房间码：另一台手机保存的链接仍指向旧房间。
          // PeerJS 通常会在旧连接释放后允许同一个 ID 再次注册，因此保留稳定 ID 并退避重试。
          hostUnavailableAttempts = Math.min(hostUnavailableAttempts + 1, 8);
          const retryDelay = Math.min(700 * (2 ** (hostUnavailableAttempts - 1)), 8000);
          setStatus("房间正在恢复连接，请稍等…", "waiting");
          try { nextPeer.destroy(); } catch (destroyError) { /* ignore */ }
          if (peer === nextPeer) peer = null;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (generation === connectionGeneration && activeRoom === room) connectHost();
          }, retryDelay);
          return;
        }
        setStatus("共享服务暂时连接不上，请检查网络后重试。", "offline");
        scheduleReconnect();
      });
    } catch (error) {
      if (generation !== connectionGeneration || activeRoom !== room) return;
      setStatus(error.message || "共享服务暂时不可用，页面仍可离线使用。", "offline");
    }
  }

  async function connectGuest() {
    closePeer();
    const generation = connectionGeneration;
    const room = activeRoom;
    if (!room) return;
    setStatus("正在寻找另一部手机…", "waiting");
    try {
      await ensurePeerLibrary();
      if (generation !== connectionGeneration || activeRoom !== room) return;
      const nextPeer = new window.Peer(undefined, { debug: 0 });
      if (generation !== connectionGeneration || activeRoom !== room) {
        try { nextPeer.destroy(); } catch (error) { /* ignore */ }
        return;
      }
      peer = nextPeer;
      nextPeer.on("open", () => {
        if (generation !== connectionGeneration || peer !== nextPeer || activeRoom !== room) return;
        const outgoing = nextPeer.connect(room.hostId, { reliable: true });
        attachConnection(outgoing, generation, nextPeer);
      });
      nextPeer.on("error", (error) => {
        if (generation !== connectionGeneration || peer !== nextPeer) return;
        if (error?.type === "peer-unavailable" || error?.type === "disconnected") {
          setStatus("还没找到对方。请确认她已打开同一个邀请链接。", "waiting");
          scheduleReconnect();
        } else {
          setStatus("共享服务暂时连接不上，请检查网络后重试。", "offline");
          scheduleReconnect();
        }
      });
    } catch (error) {
      if (generation !== connectionGeneration || activeRoom !== room) return;
      setStatus(error.message || "共享服务暂时不可用，页面仍可离线使用。", "offline");
    }
  }

  function attachConnection(nextConnection, generation = connectionGeneration, ownerPeer = peer) {
    connection = nextConnection;
    setStatus("正在牵手连接…", "waiting");
    connection.on("open", () => {
      if (generation !== connectionGeneration || peer !== ownerPeer || connection !== nextConnection) {
        try { nextConnection.close(); } catch (error) { /* ignore */ }
        return;
      }
      setStatus("已连接：你们现在可以互相发消息了。", "online");
      sendPacket({ type: "hello", snapshot: collectSnapshot() });
    });
    connection.on("data", (packet) => {
      if (generation !== connectionGeneration || peer !== ownerPeer || connection !== nextConnection) return;
      handlePacket(packet);
    });
    connection.on("close", () => {
      if (generation !== connectionGeneration || peer !== ownerPeer || connection !== nextConnection) return;
      connection = null;
      setStatus("对方暂时离开了，重新打开链接就会继续同步。", "waiting");
      scheduleReconnect();
    });
    connection.on("error", () => {
      if (generation === connectionGeneration && peer === ownerPeer && connection === nextConnection) setStatus("连接出现波动，正在等待重新连接…", "waiting");
    });
  }

  function scheduleReconnect() {
    if (!activeRoom || reconnectTimer || !roomWasOpened) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectSavedRoom();
    }, 2500);
  }

  function sendPacket(packet) {
    if (!connection || !connection.open) return false;
    try {
      const raw = JSON.stringify(packet);
      if (raw.length <= MAX_PACKET_CHARS) {
        connection.send(packet);
        return true;
      }
      const count = Math.ceil(raw.length / MAX_PACKET_CHARS);
      if (count > MAX_PACKET_CHUNKS) return false;
      const id = `packet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      for (let index = 0; index < count; index += 1) {
        connection.send({
          type: "packet-chunk",
          id,
          index,
          count,
          data: raw.slice(index * MAX_PACKET_CHARS, (index + 1) * MAX_PACKET_CHARS),
        });
      }
      return true;
    } catch (error) { return false; }
  }

  function clearExpiredPackets() {
    const cutoff = Date.now() - MAX_PENDING_PACKET_AGE;
    pendingPackets.forEach((entry, id) => {
      if (entry.createdAt < cutoff) pendingPackets.delete(id);
    });
  }

  function receivePacketChunk(packet) {
    if (!packet || typeof packet.id !== "string" || !Number.isInteger(packet.index) || !Number.isInteger(packet.count)
      || packet.count < 1 || packet.count > MAX_PACKET_CHUNKS || packet.index < 0 || packet.index >= packet.count || typeof packet.data !== "string") return;
    clearExpiredPackets();
    let entry = pendingPackets.get(packet.id);
    if (!entry) {
      entry = { createdAt: Date.now(), count: packet.count, parts: new Array(packet.count), received: 0 };
      pendingPackets.set(packet.id, entry);
    }
    if (entry.count !== packet.count || entry.parts[packet.index] !== undefined) return;
    entry.parts[packet.index] = packet.data;
    entry.received += 1;
    if (entry.received !== entry.count) return;
    pendingPackets.delete(packet.id);
    const complete = parseJSON(entry.parts.join(""), null);
    if (complete && typeof complete === "object") handlePacket(complete);
  }

  function parseJSON(raw, fallback = null) {
    try { return JSON.parse(raw); } catch (error) { return fallback; }
  }

  function compactArray(value) {
    const output = [];
    for (const item of value) {
      const candidate = JSON.stringify([...output, item]);
      if (candidate.length > MAX_SNAPSHOT_VALUE_CHARS) break;
      output.push(item);
    }
    return JSON.stringify(output);
  }

  function compactArchive(records) {
    const output = [];
    for (const record of records) {
      if (!record || typeof record !== "object") continue;
      const copy = { ...record };
      // 只发送完整的图片字符串；截断 base64 会生成无法显示的坏图片。
      copy.photos = Array.isArray(record.photos)
        ? record.photos.filter((photo) => typeof photo === "string" && photo.length <= MAX_SYNC_PHOTO_CHARS).slice(0, 3)
        : [];
      let candidate = JSON.stringify([...output, copy]);
      if (candidate.length > MAX_SNAPSHOT_VALUE_CHARS) {
        // 先保留记录文字和日期，必要时舍弃图片；不会损坏整个 JSON。
        copy.photos = [];
        candidate = JSON.stringify([...output, copy]);
        if (candidate.length > MAX_SNAPSHOT_VALUE_CHARS) break;
      }
      output.push(copy);
    }
    return JSON.stringify(output);
  }

  function compactChat(messages) {
    if (!Array.isArray(messages)) return "[]";
    const newestFirst = messages.slice(-100).reverse();
    const kept = [];
    for (const raw of newestFirst) {
      const message = normalizeMessage(raw);
      if (!message) continue;
      const candidate = JSON.stringify([message, ...kept]);
      if (candidate.length > MAX_SNAPSHOT_VALUE_CHARS) break;
      kept.unshift(message);
    }
    return JSON.stringify(kept);
  }

  function snapshotValue(key) {
    const raw = safeGet(key);
    if (raw == null) return null;
    if (raw.length <= MAX_SNAPSHOT_VALUE_CHARS) return raw;

    // 过大的值必须经过结构化压缩，绝不能直接 slice 原始 JSON。
    const parsed = parseJSON(raw, undefined);
    if (parsed === undefined) return null;
    if (key === "cute-date-invite-archive-v1" && Array.isArray(parsed)) return compactArchive(parsed);
    if (key === CHAT_KEY && Array.isArray(parsed)) return compactChat(parsed);
    if (Array.isArray(parsed)) return compactArray(parsed);
    if (typeof parsed === "string") return JSON.stringify(parsed.slice(0, MAX_SNAPSHOT_VALUE_CHARS - 2));
    if (parsed && typeof parsed === "object") {
      const compacted = {};
      Object.entries(parsed).forEach(([field, value]) => {
        const candidate = JSON.stringify({ ...compacted, [field]: value });
        if (candidate.length <= MAX_SNAPSHOT_VALUE_CHARS) compacted[field] = value;
      });
      const result = JSON.stringify(compacted);
      return result.length <= MAX_SNAPSHOT_VALUE_CHARS ? result : null;
    }
    return raw;
  }

  function collectSnapshot() {
    const data = {};
    let totalChars = 0;
    SYNC_KEYS.forEach((key) => {
      const value = snapshotValue(key);
      if (typeof value === "string" && totalChars + value.length <= MAX_SNAPSHOT_TOTAL_CHARS) {
        data[key] = value;
        totalChars += value.length;
      } else {
        // null 表示本次快照未携带该项；接收端会保留本地值。
        data[key] = null;
      }
    });
    return { roomCode: activeRoom?.code || syncRoomCode || "", data, meta: { ...keyMeta }, deleted: { ...keyTombstones }, sentAt: Date.now() };
  }

  function mergeArrays(key, localValue, remoteValue, localStamp = 0, remoteStamp = 0) {
    if (key === "cute-date-invite-100-things-v1") {
      const local = new Set(localValue.filter((item) => Number.isInteger(item)));
      const remote = new Set(remoteValue.filter((item) => Number.isInteger(item)));
      // 当较新的数组只是旧数组的子集时，视为一次取消勾选/删除，而不是重新并集。
      if (remoteStamp > localStamp && remote.size < local.size && [...remote].every((item) => local.has(item))) return [...remote];
      if (localStamp > remoteStamp && local.size < remote.size && [...local].every((item) => remote.has(item))) return [...local];
      return [...new Set([...local, ...remote])];
    }
    const hasIds = [...localValue, ...remoteValue].every((item) => item && typeof item === "object" && typeof item.id === "string");
    if (!hasIds) {
      const localKeys = new Set(localValue.map((item) => JSON.stringify(item)));
      const remoteKeys = new Set(remoteValue.map((item) => JSON.stringify(item)));
      if (remoteStamp > localStamp && remoteKeys.size < localKeys.size && [...remoteKeys].every((item) => localKeys.has(item))) return [...remoteValue];
      if (localStamp > remoteStamp && localKeys.size < remoteKeys.size && [...localKeys].every((item) => remoteKeys.has(item))) return [...localValue];
      return [...new Set([...localValue, ...remoteValue].map((item) => JSON.stringify(item)))].map((item) => parseJSON(item, item));
    }
    const localIds = new Set(localValue.map((item) => item.id));
    const remoteIds = new Set(remoteValue.map((item) => item.id));
    if (remoteStamp > localStamp && remoteIds.size < localIds.size && [...remoteIds].every((id) => localIds.has(id))) return remoteValue;
    if (localStamp > remoteStamp && localIds.size < remoteIds.size && [...localIds].every((id) => remoteIds.has(id))) return localValue;
    const merged = new Map();
    [...localValue, ...remoteValue].forEach((item) => {
      const previous = merged.get(item.id);
      if (!previous) merged.set(item.id, item);
      else {
        const previousTime = Number(previous.updatedAt || previous.createdAt || 0);
        const currentTime = Number(item.updatedAt || item.createdAt || 0);
        const shouldUseCurrent = currentTime > previousTime || (currentTime === previousTime && remoteStamp >= localStamp);
        merged.set(item.id, shouldUseCurrent ? item : previous);
      }
    });
    return [...merged.values()];
  }

  function mergeRawValue(key, localRaw, remoteRaw, localStamp, remoteStamp) {
    if (remoteRaw == null) return localRaw;
    if (localRaw == null) return remoteRaw;
    const localValue = parseJSON(localRaw, undefined);
    const remoteValue = parseJSON(remoteRaw, undefined);
    if (remoteValue === undefined) return localRaw;
    if (localValue === undefined) return remoteRaw;
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      return JSON.stringify(mergeArrays(key, localValue, remoteValue, localStamp, remoteStamp));
    }
    if (localValue && remoteValue && typeof localValue === "object" && typeof remoteValue === "object") {
      if (remoteStamp > localStamp) return remoteRaw;
      if (localStamp > remoteStamp) return localRaw;
      // 第一次连接时没有历史时间戳：保留双方不为空的字段，避免覆盖已有约会资料。
      return JSON.stringify({ ...localValue, ...Object.fromEntries(Object.entries(remoteValue).filter(([, value]) => value !== "" && value != null)) });
    }
    return remoteStamp > localStamp ? remoteRaw : localRaw;
  }

  function applySnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || !snapshot.data) return false;
    if (snapshot.roomCode && activeRoom && normalizeCode(snapshot.roomCode) !== activeRoom.code) return false;
    // 先把本机版本放进备份，再合并对方的计划、照片和纪念日。
    try { window.DateInviteBackups?.capture?.("收到对方同步内容"); } catch (error) { /* 备份不可用时仍继续同步 */ }
    let changed = false;
    applyingRemote = true;
    try {
      SYNC_KEYS.forEach((key) => {
        const remoteRaw = typeof snapshot.data[key] === "string" ? snapshot.data[key] : null;
        const localRaw = safeGet(key);
        const localStamp = Number(keyMeta[key] || 0);
        const remoteStamp = Number(snapshot.meta?.[key] || 0);
        const localDeletedAt = Number(keyTombstones[key] || 0);
        const remoteDeletedAt = Number(snapshot.deleted?.[key] || 0);

        // 远端明确删除且时间更新时，删除本地副本；旧快照不能把已删除内容复活。
        if (remoteDeletedAt > 0 && remoteDeletedAt >= remoteStamp) {
          if (remoteDeletedAt > Math.max(localStamp, localDeletedAt)) {
            let deletedApplied = true;
            if (localRaw != null) {
              if (safeRemove(key)) changed = true;
              else {
                deletedApplied = false;
                setStatus("本机存储空间不足，无法应用对方的删除操作。", "offline");
              }
            }
            if (deletedApplied) {
              keyMeta[key] = remoteDeletedAt;
              keyTombstones[key] = remoteDeletedAt;
            }
          }
          return;
        }
        // 本地删除标记比这份远端值更新时，保留删除标记，等待把它回传给对方。
        if (localDeletedAt >= remoteStamp && localDeletedAt > 0) return;
        // null 且没有删除标记表示该项没有被这次快照携带，不能覆盖本地值。
        if (remoteRaw == null) return;
        const merged = mergeRawValue(key, localRaw, remoteRaw, localStamp, remoteStamp);
        let applied = true;
        if (typeof merged === "string" && merged !== localRaw) {
          if (safeSet(key, merged)) changed = true;
          else {
            applied = false;
            setStatus("本机存储空间不足，部分共享内容未能保存。", "offline");
          }
        }
        if (!applied) return;
        if (remoteStamp > localStamp) keyMeta[key] = remoteStamp;
        if (remoteStamp >= localDeletedAt) delete keyTombstones[key];
      });
      persistMeta();
    } finally {
      applyingRemote = false;
    }
    if (changed) window.dispatchEvent(new CustomEvent("shared-sync-applied"));
    return changed;
  }

  function handlePacket(packet) {
    if (!packet || typeof packet !== "object") return;
    if (packet.type === "packet-chunk") {
      receivePacketChunk(packet);
      return;
    }
    if (packet.type === "shared-interactions/mind-match") {
      packetListeners.forEach((listener) => {
        try { listener(packet); } catch (error) { /* 单个订阅者失败不影响连接 */ }
      });
      return;
    }
    if (packet.type === "hello") {
      const changed = applySnapshot(packet.snapshot);
      sendPacket({ type: "snapshot", snapshot: collectSnapshot() });
      if (changed) announceSnapshotApplied();
      return;
    }
    if (packet.type === "snapshot") {
      const changed = applySnapshot(packet.snapshot);
      if (changed) announceSnapshotApplied();
      // 用一次性 ack 把本机更新（包括较新的值/删除墓碑）回传；ack 本身不再触发回包，避免快照来回循环。
      sendPacket({ type: "snapshot-ack", snapshot: collectSnapshot() });
      return;
    }
    if (packet.type === "snapshot-ack") {
      const changed = applySnapshot(packet.snapshot);
      if (changed) announceSnapshotApplied();
      return;
    }
    if (packet.type === "chat" && packet.message) {
      const changed = mergeMessages([packet.message]);
      if (changed) {
        renderMessages();
        sendPacket({ type: "chat-ack", id: packet.message.id });
      }
      return;
    }
    packetListeners.forEach((listener) => {
      try { listener(packet); } catch (error) { /* 单个订阅者失败不影响连接 */ }
    });
  }

  function announceSnapshotApplied() {
    renderMessages();
    setStatus("内容已同步：约会计划、照片、纪念日和和好小屋会自动显示在双方手机。", "online");
  }

  function loadMessages() {
    const parsed = parseJSON(safeGet(CHAT_KEY) || "[]", []);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeMessage).filter(Boolean).sort((a, b) => a.createdAt - b.createdAt).slice(-100);
  }

  function normalizeAttachment(value) {
    if (!value || typeof value !== "object") return null;
    const kind = ["image", "video", "audio"].includes(value.kind) ? value.kind : "";
    const data = typeof value.data === "string" ? value.data : "";
    const prefixes = {
      image: /^data:image\/(?:jpeg|png|webp|gif);base64,/i,
      video: /^data:video\/[a-z0-9.+-]+;base64,/i,
      audio: /^data:audio\/[a-z0-9.+-]+;base64,/i,
    };
    if (!kind || !prefixes[kind].test(data) || data.length > MAX_CHAT_ATTACHMENT_CHARS) return null;
    return {
      kind,
      data,
      name: String(value.name || "").replace(/[<>]/g, "").slice(0, 90),
      mime: String(value.mime || "").slice(0, 80),
    };
  }

  function normalizeMessage(item) {
    if (!item || typeof item !== "object") return null;
    const text = String(item.text || "").trim().slice(0, 500);
    const attachment = normalizeAttachment(item.attachment);
    if (!text && !attachment) return null;
    return {
      id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).slice(0, 100),
      author: item.author === "guest" ? "guest" : "host",
      text,
      attachment,
      createdAt: Number(item.createdAt) || Date.now(),
    };
  }

  function mergeMessages(incoming) {
    const current = loadMessages();
    const map = new Map(current.map((item) => [item.id, item]));
    let changed = false;
    incoming.forEach((item) => {
      const message = normalizeMessage(item);
      if (!message || map.has(message.id)) return;
      map.set(message.id, message);
      changed = true;
    });
    if (!changed) return false;
    const merged = [...map.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-100);
    try { window.DateInviteBackups?.capture?.("共享小纸条"); } catch (error) { /* 备份不可用时仍继续发送 */ }
    applyingRemote = true;
    safeSet(CHAT_KEY, JSON.stringify(merged));
    applyingRemote = false;
    touchKey(CHAT_KEY);
    window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { messages: merged } }));
    return true;
  }

  function appendAttachment(container, attachment) {
    if (!attachment) return;
    if (attachment.kind === "image") {
      const image = document.createElement("img");
      image.className = "shared-message-media shared-message-image";
      image.src = attachment.data;
      image.alt = attachment.name || "对方分享的照片";
      container.append(image);
      return;
    }
    const media = document.createElement(attachment.kind === "video" ? "video" : "audio");
    media.className = `shared-message-media shared-message-${attachment.kind}`;
    media.src = attachment.data;
    media.controls = true;
    media.preload = "metadata";
    if (attachment.kind === "video") media.playsInline = true;
    container.append(media);
  }

  function renderMessages() {
    if (!messagesView) return;
    const messages = loadMessages();
    messagesView.replaceChildren();
    if (!messages.length) {
      const empty = document.createElement("p");
      empty.className = "shared-empty";
      empty.textContent = "还没有小纸条，先发一句吧 ♥";
      messagesView.append(empty);
      return;
    }
    messages.forEach((message) => {
      const item = document.createElement("article");
      item.className = `shared-message ${message.author === myRole ? "is-me" : "is-them"}`;
      if (message.text) {
        const content = document.createElement("span");
        content.className = "shared-message-text";
        content.textContent = message.text;
        item.append(content);
      }
      appendAttachment(item, message.attachment);
      const meta = document.createElement("span");
      meta.className = "shared-message-meta";
      meta.textContent = `${message.author === myRole ? "我" : "对方"} · ${formatMessageTime(message.createdAt)}`;
      item.append(meta);
      messagesView.append(item);
    });
    messagesView.scrollTop = messagesView.scrollHeight;
    window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { messages } }));
  }

  function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "刚刚";
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  function sendSharedMessage(input = {}) {
    if (!activeRoom) return { ok: false, error: "先创建或加入一个房间，再发送消息。" };
    const message = normalizeMessage({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      author: myRole,
      text: input.text,
      attachment: input.attachment,
      createdAt: Date.now(),
    });
    if (!message) return { ok: false, error: "写一点话，或选择一张照片、视频、语音。" };
    mergeMessages([message]);
    renderMessages();
    const delivered = sendPacket({ type: "chat", message });
    if (!delivered) setStatus("消息已保存在本机，等对方上线后会补发。", "waiting");
    return { ok: true, delivered, message };
  }

  function sendMessage(event) {
    event.preventDefault();
    const text = String(messageInput.value || "").trim().slice(0, 240);
    if (!text) { messageInput.focus(); return; }
    const result = sendSharedMessage({ text });
    if (!result.ok) { setStatus(result.error, "offline"); return; }
    messageInput.value = "";
  }

  function scheduleSnapshotBroadcast() {
    if (CLOUD_PRIMARY) return;
    if (!activeRoom || !connection?.open || storageBroadcastTimer) return;
    storageBroadcastTimer = setTimeout(() => {
      storageBroadcastTimer = null;
      sendPacket({ type: "snapshot", snapshot: collectSnapshot() });
    }, 180);
  }

  async function copyText(value, successMessage) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const helper = document.createElement("textarea");
        helper.value = value; helper.setAttribute("readonly", ""); helper.style.position = "fixed"; helper.style.opacity = "0";
        document.body.append(helper); helper.select(); document.execCommand("copy"); helper.remove();
      }
      setStatus(successMessage, "waiting");
    } catch (error) { setStatus("复制失败，请长按链接复制。", "offline"); }
  }

  function inviteUrl() {
    if (!activeRoom) return window.location.href;
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("room", activeRoom.code);
    url.searchParams.set("host", activeRoom.hostId);
    return url.toString();
  }

  async function shareInvite() {
    const url = inviteUrl();
    try {
      if (navigator.share) { await navigator.share({ title: "Leo And Emily 双人共享房间", text: "点开链接加入我们的共享房间", url }); return; }
      await copyText(url, "邀请链接已复制，发给她就可以加入。" );
    } catch (error) {
      if (error?.name !== "AbortError") await copyText(url, "邀请链接已复制，发给她就可以加入。" );
    }
  }

  function leaveRoom() {
    closePeer();
    activeRoom = null;
    roomWasOpened = false;
    hostUnavailableAttempts = 0;
    saveRoom();
    clearInviteFromUrl();
    if (roomInput) roomInput.value = "";
    myRole = "host";
    renderRoomUI();
    setStatus("已退出房间，本机内容不会被删除。", "offline");
  }

  function connectHostOrGuest() {
    if (!activeRoom) return;
    if (activeRoom.role === "host") connectHost();
    else connectGuest();
  }

  function connectSavedRoom() {
    connectHostOrGuest();
  }

  function initFromUrl() {
    const invite = readInviteFromUrl();
    if (!invite) return false;

    // URL 邀请优先于上次保存的其他房间；同一个房间则保留本机的 host/guest 身份，
    // 避免主机自己重开分享链接时误把自己切换成访客。
    if (!activeRoom || activeRoom.code !== invite.code) {
      closePeer();
      scopeRoomData(invite.code);
      activeRoom = { code: invite.code, role: "guest", hostId: invite.hostId, updatedAt: Date.now() };
      myRole = "guest";
      hostUnavailableAttempts = 0;
      saveRoom();
    } else {
      scopeRoomData(activeRoom.code, true);
      myRole = activeRoom.role === "guest" ? "guest" : "host";
    }

    roomWasOpened = true;
    roomInput.value = invite.code;
    renderRoomUI();
    setStatus("正在打开共享邀请，稍等一下就会自动加入。", "waiting");
    // 弹窗打开后会根据当前 host/guest 状态创建一次连接，不要求再次输入房间码。
    openSharedDialog();
    return true;
  }

  function init() {
    if (!CLOUD_PRIMARY) patchStorage();
    openButtons.forEach((button) => button.addEventListener("click", openSharedDialog));
    closeButton?.addEventListener("click", closeSharedDialog);
    createButton.addEventListener("click", makeRoom);
    joinButton.addEventListener("click", joinRoom);
    roomInput.addEventListener("input", () => { roomInput.value = normalizeCode(roomInput.value); });
    copyLinkButton?.addEventListener("click", () => copyText(inviteUrl(), "邀请链接已复制，发给她就可以加入。"));
    shareLinkButton?.addEventListener("click", shareInvite);
    leaveButton?.addEventListener("click", leaveRoom);
    messageForm?.addEventListener("submit", sendMessage);
    dialog.addEventListener("cancel", closeSharedDialog);
    const openedFromInvite = CLOUD_PRIMARY ? false : initFromUrl();
    if (!openedFromInvite) renderRoomUI();
    if (!CLOUD_PRIMARY && !openedFromInvite && activeRoom) {
      // 已保存的房间代表用户主动配置过共享；页面重开后也应能自动恢复断线重连。
      roomWasOpened = true;
      scopeRoomData(activeRoom.code, true);
      roomInput.value = activeRoom.code;
      setStatus("正在恢复上次的共享房间…", "waiting");
      // 只在曾经主动创建/加入过房间时加载外部实时连接库。
      connectSavedRoom();
    }
  }

  function subscribePackets(listener) {
    if (typeof listener !== "function") return () => {};
    packetListeners.add(listener);
    return () => packetListeners.delete(listener);
  }

  function sendRealtimePacket(packet) {
    if (!activeRoom || !connection?.open) return false;
    return sendPacket(packet);
  }

  // 首页聊天和双人小游戏通过这一层读取房间状态；不暴露 PeerJS 对象，避免其他模块误关连接。
  window.DateInviteShared = {
    CHAT_KEY,
    INTERACTION_KEYS: [...INTERACTION_KEYS],
    ROOM_EVENT,
    CHAT_EVENT,
    getRoom: () => getPublicRoomState(),
    isBothOnline: () => Boolean(activeRoom && connection?.open),
    getMessages: () => loadMessages(),
    sendMessage: sendSharedMessage,
    sendRealtimePacket,
    subscribe: subscribePackets,
    openRoom: openSharedDialog,
    shareInvite,
    getInviteUrl: inviteUrl,
    syncNow: () => {
      if (CLOUD_PRIMARY) return false;
      if (!activeRoom) return false;
      return sendPacket({ type: "snapshot", snapshot: collectSnapshot() });
    },
  };

  // 让应用脚本先完成初始化，再挂载共享房间；同时兼容脚本被延后加载的情况。
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
