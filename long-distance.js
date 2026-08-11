(() => {
  "use strict";

  const STORAGE_KEY = "cute-date-invite-distance-signals-v1";
  const DIALOG_ID = "distance-dialog";
  const STATUS_OPTIONS = {
    miss: { label: "想你了", detail: "想让你知道，我正在惦记你" },
    available: { label: "现在有空", detail: "可以说说话，也可以安静陪着" },
    busy: { label: "正在忙", detail: "晚一点回来，不是没有想你" },
    rest: { label: "准备休息", detail: "今天也想和你好好说晚安" }
  };

  let dialog = null;
  let lastFocusedElement = null;
  let closeTimer = null;
  let statusTimer = null;
  let hugTimer = null;
  let sendingHug = false;
  let draftDirty = false;

  function parseJSON(raw, fallback) {
    try { return JSON.parse(raw); } catch (error) { return fallback; }
  }

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function normalizeSignal(value) {
    if (!value || typeof value !== "object") return null;
    const role = value.role === "guest" ? "guest" : value.role === "host" ? "host" : "";
    if (!role || value.id !== `distance-signal-${role}` || !STATUS_OPTIONS[value.status]) return null;
    const updatedAt = Number(value.updatedAt);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
    return {
      id: `distance-signal-${role}`,
      role,
      status: value.status,
      note: String(value.note || "").trim().slice(0, 80),
      createdAt: Number(value.createdAt) || updatedAt,
      updatedAt
    };
  }

  function readSignals() {
    const parsed = parseJSON(safeGet(STORAGE_KEY) || "[]", []);
    if (!Array.isArray(parsed)) return [];
    const byRole = new Map();
    parsed.forEach((value) => {
      const signal = normalizeSignal(value);
      if (!signal) return;
      const previous = byRole.get(signal.role);
      if (!previous || signal.updatedAt >= previous.updatedAt) byRole.set(signal.role, signal);
    });
    return [byRole.get("host"), byRole.get("guest")].filter(Boolean);
  }

  function cloudAPI() {
    return window.DateInviteCloud || window.DateInviteCloudSync || null;
  }

  function sharedAPI() {
    return window.DateInviteShared || null;
  }

  function currentRole() {
    const cloudRole = cloudAPI()?.getRole?.();
    if (cloudRole === "guest" || cloudRole === "host") return cloudRole;
    return sharedAPI()?.getRoom?.()?.role === "guest" ? "guest" : "host";
  }

  function displayName(role) {
    const cloud = cloudAPI();
    const identity = cloud?.getIdentity?.();
    const profileName = identity?.profiles?.[role]?.name;
    const myName = identity?.me?.role === role ? identity.me.name : "";
    return String(myName || profileName || cloud?.getDisplayName?.(role) || (role === currentRole() ? "我" : "对方")).trim().slice(0, 24);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return value; }
  }

  function timeLabel(timestamp) {
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return "还没有更新";
    const difference = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(difference / 60000);
    if (minutes < 1) return "刚刚更新";
    if (minutes < 60) return `${minutes} 分钟前更新`;
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return `今天 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 更新`;
    }
    return `${date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 更新`;
  }

  function signalCard(role, signal) {
    const mine = role === currentRole();
    const name = displayName(role);
    const firstCharacter = [...(name || (mine ? "我" : "你"))][0] || "♡";
    const status = signal ? STATUS_OPTIONS[signal.status] : null;
    const note = signal?.note || (mine ? "留下这一刻的状态，让她安心。" : "对方还没有留下这一刻的状态。 ");
    return `<article class="ld-person ${mine ? "is-mine" : "is-partner"}" aria-label="${escapeHTML(name)}的异地状态">
      <div class="ld-avatar" aria-hidden="true">${escapeHTML(firstCharacter)}</div>
      <div class="ld-person-copy">
        <div class="ld-person-title">
          <strong>${escapeHTML(name)}</strong>
          <span>${mine ? "我" : "TA"}</span>
        </div>
        <p class="ld-person-status" data-state="${signal?.status || "empty"}">${status ? escapeHTML(status.label) : "等待更新"}</p>
        <p class="ld-person-note">${escapeHTML(note)}</p>
        ${signal
          ? `<time datetime="${new Date(signal.updatedAt).toISOString()}">${escapeHTML(timeLabel(signal.updatedAt))}</time>`
          : `<span class="ld-no-time">还没有更新时间</span>`}
      </div>
    </article>`;
  }

  function createDialog() {
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = DIALOG_ID;
    dialog.className = "ld-dialog";
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "ld-title");
    dialog.setAttribute("aria-describedby", "ld-description");
    dialog.innerHTML = `
      <div class="ld-page">
        <header class="ld-header">
          <button class="ld-icon-button" type="button" data-ld-close aria-label="返回上一页">←</button>
          <div>
            <p>LONG-DISTANCE SIGNAL</p>
            <h1 id="ld-title">异地同频</h1>
          </div>
          <span class="ld-header-mark" aria-hidden="true">♡</span>
        </header>
        <p class="ld-live-status" id="ld-live-status" role="status" aria-live="polite" hidden></p>
        <main class="ld-main">
          <section class="ld-intro" aria-labelledby="ld-intro-title">
            <p class="ld-eyebrow">不在同一座城市，也可以靠近一点</p>
            <h2 id="ld-intro-title">让她知道，此刻你正在想她</h2>
            <p id="ld-description">不用一直在线，也不用解释很多。一句轻轻的状态，会在她打开这里时好好抵达。</p>
          </section>

          <section class="ld-pair" aria-label="双方当前状态">
            <div class="ld-pair-heading">
              <div><span aria-hidden="true"></span><p>我们此刻的距离</p><span aria-hidden="true"></span></div>
              <small>每个人的状态固定显示，不会互换</small>
            </div>
            <div class="ld-pair-list" id="ld-pair-list"></div>
          </section>

          <section class="ld-compose" aria-labelledby="ld-compose-title">
            <div class="ld-section-heading">
              <p>UPDATE MY SIGNAL</p>
              <h2 id="ld-compose-title">把这一刻留给她</h2>
            </div>
            <form id="ld-signal-form" novalidate>
              <fieldset class="ld-status-options">
                <legend>选择我现在的状态</legend>
                ${Object.entries(STATUS_OPTIONS).map(([value, option]) => `
                  <label data-status="${value}">
                    <input type="radio" name="distance-status" value="${value}" required>
                    <span><b>${option.label}</b><small>${option.detail}</small></span>
                  </label>`).join("")}
              </fieldset>
              <label class="ld-note-label" for="ld-note">再留一句话 <span id="ld-note-count">0 / 80</span></label>
              <div class="ld-note-presets" aria-label="一句话快捷选择">
                <button type="button" data-ld-note="忙完就来找你">忙完就来找你</button>
                <button type="button" data-ld-note="今天也很想你">今天也很想你</button>
                <button type="button" data-ld-note="想听听你的声音">想听听你的声音</button>
                <button type="button" data-ld-note="晚安，梦里见">晚安，梦里见</button>
              </div>
              <textarea id="ld-note" name="distance-note" maxlength="80" rows="3" placeholder="比如：忙完就来找你，今天也很想你。"></textarea>
              <p class="ld-field-error" id="ld-form-error" role="alert" hidden></p>
              <button class="ld-save-button" type="submit">保存我的状态</button>
            </form>
          </section>

          <section class="ld-hug" aria-labelledby="ld-hug-title">
            <div>
              <p>一个不打扰的小动作</p>
              <h2 id="ld-hug-title">给她一个隔空抱抱</h2>
              <span>会真实发送到你们的聊天里，对方不在线也能在下次打开时看见。</span>
            </div>
            <button class="ld-hug-button" id="ld-hug-button" type="button">
              <span aria-hidden="true">♡</span>
              <b>隔空抱抱</b>
            </button>
            <div class="ld-hug-animation" id="ld-hug-animation" aria-hidden="true">
              <i>♡</i><i>♡</i><i>♡</i><span>抱抱已出发</span>
            </div>
          </section>

          <p class="ld-footnote">状态会先保存在本机，再同步到你们的共同空间。只保留双方各自最新的一条，不会变成新的聊天负担。</p>
        </main>
      </div>`;
    document.body.appendChild(dialog);
    bindDialogEvents();
    return dialog;
  }

  function isOpen() {
    return Boolean(dialog && (dialog.open || dialog.hasAttribute("open")));
  }

  function setLiveStatus(message, kind = "success", autoHide = true) {
    if (!dialog) return;
    const node = dialog.querySelector("#ld-live-status");
    window.clearTimeout(statusTimer);
    node.textContent = String(message || "");
    node.dataset.kind = kind;
    node.hidden = !message;
    if (message && autoHide) statusTimer = window.setTimeout(() => { node.hidden = true; }, 4400);
  }

  function renderPair() {
    if (!dialog) return;
    const signals = readSignals();
    const byRole = new Map(signals.map((signal) => [signal.role, signal]));
    dialog.querySelector("#ld-pair-list").innerHTML = ["host", "guest"]
      .map((role) => signalCard(role, byRole.get(role)))
      .join("");
  }

  function fillDraftFromSaved() {
    const signal = readSignals().find((item) => item.role === currentRole());
    const selectedStatus = signal?.status || "miss";
    dialog.querySelectorAll("input[name='distance-status']").forEach((input) => {
      input.checked = input.value === selectedStatus;
    });
    const note = dialog.querySelector("#ld-note");
    note.value = signal?.note || "";
    dialog.querySelector("#ld-note-count").textContent = `${[...note.value].length} / 80`;
  }

  function render(options = {}) {
    createDialog();
    renderPair();
    if (options.resetDraft || !draftDirty) fillDraftFromSaved();
  }

  function queueSync() {
    let queued = false;
    try { queued = cloudAPI()?.queueKey?.(STORAGE_KEY) === true; } catch (error) { queued = false; }
    if (!queued) {
      try { sharedAPI()?.syncNow?.(); } catch (error) { /* It remains safely stored locally. */ }
    }
    notifySignalChanged();
    return queued;
  }

  function notifySignalChanged() {
    window.dispatchEvent(new CustomEvent("date-invite-distance-changed", { detail: { key: STORAGE_KEY } }));
  }

  function saveSignal(event) {
    event.preventDefault();
    const checked = dialog.querySelector("input[name='distance-status']:checked");
    const noteInput = dialog.querySelector("#ld-note");
    const error = dialog.querySelector("#ld-form-error");
    error.hidden = true;
    error.textContent = "";
    if (!checked || !STATUS_OPTIONS[checked.value]) {
      error.textContent = "先选择一个最接近你现在的状态。";
      error.hidden = false;
      dialog.querySelector("input[name='distance-status']")?.focus();
      return;
    }
    const role = currentRole();
    const signals = readSignals();
    const previous = signals.find((signal) => signal.role === role);
    const timestamp = Date.now();
    const next = {
      id: `distance-signal-${role}`,
      role,
      status: checked.value,
      note: String(noteInput.value || "").trim().slice(0, 80),
      createdAt: Number(previous?.createdAt) || timestamp,
      updatedAt: timestamp
    };
    const rows = signals.filter((signal) => signal.role !== role);
    rows.push(next);
    rows.sort((left, right) => left.role.localeCompare(right.role));
    try { window.DateInviteBackups?.capture?.("更新异国状态前"); } catch (error) { /* 备份失败不阻塞状态保存。 */ }
    if (!safeSet(STORAGE_KEY, JSON.stringify(rows))) {
      setLiveStatus("本机存储空间暂时不可用，这次状态没有保存。", "error", false);
      return;
    }
    const queued = queueSync();
    draftDirty = false;
    render({ resetDraft: true });
    setLiveStatus(queued ? "这一刻已经保存，正在同步到你们的共同空间。" : "这一刻已保存在本机，连接恢复后会继续同步。", "success");
  }

  async function sendHug() {
    if (sendingHug) return;
    const button = dialog.querySelector("#ld-hug-button");
    const animation = dialog.querySelector("#ld-hug-animation");
    const text = "给你一个跨越时区的抱抱 🤍";
    sendingHug = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    setLiveStatus("正在把抱抱放进你们的聊天…", "waiting", false);

    let result = null;
    try {
      const cloud = cloudAPI();
      if (typeof cloud?.sendMessage === "function") result = await Promise.resolve(cloud.sendMessage({ text }));
      if (result?.ok !== true && typeof sharedAPI()?.sendMessage === "function") {
        result = await Promise.resolve(sharedAPI().sendMessage({ text }));
      }
    } catch (error) {
      result = { ok: false, error: error?.message };
    }

    if (result?.ok === true) {
      animation.classList.remove("is-playing");
      void animation.offsetWidth;
      animation.classList.add("is-playing");
      button.classList.add("is-sent");
      setLiveStatus(result.delivered === false
        ? "抱抱已经放进聊天，对方下次打开时就会看见。"
        : "抱抱已经发出去了。", "success");
      window.clearTimeout(hugTimer);
      hugTimer = window.setTimeout(() => {
        animation.classList.remove("is-playing");
        button.classList.remove("is-sent");
      }, 1800);
    } else {
      const reason = String(result?.error || "聊天连接暂时不可用，请稍后再试。").replace(/[\r\n]+/g, " ").slice(0, 120);
      setLiveStatus(`抱抱还没有发出去：${reason}`, "error", false);
    }

    sendingHug = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }

  function openDialog(trigger) {
    createDialog();
    window.clearTimeout(closeTimer);
    if (isOpen()) {
      dialog.classList.add("is-open");
      dialog.querySelector("[data-ld-close]")?.focus({ preventScroll: true });
      return;
    }
    draftDirty = false;
    render({ resetDraft: true });
    lastFocusedElement = trigger instanceof HTMLElement ? trigger : document.activeElement;
    try {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } catch (error) {
      dialog.setAttribute("open", "");
    }
    document.body.classList.add("ld-scroll-lock");
    window.requestAnimationFrame(() => {
      dialog.classList.add("is-open");
      dialog.querySelector("[data-ld-close]")?.focus({ preventScroll: true });
    });
  }

  function closeDialog() {
    if (!isOpen()) return;
    window.clearTimeout(closeTimer);
    dialog.classList.remove("is-open");
    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimer = window.setTimeout(() => {
      try {
        if (typeof dialog.close === "function" && dialog.open) dialog.close();
        else dialog.removeAttribute("open");
      } catch (error) {
        dialog.removeAttribute("open");
      }
      document.body.classList.remove("ld-scroll-lock");
      if (lastFocusedElement instanceof HTMLElement && document.contains(lastFocusedElement)) lastFocusedElement.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 220);
  }

  function keepFallbackFocusInside(event) {
    if (event.key !== "Tab" || typeof dialog.showModal === "function") return;
    const focusable = [...dialog.querySelectorAll("button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")]
      .filter((element) => !element.hidden && element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function bindDialogEvents() {
    dialog.querySelector("#ld-signal-form").addEventListener("submit", saveSignal);
    dialog.querySelector("#ld-hug-button").addEventListener("click", sendHug);
    dialog.querySelector("#ld-note").addEventListener("input", (event) => {
      draftDirty = true;
      const value = [...String(event.target.value || "")].slice(0, 80).join("");
      if (value !== event.target.value) event.target.value = value;
      dialog.querySelector("#ld-note-count").textContent = `${[...value].length} / 80`;
    });
    dialog.querySelectorAll("input[name='distance-status']").forEach((input) => {
      input.addEventListener("change", () => { draftDirty = true; });
    });
    dialog.querySelectorAll("[data-ld-note]").forEach((button) => {
      button.addEventListener("click", () => {
        const note = dialog.querySelector("#ld-note");
        const value = String(button.dataset.ldNote || "").slice(0, 80);
        note.value = value;
        dialog.querySelector("#ld-note-count").textContent = `${[...value].length} / 80`;
        draftDirty = true;
        note.focus({ preventScroll: true });
      });
    });
    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-ld-close]")) closeDialog();
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog();
    });
    dialog.addEventListener("close", () => {
      window.clearTimeout(closeTimer);
      dialog.classList.remove("is-open");
      document.body.classList.remove("ld-scroll-lock");
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
      } else keepFallbackFocusInside(event);
    });
  }

  function enhanceOpeners(root = document) {
    const openers = [];
    if (root.matches?.(".distance-open")) openers.push(root);
    root.querySelectorAll?.(".distance-open").forEach((opener) => openers.push(opener));
    openers.forEach((opener) => {
      if (!/^(BUTTON|A|INPUT)$/.test(opener.tagName)) {
        opener.setAttribute("role", "button");
        if (!opener.hasAttribute("tabindex")) opener.tabIndex = 0;
      }
      opener.setAttribute("aria-haspopup", "dialog");
      opener.setAttribute("aria-controls", DIALOG_ID);
    });
  }

  function initialize() {
    createDialog();
    enhanceOpeners();
    document.addEventListener("click", (event) => {
      const opener = event.target.closest?.(".distance-open");
      if (!opener) return;
      event.preventDefault();
      openDialog(opener);
    });
    document.addEventListener("keydown", (event) => {
      const opener = event.target.closest?.(".distance-open");
      if (!opener || /^(BUTTON|A|INPUT)$/.test(opener.tagName)) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDialog(opener);
      }
    });
    if (typeof MutationObserver === "function") {
      new MutationObserver((mutations) => {
        mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) enhanceOpeners(node);
        }));
      }).observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      if (isOpen()) renderPair();
      notifySignalChanged();
    });
    ["date-invite-cloud-sync-applied", "shared-sync-applied"].forEach((eventName) => {
      window.addEventListener(eventName, () => {
        if (isOpen()) renderPair();
        notifySignalChanged();
      });
    });
    window.addEventListener("date-invite-identity-changed", () => {
      if (!isOpen()) return;
      draftDirty = false;
      render({ resetDraft: true });
    });
  }

  window.DateInviteDistance = {
    STORAGE_KEY,
    open: () => openDialog(document.activeElement),
    close: closeDialog,
    render: () => render(),
    getPartnerSignal: () => clone(readSignals().find((signal) => signal.role !== currentRole()) || null)
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
