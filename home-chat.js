(() => {
  "use strict";

  const MAX_VIDEO_BYTES = 1024 * 1024;
  const MAX_AUDIO_CHARS = 940000;
  const CHAT_KEY = "cute-date-invite-shared-messages-v1";
  const CHAT_EVENT = "date-invite-chat-changed";
  const DATE_PLAN_CHAT_EVENT = "date-invite-plan-card-created";
  const MIND_PROMPTS = [
    "如果现在可以一起出门，你最想去哪里？",
    "我们下一次约会最应该吃什么？",
    "你觉得我们最适合一起做的事是什么？",
    "想把哪一个瞬间做成永远的回忆？",
    "如果今天只能对对方说三个字，你会说什么？",
    "我们最想一起完成的 100 件事里，先完成哪一件？",
  ];

  let toastTimer = null;
  let pendingAttachment = null;
  let mediaSending = false;
  let selectedPolaroidFrame = "";
  let voiceRecorder = null;
  let voiceStartedAt = 0;
  let voiceStopTimer = null;
  let activeMindId = "";
  const attachmentSources = new Map();

  const byId = (id) => document.querySelector(`#${id}`);
  const shared = () => window.DateInviteShared || null;
  const cloud = () => window.DateInviteCloud || null;
  const interactions = () => window.SharedInteractions || null;

  function notice(message) {
    const toast = byId("toast");
    if (!toast) return;
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = String(message || "");
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  }

  function roomState() {
    const cloudSync = cloud();
    if (cloudSync?.isPaired?.()) {
      const status = cloudSync.getStatus?.() || {};
      return {
        room: { cloud: true },
        role: cloudSync.getRole?.() || "host",
        online: Boolean(cloudSync.isBothOnline?.()),
        kind: "cloud",
        message: status.message || "正在连接云端共同空间…"
      };
    }
    return shared()?.getRoom?.() || { room: null, role: "host", online: false, kind: "offline", message: "正在准备共享空间…" };
  }

  function cloudIsActive() { return Boolean(cloud()?.isPaired?.()); }
  function syncCurrent() {
    if (cloudIsActive()) cloud()?.syncNow?.();
    else shared()?.syncNow?.();
  }

  function displayName(role) {
    return role === "guest" ? "Emily" : "Leo";
  }

  function formatTime(timestamp) {
    const date = new Date(Number(timestamp) || Date.now());
    return Number.isNaN(date.getTime()) ? "刚刚" : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
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

  function normalizeChatAttachment(value) {
    if (!value || typeof value !== "object") return null;
    const kind = ["image", "video", "audio"].includes(value.kind) ? value.kind : "";
    const data = typeof value.data === "string" ? value.data : "";
    const fileId = attachmentFileId(value);
    if (!kind || (!data && !fileId)) return null;
    const size = Number(value.size);
    return {
      kind,
      data,
      fileId,
      name: String(value.name || "").slice(0, 180),
      mime: String(value.mime || "").slice(0, 120),
      size: Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0
    };
  }

  function normalizeStoredChatMessage(value) {
    if (!value || typeof value !== "object") return null;
    const text = String(value.text || "").trim().slice(0, 500);
    const attachment = normalizeChatAttachment(value.attachment);
    const plan = value.type === "date-plan" || value.kind === "date-plan" ? normalizeDatePlan(value.plan) : null;
    if (!text && !attachment?.data && !attachment?.fileId && !plan) return null;
    return {
      id: String(value.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 100),
      author: value.author === "guest" ? "guest" : "host",
      text,
      attachment,
      type: plan ? "date-plan" : "text",
      kind: plan ? "date-plan" : "text",
      plan,
      createdAt: Number(value.createdAt) || Date.now()
    };
  }

  function readStoredChatMessages() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CHAT_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.map(normalizeStoredChatMessage).filter(Boolean).sort((left, right) => left.createdAt - right.createdAt).slice(-100)
        : [];
    } catch (error) {
      return [];
    }
  }

  function formatPlanDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(value || "待定");
    return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
  }

  function datePlanText(plan) {
    return `发起了一个约会计划：${formatPlanDate(plan.date)} ${plan.time || "时间待定"}，地点：${plan.location || "待定"}，玩：${plan.activity || "待定"}，吃：${plan.menu || "待定"}`;
  }

  function appendDatePlanCard(container, plan) {
    const card = document.createElement("section");
    card.className = "home-chat-date-plan";
    card.setAttribute("aria-label", `新的约会计划：${formatPlanDate(plan.date)}`);
    const title = document.createElement("strong");
    title.className = "home-chat-date-plan-title";
    title.textContent = "💌 新的约会计划";
    card.append(title);
    const details = document.createElement("div");
    details.className = "home-chat-date-plan-details";
    [
      ["日期", formatPlanDate(plan.date)],
      ["时间", plan.time || "待定"],
      ["地点", plan.location || "待定"],
      ["玩什么", plan.activity || "待定"],
      ["吃什么", plan.menu || "待定"]
    ].forEach(([label, value]) => {
      const row = document.createElement("p");
      const name = document.createElement("span");
      name.textContent = `${label}：`;
      const content = document.createElement("span");
      content.textContent = value;
      row.append(name, content);
      details.append(row);
    });
    card.append(details);
    container.append(card);
  }

  function savePlanCardLocally(message) {
    const messages = readStoredChatMessages();
    if (!messages.some((item) => item.id === message.id)) messages.push(message);
    const trimmed = messages.sort((left, right) => left.createdAt - right.createdAt).slice(-100);
    try {
      try { window.DateInviteBackups?.capture?.("发送约会计划前"); } catch (backupError) { /* 备份不可用时不阻塞计划卡。 */ }
      window.localStorage.setItem(CHAT_KEY, JSON.stringify(trimmed));
    } catch (error) {
      return { ok: false, error: "本机存储空间不足，约会卡片没有保存。" };
    }
    window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { messages: trimmed } }));
    return { ok: true, delivered: false, message };
  }

  function sendDatePlanCard(input) {
    const plan = normalizeDatePlan(input);
    if (!plan) return { ok: false, error: "约会计划不完整，暂时不能发送。" };
    const message = {
      id: String(input?.id || plan.id || `date-plan-${Date.now()}`).slice(0, 100),
      type: "date-plan",
      kind: "date-plan",
      plan,
      text: datePlanText(plan),
      createdAt: Date.now()
    };
    const cloudSync = cloud();
    if (cloudIsActive() && typeof cloudSync?.sendMessage === "function") {
      return cloudSync.sendMessage(message);
    }
    return savePlanCardLocally({ ...message, author: roomState().role });
  }

  function attachmentSourceKey(attachment) {
    return attachmentFileId(attachment);
  }

  function rememberAttachmentSource(attachment, source) {
    const key = attachmentSourceKey(attachment);
    if (!key || !source) return;
    attachmentSources.set(key, Promise.resolve(source));
  }

  function sourceForAttachment(attachment) {
    if (attachment?.data) return Promise.resolve(attachment.data);
    const key = attachmentSourceKey(attachment);
    if (!key) return Promise.reject(new Error("没有找到这份附件。"));
    const existing = attachmentSources.get(key);
    if (existing) return existing;
    const task = Promise.resolve(cloud()?.downloadAttachment?.(attachment))
      .then((blob) => {
        if (!blob) throw new Error("云端没有返回这份附件。" );
        if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") return URL.createObjectURL(blob);
        return readAsDataURL(blob);
      });
    attachmentSources.set(key, task);
    task.catch(() => attachmentSources.delete(key));
    return task;
  }

  function attachmentDownloadName(attachment) {
    const raw = String(attachment?.name || "Leo-And-Emily-照片").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
    return raw || "Leo-And-Emily-照片";
  }

  async function downloadChatAttachment(attachment) {
    try {
      const source = await sourceForAttachment(attachment);
      const anchor = document.createElement("a");
      anchor.href = source;
      anchor.download = attachmentDownloadName(attachment);
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      notice(error?.message || "这张照片暂时无法下载，请稍后再试。");
    }
  }

  function makeImageDownloadable(image, attachment) {
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", `下载照片：${attachmentDownloadName(attachment)}`);
    image.addEventListener("click", () => downloadChatAttachment(attachment));
    image.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        downloadChatAttachment(attachment);
      }
    });
  }

  function setMediaSource(media, attachment) {
    sourceForAttachment(attachment)
      .then((source) => { media.src = source; media.removeAttribute("aria-busy"); })
      .catch(() => {
        media.setAttribute("aria-busy", "false");
        if (attachment.kind === "image") media.alt = "照片加载失败，点击可重试下载";
      });
  }

  function appendMedia(parent, attachment) {
    if (!attachment?.data && !attachmentFileId(attachment)) return;
    if (attachment.kind === "image") {
      const image = document.createElement("img");
      image.alt = attachment.name || "分享的照片";
      image.className = "home-chat-media home-chat-image";
      makeImageDownloadable(image, attachment);
      if (attachment.data) image.src = attachment.data;
      else {
        image.setAttribute("aria-busy", "true");
        setMediaSource(image, attachment);
      }
      parent.append(image);
      return;
    }
    const media = document.createElement(attachment.kind === "video" ? "video" : "audio");
    media.controls = true;
    media.preload = "metadata";
    media.className = `home-chat-media home-chat-${attachment.kind}`;
    if (attachment.kind === "video") media.playsInline = true;
    if (attachment.data) media.src = attachment.data;
    else {
      media.setAttribute("aria-busy", "true");
      setMediaSource(media, attachment);
    }
    parent.append(media);
  }

  function renderChatStatus() {
    const status = byId("home-chat-status");
    const presence = byId("home-chat-presence");
    if (!status) return;
    const state = roomState();
    const setPresence = (online, label) => {
      if (!presence) return;
      presence.classList.toggle("is-online", Boolean(online));
      const dot = document.createElement("i");
      dot.setAttribute("aria-hidden", "true");
      presence.replaceChildren(dot, document.createTextNode(label));
    };
    if (!state.room) {
      status.textContent = "还没有连接你们的空间 · 点右上角主题里的「两人空间」创建一次就好";
      status.dataset.tone = "offline";
      setPresence(false, "还未连接");
      return;
    }
    if (state.kind === "cloud") {
      const cloudStatus = cloud()?.getStatus?.() || {};
      if (cloudStatus.kind === "waiting") {
        status.textContent = "本机已保存，云端正在等待网络恢复后自动同步";
        status.dataset.tone = "offline";
        setPresence(false, "等待连接");
      } else {
        status.textContent = state.online ? "云端已连上，她也正在这个共同空间里 ♡" : "云端已记住你们的空间，她打开网站就会看到最新消息";
        status.dataset.tone = state.online ? "online" : "waiting";
        setPresence(state.online, state.online ? "一起在线" : "云端已连接");
      }
      return;
    }
    status.textContent = state.online ? "你们已连上，可以实时聊天啦 ♥" : "已记住你们的空间，正在等对方上线…";
    status.dataset.tone = state.online ? "online" : "waiting";
    setPresence(state.online, state.online ? "一起在线" : "等待对方");
  }

  function openInteractions() {
    const dialog = byId("interactions-dialog");
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else dialog.setAttribute("open", "");
    renderPolaroids();
    renderVoicePostcards();
    renderWall();
    renderMind();
  }

  function closeInteractions() {
    const dialog = byId("interactions-dialog");
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function renderHomeChat() {
    const list = byId("home-chat-list");
    if (!list) return;
    const messages = cloudIsActive()
      ? (cloud()?.getMessages?.() || [])
      : (readStoredChatMessages().length ? readStoredChatMessages() : (shared()?.getMessages?.() || []));
    const mine = roomState().role;
    list.replaceChildren();
    if (!messages.length) {
      const empty = document.createElement("p");
      empty.className = "home-chat-empty";
      empty.textContent = "今天想对她说点什么？";
      list.append(empty);
      return;
    }
    messages.forEach((message) => {
      const card = document.createElement("article");
      card.className = `home-chat-bubble ${message.author === mine ? "is-me" : "is-them"}`;
      if ((message.type === "date-plan" || message.kind === "date-plan") && message.plan) {
        card.classList.add("is-date-plan");
        appendDatePlanCard(card, message.plan);
      } else if (message.text) {
        const text = document.createElement("p");
        text.textContent = message.text;
        card.append(text);
      }
      appendMedia(card, message.attachment);
      const meta = document.createElement("small");
      meta.textContent = `${message.author === mine ? "我" : "对方"} · ${formatTime(message.createdAt)}`;
      card.append(meta);
      list.append(card);
    });
    list.scrollTop = list.scrollHeight;
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("文件读取失败，请再试一次"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  function compressImage(file, maxLength = 820000) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("这张图片无法使用"));
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) return reject(new Error("这台设备暂时不能处理图片"));
          const presets = [[1280, 0.8], [1050, 0.74], [880, 0.68], [720, 0.6], [560, 0.55]];
          let result = "";
          for (const [size, quality] of presets) {
            const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            result = canvas.toDataURL("image/jpeg", quality);
            if (result.length <= maxLength) break;
          }
          if (!result || result.length > maxLength) return reject(new Error("图片还是太大，请换一张或裁剪后再发"));
          resolve(result);
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  function updateMediaPreview() {
    const preview = byId("home-chat-media-preview");
    if (!preview) return;
    preview.replaceChildren();
    if (!pendingAttachment) { preview.hidden = true; return; }
    preview.hidden = false;
    const label = document.createElement("span");
    if (pendingAttachment.sending) {
      const progress = pendingAttachment.total > 1 ? `（${pendingAttachment.index}/${pendingAttachment.total}）` : "";
      label.textContent = pendingAttachment.kind === "image" ? `正在发送原图${progress}…` : `正在发送附件${progress}…`;
    }
    else label.textContent = pendingAttachment.kind === "image" ? "已选照片" : pendingAttachment.kind === "video" ? "已选视频" : "已选语音";
    preview.append(label);
    if (pendingAttachment.sending) return;
    appendMedia(preview, pendingAttachment);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "home-chat-remove-media";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "移除待发送附件");
    remove.addEventListener("click", () => {
      pendingAttachment = null;
      const input = byId("home-media-input");
      if (input) input.value = "";
      updateMediaPreview();
    });
    preview.append(remove);
  }

  function chatMediaKind(file) {
    const mime = String(file?.type || "");
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "";
  }

  function setMediaSending(next) {
    mediaSending = Boolean(next);
    const mediaButton = byId("home-media-button");
    if (mediaButton) {
      mediaButton.disabled = mediaSending;
      mediaButton.setAttribute("aria-disabled", String(mediaSending));
      mediaButton.setAttribute("aria-busy", String(mediaSending));
    }
  }

  async function sendRawMediaLocally(file, kind, text) {
    const attachment = {
      kind,
      // 离线模式保留原始 DataURL 和原文件类型，不经过 Canvas 重压缩。
      data: await readAsDataURL(file),
      name: file.name,
      mime: file.type,
      size: Number(file.size) || 0
    };
    const sender = cloudIsActive() ? cloud()?.sendMessage : shared()?.sendMessage;
    const result = await Promise.resolve(sender?.({ text, attachment }));
    return { result, attachment };
  }

  async function sendSelectedChatMedia(file, kind, text) {
    const cloudSync = cloud();
    if (cloudIsActive() && typeof cloudSync?.sendMediaMessage === "function") {
      const sent = await cloudSync.sendMediaMessage({
        file,
        kind,
        text,
        name: file.name,
        mime: file.type
      });
      if (sent?.ok || !sent?.offline) return { result: sent, attachment: sent?.attachment || sent?.message?.attachment };
    }
    return sendRawMediaLocally(file, kind, text);
  }

  async function chooseChatMedia() {
    const input = byId("home-media-input");
    const files = Array.from(input?.files || []);
    if (!files.length || mediaSending) return;
    const candidates = files.map((file) => ({ file, kind: chatMediaKind(file) }));
    const invalid = candidates.find(({ file, kind }) => !kind || (kind === "video" && file.size > MAX_VIDEO_BYTES));
    if (invalid) {
      input.value = "";
      notice(!invalid.kind ? "请选择照片、视频或语音文件" : "视频请控制在 1MB 以内");
      return;
    }
    try {
      setMediaSending(true);
      const messageInput = byId("home-chat-input");
      const caption = messageInput?.value || "";
      let captionToSend = caption;
      const sent = [];
      const failures = [];
      for (let index = 0; index < candidates.length; index += 1) {
        const { file, kind } = candidates[index];
        pendingAttachment = {
          kind,
          name: file.name,
          mime: file.type,
          size: Number(file.size) || 0,
          sending: true,
          index: index + 1,
          total: candidates.length
        };
        updateMediaPreview();
        try {
          // 第一份成功发送的附件带上输入框里的文字；每个文件都直接按原始字节上传。
          const { result, attachment } = await sendSelectedChatMedia(file, kind, captionToSend);
          if (!result?.ok) throw new Error(result?.error || "附件暂时没有发送成功");
          if (attachment?.fileId && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
            rememberAttachmentSource(attachment, URL.createObjectURL(file));
          }
          sent.push(file);
          captionToSend = "";
        } catch (error) {
          failures.push(error?.message || file.name || "这份附件");
        }
      }
      input.value = "";
      pendingAttachment = null;
      updateMediaPreview();
      if (!sent.length) throw new Error(failures[0] || "附件暂时没有发送成功");
      if (messageInput) messageInput.value = "";
      renderHomeChat();
      if (candidates.length > 1) {
        notice(failures.length ? `已发送 ${sent.length} 个附件；${failures.length} 个暂时没有发送成功。` : `已发送 ${sent.length} 个原图附件。`);
      }
    } catch (error) {
      pendingAttachment = null;
      input.value = "";
      updateMediaPreview();
      notice(error?.message || "这个附件暂时不能发送");
    } finally {
      setMediaSending(false);
    }
  }

  async function submitHomeChat(event) {
    event.preventDefault();
    if (mediaSending) { notice("照片正在发送，请稍等一下。" ); return; }
    const input = byId("home-chat-input");
    const result = await Promise.resolve(cloudIsActive()
      ? cloud()?.sendMessage?.({ text: input?.value || "", attachment: pendingAttachment })
      : shared()?.sendMessage?.({ text: input?.value || "", attachment: pendingAttachment }));
    if (!result?.ok) {
      if (!roomState().room) shared()?.openRoom?.();
      notice(result?.error || "先连接你们的空间，再开始聊天吧");
      return;
    }
    input.value = "";
    const fileInput = byId("home-media-input");
    if (fileInput) fileInput.value = "";
    pendingAttachment = null;
    updateMediaPreview();
    renderHomeChat();
  }

  function frameId() {
    return `polaroid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function polaroidGroups() {
    const cards = interactions()?.read?.("polaroids") || [];
    const groups = new Map();
    cards.forEach((card) => {
      const key = card.frameId || card.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    });
    return [...groups.entries()].sort((a, b) => Math.max(...b[1].map((x) => x.updatedAt)) - Math.max(...a[1].map((x) => x.updatedAt)));
  }

  function renderPolaroids() {
    const list = byId("polaroid-list");
    if (!list) return;
    const role = roomState().role;
    list.replaceChildren();
    const groups = polaroidGroups();
    if (!groups.length) {
      const empty = document.createElement("p");
      empty.className = "interaction-empty";
      empty.textContent = "先放进第一张照片，等对方补上另一张。";
      list.append(empty);
      return;
    }
    groups.forEach(([id, cards]) => {
      const article = document.createElement("article");
      article.className = "polaroid-frame";
      const bySide = new Map(cards.map((card) => [card.side || card.author, card]));
      const theirSide = role === "guest" ? "host" : "guest";
      const mine = bySide.get(role);
      const theirs = bySide.get(theirSide);
      const photos = document.createElement("div");
      photos.className = "polaroid-pair";
      [mine, theirs].forEach((card, index) => {
        const slot = document.createElement("div");
        slot.className = `polaroid-slot ${card ? "has-photo" : "is-empty"}`;
        if (card?.imageData) {
          const image = document.createElement("img");
          image.src = card.imageData;
          image.alt = `${index === 0 ? "我的" : "对方的"}拍立得照片`;
          slot.append(image);
          const caption = document.createElement("small");
          caption.textContent = card.caption || (index === 0 ? "我这一张" : "她这一张");
          slot.append(caption);
        } else {
          slot.textContent = index === 0 ? "等待我的照片" : "等待对方照片";
        }
        photos.append(slot);
      });
      article.append(photos);
      const caption = document.createElement("p");
      caption.className = "polaroid-frame-status";
      caption.textContent = mine && theirs ? "双人拍立得完成啦 ♥" : "还差一张，等对方也把此刻放进来。";
      article.append(caption);
      if (!mine) {
        const add = document.createElement("button");
        add.type = "button";
        add.className = "secondary-button polaroid-join";
        add.textContent = "补上我的这一张";
        add.addEventListener("click", () => {
          selectedPolaroidFrame = id;
          const input = byId("polaroid-photo-input");
          if (input) input.click();
          notice("选一张照片，和她拼成这一张拍立得吧");
        });
        article.append(add);
      }
      list.append(article);
    });
  }

  async function addPolaroid() {
    if (!roomState().room) { shared()?.openRoom?.(); notice("先连接你们的空间，才能做双人拍立得"); return; }
    const input = byId("polaroid-photo-input");
    const caption = byId("polaroid-caption");
    const file = input?.files?.[0];
    if (!file) { input?.focus(); notice("先选一张照片吧"); return; }
    try {
      const role = roomState().role;
      const groupId = selectedPolaroidFrame || frameId();
      interactions()?.addPolaroid?.({
        imageData: await compressImage(file, 760000),
        caption: caption?.value || "",
        frameId: groupId,
        side: role,
        author: displayName(role),
      });
      input.value = "";
      if (caption) caption.value = "";
      selectedPolaroidFrame = "";
      syncCurrent();
      renderPolaroids();
      notice("拍立得已放进去，等她补上另一张 ♥");
    } catch (error) { notice(error?.message || "照片保存失败，请换一张再试"); }
  }

  function renderVoicePostcards() {
    const list = byId("voice-postcard-list");
    if (!list) return;
    const cards = interactions()?.read?.("voicePostcards") || [];
    list.replaceChildren();
    if (!cards.length) {
      const empty = document.createElement("p");
      empty.className = "interaction-empty";
      empty.textContent = "留一句声音给她吧。";
      list.append(empty);
      return;
    }
    cards.forEach((card) => {
      const item = document.createElement("article");
      item.className = "voice-postcard";
      const title = document.createElement("p");
      title.textContent = `${card.author || "我们"}的声音明信片 · ${formatTime(card.createdAt)}`;
      const audio = document.createElement("audio");
      audio.src = card.audioData;
      audio.controls = true;
      audio.preload = "metadata";
      item.append(title, audio);
      if (card.transcript) {
        const note = document.createElement("small");
        note.textContent = card.transcript;
        item.append(note);
      }
      list.append(item);
    });
  }

  async function startVoiceRecording() {
    if (!roomState().room) { shared()?.openRoom?.(); notice("先连接你们的空间，才可以把声音寄给她"); return; }
    if (voiceRecorder?.state === "recording") return;
    try {
      voiceRecorder = interactions()?.createVoiceRecorder?.({
        handlers: {
          onStart() {
            voiceStartedAt = Date.now();
            byId("voice-record")?.setAttribute("disabled", "");
            byId("voice-stop")?.removeAttribute("disabled");
            notice("正在录音，最长 30 秒");
          },
          onStop(result) { saveVoicePostcard(result); },
          onError() { notice("麦克风暂时无法使用，请检查权限"); }
        }
      });
      if (!voiceRecorder) throw new Error("这台设备暂时不支持录音");
      await voiceRecorder.start();
      voiceStopTimer = setTimeout(() => voiceRecorder?.stop(), 30000);
    } catch (error) {
      voiceRecorder = null;
      notice(error?.message || "麦克风权限没有打开");
    }
  }

  function stopVoiceRecording() {
    if (voiceStopTimer) clearTimeout(voiceStopTimer);
    voiceStopTimer = null;
    voiceRecorder?.stop();
  }

  function saveVoicePostcard(result) {
    byId("voice-record")?.removeAttribute("disabled");
    byId("voice-stop")?.setAttribute("disabled", "");
    voiceRecorder = null;
    if (!result?.audioData) { notice("录音没有保存成功"); return; }
    if (result.audioData.length > MAX_AUDIO_CHARS) { notice("这段录音有点长，请控制在 30 秒以内再试"); return; }
    try {
      const role = roomState().role;
      interactions()?.addVoicePostcard?.({ audioData: result.audioData, duration: Math.round((Date.now() - voiceStartedAt) / 1000), author: displayName(role) });
      syncCurrent();
      renderVoicePostcards();
      notice("声音明信片已经寄出啦");
    } catch (error) { notice(error?.message || "声音明信片保存失败"); }
  }

  function renderWall() {
    const list = byId("wall-list");
    if (!list) return;
    const messages = (interactions()?.read?.("messageWall") || []).slice().sort((a, b) => a.createdAt - b.createdAt);
    list.replaceChildren();
    if (!messages.length) {
      const empty = document.createElement("p");
      empty.className = "interaction-empty";
      empty.textContent = "写一句会被她看到的话吧。";
      list.append(empty);
      return;
    }
    messages.forEach((message) => {
      const note = document.createElement("article");
      note.className = "wall-note";
      const body = document.createElement("p");
      body.textContent = message.message;
      const meta = document.createElement("small");
      meta.textContent = `${message.author || "我们"} · ${formatTime(message.createdAt)}`;
      note.append(body, meta);
      list.append(note);
    });
  }

  function addWallMessage() {
    if (!roomState().room) { shared()?.openRoom?.(); notice("先连接你们的空间，留言才会一起出现"); return; }
    const input = byId("wall-message");
    const message = String(input?.value || "").trim();
    if (!message) { input?.focus(); return; }
    try {
      interactions()?.addWallMessage?.({ message, author: displayName(roomState().role) });
      input.value = "";
      syncCurrent();
      renderWall();
      notice("留言已经贴上去啦");
    } catch (error) { notice(error?.message || "留言保存失败"); }
  }

  function currentMind() {
    return activeMindId ? interactions()?.getMindMatchSession?.(activeMindId) : null;
  }

  function renderMind(session = currentMind()) {
    const status = byId("mind-status");
    const result = byId("mind-result");
    const prompt = byId("mind-prompt");
    const ready = byId("mind-ready");
    const answer = byId("mind-answer");
    const submit = byId("mind-submit");
    const create = byId("mind-create");
    const online = Boolean(shared()?.isBothOnline?.());
    if (!session) {
      if (status) status.textContent = online ? "双方都在线啦，出一个题目开始吧。" : "需要双方同时在线，才能开始心有灵犀。";
      if (create) create.disabled = !online;
      if (ready) ready.disabled = true;
      if (answer) { answer.disabled = true; answer.value = ""; }
      if (submit) submit.disabled = true;
      if (result) result.hidden = true;
      return;
    }
    if (prompt) prompt.value = session.prompt;
    if (create) create.disabled = true;
    if (ready) {
      ready.disabled = !online || session.localSubmitted || session.status === "revealed";
      ready.textContent = session.localReady ? "我已准备好" : "我准备好了";
      ready.setAttribute("aria-pressed", String(Boolean(session.localReady)));
    }
    const canAnswer = online && session.status === "answering" && session.localReady && session.remoteReady && !session.localSubmitted;
    if (answer) answer.disabled = !canAnswer;
    if (submit) submit.disabled = !canAnswer;
    if (session.status === "revealed") {
      if (status) status.textContent = "双方答案已揭晓！";
      if (result) {
        result.hidden = false;
        result.replaceChildren();
        const mine = document.createElement("p"); mine.textContent = `我的答案：${session.localAnswer}`;
        const theirs = document.createElement("p"); theirs.textContent = `对方的答案：${session.remoteAnswer}`;
        result.append(mine, theirs);
      }
      return;
    }
    if (status) {
      if (!online || session.status === "paused") status.textContent = "对方暂时离开了，这一局会在双方回来后继续。";
      else if (!session.localReady || !session.remoteReady) status.textContent = "等双方都点「准备好」后才会出题。";
      else if (session.localSubmitted && !session.remoteSubmitted) status.textContent = "你的答案已收好，等对方交答后一起揭晓。";
      else if (!session.localSubmitted && session.remoteSubmitted) status.textContent = "对方已交答，现在轮到你啦。";
      else status.textContent = "题目已锁定，先写下答案，提交前看不到对方的。";
    }
    if (result) result.hidden = true;
  }

  function createMindMatch() {
    if (!shared()?.isBothOnline?.()) { notice("要等你们两个都在线才能开始"); return; }
    const input = byId("mind-prompt");
    const question = String(input?.value || "").trim() || MIND_PROMPTS[Math.floor(Math.random() * MIND_PROMPTS.length)];
    try {
      const session = interactions()?.prepareMindMatch?.({ prompt: question, author: displayName(roomState().role) });
      activeMindId = session?.id || "";
      renderMind(session);
      notice("题目已送到对方手机，等她也点准备好吧");
    } catch (error) { notice(error?.message || "这一局暂时无法开始"); }
  }

  function readyMindMatch() {
    const session = currentMind();
    if (!session) return;
    try { renderMind(interactions()?.setMindReady?.(session.id, !session.localReady)); }
    catch (error) { notice(error?.message || "暂时无法准备"); }
  }

  function submitMindMatch() {
    const session = currentMind();
    const answer = byId("mind-answer");
    if (!session) return;
    try { renderMind(interactions()?.submitMindAnswer?.(session.id, answer?.value || "")); }
    catch (error) { notice(error?.message || "答案暂时无法提交"); }
  }

  function bindEvents() {
    byId("home-chat-form")?.addEventListener("submit", submitHomeChat);
    byId("home-media-button")?.addEventListener("click", (event) => {
      event.preventDefault();
      if (mediaSending) { notice("照片正在发送，请稍等一下。"); return; }
      const input = byId("home-media-input");
      if (!input) { notice("照片选择器暂时没有准备好，请刷新后再试。"); return; }
      input.click();
    });
    byId("home-media-input")?.addEventListener("change", chooseChatMedia);
    byId("polaroid-photo-input")?.addEventListener("change", () => {
      const file = byId("polaroid-photo-input")?.files?.[0];
      if (file && selectedPolaroidFrame) byId("polaroid-add")?.click();
    });
    byId("polaroid-add")?.addEventListener("click", addPolaroid);
    byId("voice-record")?.addEventListener("click", startVoiceRecording);
    byId("voice-stop")?.addEventListener("click", stopVoiceRecording);
    byId("wall-send")?.addEventListener("click", addWallMessage);
    byId("wall-message")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); addWallMessage(); }
    });
    byId("mind-create")?.addEventListener("click", createMindMatch);
    byId("mind-ready")?.addEventListener("click", readyMindMatch);
    byId("mind-submit")?.addEventListener("click", submitMindMatch);
    document.querySelectorAll(".interactions-open").forEach((button) => button.addEventListener("click", openInteractions));
    byId("interactions-close")?.addEventListener("click", closeInteractions);
    byId("interactions-dialog")?.addEventListener("cancel", closeInteractions);
    byId("theme-close")?.addEventListener("click", () => {
      const menu = byId("theme-menu");
      if (menu) menu.open = false;
    });
    document.querySelectorAll(".theme-launch").forEach((button) => button.addEventListener("click", () => {
      const menu = byId("theme-menu");
      if (menu) menu.open = false;
    }));
  }

  function bindSharedState() {
    const sync = shared();
    const data = interactions();
    window.addEventListener(DATE_PLAN_CHAT_EVENT, (event) => {
      Promise.resolve(sendDatePlanCard(event.detail?.plan))
        .then((result) => {
          if (!result?.ok) notice(result?.error || "约会卡片会在聊天可用后自动补发。");
        })
        .catch(() => notice("约会卡片会在聊天可用后自动补发。"));
    });
    if (!data) return;
    if (sync) {
      data.configureMindMatchTransport({
        isBothOnline: () => sync.isBothOnline(),
        send: (packet) => sync.sendRealtimePacket(packet),
        subscribe: (listener) => sync.subscribe(listener),
      });
      window.addEventListener(sync.ROOM_EVENT, () => {
        data.setMindRoomPresence(sync.isBothOnline());
        renderChatStatus();
        renderMind();
      });
      window.addEventListener(sync.CHAT_EVENT, renderHomeChat);
    }
    window.addEventListener("date-invite-cloud-status", () => {
      renderChatStatus();
      renderHomeChat();
    });
    window.addEventListener("date-invite-cloud-sync-applied", () => {
      renderChatStatus(); renderHomeChat(); renderPolaroids(); renderVoicePostcards(); renderWall();
    });
    window.addEventListener("shared-sync-applied", () => {
      renderHomeChat(); renderPolaroids(); renderVoicePostcards(); renderWall();
    });
    window.addEventListener(data.EVENT_NAME, () => {
      renderPolaroids(); renderVoicePostcards(); renderWall();
    });
    window.addEventListener(data.MIND_EVENT_NAME, (event) => {
      const session = event.detail?.session;
      if (session?.id) activeMindId = session.id;
      renderMind(session || currentMind());
    });
  }

  function initialize() {
    bindEvents();
    bindSharedState();
    renderChatStatus();
    renderHomeChat();
    renderPolaroids();
    renderVoicePostcards();
    renderWall();
    renderMind();
    updateMediaPreview();
  }

  window.DateInviteHomeChat = {
    sendDatePlanCard,
    render: renderHomeChat
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
