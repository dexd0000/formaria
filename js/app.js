(function () {
  "strict";

  const storage = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    }
  };

  const state = {
    achievements: storage.get("sick-achievements", []),
    fortunes: storage.get("sick-fortunes", []),
    lastFortune: storage.get("sick-last-fortune", null),
    cookieCount: storage.get("sick-cookie-count", 0),
    lastFood: storage.get("sick-last-food", null),
    foodCount: storage.get("sick-food-count", 0),
    lyingSeconds: storage.get("sick-lying-seconds", 0),
    lyingBest: storage.get("sick-lying-best", 0)
  };

  function setText(id, text) { const element = document.getElementById(id); if (element) element.textContent = text; }

  function initTheme() {
    document.documentElement.dataset.theme = "dark";
    storage.set("sick-theme", "dark");
    document.querySelector('meta[name="theme-color"]').setAttribute("content", "#0F1A33");
  }

  function initStaticText() {
    document.documentElement.lang = "uk";
    document.title = UI.title;
    setText("pageTitle", UI.title);
    setText("pageSubtitle", UI.subtitle);
    setText("startButton", UI.hero.startButton);
    setText("progressLabel", UI.progressLabel);
    setText("cookieHint", UI.cookie.hint);
    setText("anotherCookie", UI.cookie.another);
    setText("timerStart", UI.timer.start);
    setText("timerPause", UI.timer.pause);
    setText("timerReset", UI.timer.reset);
    setText("soundLabel", UI.timer.sound);
    setText("customMinutesLabel", UI.timer.customMinutes);
    document.getElementById("timeDecrease").setAttribute("aria-label", UI.timer.decrease);
    document.getElementById("timeIncrease").setAttribute("aria-label", UI.timer.increase);
    setText("personalLabel", UI.cookie.personal);
    setText("gameTitle", UI.game.title);
    setText("gameOverlayTitle", UI.game.title);
    setText("gameHowTo", UI.game.howTo);
    setText("gameStartButton", UI.game.play);
    setText("gameAgainButton", UI.game.again);
    setText("scoreLabel", UI.game.score);
    setText("bestLabel", UI.game.best);
    setText("leftLabel", UI.game.left);
    setText("rightLabel", UI.game.right);
    setText("foodButton", UI.food.button);
    setText("foodPrefix", UI.food.prefix);
    setText("foodRejected", UI.food.rejected);
    setText("footerText", UI.footer);

    const statusList = document.getElementById("statusList");
    statusList.innerHTML = UI.hero.status.map(text => `<li>${text}</li>`).join("");

    const signature = CONFIG.signature && !CONFIG.signature.startsWith("{{");
    setText("signatureText", signature ? ` · ${CONFIG.signature}` : "");
    const note = CONFIG.note && !CONFIG.note.startsWith("{{");
    if (note) {
      document.getElementById("noteSection").hidden = false;
      setText("noteText", CONFIG.note);
    }

    document.getElementById("startButton").addEventListener("click", () => {
      document.getElementById("progress").scrollIntoView({ behavior: "smooth" });
    });
  }

  function unlock(id) {
    if (state.achievements.includes(id)) return;
    state.achievements.push(id);
    storage.set("sick-achievements", state.achievements);
    const achievement = ACHIEVEMENTS.find(item => item.id === id);
    if (achievement) showToast(`${UI.toastUnlocked} ${achievement.title}`);
  }

  function checkAchievements(bestGameScore) {
    if (state.achievements.includes("barista") && !state.achievements.includes("naruto")) {
      state.achievements = state.achievements.filter(id => id !== "barista");
      state.achievements.push("naruto");
      storage.set("sick-achievements", state.achievements);
    }
    if (state.lyingSeconds >= 300) unlock("lying-expert");
    if (typeof bestGameScore === "number") {
      if (bestGameScore >= 15) unlock("defender");
      if (bestGameScore >= 40) unlock("dog-friend");
      if (bestGameScore >= 80) unlock("iron-nerves");
    }
    if (state.fortunes.length >= 5) unlock("collector");
    if (state.foodCount >= 3) unlock("gourmet");

    const special = ["first-cookie", "naruto", "lying-expert", "defender", "dog-friend", "iron-nerves", "collector", "gourmet"];
    if (special.every(id => state.achievements.includes(id))) {
      if (!state.achievements.includes("recovered")) {
        unlock("recovered");
        showToast(UI.recoveredMessage);
      }
    }
  }

  function renderAchievements() {
    checkAchievements(storage.get("sick-game-best", 0));
    const grid = document.getElementById("achievementGrid");
    grid.innerHTML = "";
    ACHIEVEMENTS.forEach(item => {
      const unlocked = state.achievements.includes(item.id);
      const card = document.createElement("article");
      card.className = `achievement ${unlocked ? "unlocked" : "locked"}`;
      card.innerHTML = `<div class="achievement-icon" aria-hidden="true">${unlocked ? "✓" : "▣"}</div><h3>${item.title}</h3><p>${unlocked ? "Розблоковано" : item.hint}</p>`;
      grid.appendChild(card);
    });
    const unlockable = ACHIEVEMENTS.length;
    const percent = Math.round((state.achievements.length / unlockable) * 100);
    setText("progressValue", `${percent}%`);
    document.getElementById("progressBar").style.width = `${percent}%`;
    const progress = document.querySelector(".progress-track");
    progress.setAttribute("aria-valuenow", String(percent));
  }

  let toastTimer;
  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3800);
  }

  function initTimer() {
    const presetList = document.getElementById("presetList");
    let current = TIMERS[0];
    let remaining = current.seconds;
    let endTime = null;
    let interval = null;
    const customTime = document.getElementById("customTime");
    const minutesInput = document.getElementById("timerMinutes");

    presetList.innerHTML = TIMERS.map((timer, index) =>
      `<button class="preset ${index === 0 ? "active" : ""}" data-id="${timer.id}"><strong>${timer.title}</strong><small>${formatTime(timer.seconds)}</small></button>`
    ).join("");

    function formatTime(seconds) {
      const safe = Math.max(0, Math.ceil(seconds));
      return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
    }

    function update() {
      if (endTime !== null) remaining = Math.max(0, (endTime - Date.now()) / 1000);
      setText("timerDisplay", formatTime(remaining));
      setText("timerStep", "");
      if (remaining <= 0 && endTime !== null) finish();
    }

    function tick() { update(); }

    function start() {
      if (remaining <= 0) remaining = current.seconds;
      endTime = Date.now() + remaining * 1000;
      if (!interval) interval = setInterval(tick, 250);
      if (current.id === "naruto") unlock("naruto");
      update();
    }

    function pause() {
      update();
      endTime = null;
      clearInterval(interval);
      interval = null;
    }

    function finish() {
      endTime = null;
      clearInterval(interval);
      interval = null;
      remaining = 0;
      setText("timerDisplay", "00:00");
      setText("timerStep", UI.timer.done);
      document.getElementById("cupWrap").classList.add("done");
      setTimeout(() => document.getElementById("cupWrap").classList.remove("done"), 4500);
      if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
      if (document.getElementById("soundToggle").checked) {
        try {
          const context = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 520;
          gain.gain.value = 0.025;
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          setTimeout(() => { oscillator.stop(); context.close(); }, 500);
        } catch (_) {}
      }
    }

    presetList.addEventListener("click", event => {
      const button = event.target.closest(".preset");
      if (!button) return;
      pause();
      presetList.querySelectorAll(".preset").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      current = TIMERS.find(timer => timer.id === button.dataset.id);
      remaining = current.seconds;
      customTime.hidden = !current.custom;
      if (current.custom) {
        minutesInput.value = String(Math.round(current.seconds / 60));
      }
      update();
    });

    function setCustomMinutes(nextMinutes) {
      if (!current.custom) return;
      const minutes = Math.max(1, Math.min(240, nextMinutes));
      minutesInput.value = String(minutes);
      current.seconds = minutes * 60;
      remaining = current.seconds;
      pause();
      update();
    }

    document.getElementById("timeDecrease").addEventListener("click", () => setCustomMinutes(Number(minutesInput.value) - 5));
    document.getElementById("timeIncrease").addEventListener("click", () => setCustomMinutes(Number(minutesInput.value) + 5));
    minutesInput.addEventListener("change", () => setCustomMinutes(Number(minutesInput.value)));

    document.getElementById("timerStart").addEventListener("click", start);
    document.getElementById("timerPause").addEventListener("click", pause);
    document.getElementById("timerReset").addEventListener("click", () => {
      pause();
      remaining = current.seconds;
      update();
    });
    update();
  }

  function initCookie() {
    const button = document.getElementById("cookieButton");
    const another = document.getElementById("anotherCookie");
    const paper = document.getElementById("fortunePaper");

    function getFortune(isPersonal) {
      const available = (isPersonal ? PERSONAL_FORTUNES : FORTUNES)
        .filter(text => text !== state.lastFortune);
      const fortune = available[Math.floor(Math.random() * available.length)];
      state.lastFortune = fortune;
      storage.set("sick-last-fortune", fortune);
      if (!state.fortunes.includes(fortune)) {
        state.fortunes.push(fortune);
        storage.set("sick-fortunes", state.fortunes);
      }
    }

    function breakCookie() {
      if (button.classList.contains("broken")) return;
      state.cookieCount += 1;
      storage.set("sick-cookie-count", state.cookieCount);
      const showPersonal = state.cookieCount % 3 === 0;
      if (showPersonal) {
        const personalIndex = (Math.floor(state.cookieCount / 3) - 1) % PERSONAL_FORTUNES.length;
        state.lastFortune = PERSONAL_FORTUNES[personalIndex];
        storage.set("sick-last-fortune", state.lastFortune);
        if (!state.fortunes.includes(state.lastFortune)) {
          state.fortunes.push(state.lastFortune);
          storage.set("sick-fortunes", state.fortunes);
        }
      } else {
        getFortune(false);
      }
      button.classList.add("broken");
      setText("fortuneText", state.lastFortune);
      const personalFortune = PERSONAL_FORTUNES.includes(state.lastFortune);
      paper.classList.toggle("personal-fortune", personalFortune);
      document.getElementById("personalLabel").hidden = !personalFortune;
      setTimeout(() => {
        paper.hidden = false;
        another.hidden = false;
        document.getElementById("cookieHint").hidden = true;
      }, 330);
      unlock("first-cookie");
      checkAchievements(storage.get("sick-game-best", 0));
      renderAchievements();
    }

    button.addEventListener("click", breakCookie);
    button.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); breakCookie(); }
    });
    another.addEventListener("click", () => {
      button.classList.remove("broken");
      paper.hidden = true;
      paper.classList.remove("personal-fortune");
      document.getElementById("personalLabel").hidden = true;
      another.hidden = true;
      document.getElementById("cookieHint").hidden = false;
    });
  }

  function initFood() {
    document.getElementById("foodButton").addEventListener("click", () => {
      let choices = FOODS.filter(food => food !== state.lastFood);
      const food = choices[Math.floor(Math.random() * choices.length)];
      state.lastFood = food;
      state.foodCount += 1;
      storage.set("sick-last-food", food);
      storage.set("sick-food-count", state.foodCount);
      setText("foodResult", food);
      checkAchievements(storage.get("sick-game-best", 0));
      renderAchievements();
    });
  }

  function initLyingTime() {
    let visibleSeconds = state.lyingSeconds;
    let lastTick = Date.now();
    setInterval(() => {
      if (document.hidden) { lastTick = Date.now(); return; }
      const now = Date.now();
      visibleSeconds += (now - lastTick) / 1000;
      lastTick = now;
      state.lyingSeconds = Math.floor(visibleSeconds);
      if (Math.floor(visibleSeconds) % 5 === 0) storage.set("sick-lying-seconds", state.lyingSeconds);
      if (state.lyingSeconds >= 300) {
        unlock("lying-expert");
        renderAchievements();
      }
    }, 1000);
  }

  function initCat() {
    const button = document.getElementById("catButton");
    const bubble = document.getElementById("catBubble");
    let hideTimer;
    button.addEventListener("click", () => {
      const line = CAT_LINES[Math.floor(Math.random() * CAT_LINES.length)];
      setText("catBubble", line);
      button.classList.add("stretch");
      bubble.hidden = false;
      setTimeout(() => button.classList.remove("stretch"), 500);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { bubble.hidden = true; }, 2000);
    });
  }

  initTheme();
  initStaticText();
  renderAchievements();
  initTimer();
  initCookie();
  initFood();
  initLyingTime();
  initCat();

  window.sickApp = {
    unlock,
    checkAchievements,
    renderAchievements,
    showToast
  };
})();
