(() => {
  "use strict";

  /*
   * 共享互动的无 DOM 数据层。它不会修改现有应用状态；页面可用下方的
   * collectSyncSnapshot/applySyncSnapshot 与现有 WebRTC 房间透传。
   */
  const VERSION = 1;
  const MAX_ITEMS = 120;
  const MAX_TEXT = 3000;
  const MAX_IMAGE_CHARS = 1000000;
  const KEYS = Object.freeze({
    polaroids: "cute-date-invite-polaroids-v1",
    voicePostcards: "cute-date-invite-voice-postcards-v1",
    mindMatches: "cute-date-invite-mind-matches-v1",
    messageWall: "cute-date-invite-message-wall-v1"
  });
  const EVENT_NAME = "shared-interactions-changed";
  const AUTHOR_KEY = "cute-date-invite-interactions-author-v1";
  const MIND_EVENT_NAME = "shared-interactions-mind-match";
  const mindSessions = new Map();
  let mindTransport = null;
  let mindPresenceOverride = null;

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function safeRead(key, fallback = []) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : fallback;
    } catch (error) { return fallback; }
  }

  function safeWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value.slice(0, MAX_ITEMS))); return true; } catch (error) { return false; }
  }

  function now() { return Date.now(); }
  function text(value, limit = MAX_TEXT) { return String(value || "").trim().slice(0, limit); }
  function author(value) {
    const candidate = text(value, 32);
    if (candidate) {
      try { localStorage.setItem(AUTHOR_KEY, candidate); } catch (error) { /* private mode */ }
      return candidate;
    }
    try { return text(localStorage.getItem(AUTHOR_KEY), 32) || "我"; } catch (error) { return "我"; }
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function normalize(kind, item) {
    const value = item && typeof item === "object" ? item : {};
    const createdAt = Number(value.createdAt) || now();
    const updatedAt = Number(value.updatedAt) || createdAt;
    const base = { id: text(value.id, 100) || uid(kind), createdAt, updatedAt, author: text(value.author, 32) || "我" };
    if (kind === "polaroids") return {
      ...base,
      imageData: text(value.imageData, MAX_IMAGE_CHARS),
      caption: text(value.caption, 180),
      filter: text(value.filter, 24) || "original",
      frameId: text(value.frameId, 100),
      side: text(value.side, 12),
    };
    if (kind === "voicePostcards") return { ...base, audioData: text(value.audioData, MAX_IMAGE_CHARS), transcript: text(value.transcript, 1000), duration: Math.max(0, Math.min(600, Number(value.duration) || 0)) };
    if (kind === "mindMatches") return { ...base, prompt: text(value.prompt, 180), answerA: text(value.answerA, 300), answerB: text(value.answerB, 300), matched: Boolean(value.matched) };
    return { ...base, message: text(value.message, 500), pinned: Boolean(value.pinned) };
  }

  function read(kind) { return safeRead(KEYS[kind]).map((item) => normalize(kind, item)); }
  function emit(kind, action, item) {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { kind, action, item: item ? clone(item) : null } }));
  }
  function write(kind, items, action, item) {
    const normalized = items.map((entry) => normalize(kind, entry)).sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
    if (!safeWrite(KEYS[kind], normalized)) throw new Error("本机存储空间不足");
    emit(kind, action, item);
    return item ? clone(item) : normalized;
  }
  function add(kind, input) {
    const item = normalize(kind, { ...input, author: input?.author || author(), id: input?.id || uid(kind.slice(0, 3)), createdAt: input?.createdAt || now(), updatedAt: now() });
    return write(kind, [item, ...read(kind).filter((entry) => entry.id !== item.id)], "add", item);
  }
  function update(kind, id, patch) {
    const items = read(kind);
    const previous = items.find((item) => item.id === id);
    if (!previous) return null;
    const item = normalize(kind, { ...previous, ...patch, id, updatedAt: now() });
    write(kind, items.map((entry) => entry.id === id ? item : entry), "update", item);
    return clone(item);
  }
  function remove(kind, id) {
    const items = read(kind);
    if (!items.some((item) => item.id === id)) return false;
    write(kind, items.filter((item) => item.id !== id), "remove", { id });
    return true;
  }

  function merge(kind, incoming) {
    if (!Array.isArray(incoming)) return false;
    const byId = new Map(read(kind).map((item) => [item.id, item]));
    incoming.map((item) => normalize(kind, item)).forEach((item) => {
      const previous = byId.get(item.id);
      if (!previous || Number(item.updatedAt) >= Number(previous.updatedAt)) byId.set(item.id, item);
    });
    const merged = [...byId.values()].sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt)).slice(0, MAX_ITEMS);
    const changed = JSON.stringify(merged) !== JSON.stringify(read(kind));
    if (changed) write(kind, merged, "merge");
    return changed;
  }

  function collectSyncSnapshot() {
    const data = {};
    Object.keys(KEYS).forEach((kind) => { data[kind] = read(kind); });
    return { format: "shared-interactions-v1", version: VERSION, data, sentAt: now() };
  }
  function applySyncSnapshot(snapshot) {
    if (!snapshot || snapshot.format !== "shared-interactions-v1" || !snapshot.data) return false;
    return Object.keys(KEYS).reduce((changed, kind) => merge(kind, snapshot.data[kind]) || changed, false);
  }

  function clear(kind) {
    if (!KEYS[kind]) return false;
    try { localStorage.removeItem(KEYS[kind]); emit(kind, "clear"); return true; } catch (error) { return false; }
  }

  function normalizedAnswer(value) { return text(value, 300).toLocaleLowerCase().replace(/[\s\u3000，。！？、,.!?]/g, ""); }
  function evaluateMindMatch(answerA, answerB) {
    const left = normalizedAnswer(answerA);
    const right = normalizedAnswer(answerB);
    if (!left || !right) return { matched: false, score: 0 };
    const same = left === right;
    const overlap = [...new Set(left)].filter((char) => right.includes(char)).length;
    const score = same ? 1 : Math.min(0.99, overlap / Math.max(left.length, right.length));
    return { matched: same || score >= 0.6, score: Number(score.toFixed(2)) };
  }

  function createVoiceRecorder(options = {}) {
    if (!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia)) throw new Error("此浏览器不支持录音");
    let recorder = null;
    let stream = null;
    let chunks = [];
    const handlers = options.handlers || {};
    return {
      get state() { return recorder?.state || "inactive"; },
      async start() {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        recorder = new MediaRecorder(stream, options.mediaRecorderOptions);
        recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
        recorder.onstart = () => handlers.onStart?.();
        recorder.onerror = (event) => handlers.onError?.(event.error || event);
        recorder.start();
      },
      stop() {
        if (!recorder || recorder.state === "inactive") return Promise.resolve(null);
        return new Promise((resolve) => {
          recorder.onstop = async () => {
            stream?.getTracks().forEach((track) => track.stop());
            const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            const reader = new FileReader();
            reader.onload = () => { const result = { blob, audioData: reader.result, duration: options.duration || 0 }; handlers.onStop?.(result); resolve(result); };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          };
          recorder.stop();
        });
      },
      cancel() { if (recorder && recorder.state !== "inactive") recorder.stop(); stream?.getTracks().forEach((track) => track.stop()); chunks = []; }
    };
  }

  // 实时心有灵犀不写入 localStorage，在双方提交前也不会放进同步快照。只有结果揭晓后才保存为 mindMatches 纪录。
  function mindOnline() { return Boolean(mindTransport?.isBothOnline?.()) && mindPresenceOverride !== false; }
  function emitMind(session, action) {
    window.dispatchEvent(new CustomEvent(MIND_EVENT_NAME, { detail: { action, session: publicMindSession(session) } }));
  }
  function sendMind(type, payload) {
    if (!mindTransport?.send) return false;
    try { return mindTransport.send({ type: "shared-interactions/mind-match", action: type, ...payload }) !== false; } catch (error) { return false; }
  }
  function publicMindSession(session) {
    if (!session) return null;
    const visible = session.status === "revealed";
    return clone({ ...session, localAnswer: visible ? session.localAnswer : "", remoteAnswer: visible ? session.remoteAnswer : "" });
  }
  function refreshMindSession(session, action = "state") {
    if (!mindOnline()) session.status = "paused";
    else if (session.localReady && session.remoteReady && !session.localSubmitted && !session.remoteSubmitted) session.status = "answering";
    else if (!session.localReady || !session.remoteReady) session.status = "waiting";
    emitMind(session, action);
    return publicMindSession(session);
  }
  function prepareMindMatch(input = {}) {
    if (!mindOnline()) throw new Error("需要双方共享房间同时在线才能开始");
    const session = {
      id: text(input.id, 100) || uid("mind-live"), prompt: text(input.prompt, 180), author: author(input.author),
      createdAt: now(), status: "waiting", localReady: false, remoteReady: false, localSubmitted: false, remoteSubmitted: false,
      localAnswer: "", remoteAnswer: "", revealSent: false
    };
    if (!session.prompt) throw new Error("请先写一个问题");
    mindSessions.set(session.id, session);
    sendMind("offer", { session: { id: session.id, prompt: session.prompt, author: session.author, createdAt: session.createdAt } });
    return refreshMindSession(session, "offer");
  }
  function setMindReady(id, ready = true) {
    const session = mindSessions.get(id);
    if (!session) throw new Error("没有找到这一局心有灵犀");
    if (!mindOnline()) return refreshMindSession(session, "paused");
    session.localReady = Boolean(ready);
    sendMind("ready", { id, ready: session.localReady });
    return refreshMindSession(session, "ready");
  }
  function submitMindAnswer(id, answerValue) {
    const session = mindSessions.get(id);
    if (!session) throw new Error("没有找到这一局心有灵犀");
    if (!mindOnline()) return refreshMindSession(session, "paused");
    if (session.status !== "answering" || !session.localReady || !session.remoteReady) throw new Error("要等双方都在线并点击准备后才能答题");
    const answerValueSafe = text(answerValue, 300);
    if (!answerValueSafe) throw new Error("请输入答案");
    session.localAnswer = answerValueSafe;
    session.localSubmitted = true;
    sendMind("submitted", { id }); // 只发送“已交答”，不发送答案。
    if (session.remoteSubmitted && !session.revealSent) {
      session.revealSent = true;
      sendMind("reveal", { id, answer: session.localAnswer });
    }
    return refreshMindSession(session, "submitted");
  }
  function revealMindMatch(session) {
    if (!session.localAnswer || !session.remoteAnswer || session.status === "revealed") return;
    session.status = "revealed";
    const score = evaluateMindMatch(session.localAnswer, session.remoteAnswer);
    add("mindMatches", { id: session.id, prompt: session.prompt, answerA: session.localAnswer, answerB: session.remoteAnswer, matched: score.matched, author: session.author, createdAt: session.createdAt });
    emitMind(session, "revealed");
  }
  function handleMindMatchPacket(packet) {
    if (!packet || packet.type !== "shared-interactions/mind-match") return false;
    if (packet.action === "offer" && packet.session?.id) {
      const remote = packet.session;
      if (!mindSessions.has(remote.id)) mindSessions.set(remote.id, { id: text(remote.id, 100), prompt: text(remote.prompt, 180), author: text(remote.author, 32) || "对方", createdAt: Number(remote.createdAt) || now(), status: "waiting", localReady: false, remoteReady: false, localSubmitted: false, remoteSubmitted: false, localAnswer: "", remoteAnswer: "", revealSent: false });
      refreshMindSession(mindSessions.get(remote.id), "offer-received");
      return true;
    }
    const session = mindSessions.get(packet.id);
    if (!session) return false;
    if (packet.action === "ready") { session.remoteReady = Boolean(packet.ready); refreshMindSession(session, "remote-ready"); return true; }
    if (packet.action === "submitted") {
      session.remoteSubmitted = true;
      if (session.localSubmitted && !session.revealSent) {
        session.revealSent = true;
        sendMind("reveal", { id: session.id, answer: session.localAnswer });
      }
      refreshMindSession(session, "remote-submitted");
      return true;
    }
    if (packet.action === "reveal") {
      // 只接受在自己也已交答后才发来的答案，防止单方提前泄露。
      if (!session.localSubmitted || !session.remoteSubmitted) return true;
      session.remoteAnswer = text(packet.answer, 300);
      if (session.localAnswer && !session.revealSent) {
        session.revealSent = true;
        sendMind("reveal", { id: session.id, answer: session.localAnswer });
      }
      revealMindMatch(session);
      return true;
    }
    if (packet.action === "leave") { session.status = "paused"; emitMind(session, "paused"); return true; }
    return false;
  }
  function setMindRoomPresence(isBothOnline) {
    const wasOnline = mindOnline();
    if (!mindTransport) mindTransport = { isBothOnline: () => true, send: () => false };
    mindPresenceOverride = Boolean(isBothOnline);
    mindSessions.forEach((session) => refreshMindSession(session, isBothOnline ? "resumed" : "paused"));
    if (wasOnline && !isBothOnline) mindSessions.forEach((session) => sendMind("leave", { id: session.id }));
  }
  function configureMindMatchTransport(adapter) {
    if (!adapter || typeof adapter.isBothOnline !== "function" || typeof adapter.send !== "function") throw new Error("需要 isBothOnline() 和 send(packet) 以接入共享房间");
    mindTransport = adapter;
    mindPresenceOverride = null;
    if (typeof adapter.subscribe === "function") adapter.subscribe(handleMindMatchPacket);
    mindSessions.forEach((session) => refreshMindSession(session, mindOnline() ? "resumed" : "paused"));
    return () => { if (mindTransport === adapter) mindTransport = null; };
  }

  const api = {
    VERSION, KEYS, EVENT_NAME, author, read: (kind) => KEYS[kind] ? read(kind) : [],
    addPolaroid: (input) => add("polaroids", input), updatePolaroid: (id, patch) => update("polaroids", id, patch), removePolaroid: (id) => remove("polaroids", id),
    addVoicePostcard: (input) => add("voicePostcards", input), updateVoicePostcard: (id, patch) => update("voicePostcards", id, patch), removeVoicePostcard: (id) => remove("voicePostcards", id),
    addMindMatch: (input) => add("mindMatches", { ...input, ...evaluateMindMatch(input?.answerA, input?.answerB) }), updateMindMatch: (id, patch) => update("mindMatches", id, patch), removeMindMatch: (id) => remove("mindMatches", id),
    addWallMessage: (input) => add("messageWall", { ...input, message: text(input?.message, 500) }), updateWallMessage: (id, patch) => update("messageWall", id, patch), removeWallMessage: (id) => remove("messageWall", id),
    evaluateMindMatch, collectSyncSnapshot, applySyncSnapshot, clear, createVoiceRecorder,
    MIND_EVENT_NAME, configureMindMatchTransport, handleMindMatchPacket, prepareMindMatch, setMindReady, submitMindAnswer, setMindRoomPresence,
    getMindMatchSession: (id) => publicMindSession(mindSessions.get(id)),
    subscribe(listener) { window.addEventListener(EVENT_NAME, listener); return () => window.removeEventListener(EVENT_NAME, listener); }
  };
  window.SharedInteractions = api;
})();
