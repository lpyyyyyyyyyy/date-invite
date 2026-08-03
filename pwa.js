(() => {
  "use strict";

  if (!("serviceWorker" in navigator)) return;

  let isRefreshing = false;
  let pushRegistration = null;
  let pushSyncing = false;

  const pushButton = () => document.querySelector("#message-push-button");
  const pushStatus = () => document.querySelector("#message-push-status");

  function setPushStatus(message, state) {
    const status = pushStatus();
    if (status) {
      status.textContent = message;
      status.dataset.state = state || "";
    }
    const button = pushButton();
    if (!button || !("Notification" in window)) return;
    const permission = Notification.permission;
    button.disabled = permission === "denied";
    button.textContent = permission === "granted" ? "消息通知已开启" : permission === "denied" ? "请到系统设置开启" : "开启消息通知";
  }

  function supportsPartnerPush() {
    return "Notification" in window && "PushManager" in window && Boolean(window.LEO_EMILY_CLOUD_CONFIG?.vapidPublicKey);
  }

  function urlBase64ToUint8Array(value) {
    const base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  async function getPushRegistration() {
    if (pushRegistration) return pushRegistration;
    pushRegistration = await navigator.serviceWorker.ready;
    return pushRegistration;
  }

  async function syncPushSubscription() {
    if (pushSyncing || !supportsPartnerPush() || Notification.permission !== "granted") return false;
    const cloud = window.DateInviteCloud;
    if (!cloud?.registerPushSubscription) {
      setPushStatus("系统通知已允许，正在连接你们的共同空间…", "waiting");
      return false;
    }
    pushSyncing = true;
    try {
      const registration = await getPushRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(window.LEO_EMILY_CLOUD_CONFIG.vapidPublicKey)
        });
      }
      const data = typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription;
      const result = await cloud.registerPushSubscription(data);
      if (!result?.ok) throw new Error(result?.error || "设备登记尚未完成");
      setPushStatus("消息通知已开启：她不在线时，也会收到你的新消息。", "ready");
      return true;
    } catch (error) {
      setPushStatus("通知权限已允许，设备会在下次连接云端时自动登记。", "waiting");
      return false;
    } finally {
      pushSyncing = false;
    }
  }

  async function enablePartnerPush() {
    if (!supportsPartnerPush()) {
      setPushStatus("这台设备暂不支持后台消息通知；Safari 请先“添加到主屏幕”。", "unsupported");
      return;
    }
    let permission = Notification.permission;
    if (permission === "default") {
      try { permission = await Notification.requestPermission(); } catch (error) { permission = Notification.permission; }
    }
    if (permission !== "granted") {
      setPushStatus(permission === "denied" ? "通知已被关闭，请到系统设置中允许 Leo And Emily 通知。" : "需要允许系统通知，才能在后台收到消息。", "denied");
      return;
    }
    setPushStatus("正在把这台手机加入消息通知…", "loading");
    await syncPushSubscription();
  }

  function bindPartnerPushControls() {
    const button = pushButton();
    if (button && !button.dataset.bound) {
      button.dataset.bound = "true";
      button.addEventListener("click", enablePartnerPush);
    }
    if (!supportsPartnerPush()) {
      setPushStatus("Safari 请先把网站添加到主屏幕，才可以在后台收到消息通知。", "unsupported");
      return;
    }
    if (Notification.permission === "granted") syncPushSubscription();
    else setPushStatus("开启后，对方即使没打开网站，也能收到你的消息提醒。", "idle");
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isRefreshing) return;
    isRefreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
      await registration.update();
    } catch (error) {
      console.warn("PWA update check failed", error);
    }
    bindPartnerPushControls();
  });

  window.addEventListener("date-invite-cloud-status", () => {
    if (Notification.permission === "granted") syncPushSubscription();
  });

  window.DateInvitePush = Object.freeze({ enable: enablePartnerPush, sync: syncPushSubscription });
})();
