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
  const SYNC_KEYS = [
    "cute-date-invite-v1",
    "cute-date-invite-archive-v1",
    "cute-date-invite-anniversaries-v1",
    "cute-date-invite-100-things-v1",
    "cute-date-invite-couple-notes-v1",
    "cute-date-invite-future-letters-v1",
    "cute-date-invite-cat-v1",
    "cute-date-invite-repair-v1",
    CHAT_KEY,
  ];
  const SYNC_KEY_SET = new Set(SYNC_KEYS);
  const PEER_SOURCES = [
    "https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js",
    "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js",
  ];
  const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }

  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (error) { return false; }
  }

  function safeRemove(key) {
    try { window.localStorage.removeItem(key); } catch (error) { /* ignore */ }
  }

  function readMeta() {
    try {
      const parsed = JSON.parse(safeGet(META_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) { return {}; }
  }

  let keyMeta = readMeta();

  function touchKey(key, at = Date.now()) {
    if (!SYNC_KEY_SET.has(key)) return;
    keyMeta[key] = Number.isFinite(at) ? at : Date.now();
    safeSet(META_KEY, JSON.stringify(keyMeta));
  }

  function patchStorage() {
    if (window.__dateInviteSharedStoragePatched) return;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      const result = originalSetItem.call(this, key, value);
      let isLocal = false;
      try { isLocal = this === window.localStorage; } catch (error) { isLocal = false; }
      if (isLocal && !applyingRemote && SYNC_KEY_SET.has(String(key))) {
        touchKey(String(key));
        scheduleSnapshotBroadcast();
      }
      return result;
    };
    Storage.prototype.removeItem = function patchedRemoveItem(key) {
      const result = originalRemoveItem.call(this, key);
      let isLocal = false;
      try { isLocal = this === window.localStorage; } catch (error) { isLocal = false; }
      if (isLocal && !applyingRemote && SYNC_KEY_SET.has(String(key))) {
        touchKey(String(key));
        scheduleSnapshotBroadcast();
      }
      return result;
    };
    window.__dateInviteSharedStoragePatched = true;
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

  function loadRoom() {
    try {
      const saved = JSON.parse(safeGet(ROOM_KEY) || "null");
      if (!saved || typeof saved !== "object") return null;
      const code = normalizeCode(saved.code);
      if (!code || !["host", "guest"].includes(saved.role)) return null;
      return {
        code,
        role: saved.role,
        hostId: typeof saved.hostId === "string" ? saved.hostId : makeHostId(code),
        updatedAt: Number(saved.updatedAt) || Date.now(),
      };
    } catch (error) { return null; }
  }

  function saveRoom() {
    if (activeRoom) safeSet(ROOM_KEY, JSON.stringify(activeRoom));
    else safeRemove(ROOM_KEY);
  }

  function setStatus(message, kind = "waiting") {
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
    const incomingCode = normalizeCode(new URLSearchParams(window.location.search).get("room"));
    renderRoomUI();
    if (!activeRoom && incomingCode) setStatus("这是一个共享邀请，输入后点击“加入”即可。", "waiting");
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    if (activeRoom && !peer) connectSavedRoom();
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
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
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
    activeRoom = { code, role: "host", hostId: makeHostId(code), updatedAt: Date.now() };
    myRole = "host";
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
    activeRoom = { code, role: "guest", hostId: queryHost || makeHostId(code), updatedAt: Date.now() };
    myRole = "guest";
    saveRoom();
    renderRoomUI();
    connectGuest();
  }

  async function connectHost() {
    closePeer();
    setStatus("正在创建房间…", "waiting");
    try {
      await ensurePeerLibrary();
      peer = new window.Peer(activeRoom.hostId, { debug: 0 });
      peer.on("open", () => setStatus("房间已创建，把邀请链接发给她吧。", "waiting"));
      peer.on("connection", (incoming) => {
        if (connection && connection.open) {
          incoming.close();
          return;
        }
        attachConnection(incoming);
      });
      peer.on("error", (error) => {
        if (error?.type === "unavailable-id") {
          setStatus("这个房间码刚好被占用，正在换一个新的…", "offline");
          activeRoom = { code: randomCode(), role: "host", hostId: "", updatedAt: Date.now() };
          activeRoom.hostId = makeHostId(activeRoom.code);
          saveRoom();
          renderRoomUI();
          setTimeout(connectHost, 120);
          return;
        }
        setStatus("共享服务暂时连接不上，请检查网络后重试。", "offline");
      });
    } catch (error) {
      setStatus(error.message || "共享服务暂时不可用，页面仍可离线使用。", "offline");
    }
  }

  async function connectGuest() {
    closePeer();
    setStatus("正在寻找另一部手机…", "waiting");
    try {
      await ensurePeerLibrary();
      peer = new window.Peer(undefined, { debug: 0 });
      peer.on("open", () => {
        const outgoing = peer.connect(activeRoom.hostId, { reliable: true });
        attachConnection(outgoing);
      });
      peer.on("error", (error) => {
        if (error?.type === "peer-unavailable" || error?.type === "disconnected") {
          setStatus("还没找到对方。请确认她已打开同一个邀请链接。", "waiting");
        } else {
          setStatus("共享服务暂时连接不上，请检查网络后重试。", "offline");
        }
      });
    } catch (error) {
      setStatus(error.message || "共享服务暂时不可用，页面仍可离线使用。", "offline");
    }
  }

  function attachConnection(nextConnection) {
    connection = nextConnection;
    setStatus("正在牵手连接…", "waiting");
    connection.on("open", () => {
      setStatus("已连接：你们现在可以互相发消息了。", "online");
      sendPacket({ type: "hello", snapshot: collectSnapshot() });
    });
    connection.on("data", handlePacket);
    connection.on("close", () => {
      if (connection === nextConnection) connection = null;
      setStatus("对方暂时离开了，重新打开链接就会继续同步。", "waiting");
      scheduleReconnect();
    });
    connection.on("error", () => setStatus("连接出现波动，正在等待重新连接…", "waiting"));
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
    try { connection.send(packet); return true; } catch (error) { return false; }
  }

  function parseJSON(raw, fallback = null) {
    try { return JSON.parse(raw); } catch (error) { return fallback; }
  }

  function snapshotValue(key) {
    const raw = safeGet(key);
    if (raw == null) return null;
    // 照片已经在应用内压缩过；再限制单张大小，避免 WebRTC 数据通道被大文件堵住。
    if (key === "cute-date-invite-archive-v1") {
      const records = parseJSON(raw, []);
      if (Array.isArray(records)) {
        return JSON.stringify(records.filter((record) => record && typeof record === "object").map((record) => ({
          ...record,
          photos: Array.isArray(record.photos) ? record.photos.slice(0, 3).map((photo) => String(photo).slice(0, 600000)) : [],
        })));
      }
    }
    return raw.length > 2800000 ? raw.slice(0, 2800000) : raw;
  }

  function collectSnapshot() {
    const data = {};
    SYNC_KEYS.forEach((key) => { data[key] = snapshotValue(key); });
    return { data, meta: { ...keyMeta }, sentAt: Date.now() };
  }

  function mergeArrays(key, localValue, remoteValue) {
    if (key === "cute-date-invite-100-things-v1") {
      return [...new Set([...localValue, ...remoteValue].filter((item) => Number.isInteger(item)))];
    }
    const hasIds = [...localValue, ...remoteValue].every((item) => item && typeof item === "object" && typeof item.id === "string");
    if (!hasIds) return [...new Set([...localValue, ...remoteValue])];
    const merged = new Map();
    [...localValue, ...remoteValue].forEach((item) => {
      const previous = merged.get(item.id);
      if (!previous) merged.set(item.id, item);
      else {
        const previousTime = Number(previous.updatedAt || previous.createdAt || 0);
        const currentTime = Number(item.updatedAt || item.createdAt || 0);
        merged.set(item.id, currentTime >= previousTime ? item : previous);
      }
    });
    return [...merged.values()];
  }

  function mergeRawValue(key, localRaw, remoteRaw, localStamp, remoteStamp) {
    if (remoteRaw == null) return localRaw;
    if (localRaw == null) return remoteRaw;
    const localValue = parseJSON(localRaw, undefined);
    const remoteValue = parseJSON(remoteRaw, undefined);
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      return JSON.stringify(mergeArrays(key, localValue, remoteValue));
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
    let changed = false;
    applyingRemote = true;
    try {
      SYNC_KEYS.forEach((key) => {
        const remoteRaw = typeof snapshot.data[key] === "string" ? snapshot.data[key] : null;
        if (remoteRaw == null) return;
        const localRaw = safeGet(key);
        const localStamp = Number(keyMeta[key] || 0);
        const remoteStamp = Number(snapshot.meta?.[key] || 0);
        const merged = mergeRawValue(key, localRaw, remoteRaw, localStamp, remoteStamp);
        if (typeof merged === "string" && merged !== localRaw) {
          safeSet(key, merged);
          changed = true;
        }
        if (remoteStamp > localStamp) keyMeta[key] = remoteStamp;
      });
      safeSet(META_KEY, JSON.stringify(keyMeta));
    } finally {
      applyingRemote = false;
    }
    if (changed) window.dispatchEvent(new CustomEvent("shared-sync-applied"));
    return changed;
  }

  function handlePacket(packet) {
    if (!packet || typeof packet !== "object") return;
    if (packet.type === "hello") {
      const changed = applySnapshot(packet.snapshot);
      sendPacket({ type: "snapshot", snapshot: collectSnapshot() });
      if (changed) renderMessages();
      return;
    }
    if (packet.type === "snapshot") {
      const changed = applySnapshot(packet.snapshot);
      if (changed) {
        renderMessages();
        sendPacket({ type: "snapshot", snapshot: collectSnapshot() });
      }
      return;
    }
    if (packet.type === "chat" && packet.message) {
      const changed = mergeMessages([packet.message]);
      if (changed) {
        renderMessages();
        sendPacket({ type: "chat-ack", id: packet.message.id });
      }
    }
  }

  function loadMessages() {
    const parsed = parseJSON(safeGet(CHAT_KEY) || "[]", []);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((message) => message && typeof message.id === "string" && typeof message.text === "string").slice(-100);
  }

  function mergeMessages(incoming) {
    const current = loadMessages();
    const map = new Map(current.map((item) => [item.id, item]));
    let changed = false;
    incoming.forEach((item) => {
      const message = {
        id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        author: item.author === "guest" ? "guest" : "host",
        text: String(item.text || "").slice(0, 240),
        createdAt: Number(item.createdAt) || Date.now(),
      };
      if (!message.text || map.has(message.id)) return;
      map.set(message.id, message);
      changed = true;
    });
    if (!changed) return false;
    const merged = [...map.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-100);
    applyingRemote = true;
    safeSet(CHAT_KEY, JSON.stringify(merged));
    applyingRemote = false;
    touchKey(CHAT_KEY);
    return true;
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
      const item = document.createElement("p");
      item.className = `shared-message ${message.author === myRole ? "is-me" : "is-them"}`;
      item.textContent = message.text;
      const meta = document.createElement("span");
      meta.className = "shared-message-meta";
      meta.textContent = `${message.author === myRole ? "我" : "对方"} · ${formatMessageTime(message.createdAt)}`;
      item.append(meta);
      messagesView.append(item);
    });
    messagesView.scrollTop = messagesView.scrollHeight;
  }

  function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "刚刚";
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  function sendMessage(event) {
    event.preventDefault();
    const text = String(messageInput.value || "").trim().slice(0, 240);
    if (!text) { messageInput.focus(); return; }
    if (!activeRoom) {
      setStatus("先创建或加入一个房间，再发送小纸条。", "offline");
      return;
    }
    const message = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, author: myRole, text, createdAt: Date.now() };
    mergeMessages([message]);
    renderMessages();
    if (!sendPacket({ type: "chat", message })) setStatus("纸条已保存在本机，等对方上线后会补发。", "waiting");
    messageInput.value = "";
  }

  function scheduleSnapshotBroadcast() {
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
    saveRoom();
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
    const params = new URLSearchParams(window.location.search);
    const incomingCode = normalizeCode(params.get("room"));
    if (incomingCode) {
      if (activeRoom && activeRoom.code !== incomingCode) {
        closePeer();
        activeRoom = null;
        saveRoom();
        myRole = "host";
        renderRoomUI();
      }
      roomInput.value = incomingCode;
      setStatus("这是一个共享邀请，输入后点击“加入”即可。", "waiting");
      setTimeout(openSharedDialog, 120);
    }
  }

  function init() {
    patchStorage();
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
    renderRoomUI();
    if (activeRoom) {
      roomInput.value = activeRoom.code;
      setStatus("正在恢复上次的共享房间…", "waiting");
      // 只在曾经主动创建/加入过房间时加载外部实时连接库。
      connectSavedRoom();
    }
    initFromUrl();
  }

  // 让应用脚本先完成初始化，再挂载共享房间；同时兼容脚本被延后加载的情况。
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
