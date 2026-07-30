(() => {
  "use strict";

  const STORAGE_KEY = "cute-date-invite-v1";
  const noLabels = ["不要", "再想想嘛", "点不到我", "真的不要吗"];
  const corners = ["top-left", "top-right", "bottom-right", "bottom-left"];
  const oppositeCorner = {
    "top-left": "bottom-right",
    "top-right": "bottom-left",
    "bottom-right": "top-left",
    "bottom-left": "top-right"
  };

  const screens = [...document.querySelectorAll("[data-screen]")];
  const progressDots = [...document.querySelectorAll("[data-progress]")];
  const actionZone = document.querySelector("#invitation-actions");
  const yesButton = document.querySelector("#yes-button");
  const noButton = document.querySelector("#no-button");
  const movementStatus = document.querySelector("#movement-status");
  const dateForm = document.querySelector("#date-form");
  const dateInput = document.querySelector("#date-input");
  const timeInput = document.querySelector("#time-input");
  const dateError = document.querySelector("#date-error");
  const activityOptions = [...document.querySelectorAll(".activity-option")];
  const foodOptions = [...document.querySelectorAll("#food-grid .food-option")];
  const cardCanvas = document.querySelector("#date-card");
  const saveButton = document.querySelector("#save-button");
  const toast = document.querySelector("#toast");

  let toastTimer = null;
  let menuTransitionTimer = null;
  let resizeFrame = null;
  let currentScreen = 1;
  let state = loadState();

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getToday() {
    return localDateString(new Date());
  }

  function getTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return localDateString(tomorrow);
  }

  function initialState() {
    return {
      date: getTomorrow(),
      time: "17:00",
      activity: "",
      menu: "",
      dodgeCount: 0,
      currentCorner: ""
    };
  }

  function loadState() {
    const fallback = initialState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return fallback;
      const safeDate = typeof saved.date === "string" && saved.date >= getToday() ? saved.date : fallback.date;
      const safeTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(saved.time || "") ? saved.time : fallback.time;
      return {
        date: safeDate,
        time: safeTime,
        activity: typeof saved.activity === "string" ? saved.activity : "",
        menu: typeof saved.menu === "string" ? saved.menu : "",
        dodgeCount: Number.isInteger(saved.dodgeCount) && saved.dodgeCount >= 0 ? saved.dodgeCount : 0,
        currentCorner: corners.includes(saved.currentCorner) ? saved.currentCorner : ""
      };
    } catch (error) {
      return fallback;
    }
  }

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // The experience remains fully usable when private browsing blocks storage.
    }
  }

  function initialize() {
    dateInput.min = getToday();
    dateInput.value = state.date;
    timeInput.value = state.time;
    syncActivitySelection();
    syncFoodSelection();

    if (state.dodgeCount > 0) {
      noButton.textContent = noLabels[state.dodgeCount % noLabels.length];
      requestAnimationFrame(() => activateDodgeLayout(false));
    }

    yesButton.addEventListener("click", () => showScreen(2));
    noButton.addEventListener("click", handleNoClick);
    dateForm.addEventListener("submit", handleDateSubmit);
    dateInput.addEventListener("input", clearDateError);
    timeInput.addEventListener("input", clearDateError);
    saveButton.addEventListener("click", saveOrShareCard);

    document.querySelectorAll("[data-next]").forEach((button) => {
      button.addEventListener("click", () => showScreen(Number(button.dataset.next)));
    });
    document.querySelectorAll("[data-back]").forEach((button) => {
      button.addEventListener("click", () => showScreen(Number(button.dataset.back)));
    });
    activityOptions.forEach((button) => button.addEventListener("click", handleActivitySelect));
    foodOptions.forEach((button) => button.addEventListener("click", handleFoodSelect));

    window.addEventListener("resize", scheduleDodgeRecalculation, { passive: true });
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(scheduleDodgeRecalculation);
      observer.observe(actionZone);
    }
  }

  function showScreen(screenNumber) {
    if (menuTransitionTimer) {
      clearTimeout(menuTransitionTimer);
      menuTransitionTimer = null;
    }

    currentScreen = screenNumber;
    screens.forEach((screen) => {
      const isActive = Number(screen.dataset.screen) === screenNumber;
      screen.hidden = !isActive;
      screen.classList.toggle("is-active", isActive);
      screen.setAttribute("aria-hidden", String(!isActive));
    });
    progressDots.forEach((dot) => {
      dot.classList.toggle("is-current", Number(dot.dataset.progress) === screenNumber);
    });

    if (screenNumber === 1 && state.dodgeCount > 0) {
      requestAnimationFrame(() => positionDodgeButtons(false));
    }
    if (screenNumber === 3) {
      dateInput.min = getToday();
      dateInput.value = state.date;
      timeInput.value = state.time;
    }
    if (screenNumber === 4) syncActivitySelection();
    if (screenNumber === 5) syncFoodSelection();
    if (screenNumber === 6) updateResult();

    window.scrollTo({ top: 0, behavior: "auto" });
    const heading = document.querySelector(`[data-screen="${screenNumber}"] h1`);
    requestAnimationFrame(() => heading?.focus({ preventScroll: true }));
  }

  function handleNoClick() {
    if (state.dodgeCount === 0) {
      activateDodgeLayout(true);
    } else {
      state.currentCorner = chooseNextCorner(state.currentCorner);
      state.dodgeCount += 1;
      noButton.textContent = noLabels[state.dodgeCount % noLabels.length];
      positionDodgeButtons(true);
      announceNoMovement();
      persistState();
    }
  }

  function activateDodgeLayout(animate) {
    if (actionZone.classList.contains("is-active")) {
      positionDodgeButtons(animate);
      return;
    }

    const zoneRect = actionZone.getBoundingClientRect();
    const yesRect = yesButton.getBoundingClientRect();
    const noRect = noButton.getBoundingClientRect();

    actionZone.classList.add("is-priming", "is-active");
    setPixelPosition(yesButton, yesRect.left - zoneRect.left, yesRect.top - zoneRect.top);
    setPixelPosition(noButton, noRect.left - zoneRect.left, noRect.top - zoneRect.top);
    void actionZone.offsetWidth;

    const closestCorner = findClosestCorner(noRect, zoneRect);
    state.currentCorner = chooseNextCorner(closestCorner);
    state.dodgeCount = Math.max(1, state.dodgeCount);
    noButton.textContent = noLabels[state.dodgeCount % noLabels.length];

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        actionZone.classList.remove("is-priming");
        positionDodgeButtons(animate);
        if (animate) announceNoMovement();
        persistState();
      });
    });
  }

  function setPixelPosition(button, left, top) {
    button.style.left = `${Math.round(left)}px`;
    button.style.top = `${Math.round(top)}px`;
    button.style.transform = "none";
  }

  function chooseNextCorner(fromCorner) {
    const preferred = oppositeCorner[fromCorner];
    if (preferred && preferred !== fromCorner) return preferred;
    const index = corners.indexOf(fromCorner);
    return corners[(index + 1 + corners.length) % corners.length];
  }

  function findClosestCorner(buttonRect, zoneRect) {
    const centerX = buttonRect.left - zoneRect.left + buttonRect.width / 2;
    const centerY = buttonRect.top - zoneRect.top + buttonRect.height / 2;
    const positions = getCornerPositions(buttonRect.width, buttonRect.height, zoneRect.width, zoneRect.height);
    return corners.reduce((closest, name) => {
      const position = positions[name];
      const dx = position.left + buttonRect.width / 2 - centerX;
      const dy = position.top + buttonRect.height / 2 - centerY;
      const distance = Math.hypot(dx, dy);
      return !closest || distance < closest.distance ? { name, distance } : closest;
    }, null).name;
  }

  function getCornerPositions(buttonWidth, buttonHeight, zoneWidth, zoneHeight) {
    const padding = 10;
    const maxLeft = Math.max(padding, zoneWidth - buttonWidth - padding);
    const maxTop = Math.max(padding, zoneHeight - buttonHeight - padding);
    return {
      "top-left": { left: padding, top: padding },
      "top-right": { left: maxLeft, top: padding },
      "bottom-right": { left: maxLeft, top: maxTop },
      "bottom-left": { left: padding, top: maxTop }
    };
  }

  function positionDodgeButtons(animate) {
    if (!actionZone.classList.contains("is-active") || actionZone.clientWidth === 0) return;

    actionZone.classList.toggle("is-priming", !animate);
    yesButton.style.left = "50%";
    yesButton.style.top = "50%";
    yesButton.style.transform = "translate(-50%, -50%)";

    const positions = getCornerPositions(
      noButton.offsetWidth,
      noButton.offsetHeight,
      actionZone.clientWidth,
      actionZone.clientHeight
    );
    const chosen = findNonOverlappingCorner(state.currentCorner, positions);
    state.currentCorner = chosen;
    setPixelPosition(noButton, positions[chosen].left, positions[chosen].top);

    if (!animate) {
      requestAnimationFrame(() => actionZone.classList.remove("is-priming"));
    }
  }

  function findNonOverlappingCorner(preferred, positions) {
    const yesWidth = yesButton.offsetWidth;
    const yesHeight = yesButton.offsetHeight;
    const yesBox = {
      left: actionZone.clientWidth / 2 - yesWidth / 2,
      top: actionZone.clientHeight / 2 - yesHeight / 2,
      right: actionZone.clientWidth / 2 + yesWidth / 2,
      bottom: actionZone.clientHeight / 2 + yesHeight / 2
    };
    const order = [preferred, oppositeCorner[preferred], ...corners].filter((value, index, array) => value && array.indexOf(value) === index);
    return order.find((name) => {
      const pos = positions[name];
      const gap = 6;
      const noBox = {
        left: pos.left,
        top: pos.top,
        right: pos.left + noButton.offsetWidth,
        bottom: pos.top + noButton.offsetHeight
      };
      return noBox.right + gap <= yesBox.left || noBox.left - gap >= yesBox.right || noBox.bottom + gap <= yesBox.top || noBox.top - gap >= yesBox.bottom;
    }) || preferred || "top-left";
  }

  function announceNoMovement() {
    const cornerNames = {
      "top-left": "左上角",
      "top-right": "右上角",
      "bottom-right": "右下角",
      "bottom-left": "左下角"
    };
    movementStatus.textContent = `${noButton.textContent}按钮移动到了${cornerNames[state.currentCorner]}，愿意按钮已居中。`;
  }

  function scheduleDodgeRecalculation() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      if (currentScreen === 1 && state.dodgeCount > 0) positionDodgeButtons(false);
    });
  }

  function clearDateError() {
    dateError.hidden = true;
    dateError.textContent = "";
    dateInput.removeAttribute("aria-invalid");
    timeInput.removeAttribute("aria-invalid");
  }

  function handleDateSubmit(event) {
    event.preventDefault();
    clearDateError();
    const today = getToday();
    const selectedDate = dateInput.value;
    const selectedTime = timeInput.value;

    if (!selectedDate || selectedDate < today) {
      dateError.textContent = "请选择今天或之后的日期。";
      dateError.hidden = false;
      dateInput.setAttribute("aria-invalid", "true");
      dateInput.focus();
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(selectedTime)) {
      dateError.textContent = "请选择有效的见面时间。";
      dateError.hidden = false;
      timeInput.setAttribute("aria-invalid", "true");
      timeInput.focus();
      return;
    }

    state.date = selectedDate;
    state.time = selectedTime;
    persistState();
    showScreen(4);
  }

  function handleFoodSelect(event) {
    const button = event.currentTarget;
    state.menu = button.dataset.menu;
    syncFoodSelection();
    persistState();
    movementStatus.textContent = `已选择${state.menu}。`;

    if (menuTransitionTimer) clearTimeout(menuTransitionTimer);
    menuTransitionTimer = setTimeout(() => {
      menuTransitionTimer = null;
      showScreen(6);
    }, 240);
  }

  function handleActivitySelect(event) {
    const button = event.currentTarget;
    state.activity = button.dataset.activity;
    syncActivitySelection();
    persistState();
    movementStatus.textContent = `已选择${state.activity}。`;

    if (menuTransitionTimer) clearTimeout(menuTransitionTimer);
    menuTransitionTimer = setTimeout(() => {
      menuTransitionTimer = null;
      showScreen(5);
    }, 240);
  }

  function syncActivitySelection() {
    activityOptions.forEach((button) => {
      const selected = button.dataset.activity === state.activity;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function syncFoodSelection() {
    foodOptions.forEach((button) => {
      const selected = button.dataset.menu === state.menu;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function formatDateForDisplay(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
    return `${month}月${day}日 ${weekday}`;
  }

  function updateResult() {
    document.querySelector("#summary-date").textContent = formatDateForDisplay(state.date);
    document.querySelector("#summary-time").textContent = state.time;
    document.querySelector("#summary-activity").textContent = state.activity || "待选择";
    document.querySelector("#summary-menu").textContent = state.menu || "待选择";
    renderDateCard(cardCanvas);
  }

  function renderDateCard(canvas) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器不支持 Canvas 绘图。请更新浏览器后重试。");

    const width = 1080;
    const height = 1440;
    canvas.width = width;
    canvas.height = height;

    context.fillStyle = "#fff8f3";
    context.fillRect(0, 0, width, height);

    drawPosterPattern(context, width, height);
    drawRoundedRect(context, 72, 72, 936, 1296, 28, "#fffdfb", "#49323a", 8);

    context.textAlign = "center";
    context.fillStyle = "#d94861";
    context.font = '800 34px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText("IT'S A DATE", width / 2, 164);

    context.fillStyle = "#49323a";
    context.font = '900 74px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText("和你见面的这一天", width / 2, 255);

    drawHeartIllustration(context, width / 2, 505);

    context.fillStyle = "#7f6971";
    context.font = '500 32px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText("把期待装进口袋，准时来见你", width / 2, 762);

    drawSummaryRow(context, "DATE", formatDateForDisplay(state.date), 835, "#ffe1e7");
    drawSummaryRow(context, "TIME", state.time, 940, "#d8f0e8");
    drawSummaryRow(context, "PLAY", state.activity || "待选择", 1045, "#dbeaf8");
    drawSummaryRow(context, "MENU", state.menu || "待选择", 1150, "#ffedb0");

    context.fillStyle = "#d94861";
    context.font = '900 42px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText("♥", width / 2, 1289);
    context.fillStyle = "#806d75";
    context.font = '600 25px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText("SEE YOU SOON", width / 2, 1332);
  }

  function drawPosterPattern(context, width, height) {
    const shapes = [
      { x: 37, y: 115, text: "♥", color: "#f6a5b3", size: 42, rotate: -0.2 },
      { x: 988, y: 222, text: "✦", color: "#55aa99", size: 48, rotate: 0.1 },
      { x: 44, y: 1190, text: "✦", color: "#e8a725", size: 42, rotate: -0.1 },
      { x: 988, y: 1298, text: "♥", color: "#f6a5b3", size: 46, rotate: 0.2 },
      { x: 980, y: 742, text: "•", color: "#7fb6d1", size: 62, rotate: 0 }
    ];
    shapes.forEach((shape) => {
      context.save();
      context.translate(shape.x, shape.y);
      context.rotate(shape.rotate);
      context.fillStyle = shape.color;
      context.font = `900 ${shape.size}px sans-serif`;
      context.textAlign = "center";
      context.fillText(shape.text, 0, 0);
      context.restore();
    });
  }

  function drawHeartIllustration(context, centerX, centerY) {
    context.save();
    context.translate(centerX, centerY);
    context.rotate(-0.035);

    context.beginPath();
    context.moveTo(0, 180);
    context.bezierCurveTo(-34, 142, -202, 48, -202, -84);
    context.bezierCurveTo(-202, -194, -74, -232, 0, -142);
    context.bezierCurveTo(74, -232, 202, -194, 202, -84);
    context.bezierCurveTo(202, 48, 34, 142, 0, 180);
    context.closePath();
    context.fillStyle = "#f45f76";
    context.fill();
    context.lineWidth = 9;
    context.strokeStyle = "#49323a";
    context.stroke();

    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(-63, -44, 12, 0, Math.PI * 2);
    context.arc(63, -44, 12, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#49323a";
    context.lineWidth = 7;
    context.stroke();

    context.beginPath();
    context.arc(0, 12, 44, 0.12 * Math.PI, 0.88 * Math.PI);
    context.stroke();

    context.fillStyle = "#f8a6b4";
    context.beginPath();
    context.ellipse(-112, 14, 34, 17, -0.1, 0, Math.PI * 2);
    context.ellipse(112, 14, 34, 17, 0.1, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#ffd85c";
    context.font = "900 70px sans-serif";
    context.textAlign = "center";
    context.fillText("✦", -235, -150);
    context.fillStyle = "#55aa99";
    context.fillText("✦", 237, 108);
    context.restore();
  }

  function drawSummaryRow(context, label, value, y, fillColor) {
    drawRoundedRect(context, 154, y - 70, 772, 102, 20, fillColor, null, 0);
    context.textAlign = "left";
    context.fillStyle = "#c43d57";
    context.font = '900 28px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText(label, 195, y - 8);
    context.textAlign = "right";
    context.fillStyle = "#49323a";
    context.font = '800 34px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText(value, 884, y - 8);
  }

  function drawRoundedRect(context, x, y, width, height, radius, fill, stroke, lineWidth) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    if (typeof context.roundRect === "function") {
      context.roundRect(x, y, width, height, safeRadius);
    } else {
      context.moveTo(x + safeRadius, y);
      context.lineTo(x + width - safeRadius, y);
      context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
      context.lineTo(x + width, y + height - safeRadius);
      context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
      context.lineTo(x + safeRadius, y + height);
      context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
      context.lineTo(x, y + safeRadius);
      context.quadraticCurveTo(x, y, x + safeRadius, y);
      context.closePath();
    }
    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    if (stroke && lineWidth) {
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      context.stroke();
    }
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("图片生成失败，请重试。"));
        }, "image/png");
      } catch (error) {
        reject(error);
      }
    });
  }

  async function saveOrShareCard() {
    const originalText = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.textContent = "正在生成约会卡…";

    try {
      renderDateCard(cardCanvas);
      const blob = await canvasToBlob(cardCanvas);
      const filename = `约会卡-${state.date}.png`;
      const file = typeof File === "function" ? new File([blob], filename, { type: "image/png" }) : null;
      const shareData = file ? { files: [file], title: "我们的约会卡", text: "约会计划已经准备好啦 ♥" } : null;

      if (shareData && navigator.share && navigator.canShare?.(shareData)) {
        try {
          await navigator.share(shareData);
          showToast("约会卡已打开系统分享");
          return;
        } catch (error) {
          if (error?.name === "AbortError") {
            showToast("已取消分享");
            return;
          }
        }
      }

      downloadBlob(blob, filename);
      showToast("约会卡 PNG 已下载");
    } catch (error) {
      showToast(error?.message || "保存失败，请稍后再试");
    } finally {
      saveButton.disabled = false;
      saveButton.innerHTML = originalText;
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => {
      toast.hidden = true;
      toastTimer = null;
    }, 2600);
  }

  initialize();
})();
