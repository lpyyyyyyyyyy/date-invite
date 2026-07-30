(() => {
  "use strict";

  const STORAGE_KEY = "cute-date-invite-v1";
  const ARCHIVE_KEY = "cute-date-invite-archive-v1";
  const ANNIVERSARY_KEY = "cute-date-invite-anniversaries-v1";
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
  const locationInput = document.querySelector("#location-input");
  const dateError = document.querySelector("#date-error");
  const activityOptions = [...document.querySelectorAll("#activity-grid .activity-option:not(.other-option)")];
  const foodOptions = [...document.querySelectorAll("#food-grid .food-option:not(.other-option)")];
  const activityOtherButton = document.querySelector("#activity-grid [data-activity='other']");
  const foodOtherButton = document.querySelector("#food-grid [data-menu='other']");
  const activityOtherForm = document.querySelector("#activity-other-form");
  const foodOtherForm = document.querySelector("#food-other-form");
  const activityOtherInput = document.querySelector("#activity-other-input");
  const foodOtherInput = document.querySelector("#food-other-input");
  const cardCanvas = document.querySelector("#date-card");
  const saveButton = document.querySelector("#save-button");
  const toast = document.querySelector("#toast");
  const countdown = document.querySelector("#countdown");
  const archiveList = document.querySelector("#archive-list");
  const archiveCreateButton = document.querySelector("#archive-create-button");
  const archiveCreateForm = document.querySelector("#archive-create-form");
  const archiveDateInput = document.querySelector("#archive-date-input");
  const archiveTimeInput = document.querySelector("#archive-time-input");
  const archiveLocationInput = document.querySelector("#archive-location-input");
  const archiveActivityInput = document.querySelector("#archive-activity-input");
  const archiveMenuInput = document.querySelector("#archive-menu-input");
  const memoryForm = document.querySelector("#memory-form");
  const memoryText = document.querySelector("#memory-text");
  const memoryPhoto = document.querySelector("#memory-photo");
  const memoryPhotos = document.querySelector("#memory-photos");
  const homeCountdown = document.querySelector("#home-countdown");
  const memoryMeta = document.querySelector("#memory-meta");
  const mapLocation = document.querySelector("#map-location");
  const mapLink = document.querySelector("#map-link");
  const rouletteDialog = document.querySelector("#roulette-dialog");
  const rouletteWheel = document.querySelector("#roulette-wheel");
  const rouletteTitle = document.querySelector("#roulette-title");
  const rouletteResult = document.querySelector("#roulette-result");
  const rouletteSpin = document.querySelector("#roulette-spin");
  const rouletteChoose = document.querySelector("#roulette-choose");
  const rouletteClose = document.querySelector("#roulette-close");
  const anniversaryForm = document.querySelector("#anniversary-form");
  const anniversaryName = document.querySelector("#anniversary-name");
  const anniversaryDate = document.querySelector("#anniversary-date");
  const anniversaryDateLabel = document.querySelector("#anniversary-date-label");
  const anniversaryHelp = document.querySelector("#anniversary-help");
  const anniversaryError = document.querySelector("#anniversary-error");
  const anniversaryList = document.querySelector("#anniversary-list");

  let toastTimer = null;
  let menuTransitionTimer = null;
  let countdownTimer = null;
  let resizeFrame = null;
  let currentScreen = 0;
  let state = loadState();
  let archiveRecords = loadArchive();
  let anniversaries = loadAnniversaries();
  let archiveReturnScreen = 1;
  let activeMemoryRecordId = "";
  let selectedMood = "";
  let rouletteKind = "";
  let rouletteOptions = [];
  let rouletteIndex = -1;
  let rouletteRotation = 0;
  let rouletteSpinning = false;
  let anniversaryMode = "since";

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
      location: "",
      activity: "",
      activityIsOther: false,
      menu: "",
      menuIsOther: false,
      activeRecordId: "",
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
        location: typeof saved.location === "string" ? saved.location : "",
        activity: typeof saved.activity === "string" ? saved.activity : "",
        activityIsOther: Boolean(saved.activityIsOther),
        menu: typeof saved.menu === "string" ? saved.menu : "",
        menuIsOther: Boolean(saved.menuIsOther),
        activeRecordId: typeof saved.activeRecordId === "string" ? saved.activeRecordId : "",
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

  function loadArchive() {
    try {
      const saved = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((record) => record && typeof record.id === "string").map((record) => ({
        ...record,
        photos: Array.isArray(record.photos) ? record.photos.filter((photo) => typeof photo === "string").slice(0, 3) : [],
        memory: typeof record.memory === "string" ? record.memory : "",
        mood: typeof record.mood === "string" ? record.mood : ""
      })) : [];
    } catch (error) {
      return [];
    }
  }

  function persistArchive() {
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archiveRecords));
    } catch (error) {
      showToast("浏览器未允许保存档案，当前页面仍可继续使用");
    }
  }

  function loadAnniversaries() {
    try {
      const saved = JSON.parse(localStorage.getItem(ANNIVERSARY_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((item) => item && typeof item.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date)).map((item) => ({
        id: item.id,
        name: typeof item.name === "string" ? item.name : "我们的纪念日",
        date: item.date,
        mode: item.mode === "until" ? "until" : "since"
      })) : [];
    } catch (error) {
      return [];
    }
  }

  function persistAnniversaries() {
    try {
      localStorage.setItem(ANNIVERSARY_KEY, JSON.stringify(anniversaries));
    } catch (error) {
      showToast("浏览器未允许保存纪念日");
    }
  }

  function initialize() {
    document.querySelector(".progress").hidden = true;
    dateInput.min = getToday();
    dateInput.value = state.date;
    timeInput.value = state.time;
    locationInput.value = state.location;
    syncActivitySelection();
    syncFoodSelection();
    updateHomeCountdown();

    if (state.dodgeCount > 0) {
      noButton.textContent = noLabels[state.dodgeCount % noLabels.length];
      requestAnimationFrame(() => activateDodgeLayout(false));
    }

    document.querySelector(".home-plan").addEventListener("click", () => showScreen(1));
    document.querySelector(".anniversary-open").addEventListener("click", () => showScreen(9));
    yesButton.addEventListener("click", () => {
      state.activeRecordId = "";
      persistState();
      showScreen(2);
    });
    noButton.addEventListener("click", handleNoClick);
    dateForm.addEventListener("submit", handleDateSubmit);
    dateInput.addEventListener("input", clearDateError);
    timeInput.addEventListener("input", clearDateError);
    locationInput.addEventListener("input", () => {
      state.location = locationInput.value.trim();
      persistState();
    });
    saveButton.addEventListener("click", saveOrShareCard);

    document.querySelectorAll("[data-next]").forEach((button) => {
      button.addEventListener("click", () => showScreen(Number(button.dataset.next)));
    });
    document.querySelectorAll("[data-back]").forEach((button) => {
      button.addEventListener("click", () => showScreen(Number(button.dataset.back)));
    });
    activityOptions.forEach((button) => button.addEventListener("click", handleActivitySelect));
    foodOptions.forEach((button) => button.addEventListener("click", handleFoodSelect));
    activityOtherButton.addEventListener("click", showActivityOtherInput);
    foodOtherButton.addEventListener("click", showFoodOtherInput);
    activityOtherForm.addEventListener("submit", submitActivityOther);
    foodOtherForm.addEventListener("submit", submitFoodOther);
    document.querySelectorAll(".library-open").forEach((button) => button.addEventListener("click", openArchive));
    document.querySelector(".library-back").addEventListener("click", () => showScreen(archiveReturnScreen));
    archiveCreateButton.addEventListener("click", showArchiveCreateForm);
    archiveCreateForm.addEventListener("submit", createPastDate);
    document.querySelector(".memory-back").addEventListener("click", () => showScreen(7));
    memoryForm.addEventListener("submit", saveMemory);
    memoryPhoto.addEventListener("change", addMemoryPhotos);
    document.querySelectorAll("[data-mood]").forEach((button) => button.addEventListener("click", selectMood));
    document.querySelectorAll("[data-roulette]").forEach((button) => button.addEventListener("click", () => openRoulette(button.dataset.roulette)));
    rouletteSpin.addEventListener("click", spinRoulette);
    rouletteChoose.addEventListener("click", applyRouletteChoice);
    rouletteClose.addEventListener("click", () => rouletteDialog.close());
    anniversaryForm.addEventListener("submit", addAnniversary);
    document.querySelectorAll("[data-anniversary-mode]").forEach((button) => button.addEventListener("click", () => setAnniversaryMode(button.dataset.anniversaryMode)));

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
    document.querySelector(".progress").hidden = screenNumber === 0 || screenNumber > 6;

    if (screenNumber === 0) updateHomeCountdown();
    if (screenNumber === 1 && state.dodgeCount > 0) {
      requestAnimationFrame(() => positionDodgeButtons(false));
    }
    if (screenNumber === 3) {
      dateInput.min = getToday();
      dateInput.value = state.date;
      timeInput.value = state.time;
      locationInput.value = state.location;
    }
    if (screenNumber === 4) syncActivitySelection();
    if (screenNumber === 5) syncFoodSelection();
    if (screenNumber === 6) updateResult();
    if (screenNumber === 7) renderArchive();
    if (screenNumber === 9) {
      setAnniversaryMode(anniversaryMode);
      renderAnniversaries();
    }

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
    state.menuIsOther = false;
    foodOtherForm.hidden = true;
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
    state.activityIsOther = false;
    activityOtherForm.hidden = true;
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
    const selectedOther = Boolean(state.activity && state.activityIsOther);
    activityOtherButton.classList.toggle("is-selected", selectedOther);
    activityOtherButton.setAttribute("aria-pressed", String(selectedOther));
  }

  function syncFoodSelection() {
    foodOptions.forEach((button) => {
      const selected = button.dataset.menu === state.menu;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const selectedOther = Boolean(state.menu && state.menuIsOther);
    foodOtherButton.classList.toggle("is-selected", selectedOther);
    foodOtherButton.setAttribute("aria-pressed", String(selectedOther));
  }

  function formatDateForDisplay(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
    return `${year}年${month}月${day}日 ${weekday}`;
  }

  function updateResult() {
    ensurePlanRecord();
    document.querySelector("#summary-date").textContent = formatDateForDisplay(state.date);
    document.querySelector("#summary-time").textContent = state.time;
    document.querySelector("#summary-activity").textContent = state.activity || "待选择";
    document.querySelector("#summary-menu").textContent = state.menu || "待选择";
    document.querySelector("#summary-location").textContent = state.location || "待定";
    updateMap();
    renderDateCard(cardCanvas);
    updateResultCountdown();
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(updateResultCountdown, 30000);
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
    context.fillText("把期待装进口袋，准时来见你", width / 2, 710);

    drawSummaryRow(context, "DATE", formatDateForDisplay(state.date), 790, "#ffe1e7");
    drawSummaryRow(context, "TIME", state.time, 888, "#d8f0e8");
    drawSummaryRow(context, "PLAY", state.activity || "待选择", 986, "#dbeaf8");
    drawSummaryRow(context, "MENU", state.menu || "待选择", 1084, "#ffedb0");
    drawSummaryRow(context, "PLACE", state.location || "待定", 1182, "#e9ddf5");

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
    drawRoundedRect(context, 154, y - 58, 772, 82, 18, fillColor, null, 0);
    context.textAlign = "left";
    context.fillStyle = "#c43d57";
    context.font = '900 25px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText(label, 195, y - 8);
    context.textAlign = "right";
    context.fillStyle = "#49323a";
    context.font = '800 28px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.fillText(clipText(context, value, 600), 884, y - 8);
  }

  function clipText(context, value, maxWidth) {
    const text = String(value);
    if (context.measureText(text).width <= maxWidth) return text;
    let shortened = text;
    while (shortened && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
    return `${shortened}…`;
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

  function setAnniversaryMode(mode) {
    anniversaryMode = mode === "until" ? "until" : "since";
    const isSince = anniversaryMode === "since";
    document.querySelectorAll("[data-anniversary-mode]").forEach((button) => {
      const selected = button.dataset.anniversaryMode === anniversaryMode;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    anniversaryDateLabel.textContent = isSince ? "从哪一天开始" : "哪一天快要到啦";
    anniversaryHelp.textContent = isSince ? "选择今天或过去的日期，看看已经相伴多久。" : "选择今天或未来的日期，看看还有多久到。";
    if (isSince) {
      anniversaryDate.max = getToday();
      anniversaryDate.removeAttribute("min");
    } else {
      anniversaryDate.min = getToday();
      anniversaryDate.removeAttribute("max");
    }
    if (!anniversaryDate.value || (isSince && anniversaryDate.value > getToday()) || (!isSince && anniversaryDate.value < getToday())) anniversaryDate.value = getToday();
    anniversaryError.hidden = true;
  }

  function addAnniversary(event) {
    event.preventDefault();
    const date = anniversaryDate.value;
    const today = getToday();
    const invalid = !date || (anniversaryMode === "since" && date > today) || (anniversaryMode === "until" && date < today);
    if (invalid) {
      anniversaryError.textContent = anniversaryMode === "since" ? "开始纪念日请选择今天或以前。" : "倒计时纪念日请选择今天或以后。";
      anniversaryError.hidden = false;
      anniversaryDate.focus();
      return;
    }
    anniversaries.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: anniversaryName.value.trim() || "我们的纪念日",
      date,
      mode: anniversaryMode
    });
    persistAnniversaries();
    anniversaryName.value = "";
    anniversaryDate.value = getToday();
    renderAnniversaries();
    showToast("纪念日已经收好啦");
  }

  function anniversaryDayDistance(date) {
    const [year, month, day] = date.split("-").map(Number);
    const target = new Date(year, month - 1, day);
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

  function anniversaryStatus(item) {
    const distance = anniversaryDayDistance(item.date);
    if (item.mode === "since") {
      if (distance === 0) return "今天就是第 1 天";
      return `已经相伴 ${Math.max(0, -distance)} 天`;
    }
    if (distance === 0) return "就是今天";
    return `还有 ${Math.max(0, distance)} 天到`;
  }

  function renderAnniversaries() {
    anniversaryList.replaceChildren();
    if (!anniversaries.length) {
      const empty = document.createElement("p");
      empty.className = "anniversary-empty";
      empty.textContent = "第一份小纪念，等你们一起放进来。";
      anniversaryList.append(empty);
      return;
    }
    anniversaries.forEach((item) => {
      const card = document.createElement("article");
      card.className = "anniversary-item";
      const copy = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = item.name;
      const detail = document.createElement("p");
      detail.textContent = `${item.mode === "since" ? "开始于" : "到来的日子"} ${formatDateForDisplay(item.date)}`;
      copy.append(title, detail);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "anniversary-delete";
      remove.textContent = "删除";
      remove.addEventListener("click", () => deleteAnniversary(item.id));
      const status = document.createElement("strong");
      status.textContent = anniversaryStatus(item);
      card.append(copy, remove, status);
      anniversaryList.append(card);
    });
  }

  function deleteAnniversary(id) {
    if (!window.confirm("确定删除这个纪念日吗？")) return;
    anniversaries = anniversaries.filter((item) => item.id !== id);
    persistAnniversaries();
    renderAnniversaries();
    showToast("纪念日已删除");
  }

  function openRoulette(kind) {
    rouletteKind = kind;
    rouletteOptions = (kind === "activity" ? activityOptions : foodOptions).map((button) => kind === "activity" ? button.dataset.activity : button.dataset.menu);
    rouletteIndex = -1;
    rouletteSpinning = false;
    rouletteTitle.textContent = kind === "activity" ? "让转盘决定玩什么" : "让转盘决定吃什么";
    rouletteResult.textContent = "点击开始转动吧";
    rouletteChoose.disabled = true;
    rouletteSpin.disabled = false;
    rouletteSpin.textContent = "开始转动";
    drawRouletteWheel();
    if (typeof rouletteDialog.showModal === "function") rouletteDialog.showModal();
    else rouletteDialog.setAttribute("open", "");
    requestAnimationFrame(() => rouletteSpin.focus());
  }

  function drawRouletteWheel() {
    const context = rouletteWheel.getContext("2d");
    if (!context || !rouletteOptions.length) return;
    const size = rouletteWheel.width;
    const center = size / 2;
    const radius = center - 10;
    const slice = Math.PI * 2 / rouletteOptions.length;
    const colors = ["#ffe1e7", "#d8f0e8", "#dbeaf8", "#ffedb0", "#eadcf6", "#d9f1e8", "#ffe6c9", "#dce6ff", "#f7d8df"];
    context.clearRect(0, 0, size, size);
    rouletteOptions.forEach((option, index) => {
      const start = -Math.PI / 2 + index * slice;
      const middle = start + slice / 2;
      context.beginPath();
      context.moveTo(center, center);
      context.arc(center, center, radius, start, start + slice);
      context.closePath();
      context.fillStyle = colors[index % colors.length];
      context.fill();
      context.strokeStyle = "#49323a";
      context.lineWidth = 3;
      context.stroke();
      context.save();
      context.translate(center + Math.cos(middle) * radius * 0.62, center + Math.sin(middle) * radius * 0.62);
      context.rotate(middle + Math.PI / 2);
      context.fillStyle = "#49323a";
      context.font = '800 28px "Microsoft YaHei", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(option, 0, 0);
      context.restore();
    });
    context.beginPath();
    context.arc(center, center, 37, 0, Math.PI * 2);
    context.fillStyle = "#f45f76";
    context.fill();
    context.strokeStyle = "#49323a";
    context.lineWidth = 4;
    context.stroke();
    context.fillStyle = "#fff";
    context.font = '900 29px "Microsoft YaHei", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("♥", center, center + 2);
  }

  function spinRoulette() {
    if (rouletteSpinning || !rouletteOptions.length) return;
    rouletteSpinning = true;
    rouletteIndex = Math.floor(Math.random() * rouletteOptions.length);
    rouletteSpin.disabled = true;
    rouletteChoose.disabled = true;
    rouletteResult.textContent = "转呀转，看看会选到什么…";
    const sliceDegrees = 360 / rouletteOptions.length;
    const targetDegrees = -((rouletteIndex + 0.5) * sliceDegrees);
    const currentDegrees = ((rouletteRotation % 360) + 360) % 360;
    rouletteRotation += 5 * 360 + ((targetDegrees - currentDegrees + 360) % 360);
    rouletteWheel.style.transform = `rotate(${rouletteRotation}deg)`;
    setTimeout(() => {
      rouletteSpinning = false;
      rouletteResult.textContent = `今天就选：${rouletteOptions[rouletteIndex]}！`;
      rouletteSpin.disabled = false;
      rouletteSpin.textContent = "再转一次";
      rouletteChoose.disabled = false;
      rouletteChoose.focus();
    }, 2860);
  }

  function applyRouletteChoice() {
    if (rouletteIndex < 0 || rouletteSpinning) return;
    const choice = rouletteOptions[rouletteIndex];
    rouletteDialog.close();
    if (rouletteKind === "activity") {
      state.activity = choice;
      state.activityIsOther = false;
      activityOtherForm.hidden = true;
      syncActivitySelection();
      persistState();
      showToast(`转盘选中了${choice}`);
      setTimeout(() => showScreen(5), 180);
    } else {
      state.menu = choice;
      state.menuIsOther = false;
      foodOtherForm.hidden = true;
      syncFoodSelection();
      persistState();
      showToast(`转盘选中了${choice}`);
      setTimeout(() => showScreen(6), 180);
    }
  }

  function showActivityOtherInput() {
    activityOtherForm.hidden = false;
    activityOtherInput.value = state.activityIsOther ? state.activity : "";
    activityOtherButton.classList.add("is-selected");
    activityOtherButton.setAttribute("aria-pressed", "true");
    requestAnimationFrame(() => activityOtherInput.focus());
  }

  function showFoodOtherInput() {
    foodOtherForm.hidden = false;
    foodOtherInput.value = state.menuIsOther ? state.menu : "";
    foodOtherButton.classList.add("is-selected");
    foodOtherButton.setAttribute("aria-pressed", "true");
    requestAnimationFrame(() => foodOtherInput.focus());
  }

  function submitActivityOther(event) {
    event.preventDefault();
    const value = activityOtherInput.value.trim();
    if (!value) return activityOtherInput.focus();
    state.activity = value;
    state.activityIsOther = true;
    syncActivitySelection();
    persistState();
    menuTransitionTimer = setTimeout(() => showScreen(5), 240);
  }

  function submitFoodOther(event) {
    event.preventDefault();
    const value = foodOtherInput.value.trim();
    if (!value) return foodOtherInput.focus();
    state.menu = value;
    state.menuIsOther = true;
    syncFoodSelection();
    persistState();
    menuTransitionTimer = setTimeout(() => showScreen(6), 240);
  }

  function formatRecordTime(record) {
    return new Date(`${record.date}T${record.time}:00`).getTime();
  }

  function ensurePlanRecord() {
    if (!state.date || !state.time || !state.activity || !state.menu) return;
    const detail = { date: state.date, time: state.time, location: state.location, activity: state.activity, menu: state.menu, updatedAt: Date.now() };
    let record = archiveRecords.find((item) => item.id === state.activeRecordId);
    if (record) Object.assign(record, detail);
    else {
      record = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...detail, createdAt: Date.now(), memory: "", mood: "", photos: [] };
      archiveRecords.unshift(record);
      state.activeRecordId = record.id;
      persistState();
    }
    persistArchive();
  }

  function updateMap() {
    mapLocation.textContent = state.location || "地点待定";
    const keyword = normalizeMapKeyword(state.location);
    mapLink.href = keyword ? `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}&view=map&src=%E8%94%A1%E5%AD%90%E7%8F%8A%E5%92%8C%E5%88%98%E5%B9%B3%E5%A3%B9%E7%9A%84%E7%A9%BA%E9%97%B4&callnative=1` : "https://ditu.amap.com/";
  }

  function normalizeMapKeyword(location) {
    return String(location || "")
      .replace(/[，,。！？!?]/g, " ")
      .replace(/(附近|周边|旁边|那边|一带|周围|附近的)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getCountdownText(record) {
    const difference = formatRecordTime(record) - Date.now();
    if (!Number.isFinite(difference) || difference <= 0) return "今天也值得留下回忆";
    const minutes = Math.floor(difference / 60000);
    return `距离约会还有 ${Math.floor(minutes / 1440)} 天 ${Math.floor(minutes % 1440 / 60)} 小时 ${minutes % 60} 分钟`;
  }

  function updateResultCountdown() {
    countdown.textContent = getCountdownText(state);
  }

  function updateHomeCountdown() {
    const next = archiveRecords.filter((record) => formatRecordTime(record) > Date.now()).sort((a, b) => formatRecordTime(a) - formatRecordTime(b))[0];
    homeCountdown.textContent = next ? `${getCountdownText(next)} · ${formatDateForDisplay(next.date)}` : "还没有下一次约会计划";
  }

  function openArchive() {
    archiveReturnScreen = currentScreen;
    showScreen(7);
  }

  function showArchiveCreateForm() {
    archiveCreateForm.hidden = !archiveCreateForm.hidden;
    if (!archiveCreateForm.hidden) {
      archiveDateInput.value = getToday();
      archiveTimeInput.value = "17:00";
      archiveLocationInput.value = "";
      archiveActivityInput.value = "";
      archiveMenuInput.value = "";
      requestAnimationFrame(() => archiveDateInput.focus());
    }
  }

  function createPastDate(event) {
    event.preventDefault();
    if (!archiveDateInput.value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(archiveTimeInput.value)) return;
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: archiveDateInput.value,
      time: archiveTimeInput.value,
      location: archiveLocationInput.value.trim(),
      activity: archiveActivityInput.value.trim() || "一起约会",
      menu: archiveMenuInput.value.trim() || "吃点喜欢的",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      memory: "",
      mood: "",
      photos: []
    };
    archiveRecords.unshift(record);
    persistArchive();
    archiveCreateForm.hidden = true;
    openMemory(record.id);
  }

  function renderArchive() {
    archiveList.replaceChildren();
    const records = [...archiveRecords].sort((a, b) => formatRecordTime(b) - formatRecordTime(a));
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "archive-empty";
      empty.textContent = "第一份约会计划，会从这里开始收藏。";
      archiveList.append(empty);
      return;
    }
    records.forEach((record) => archiveList.append(createArchiveCard(record)));
  }

  function createArchiveCard(record) {
    const item = document.createElement("article");
    item.className = "archive-item";
    const header = document.createElement("div");
    header.className = "archive-item-header";
    const title = document.createElement("h2");
    title.textContent = formatDateForDisplay(record.date);
    const time = document.createElement("p");
    time.textContent = record.time;
    header.append(title, time);
    const place = document.createElement("p");
    place.textContent = `⌖ ${record.location || "地点待定"}`;
    const tags = document.createElement("div");
    tags.className = "archive-tags";
    [record.activity, record.menu, record.mood].filter(Boolean).forEach((value) => { const tag = document.createElement("span"); tag.textContent = value; tags.append(tag); });
    item.append(header, place, tags);
    if (record.photos?.length) {
      const photos = document.createElement("div");
      photos.className = "archive-photos";
      record.photos.forEach((source) => { const image = document.createElement("img"); image.src = source; image.alt = `${formatDateForDisplay(record.date)} 的回忆照片`; photos.append(image); });
      item.append(photos);
    }
    if (record.memory) { const memory = document.createElement("p"); memory.className = "archive-memory"; memory.textContent = record.memory; item.append(memory); }
    const actions = document.createElement("div"); actions.className = "archive-actions";
    const edit = document.createElement("button"); edit.type = "button"; edit.className = "memory-open"; edit.textContent = record.memory || record.photos?.length ? "编辑回忆" : "写回忆"; edit.addEventListener("click", () => openMemory(record.id));
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "delete-record"; remove.textContent = "删除"; remove.addEventListener("click", () => deleteRecord(record.id));
    actions.append(edit, remove); item.append(actions);
    return item;
  }

  function deleteRecord(id) {
    if (!window.confirm("确定删除这次约会记录吗？照片和回忆也会一起删除。")) return;
    archiveRecords = archiveRecords.filter((record) => record.id !== id);
    if (state.activeRecordId === id) { state.activeRecordId = ""; persistState(); }
    persistArchive(); renderArchive(); updateHomeCountdown(); showToast("这条约会记录已删除");
  }

  function openMemory(id) {
    const record = archiveRecords.find((item) => item.id === id);
    if (!record) return;
    activeMemoryRecordId = id;
    selectedMood = record.mood || "";
    memoryText.value = record.memory || "";
    memoryPhoto.value = "";
    memoryMeta.textContent = `${formatDateForDisplay(record.date)} · ${record.time}${record.location ? ` · ${record.location}` : ""}`;
    syncMoodButtons();
    renderMemoryPhotos(record);
    showScreen(8);
  }

  function selectMood(event) { selectedMood = event.currentTarget.dataset.mood; syncMoodButtons(); }
  function syncMoodButtons() { document.querySelectorAll("[data-mood]").forEach((button) => { const selected = button.dataset.mood === selectedMood; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); }); }
  function currentMemoryRecord() { return archiveRecords.find((record) => record.id === activeMemoryRecordId); }
  function saveMemory(event) { event.preventDefault(); const record = currentMemoryRecord(); if (!record) return showToast("没有找到这份约会记录"); record.memory = memoryText.value.trim(); record.mood = selectedMood; record.updatedAt = Date.now(); persistArchive(); showToast("回忆已经收好啦"); showScreen(7); }

  async function addMemoryPhotos() {
    const record = currentMemoryRecord();
    const files = [...memoryPhoto.files].filter((file) => file.type.startsWith("image/"));
    const capacity = record ? Math.max(0, 3 - (record.photos?.length || 0)) : 0;
    if (!record || !files.length) return;
    if (!capacity) { showToast("每次约会最多保存 3 张照片"); memoryPhoto.value = ""; return; }
    try { record.photos.push(...await Promise.all(files.slice(0, capacity).map(compressPhoto))); record.updatedAt = Date.now(); persistArchive(); renderMemoryPhotos(record); if (files.length > capacity) showToast(`只保存了前 ${capacity} 张照片`); }
    catch { showToast("照片读取失败，请换一张再试"); }
    memoryPhoto.value = "";
  }

  function compressPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("读取失败"));
      reader.onload = () => { const image = new Image(); image.onerror = () => reject(new Error("图片无效")); image.onload = () => { const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale)); const context = canvas.getContext("2d"); if (!context) return reject(new Error("不支持绘图")); context.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", 0.78)); }; image.src = reader.result; };
      reader.readAsDataURL(file);
    });
  }

  function renderMemoryPhotos(record) {
    memoryPhotos.replaceChildren();
    record.photos.forEach((source, index) => { const wrap = document.createElement("div"); wrap.className = "memory-photo"; const image = document.createElement("img"); image.src = source; image.alt = `回忆照片 ${index + 1}`; const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", `删除回忆照片 ${index + 1}`); remove.addEventListener("click", () => { record.photos.splice(index, 1); persistArchive(); renderMemoryPhotos(record); }); wrap.append(image, remove); memoryPhotos.append(wrap); });
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
