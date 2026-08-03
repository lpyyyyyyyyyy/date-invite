(() => {
  "use strict";

  const STORAGE_KEY = "cute-date-invite-v1";
  const ARCHIVE_KEY = "cute-date-invite-archive-v1";
  const ANNIVERSARY_KEY = "cute-date-invite-anniversaries-v1";
  const THINGS_KEY = "cute-date-invite-100-things-v1";
  const COUPLE_NOTES_KEY = "cute-date-invite-couple-notes-v1";
  const FUTURE_LETTERS_KEY = "cute-date-invite-future-letters-v1";
  const CAT_KEY = "cute-date-invite-cat-v1";
  const REPAIR_KEY = "cute-date-invite-repair-v1";
  const noLabels = ["不要", "再想想嘛", "点不到我", "真的不要吗"];
  const hundredThings = [
    "一起骑自行车", "穿对方挑选的衣服", "一起去露营", "一起看烟花", "一起坐热气球", "一起跑步健身", "一起唱歌", "亲手写信给对方", "一起过圣诞节", "一起打游戏",
    "一起睡懒觉", "一起小酌", "一起去看艺术展", "一起去对方学校或公司附近看看", "一起吃冰", "一起吃冰镇西瓜", "一起逛超市", "一起吃早餐", "一起压马路", "一起看电影",
    "为对方染一次头发", "给对方一个小惊喜", "一起成为更好的人", "一起搬家", "一起去沙漠旅行", "一起吃路边小吃", "拍照留念", "一起坐摩天轮", "一起坐过山车", "一起做手工",
    "一起做蛋糕", "一起去草原骑马", "一起泡温泉", "一起打台球", "一起自己做晚餐", "给未来的对方写一封信", "一起骑车兜风", "一起改掉一个小毛病", "一起去吃一次自助餐", "一起庆祝生日",
    "拍一组情侣写真", "一起散步", "背着对方走一段很长的路", "教对方一个自己的特长", "为对方设计一个表情包", "一起划船", "一起做饭", "情人节给对方准备惊喜", "一起准备一次烛光晚餐", "一起打扑克牌",
    "一起吃火锅", "一起跳舞", "一起抓娃娃", "一起去海边", "一起捡贝壳", "一起看恐怖片", "一起去鬼屋", "一起画画", "一起看球赛", "一起蹦极",
    "一起做情侣头像", "一起吃冰淇淋", "一起放孔明灯", "一起去寺庙祈福", "一起完成一幅拼图", "一起完成一本相册", "一起看一本书", "把头靠在对方身上玩手机", "一起坐缆车", "一起存钱",
    "一起过七夕", "大方表达爱意", "一起自驾游旅行", "一起去动物园", "一起去海洋公园", "一起看一场演出", "一起去春游", "在朋友面前大方介绍彼此", "一起见对方的朋友", "一起看日出",
    "一起看日落", "拥有一对情侣对戒", "一起拍婚纱照", "专心为对方做一件事", "做一件很不起眼但很用心的事", "一起牵手过马路", "一起爬山", "一起露营看星星", "一起溜冰", "一起打雪仗",
    "一起慢慢变老", "学会十国语言说我爱你", "互赠对方一瓶香水", "一起献血", "一起洗碗", "一起养一只小植物", "一起做一次志愿者", "一起去看一场音乐节", "一起规划一次长途旅行", "一起设想未来的家"
  ];
  const gentleTruthTopics = ["我们第一次聊天", "第一次见面", "第一次牵手", "你对我的第一印象", "最喜欢我的一个瞬间", "最想重温的一次约会", "最想一起去的城市", "最治愈的小事", "我让你安心的地方", "你最想夸我的一件事", "最想被我理解的习惯", "最感谢我陪你的时刻", "想一起养成的习惯", "未来家里最想有的角落", "想和我一起学的技能", "最喜欢我们聊天的时间", "最期待我的一句话", "最喜欢我陪你吃饭的时刻", "最想交换的一天", "最想收藏的照片", "最想和我看的电影", "最适合我们的歌", "最想一起完成的清单", "最想带我认识的人", "最希望我们永远保留的默契"];
  const boldTruthTopics = ["第一次对我心动", "最想对我说却忍住的话", "最想和我单独待着的夜晚", "最希望我主动做的事", "最害羞的一次想法", "最想收到我什么样的称呼", "最想和我尝试的浪漫约会", "最想被我抱住的时刻", "最想偷看我的哪个瞬间", "最想和我在雨里做的小事", "最希望我为你准备的惊喜", "最想和我去的私密约会地点", "最想让我记住的你的样子", "最敢不敢当面夸我的一句话", "最想和我一起熬夜做的事", "最想和我穿情侣装的场合", "最想把我介绍成什么身份", "最想和我一起实现的大胆愿望", "最期待我牵手或抱抱你的方式", "最期待我在你身边做的事", "最想和我分享的秘密", "最想让我们多一点的仪式感", "最想让我带给你的心动", "最想和我挑战的一件事", "最想和我约定的专属暗号"];
  const truthQuestionFrames = [
    (topic) => `关于“${topic}”，你脑海里第一个答案是什么？`, (topic) => `如果只说一句真话，关于“${topic}”你会说什么？`, (topic) => `关于“${topic}”，最难忘的细节是什么？`, (topic) => `关于“${topic}”，你最希望我知道什么？`, (topic) => `关于“${topic}”，你愿意认真讲给我听吗？`,
    (topic) => `关于“${topic}”，你会给它打几分？为什么？`, (topic) => `关于“${topic}”，你最想改变的一点是什么？`, (topic) => `关于“${topic}”，下一次你想怎么做？`, (topic) => `关于“${topic}”，你会把哪个画面留在心里？`, (topic) => `关于“${topic}”，你最想听到我怎么回答？`,
    (topic) => `关于“${topic}”，现在说出来会不会害羞？`, (topic) => `关于“${topic}”，你最想和我一起实现哪个版本？`, (topic) => `关于“${topic}”，你想把它写进我们的回忆录吗？`, (topic) => `关于“${topic}”，你会先告诉谁？`, (topic) => `关于“${topic}”，你觉得我猜得到吗？`,
    (topic) => `关于“${topic}”，你最想让我做的一件事是什么？`, (topic) => `关于“${topic}”，如果只能保留一个细节，会选什么？`, (topic) => `关于“${topic}”，你最想什么时候再经历一次？`, (topic) => `关于“${topic}”，你会用哪三个词形容？`, (topic) => `关于“${topic}”，现在最想对我说什么？`
  ];
  const truthQuestions = shuffleTruthQuestions([
    ...buildTruthQuestions(gentleTruthTopics, "日常"),
    ...buildTruthQuestions(boldTruthTopics, "大胆")
  ]);
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
  const calendarButton = document.querySelector("#calendar-button");
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
  const catFloat = document.querySelector("#cat-float");
  const catMascot = document.querySelector("#cat-mascot");
  const cat3DStage = document.querySelector("#cat-3d-stage");
  const catGrowthLabel = document.querySelector("#cat-growth-label");
  const catBubble = document.querySelector("#cat-bubble");
  const petActionButtons = [...document.querySelectorAll("[data-pet-action]")];
  const petTalkForm = document.querySelector("#pet-talk-form");
  const petTalkInput = document.querySelector("#pet-talk-input");
  const repairForm = document.querySelector("#repair-form");
  const repairTone = document.querySelector("#repair-tone");
  const repairExtra = document.querySelector("#repair-extra");
  const repairResult = document.querySelector("#repair-result");
  const repairCopy = document.querySelector("#repair-copy");
  const repairShare = document.querySelector("#repair-share");
  const repairMoodButtons = [...document.querySelectorAll("[data-repair-mood]")];
  const repairChecklist = [...document.querySelectorAll("[data-repair-check]")];
  const catNameDialog = document.querySelector("#cat-name-dialog");
  const catNameForm = document.querySelector("#cat-name-form");
  const catNameInput = document.querySelector("#cat-name-input");
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
  const anniversaryAdd = document.querySelector("#anniversary-add");
  const anniversaryName = document.querySelector("#anniversary-name");
  const anniversaryDate = document.querySelector("#anniversary-date");
  const anniversaryDateLabel = document.querySelector("#anniversary-date-label");
  const anniversaryHelp = document.querySelector("#anniversary-help");
  const anniversaryError = document.querySelector("#anniversary-error");
  const anniversaryList = document.querySelector("#anniversary-list");
  const thingsList = document.querySelector("#things-list");
  const thingsProgressCount = document.querySelector("#things-progress-count");
  const thingsProgressBar = document.querySelector("#things-progress-bar");
  const thingsProgressFill = document.querySelector("#things-progress-fill");
  const truthWheel = document.querySelector("#truth-wheel");
  const truthNumber = document.querySelector("#truth-number");
  const truthText = document.querySelector("#truth-text");
  const truthSpin = document.querySelector("#truth-spin");
  const diceTable = document.querySelector("#dice-table");
  const diceCup = document.querySelector("#dice-cup");
  const diceCupLabel = document.querySelector("#dice-cup-label");
  const diceValues = document.querySelector("#dice-values");
  const diceStatus = document.querySelector("#dice-status");
  const diceRoll = document.querySelector("#dice-roll");
  const diceNext = document.querySelector("#dice-next");
  const coupleNoteForm = document.querySelector("#couple-note-form");
  const coupleNoteTitle = document.querySelector("#couple-note-title");
  const coupleNoteValue = document.querySelector("#couple-note-value");
  const coupleNoteList = document.querySelector("#couple-note-list");
  const futureLetterForm = document.querySelector("#future-letter-form");
  const futureLetterTitle = document.querySelector("#future-letter-title");
  const futureLetterDate = document.querySelector("#future-letter-date");
  const futureLetterContent = document.querySelector("#future-letter-content");
  const futureLetterList = document.querySelector("#future-letter-list");

  let toastTimer = null;
  let kittyGreetingTimer = null;
  let petActionTimer = null;
  let petAction = "idle";
  let petActionUntil = 0;
  let menuTransitionTimer = null;
  let countdownTimer = null;
  let resizeFrame = null;
  let currentScreen = 0;
  let state = loadState();
  let archiveRecords = loadArchive();
  let anniversaries = loadAnniversaries();
  let completedThings = loadCompletedThings();
  let coupleNotes = loadCoupleNotes();
  let futureLetters = loadFutureLetters();
  let catState = loadCatState();
  let repairState = loadRepairState();
  let catModelRoot = null;
  let archiveReturnScreen = 1;
  let activeMemoryRecordId = "";
  let selectedMood = "";
  let rouletteKind = "";
  let rouletteOptions = [];
  let rouletteIndex = -1;
  let rouletteRotation = 0;
  let rouletteSpinning = false;
  let anniversaryMode = "since";
  let thingsFilter = "all";
  let truthRotation = 0;
  let truthSpinning = false;
  let lastTruthId = "";
  let diceRolling = false;
  let diceLocked = false;
  let diceTimer = null;
  let diceCurrent = [1, 1, 1, 1, 1];
  let diceReadyToReveal = false;
  let diceCupPointerId = null;
  let diceCupStartY = 0;

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

  function backupBeforeSave(reason) {
    try { window.DateInviteBackups?.capture?.(reason); } catch (error) { /* 备份失败不影响正常保存 */ }
  }

  function persistState() {
    backupBeforeSave("约会计划");
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
    backupBeforeSave("回忆与照片");
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
    backupBeforeSave("纪念日");
    try {
      localStorage.setItem(ANNIVERSARY_KEY, JSON.stringify(anniversaries));
    } catch (error) {
      showToast("浏览器未允许保存纪念日");
    }
  }

  function loadCompletedThings() {
    try {
      const saved = JSON.parse(localStorage.getItem(THINGS_KEY) || "[]");
      return new Set(Array.isArray(saved) ? saved.filter((index) => Number.isInteger(index) && index >= 0 && index < hundredThings.length) : []);
    } catch (error) {
      return new Set();
    }
  }

  function persistCompletedThings() {
    backupBeforeSave("100 件事");
    try {
      localStorage.setItem(THINGS_KEY, JSON.stringify([...completedThings]));
    } catch (error) {
      showToast("浏览器未允许保存清单进度");
    }
  }

  function loadCoupleNotes() {
    try {
      const saved = JSON.parse(localStorage.getItem(COUPLE_NOTES_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((item) => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.value === "string").slice(0, 50) : [];
    } catch (error) {
      return [];
    }
  }

  function persistCoupleNotes() {
    backupBeforeSave("情侣密码本");
    try {
      localStorage.setItem(COUPLE_NOTES_KEY, JSON.stringify(coupleNotes));
    } catch (error) {
      showToast("浏览器未允许保存密码本");
    }
  }

  function loadFutureLetters() {
    try {
      const saved = JSON.parse(localStorage.getItem(FUTURE_LETTERS_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((item) => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.content === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.unlockDate)).slice(0, 50) : [];
    } catch (error) {
      return [];
    }
  }

  function persistFutureLetters() {
    backupBeforeSave("给未来的信");
    try {
      localStorage.setItem(FUTURE_LETTERS_KEY, JSON.stringify(futureLetters));
    } catch (error) {
      showToast("浏览器未允许保存未来的信");
    }
  }

  function loadCatState() {
    try {
      const saved = JSON.parse(localStorage.getItem(CAT_KEY) || "null");
      if (!saved || typeof saved !== "object") return { days: 0, streak: 0, lastVisitDate: "", name: "" };
      return {
        days: Number.isInteger(saved.days) && saved.days >= 0 ? saved.days : 0,
        streak: Number.isInteger(saved.streak) && saved.streak >= 0 ? saved.streak : 0,
        lastVisitDate: /^\d{4}-\d{2}-\d{2}$/.test(saved.lastVisitDate || "") ? saved.lastVisitDate : "",
        name: typeof saved.name === "string" ? saved.name.trim().slice(0, 12) : ""
      };
    } catch (error) {
      return { days: 0, streak: 0, lastVisitDate: "", name: "" };
    }
  }

  function persistCatState() {
    try {
      localStorage.setItem(CAT_KEY, JSON.stringify(catState));
    } catch (error) {
      // The mascot remains usable even if browser storage is unavailable.
    }
  }

  function loadRepairState() {
    const fallback = { mood: "委屈", tone: "认真道歉", extra: "", message: "", checked: [] };
    try {
      const saved = JSON.parse(localStorage.getItem(REPAIR_KEY) || "null");
      if (!saved || typeof saved !== "object") return fallback;
      return {
        mood: typeof saved.mood === "string" ? saved.mood : fallback.mood,
        tone: typeof saved.tone === "string" ? saved.tone : fallback.tone,
        extra: typeof saved.extra === "string" ? saved.extra.slice(0, 180) : "",
        message: typeof saved.message === "string" ? saved.message.slice(0, 600) : "",
        checked: Array.isArray(saved.checked) ? saved.checked.filter((item) => typeof item === "string").slice(0, 12) : [],
      };
    } catch (error) {
      return fallback;
    }
  }

  function persistRepairState() {
    backupBeforeSave("和好小屋");
    try {
      localStorage.setItem(REPAIR_KEY, JSON.stringify(repairState));
    } catch (error) {
      showToast("浏览器暂时不能保存和好内容");
    }
  }

  function recordCatVisit() {
    const today = getToday();
    if (catState.lastVisitDate === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    catState.streak = catState.lastVisitDate === localDateString(yesterday) ? catState.streak + 1 : 1;
    catState.days += 1;
    catState.lastVisitDate = today;
    persistCatState();
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
    if (catMascot) {
      recordCatVisit();
      updateCatMascot();
      initializeCatModel();
    }
    renderRepairState();
    window.setInterval(updateHomeCountdown, 60000);

    document.querySelector(".home-plan").addEventListener("click", () => showScreen(1));
    document.querySelector(".anniversary-open").addEventListener("click", () => showScreen(9));
    document.querySelector(".things-open").addEventListener("click", () => showScreen(10));
    document.querySelector(".game-open").addEventListener("click", () => showScreen(11));
    document.querySelector(".keepsakes-open").addEventListener("click", () => showScreen(14));
    document.querySelector(".couple-book-open").addEventListener("click", () => showScreen(15));
    document.querySelector(".future-letter-open").addEventListener("click", () => showScreen(16));
    document.querySelector(".pet-open")?.addEventListener("click", () => showScreen(17));
    document.querySelector(".repair-open")?.addEventListener("click", () => showScreen(18));
    catMascot?.addEventListener("click", (event) => {
      if (catMascot.dataset.dragged === "true") {
        catMascot.dataset.dragged = "";
        event.preventDefault();
        return;
      }
      openCatConversation();
    });
    petActionButtons.forEach((button) => button.addEventListener("click", () => triggerPetAction(button.dataset.petAction)));
    petTalkForm?.addEventListener("submit", submitPetTalk);
    repairForm?.addEventListener("submit", generateRepairMessage);
    repairMoodButtons.forEach((button) => button.addEventListener("click", () => {
      repairState.mood = button.dataset.repairMood || "委屈";
      persistRepairState();
      renderRepairState();
    }));
    repairTone?.addEventListener("change", () => {
      repairState.tone = repairTone.value;
      persistRepairState();
    });
    repairExtra?.addEventListener("input", () => {
      repairState.extra = repairExtra.value.slice(0, 180);
      persistRepairState();
    });
    repairChecklist.forEach((checkbox) => checkbox.addEventListener("change", () => {
      repairState.checked = repairChecklist.filter((item) => item.checked).map((item) => item.value);
      persistRepairState();
    }));
    repairCopy?.addEventListener("click", () => copyRepairMessage());
    repairShare?.addEventListener("click", () => shareRepairMessage());
    catNameForm?.addEventListener("submit", saveCatName);
    document.querySelector(".truth-open").addEventListener("click", () => showScreen(12));
    document.querySelector(".dice-open").addEventListener("click", () => showScreen(13));
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
    calendarButton.addEventListener("click", addPlanToCalendar);

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
    anniversaryAdd.addEventListener("click", toggleAnniversaryForm);
    document.querySelectorAll("[data-anniversary-mode]").forEach((button) => button.addEventListener("click", () => setAnniversaryMode(button.dataset.anniversaryMode)));
    document.querySelectorAll("[data-thing-filter]").forEach((button) => button.addEventListener("click", () => setThingsFilter(button.dataset.thingFilter)));
    truthSpin.addEventListener("click", spinTruth);
    diceRoll.addEventListener("click", rollDice);
    diceCup.addEventListener("pointerdown", startDiceCupSwipe);
    diceCup.addEventListener("pointermove", moveDiceCupSwipe);
    diceCup.addEventListener("pointerup", finishDiceCupSwipe);
    diceCup.addEventListener("pointercancel", cancelDiceCupSwipe);
    diceCup.addEventListener("keydown", handleDiceCupKeydown);
    diceNext.addEventListener("click", resetDiceRound);
    coupleNoteForm.addEventListener("submit", addCoupleNote);
    futureLetterForm.addEventListener("submit", addFutureLetter);

    window.addEventListener("shared-sync-applied", () => {
      // 共享房间收到另一台设备的数据后，重新读取本机镜像并刷新当前视图。
      state = loadState();
      archiveRecords = loadArchive();
      anniversaries = loadAnniversaries();
      completedThings = loadCompletedThings();
      coupleNotes = loadCoupleNotes();
      futureLetters = loadFutureLetters();
      catState = loadCatState();
      repairState = loadRepairState();
      syncActivitySelection();
      syncFoodSelection();
      updateHomeCountdown();
      if (catMascot) updateCatMascot();
      if (currentScreen === 3) {
        dateInput.min = getToday();
        dateInput.value = state.date;
        timeInput.value = state.time;
        locationInput.value = state.location;
      } else if (currentScreen === 4) syncActivitySelection();
      else if (currentScreen === 5) syncFoodSelection();
      else if (currentScreen === 6) updateResult();
      else if (currentScreen === 7) renderArchive();
      else if (currentScreen === 9) renderAnniversaries();
      else if (currentScreen === 10) renderThings();
      else if (currentScreen === 15) renderCoupleNotes();
      else if (currentScreen === 16) renderFutureLetters();
      else if (currentScreen === 18) renderRepairState();
    });

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

    // The pet theme can be omitted from the HTML without leaving a dead route.
    if (screenNumber === 17 && !catMascot) screenNumber = 0;

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
    document.body.classList.toggle("is-pet-screen", screenNumber === 17 && Boolean(catFloat));
    if (catFloat) catFloat.hidden = screenNumber !== 17;

    if (screenNumber === 0) {
      updateHomeCountdown();
      if (catMascot) updateCatMascot();
    }
    if (screenNumber === 1) resetInvitationButtons();
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
    if (screenNumber === 10) renderThings();
    if (screenNumber === 12) drawTruthWheel();
    if (screenNumber === 13) renderDice(diceCurrent);
    if (screenNumber === 15) renderCoupleNotes();
    if (screenNumber === 16) {
      futureLetterDate.min = getToday();
      if (!futureLetterDate.value) futureLetterDate.value = getTomorrow();
      renderFutureLetters();
    }
    if (screenNumber === 17 && catMascot) updateCatMascot();

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

  function resetInvitationButtons() {
    state.dodgeCount = 0;
    state.currentCorner = "";
    actionZone.classList.remove("is-active", "is-priming");
    [yesButton, noButton].forEach((button) => {
      button.style.removeProperty("left");
      button.style.removeProperty("top");
      button.style.removeProperty("transform");
    });
    noButton.textContent = noLabels[0];
    movementStatus.textContent = "";
    persistState();
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

  function buildTruthQuestions(topics, type) {
    return topics.flatMap((topic, topicIndex) => truthQuestionFrames.map((frame, frameIndex) => ({
      id: `${type}-${topicIndex}-${frameIndex}`,
      type,
      text: frame(topic)
    })));
  }

  function shuffleTruthQuestions(questions) {
    const result = [...questions];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function drawTruthWheel() {
    const context = truthWheel.getContext("2d");
    if (!context) return;
    const size = truthWheel.width;
    const center = size / 2;
    const radius = center - 10;
    const labels = ["真心话", "认真回答", "大胆一点", "只说实话", "有问必答", "悄悄说", "勇敢说", "心动题"];
    const colors = ["#eadcf6", "#ffe1e7", "#d8f0e8", "#ffedb0", "#dbeaf8", "#f7d8df", "#d9f1e8", "#ffe6c9"];
    const slice = Math.PI * 2 / labels.length;
    context.clearRect(0, 0, size, size);
    labels.forEach((label, index) => {
      const start = -Math.PI / 2 + index * slice;
      const middle = start + slice / 2;
      context.beginPath();
      context.moveTo(center, center);
      context.arc(center, center, radius, start, start + slice);
      context.closePath();
      context.fillStyle = colors[index];
      context.fill();
      context.strokeStyle = "#49323a";
      context.lineWidth = 3;
      context.stroke();
      context.save();
      context.translate(center + Math.cos(middle) * radius * 0.63, center + Math.sin(middle) * radius * 0.63);
      context.rotate(middle + Math.PI / 2);
      context.fillStyle = "#49323a";
      context.font = '800 26px "Microsoft YaHei", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, 0, 0);
      context.restore();
    });
    context.beginPath();
    context.arc(center, center, 42, 0, Math.PI * 2);
    context.fillStyle = "#a877c7";
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

  function spinTruth() {
    if (truthSpinning) return;
    truthSpinning = true;
    truthSpin.disabled = true;
    truthText.textContent = "等转盘停下，这一次要认真回答。";
    truthNumber.textContent = "正在从 1,000 个问题里抽取…";
    const choices = truthQuestions.filter((question) => question.id !== lastTruthId);
    const question = choices[Math.floor(Math.random() * choices.length)];
    const target = -(Math.floor(Math.random() * 8) + 0.5) * 45;
    const current = ((truthRotation % 360) + 360) % 360;
    truthRotation += 5 * 360 + ((target - current + 360) % 360);
    truthWheel.style.transform = `rotate(${truthRotation}deg)`;
    setTimeout(() => {
      truthSpinning = false;
      lastTruthId = question.id;
      truthNumber.textContent = `第 ${truthQuestions.indexOf(question) + 1} / 1000 题`;
      truthText.textContent = question.text;
      truthSpin.disabled = false;
      truthSpin.textContent = "再转一个问题";
      truthSpin.focus();
    }, 2860);
  }

  function renderDice(values, rolling = false) {
    const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    diceValues.replaceChildren();
    values.forEach((value, index) => {
      const face = document.createElement("span");
      face.className = `dice-face${rolling ? " is-rolling" : ""}`;
      face.style.setProperty("--roll-index", String(index));
      face.textContent = faces[value - 1];
      face.setAttribute("aria-label", `${value} 点`);
      diceValues.append(face);
    });
  }

  function rollDiceWithMatch() {
    let values;
    do {
      values = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
    } while (new Set(values).size === 5);
    return values;
  }

  function rollDice() {
    if (diceRolling || diceLocked) return;
    diceRolling = true;
    diceReadyToReveal = false;
    diceRoll.disabled = true;
    diceNext.disabled = true;
    diceStatus.textContent = "骰盅摇起来了…";
    diceTable.classList.remove("is-open");
    diceTable.classList.add("is-covered", "is-shaking");
    diceCup.disabled = true;
    diceCupLabel.textContent = "正在摇骰子";
    if (diceTimer) clearInterval(diceTimer);
    diceTimer = setInterval(() => renderDice(Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1), true), 100);
    setTimeout(() => {
      if (diceTimer) clearInterval(diceTimer);
      diceTimer = null;
      diceCurrent = rollDiceWithMatch();
      diceRolling = false;
      renderDice(diceCurrent);
      diceReadyToReveal = true;
      diceTable.classList.remove("is-shaking");
      diceCup.disabled = false;
      diceCupLabel.textContent = "向上滑掀开骰盅";
      diceCup.setAttribute("aria-label", "向上滑掀开骰盅查看骰子");
      diceStatus.textContent = "骰子已经摇好，在骰盅上向上滑掀开看看。";
      diceRoll.textContent = "等待开盅";
    }, 900);
  }

  function revealDice() {
    if (!diceReadyToReveal || diceRolling) return;
    if (diceTable.classList.contains("is-open")) {
      diceTable.classList.remove("is-open");
      diceTable.classList.add("is-covered");
      diceCupLabel.textContent = "向上滑再次掀开";
      diceCup.setAttribute("aria-label", "向上滑再次掀开骰盅查看骰子");
      diceStatus.textContent = "骰盅已经合上了，想看时可以再掀开。";
      return;
    }
    diceTable.classList.remove("is-covered");
    diceTable.classList.add("is-open");
    diceCupLabel.textContent = "向下滑合上骰盅";
    diceCup.setAttribute("aria-label", "向下滑合上骰盅");
    diceLocked = true;
    diceStatus.textContent = `本局点数：${diceCurrent.join("、")}，已经锁住。`;
    diceRoll.textContent = "本局已锁定";
    diceNext.disabled = false;
  }

  function startDiceCupSwipe(event) {
    if (diceCup.disabled || diceRolling || !diceReadyToReveal) return;
    diceCupPointerId = event.pointerId;
    diceCupStartY = event.clientY;
    diceCup.classList.add("is-dragging");
    diceCup.setPointerCapture?.(event.pointerId);
  }

  function moveDiceCupSwipe(event) {
    if (event.pointerId !== diceCupPointerId) return;
    const delta = Math.max(-90, Math.min(90, event.clientY - diceCupStartY));
    diceCup.style.setProperty("--cup-drag-y", `${delta}px`);
  }

  function finishDiceCupSwipe(event) {
    if (event.pointerId !== diceCupPointerId) return;
    const delta = event.clientY - diceCupStartY;
    const isOpen = diceTable.classList.contains("is-open");
    cancelDiceCupSwipe(event);
    if ((!isOpen && delta < -38) || (isOpen && delta > 38)) revealDice();
  }

  function cancelDiceCupSwipe(event) {
    if (event.pointerId !== diceCupPointerId) return;
    diceCupPointerId = null;
    diceCup.classList.remove("is-dragging");
    diceCup.style.removeProperty("--cup-drag-y");
  }

  function handleDiceCupKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    revealDice();
  }

  function resetDiceRound() {
    if (diceRolling) return;
    diceLocked = false;
    diceReadyToReveal = false;
    diceCurrent = [1, 1, 1, 1, 1];
    renderDice(diceCurrent);
    diceTable.classList.remove("is-open", "is-shaking");
    diceTable.classList.add("is-covered");
    diceCup.disabled = true;
    diceCupLabel.textContent = "摇骰子后向上滑";
    diceCup.setAttribute("aria-label", "向上滑掀开骰盅查看骰子");
    diceStatus.textContent = "新的一局准备好了，只能摇一次。";
    diceRoll.disabled = false;
    diceRoll.textContent = "摇骰子";
    diceNext.disabled = true;
  }

  function setThingsFilter(filter) {
    thingsFilter = ["all", "todo", "done"].includes(filter) ? filter : "all";
    renderThings();
  }

  function renderThings() {
    const completedCount = completedThings.size;
    thingsProgressCount.textContent = `${completedCount} / ${hundredThings.length}`;
    thingsProgressBar.setAttribute("aria-valuenow", String(completedCount));
    thingsProgressFill.style.width = `${completedCount}%`;
    document.querySelectorAll("[data-thing-filter]").forEach((button) => {
      const selected = button.dataset.thingFilter === thingsFilter;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    thingsList.replaceChildren();
    const visibleThings = hundredThings.map((text, index) => ({ text, index })).filter((item) => thingsFilter === "all" || (thingsFilter === "done" ? completedThings.has(item.index) : !completedThings.has(item.index)));
    if (!visibleThings.length) {
      const empty = document.createElement("li");
      empty.className = "things-empty";
      empty.textContent = thingsFilter === "done" ? "还没有完成的项目，慢慢来。" : "这一页已经全部完成啦。";
      thingsList.append(empty);
      return;
    }
    visibleThings.forEach((item) => {
      const done = completedThings.has(item.index);
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = `thing-item${done ? " is-done" : ""}`;
      button.setAttribute("aria-pressed", String(done));
      button.setAttribute("aria-label", `第 ${item.index + 1} 件：${item.text}，${done ? "已完成，点击取消" : "未完成，点击标记完成"}`);
      const number = document.createElement("span");
      number.className = "thing-number";
      number.textContent = String(item.index + 1).padStart(2, "0");
      const label = document.createElement("span");
      label.className = "thing-label";
      label.textContent = item.text;
      const check = document.createElement("span");
      check.className = "thing-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      button.append(number, label, check);
      button.addEventListener("click", () => toggleThing(item.index));
      row.append(button);
      thingsList.append(row);
    });
  }

  function toggleThing(index) {
    if (completedThings.has(index)) completedThings.delete(index);
    else completedThings.add(index);
    persistCompletedThings();
    renderThings();
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
    anniversaryForm.hidden = true;
    renderAnniversaries();
    showToast("纪念日已经收好啦");
  }

  function toggleAnniversaryForm() {
    anniversaryForm.hidden = !anniversaryForm.hidden;
    if (!anniversaryForm.hidden) {
      setAnniversaryMode(anniversaryMode);
      requestAnimationFrame(() => anniversaryName.focus());
    }
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

  function addCoupleNote(event) {
    event.preventDefault();
    const title = coupleNoteTitle.value.trim();
    const value = coupleNoteValue.value.trim();
    if (!title || !value) return;
    coupleNotes.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, value, createdAt: Date.now() });
    persistCoupleNotes();
    coupleNoteForm.reset();
    renderCoupleNotes();
    showToast("已经收进情侣密码本");
  }

  function renderCoupleNotes() {
    coupleNoteList.replaceChildren();
    if (!coupleNotes.length) {
      const empty = document.createElement("p");
      empty.className = "keepsake-empty";
      empty.textContent = "先从对方最喜欢的一样东西开始记吧。";
      coupleNoteList.append(empty);
      return;
    }
    coupleNotes.sort((a, b) => b.createdAt - a.createdAt).forEach((item) => {
      const card = document.createElement("article");
      card.className = "keepsake-item note-item";
      const heading = document.createElement("strong");
      heading.textContent = item.title;
      const body = document.createElement("p");
      body.textContent = item.value;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "keepsake-delete";
      remove.textContent = "删除";
      remove.setAttribute("aria-label", `删除${item.title}`);
      remove.addEventListener("click", () => deleteCoupleNote(item.id));
      card.append(heading, body, remove);
      coupleNoteList.append(card);
    });
  }

  function deleteCoupleNote(id) {
    if (!window.confirm("确定删除这一条吗？")) return;
    coupleNotes = coupleNotes.filter((item) => item.id !== id);
    persistCoupleNotes();
    renderCoupleNotes();
  }

  function addFutureLetter(event) {
    event.preventDefault();
    const title = futureLetterTitle.value.trim();
    const content = futureLetterContent.value.trim();
    const unlockDate = futureLetterDate.value;
    if (!title || !content || !/^\d{4}-\d{2}-\d{2}$/.test(unlockDate)) return;
    futureLetters.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, content, unlockDate, createdAt: Date.now() });
    persistFutureLetters();
    futureLetterForm.reset();
    futureLetterDate.value = getTomorrow();
    renderFutureLetters();
    showToast("这封信已经封好啦");
  }

  function renderFutureLetters() {
    const today = getToday();
    futureLetterList.replaceChildren();
    if (!futureLetters.length) {
      const empty = document.createElement("p");
      empty.className = "keepsake-empty";
      empty.textContent = "写一封给未来的信，等特别的日子再打开。";
      futureLetterList.append(empty);
      return;
    }
    futureLetters.sort((a, b) => a.unlockDate.localeCompare(b.unlockDate)).forEach((letter) => {
      const isOpen = letter.unlockDate <= today;
      const card = document.createElement("article");
      card.className = `keepsake-item letter-item${isOpen ? " is-open" : " is-locked"}`;
      const meta = document.createElement("p");
      meta.className = "letter-meta";
      meta.textContent = isOpen ? `已在 ${formatDateForDisplay(letter.unlockDate)} 解锁` : `将在 ${formatDateForDisplay(letter.unlockDate)} 打开`;
      const heading = document.createElement("strong");
      heading.textContent = letter.title;
      const body = document.createElement("p");
      body.className = "letter-body";
      body.textContent = isOpen ? letter.content : "这封信还在等未来的你们。";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "keepsake-delete";
      remove.textContent = "删除";
      remove.setAttribute("aria-label", `删除${letter.title}`);
      remove.addEventListener("click", () => deleteFutureLetter(letter.id));
      card.append(meta, heading, body, remove);
      futureLetterList.append(card);
    });
  }

  function deleteFutureLetter(id) {
    if (!window.confirm("确定删除这封信吗？")) return;
    futureLetters = futureLetters.filter((item) => item.id !== id);
    persistFutureLetters();
    renderFutureLetters();
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

  function getCatName() {
    return "乔巴";
  }

  function openCatConversation() {
    const choices = ["greet", "cross", "happy"];
    triggerPetAction(choices[Math.floor(Math.random() * choices.length)]);
  }

  function petActionMessage(action) {
    return {
      greet: "乔巴举起小手和你打招呼：今天也要一起开心呀！",
      cross: "乔巴双手抱胸认真点头：我会把你们的约会计划记好的！",
      happy: "乔巴开心地举起双手：耶！下一次见面一定会很棒！",
    }[action] || "乔巴眨眨眼，安静地陪着你。";
  }

  function triggerPetAction(action = "greet", message = "") {
    if (!catMascot || !catBubble) return;
    const available = new Set(["greet", "cross", "happy"]);
    petAction = available.has(action) ? action : "greet";
    petActionUntil = Date.now() + 2100;
    if (petActionTimer) clearTimeout(petActionTimer);
    catMascot.dataset.petAction = petAction;
    catMascot.classList.add("is-chatting");
    catBubble.textContent = message || petActionMessage(petAction);
    petActionButtons.forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.petAction === petAction ? "true" : "false");
    });
    petActionTimer = setTimeout(() => {
      petAction = "idle";
      petActionUntil = 0;
      catMascot.dataset.petAction = "idle";
      catMascot.classList.remove("is-chatting");
      petActionButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
      petActionTimer = null;
    }, 2200);
  }

  function getChopperReply(message) {
    const text = String(message || "").trim();
    const next = archiveRecords.filter((record) => formatRecordTime(record) > Date.now()).sort((a, b) => formatRecordTime(a) - formatRecordTime(b))[0];
    if (/你好|嗨|哈喽|乔巴/.test(text)) return { action: "greet", text: "你好呀！乔巴已经听见你啦，今天也要记得开心。" };
    if (/想你|喜欢|爱你|想念/.test(text)) return { action: "happy", text: "我也会把这句话收好，陪你们一直期待下一次见面。" };
    if (/约会|见面|什么时候|倒计时/.test(text) && next) return { action: "greet", text: `我查到啦：${getCountdownText(next)}，${formatDateForDisplay(next.date)}见！` };
    if (/吃|美食|餐|火锅|烤肉/.test(text)) return { action: "happy", text: `下次可以吃${next?.menu || "你们最喜欢的东西"}，我负责在旁边加油！` };
    if (/玩|去哪|活动|电影|散步|游乐园/.test(text)) return { action: "happy", text: `那就安排${next?.activity || "一个让你们都开心的活动"}，听起来就很棒！` };
    if (/谢谢|辛苦/.test(text)) return { action: "cross", text: "不用谢！乔巴会一直守护你们的小日子。" };
    return { action: "greet", text: `乔巴听到了：“${text.slice(0, 40)}”。再和我说一点嘛！` };
  }

  function submitPetTalk(event) {
    event.preventDefault();
    const message = petTalkInput.value.trim().slice(0, 80);
    if (!message) {
      petTalkInput.focus();
      return;
    }
    const reply = getChopperReply(message);
    triggerPetAction(reply.action, reply.text);
    petTalkInput.value = "";
  }

  const repairTemplates = {
    "委屈": [
      "我刚才让你觉得不被理解，对不起。你愿意的话，我想先听你说完。",
      "我在乎你的感受，今天先不争对错，给我一次好好抱抱你的机会。",
    ],
    "生气": [
      "你生气一定有原因，我不急着解释，先认真听你说。对不起让你难受了。",
      "我知道一句对不起不能马上把委屈变走，但我愿意留下来把这件事好好说清楚。",
    ],
    "难过": [
      "我看到你难过了，真的很心疼。你不用马上原谅我，我会陪你把话说完。",
      "先把难过交给我一会儿，好吗？我会认真记住你的感受，也会把能改的地方改好。",
    ],
    "我也有错": [
      "这次我也有没做好的地方：___。我愿意改，也想听听你希望我怎么做。",
      "我不想把责任推给任何人，这件事我会认真反省。___，对不起，请给我一次补救的机会。",
    ],
  };

  function buildRepairMessage() {
    const mood = repairState.mood || "委屈";
    const tone = repairState.tone || "认真道歉";
    const options = repairTemplates[mood] || repairTemplates["委屈"];
    let message = options[Math.floor(Math.random() * options.length)];
    const extra = repairState.extra.trim();
    if (message.includes("___")) message = message.replace("___", extra || "我刚才没有好好顾及你的感受");
    else if (extra) message += ` 我还想补充：${extra}`;
    const endings = {
      "认真道歉": "我不求你立刻消气，只希望你知道，我真的在乎你。",
      "可爱撒娇": "给我一个补救的机会嘛，我会乖乖听话的。",
      "温柔解释": "等你愿意的时候，我们慢慢说，我会把你放在心上。",
      "给她一点空间": "你可以先照顾好自己的心情，我会在这里等你，不催你。",
    };
    return `${message} ${endings[tone] || endings["认真道歉"]}`;
  }

  function renderRepairState() {
    repairMoodButtons.forEach((button) => button.setAttribute("aria-pressed", button.dataset.repairMood === repairState.mood ? "true" : "false"));
    if (repairTone) repairTone.value = repairState.tone || "认真道歉";
    if (repairExtra) repairExtra.value = repairState.extra || "";
    repairChecklist.forEach((checkbox) => {
      checkbox.checked = repairState.checked.includes(checkbox.value);
    });
    if (repairResult) repairResult.textContent = repairState.message || "选一个她现在的心情，我来帮你组织第一句话。";
  }

  function generateRepairMessage(event) {
    event?.preventDefault();
    repairState.tone = repairTone?.value || "认真道歉";
    repairState.extra = repairExtra?.value.trim().slice(0, 180) || "";
    repairState.message = buildRepairMessage();
    repairState.updatedAt = Date.now();
    persistRepairState();
    renderRepairState();
    showToast("已经帮你把第一句话写好了");
  }

  async function copyRepairMessage() {
    const message = repairState.message || buildRepairMessage();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(message);
      showToast("这句话已复制，可以发给她了");
    } catch (error) {
      try {
        const helper = document.createElement("textarea");
        helper.value = message;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.append(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
        showToast("这句话已复制，可以发给她了");
      } catch (copyError) {
        showToast("暂时无法自动复制，请长按文字复制");
      }
    }
  }

  async function shareRepairMessage() {
    const message = repairState.message || buildRepairMessage();
    try {
      if (navigator.share) {
        await navigator.share({ title: "给她的一句话", text: message });
        return;
      }
      await copyRepairMessage();
    } catch (error) {
      // Sharing can be cancelled by the user; keep the generated text visible.
    }
  }

  function saveCatName(event) {
    event.preventDefault();
    if (!catNameInput || !catNameDialog) return;
    const name = catNameInput.value.trim().slice(0, 12);
    if (!name) {
      catNameInput.focus();
      return;
    }
    catState.name = name;
    persistCatState();
    catNameDialog.close();
    updateCatMascot();
    chatWithCat();
  }

  function initializeCatModel() {
    if (!cat3DStage || !window.THREE || !catMascot) return;
    catMascot.classList.remove("is-2d-ready");

    try {
      const Three = window.THREE;
      const scene = new Three.Scene();
      const camera = new Three.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 0.04, 8.35);
      camera.lookAt(0, 0.04, 0);
      const renderer = new Three.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputEncoding = Three.sRGBEncoding;
      renderer.toneMapping = Three.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = Three.PCFSoftShadowMap;
      cat3DStage.appendChild(renderer.domElement);

      const fur = new Three.MeshPhysicalMaterial({ color: 0xd39a5d, roughness: 0.45, clearcoat: 0.12 });
      const furLight = new Three.MeshPhysicalMaterial({ color: 0xf1c080, roughness: 0.4, clearcoat: 0.14 });
      const furCream = new Three.MeshPhysicalMaterial({ color: 0xffd49b, roughness: 0.42, clearcoat: 0.12 });
      const hatRed = new Three.MeshPhysicalMaterial({ color: 0xd93842, roughness: 0.32, clearcoat: 0.28, clearcoatRoughness: 0.22 });
      const hatDark = new Three.MeshPhysicalMaterial({ color: 0xb62436, roughness: 0.38, clearcoat: 0.2 });
      const shirt = new Three.MeshPhysicalMaterial({ color: 0x252735, roughness: 0.48, clearcoat: 0.08 });
      const shorts = new Three.MeshPhysicalMaterial({ color: 0xf4f1e9, roughness: 0.52, clearcoat: 0.1 });
      const hoof = new Three.MeshPhysicalMaterial({ color: 0x40373c, roughness: 0.38, clearcoat: 0.18 });
      const antler = new Three.MeshPhysicalMaterial({ color: 0xb47a36, roughness: 0.5, clearcoat: 0.08 });
      const eye = new Three.MeshPhysicalMaterial({ color: 0x2a1f2b, roughness: 0.3, clearcoat: 0.25 });
      const eyeShine = new Three.MeshBasicMaterial({ color: 0xffffff });
      const nose = new Three.MeshPhysicalMaterial({ color: 0x234da5, roughness: 0.25, clearcoat: 0.32 });
      const cheek = new Three.MeshPhysicalMaterial({ color: 0xf28a84, roughness: 0.5, transparent: true, opacity: 0.58, depthWrite: false });
      const starMat = new Three.MeshPhysicalMaterial({ color: 0xffd32f, roughness: 0.32, clearcoat: 0.22 });
      const root = new Three.Group();
      root.name = "Chopper articulated root";
      scene.add(root);

      const addSphere = (parent, position, scale, material) => {
        const mesh = new Three.Mesh(new Three.SphereGeometry(1, 36, 24), material);
        mesh.position.set(...position);
        mesh.scale.set(...scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
      };
      const addBox = (parent, position, scale, material, rotation = [0, 0, 0]) => {
        const mesh = new Three.Mesh(new Three.BoxGeometry(1, 1, 1), material);
        mesh.position.set(...position);
        mesh.scale.set(...scale);
        mesh.rotation.set(...rotation);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
      };
      const addCapsule = (parent, position, radius, length, material) => {
        const capsule = new Three.Group();
        capsule.position.set(...position);
        const cylinder = new Three.Mesh(new Three.CylinderGeometry(radius, radius * 1.03, length, 24), material);
        cylinder.castShadow = true;
        cylinder.receiveShadow = true;
        capsule.add(cylinder);
        addSphere(capsule, [0, length / 2, 0], [radius, radius, radius], material);
        addSphere(capsule, [0, -length / 2, 0], [radius * 1.03, radius * 1.03, radius * 1.03], material);
        parent.add(capsule);
        return capsule;
      };
      const addTube = (parent, points, radius, material) => {
        const curve = new Three.CatmullRomCurve3(points);
        const mesh = new Three.Mesh(new Three.TubeGeometry(curve, 20, radius, 8, false), material);
        mesh.castShadow = true;
        parent.add(mesh);
        return mesh;
      };
      const addExtrudedShape = (parent, shape, depth, material, position) => {
        const geometry = new Three.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelSegments: 3,
          bevelSize: 0.025,
          bevelThickness: 0.025,
          curveSegments: 12,
        });
        geometry.center();
        const mesh = new Three.Mesh(geometry, material);
        mesh.position.set(...position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
      };

      // Body, shirt emblem, shorts and hooves.
      const body = new Three.Group();
      body.name = "Chopper body";
      root.add(body);
      addSphere(body, [0, -0.52, 0], [0.78, 0.8, 0.52], shirt);
      addSphere(body, [0, -1.05, 0], [0.74, 0.36, 0.5], shorts);
      const star = new Three.Shape();
      for (let i = 0; i < 10; i += 1) {
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        const radius = i % 2 === 0 ? 0.24 : 0.105;
        const point = [Math.cos(angle) * radius, Math.sin(angle) * radius];
        if (i === 0) star.moveTo(...point); else star.lineTo(...point);
      }
      star.closePath();
      addExtrudedShape(body, star, 0.08, starMat, [0, -0.54, 0.51]);
      const leftLeg = new Three.Group();
      const rightLeg = new Three.Group();
      leftLeg.position.set(-0.33, -1.2, 0.02);
      rightLeg.position.set(0.33, -1.2, 0.02);
      addCapsule(leftLeg, [0, -0.29, 0], 0.12, 0.42, furLight);
      addCapsule(rightLeg, [0, -0.29, 0], 0.12, 0.42, furLight);
      addSphere(leftLeg, [0, -0.57, 0.13], [0.19, 0.1, 0.29], hoof);
      addSphere(rightLeg, [0, -0.57, 0.13], [0.19, 0.1, 0.29], hoof);
      root.add(leftLeg, rightLeg);

      // Head rig: hat, antlers, ears and face move together, while the root stays planted.
      const headRig = new Three.Group();
      headRig.name = "Chopper head rig";
      headRig.position.set(0, 0.48, 0);
      root.add(headRig);
      addSphere(headRig, [0, 0.18, 0], [1.08, 0.82, 0.72], furLight);
      addSphere(headRig, [-0.82, 0.12, -0.02], [0.25, 0.34, 0.24], fur);
      addSphere(headRig, [0.82, 0.12, -0.02], [0.25, 0.34, 0.24], fur);
      addSphere(headRig, [-0.43, 0.11, 0.68], [0.1, 0.17, 0.055], eye);
      addSphere(headRig, [0.43, 0.11, 0.68], [0.1, 0.17, 0.055], eye);
      addSphere(headRig, [-0.4, 0.2, 0.735], [0.026, 0.042, 0.014], eyeShine);
      addSphere(headRig, [0.46, 0.2, 0.735], [0.026, 0.042, 0.014], eyeShine);
      addSphere(headRig, [0, -0.02, 0.73], [0.15, 0.11, 0.07], nose);
      addSphere(headRig, [-0.64, -0.04, 0.62], [0.16, 0.09, 0.035], cheek);
      addSphere(headRig, [0.64, -0.04, 0.62], [0.16, 0.09, 0.035], cheek);
      addTube(headRig, [
        new Three.Vector3(-0.08, -0.18, 0.71),
        new Three.Vector3(0, -0.23, 0.73),
        new Three.Vector3(0.08, -0.18, 0.71),
      ], 0.018, eye);

      const hat = new Three.Group();
      hat.name = "Chopper red hat";
      hat.position.set(0, 0.72, 0);
      const hatBody = new Three.Mesh(new Three.CylinderGeometry(0.72, 0.93, 0.76, 40), hatRed);
      hatBody.position.y = 0.35;
      hatBody.rotation.z = -0.04;
      hatBody.castShadow = true;
      hatBody.receiveShadow = true;
      hat.add(hatBody);
      const hatBrim = new Three.Mesh(new Three.TorusGeometry(0.91, 0.105, 12, 48), hatRed);
      hatBrim.rotation.x = Math.PI / 2;
      hatBrim.position.set(0, -0.02, 0.02);
      hatBrim.castShadow = true;
      hat.add(hatBrim);
      addBox(hat, [0, 0.38, 0.69], [0.16, 0.43, 0.055], eyeShine);
      addBox(hat, [0, 0.38, 0.7], [0.43, 0.16, 0.06], eyeShine);
      headRig.add(hat);

      const addAntler = (side) => {
        const antlerRig = new Three.Group();
        antlerRig.position.set(side * 0.78, 0.62, -0.04);
        antlerRig.rotation.z = side * 0.12;
        addCapsule(antlerRig, [0, 0.28, 0], 0.095, 0.46, antler);
        const branchOne = new Three.Group();
        branchOne.position.set(side * 0.03, 0.46, 0);
        branchOne.rotation.z = side * 0.76;
        addCapsule(branchOne, [0, 0.19, 0], 0.075, 0.3, antler);
        antlerRig.add(branchOne);
        const branchTwo = new Three.Group();
        branchTwo.position.set(side * 0.02, 0.31, 0);
        branchTwo.rotation.z = -side * 0.9;
        addCapsule(branchTwo, [0, 0.16, 0], 0.07, 0.25, antler);
        antlerRig.add(branchTwo);
        headRig.add(antlerRig);
      };
      addAntler(-1);
      addAntler(1);

      // Independent arm rigs allow greetings and the crossed-arm pose without rotating the whole character.
      const leftArm = new Three.Group();
      const rightArm = new Three.Group();
      leftArm.name = "Chopper left arm";
      rightArm.name = "Chopper right arm";
      leftArm.position.set(-0.72, -0.43, 0.12);
      rightArm.position.set(0.72, -0.43, 0.12);
      leftArm.rotation.z = -0.45;
      rightArm.rotation.z = 0.45;
      addSphere(leftArm, [0, 0.02, 0], [0.22, 0.22, 0.25], shirt);
      addSphere(rightArm, [0, 0.02, 0], [0.22, 0.22, 0.25], shirt);
      addCapsule(leftArm, [0, -0.31, 0], 0.135, 0.4, furLight);
      addCapsule(rightArm, [0, -0.31, 0], 0.135, 0.4, furLight);
      const leftHand = new Three.Group();
      const rightHand = new Three.Group();
      leftHand.position.set(0, -0.62, 0.03);
      rightHand.position.set(0, -0.62, 0.03);
      addSphere(leftHand, [0, 0, 0], [0.19, 0.2, 0.16], furLight);
      addSphere(rightHand, [0, 0, 0], [0.19, 0.2, 0.16], furLight);
      leftArm.add(leftHand);
      rightArm.add(rightHand);
      root.add(leftArm, rightArm);

      const floorShadow = new Three.Mesh(new Three.CircleGeometry(1.03, 48), new Three.MeshBasicMaterial({ color: 0x8a6678, transparent: true, opacity: 0.22, depthWrite: false }));
      floorShadow.rotation.x = -Math.PI / 2;
      floorShadow.scale.set(1.35, 0.42, 1);
      floorShadow.position.set(0, -1.98, 0.05);
      floorShadow.renderOrder = -1;
      scene.add(floorShadow);
      scene.add(new Three.HemisphereLight(0xfff0e6, 0x4b3d4c, 1.5));
      const key = new Three.DirectionalLight(0xffffff, 1.35);
      key.position.set(-3.5, 5.2, 5);
      key.castShadow = true;
      key.shadow.mapSize.set(768, 768);
      key.shadow.camera.left = -4;
      key.shadow.camera.right = 4;
      key.shadow.camera.top = 4;
      key.shadow.camera.bottom = -4;
      scene.add(key);
      const fill = new Three.PointLight(0xffa4bd, 0.35, 10);
      fill.position.set(3, 2.5, 4);
      scene.add(fill);

      const resize = () => {
        const width = Math.max(1, cat3DStage.clientWidth);
        const height = Math.max(1, cat3DStage.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      if ("ResizeObserver" in window) new ResizeObserver(resize).observe(cat3DStage);
      else window.addEventListener("resize", resize, { passive: true });
      resize();
      renderer.domElement.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        catMascot.classList.remove("is-3d-ready");
        catBubble.textContent = "这台设备暂时无法显示 3D 乔巴，但其他功能仍可使用。";
      });
      catMascot.dataset.petModel = "chopper-rigged-web";
      catMascot.classList.add("is-3d-ready");
      const clock = new Three.Clock();
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const approach = (current, target, amount = 0.16) => current + (target - current) * amount;
      const animate = () => {
        const time = clock.getElapsedTime();
        const activeAction = petActionUntil > Date.now() ? petAction : "idle";
        const beat = Math.sin(time * 12);
        let leftTarget = -0.45;
        let rightTarget = 0.45;
        let headTarget = 0;
        let pulse = 1;
        if (activeAction === "greet") {
          rightTarget = 2.12 + (reducedMotion ? 0 : Math.sin(time * 12.5) * 0.18);
          rightHand.rotation.z = reducedMotion ? 0 : Math.sin(time * 12.5) * 0.24;
          leftHand.rotation.z = 0;
        } else if (activeAction === "cross") {
          leftTarget = 1.22;
          rightTarget = -1.22;
          leftHand.rotation.z = -0.35;
          rightHand.rotation.z = 0.35;
        } else if (activeAction === "happy") {
          leftTarget = 1.82 + (reducedMotion ? 0 : beat * 0.12);
          rightTarget = -1.82 - (reducedMotion ? 0 : beat * 0.12);
          headTarget = reducedMotion ? 0 : Math.sin(time * 7) * 0.05;
          pulse = reducedMotion ? 1 : 1 + Math.sin(time * 12) * 0.025;
          leftHand.rotation.z = 0;
          rightHand.rotation.z = 0;
        } else {
          leftHand.rotation.z = 0;
          rightHand.rotation.z = 0;
        }
        leftArm.rotation.z = approach(leftArm.rotation.z, leftTarget);
        rightArm.rotation.z = approach(rightArm.rotation.z, rightTarget);
        headRig.rotation.z = approach(headRig.rotation.z, headTarget, 0.1);
        body.scale.y = approach(body.scale.y, pulse, 0.14);
        if (catFloat && !catFloat.hidden && !document.hidden) renderer.render(scene, camera);
        window.requestAnimationFrame(animate);
      };
      animate();
    } catch (error) {
      console.warn("Chopper 3D model could not initialize.", error);
      cat3DStage.replaceChildren();
      catMascot.classList.remove("is-3d-ready");
      catBubble.textContent = "这台设备暂时无法显示 3D 乔巴，但其他功能仍可使用。";
    }
    return;
  }

  function initializeCatModelLegacy() {
    if (!cat3DStage || !window.THREE) return;
    catMascot.classList.remove("is-2d-ready");

    try {
      const Three = window.THREE;
      const scene = new Three.Scene();
      const camera = new Three.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, -0.03, 8.25);
      camera.lookAt(0, -0.03, 0);
      const renderer = new Three.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputEncoding = Three.sRGBEncoding;
      renderer.toneMapping = Three.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.92;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = Three.PCFSoftShadowMap;
      cat3DStage.appendChild(renderer.domElement);

      const white = new Three.MeshPhysicalMaterial({ color: 0xfffcfd, roughness: 0.34, clearcoat: 0.3, clearcoatRoughness: 0.22 });
      const pink = new Three.MeshPhysicalMaterial({ color: 0xf85f98, roughness: 0.32, clearcoat: 0.28, clearcoatRoughness: 0.22 });
      const pinkLight = new Three.MeshPhysicalMaterial({ color: 0xff8fba, roughness: 0.34, clearcoat: 0.25, clearcoatRoughness: 0.26 });
      const pinkShade = new Three.MeshPhysicalMaterial({ color: 0xdf3f78, roughness: 0.4, clearcoat: 0.16 });
      const yellow = new Three.MeshPhysicalMaterial({ color: 0xffc946, roughness: 0.28, clearcoat: 0.34, clearcoatRoughness: 0.2 });
      const yellowShade = new Three.MeshPhysicalMaterial({ color: 0xd77b27, roughness: 0.4, clearcoat: 0.15 });
      const black = new Three.MeshPhysicalMaterial({ color: 0x4c2130, roughness: 0.31, clearcoat: 0.27, clearcoatRoughness: 0.2 });
      const root = new Three.Group();
      scene.add(root);

      const addSphere = (parent, position, scale, material) => {
        const mesh = new Three.Mesh(new Three.SphereGeometry(1, 40, 28), material);
        mesh.position.set(...position);
        mesh.scale.set(...scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
      };
      const addCapsule = (parent, position, radius, length, material) => {
        const capsule = new Three.Group();
        capsule.position.set(...position);
        const middle = new Three.Mesh(new Three.CylinderGeometry(radius, radius, length, 28), material);
        middle.castShadow = true;
        middle.receiveShadow = true;
        capsule.add(middle);
        addSphere(capsule, [0, length / 2, 0], [radius, radius, radius], material);
        addSphere(capsule, [0, -length / 2, 0], [radius, radius, radius], material);
        parent.add(capsule);
        return capsule;
      };

      const addTube = (parent, points, radius, material) => {
        const curve = new Three.CatmullRomCurve3(points);
        const mesh = new Three.Mesh(new Three.TubeGeometry(curve, 24, radius, 8, false), material);
        mesh.castShadow = true;
        parent.add(mesh);
        return mesh;
      };
      const addSoftShape = (parent, shape, depth, material, position, rotation = [0, 0, 0]) => {
        const geometry = new Three.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelSegments: 4,
          bevelSize: 0.052,
          bevelThickness: 0.052,
          curveSegments: 18,
        });
        geometry.center();
        const mesh = new Three.Mesh(geometry, material);
        mesh.position.set(...position);
        mesh.rotation.set(...rotation);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
      };

      // Rounded triangular ears sit behind the head, so their bases disappear cleanly into the silhouette.
      const earShape = new Three.Shape();
      earShape.moveTo(-0.46, -0.31);
      earShape.quadraticCurveTo(-0.56, 0.06, -0.09, 0.64);
      earShape.quadraticCurveTo(0.03, 0.77, 0.45, 0.31);
      earShape.quadraticCurveTo(0.56, 0.07, 0.42, -0.31);
      earShape.quadraticCurveTo(0.02, -0.42, -0.46, -0.31);
      addSoftShape(root, earShape, 0.22, white, [-0.83, 1.5, -0.08], [0, 0, 0.24]);
      addSoftShape(root, earShape, 0.22, white, [0.83, 1.5, -0.08], [0, 0, -0.24]);

      const headCenterY = 0.53;
      const headRadiusX = 1.36;
      const headRadiusY = 0.92;
      const headRadiusZ = 0.84;
      const head = addSphere(root, [0, headCenterY, 0], [headRadiusX, headRadiusY, headRadiusZ], white);
      head.name = "Hello Kitty rounded head";
      const faceSurfaceZ = (x, y, offset = 0.025) => {
        const radial = 1 - (x / headRadiusX) ** 2 - ((y - headCenterY) / headRadiusY) ** 2;
        return headRadiusZ * Math.sqrt(Math.max(0.08, radial)) + offset;
      };

      // A bevelled, shallow A-line dress is closer to a soft vinyl toy than a tapered cylinder.
      const dressShape = new Three.Shape();
      dressShape.moveTo(-0.87, -0.59);
      dressShape.quadraticCurveTo(-0.91, -0.57, -0.89, -0.46);
      dressShape.lineTo(-0.61, 0.39);
      dressShape.quadraticCurveTo(-0.55, 0.53, -0.4, 0.57);
      dressShape.lineTo(0.4, 0.57);
      dressShape.quadraticCurveTo(0.55, 0.53, 0.61, 0.39);
      dressShape.lineTo(0.89, -0.46);
      dressShape.quadraticCurveTo(0.91, -0.57, 0.87, -0.59);
      dressShape.quadraticCurveTo(0, -0.69, -0.87, -0.59);
      addSoftShape(root, dressShape, 0.42, pink, [0, -0.84, 0.02]);
      addTube(root, [
        new Three.Vector3(-0.78, -1.42, 0.28),
        new Three.Vector3(0, -1.49, 0.31),
        new Three.Vector3(0.78, -1.42, 0.28),
      ], 0.026, pinkLight);
      addSphere(root, [-0.69, -0.43, 0.02], [0.3, 0.24, 0.26], pinkLight).rotation.z = -0.56;
      addSphere(root, [0.69, -0.43, 0.02], [0.3, 0.24, 0.26], pinkLight).rotation.z = 0.56;
      addTube(root, [
        new Three.Vector3(-0.24, -0.24, 0.31),
        new Three.Vector3(0, -0.39, 0.42),
        new Three.Vector3(0.24, -0.24, 0.31),
      ], 0.052, white);

      const leftLeg = new Three.Group();
      leftLeg.position.set(-0.37, -1.38, 0.02);
      addSphere(leftLeg, [0, -0.29, 0.07], [0.32, 0.38, 0.33], white);
      root.add(leftLeg);
      const rightLeg = new Three.Group();
      rightLeg.position.set(0.37, -1.38, 0.02);
      addSphere(rightLeg, [0, -0.29, 0.07], [0.32, 0.38, 0.33], white);
      root.add(rightLeg);

      const waveArm = new Three.Group();
      waveArm.position.set(-0.72, -0.44, 0.24);
      waveArm.rotation.z = -0.45;
      addCapsule(waveArm, [0, -0.35, 0], 0.17, 0.43, white);
      const wavingHand = new Three.Group();
      wavingHand.position.set(0, -0.68, 0.035);
      addSphere(wavingHand, [0, 0, 0], [0.22, 0.23, 0.17], white);
      addSphere(wavingHand, [-0.1, 0.12, 0.02], [0.055, 0.07, 0.05], white);
      addSphere(wavingHand, [0, 0.15, 0.02], [0.055, 0.07, 0.05], white);
      addSphere(wavingHand, [0.1, 0.12, 0.02], [0.055, 0.07, 0.05], white);
      waveArm.add(wavingHand);
      root.add(waveArm);
      const restingArm = new Three.Group();
      restingArm.position.set(0.72, -0.44, 0.1);
      restingArm.rotation.z = 0.45;
      addCapsule(restingArm, [0, -0.34, 0], 0.17, 0.41, white);
      const restingHand = new Three.Group();
      restingHand.position.set(0, -0.66, 0.03);
      addSphere(restingHand, [0, 0, 0], [0.22, 0.23, 0.17], white);
      restingArm.add(restingHand);
      root.add(restingArm);

      [[-0.46, 0.65], [0.46, 0.65]].forEach(([x, y]) => {
        addSphere(root, [x, y, faceSurfaceZ(x, y, 0.04)], [0.095, 0.19, 0.067], black);
      });
      const noseZ = faceSurfaceZ(0, 0.4, 0.034);
      addSphere(root, [0, 0.4, noseZ - 0.006], [0.19, 0.11, 0.06], yellowShade);
      addSphere(root, [0, 0.41, noseZ + 0.023], [0.165, 0.09, 0.045], yellow);
      const whiskerSpecs = [
        [0.76, 0.79, 1.24, 0.82],
        [0.8, 0.55, 1.31, 0.54],
        [0.74, 0.31, 1.2, 0.17],
      ];
      [-1, 1].forEach((side) => whiskerSpecs.forEach(([startX, startY, endX, endY]) => {
        const startZ = faceSurfaceZ(side * startX, startY, 0.045);
        addTube(root, [
          new Three.Vector3(side * startX, startY, startZ),
          new Three.Vector3(side * ((startX + endX) / 2), (startY + endY) / 2 + 0.016, 0.68),
          new Three.Vector3(side * endX, endY, 0.54),
        ], 0.026, black);
      }));

      const bow = new Three.Group();
      bow.position.set(-0.68, 1.2, faceSurfaceZ(-0.68, 1.2, 0.07));
      const tallBowLoop = addSphere(bow, [-0.18, 0.08, 0], [0.25, 0.38, 0.13], pink);
      tallBowLoop.rotation.z = -0.27;
      const wideBowLoop = addSphere(bow, [0.26, -0.025, 0], [0.37, 0.25, 0.135], pink);
      wideBowLoop.rotation.z = 0.21;
      addSphere(bow, [-0.18, 0.08, 0.105], [0.11, 0.18, 0.025], pinkShade).rotation.z = -0.26;
      addSphere(bow, [0.26, -0.025, 0.11], [0.18, 0.09, 0.025], pinkShade).rotation.z = 0.2;
      addSphere(bow, [0.01, 0.035, 0.18], [0.145, 0.145, 0.1], pinkLight);
      root.add(bow);

      const floorShadow = new Three.Mesh(new Three.CircleGeometry(1.13, 64), new Three.MeshBasicMaterial({ color: 0xeb93b2, transparent: true, opacity: 0.21, depthWrite: false }));
      floorShadow.rotation.x = -Math.PI / 2;
      floorShadow.scale.set(1.35, 0.42, 1);
      floorShadow.position.set(0, -2.08, 0.05);
      floorShadow.renderOrder = -1;
      scene.add(floorShadow);
      scene.add(new Three.HemisphereLight(0xfff0f5, 0x7b5362, 1.45));
      const key = new Three.DirectionalLight(0xffffff, 1.45);
      key.position.set(-3.8, 5.6, 5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -4;
      key.shadow.camera.right = 4;
      key.shadow.camera.top = 4;
      key.shadow.camera.bottom = -4;
      scene.add(key);
      const fill = new Three.PointLight(0xffa0bf, 0.42, 10);
      fill.position.set(3, 2.4, 4.5);
      scene.add(fill);

      const resize = () => {
        const width = Math.max(1, cat3DStage.clientWidth);
        const height = Math.max(1, cat3DStage.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      if ("ResizeObserver" in window) new ResizeObserver(resize).observe(cat3DStage);
      else window.addEventListener("resize", resize, { passive: true });
      resize();
      renderer.domElement.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        catMascot.classList.remove("is-3d-ready");
        catBubble.textContent = "这台设备暂时无法显示 3D 互动，但其他功能都可以正常使用。";
      });
      catMascot.classList.add("is-3d-ready");
      const clock = new Three.Clock();
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const animate = () => {
        const time = clock.getElapsedTime();
        const isGreeting = catMascot.classList.contains("is-chatting");
        waveArm.rotation.z = isGreeting
          ? -2.16 + (reducedMotion ? 0 : Math.sin(time * 12.5) * 0.17)
          : -0.45;
        wavingHand.rotation.z = isGreeting && !reducedMotion ? Math.sin(time * 12.5) * 0.22 : 0;
        restingArm.rotation.z = 0.45 + (isGreeting && !reducedMotion ? Math.sin(time * 6.5) * 0.05 : 0);
        leftLeg.rotation.x = isGreeting && !reducedMotion ? Math.sin(time * 6.5) * 0.06 : 0;
        rightLeg.rotation.x = isGreeting && !reducedMotion ? -Math.sin(time * 6.5) * 0.06 : 0;
        if (catFloat && !catFloat.hidden && !document.hidden) renderer.render(scene, camera);
        window.requestAnimationFrame(animate);
      };
      animate();
    } catch (error) {
      console.warn("Hello Kitty 3D model could not initialize.", error);
      cat3DStage.replaceChildren();
      catMascot.classList.remove("is-3d-ready");
      catBubble.textContent = "这台设备暂时无法显示 3D 互动，但其他功能都可以正常使用。";
    }
    return;

    const Three = window.THREE;
    if (!Three.FBXLoader) return;
    const fbxScene = new Three.Scene();
    const fbxCamera = new Three.PerspectiveCamera(32, 1, 0.1, 100);
    fbxCamera.position.set(0, 1.35, 6.3);
    const fbxRenderer = new Three.WebGLRenderer({ alpha: true, antialias: true });
    fbxRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    fbxRenderer.setClearColor(0x000000, 0);
    fbxRenderer.outputEncoding = Three.sRGBEncoding;
    fbxRenderer.toneMapping = Three.ACESFilmicToneMapping;
    fbxRenderer.toneMappingExposure = 1;
    cat3DStage.appendChild(fbxRenderer.domElement);

    const fbxRoot = new Three.Group();
    fbxRoot.rotation.y = -0.35;
    fbxScene.add(fbxRoot);
    let fbxModelSize = null;
    fbxScene.add(new Three.HemisphereLight(0xfff1e6, 0x694f58, 1.65));
    const fbxKeyLight = new Three.DirectionalLight(0xffffff, 1.25);
    fbxKeyLight.position.set(-3, 5, 5);
    fbxScene.add(fbxKeyLight);
    const fbxFillLight = new Three.PointLight(0xffadc0, 0.5, 10);
    fbxFillLight.position.set(3, 2, 4);
    fbxScene.add(fbxFillLight);

    let fbxRotation = fbxRoot.rotation.y;
    let fbxDragging = false;
    let fbxMoved = false;
    let fbxLastX = 0;
    let fbxLastY = 0;
    catMascot.addEventListener("pointerdown", (event) => {
      fbxDragging = true;
      fbxMoved = false;
      fbxLastX = event.clientX;
      fbxLastY = event.clientY;
      catMascot.setPointerCapture?.(event.pointerId);
    });
    catMascot.addEventListener("pointermove", (event) => {
      if (!fbxDragging) return;
      const deltaX = event.clientX - fbxLastX;
      const deltaY = event.clientY - fbxLastY;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 3) fbxMoved = true;
      fbxRotation += deltaX * 0.015;
      fbxRoot.rotation.x = Math.max(-0.18, Math.min(0.18, fbxRoot.rotation.x + deltaY * 0.004));
      fbxLastX = event.clientX;
      fbxLastY = event.clientY;
    });
    const releaseFbxCat = (event) => {
      if (!fbxDragging) return;
      fbxDragging = false;
      catMascot.dataset.dragged = fbxMoved ? "true" : "";
      catMascot.releasePointerCapture?.(event.pointerId);
    };
    catMascot.addEventListener("pointerup", releaseFbxCat);
    catMascot.addEventListener("pointercancel", releaseFbxCat);

    const resizeFbxCat = () => {
      const width = Math.max(1, cat3DStage.clientWidth);
      const height = Math.max(1, cat3DStage.clientHeight);
      fbxRenderer.setSize(width, height, false);
      fbxCamera.aspect = width / height;
      if (fbxModelSize) {
        const halfFov = Three.MathUtils.degToRad(fbxCamera.fov / 2);
        const verticalDistance = fbxModelSize.y / (2 * Math.tan(halfFov));
        const horizontalDistance = fbxModelSize.x / (2 * Math.tan(halfFov) * fbxCamera.aspect);
        fbxCamera.position.set(0, fbxModelSize.y * 0.48, Math.max(verticalDistance, horizontalDistance) * 1.65);
        fbxCamera.lookAt(0, fbxModelSize.y * 0.48, 0);
      }
      fbxCamera.updateProjectionMatrix();
    };
    if (window.ResizeObserver) new ResizeObserver(resizeFbxCat).observe(cat3DStage);
    else window.addEventListener("resize", resizeFbxCat);
    resizeFbxCat();

    new Three.FBXLoader().load("siamese-cat.fbx", (model) => {
      model.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        if (!node.material) node.material = new Three.MeshStandardMaterial({ color: 0xf0d8bd, roughness: 0.8 });
      });
      const bounds = new Three.Box3().setFromObject(model);
      const center = bounds.getCenter(new Three.Vector3());
      const size = bounds.getSize(new Three.Vector3());
      const largestSide = Math.max(size.x, size.y, size.z) || 1;
      model.position.sub(center);
      model.scale.setScalar(2.85 / largestSide);
      const fittedBounds = new Three.Box3().setFromObject(model);
      const fittedCenter = fittedBounds.getCenter(new Three.Vector3());
      model.position.x -= fittedCenter.x;
      model.position.z -= fittedCenter.z;
      model.position.y -= fittedBounds.min.y;
      fbxModelSize = fittedBounds.getSize(new Three.Vector3());
      fbxRoot.add(model);
      catModelRoot = fbxRoot;
      catMascot.classList.add("is-3d-ready");
      resizeFbxCat();
    }, undefined, () => {
      catBubble.textContent = "猫猫暂时躲起来了，点点我再试一次。";
    });

    const fbxClock = new Three.Clock();
    const animateFbxCat = () => {
      const time = fbxClock.getElapsedTime();
      fbxRoot.position.y = Math.sin(time * 1.45) * 0.055;
      fbxRoot.rotation.y += (fbxRotation - fbxRoot.rotation.y) * 0.09;
      fbxRenderer.render(fbxScene, fbxCamera);
      window.requestAnimationFrame(animateFbxCat);
    };
    animateFbxCat();
    return;

    const THREE = window.THREE;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 1.25, 9.6);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    cat3DStage.appendChild(renderer.domElement);

    const warmFur = new THREE.MeshStandardMaterial({ color: 0xeed6bb, roughness: 0.88, metalness: 0 });
    const lightFur = new THREE.MeshStandardMaterial({ color: 0xffecd5, roughness: 0.92, metalness: 0 });
    const darkFur = new THREE.MeshStandardMaterial({ color: 0x533a42, roughness: 0.83, metalness: 0 });
    const maskFur = new THREE.MeshStandardMaterial({ color: 0x856d70, roughness: 0.86, metalness: 0 });
    const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xfffbf4, roughness: 0.42, metalness: 0 });
    const eyeFur = new THREE.MeshStandardMaterial({ color: 0x23bdeb, roughness: 0.12, metalness: 0.16 });
    const pupilFur = new THREE.MeshStandardMaterial({ color: 0x252229, roughness: 0.2, metalness: 0.02 });
    const noseFur = new THREE.MeshStandardMaterial({ color: 0x8b6265, roughness: 0.65, metalness: 0 });
    const root = new THREE.Group();
    const body = new THREE.Group();
    const head = new THREE.Group();
    const tail = new THREE.Group();
    root.add(body, head, tail);
    root.rotation.y = -0.38;
    scene.add(root);
    catModelRoot = root;

    const sphere = (parent, position, scale, material, segments = 24) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(12, Math.round(segments * 0.7))), material);
      mesh.position.set(position[0], position[1], position[2]);
      mesh.scale.set(scale[0], scale[1], scale[2]);
      parent.add(mesh);
      return mesh;
    };

    sphere(body, [0, -0.45, 0], [1, 0.98, 0.78], warmFur, 32);
    sphere(head, [0, 1.34, 0.05], [1.3, 1.16, 1], warmFur, 32);
    sphere(head, [0, 1.18, 1.01], [0.82, 0.62, 0.08], maskFur, 26);
    sphere(head, [0, 0.65, 1.09], [0.69, 0.38, 0.12], lightFur, 24);
    sphere(body, [0, -0.22, 0.75], [0.52, 0.66, 0.1], lightFur, 22);
    sphere(body, [-0.5, -1.18, 0.72], [0.36, 0.23, 0.25], darkFur, 20);
    sphere(body, [0.5, -1.18, 0.72], [0.36, 0.23, 0.25], darkFur, 20);

    const earGeometry = new THREE.ConeGeometry(0.48, 0.95, 4);
    [[-0.72, 2.28, 0.02, -0.34], [0.72, 2.28, 0.02, 0.34]].forEach(([x, y, z, rotate]) => {
      const ear = new THREE.Mesh(earGeometry, darkFur);
      ear.position.set(x, y, z);
      ear.rotation.z = rotate;
      ear.rotation.y = Math.PI / 4;
      head.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.59, 4), noseFur);
      inner.position.set(x, y - 0.02, z + 0.2);
      inner.rotation.copy(ear.rotation);
      inner.scale.set(0.88, 0.83, 0.88);
      head.add(inner);
    });

    [[-0.41, 1.34, 1.08], [0.41, 1.34, 1.08]].forEach(([x, y, z]) => {
      sphere(head, [x, y, z], [0.3, 0.38, 0.07], eyeWhite, 22);
      sphere(head, [x, y - 0.025, z + 0.07], [0.18, 0.26, 0.04], eyeFur, 20);
      sphere(head, [x, y - 0.015, z + 0.11], [0.096, 0.16, 0.024], pupilFur, 18);
      sphere(head, [x + (x < 0 ? -0.055 : 0.055), y + 0.09, z + 0.135], [0.045, 0.058, 0.014], eyeWhite, 12);
    });
    sphere(head, [0, 0.93, 1.22], [0.12, 0.08, 0.055], noseFur, 16);
    const whiskerMaterial = new THREE.LineBasicMaterial({ color: 0xf5e8df, transparent: true, opacity: 0.92 });
    [-1, 1].forEach((side) => {
      [-0.06, 0.04, 0.14].forEach((offset) => {
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(side * 0.1, 0.92 + offset, 1.2), new THREE.Vector3(side * 0.66, 0.92 + offset * 1.4, 1.25), new THREE.Vector3(side * 0.98, 0.88 + offset * 1.7, 1.06)
        ]), whiskerMaterial);
        head.add(line);
      });
    });

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.83, -0.57, -0.2), new THREE.Vector3(1.4, -0.05, -0.36), new THREE.Vector3(1.37, 0.63, -0.22), new THREE.Vector3(0.98, 0.78, -0.12)
    ]);
    const tailMesh = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 28, 0.16, 12, false), darkFur);
    tail.add(tailMesh);


    scene.add(new THREE.HemisphereLight(0xffefd9, 0x6f4660, 1.35));
    const keyLight = new THREE.DirectionalLight(0xfff5e9, 1.05);
    keyLight.position.set(-3, 5, 5);
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0xffa7b3, 0.55, 12);
    fillLight.position.set(3, 1, 4);
    scene.add(fillLight);

    let baseRotation = root.rotation.y;
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    catMascot.addEventListener("pointerdown", (event) => {
      dragging = true;
      moved = false;
      lastX = event.clientX;
      lastY = event.clientY;
      catMascot.setPointerCapture?.(event.pointerId);
    });
    catMascot.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 3) moved = true;
      baseRotation += deltaX * 0.015;
      head.rotation.x = Math.max(-0.22, Math.min(0.22, head.rotation.x + deltaY * 0.004));
      lastX = event.clientX;
      lastY = event.clientY;
    });
    const releaseCat = (event) => {
      if (!dragging) return;
      dragging = false;
      catMascot.dataset.dragged = moved ? "true" : "";
      catMascot.releasePointerCapture?.(event.pointerId);
    };
    catMascot.addEventListener("pointerup", releaseCat);
    catMascot.addEventListener("pointercancel", releaseCat);

    const resize = () => {
      const width = Math.max(1, cat3DStage.clientWidth);
      const height = Math.max(1, cat3DStage.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(cat3DStage);
    resize();
    catMascot.classList.add("is-3d-ready");

    const clock = new THREE.Clock();
    const animate = () => {
      const time = clock.getElapsedTime();
      root.position.y = Math.sin(time * 1.55) * 0.08;
      root.rotation.y += (baseRotation - root.rotation.y) * 0.08;
      tail.rotation.y = Math.sin(time * 2.1) * 0.19;
      head.rotation.z = Math.sin(time * 1.4) * 0.035;
      renderer.render(scene, camera);
      window.requestAnimationFrame(animate);
    };
    animate();
  }

  function getCatMessage() {
    const name = getCatName();
    const next = archiveRecords.filter((record) => formatRecordTime(record) > Date.now()).sort((a, b) => formatRecordTime(a) - formatRecordTime(b))[0];
    const unlockedLetter = futureLetters.find((letter) => letter.unlockDate <= getToday());
    if (next) return `${name}算过啦，${getCountdownText(next)}。要去${next.activity || "约会"}，还要吃${next.menu || "好吃的"}！`;
    if (unlockedLetter) return `${name}发现一封“${unlockedLetter.title}”已经可以打开啦。`;
    if (coupleNotes.length) return `${name}偷偷记得你们的${coupleNotes[0].title}，要不要再加一条？`;
    if (futureLetters.length) return "未来的信已经收好，我会陪你们一起等。";
    return [`${name}觉得今天也要好好想对方呀。`, `${name}最喜欢你们一起打开这个角落。`, "再来陪我一天，我会一直陪着你们。", "下一次见面，记得带我一起期待。 "][Math.floor(Math.random() * 4)];
  }

  function updateCatMascot() {
    if (!catMascot || !catGrowthLabel || !catBubble) return;
    const name = getCatName();
    catMascot.setAttribute("aria-label", `和${name}互动`);
    catMascot.title = `轻触 ${name}，让他随机做一个动作`;
    catGrowthLabel.textContent = "会打招呼、抱胸和开心动作的乔巴";
    catBubble.textContent = getCatMessage();
  }

  function chatWithCat() {
    triggerPetAction("greet");
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
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("图片无效"));
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) return reject(new Error("不支持绘图"));

          // 让照片既清楚又适合两台手机同步；必要时逐步压缩，避免把半截图片发过去。
          const presets = [[1000, 0.78], [820, 0.72], [680, 0.66], [560, 0.6]];
          let compressed = "";
          for (const [maxSide, quality] of presets) {
            const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            compressed = canvas.toDataURL("image/jpeg", quality);
            if (compressed.length <= 850000) break;
          }
          resolve(compressed);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderMemoryPhotos(record) {
    memoryPhotos.replaceChildren();
    record.photos.forEach((source, index) => { const wrap = document.createElement("div"); wrap.className = "memory-photo"; const image = document.createElement("img"); image.src = source; image.alt = `回忆照片 ${index + 1}`; const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", `删除回忆照片 ${index + 1}`); remove.addEventListener("click", () => { record.photos.splice(index, 1); record.updatedAt = Date.now(); persistArchive(); renderMemoryPhotos(record); }); wrap.append(image, remove); memoryPhotos.append(wrap); });
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

  function formatCalendarDate(date, time) {
    return `${String(date || "").replaceAll("-", "")}T${String(time || "17:00").replace(":", "")}00`;
  }

  function escapeCalendarText(value) {
    return String(value || "")
      .replaceAll("\\", "\\\\")
      .replaceAll(";", "\\;")
      .replaceAll(",", "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function addHoursToPlan(hours) {
    const start = new Date(`${state.date}T${state.time || "17:00"}:00`);
    start.setHours(start.getHours() + hours);
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, "0");
    const day = String(start.getDate()).padStart(2, "0");
    const hour = String(start.getHours()).padStart(2, "0");
    const minute = String(start.getMinutes()).padStart(2, "0");
    return `${year}${month}${day}T${hour}${minute}00`;
  }

  async function addPlanToCalendar() {
    if (!state.date || !state.time) {
      showToast("请先选择约会日期和时间");
      return;
    }

    const title = "Leo And Emily 的约会";
    const description = `PLAY: ${state.activity || "待选择"}\nMENU: ${state.menu || "待选择"}\n一起把这次见面留成回忆。`;
    const eventId = `leo-emily-${state.date}-${state.time.replace(":", "")}@date-invite`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Leo And Emily//Date Invite//CN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${eventId}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART:${formatCalendarDate(state.date, state.time)}`,
      `DTEND:${addHoursToPlan(3)}`,
      `SUMMARY:${escapeCalendarText(title)}`,
      `LOCATION:${escapeCalendarText(state.location || "地点待定")}`,
      `DESCRIPTION:${escapeCalendarText(description)}`,
      "END:VEVENT",
      "END:VCALENDAR",
      ""
    ].join("\r\n");
    const filename = `Leo-And-Emily-${state.date}.ics`;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const file = typeof File === "function" ? new File([blob], filename, { type: "text/calendar" }) : null;

    try {
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
        showToast("选择日历即可添加这次约会");
        return;
      }
      downloadBlob(blob, filename);
      showToast("日历文件已下载，打开后选择添加到日历");
    } catch (error) {
      if (error?.name !== "AbortError") {
        downloadBlob(blob, filename);
        showToast("日历文件已下载，打开后选择添加到日历");
      }
    }
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
