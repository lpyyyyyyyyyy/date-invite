const CACHE_NAME = "leo-emily-runtime-v31-click-fix";
const REMINDER_DB = "leo-emily-reminders-v1";
const REMINDER_STORE = "settings";
const OFFLINE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=20260810-final-tabs-v2",
  "./styles.css?v=20260810-final-tabs-v3",
  "./styles.css?v=20260810-home-six-v1",
  "./styles.css?v=20260810-world-v1",
  "./styles.css?v=20260810-lp-pet-menu-v4",
  "./styles.css?v=20260810-lp-pet-menu-v3",
  "./styles.css?v=20260810-lp-pet-menu-v2",
  "./styles.css?v=20260810-lp-pet-menu-v1",
  "./styles.css?v=20260808-lp-pet-v1",
  "./styles.css?v=20260804-identity-mind-voice-v1",
  "./backup.js",
  "./backup.js?v=20260804-identity-mind-voice-v1",
  "./backup.js?v=20260803-cloud-sync-v2",
  "./backup.js?v=20260803-cloud-sync-v3",
  "./app.js",
  "./app.js?v=20260810-final-tabs-v2",
  "./app.js?v=20260810-final-tabs-v3",
  "./app.js?v=20260810-home-six-v1",
  "./app.js?v=20260810-world-v1",
  "./app.js?v=20260810-lp-pet-menu-v4",
  "./app.js?v=20260810-lp-pet-menu-v3",
  "./app.js?v=20260810-lp-pet-menu-v2",
  "./app.js?v=20260810-lp-pet-menu-v1",
  "./app.js?v=20260808-lp-pet-v1",
  "./app.js?v=20260804-identity-mind-voice-v1",
  "./app.js?v=20260803-cloud-sync-v2",
  "./app.js?v=20260803-photo-library-v1",
  "./app.js?v=20260803-photo-library-v2",
  "./shared-sync.js",
  "./shared-sync.js?v=20260810-final-tabs-v2",
  "./shared-sync.js?v=20260810-final-tabs-v3",
  "./shared-sync.js?v=20260810-home-six-v1",
  "./shared-sync.js?v=20260804-identity-mind-voice-v1",
  "./shared-sync.js?v=20260803-cloud-sync-v2",
  "./shared-sync.js?v=20260803-cloud-sync-v3",
  "./shared-interactions.js",
  "./shared-interactions.js?v=20260810-final-tabs-v2",
  "./shared-interactions.js?v=20260810-final-tabs-v3",
  "./shared-interactions.js?v=20260810-home-six-v1",
  "./shared-interactions.js?v=20260810-world-v1",
  "./shared-interactions.js?v=20260804-identity-mind-voice-v1",
  "./shared-interactions.js?v=20260803-cloud-sync-v2",
  "./shared-interactions.js?v=20260803-photo-library-v1",
  "./shared-interactions.js?v=20260803-photo-library-v2",
  "./home-chat.js",
  "./home-chat.js?v=20260810-final-tabs-v2",
  "./home-chat.js?v=20260810-final-tabs-v3",
  "./home-chat.js?v=20260810-home-six-v1",
  "./home-chat.js?v=20260810-world-v1",
  "./home-chat.js?v=20260804-identity-mind-voice-v1",
  "./home-chat.js?v=20260803-cloud-sync-v2",
  "./home-chat.js?v=20260803-cloud-sync-v3",
  "./home-chat.js?v=20260803-original-media-v1",
  "./home-chat.js?v=20260803-original-media-v2",
  "./cloud-config.js",
  "./cloud-config.js?v=20260804-identity-mind-voice-v1",
  "./cloud-config.js?v=20260803-cloud-sync-v2",
  "./cloud-config.js?v=20260803-message-push-v1",
  "./cloud-sync.js",
  "./cloud-sync.js?v=20260810-final-tabs-v2",
  "./cloud-sync.js?v=20260810-final-tabs-v3",
  "./cloud-sync.js?v=20260810-home-six-v1",
  "./cloud-sync.js?v=20260804-identity-mind-voice-v1",
  "./cloud-sync.js?v=20260803-cloud-sync-v2",
  "./cloud-sync.js?v=20260803-cloud-sync-v3",
  "./cloud-sync.js?v=20260803-cloud-sync-v4",
  "./cloud-sync.js?v=20260803-message-push-v1",
  "./cloud-sync.js?v=20260803-message-push-v2",
  "./pwa.js",
  "./pwa.js?v=20260810-final-tabs-v2",
  "./pwa.js?v=20260810-final-tabs-v3",
  "./pwa.js?v=20260810-home-six-v1",
  "./pwa.js?v=20260804-identity-mind-voice-v1",
  "./pwa.js?v=20260803-pwa-update",
  "./pwa.js?v=20260803-message-push-v1",
  "./pwa.js?v=20260803-message-push-v2",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./pet-theme.js",
  "./pet-theme.js?v=20260810-home-six-v1",
  "./pet-theme.js?v=20260810-world-v1",
  "./pet-theme.js?v=20260810-lp-pet-menu-v4",
  "./pet-theme.js?v=20260810-lp-pet-menu-v3",
  "./pet-theme.js?v=20260810-lp-pet-menu-v2",
  "./pet-theme.js?v=20260810-lp-pet-menu-v1",
  "./pet-theme.js?v=20260808-lp-pet-v1",
  "./pet-assets/blink-01.png",
  "./pet-assets/blink-02.png",
  "./pet-assets/blink-03.png",
  "./pet-assets/blink-04.png",
  "./pet-assets/blink-05.png",
  "./pet-assets/chat-01.png",
  "./pet-assets/chat-02.png",
  "./pet-assets/chat-03.png",
  "./pet-assets/chat-04.png",
  "./pet-assets/chat-05.png",
  "./pet-assets/eat-01.png",
  "./pet-assets/eat-02.png",
  "./pet-assets/eat-03.png",
  "./pet-assets/eat-04.png",
  "./pet-assets/eat-05.png",
  "./pet-assets/happy-01.png",
  "./pet-assets/happy-02.png",
  "./pet-assets/happy-03.png",
  "./pet-assets/happy-04.png",
  "./pet-assets/happy-05.png",
  "./pet-assets/idle-01.png",
  "./pet-assets/idle-02.png",
  "./pet-assets/idle-03.png",
  "./pet-assets/idle-04.png",
  "./pet-assets/notify-01.png",
  "./pet-assets/notify-02.png",
  "./pet-assets/notify-03.png",
  "./pet-assets/notify-04.png",
  "./pet-assets/notify-05.png",
  "./pet-assets/peek-01.png",
  "./pet-assets/peek-02.png",
  "./pet-assets/peek-03.png",
  "./pet-assets/peek-04.png",
  "./pet-assets/peek-05.png",
  "./pet-assets/pet-01.png",
  "./pet-assets/pet-02.png",
  "./pet-assets/pet-03.png",
  "./pet-assets/pet-04.png",
  "./pet-assets/pet-05.png",
  "./pet-assets/sleep-01.png",
  "./pet-assets/sleep-02.png",
  "./pet-assets/sleep-03.png",
  "./pet-assets/sleep-04.png",
  "./pet-assets/sleep-05.png",
  "./pet-assets/walk-left-01.png",
  "./pet-assets/walk-left-02.png",
  "./pet-assets/walk-left-03.png",
  "./pet-assets/walk-left-04.png",
  "./pet-assets/walk-left-05.png",
  "./pet-assets/walk-left-06.png",
  "./pet-assets/walk-right-01.png",
  "./pet-assets/walk-right-02.png",
  "./pet-assets/walk-right-03.png",
  "./pet-assets/walk-right-04.png",
  "./pet-assets/walk-right-05.png",
  "./pet-assets/walk-right-06.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request, { cache: "no-store" })
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match("./");
      })
  );
});

