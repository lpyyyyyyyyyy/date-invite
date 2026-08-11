(() => {
  "use strict";

  const MAX_VIDEO_BYTES = 1024 * 1024;
  const MAX_AUDIO_CHARS = 940000;
  const HOME_SETTINGS_KEY = "cute-date-invite-home-settings-v1";
  const LOVE_START_DATE = "2026-06-23";
  const LOCAL_USER_KEY = "cute-date-invite-local-user-v1";
  const CHAT_KEY = "cute-date-invite-shared-messages-v1";
  const CHAT_FAVORITES_KEY = "leo-emily-chat-favorites-v1";
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
  let selectedWorldPhotos = [];
  let activeChatActionMessageId = "";
  let worldPreviewPhotos = [];
  let worldPreviewIndex = 0;
  let worldPreviewGallery = null;
  let selectedPolaroidFrame = "";
  let voiceRecorder = null;
  let voiceStartedAt = 0;
  let voiceStopTimer = null;
  let voiceTickTimer = null;
  let voiceStopping = false;
  let voiceDiscarded = false;
  let activeMindId = "";
  let activeHomeTab = "today";
  let homeTabsReady = false;
  const homeTabScroll = new Map();
  // 实时心有灵犀：云端与旧版点对点房间都可作为运输层。
  let mindTransportCleanup = null;
  let mindTransportSource = null;
  const attachmentSources = new Map();
  const weatherCities = [
    { id: "toronto", name: "多伦多", lat: 43.6532, lon: -79.3832, timeZone: "America/Toronto" },
    { id: "shanghai", name: "上海", lat: 31.2304, lon: 121.4737, timeZone: "Asia/Shanghai" },
    { id: "chongqing", name: "重庆", lat: 29.563, lon: 106.5516, timeZone: "Asia/Shanghai" }
  ];
  const coupleFestivals = [
    { name: "情人节", month: 2, day: 14, note: "给她准备一点甜" },
    { name: "520", month: 5, day: 20, note: "适合认真说喜欢" },
    { name: "七夕", month: 8, day: 19, note: "农历节日先按今年提醒" },
    { name: "圣诞节", month: 12, day: 25, note: "一起过冬天" },
    { name: "跨年夜", month: 12, day: 31, note: "一起倒数下一年" }
  ];

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

  function safeReadObject(key, fallback = {}) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
    } catch (error) { return fallback; }
  }

  function safeWriteObject(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { return false; }
  }

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dayDiff(target, source = new Date()) {
    const start = new Date(source.getFullYear(), source.getMonth(), source.getDate()).getTime();
    const end = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    return Math.round((end - start) / 86400000);
  }

  function formatLoveStartDisplay(value) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "2026.06.23 星期二";
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day} ${weekdays[date.getDay()]}`;
  }

  function readHomeSettings() {
    const saved = safeReadObject(HOME_SETTINGS_KEY, {});
    const coverImage = typeof saved.coverImage === "string" && (/^data:image\//i.test(saved.coverImage) || /^assets\//.test(saved.coverImage))
      ? saved.coverImage
      : "assets/our-day-bg.jpg";
    return {
      loveStartDate: LOVE_START_DATE,
      coverImage,
      updatedAt: Number(saved.updatedAt) || Date.now()
    };
  }

  function persistHomeSettings(patch) {
    const next = { ...readHomeSettings(), ...patch, loveStartDate: LOVE_START_DATE, updatedAt: Date.now() };
    if (!safeWriteObject(HOME_SETTINGS_KEY, next)) return false;
    return true;
  }

  function renderLoveDays() {
    const settings = readHomeSettings();
    const count = byId("love-days-count");
    const display = byId("love-start-display");
    const cover = byId("couple-cover-image");
    if (display) display.textContent = formatLoveStartDisplay(settings.loveStartDate);
    if (cover && cover.getAttribute("src") !== settings.coverImage) cover.src = settings.coverImage;
    if (!count) return;
    const start = new Date(`${settings.loveStartDate}T00:00:00`);
    const days = Number.isNaN(start.getTime()) ? 1 : Math.max(1, -dayDiff(start) + 1);
    count.textContent = String(days);
  }

  function resizeCover(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//i.test(file.type || "")) { reject(new Error("请选择一张照片")); return; }
      if (file.size > 20 * 1024 * 1024) { reject(new Error("照片请不要超过 20MB")); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("照片读取失败，请重新选择"));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("这张照片暂时无法使用"));
        image.onload = () => {
          const maxWidth = 1600;
          const maxHeight = 1200;
          const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) { reject(new Error("浏览器暂时无法处理照片")); return; }
          context.drawImage(image, 0, 0, width, height);
          try { resolve(canvas.toDataURL("image/jpeg", 0.82)); }
          catch (error) { reject(new Error("照片处理失败，请重试")); }
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  async function chooseCoupleCover() {
    const input = byId("couple-cover-input");
    const file = input?.files?.[0];
    if (!file) return;
    const button = byId("couple-cover-change");
    if (button) { button.disabled = true; button.textContent = "处理中…"; }
    try {
      const coverImage = await resizeCover(file);
      if (!persistHomeSettings({ coverImage })) throw new Error("本机存储空间不足，封面没有保存");
      renderLoveDays();
      syncCurrent();
      notice("共同封面已经换好啦");
    } catch (error) {
      notice(error?.message || "封面更换失败，请重试");
    } finally {
      if (input) input.value = "";
      if (button) { button.disabled = false; button.textContent = "更换封面"; }
    }
  }

  function festivalDate(item, year) {
    return new Date(year, item.month - 1, item.day);
  }

  function nextFestival(item) {
    const now = new Date();
    let date = festivalDate(item, now.getFullYear());
    if (dayDiff(date, now) < 0) date = festivalDate(item, now.getFullYear() + 1);
    return { ...item, date, days: dayDiff(date, now) };
  }

  function renderFestivalCalendar() {
    const list = byId("festival-list");
    const card = byId("festival-countdown-card");
    const festivals = coupleFestivals.map(nextFestival).sort((a, b) => a.days - b.days);
    const next = festivals[0];
    if (card && next) {
      card.innerHTML = `<span>下一站</span><strong>${next.name} · 还有 ${next.days} 天</strong><small>${next.date.getFullYear()}-${String(next.date.getMonth() + 1).padStart(2, "0")}-${String(next.date.getDate()).padStart(2, "0")} · ${next.note}</small>`;
    }
    if (!list) return;
    list.replaceChildren();
    festivals.slice(0, 2).forEach((item) => {
      const row = document.createElement("article");
      row.className = "festival-item";
      const date = document.createElement("span");
      date.textContent = `${String(item.date.getMonth() + 1).padStart(2, "0")}.${String(item.date.getDate()).padStart(2, "0")}`;
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.name;
      const note = document.createElement("small");
      note.textContent = item.note;
      copy.append(title, note);
      const days = document.createElement("b");
      days.textContent = `还有 ${item.days} 天`;
      row.append(date, copy, days);
      list.append(row);
    });
  }

  function weatherText(code) {
    if ([0].includes(code)) return "晴";
    if ([1, 2, 3].includes(code)) return "多云";
    if ([45, 48].includes(code)) return "有雾";
    if ([51, 53, 55, 56, 57].includes(code)) return "毛毛雨";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "下雨";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "下雪";
    if ([95, 96, 99].includes(code)) return "雷雨";
    return "天气变化中";
  }

  function timeZoneHour(date, timeZone) {
    try {
      const part = new Intl.DateTimeFormat("zh-CN", { timeZone, hour: "2-digit", hourCycle: "h23" })
        .formatToParts(date)
        .find((item) => item.type === "hour");
      return Number(part?.value);
    } catch (error) { return date.getHours(); }
  }

  function timeZoneClock(date, timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("zh-CN", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }).formatToParts(date);
      const hour = Number(parts.find((part) => part.type === "hour")?.value);
      const minute = Number(parts.find((part) => part.type === "minute")?.value);
      return { hour, minute, label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
    } catch (error) {
      return { hour: date.getHours(), minute: date.getMinutes(), label: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` };
    }
  }

  function comfortableContactTime(date) {
    return weatherCities.every((city) => {
      const { hour } = timeZoneClock(date, city.timeZone);
      return hour >= 8 && hour < 23;
    });
  }

  function nextContactOverlap() {
    const now = new Date();
    const rounded = new Date(Math.ceil(now.getTime() / 1800000) * 1800000);
    for (let step = 0; step < 96; step += 1) {
      const start = new Date(rounded.getTime() + step * 1800000);
      const middle = new Date(start.getTime() + 60 * 60000);
      const end = new Date(start.getTime() + 120 * 60000);
      if (!comfortableContactTime(start) || !comfortableContactTime(middle) || !comfortableContactTime(new Date(end.getTime() - 60000))) continue;
      return {
        active: start.getTime() - now.getTime() <= 30 * 60000,
        shanghai: `${timeZoneClock(start, "Asia/Shanghai").label}–${timeZoneClock(end, "Asia/Shanghai").label}`,
        toronto: `${timeZoneClock(start, "America/Toronto").label}–${timeZoneClock(end, "America/Toronto").label}`
      };
    }
    return null;
  }

  function renderDistanceHeartbeat() {
    const overlap = nextContactOverlap();
    const label = byId("distance-overlap-label");
    const partnerStatus = byId("distance-partner-status");
    if (label) {
      label.textContent = overlap
        ? `${overlap.active ? "现在正合适" : "下一段"} · 上海 ${overlap.shanghai} / 多伦多 ${overlap.toronto}`
        : "今天的舒服时间还在计算";
    }
    const signal = window.DateInviteDistance?.getPartnerSignal?.();
    if (partnerStatus) {
      const statusLabels = { miss: "正在想你", available: "现在可以通话", busy: "正在忙，晚点找你", rest: "准备休息啦" };
      partnerStatus.textContent = signal
        ? `${displayName(signal.role) || "对方"} · ${statusLabels[signal.status] || "留下了新状态"}${signal.note ? ` · ${signal.note}` : ""}`
        : "留个状态，让她不用猜";
      partnerStatus.title = partnerStatus.textContent;
    }
  }

  function renderCityClocks() {
    const now = new Date();
    weatherCities.forEach((city) => {
      const card = document.querySelector(`[data-weather-city="${city.id}"]`);
      if (!card) return;
      const time = card.querySelector("[data-city-time]");
      const daypart = card.querySelector("[data-city-daypart]");
      const contact = card.querySelector("[data-contact-window]");
      const hour = timeZoneHour(now, city.timeZone);
      let timeLabel = "--:--";
      let dateLabel = "";
      try {
        timeLabel = new Intl.DateTimeFormat("zh-CN", { timeZone: city.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
        dateLabel = new Intl.DateTimeFormat("zh-CN", { timeZone: city.timeZone, weekday: "short", month: "numeric", day: "numeric" }).format(now);
      } catch (error) { /* Keep the fallback clock text. */ }
      if (time) { time.textContent = timeLabel; time.setAttribute("datetime", now.toISOString()); }
      if (daypart) daypart.textContent = `${dateLabel} · ${hour < 6 ? "深夜" : hour < 12 ? "早上" : hour < 18 ? "白天" : hour < 23 ? "晚上" : "深夜"}`;
      if (contact) {
        const comfortable = hour >= 8 && hour < 23;
        contact.textContent = comfortable ? "现在适合联系" : "现在可能在休息";
        contact.dataset.tone = comfortable ? "awake" : "rest";
      }
    });
    renderPartnerTimeHint();
  }

  function partnerCityContext(date = new Date()) {
    const myRole = roomState().role === "guest" ? "guest" : "host";
    const partnerRole = myRole === "guest" ? "host" : "guest";
    const myName = displayName(myRole);
    const looksLikeLeo = /leo|刘|平壹/i.test(myName);
    const looksLikeEmily = /emily|蔡|子珊/i.test(myName);
    const partnerCity = looksLikeLeo || (!looksLikeEmily && myRole === "host")
      ? weatherCities.find((city) => city.id === "shanghai")
      : weatherCities.find((city) => city.id === "toronto");
    return {
      city: partnerCity,
      clock: timeZoneClock(date, partnerCity.timeZone),
      name: displayName(partnerRole) || "对方"
    };
  }

  function renderPartnerTimeHint() {
    const hint = byId("home-chat-time-hint");
    if (!hint) return;
    const partner = partnerCityContext();
    const resting = partner.clock.hour < 8 || partner.clock.hour >= 23;
    const overlap = nextContactOverlap();
    let message;
    if (resting) {
      message = `${partner.name}那里是 ${partner.city.name} ${partner.clock.label} · 消息会安静送达`;
    } else if (overlap?.active) {
      message = `${partner.name}那里是 ${partner.city.name} ${partner.clock.label} · 现在正适合说说话`;
    } else {
      message = `${partner.name}那里是 ${partner.city.name} ${partner.clock.label} · 下一段同频 ${overlap?.shanghai || "正在计算"}`;
    }
    hint.textContent = message;
    hint.title = message;
    hint.dataset.tone = resting ? "rest" : overlap?.active ? "together" : "waiting";
  }

  async function loadWeather() {
    await Promise.all(weatherCities.map(async (city) => {
      const card = document.querySelector(`[data-weather-city="${city.id}"]`);
      if (!card) return;
      const title = card.querySelector("[data-weather-current]");
      const sub = card.querySelector("[data-weather-note]");
      if (title) title.textContent = "加载中";
      if (sub) sub.textContent = "正在看天气";
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code&timezone=auto`;
        const data = await fetch(url, { cache: "no-store" }).then((res) => {
          if (!res.ok) throw new Error("weather");
          return res.json();
        });
        const temp = Math.round(Number(data?.current?.temperature_2m));
        const code = Number(data?.current?.weather_code);
        if (title) title.textContent = Number.isFinite(temp) ? `${temp}℃ · ${weatherText(code)}` : weatherText(code);
        if (sub) sub.textContent = `${city.name}当前天气`;
      } catch (error) {
        if (title) title.textContent = "暂时未取到";
        if (sub) sub.textContent = "联网后再刷新";
      }
    }));
    renderCityClocks();
    renderDistanceHeartbeat();
  }

  function mindTransport() {
    return cloudIsActive() ? cloud() : shared();
  }

  function isMindBothOnline() {
    return Boolean(mindTransport()?.isBothOnline?.());
  }

  function connectMindTransport() {
    const data = interactions();
    const transport = mindTransport();
    if (!data || !transport?.isBothOnline || !transport?.sendRealtimePacket || !transport?.subscribe) return false;
    if (mindTransportSource === transport) {
      data.setMindRoomPresence?.(Boolean(transport.isBothOnline()));
      return true;
    }
    try { mindTransportCleanup?.(); } catch (error) { /* A stale listener cannot block a new room. */ }
    mindTransportCleanup = data.configureMindMatchTransport({
      isBothOnline: () => Boolean(transport.isBothOnline?.()),
      send: (packet) => transport.sendRealtimePacket(packet),
      subscribe: (listener) => transport.subscribe(listener)
    });
    mindTransportSource = transport;
    data.setMindRoomPresence?.(Boolean(transport.isBothOnline()));
    return true;
  }

  function displayName(role) {
    return cloud()?.getDisplayName?.(role) || (role === "guest" ? "对方" : "我");
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

  function currentChatMessages() {
    return cloudIsActive()
      ? (cloud()?.getMessages?.() || []).map(normalizeStoredChatMessage).filter(Boolean).sort((left, right) => left.createdAt - right.createdAt).slice(-100)
      : (readStoredChatMessages().length ? readStoredChatMessages() : (shared()?.getMessages?.() || []).map(normalizeStoredChatMessage).filter(Boolean));
  }

  function writeChatMessages(messages) {
    const normalized = Array.isArray(messages)
      ? messages.map(normalizeStoredChatMessage).filter(Boolean).sort((left, right) => left.createdAt - right.createdAt).slice(-100)
      : [];
    try {
      try { window.DateInviteBackups?.capture?.("聊天消息变更前"); } catch (backupError) { /* 备份失败不阻塞聊天。 */ }
      window.localStorage.setItem(CHAT_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { messages: normalized } }));
      syncCurrent();
      return true;
    } catch (error) {
      notice("这条消息暂时没有保存成功，请稍后再试。");
      return false;
    }
  }

  function chatFavoriteIds() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CHAT_FAVORITES_KEY) || "[]");
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch (error) {
      return new Set();
    }
  }

  function writeChatFavoriteIds(ids) {
    try { localStorage.setItem(CHAT_FAVORITES_KEY, JSON.stringify([...ids].slice(-200))); } catch (error) { /* 本机收藏失败不阻塞聊天。 */ }
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
    renderPartnerTimeHint();
    const setPresence = (online, label) => {
      if (!presence) return;
      presence.classList.toggle("is-online", Boolean(online));
      const dot = document.createElement("i");
      dot.setAttribute("aria-hidden", "true");
      presence.replaceChildren(dot, document.createTextNode(label));
    };
    if (!state.room) {
      status.textContent = "未连接 · 正在准备双人空间";
      status.dataset.tone = "offline";
      setPresence(false, "未连接");
      return;
    }
    if (state.kind === "cloud") {
      const cloudStatus = cloud()?.getStatus?.() || {};
      if (cloudStatus.kind === "waiting") {
        status.textContent = "已保存 · 等网络恢复后同步";
        status.dataset.tone = "offline";
        setPresence(false, "等待同步");
      } else {
        status.textContent = state.online ? "已连接 · 对方正在这里" : "已连接 · 对方打开就能看到";
        status.dataset.tone = state.online ? "online" : "waiting";
        setPresence(state.online, state.online ? "一起在线" : "云端在线");
      }
      return;
    }
    status.textContent = state.online ? "已连接 · 对方正在这里" : "已连接 · 等对方打开";
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
    if (voiceRecorder || voiceStopping || voiceTickTimer) cancelVoiceRecording();
    const dialog = byId("interactions-dialog");
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function hideMessageActions() {
    const menu = byId("home-message-actions");
    activeChatActionMessageId = "";
    if (menu) menu.hidden = true;
  }

  function showMessageActions(message, anchor) {
    const menu = byId("home-message-actions");
    if (!menu || !message?.id || !anchor) return;
    activeChatActionMessageId = message.id;
    const rect = anchor.getBoundingClientRect();
    menu.hidden = false;
    menu.style.left = `${Math.min(window.innerWidth - 170, Math.max(12, rect.left + rect.width / 2 - 78))}px`;
    menu.style.top = `${Math.max(12, rect.top - 48)}px`;
    menu.dataset.hasText = message.text ? "true" : "false";
  }

  function bindChatBubbleActions(card, message) {
    let pressTimer = 0;
    const start = () => {
      window.clearTimeout(pressTimer);
      pressTimer = window.setTimeout(() => showMessageActions(message, card), 520);
    };
    const stop = () => window.clearTimeout(pressTimer);
    card.addEventListener("pointerdown", start);
    card.addEventListener("pointerup", stop);
    card.addEventListener("pointerleave", stop);
    card.addEventListener("pointercancel", stop);
    card.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      showMessageActions(message, card);
    });
    card.addEventListener("dblclick", () => showMessageActions(message, card));
  }

  function handleMessageAction(action) {
    const id = activeChatActionMessageId;
    if (!id) return hideMessageActions();
    const messages = currentChatMessages();
    const message = messages.find((item) => item.id === id);
    if (!message) return hideMessageActions();
    if (action === "copy") {
      const text = message.text || (message.plan ? datePlanText(message.plan) : "");
      if (!text) notice("这条消息没有可复制的文字。");
      else navigator.clipboard?.writeText(text).then(() => notice("已复制")).catch(() => notice(text));
    } else if (action === "favorite") {
      const ids = chatFavoriteIds();
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      writeChatFavoriteIds(ids);
      renderHomeChat();
      notice(ids.has(id) ? "已收藏这条消息" : "已取消收藏");
    } else if (action === "delete") {
      if (window.confirm("删除这条消息吗？双方同步后都会看不到。")) {
        writeChatMessages(messages.filter((item) => item.id !== id));
        renderHomeChat();
        notice("消息已删除");
      }
    }
    hideMessageActions();
  }

  function renderHomeChat() {
    const list = byId("home-chat-list");
    if (!list) return;
    const messages = currentChatMessages();
    const mine = roomState().role;
    const favorites = chatFavoriteIds();
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
      card.classList.add(`is-role-${message.author === "guest" ? "guest" : "host"}`);
      card.dataset.messageId = message.id;
      card.classList.toggle("is-favorite", favorites.has(message.id));
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
      // 名字由首次取名后的固定身份映射得出；不会再因页面重开而交换“谁是谁”。
      meta.textContent = `${displayName(message.author)} · ${formatTime(message.createdAt)}`;
      card.append(meta);
      if (favorites.has(message.id)) {
        const star = document.createElement("span");
        star.className = "home-chat-favorite-mark";
        star.textContent = "★";
        star.setAttribute("aria-label", "已收藏");
        card.append(star);
      }
      bindChatBubbleActions(card, message);
      list.append(card);
    });
    list.scrollTop = list.scrollHeight;
  }

  function normalizeHomeTab(tab) {
    if (tab === "theme" || tab === "game") return "together";
    return ["today", "chat", "world", "together", "us"].includes(tab) ? tab : "today";
  }

  function switchHomeTab(tab) {
    const selected = normalizeHomeTab(tab);
    const currentPanel = document.querySelector(`[data-home-tab-panel="${activeHomeTab}"]`);
    if (homeTabsReady && selected === activeHomeTab) {
      currentPanel?.scrollTo?.({ top: 0, behavior: "smooth" });
      return;
    }
    if (currentPanel) homeTabScroll.set(activeHomeTab, currentPanel.scrollTop || 0);
    const chatInput = byId("home-chat-input");
    if (selected !== "chat" && document.activeElement === chatInput) chatInput.blur();
    activeHomeTab = selected;
    document.querySelector(".home-screen")?.setAttribute("data-home-active-tab", selected);
    document.querySelectorAll("[data-home-tab-panel]").forEach((panel) => {
      const active = panel.dataset.homeTabPanel === selected;
      panel.hidden = !active;
      panel.classList.toggle("is-home-tab-active", active);
    });
    document.querySelectorAll("[data-home-tab]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.homeTab === selected));
      if (button.dataset.homeTab === selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (selected === "chat") renderHomeChat();
    if (selected === "world") renderWorldPosts();
    if (selected === "today") renderLatestWorldCard();
    const nextPanel = document.querySelector(`[data-home-tab-panel="${selected}"]`);
    requestAnimationFrame(() => {
      if (nextPanel) nextPanel.scrollTop = homeTabScroll.get(selected) || 0;
      window.dispatchEvent(new Event("date-invite-chat-viewport-sync"));
    });
    homeTabsReady = true;
  }

  function worldPostAuthor(authorName) {
    const name = String(authorName || displayName(roomState().role) || "我们").slice(0, 12);
    return name || "我们";
  }

  function localUserId() {
    try {
      let saved = localStorage.getItem(LOCAL_USER_KEY);
      if (!saved) {
        saved = `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(LOCAL_USER_KEY, saved);
      }
      return saved;
    } catch (error) { return "local-private"; }
  }

  function currentWorldUser() {
    const identity = cloud()?.getIdentity?.()?.me;
    const role = roomState().role || "host";
    return {
      id: identity?.deviceId ? `cloud-${identity.deviceId}` : `${role}-${localUserId()}`,
      name: worldPostAuthor(identity?.name || displayName(role))
    };
  }

  function backupWorld(action) {
    try { window.DateInviteBackups?.capture?.(`我们的世界-${action}`); } catch (error) { /* 备份失败不影响发布 */ }
  }

  function renderWorldImagePreview(index = worldPreviewIndex, slides = null) {
    const dialog = byId("world-image-lightbox");
    const counter = dialog?.querySelector("[data-world-preview-counter]");
    const previousButton = dialog?.querySelector(".world-image-nav.is-prev");
    const nextButton = dialog?.querySelector(".world-image-nav.is-next");
    const slideNodes = slides || [...(dialog?.querySelectorAll("[data-swipe-gallery-slide]") || [])];
    if (!dialog || !worldPreviewPhotos.length || slideNodes.length !== 3) return;
    worldPreviewIndex = Math.max(0, Math.min(Number(index) || 0, worldPreviewPhotos.length - 1));
    [-1, 0, 1].forEach((offset, slideIndex) => {
      const image = slideNodes[slideIndex];
      const item = worldPreviewPhotos[worldPreviewIndex + offset];
      image.classList.toggle("is-empty", !item);
      image.setAttribute("aria-hidden", String(offset !== 0 || !item));
      if (!item) {
        image.removeAttribute("src");
        image.alt = "";
        return;
      }
      if (image.src !== item.source) image.src = item.source;
      image.alt = offset === 0 ? item.title : "";
      image.decode?.().catch(() => undefined);
    });
    if (counter) counter.textContent = `${worldPreviewIndex + 1} / ${worldPreviewPhotos.length}`;
    if (previousButton) previousButton.disabled = worldPreviewIndex <= 0;
    if (nextButton) nextButton.disabled = worldPreviewIndex >= worldPreviewPhotos.length - 1;
  }

  function updateWorldImagePreview() {
    if (worldPreviewGallery) worldPreviewGallery.setIndex(worldPreviewIndex);
    else renderWorldImagePreview();
  }

  function moveWorldImagePreview(step) {
    if (!worldPreviewPhotos.length) return;
    if (worldPreviewGallery) {
      worldPreviewGallery.move(step);
      return;
    }
    worldPreviewIndex = Math.max(0, Math.min(worldPreviewIndex + step, worldPreviewPhotos.length - 1));
    renderWorldImagePreview();
  }

  function openImagePreview(source, title = "原图预览", group = null, index = 0) {
    if (!source) return;
    let dialog = byId("world-image-lightbox");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "world-image-lightbox";
      dialog.className = "world-image-lightbox";
      dialog.innerHTML = `
        <button class="world-image-close" type="button" aria-label="关闭照片预览">×</button>
        <button class="world-image-nav is-prev" type="button" aria-label="上一张照片">‹</button>
        <button class="world-image-nav is-next" type="button" aria-label="下一张照片">›</button>
        <div class="swipe-gallery-stage world-image-stage">
          <div class="swipe-gallery-track">
            <img data-swipe-gallery-slide="previous" alt="" aria-hidden="true">
            <img data-swipe-gallery-slide="current" alt="照片预览">
            <img data-swipe-gallery-slide="next" alt="" aria-hidden="true">
          </div>
        </div>
        <span data-world-preview-counter>1 / 1</span>`;
      document.body.append(dialog);
      dialog.querySelector(".world-image-close")?.addEventListener("click", () => dialog.close?.());
      dialog.querySelector(".world-image-nav.is-prev")?.addEventListener("click", () => moveWorldImagePreview(-1));
      dialog.querySelector(".world-image-nav.is-next")?.addEventListener("click", () => moveWorldImagePreview(1));
      worldPreviewGallery = window.DateInviteSwipeGallery?.create?.({
        stage: dialog.querySelector(".swipe-gallery-stage"),
        track: dialog.querySelector(".swipe-gallery-track"),
        getCount: () => worldPreviewPhotos.length,
        render: ({ index: previewIndex, slides }) => renderWorldImagePreview(previewIndex, slides),
        onIndexChange: (previewIndex) => { worldPreviewIndex = previewIndex; }
      }) || null;
      dialog.classList.toggle("has-swipe-gallery", Boolean(worldPreviewGallery));
      dialog.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") moveWorldImagePreview(-1);
        if (event.key === "ArrowRight") moveWorldImagePreview(1);
      });
      dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close?.(); });
      dialog.addEventListener("close", () => worldPreviewGallery?.cancel?.());
    }
    const photos = Array.isArray(group) && group.length ? group : [{ source, title }];
    worldPreviewPhotos = photos.map((item, itemIndex) => ({
      source: typeof item === "string" ? item : item.source,
      title: typeof item === "string" ? `我们的世界照片 ${itemIndex + 1}` : (item.title || `我们的世界照片 ${itemIndex + 1}`)
    })).filter((item) => item.source);
    worldPreviewIndex = Math.max(0, Math.min(Number(index) || 0, worldPreviewPhotos.length - 1));
    updateWorldImagePreview();
    try { dialog.showModal(); } catch (error) { dialog.setAttribute("open", ""); }
    dialog.focus?.();
  }

  function worldLikeCount(post) {
    const likedByCount = Array.isArray(post?.likedBy) ? post.likedBy.length : 0;
    return Math.max(likedByCount, Math.max(0, Number(post?.likes) || 0));
  }

  function toggleWorldLike(post) {
    const user = currentWorldUser();
    const likedBy = Array.isArray(post.likedBy) ? [...post.likedBy] : [];
    if (likedBy.includes(user.id)) { notice("这条你已经点过喜欢啦"); return; }
    likedBy.push(user.id);
    backupWorld("点赞前");
    interactions()?.updateWorldPost?.(post.id, { likedBy, likes: Math.max(worldLikeCount(post) + 1, likedBy.length) });
    syncCurrent();
    renderWorldPosts();
  }

  function addWorldComment(post, parentComment = null) {
    const user = currentWorldUser();
    const prefix = parentComment ? `回复 ${worldPostAuthor(parentComment.author)}：` : "写一条评论：";
    const message = String(window.prompt(prefix, "") || "").trim().slice(0, 180);
    if (!message) return;
    const comments = Array.isArray(post.comments) ? [...post.comments] : [];
    comments.push({
      id: `world-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      author: user.name,
      message,
      parentId: parentComment?.id || "",
      replyToAuthor: parentComment ? worldPostAuthor(parentComment.author) : "",
      createdAt: Date.now()
    });
    backupWorld("评论前");
    interactions()?.updateWorldPost?.(post.id, { comments });
    syncCurrent();
    renderWorldPosts();
  }

  function removeWorldPost(post) {
    if (!post?.id) return;
    if (!window.confirm("确定删除这条动态吗？双方手机里都会一起删除。")) return;
    backupWorld("删除动态前");
    interactions()?.removeWorldPost?.(post.id);
    syncCurrent();
    renderWorldPosts();
    notice("这条动态已删除");
  }

  function renderWorldPreview() {
    const preview = byId("world-compose-preview");
    if (!preview) return;
    preview.replaceChildren();
    preview.hidden = !selectedWorldPhotos.length;
    selectedWorldPhotos.forEach((source, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "world-compose-photo";
      item.setAttribute("aria-label", `移除第 ${index + 1} 张照片`);
      const image = document.createElement("img");
      image.src = source;
      image.alt = `准备发布的照片 ${index + 1}`;
      const mark = document.createElement("span");
      mark.textContent = "×";
      item.append(image, mark);
      item.addEventListener("click", () => {
        selectedWorldPhotos.splice(index, 1);
        renderWorldPreview();
      });
      preview.append(item);
    });
  }

  function renderLatestWorldCard() {
    const card = byId("home-latest-world");
    if (!card) return;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "打开我们的世界最近动态");
    card.onclick = () => switchHomeTab("world");
    card.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        switchHomeTab("world");
      }
    };
    const posts = (interactions()?.read?.("worldPosts") || []).slice().sort((left, right) => Number(right.createdAt) - Number(left.createdAt));
    const latest = posts[0];
    if (!latest) {
      card.classList.remove("has-photo");
      card.innerHTML = `<span aria-hidden="true">✦</span><div><strong>还没有新的动态</strong><small>发布一张照片或一句话，这里会自动出现。</small></div>`;
      return;
    }
    const author = worldPostAuthor(latest.author);
    const text = String(latest.message || (latest.photos?.length ? "分享了新的照片" : "更新了动态")).slice(0, 44);
    const photo = latest.photos?.[0] || "";
    card.classList.toggle("has-photo", Boolean(photo));
    card.replaceChildren();
    if (photo) {
      const image = document.createElement("img");
      image.src = photo;
      image.alt = "最近动态照片";
      card.append(image);
    } else {
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "✦";
      card.append(icon);
    }
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `来自 ${author}`;
    const copy = document.createElement("small");
    copy.textContent = `${text} · ${formatTime(latest.createdAt)}`;
    body.append(title, copy);
    card.append(body);
  }

  async function chooseWorldPhotos() {
    const input = byId("world-photo-input");
    const files = Array.from(input?.files || []).filter((file) => file.type.startsWith("image/")).slice(0, 3);
    if (!files.length) return;
    try {
      const remaining = Math.max(0, 3 - selectedWorldPhotos.length);
      const photos = [];
      for (const file of files.slice(0, remaining)) photos.push(await compressImage(file, 900000));
      selectedWorldPhotos = [...selectedWorldPhotos, ...photos].slice(0, 3);
      renderWorldPreview();
    } catch (error) {
      notice(error?.message || "这张照片暂时不能发布");
    } finally {
      if (input) input.value = "";
    }
  }

  function renderWorldPosts() {
    const feed = byId("world-feed");
    if (!feed) return;
    const posts = interactions()?.read?.("worldPosts") || [];
    renderLatestWorldCard();
    feed.replaceChildren();
    if (!posts.length) {
      const empty = document.createElement("article");
      empty.className = "world-empty";
      empty.innerHTML = "<strong>还没有生活碎片</strong><p>发第一条吧，可以是一句话，也可以是今天的一张照片。</p>";
      feed.append(empty);
      return;
    }
    posts.forEach((post) => {
      const item = document.createElement("article");
      item.className = "world-post";
      const head = document.createElement("header");
      const avatar = document.createElement("span");
      avatar.className = "world-avatar";
      avatar.textContent = worldPostAuthor(post.author).slice(0, 1);
      const meta = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = worldPostAuthor(post.author);
      const time = document.createElement("time");
      time.dateTime = new Date(post.createdAt).toISOString();
      time.textContent = formatTime(post.createdAt);
      meta.append(name, time);
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "world-post-delete";
      deleteButton.textContent = "删除";
      deleteButton.setAttribute("aria-label", "删除这条动态");
      deleteButton.addEventListener("click", () => removeWorldPost(post));
      head.append(avatar, meta, deleteButton);
      item.append(head);
      if (post.message) {
        const text = document.createElement("p");
        text.className = "world-post-text";
        text.textContent = post.message;
        item.append(text);
      }
      if (post.photos?.length) {
        const grid = document.createElement("div");
        grid.className = `world-photo-grid world-photo-count-${post.photos.length}`;
        post.photos.forEach((source, index) => {
          const image = document.createElement("img");
          image.src = source;
          image.alt = `我们的世界照片 ${index + 1}`;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "world-photo-view";
          button.setAttribute("aria-label", `查看第 ${index + 1} 张原图`);
          button.append(image);
          button.addEventListener("click", () => openImagePreview(
            source,
            `我们的世界照片 ${index + 1}`,
            post.photos.map((photoSource, photoIndex) => ({ source: photoSource, title: `我们的世界照片 ${photoIndex + 1}` })),
            index
          ));
          grid.append(button);
        });
        item.append(grid);
      }
      const actions = document.createElement("footer");
      const like = document.createElement("button");
      like.type = "button";
      const user = currentWorldUser();
      const liked = Array.isArray(post.likedBy) && post.likedBy.includes(user.id);
      like.className = liked ? "is-liked" : "";
      like.setAttribute("aria-pressed", String(liked));
      like.innerHTML = `<span aria-hidden="true">♥</span> ${worldLikeCount(post)}`;
      like.setAttribute("aria-label", "喜欢这条动态");
      like.addEventListener("click", () => toggleWorldLike(post));
      const commentButton = document.createElement("button");
      commentButton.type = "button";
      commentButton.innerHTML = `<span aria-hidden="true">☰</span> ${post.comments?.length || 0} 评论`;
      commentButton.addEventListener("click", () => addWorldComment(post));
      actions.append(like, commentButton);
      item.append(actions);
      if (post.comments?.length) {
        const commentList = document.createElement("div");
        commentList.className = "world-comments";
        post.comments.forEach((comment) => {
          const row = document.createElement("article");
          row.className = comment.parentId ? "world-comment is-reply" : "world-comment";
          const body = document.createElement("p");
          const author = document.createElement("strong");
          author.textContent = worldPostAuthor(comment.author);
          body.append(author, document.createTextNode(`：${comment.replyToAuthor ? `回复 ${comment.replyToAuthor} · ` : ""}${comment.message}`));
          const reply = document.createElement("button");
          reply.type = "button";
          reply.textContent = "回复";
          reply.addEventListener("click", () => addWorldComment(post, comment));
          row.append(body, reply);
          commentList.append(row);
        });
        item.append(commentList);
      }
      feed.append(item);
    });
  }

  function addWorldPost(event) {
    event.preventDefault();
    const input = byId("world-post-text");
    const message = String(input?.value || "").trim();
    if (!message && !selectedWorldPhotos.length) {
      input?.focus();
      notice("写点文字，或者选几张照片再发布");
      return;
    }
    try {
      const user = currentWorldUser();
      backupWorld("发布前");
      interactions()?.addWorldPost?.({ message, photos: selectedWorldPhotos, author: user.name, likedBy: [], likes: 0 });
      if (input) input.value = "";
      selectedWorldPhotos = [];
      renderWorldPreview();
      renderWorldPosts();
      renderLatestWorldCard();
      syncCurrent();
      notice("已经发布到我们的世界");
    } catch (error) {
      notice(error?.message || "这条动态暂时没有发布成功");
    }
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

  async function legacyStartVoiceRecording() {
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

  function legacyStopVoiceRecording() {
    if (voiceStopTimer) clearTimeout(voiceStopTimer);
    voiceStopTimer = null;
    voiceRecorder?.stop();
  }

  function legacySaveVoicePostcard(result) {
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

  // 录音状态：明确展示请求麦克风、录音计时、结束整理和发送结果。
  function formatVoiceDuration(milliseconds) {
    const seconds = Math.max(0, Math.min(30, Math.floor((Number(milliseconds) || 0) / 1000)));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function clearVoiceTick() {
    if (!voiceTickTimer) return;
    clearInterval(voiceTickTimer);
    voiceTickTimer = null;
  }

  function updateVoiceTimer() {
    const timer = byId("voice-recording-timer");
    if (!timer || !voiceStartedAt) return;
    const elapsed = Math.max(0, Math.min(30000, Date.now() - voiceStartedAt));
    timer.textContent = formatVoiceDuration(elapsed);
    timer.dateTime = `PT${Math.floor(elapsed / 1000)}S`;
  }

  function setVoiceRecordingUi(state = "idle", message = "") {
    const record = byId("voice-record");
    const stop = byId("voice-stop");
    const panel = byId("voice-recording-state");
    const label = byId("voice-recording-label");
    const status = byId("voice-recording-status");
    const section = record?.closest?.(".voice-section");
    const isStarting = state === "starting";
    const isRecording = state === "recording";
    const isStopping = state === "stopping";
    const active = isStarting || isRecording || isStopping;
    section?.classList.toggle("is-recording", active);
    record?.classList.toggle("is-recording", active);
    stop?.classList.toggle("is-recording", isRecording);
    if (record) {
      record.disabled = active;
      record.textContent = isStarting ? "正在准备…" : isRecording ? "正在录音…" : isStopping ? "正在保存…" : "开始录音";
      record.setAttribute("aria-pressed", String(isRecording));
    }
    if (stop) {
      stop.disabled = !isRecording;
      stop.textContent = isStopping ? "正在保存…" : "结束并寄出";
    }
    if (panel) panel.hidden = !active;
    if (label) label.textContent = isStarting ? "正在打开麦克风" : isStopping ? "正在整理声音" : "正在录音";
    if (state === "idle") {
      clearVoiceTick();
      const timer = byId("voice-recording-timer");
      if (timer) { timer.textContent = "0:00"; timer.dateTime = "PT0S"; }
    }
    if (status && message) status.textContent = message;
  }

  function cancelVoiceRecording(message = "录音已取消，没有发送") {
    const recorder = voiceRecorder;
    voiceDiscarded = true;
    voiceStopping = false;
    if (voiceStopTimer) clearTimeout(voiceStopTimer);
    voiceStopTimer = null;
    clearVoiceTick();
    voiceRecorder = null;
    try { recorder?.cancel?.(); } catch (error) { /* Stop failures are handled by the reset below. */ }
    setVoiceRecordingUi("idle", message);
  }

  async function startVoiceRecording() {
    if (!roomState().room) {
      shared()?.openRoom?.();
      setVoiceRecordingUi("idle", "先连接你们的双人空间，才可以把声音寄给对方。");
      notice("先连接你们的空间，才可以把声音寄给她");
      return;
    }
    if (voiceRecorder?.state === "recording" || voiceStopping) return;
    voiceDiscarded = false;
    voiceStopping = false;
    setVoiceRecordingUi("starting", "正在请求麦克风权限…允许后就会开始录音。");
    try {
      const recorder = interactions()?.createVoiceRecorder?.({
        handlers: {
          onStart() {
            if (voiceRecorder !== recorder) return;
            voiceStartedAt = Date.now();
            setVoiceRecordingUi("recording", "正在录音，说完请点击“结束并寄出”。");
            updateVoiceTimer();
            clearVoiceTick();
            voiceTickTimer = setInterval(updateVoiceTimer, 250);
            notice("正在录音，最长 30 秒");
          },
          onStop(result) {
            if (voiceRecorder !== recorder && !voiceDiscarded) return;
            saveVoicePostcard(result);
          },
          onError() {
            if (voiceRecorder !== recorder) return;
            cancelVoiceRecording("麦克风暂时无法使用，请检查浏览器的麦克风权限。");
            notice("麦克风暂时无法使用，请检查权限");
          }
        }
      });
      if (!recorder) throw new Error("这台设备暂时不支持录音");
      voiceRecorder = recorder;
      const started = await recorder.start();
      // 权限弹窗期间可能已被关闭／取消；此时不再安排自动停止计时。
      if (!started || voiceRecorder !== recorder || recorder.state !== "recording") return;
      voiceStopTimer = setTimeout(() => stopVoiceRecording(true), 30000);
    } catch (error) {
      voiceRecorder = null;
      voiceStopping = false;
      clearVoiceTick();
      setVoiceRecordingUi("idle", error?.message || "麦克风权限没有打开，请允许后再试。");
      notice(error?.message || "麦克风权限没有打开");
    }
  }

  async function stopVoiceRecording(autoStopped = false) {
    const recorder = voiceRecorder;
    if (!recorder || recorder.state !== "recording" || voiceStopping) return;
    voiceStopping = true;
    if (voiceStopTimer) clearTimeout(voiceStopTimer);
    voiceStopTimer = null;
    clearVoiceTick();
    updateVoiceTimer();
    setVoiceRecordingUi("stopping", autoStopped ? "已录满 30 秒，正在整理并寄出…" : "正在整理声音，马上寄出…");
    try {
      await recorder.stop();
    } catch (error) {
      if (voiceRecorder === recorder) cancelVoiceRecording(error?.message || "录音没有保存成功，请再试一次。");
    }
  }

  function saveVoicePostcard(result) {
    const duration = Math.max(1, Math.round((Date.now() - voiceStartedAt) / 1000));
    if (voiceStopTimer) clearTimeout(voiceStopTimer);
    voiceStopTimer = null;
    clearVoiceTick();
    voiceStopping = false;
    voiceRecorder = null;
    if (voiceDiscarded) {
      voiceDiscarded = false;
      setVoiceRecordingUi("idle", "录音已取消，没有发送。");
      return;
    }
    if (!result?.audioData) {
      setVoiceRecordingUi("idle", "录音没有保存成功，请再试一次。");
      notice("录音没有保存成功");
      return;
    }
    if (result.audioData.length > MAX_AUDIO_CHARS) {
      setVoiceRecordingUi("idle", "这段录音有点长，请控制在 30 秒以内再试。");
      notice("这段录音有点长，请控制在 30 秒以内再试");
      return;
    }
    try {
      const role = roomState().role;
      interactions()?.addVoicePostcard?.({ audioData: result.audioData, duration, author: displayName(role) });
      syncCurrent();
      renderVoicePostcards();
      setVoiceRecordingUi("idle", `声音明信片已寄出 · ${formatVoiceDuration(duration * 1000)}`);
      notice("声音明信片已经寄出啦");
    } catch (error) {
      setVoiceRecordingUi("idle", error?.message || "声音明信片保存失败，请再试一次。");
      notice(error?.message || "声音明信片保存失败");
    } finally {
      voiceStartedAt = 0;
    }
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
    const online = isMindBothOnline();
    if (!session) {
      if (status) status.textContent = online ? "双方都在线啦，出一个题目开始吧。" : "需要双方同时在线，才能开始心有灵犀。";
      if (create) { create.disabled = !online; create.textContent = "出这一题"; }
      if (ready) ready.disabled = true;
      if (answer) { answer.disabled = true; answer.value = ""; }
      if (submit) submit.disabled = true;
      if (result) result.hidden = true;
      return;
    }
    if (prompt) prompt.value = session.prompt;
    if (create) {
      const canStartNext = session.status === "revealed" && online;
      create.disabled = !canStartNext;
      create.textContent = canStartNext ? "再来一题" : "题目进行中";
    }
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
    if (!isMindBothOnline()) { notice("要等你们两个都在线才能开始"); return; }
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
    byId("weather-refresh")?.addEventListener("click", loadWeather);
    byId("couple-cover-change")?.addEventListener("click", () => byId("couple-cover-input")?.click());
    byId("couple-cover-input")?.addEventListener("change", chooseCoupleCover);
    document.querySelectorAll("[data-home-tab]").forEach((button) => {
      button.addEventListener("click", () => switchHomeTab(button.dataset.homeTab));
    });
    document.querySelectorAll("[data-home-tab-jump]").forEach((button) => {
      button.addEventListener("click", () => switchHomeTab(button.dataset.homeTabJump));
    });
    const chatInput = byId("home-chat-input");
    let mobileViewportFrame = null;
    let keyboardLayoutActive = false;
    let keyboardRestoreScrollY = 0;
    let keyboardBaselineHeight = Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight));
    let keyboardBaselineWidth = Math.max(1, Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth));
    let keyboardFocusPendingUntil = 0;
    let keyboardClosingUntil = 0;
    let keyboardOrientationResetUntil = 0;
    let keyboardOrientationTimer = null;
    const beginKeyboardOrientationReset = () => {
      if (document.activeElement === chatInput) chatInput.blur();
      const resetAt = performance.now() + 1100;
      keyboardFocusPendingUntil = 0;
      keyboardClosingUntil = Math.max(keyboardClosingUntil, resetAt);
      keyboardOrientationResetUntil = resetAt;
      if (keyboardOrientationTimer) window.clearTimeout(keyboardOrientationTimer);
      keyboardOrientationTimer = window.setTimeout(() => {
        keyboardOrientationTimer = null;
        const viewport = window.visualViewport;
        keyboardBaselineHeight = Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight));
        keyboardBaselineWidth = Math.max(1, Math.round(viewport?.width || window.innerWidth || document.documentElement.clientWidth));
        keyboardClosingUntil = 0;
        keyboardOrientationResetUntil = 0;
        updateMobileViewport();
      }, 1120);
    };
    const updateMobileViewport = () => {
      if (mobileViewportFrame) window.cancelAnimationFrame(mobileViewportFrame);
      mobileViewportFrame = window.requestAnimationFrame(() => {
        mobileViewportFrame = null;
        const viewport = window.visualViewport;
        const root = document.documentElement;
        const home = document.querySelector(".home-screen");
        const list = byId("home-chat-list");
        const wasNearBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 96;
        const height = Math.max(1, Math.round(viewport?.height || window.innerHeight || root.clientHeight));
        const width = Math.max(1, Math.round(viewport?.width || window.innerWidth || root.clientWidth));
        const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
        const offsetLeft = Math.max(0, Math.round(viewport?.offsetLeft || 0));
        root.style.setProperty("--app-viewport-height", `${height}px`);
        root.style.setProperty("--app-viewport-width", `${width}px`);
        root.style.setProperty("--app-viewport-offset-top", `${offsetTop}px`);
        root.style.setProperty("--app-viewport-center-x", `${offsetLeft + width / 2}px`);

        let keyboardTarget = document.activeElement === chatInput;
        const touchLayout = window.matchMedia?.("(pointer: coarse)")?.matches || window.innerWidth <= 600;
        const chatActive = home?.dataset.homeActiveTab === "chat";
        const now = performance.now();
        const orientationChanged = Math.abs(width - keyboardBaselineWidth) > 72;
        if (orientationChanged && (keyboardLayoutActive || keyboardTarget) && now >= keyboardOrientationResetUntil) {
          beginKeyboardOrientationReset();
          keyboardTarget = document.activeElement === chatInput;
        }
        if (!keyboardLayoutActive && !keyboardTarget && now >= keyboardOrientationResetUntil) {
          keyboardBaselineHeight = height;
          keyboardBaselineWidth = width;
        }
        const viewportDeficit = Math.max(0, keyboardBaselineHeight - height);
        const keyboardVisible = viewportDeficit > Math.max(72, keyboardBaselineHeight * .12);
        const viewportRecovered = viewportDeficit < 36 && offsetTop < 4;
        const opening = keyboardTarget && now < keyboardFocusPendingUntil;
        const closing = keyboardLayoutActive && !keyboardTarget && now < keyboardClosingUntil && (
          !viewportRecovered || now < keyboardOrientationResetUntil
        );
        const keyboardOpen = Boolean(touchLayout && chatActive && (
          opening || (keyboardTarget && keyboardVisible) || closing
        ));
        root.classList.toggle("is-chat-keyboard-open", keyboardOpen);
        document.body.classList.toggle("is-chat-keyboard-open", keyboardOpen);
        home?.classList.toggle("is-chat-keyboard", keyboardOpen);
        if (keyboardOpen && wasNearBottom && list) {
          window.requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
        }
        if (!keyboardOpen && keyboardLayoutActive) {
          window.requestAnimationFrame(() => window.scrollTo({ top: keyboardRestoreScrollY, left: 0, behavior: "auto" }));
          if (!keyboardTarget) {
            keyboardBaselineHeight = height;
            keyboardBaselineWidth = width;
          }
        }
        keyboardLayoutActive = keyboardOpen;
      });
    };
    const syncDuringKeyboardAnimation = () => {
      updateMobileViewport();
      window.setTimeout(updateMobileViewport, 80);
      window.setTimeout(updateMobileViewport, 320);
      window.setTimeout(updateMobileViewport, 420);
      window.setTimeout(updateMobileViewport, 720);
      window.setTimeout(updateMobileViewport, 900);
    };
    chatInput?.addEventListener("focus", () => {
      if (keyboardOrientationTimer) window.clearTimeout(keyboardOrientationTimer);
      keyboardOrientationTimer = null;
      keyboardOrientationResetUntil = 0;
      keyboardRestoreScrollY = window.scrollY || 0;
      const viewport = window.visualViewport;
      const width = Math.max(1, Math.round(viewport?.width || window.innerWidth || document.documentElement.clientWidth));
      const height = Math.max(1, Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight));
      if (Math.abs(width - keyboardBaselineWidth) > 72) keyboardBaselineHeight = height;
      else keyboardBaselineHeight = Math.max(keyboardBaselineHeight, height);
      keyboardBaselineWidth = width;
      keyboardFocusPendingUntil = performance.now() + 360;
      keyboardClosingUntil = 0;
      syncDuringKeyboardAnimation();
    });
    chatInput?.addEventListener("blur", () => {
      keyboardFocusPendingUntil = 0;
      keyboardClosingUntil = Math.max(keyboardClosingUntil, performance.now() + 760);
      syncDuringKeyboardAnimation();
    });
    window.visualViewport?.addEventListener("resize", updateMobileViewport);
    window.visualViewport?.addEventListener("scroll", updateMobileViewport);
    window.addEventListener("resize", updateMobileViewport, { passive: true });
    window.addEventListener("pageshow", updateMobileViewport);
    window.addEventListener("orientationchange", beginKeyboardOrientationReset);
    window.addEventListener("date-invite-chat-viewport-sync", updateMobileViewport);
    updateMobileViewport();
    byId("home-message-actions")?.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-message-action]");
      if (button) handleMessageAction(button.dataset.messageAction);
    });
    document.addEventListener("click", (event) => {
      const menu = byId("home-message-actions");
      if (!menu || menu.hidden) return;
      if (!menu.contains(event.target) && !event.target?.closest?.(".home-chat-bubble")) hideMessageActions();
    });
    byId("world-photo-button")?.addEventListener("click", () => byId("world-photo-input")?.click());
    byId("world-photo-input")?.addEventListener("change", chooseWorldPhotos);
    byId("world-post-form")?.addEventListener("submit", addWorldPost);
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
      connectMindTransport();
      window.addEventListener(sync.ROOM_EVENT, () => {
        connectMindTransport();
        data.setMindRoomPresence(isMindBothOnline());
        renderChatStatus();
        renderMind();
      });
      window.addEventListener(sync.CHAT_EVENT, renderHomeChat);
    }
    window.addEventListener("date-invite-cloud-status", () => {
      // 云端脚本在本脚本之后初始化；收到状态后切换实时心有灵犀运输层。
      connectMindTransport();
      data.setMindRoomPresence(isMindBothOnline());
      renderChatStatus();
      renderHomeChat();
      renderMind();
      renderDistanceHeartbeat();
      renderPartnerTimeHint();
    });
    window.addEventListener("date-invite-identity-changed", () => {
      renderChatStatus();
      renderHomeChat();
      renderWorldPosts();
      renderDistanceHeartbeat();
    });
    window.addEventListener("date-invite-distance-changed", () => {
      renderDistanceHeartbeat();
      renderPartnerTimeHint();
    });
    window.addEventListener("date-invite-cloud-sync-applied", () => {
      renderChatStatus(); renderHomeChat(); renderPolaroids(); renderVoicePostcards(); renderWall(); renderWorldPosts(); renderLoveDays(); renderFestivalCalendar(); renderDistanceHeartbeat();
    });
    window.addEventListener("shared-sync-applied", () => {
      renderHomeChat(); renderPolaroids(); renderVoicePostcards(); renderWall(); renderWorldPosts(); renderLoveDays(); renderFestivalCalendar(); renderDistanceHeartbeat(); renderPartnerTimeHint();
    });
    window.addEventListener(data.EVENT_NAME, () => {
      renderPolaroids(); renderVoicePostcards(); renderWall(); renderWorldPosts();
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
    renderLoveDays();
    renderFestivalCalendar();
    renderCityClocks();
    renderDistanceHeartbeat();
    renderPartnerTimeHint();
    loadWeather();
    renderHomeChat();
    renderPolaroids();
    renderVoicePostcards();
    renderWall();
    renderWorldPosts();
    renderMind();
    updateMediaPreview();
    renderWorldPreview();
    switchHomeTab("today");
    window.setInterval(renderCityClocks, 60000);
    window.setInterval(renderDistanceHeartbeat, 60000);
  }

  window.DateInviteHomeChat = {
    sendDatePlanCard,
    render: renderHomeChat,
    renderWorld: renderWorldPosts
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
