(() => {
  "use strict";

  const root = document.querySelector("#lp-pet-theme");
  if (!root) return;

  const stage = root.querySelector("#lp-pet-stage");
  const actor = root.querySelector("#lp-pet-actor");
  const sprite = root.querySelector("#lp-pet-sprite");
  const bubble = root.querySelector("#lp-pet-bubble");
  const talkForm = root.querySelector("#lp-pet-talk-form");
  const talkInput = root.querySelector("#lp-pet-talk-input");
  const dashboard = document.querySelector("#lp-pet-dashboard");
  const reminderDialog = document.querySelector("#lp-pet-reminder");
  const reminderForm = document.querySelector("#lp-pet-reminder-form");
  const reminderText = document.querySelector("#lp-pet-reminder-text");
  const reminderTime = document.querySelector("#lp-pet-reminder-time");
  const reminderStatus = document.querySelector("#lp-pet-reminder-status");
  if (!stage || !actor || !sprite || !bubble) return;

  const ASSET_ROOT = "pet-assets/";
  const STATS_KEY = "leo-emily-lp-pet-stats-v1";
  const SETTINGS_KEY = "leo-emily-lp-pet-settings-v1";
  const REMINDERS_KEY = "leo-emily-lp-pet-reminders-v1";
  const TODAY = () => new Date().toISOString().slice(0, 10);
  const reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  const STATES = {
    idle: { frames: ["idle-01.png", "idle-02.png", "idle-03.png", "idle-04.png"], ms: 900, loop: true },
    blink: { frames: ["blink-01.png", "blink-02.png", "blink-03.png", "blink-04.png", "blink-05.png"], ms: 80 },
    happy: { frames: ["happy-01.png", "happy-02.png", "happy-03.png", "happy-04.png", "happy-05.png"], ms: 260 },
    "foot-wave": { frames: ["idle-01.png", "happy-01.png", "happy-02.png", "happy-03.png", "happy-02.png", "happy-01.png"], ms: 260, loop: true },
    notify: { frames: ["notify-01.png", "notify-02.png", "notify-03.png", "notify-04.png", "notify-05.png"], ms: 120 },
    peek: { frames: ["peek-01.png", "peek-02.png", "peek-03.png", "peek-04.png", "peek-05.png"], ms: 120 },
    pet: { frames: ["pet-01.png", "pet-02.png", "pet-03.png", "pet-04.png", "pet-05.png"], ms: 150, loop: true },
    eat: { frames: ["eat-01.png", "eat-02.png", "eat-03.png", "eat-04.png", "eat-05.png"], ms: 180, loop: true },
    chat: { frames: ["chat-01.png", "chat-02.png", "chat-03.png", "chat-04.png", "chat-05.png"], ms: 200, loop: true },
    sleep: { frames: ["sleep-01.png", "sleep-02.png", "sleep-03.png", "sleep-04.png", "sleep-05.png"], ms: 500, loop: true },
    "walk-left": { frames: ["walk-left-01.png", "walk-left-02.png", "walk-left-03.png", "walk-left-04.png", "walk-left-05.png", "walk-left-06.png"], ms: 150, loop: true },
    "walk-right": { frames: ["walk-right-01.png", "walk-right-02.png", "walk-right-03.png", "walk-right-04.png", "walk-right-05.png", "walk-right-06.png"], ms: 150, loop: true },
  };

  const ACTIONS = [
    { id: "pet-head", state: "pet", duration: 2000, gain: 3, mood: 2, label: "摸摸头", emoji: "🫳", feedback: ["谢谢刘平壹摸摸~", "子珊会一直陪着刘平壹。", "今天也辛苦啦，给你一个微笑。"] },
    { id: "feed-snack", state: "eat", duration: 2500, gain: 5, mood: 3, label: "喂点心", emoji: "🍪", feedback: ["谢谢刘平壹的点心！", "子珊会好好享用的~", "刘平壹挑的最好吃。"] },
    { id: "chat-talk", state: "chat", duration: 2000, gain: 2, mood: 2, label: "和她聊天", emoji: "💬", feedback: ["刘平壹想聊什么呢？", "子珊在认真听。", "只要刘平壹需要，子珊都在。"] },
    { id: "sleep-time", state: "sleep", duration: 3000, gain: 1, mood: 1, label: "让她休息", emoji: "😴", feedback: ["晚安，刘平壹~", "子珊先休息一会儿，等你回来。", "明天也会准时陪着刘平壹。"] },
    { id: "show-foot", state: "foot-wave", duration: 5000, gain: 2, mood: 2, label: "看看脚", emoji: "🦶", feedback: ["她有点害羞地抬起脚尖：只看一下下哦。", "她脸红了一下，小声说：不要一直盯着啦。", "她轻轻绷了绷脚尖，又害羞地放回去了。"] },
  ];

  const fallbackStats = { affection: 0, mood: 80, todayInteractions: 0, totalCompanionMs: 0, lastInteractionDate: TODAY() };
  const safeRead = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (error) { return fallback; }
  };
  const safeWrite = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* 私密模式下仍可正常互动。 */ }
  };
  const randomItem = (items) => items[Math.floor(Math.random() * items.length)] || "子珊正在这里陪着你。";
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const uniqueId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  let stats = { ...fallbackStats, ...(safeRead(STATS_KEY, {}) || {}) };
  let settings = { scale: 0.8, alwaysOnTop: true, clickThrough: false, ...(safeRead(SETTINGS_KEY, {}) || {}) };
  let reminders = Array.isArray(safeRead(REMINDERS_KEY, [])) ? safeRead(REMINDERS_KEY, []) : [];
  let reminderTimers = new Map();
  let companionStartedAt = Date.now();
  let active = { id: "idle", startedAt: Date.now(), frameIndex: -1, endsAt: Number.POSITIVE_INFINITY };
  let frameUrls = new Map();
  let blinkTimer = null;
  let bubbleTimer = null;
  let footActionTimer = null;
  let pointer = null;
  let suppressTapUntil = 0;
  let petPosition = { x: 50, y: 56 };

  function frameUrl(file) {
    if (!frameUrls.has(file)) frameUrls.set(file, `${ASSET_ROOT}${file}`);
    return frameUrls.get(file);
  }

  function preload(file) {
    if (!file || document.documentElement.classList.contains("pet-assets-disabled")) return;
    if (preload.cache.has(file)) return;
    const image = new Image();
    image.decoding = "async";
    image.src = frameUrl(file);
    preload.cache.set(file, image);
  }
  preload.cache = new Map();

  function normaliseStats() {
    if (stats.lastInteractionDate !== TODAY()) {
      stats.todayInteractions = 0;
      stats.lastInteractionDate = TODAY();
    }
    stats.affection = clamp(Number(stats.affection) || 0, 0, 300);
    stats.mood = clamp(Number(stats.mood) || 80, 0, 100);
    stats.todayInteractions = Math.max(0, Number(stats.todayInteractions) || 0);
    stats.totalCompanionMs = Math.max(0, Number(stats.totalCompanionMs) || 0);
  }

  function saveStats() { normaliseStats(); safeWrite(STATS_KEY, stats); renderStats(); }
  function saveSettings() { safeWrite(SETTINGS_KEY, settings); renderSettings(); }

  function renderStats() {
    normaliseStats();
    const minutes = Math.floor((stats.totalCompanionMs + (root.hidden ? 0 : Date.now() - companionStartedAt)) / 60000);
    const values = {
      "lp-pet-affection": stats.affection, "lp-pet-mood": stats.mood, "lp-pet-today": stats.todayInteractions, "lp-pet-minutes": minutes,
      "lp-pet-dash-affection": stats.affection, "lp-pet-dash-mood": stats.mood, "lp-pet-dash-today": stats.todayInteractions, "lp-pet-dash-minutes": minutes,
    };
    Object.entries(values).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.textContent = String(value); });
  }

  function renderSettings() {
    root.style.setProperty("--lp-pet-scale", String(clamp(Number(settings.scale) || 0.8, 0.55, 1.25)));
    const top = document.querySelector("#lp-pet-always-on-top");
    const through = document.querySelector("#lp-pet-click-through");
    top?.setAttribute("aria-checked", String(Boolean(settings.alwaysOnTop)));
    through?.setAttribute("aria-checked", String(Boolean(settings.clickThrough)));
    root.classList.toggle("lp-pet-click-through", Boolean(settings.clickThrough));
    document.querySelectorAll("[data-lp-pet-scale]").forEach((button) => button.setAttribute("aria-pressed", String(Math.abs(Number(button.dataset.lpPetScale) - Number(settings.scale)) < 0.01)));
  }

  function recordInteraction(action) {
    normaliseStats();
    stats.affection = clamp(stats.affection + (Number(action.gain) || 0), 0, 300);
    stats.mood = clamp(stats.mood + (Number(action.mood) || 0), 0, 100);
    stats.todayInteractions += 1;
    saveStats();
  }

  function showBubble(text, duration = 2200) {
    if (!text) return;
    bubble.textContent = String(text).slice(0, 180);
    bubble.classList.add("is-visible");
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => bubble.classList.remove("is-visible"), duration);
  }

  function setFrame(file) {
    if (!file || sprite.src.endsWith(file)) return;
    sprite.src = frameUrl(file);
  }

  function setState(id, options = {}) {
    const next = STATES[id] || STATES.idle;
    const now = Date.now();
    const defaultDuration = next.loop ? Number.POSITIVE_INFINITY : next.frames.length * next.ms;
    const duration = options.duration == null ? defaultDuration : Math.max(1, Number(options.duration) || defaultDuration);
    active = { id: STATES[id] ? id : "idle", startedAt: now, frameIndex: -1, endsAt: Number.isFinite(duration) ? now + duration : Number.POSITIVE_INFINITY };
    actor.dataset.state = active.id;
    root.dataset.petState = active.id;
    setFrame(next.frames[0]);
    next.frames.forEach((file, index) => window.setTimeout(() => preload(file), index * 26));
    if (options.feedback) showBubble(options.feedback, options.feedbackDuration || 2200);
  }

  function tick() {
    const now = Date.now();
    if (now >= active.endsAt && active.id !== "idle") setState("idle");
    const definition = STATES[active.id] || STATES.idle;
    const elapsed = Math.max(0, now - active.startedAt);
    const index = reducedMotion ? 0 : definition.loop ? Math.floor(elapsed / definition.ms) % definition.frames.length : Math.min(definition.frames.length - 1, Math.floor(elapsed / definition.ms));
    if (index !== active.frameIndex) {
      active.frameIndex = index;
      setFrame(definition.frames[index]);
    }
    window.requestAnimationFrame(tick);
  }

  function scheduleBlink() {
    if (blinkTimer) clearTimeout(blinkTimer);
    blinkTimer = window.setTimeout(() => {
      if (active.id === "idle" && !root.hidden) setState("blink", { duration: STATES.blink.frames.length * STATES.blink.ms });
      scheduleBlink();
    }, 2000 + Math.random() * 4000);
  }

  function planContext() {
    const plan = safeRead("cute-date-invite-v1", null);
    if (!plan || typeof plan !== "object" || !plan.date) return null;
    const date = new Date(`${plan.date}T${plan.time || "17:00"}:00`);
    return Number.isNaN(date.getTime()) ? null : { ...plan, target: date };
  }

  function replyFor(text) {
    const value = String(text || "").trim();
    const plan = planContext();
    if (/你好|嗨|子珊|宠物/.test(value)) return { state: "happy", text: "你好呀，刘平壹！子珊已经听见你啦。" };
    if (/想你|喜欢|爱你|晚安/.test(value)) return { state: "happy", text: "这句话我收好啦，子珊会一直陪着你。" };
    if (/约会|见面|什么时候/.test(value) && plan) {
      const days = Math.max(0, Math.ceil((plan.target.getTime() - Date.now()) / 86400000));
      return { state: "notify", text: `距离下一次见面还有 ${days} 天，${plan.activity || "一起约会"}，记得期待一下。` };
    }
    if (/吃|火锅|烤肉|菜单/.test(value)) return { state: "eat", text: `下次可以吃${plan?.menu || "你们喜欢的东西"}，子珊负责陪你吃到开心。` };
    if (/玩|电影|散步|游乐园|活动/.test(value)) return { state: "happy", text: `那就安排${plan?.activity || "一个让你们都开心的活动"}吧！` };
    return { state: "chat", text: `子珊听到了：“${value.slice(0, 38)}”，还想再和我说一点吗？` };
  }

  function triggerAction(id, customText = "") {
    const action = ACTIONS.find((item) => item.id === id);
    if (!action || root.classList.contains("lp-pet-click-through")) return;
    recordInteraction(action);
    if (footActionTimer) clearTimeout(footActionTimer);
    actor.classList.toggle("is-foot-wave", action.id === "show-foot");
    if (action.id === "show-foot") footActionTimer = window.setTimeout(() => actor.classList.remove("is-foot-wave"), action.duration);
    setState(action.state, { duration: action.duration, feedback: customText || randomItem(action.feedback) });
    document.querySelectorAll("[data-lp-pet-action]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.lpPetAction === id)));
    window.setTimeout(() => document.querySelectorAll("[data-lp-pet-action]").forEach((button) => button.setAttribute("aria-pressed", "false")), action.duration);
  }

  function tapPet() {
    if (Date.now() < suppressTapUntil || root.classList.contains("lp-pet-click-through")) return;
    setState("happy", { duration: STATES.happy.frames.length * STATES.happy.ms, feedback: "刘平壹，子珊在对你微笑~" });
  }

  function setPosition(x, y) {
    const rect = stage.getBoundingClientRect();
    const actorRect = actor.getBoundingClientRect();
    const marginX = Math.min(28, ((actorRect.width / 2 + 10) / Math.max(1, rect.width)) * 100);
    const marginY = Math.min(35, ((actorRect.height / 2 + 12) / Math.max(1, rect.height)) * 100);
    petPosition.x = clamp(Number(x) || 50, marginX, 100 - marginX);
    petPosition.y = clamp(Number(y) || 56, marginY, 100 - marginY);
    actor.style.left = `${petPosition.x}%`;
    actor.style.top = `${petPosition.y}%`;
  }

  function snapToEdge() {
    const rect = stage.getBoundingClientRect();
    const actorRect = actor.getBoundingClientRect();
    const marginX = Math.min(28, ((actorRect.width / 2 + 10) / Math.max(1, rect.width)) * 100);
    const marginY = Math.min(35, ((actorRect.height / 2 + 12) / Math.max(1, rect.height)) * 100);
    const choices = [
      { d: petPosition.x - marginX, x: marginX, y: petPosition.y },
      { d: 100 - marginX - petPosition.x, x: 100 - marginX, y: petPosition.y },
      { d: petPosition.y - marginY, x: petPosition.x, y: marginY },
      { d: 100 - marginY - petPosition.y, x: petPosition.x, y: 100 - marginY },
    ];
    const nearest = choices.sort((a, b) => a.d - b.d)[0];
    setPosition(nearest.x, nearest.y);
    setState("peek", { duration: STATES.peek.frames.length * STATES.peek.ms, feedback: "贴到边边啦，刘平壹随时都能找到我。" });
  }

  function showDialog(dialog) {
    if (!dialog) return;
    try { if (!dialog.open) dialog.showModal(); } catch (error) { dialog.setAttribute("open", ""); }
  }
  function closeDialog(dialog) {
    if (!dialog) return;
    try { if (dialog.open) dialog.close(); } catch (error) { dialog.removeAttribute("open"); }
  }

  function localTimeValue(date = new Date(Date.now() + 3600000)) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function saveReminders() { safeWrite(REMINDERS_KEY, reminders); }
  function renderReminders() {
    const list = document.querySelector("#lp-pet-reminder-list");
    if (!list) return;
    list.replaceChildren();
    if (!reminders.length) {
      const empty = document.createElement("p"); empty.className = "lp-pet-empty"; empty.textContent = "还没有提醒，给子珊安排一个吧。"; list.append(empty); return;
    }
    reminders.slice().sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)).forEach((item) => {
      const row = document.createElement("div"); row.className = "lp-pet-reminder-item";
      const copy = document.createElement("span"); copy.innerHTML = `<b></b><small></small>`;
      copy.querySelector("b").textContent = item.text;
      copy.querySelector("small").textContent = new Date(item.dueAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "lp-pet-reminder-remove"; remove.textContent = "删除"; remove.setAttribute("aria-label", `删除提醒 ${item.text}`);
      remove.addEventListener("click", () => { reminders = reminders.filter((entry) => entry.id !== item.id); const timer = reminderTimers.get(item.id); if (timer) clearTimeout(timer); reminderTimers.delete(item.id); saveReminders(); renderReminders(); });
      row.append(copy, remove); list.append(row);
    });
  }

  function fireReminder(item) {
    setState("notify", { duration: STATES.notify.frames.length * STATES.notify.ms, feedback: item.text });
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification("刘平壹的专属宠物", { body: item.text, icon: "icon-192.png" }); } catch (error) { /* iOS Web App 可能不允许页面通知。 */ }
    }
    const status = document.querySelector("#lp-pet-reminder-status");
    if (status) status.textContent = `提醒到了：${item.text}`;
  }

  function scheduleReminder(item) {
    const due = new Date(item.dueAt).getTime();
    if (!Number.isFinite(due) || due <= Date.now()) return;
    const delay = Math.min(2147480000, due - Date.now());
    reminderTimers.set(item.id, window.setTimeout(() => { reminderTimers.delete(item.id); fireReminder(item); }, delay));
  }

  function openReminderDialog() {
    if (reminderText) reminderText.value = "";
    if (reminderTime) reminderTime.value = localTimeValue();
    if (reminderStatus) reminderStatus.textContent = "";
    showDialog(reminderDialog);
    window.setTimeout(() => reminderText?.focus(), 30);
  }

  function renderDashboardActions() {
    const list = document.querySelector("#lp-pet-dashboard-actions");
    if (!list) return;
    list.replaceChildren();
    ACTIONS.forEach((action) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "lp-pet-dashboard-action"; button.dataset.lpPetAction = action.id;
      button.innerHTML = `<span aria-hidden="true"></span><b></b>`; button.querySelector("span").textContent = action.emoji; button.querySelector("b").textContent = action.label; button.addEventListener("click", () => triggerAction(action.id)); list.append(button);
    });
  }

  function bindDragging() {
    actor.addEventListener("dragstart", (event) => event.preventDefault());
    actor.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      const rect = stage.getBoundingClientRect();
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, longPressed: false, startX: petPosition.x, startY: petPosition.y, stageRect: rect };
      actor.setPointerCapture?.(event.pointerId);
      pointer.longPressTimer = window.setTimeout(() => { if (pointer && !pointer.moved) pointer.longPressed = true; }, 520);
    });
    actor.addEventListener("pointermove", (event) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const dx = event.clientX - pointer.x; const dy = event.clientY - pointer.y;
      if (!pointer.moved && Math.hypot(dx, dy) > 6) { pointer.moved = true; clearTimeout(pointer.longPressTimer); }
      if (!pointer.moved) return;
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      setState(dx >= 0 ? "walk-right" : "walk-left", { duration: 999999 });
      setPosition(pointer.startX + (event.clientX - pointer.x) / rect.width * 100, pointer.startY + (event.clientY - pointer.y) / rect.height * 100);
    });
    const finish = (event) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      clearTimeout(pointer.longPressTimer); actor.releasePointerCapture?.(event.pointerId);
      const moved = pointer.moved; const longPressed = pointer.longPressed; pointer = null;
      if (moved) { suppressTapUntil = Date.now() + 250; snapToEdge(); }
      else if (!longPressed) tapPet();
    };
    actor.addEventListener("pointerup", finish); actor.addEventListener("pointercancel", finish);
    actor.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); tapPet(); } });
  }

  function bindMenus() {
    document.querySelectorAll("[data-lp-pet-close]").forEach((button) => button.addEventListener("click", () => { const kind = button.dataset.lpPetClose; closeDialog(kind === "dashboard" ? dashboard : reminderDialog); }));
    [dashboard, reminderDialog].forEach((dialog) => dialog?.addEventListener("cancel", () => closeDialog(dialog)));
    root.querySelectorAll("[data-lp-pet-open]").forEach((button) => button.addEventListener("click", () => {
      const kind = button.dataset.lpPetOpen;
      if (kind === "dashboard") { renderStats(); renderReminders(); showDialog(dashboard); }
      if (kind === "reminder") openReminderDialog();
    }));
  }

  function bindActions() {
    document.querySelectorAll("[data-lp-pet-action]").forEach((button) => { if (!button.dataset.lpPetBound) { button.dataset.lpPetBound = "true"; button.addEventListener("click", () => triggerAction(button.dataset.lpPetAction)); } });
    talkForm?.addEventListener("submit", (event) => { event.preventDefault(); const text = talkInput?.value.trim(); if (!text) { talkInput?.focus(); return; } const reply = replyFor(text); if (talkInput) talkInput.value = ""; setState(reply.state, { duration: 2000, feedback: reply.text }); recordInteraction(ACTIONS.find((item) => item.id === "chat-talk")); });
  }

  function bindSettings() {
    document.querySelector("#lp-pet-always-on-top")?.addEventListener("click", () => { settings.alwaysOnTop = !settings.alwaysOnTop; saveSettings(); });
    document.querySelector("#lp-pet-click-through")?.addEventListener("click", () => { settings.clickThrough = !settings.clickThrough; saveSettings(); });
    document.querySelectorAll("[data-lp-pet-scale]").forEach((button) => button.addEventListener("click", () => { settings.scale = clamp(Number(button.dataset.lpPetScale) || 0.8, 0.55, 1.25); saveSettings(); }));
    reminderForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = reminderText?.value.trim(); const rawTime = reminderTime?.value;
      const dueAt = rawTime ? new Date(rawTime).getTime() : 0;
      if (!text || !Number.isFinite(dueAt) || dueAt <= Date.now()) { if (reminderStatus) reminderStatus.textContent = "请选择未来的时间，并写下提醒内容。"; return; }
      const item = { id: uniqueId(), text: text.slice(0, 100), dueAt: new Date(dueAt).toISOString() }; reminders.push(item); saveReminders(); scheduleReminder(item); renderReminders();
      if ("Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch (error) { /* 用户可稍后在系统设置里开启。 */ } }
      if (reminderStatus) reminderStatus.textContent = "提醒已保存，子珊会在这里等你。";
      window.setTimeout(() => closeDialog(reminderDialog), 500);
    });
  }

  function init() {
    normaliseStats(); renderStats(); renderSettings(); renderReminders(); renderDashboardActions();
    setPosition(petPosition.x, petPosition.y); setState("idle"); scheduleBlink(); bindDragging(); bindMenus(); bindActions(); bindSettings();
    Object.values(STATES).forEach((definition) => preload(definition.frames[0]));
    window.requestAnimationFrame(tick);
    window.setInterval(() => { if (!root.hidden) { stats.totalCompanionMs += Date.now() - companionStartedAt; companionStartedAt = Date.now(); saveStats(); } }, 60000);
    window.addEventListener("resize", () => setPosition(petPosition.x, petPosition.y), { passive: true });
    window.addEventListener("shared-sync-applied", () => { if (!root.hidden) showBubble("子珊也看见你们空间更新啦。", 1800); });
    window.addEventListener("visibilitychange", () => { companionStartedAt = Date.now(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