function openReminderDatabase() {
  return new Promise((resolve) => {
    let request;
    try { request = indexedDB.open(REMINDER_DB, 1); } catch (error) { resolve(null); return; }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(REMINDER_STORE)) database.createObjectStore(REMINDER_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = request.onblocked = () => resolve(null);
  });
}

async function reminderGet(key) {
  const database = await openReminderDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const request = database.transaction(REMINDER_STORE, "readonly").objectStore(REMINDER_STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    } catch (error) { resolve(null); }
  });
}

async function reminderSet(key, value) {
  const database = await openReminderDatabase();
  if (!database) return false;
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(REMINDER_STORE, "readwrite");
      transaction.objectStore(REMINDER_STORE).put(value, key);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = transaction.onabort = () => resolve(false);
    } catch (error) { resolve(false); }
  });
}

function localDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function reminderBody(plan) {
  if (!plan?.date || !plan?.time) return "还没有下一次约会计划，打开小程序一起定个时间吧。";
  const target = new Date(`${plan.date}T${plan.time}:00`).getTime();
  const minutes = Math.max(0, Math.floor((target - Date.now()) / 60000));
  const remaining = target > Date.now()
    ? `距离约会还有 ${Math.floor(minutes / 1440)} 天 ${Math.floor((minutes % 1440) / 60)} 小时 ${minutes % 60} 分钟`
    : "今天也值得留下一段回忆";
  return `${remaining}。${plan.date} ${plan.time}${plan.activity ? `，${plan.activity}` : ""}${plan.location ? ` · ${plan.location}` : ""}`;
}

