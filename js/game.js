(function () {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("gameOverlay");
  const startPanel = document.getElementById("gameStart");
  const endPanel = document.getElementById("gameEnd");
  const startButton = document.getElementById("gameStartButton");
  const againButton = document.getElementById("gameAgainButton");
  const leftButton = document.getElementById("moveLeft");
  const rightButton = document.getElementById("moveRight");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const W = 360;
  const H = 640;
  let dpr = 1;
  let running = false;
  let paused = false;
  let score = 0;
  let lives = CONFIG.game.lives;
  let dogX = W / 2;
  let items = [];
  let spawnElapsed = 0;
  let elapsed = 0;
  let lastTime = 0;
  let keys = { left: false, right: false };
  let rafId = null;

  function storageGet(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (_) { return fallback; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawDaisy(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#23408E";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(0, -15, 6, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#F2C94C";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawCoffee(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(-0.2);
    ctx.fillStyle = "#8A5A3C";
    ctx.strokeStyle = "#23408E";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2, -12);
    ctx.quadraticCurveTo(4, 0, -2, 12);
    ctx.stroke();
    ctx.restore();
  }

  function drawBerry(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#6B3BAA";
    ctx.strokeStyle = "#23408E";
    ctx.lineWidth = 2;
    const berries = [[0,0],[8,-4],[9,7],[-7,6],[-9,-5]];
    berries.forEach(([bx, by]) => {
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawDanger(x, y, kind) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#23408E";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-20, -13, 40, 26, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#23408E";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = kind === "chat" ? "bold 8px Nunito, sans-serif" : "bold 22px Nunito, sans-serif";
    ctx.fillText(kind === "chat" ? UI.game.notification : "!", 0, 1);
    ctx.restore();
  }

  function drawDog() {
    ctx.save();
    ctx.translate(dogX, 584);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Tail
    ctx.fillStyle = CONFIG.game.dogColor;
    ctx.strokeStyle = "#23408E";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(27, 13);
    ctx.bezierCurveTo(50, 8, 54, -12, 43, -22);
    ctx.bezierCurveTo(38, -27, 34, -22, 38, -16);
    ctx.bezierCurveTo(43, -8, 38, 1, 27, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Body
    ctx.fillStyle = CONFIG.game.dogColor;
    ctx.strokeStyle = "#23408E";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 15, 34, 27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ears
    ctx.fillStyle = "#A9784A";
    ctx.beginPath();
    ctx.ellipse(-23, -10, 11, 24, -.28, 0, Math.PI * 2);
    ctx.ellipse(23, -10, 11, 24, .28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.fillStyle = CONFIG.game.dogColor;
    ctx.beginPath();
    ctx.ellipse(0, -12, 31, 27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cream muzzle
    ctx.fillStyle = "#F2DFC2";
    ctx.beginPath();
    ctx.ellipse(0, 1, 18, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#23408E";
    ctx.beginPath();
    ctx.arc(-10, -17, 3.2, 0, Math.PI * 2);
    ctx.arc(10, -17, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Nose and smile
    ctx.beginPath();
    ctx.ellipse(0, -5, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#23408E";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-5, 8, -11, 5);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(5, 8, 11, 5);
    ctx.stroke();

    // Paws
    ctx.beginPath();
    ctx.ellipse(-19, 39, 12, 7, -.12, 0, Math.PI * 2);
    ctx.ellipse(19, 39, 12, 7, .12, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.game.dogColor;
    ctx.fill();
    ctx.stroke();

    // Blue collar and tag
    ctx.fillStyle = "#6C8FD6";
    ctx.fillRect(-29, 27, 58, 9);
    ctx.strokeRect(-29, 27, 58, 9);
    ctx.beginPath();
    ctx.arc(0, 41, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#F2C94C";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#23408E";
    ctx.beginPath();
    ctx.arc(0, 41, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#23408E";
    ctx.font = "800 12px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(CONFIG.dogName, 0, 63);
    ctx.restore();
  }

  function drawLives() {
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#23408E";
    ctx.lineWidth = 2;
    ctx.textAlign = "left";
    ctx.font = "800 15px Nunito, sans-serif";
    ctx.fillStyle = "#23408E";
    ctx.fillText("♡", 14, 28);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = document.documentElement.dataset.theme === "dark" ? "#172442" : "#FBFAF6";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = document.documentElement.dataset.theme === "dark" ? "#25385E" : "#EDF2FB";
    ctx.fillRect(0, 520, W, 120);

    ctx.fillStyle = document.documentElement.dataset.theme === "dark" ? "#EEF3FF" : "#23408E";
    ctx.textAlign = "left";
    ctx.font = "800 16px Nunito, sans-serif";
    ctx.fillText(String(score), 16, 26);
    for (let i = 0; i < lives; i++) {
      ctx.save();
      ctx.translate(330 - i * 24, 18);
      ctx.fillStyle = "#6C8FD6";
      ctx.strokeStyle = "#23408E";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-8, -7, 16, 16, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    items.forEach(item => {
      if (item.type === "daisy") drawDaisy(item.x, item.y, item.scale);
      if (item.type === "coffee") drawCoffee(item.x, item.y, item.scale);
      if (item.type === "berry") drawBerry(item.x, item.y, item.scale);
      if (item.type === "chat" || item.type === "sneeze") drawDanger(item.x, item.y, item.type);
    });
    drawDog();
  }

  function spawnItem() {
    const roll = Math.random();
    let type = "daisy";
    if (roll < 0.28) type = "coffee";
    else if (roll < 0.34) type = "berry";
    else if (roll < 0.43) type = "chat";
    else if (roll < 0.48) type = "sneeze";
    items.push({ type, x: 30 + Math.random() * (W - 60), y: -35, scale: 1 });
  }

  function update(delta) {
    const seconds = delta / 1000;
    elapsed += delta;
    spawnElapsed += delta;
    const progress = Math.min(1, elapsed / 60000);
    const interval = CONFIG.game.spawnIntervalStartMs - (CONFIG.game.spawnIntervalStartMs - CONFIG.game.spawnIntervalMinMs) * progress;
    const fallSpeed = CONFIG.game.fallSpeedStart + (CONFIG.game.fallSpeedMax - CONFIG.game.fallSpeedStart) * progress;

    if (spawnElapsed >= interval) {
      spawnElapsed = 0;
      spawnItem();
    }
    if (keys.left) dogX -= 260 * seconds;
    if (keys.right) dogX += 260 * seconds;
    dogX = Math.max(38, Math.min(W - 38, dogX));

    items.forEach(item => { item.y += fallSpeed * seconds; });
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const dogTop = 550;
      if (item.y > dogTop && item.y < 610 && Math.abs(item.x - dogX) < 38) {
        if (item.type === "daisy") score += 1;
        else if (item.type === "coffee") score += 2;
        else if (item.type === "berry") score += 3;
        else {
          lives -= 1;
          if (!reducedMotion) {
            document.querySelector(".game-card").classList.remove("shake");
            void document.querySelector(".game-card").offsetWidth;
            document.querySelector(".game-card").classList.add("shake");
          }
        }
        items.splice(i, 1);
        if (lives <= 0) endGame();
      } else if (item.y > H + 40) {
        items.splice(i, 1);
      }
    }
  }

  function loop(time) {
    if (!running) return;
    if (paused) { lastTime = time; rafId = requestAnimationFrame(loop); return; }
    const delta = Math.min(40, time - (lastTime || time));
    lastTime = time;
    update(delta);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function startGame() {
    score = 0;
    lives = CONFIG.game.lives;
    dogX = W / 2;
    items = [];
    elapsed = 0;
    spawnElapsed = 0;
    paused = false;
    lastTime = 0;
    running = true;
    overlay.classList.add("hidden");
    startPanel.hidden = true;
    endPanel.hidden = true;
    draw();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    cancelAnimationFrame(rafId);
    const best = Math.max(storageGet("sick-game-best", 0), score);
    storageSet("sick-game-best", best);
    document.getElementById("gameScore").textContent = String(score);
    document.getElementById("gameBest").textContent = String(best);
    document.getElementById("gameOverLine").textContent = GAME_OVER_LINES[Math.floor(Math.random() * GAME_OVER_LINES.length)];
    overlay.classList.remove("hidden");
    endPanel.hidden = false;
    startPanel.hidden = true;
    if (window.sickApp) {
      window.sickApp.checkAchievements(best);
      window.sickApp.renderAchievements();
    }
  }

  function setPointer(clientX) {
    if (!running) return;
    const rect = canvas.getBoundingClientRect();
    dogX = Math.max(38, Math.min(W - 38, (clientX - rect.left) / rect.width * W));
  }

  startButton.addEventListener("click", startGame);
  againButton.addEventListener("click", startGame);
  canvas.addEventListener("pointerdown", event => {
    canvas.setPointerCapture?.(event.pointerId);
    setPointer(event.clientX);
  });
  canvas.addEventListener("pointermove", event => {
    if (event.buttons || event.pointerType === "touch") setPointer(event.clientX);
  });
  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (event.key === "ArrowLeft" || key === "a") keys.left = true;
    if (event.key === "ArrowRight" || key === "d") keys.right = true;
  });
  window.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();
    if (event.key === "ArrowLeft" || key === "a") keys.left = false;
    if (event.key === "ArrowRight" || key === "d") keys.right = false;
  });
  function holdButton(button, key) {
    const on = event => { event.preventDefault(); keys[key] = true; };
    const off = event => { event.preventDefault(); keys[key] = false; };
    button.addEventListener("pointerdown", on);
    button.addEventListener("pointerup", off);
    button.addEventListener("pointerleave", off);
  }
  holdButton(leftButton, "left");
  holdButton(rightButton, "right");
  document.addEventListener("visibilitychange", () => {
    paused = document.hidden;
  });
  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  draw();
})();
