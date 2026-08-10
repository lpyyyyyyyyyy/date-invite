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
  // 照片库复用已有的回忆录档案键，因此无需新增云端白名单，也能沿用双端加密同步。
  const PHOTO_LIBRARY_ARCHIVE_KEY = "cute-date-invite-archive-v1";
  const PHOTO_LIBRARY_MARKER = "__leoEmilyPhotoLibrary";
  const PHOTO_LIBRARY_EVENT = "date-invite-photo-library-changed";
  const PHOTO_LIBRARY_MIXED_ID = "photo-library-mixed-v1";
  const MAX_LIBRARY_CATEGORIES = 18;
  const MAX_LIBRARY_PHOTOS = 72;
  const MAX_LIBRARY_IMAGE_CHARS = 320000;
  const KEYS = Object.freeze({
    polaroids: "cute-date-invite-polaroids-v1",
    voicePostcards: "cute-date-invite-voice-postcards-v1",
    mindMatches: "cute-date-invite-mind-matches-v1",
    messageWall: "cute-date-invite-message-wall-v1",
    worldPosts: "cute-date-invite-world-posts-v1"
  });
  const EVENT_NAME = "shared-interactions-changed";
  const AUTHOR_KEY = "cute-date-invite-interactions-author-v1";
  const MIND_EVENT_NAME = "shared-interactions-mind-match";
  const mindSessions = new Map();
  let mindTransport = null;
  let mindTransportUnsubscribe = null;
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
    if (kind === "worldPosts") return {
      ...base,
      message: text(value.message, 500),
      photos: Array.isArray(value.photos) ? value.photos.map((photo) => text(photo, MAX_IMAGE_CHARS)).filter(Boolean).slice(0, 3) : [],
      likes: Math.max(0, Math.min(9999, Number(value.likes) || 0)),
      comments: Array.isArray(value.comments) ? value.comments.map((comment) => ({
        id: text(comment?.id, 100) || uid("world-comment"),
        author: text(comment?.author, 32) || "我",
        message: text(comment?.message, 180),
        createdAt: Number(comment?.createdAt) || now()
      })).filter((comment) => comment.message).slice(0, 20) : []
    };
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
    let cancelled = false;
    const handlers = options.handlers || {};
    const stopTracks = () => stream?.getTracks().forEach((track) => track.stop());
    return {
      get state() { return recorder?.state || "inactive"; },
      async start() {
        if (cancelled) return false;
        const acquiredStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // 用户可能在浏览器权限弹窗仍打开时关闭了互动小屋。此时立刻释放
        // 刚取得的麦克风，避免出现看不见却仍在录音的状态。
        if (cancelled) {
          acquiredStream.getTracks().forEach((track) => track.stop());
          return false;
        }
        stream = acquiredStream;
        chunks = [];
        try {
          recorder = new MediaRecorder(stream, options.mediaRecorderOptions);
          recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
          recorder.onstart = () => handlers.onStart?.();
          recorder.onerror = (event) => handlers.onError?.(event.error || event);
          recorder.start();
        } catch (error) {
          stopTracks();
          recorder = null;
          throw error;
        }
        return true;
      },
      stop() {
        if (!recorder || recorder.state === "inactive") return Promise.resolve(null);
        return new Promise((resolve) => {
          recorder.onstop = async () => {
            stopTracks();
            const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            const reader = new FileReader();
            reader.onload = () => { const result = { blob, audioData: reader.result, duration: options.duration || 0 }; handlers.onStop?.(result); resolve(result); };
            reader.onerror = () => {
              // 通知界面层收尾，避免录音卡在“正在整理声音”。
              handlers.onStop?.(null);
              resolve(null);
            };
            reader.readAsDataURL(blob);
          };
          recorder.stop();
        });
      },
      cancel() {
        cancelled = true;
        if (recorder && recorder.state !== "inactive") recorder.stop();
        stopTracks();
        chunks = [];
      }
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
    try { mindTransportUnsubscribe?.(); } catch (error) { /* 切换房间时旧监听器可能已失效。 */ }
    mindTransport = adapter;
    mindPresenceOverride = null;
    mindTransportUnsubscribe = typeof adapter.subscribe === "function" ? adapter.subscribe(handleMindMatchPacket) : null;
    mindSessions.forEach((session) => refreshMindSession(session, mindOnline() ? "resumed" : "paused"));
    return () => {
      if (mindTransport !== adapter) return;
      try { mindTransportUnsubscribe?.(); } catch (error) { /* noop */ }
      mindTransportUnsubscribe = null;
      mindTransport = null;
    };
  }

  // ─── 回忆录照片库 ────────────────────────────────────────────────────────
  // 分类与照片作为带标记的“虚拟档案条目”写入 archive 键。app.js 会过滤该标记，
  // 所以不会把它们显示成一次约会；CloudBase 与旧房间同步却能自然合并它们。
  function libraryText(value, limit = 120) { return String(value == null ? "" : value).trim().slice(0, limit); }
  function libraryTimestamp(value, fallback = now()) { const stamp = Number(value); return Number.isFinite(stamp) && stamp > 0 ? stamp : fallback; }
  function isPhotoLibraryEntry(value) {
    return Boolean(value && typeof value === "object" && value[PHOTO_LIBRARY_MARKER] === true && (value.libraryType === "category" || value.libraryType === "photo"));
  }
  function photoLibraryRawRows() { return safeRead(PHOTO_LIBRARY_ARCHIVE_KEY, []); }
  function mixedPhotoCategory() { return { id: PHOTO_LIBRARY_MIXED_ID, name: "混合照片", fixed: true, createdAt: 0, updatedAt: 0 }; }

  function normalizeLibraryCategory(value) {
    if (!value || value.libraryType !== "category") return null;
    const id = libraryText(value.id, 100);
    const name = libraryText(value.name, 24);
    if (!id || !name || id === PHOTO_LIBRARY_MIXED_ID) return null;
    const createdAt = libraryTimestamp(value.createdAt);
    return { id, name, fixed: false, createdAt, updatedAt: libraryTimestamp(value.updatedAt, createdAt) };
  }

  function normalizeLibraryPhoto(value) {
    if (!value || value.libraryType !== "photo") return null;
    const id = libraryText(value.id, 100);
    const imageData = String(value.imageData || "").trim();
    if (!id || !/^data:image\//i.test(imageData) || imageData.length > MAX_LIBRARY_IMAGE_CHARS) return null;
    const createdAt = libraryTimestamp(value.createdAt);
    return {
      id,
      categoryId: libraryText(value.categoryId, 100) || PHOTO_LIBRARY_MIXED_ID,
      imageData,
      recordId: libraryText(value.recordId, 100),
      sourceLabel: libraryText(value.sourceLabel, 72) || "回忆录照片",
      createdAt,
      updatedAt: libraryTimestamp(value.updatedAt, createdAt),
      author: libraryText(value.author, 32)
    };
  }

  function readPhotoLibrary() {
    const rows = photoLibraryRawRows();
    const categoryMap = new Map([[PHOTO_LIBRARY_MIXED_ID, mixedPhotoCategory()]]);
    rows.filter(isPhotoLibraryEntry).forEach((entry) => {
      const category = normalizeLibraryCategory(entry);
      if (category) categoryMap.set(category.id, category);
    });
    const categories = [...categoryMap.values()].sort((left, right) => {
      if (left.fixed) return -1;
      if (right.fixed) return 1;
      return Number(left.createdAt) - Number(right.createdAt);
    });
    const validCategoryIds = new Set(categories.map((category) => category.id));
    const photos = rows
      .filter(isPhotoLibraryEntry)
      .map(normalizeLibraryPhoto)
      .filter(Boolean)
      .map((photo) => ({ ...photo, categoryId: validCategoryIds.has(photo.categoryId) ? photo.categoryId : PHOTO_LIBRARY_MIXED_ID }))
      .sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
    return { categories, photos };
  }

  function libraryEntryForCategory(category) {
    return {
      [PHOTO_LIBRARY_MARKER]: true,
      libraryType: "category",
      id: category.id,
      name: category.name,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    };
  }

  function libraryEntryForPhoto(photo) {
    return {
      [PHOTO_LIBRARY_MARKER]: true,
      libraryType: "photo",
      id: photo.id,
      categoryId: photo.categoryId,
      imageData: photo.imageData,
      recordId: photo.recordId,
      sourceLabel: photo.sourceLabel,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt,
      author: photo.author
    };
  }

  function writePhotoLibrary(next, action, item) {
    const state = next && typeof next === "object" ? next : { categories: [], photos: [] };
    const categoryItems = (Array.isArray(state.categories) ? state.categories : [])
      .filter((category) => category && !category.fixed)
      .map((category) => normalizeLibraryCategory({ ...category, libraryType: "category" }))
      .filter(Boolean)
      .slice(0, MAX_LIBRARY_CATEGORIES)
      .map(libraryEntryForCategory);
    const categoryIds = new Set([PHOTO_LIBRARY_MIXED_ID, ...categoryItems.map((category) => category.id)]);
    const photoItems = (Array.isArray(state.photos) ? state.photos : [])
      .map((photo) => normalizeLibraryPhoto({ ...photo, libraryType: "photo" }))
      .filter(Boolean)
      .map((photo) => ({ ...photo, categoryId: categoryIds.has(photo.categoryId) ? photo.categoryId : PHOTO_LIBRARY_MIXED_ID }))
      .slice(0, MAX_LIBRARY_PHOTOS)
      .map(libraryEntryForPhoto);
    const archiveRows = photoLibraryRawRows();
    const normalArchiveRows = archiveRows.filter((entry) => !isPhotoLibraryEntry(entry));
    try { window.DateInviteBackups?.capture?.("照片库保存前"); } catch (error) { /* 备份不可用时不阻塞保存。 */ }
    try {
      localStorage.setItem(PHOTO_LIBRARY_ARCHIVE_KEY, JSON.stringify([...normalArchiveRows, ...categoryItems, ...photoItems]));
    } catch (error) {
      throw new Error("本机存储空间不足，照片库暂时没有保存成功");
    }
    const detail = { action: libraryText(action, 40), item: item ? clone(item) : null, library: readPhotoLibrary() };
    emit("photoLibrary", detail.action, detail.item);
    window.dispatchEvent(new CustomEvent(PHOTO_LIBRARY_EVENT, { detail }));
    return detail.library;
  }

  function addPhotoLibraryCategory(name) {
    const state = readPhotoLibrary();
    const safeName = libraryText(name, 24);
    if (!safeName) throw new Error("先给这个分类起个名字吧");
    const existing = state.categories.find((category) => category.name.toLocaleLowerCase() === safeName.toLocaleLowerCase());
    if (existing) return clone(existing);
    if (state.categories.filter((category) => !category.fixed).length >= MAX_LIBRARY_CATEGORIES) throw new Error(`最多创建 ${MAX_LIBRARY_CATEGORIES} 个自定义分类`);
    const stamp = now();
    const category = { id: uid("photo-category"), name: safeName, fixed: false, createdAt: stamp, updatedAt: stamp };
    state.categories.push(category);
    writePhotoLibrary(state, "add-category", category);
    return clone(category);
  }

  function removePhotoLibraryCategory(id) {
    const categoryId = libraryText(id, 100);
    if (!categoryId || categoryId === PHOTO_LIBRARY_MIXED_ID) return false;
    const state = readPhotoLibrary();
    const category = state.categories.find((entry) => entry.id === categoryId && !entry.fixed);
    if (!category) return false;
    const stamp = now();
    state.categories = state.categories.filter((entry) => entry.id !== categoryId);
    state.photos = state.photos.map((photo) => photo.categoryId === categoryId ? { ...photo, categoryId: PHOTO_LIBRARY_MIXED_ID, updatedAt: stamp } : photo);
    writePhotoLibrary(state, "remove-category", { id: categoryId, name: category.name });
    return true;
  }

  function compactPhotoForLibrary(source) {
    const sourceData = String(source || "").trim();
    if (!/^data:image\//i.test(sourceData)) return Promise.reject(new Error("这张照片暂时无法收进照片库"));
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onerror = () => reject(new Error("照片读取失败，请再试一次"));
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) return reject(new Error("当前设备无法整理这张照片"));
          const originalWidth = image.naturalWidth || image.width;
          const originalHeight = image.naturalHeight || image.height;
          if (!originalWidth || !originalHeight) return reject(new Error("照片尺寸无效"));
          const presets = [[760, 0.7], [640, 0.64], [540, 0.58], [460, 0.52]];
          let compacted = "";
          for (const [maxSide, quality] of presets) {
            const scale = Math.min(1, maxSide / Math.max(originalWidth, originalHeight));
            canvas.width = Math.max(1, Math.round(originalWidth * scale));
            canvas.height = Math.max(1, Math.round(originalHeight * scale));
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            compacted = canvas.toDataURL("image/jpeg", quality);
            if (compacted.length <= MAX_LIBRARY_IMAGE_CHARS) break;
          }
          if (!compacted || compacted.length > MAX_LIBRARY_IMAGE_CHARS) return reject(new Error("这张照片太大，暂时无法收进照片库"));
          resolve(compacted);
        } catch (error) { reject(new Error("照片整理失败，请稍后再试")); }
      };
      image.src = sourceData;
    });
  }

  function librarySourceLabel(record) {
    const item = record && typeof record === "object" ? record : {};
    const date = libraryText(item.date, 16);
    const place = libraryText(item.location, 40);
    const activity = libraryText(item.activity, 24);
    return [date, place || activity].filter(Boolean).join(" · ") || "回忆录照片";
  }

  async function addPhotosToLibrary(input = {}) {
    const state = readPhotoLibrary();
    const requested = Array.isArray(input.photos) ? input.photos.filter((source) => /^data:image\//i.test(String(source || ""))) : [];
    if (!requested.length) throw new Error("没有找到可整理的照片");
    const remaining = Math.max(0, MAX_LIBRARY_PHOTOS - state.photos.length);
    if (!remaining) throw new Error(`照片库最多暂存 ${MAX_LIBRARY_PHOTOS} 张照片，请先整理或删除一些照片`);
    const categoryId = state.categories.some((category) => category.id === input.categoryId) ? input.categoryId : PHOTO_LIBRARY_MIXED_ID;
    const sources = requested.slice(0, remaining);
    const compacted = await Promise.all(sources.map(compactPhotoForLibrary));
    const stamp = now();
    const sourceLabel = librarySourceLabel(input.record);
    const photos = compacted.map((imageData, index) => ({
      id: uid("photo-library"),
      categoryId,
      imageData,
      recordId: libraryText(input.recordId, 100),
      sourceLabel,
      createdAt: stamp + index,
      updatedAt: stamp + index,
      author: author(input.author)
    }));
    state.photos = [...photos, ...state.photos];
    writePhotoLibrary(state, "add-photos", { count: photos.length, categoryId });
    return { photos: clone(photos), skipped: Math.max(0, requested.length - photos.length) };
  }

  function removePhotoLibraryPhoto(id) {
    const photoId = libraryText(id, 100);
    const state = readPhotoLibrary();
    const photo = state.photos.find((entry) => entry.id === photoId);
    if (!photo) return false;
    state.photos = state.photos.filter((entry) => entry.id !== photoId);
    writePhotoLibrary(state, "remove-photo", { id: photoId });
    return true;
  }

  // 下面是照片库的轻量 UI；数据函数仍可被其它页面或未来模块复用。
  let activePhotoLibraryCategory = PHOTO_LIBRARY_MIXED_ID;
  let pendingMemoryPhotos = null;
  let activePhotoLibraryPhotoId = "";

  function photoElement(id) { return document.getElementById(id); }
  function openPhotoDialog(dialog) {
    if (!dialog || dialog.open) return;
    try { if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", ""); } catch (error) { dialog.setAttribute("open", ""); }
  }
  function closePhotoDialog(dialog) {
    if (!dialog || !dialog.open) return;
    try { if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); } catch (error) { dialog.removeAttribute("open"); }
  }
  function photoLibraryCategoryName(id, state = readPhotoLibrary()) {
    return state.categories.find((category) => category.id === id)?.name || "混合照片";
  }
  function notifyPhotoLibrary(message) {
    const status = photoElement("photo-library-status");
    if (status) status.textContent = libraryText(message, 160);
  }

  function populatePhotoCategorySelect(select, selectedId = PHOTO_LIBRARY_MIXED_ID) {
    if (!select) return;
    const state = readPhotoLibrary();
    select.replaceChildren();
    state.categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      option.selected = category.id === selectedId;
      select.append(option);
    });
  }

  function renderPhotoLibrary() {
    const categoriesNode = photoElement("photo-library-categories");
    const grid = photoElement("photo-library-grid");
    const summary = photoElement("photo-library-summary");
    if (!categoriesNode || !grid) return;
    const state = readPhotoLibrary();
    if (!state.categories.some((category) => category.id === activePhotoLibraryCategory)) activePhotoLibraryCategory = PHOTO_LIBRARY_MIXED_ID;
    if (summary) summary.textContent = `${state.photos.length} 张照片 · ${state.categories.length} 个分类`;
    categoriesNode.replaceChildren();
    state.categories.forEach((category) => {
      const control = document.createElement("span");
      control.className = "photo-library-category-control";
      const filter = document.createElement("button");
      filter.type = "button";
      filter.className = "photo-library-category-filter";
      filter.textContent = `${category.name} ${state.photos.filter((photo) => photo.categoryId === category.id).length}`;
      filter.setAttribute("aria-pressed", String(category.id === activePhotoLibraryCategory));
      filter.addEventListener("click", () => { activePhotoLibraryCategory = category.id; renderPhotoLibrary(); });
      control.append(filter);
      if (!category.fixed) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "photo-library-category-delete";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `删除分类 ${category.name}，照片会移动到混合照片`);
        remove.addEventListener("click", () => {
          if (removePhotoLibraryCategory(category.id)) {
            activePhotoLibraryCategory = PHOTO_LIBRARY_MIXED_ID;
            notifyPhotoLibrary(`“${category.name}”已删除，照片已移到混合照片。`);
            renderPhotoLibrary();
          }
        });
        control.append(remove);
      }
      categoriesNode.append(control);
    });

    grid.replaceChildren();
    const photos = state.photos.filter((photo) => photo.categoryId === activePhotoLibraryCategory);
    if (!photos.length) {
      const empty = document.createElement("p");
      empty.className = "photo-library-empty";
      empty.textContent = activePhotoLibraryCategory === PHOTO_LIBRARY_MIXED_ID ? "这里会收下还没分好类的照片。下次添加回忆照片时，就可以放进来啦。" : "这个分类还没有照片。去回忆录添加一张吧。";
      grid.append(empty);
      return;
    }
    photos.forEach((photo) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "photo-library-photo";
      button.setAttribute("aria-label", `打开${photoLibraryCategoryName(photo.categoryId, state)}中的照片：${photo.sourceLabel}`);
      const image = document.createElement("img");
      image.src = photo.imageData;
      image.alt = `${photoLibraryCategoryName(photo.categoryId, state)} · ${photo.sourceLabel}`;
      image.loading = "lazy";
      image.decoding = "async";
      const label = document.createElement("span");
      label.textContent = photo.sourceLabel;
      button.append(image, label);
      button.addEventListener("click", () => openPhotoLibraryLightbox(photo.id));
      grid.append(button);
    });
  }

  function openPhotoLibraryLightbox(id) {
    const state = readPhotoLibrary();
    const photo = state.photos.find((entry) => entry.id === id);
    if (!photo) return;
    activePhotoLibraryPhotoId = photo.id;
    const image = photoElement("photo-library-lightbox-image");
    const title = photoElement("photo-library-lightbox-title");
    const copy = photoElement("photo-library-lightbox-copy");
    if (image) { image.src = photo.imageData; image.alt = `${photoLibraryCategoryName(photo.categoryId, state)} · ${photo.sourceLabel}`; }
    if (title) title.textContent = photoLibraryCategoryName(photo.categoryId, state);
    if (copy) copy.textContent = photo.sourceLabel;
    openPhotoDialog(photoElement("photo-library-lightbox"));
  }

  function downloadActivePhotoLibraryPhoto() {
    const photo = readPhotoLibrary().photos.find((entry) => entry.id === activePhotoLibraryPhotoId);
    if (!photo) return;
    const link = document.createElement("a");
    link.href = photo.imageData;
    link.download = `Leo-And-Emily-${libraryText(photo.sourceLabel, 30).replace(/[\\/:*?"<>|]/g, "-") || "photo"}.jpg`;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
  }

  function showPhotoLibraryAsk(detail) {
    const photos = Array.isArray(detail?.photos) ? detail.photos.filter((source) => /^data:image\//i.test(String(source || ""))) : [];
    if (!photos.length) return;
    pendingMemoryPhotos = { photos, recordId: libraryText(detail.recordId, 100), record: detail.record && typeof detail.record === "object" ? detail.record : {} };
    const askCopy = photoElement("photo-library-ask-copy");
    if (askCopy) askCopy.textContent = `这 ${photos.length} 张照片会和对方同步，随时都能在回忆录里翻出来。`;
    populatePhotoCategorySelect(photoElement("photo-library-ask-category"));
    openPhotoDialog(photoElement("photo-library-ask-dialog"));
  }

  function bindPhotoLibraryUi() {
    const libraryDialog = photoElement("photo-library-dialog");
    const askDialog = photoElement("photo-library-ask-dialog");
    const lightbox = photoElement("photo-library-lightbox");
    const categoryForm = photoElement("photo-library-category-form");
    const categoryInput = photoElement("photo-library-category-name");
    const askForm = photoElement("photo-library-ask-form");

    photoElement("photo-library-open")?.addEventListener("click", () => { renderPhotoLibrary(); openPhotoDialog(libraryDialog); });
    photoElement("photo-library-close")?.addEventListener("click", () => closePhotoDialog(libraryDialog));
    libraryDialog?.addEventListener("close", () => { if (categoryForm) categoryForm.hidden = true; });
    photoElement("photo-library-add-category")?.addEventListener("click", () => {
      if (!categoryForm) return;
      categoryForm.hidden = !categoryForm.hidden;
      if (!categoryForm.hidden) window.setTimeout(() => categoryInput?.focus(), 0);
    });
    photoElement("photo-library-category-cancel")?.addEventListener("click", () => { if (categoryForm) categoryForm.hidden = true; });
    categoryForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const category = addPhotoLibraryCategory(categoryInput?.value || "");
        activePhotoLibraryCategory = category.id;
        if (categoryInput) categoryInput.value = "";
        categoryForm.hidden = true;
        notifyPhotoLibrary(`“${category.name}”已经准备好。`);
        renderPhotoLibrary();
      } catch (error) { notifyPhotoLibrary(error?.message || "这个分类暂时没有创建成功"); }
    });

    photoElement("photo-library-skip")?.addEventListener("click", async () => {
      const pending = pendingMemoryPhotos;
      if (!pending) return closePhotoDialog(askDialog);
      const skip = photoElement("photo-library-skip");
      const submit = askForm?.querySelector("button[type=submit]");
      if (skip) { skip.disabled = true; skip.textContent = "正在收好…"; }
      if (submit) submit.disabled = true;
      try {
        const result = await addPhotosToLibrary({ ...pending, categoryId: PHOTO_LIBRARY_MIXED_ID });
        pendingMemoryPhotos = null;
        activePhotoLibraryCategory = PHOTO_LIBRARY_MIXED_ID;
        closePhotoDialog(askDialog);
        renderPhotoLibrary();
        notifyPhotoLibrary(result.skipped ? `已放进混合照片 ${result.photos.length} 张，剩下的可以下次再整理。` : `已放进混合照片 ${result.photos.length} 张，另一边也会看到。`);
      } catch (error) {
        const askCopy = photoElement("photo-library-ask-copy");
        if (askCopy) askCopy.textContent = error?.message || "照片暂时没有收进混合照片，可以稍后再试。";
      } finally {
        if (skip) { skip.disabled = false; skip.textContent = "放进混合照片"; }
        if (submit) submit.disabled = false;
      }
    });
    askDialog?.addEventListener("cancel", () => { pendingMemoryPhotos = null; });
    askForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const pending = pendingMemoryPhotos;
      if (!pending) return closePhotoDialog(askDialog);
      const submit = askForm.querySelector("button[type=submit]");
      if (submit) { submit.disabled = true; submit.textContent = "正在收好…"; }
      try {
        const categoryId = photoElement("photo-library-ask-category")?.value || PHOTO_LIBRARY_MIXED_ID;
        const result = await addPhotosToLibrary({ ...pending, categoryId });
        pendingMemoryPhotos = null;
        closePhotoDialog(askDialog);
        activePhotoLibraryCategory = categoryId;
        renderPhotoLibrary();
        notifyPhotoLibrary(result.skipped ? `已收好 ${result.photos.length} 张，剩下的照片可下次再整理。` : `已收好 ${result.photos.length} 张照片，另一边也会看到。`);
      } catch (error) {
        const askCopy = photoElement("photo-library-ask-copy");
        if (askCopy) askCopy.textContent = error?.message || "照片暂时没有收进照片库，可以稍后再试。";
      } finally {
        if (submit) { submit.disabled = false; submit.textContent = "收进照片库"; }
      }
    });

    photoElement("photo-library-lightbox-close")?.addEventListener("click", () => closePhotoDialog(lightbox));
    photoElement("photo-library-download")?.addEventListener("click", downloadActivePhotoLibraryPhoto);
    photoElement("photo-library-delete-photo")?.addEventListener("click", () => {
      const photo = readPhotoLibrary().photos.find((entry) => entry.id === activePhotoLibraryPhotoId);
      if (!photo) return closePhotoDialog(lightbox);
      const approved = typeof window.confirm !== "function" || window.confirm("确定只从照片库删除这张照片吗？原来的约会回忆不会受影响。");
      if (!approved) return;
      if (removePhotoLibraryPhoto(photo.id)) {
        closePhotoDialog(lightbox);
        notifyPhotoLibrary("已从照片库删除，原来的回忆照片还在。");
        renderPhotoLibrary();
      }
    });
    lightbox?.addEventListener("close", () => { activePhotoLibraryPhotoId = ""; });

    window.addEventListener("date-invite-memory-photos-added", (event) => showPhotoLibraryAsk(event.detail));
    window.addEventListener(PHOTO_LIBRARY_EVENT, () => { if (libraryDialog?.open) renderPhotoLibrary(); });
    window.addEventListener("shared-sync-applied", () => { if (libraryDialog?.open) renderPhotoLibrary(); });
  }

  bindPhotoLibraryUi();

  const api = {
    VERSION, KEYS, EVENT_NAME, author, read: (kind) => KEYS[kind] ? read(kind) : [],
    addPolaroid: (input) => add("polaroids", input), updatePolaroid: (id, patch) => update("polaroids", id, patch), removePolaroid: (id) => remove("polaroids", id),
    addVoicePostcard: (input) => add("voicePostcards", input), updateVoicePostcard: (id, patch) => update("voicePostcards", id, patch), removeVoicePostcard: (id) => remove("voicePostcards", id),
    addMindMatch: (input) => add("mindMatches", { ...input, ...evaluateMindMatch(input?.answerA, input?.answerB) }), updateMindMatch: (id, patch) => update("mindMatches", id, patch), removeMindMatch: (id) => remove("mindMatches", id),
    addWallMessage: (input) => add("messageWall", { ...input, message: text(input?.message, 500) }), updateWallMessage: (id, patch) => update("messageWall", id, patch), removeWallMessage: (id) => remove("messageWall", id),
    addWorldPost: (input) => add("worldPosts", input), updateWorldPost: (id, patch) => update("worldPosts", id, patch), removeWorldPost: (id) => remove("worldPosts", id),
    PHOTO_LIBRARY_ARCHIVE_KEY, PHOTO_LIBRARY_EVENT, PHOTO_LIBRARY_MIXED_ID,
    readPhotoLibrary: () => clone(readPhotoLibrary()),
    addPhotoLibraryCategory, removePhotoLibraryCategory, addPhotosToLibrary, removePhotoLibraryPhoto,
    evaluateMindMatch, collectSyncSnapshot, applySyncSnapshot, clear, createVoiceRecorder,
    MIND_EVENT_NAME, configureMindMatchTransport, handleMindMatchPacket, prepareMindMatch, setMindReady, submitMindAnswer, setMindRoomPresence,
    getMindMatchSession: (id) => publicMindSession(mindSessions.get(id)),
    subscribe(listener) { window.addEventListener(EVENT_NAME, listener); return () => window.removeEventListener(EVENT_NAME, listener); }
  };
  window.SharedInteractions = api;
})();