async function deliverDailyReminder() {
  const config = await reminderGet("config");
  if (!config?.enabled || !config.plan || !self.registration?.showNotification) return false;
  // 没有这个时间标记的旧配置先不投递，等页面重新同步配置，避免升级后立即误发。
  if (!Number(config.notBefore) || Number(config.notBefore) > Date.now()) return false;
  const day = localDay();
  const delivery = await reminderGet("delivery");
  if (delivery?.lastDay === day) return false;
  await self.registration.showNotification("今日约会计划提醒 ♥", {
    body: reminderBody(config.plan),
    tag: `date-plan-${day}`,
    renotify: false,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    data: { url: "./" }
  });
  await reminderSet("delivery", { lastDay: day, deliveredAt: Date.now() });
  return true;
}

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "date-plan-reminder-config") return;
  event.waitUntil(reminderSet("config", {
    enabled: Boolean(message.enabled),
    plan: message.plan && typeof message.plan === "object" ? message.plan : null,
    notBefore: Number(message.notBefore) || 0,
    updatedAt: Number(message.updatedAt) || Date.now()
  }));
});

// Browsers may run these later than midnight (or not at all); the page keeps a precise foreground fallback.
self.addEventListener("sync", (event) => {
  if (event.tag === "date-plan-reminder") event.waitUntil(deliverDailyReminder());
});
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "date-plan-reminder") event.waitUntil(deliverDailyReminder());
});

function cleanNotificationText(value, fallback, limit) {
  const text = String(value || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, limit);
  return text || fallback;
}

function sameOriginNotificationUrl(value) {
  try {
    const url = new URL(String(value || "./"), self.location.origin);
    return url.origin === self.location.origin ? url.href : "./";
  } catch (error) {
    return "./";
  }
}

function readPushPayload(event) {
  let value = null;
  try { value = event.data?.json?.(); } catch (error) {
    try { value = JSON.parse(event.data?.text?.() || "{}"); } catch (parseError) { value = null; }
  }
  const data = value && typeof value === "object" ? value : {};
  return {
    title: cleanNotificationText(data.title, "Leo And Emily", 50),
    body: cleanNotificationText(data.body, "你收到一条新的消息", 180),
    tag: cleanNotificationText(data.tag, `leo-message-${Date.now()}`, 120),
    url: sameOriginNotificationUrl(data.url),
    sentAt: Number(data.sentAt) || Date.now()
  };
}

// 这条事件由 CloudBase 云函数转发；即使网页没有打开，系统仍会把通知交给已安装的小程序。
self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    renotify: true,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    data: { url: payload.url, sentAt: payload.sentAt }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    return existing ? existing.focus() : clients.openWindow(event.notification.data?.url || "./");
  }));
});
