/* ============================================
   CUSTOMIZATION AND ADJUSTMENT — JAVASCRIPT
   Modify the values below to customize
   images, positions, sizes, and gameplay.
   ============================================ */

const CONFIG = {
  // Image paths are relative to index.html. Missing images use Canvas drawings.
  assets: {
    runner: "assets/runner.png",
    obstacle1: "assets/obstacle1.png",
    obstacle2: "assets/obstacle2.png",
    background: "assets/background.png",
    doodad1: "assets/doodad1.png",
    doodad2: "assets/doodad2.png"
  },

  // Runner position, display size, image offset, jump physics, and hitbox padding.
  runner: {
    x: 145,
    yOffset: 0,
    maxWidth: 111,
    maxHeight: 138,
    imageOffsetX: 0,
    imageOffsetY: 0,
    jumpStrength: 850,
    gravity: 1800,
    hitboxPaddingX: 13,
    hitboxPaddingY: 10
  },

  // Goblin display size, image offset, ground position, and hitbox padding.
  obstacle1: {
    maxWidth: 60,
    maxHeight: 72,
    imageOffsetX: 0,
    imageOffsetY: 0,
    groundOffset: 0,
    hitboxPaddingX: 10,
    hitboxPaddingY: 8
  },

  // Evil knight display size, image offset, ground position, and hitbox padding.
  obstacle2: {
    maxWidth: 108,
    maxHeight: 135,
    imageOffsetX: 0,
    imageOffsetY: 0,
    groundOffset: 0,
    hitboxPaddingX: 18,
    hitboxPaddingY: 14
  },

  // Background image positioning, scale, scroll speed, fallback color, and alignment.
  background: {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    scrollSpeed: 35,
    fallbackColor: "#827b6c",
    alignment: "center"
  },

  // Ghost scenery: individual, slow-moving decoration in the upper hall.
  doodad1: {
    x: 720,
    y: 105,
    maxWidth: 58,
    maxHeight: 76,
    imageOffsetX: 0,
    imageOffsetY: 0,
    repeat: false,
    spacing: 0,
    scrollSpeed: 22
  },

  // Raven scenery: repeated, faster-moving decoration near the arches.
  doodad2: {
    x: 0,
    y: 75,
    maxWidth: 48,
    maxHeight: 38,
    imageOffsetX: 0,
    imageOffsetY: 0,
    repeat: true,
    spacing: 245,
    scrollSpeed: 48
  },

  // Starting and maximum speeds, difficulty growth, and obstacle spacing.
  gameplay: {
    startingSpeed: 330,
    maxSpeed: 620,
    difficultyIncrease: 7,
    minObstacleSpacing: 300,
    maxObstacleSpacing: 520
  },

  // Optional collision hitbox outlines for debugging.
  debug: {
    showHitboxes: false,
    runnerHitboxColor: "#00FF00",
    obstacleHitboxColor: "#FF0000",
    hitboxLineWidth: 2
  }
};

/* ============================================
   END OF CUSTOMIZATION AND ADJUSTMENT
   GAME LOGIC BELOW
   ============================================ */

(() => {
  "use strict";

  const WIDTH = 960;
  const HEIGHT = 450;
  const GROUND_Y = 382;
  const STORAGE_KEY = "knightRunnerHighScore";

  const elements = {
    gameCanvas: document.getElementById("gameCanvas"),
    gameTitle: document.getElementById("gameTitle"),
    gameDescription: document.getElementById("gameDescription"),
    gameInstructions: document.getElementById("gameInstructions"),
    scoreDisplay: document.getElementById("scoreDisplay"),
    highScoreDisplay: document.getElementById("highScoreDisplay"),
    gameOverlay: document.getElementById("gameOverlay"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayMessage: document.getElementById("overlayMessage"),
    startButton: document.getElementById("startButton"),
    assetStatus: document.getElementById("assetStatus")
  };

  const requiredIds = Object.keys(elements);
  const missingIds = requiredIds.filter((id) => !elements[id]);

  if (missingIds.length > 0) {
    console.error("Knight Runner is missing HTML elements:", missingIds.join(", "));
    return;
  }

  const ctx = elements.gameCanvas.getContext("2d");
  if (!ctx) {
    elements.assetStatus.textContent = "Your browser could not start the game canvas.";
    return;
  }

  elements.gameCanvas.width = WIDTH;
  elements.gameCanvas.height = HEIGHT;

  const startText = elements.startButton.dataset.startText || "Start Game";
  const restartText = elements.startButton.dataset.restartText || "Restart Game";

  const images = {};
  const fallbackAssets = createFallbackAssets();

  let state = "ready";
  let animationFrameId = null;
  let lastFrameTime = 0;
  let elapsedTime = 0;
  let distance = 0;
  let score = 0;
  let speed = CONFIG.gameplay.startingSpeed;
  let nextObstacleDistance = 0;
  let backgroundScroll = 0;
  let doodad1Scroll = 0;
  let doodad2Scroll = 0;

  const runner = {
    x: CONFIG.runner.x,
    feetY: GROUND_Y + CONFIG.runner.yOffset,
    width: 0,
    height: 0,
    velocityY: 0,
    onGround: true,
    animationTime: 0
  };

  const obstacles = [];

  function loadHighScore() {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(saved) && saved > 0 ? saved : 0;
    } catch (error) {
      return 0;
    }
  }

  let highScore = loadHighScore();

  function saveHighScore(value) {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch (error) {
      // The game still works if browser storage is disabled.
    }
  }

  function updateScoreDisplays() {
    elements.scoreDisplay.textContent = String(Math.floor(score));
    elements.highScoreDisplay.textContent = String(Math.floor(highScore));
  }

  function loadImage(key, path) {
    return new Promise((resolve) => {
      const image = new Image();

      image.onload = () => {
        images[key] = image;
        resolve(true);
      };

      image.onerror = () => {
        images[key] = null;
        resolve(false);
      };

      image.src = path;
    });
  }

  function loadAssets() {
    const assetEntries = Object.entries(CONFIG.assets);
    return Promise.all(
      assetEntries.map(([key, path]) => loadImage(key, path))
    );
  }

  function fitImage(image, maxWidth, maxHeight) {
    if (!image || !image.naturalWidth || !image.naturalHeight) {
      return { width: maxWidth, height: maxHeight };
    }

    const scale = Math.min(
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight
    );

    return {
      width: image.naturalWidth * scale,
      height: image.naturalHeight * scale
    };
  }

  function getAssetSize(key, maxWidth, maxHeight) {
    const image = images[key];
    if (image) {
      return fitImage(image, maxWidth, maxHeight);
    }

    const fallback = fallbackAssets[key];
    return { width: fallback.width, height: fallback.height };
  }

  function refreshObjectSizes() {
    const runnerSize = getAssetSize(
      "runner",
      CONFIG.runner.maxWidth,
      CONFIG.runner.maxHeight
    );

    runner.width = runnerSize.width;
    runner.height = runnerSize.height;

    obstacles.forEach((obstacle) => {
      const config = obstacle.type === "obstacle1"
        ? CONFIG.obstacle1
        : CONFIG.obstacle2;
      const size = getAssetSize(obstacle.type, config.maxWidth, config.maxHeight);
      obstacle.width = size.width;
      obstacle.height = size.height;
    });
  }

  function drawContained(key, x, y, maxWidth, maxHeight) {
    const image = images[key];

    if (image) {
      const size = fitImage(image, maxWidth, maxHeight);
      ctx.drawImage(image, x, y, size.width, size.height);
    } else {
      const fallback = fallbackAssets[key];
      ctx.drawImage(fallback.canvas, x, y, fallback.width, fallback.height);
    }
  }

  function drawBackground() {
    const image = images.background;

    if (!image) {
      drawFallbackBackground();
      return;
    }

    const coverScale = Math.max(
      WIDTH / image.naturalWidth,
      HEIGHT / image.naturalHeight
    ) * CONFIG.background.scale;

    const drawWidth = image.naturalWidth * coverScale;
    const drawHeight = image.naturalHeight * coverScale;
    let y = (HEIGHT - drawHeight) / 2 + CONFIG.background.offsetY;

    if (CONFIG.background.alignment === "top") {
      y = CONFIG.background.offsetY;
    } else if (CONFIG.background.alignment === "bottom") {
      y = HEIGHT - drawHeight + CONFIG.background.offsetY;
    }

    const extraWidth = Math.max(0, drawWidth - WIDTH);
    const tileWidth = drawWidth;
    const scrollableWidth = Math.max(1, tileWidth - WIDTH);
    backgroundScroll = (backgroundScroll + CONFIG.background.scrollSpeed * frameDelta) % scrollableWidth;

    let x = CONFIG.background.offsetX - backgroundScroll;
    while (x > 0) x -= tileWidth;
    while (x + tileWidth < WIDTH) x += tileWidth;

    for (; x < WIDTH; x += tileWidth) {
      ctx.drawImage(image, x, y, drawWidth, drawHeight);
    }

    // If the source image is narrower than the canvas, cover its sides with the same image.
    if (extraWidth === 0 && tileWidth < WIDTH) {
      ctx.drawImage(image, x, y, drawWidth, drawHeight);
    }
  }

  function drawFallbackBackground() {
    ctx.fillStyle = CONFIG.background.fallbackColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const shift = backgroundScroll % 300;

    // Repeating stone arches suggest a long castle corridor.
    for (let x = -300 - shift; x < WIDTH + 300; x += 300) {
      ctx.fillStyle = "#5f5a51";
      ctx.fillRect(x + 24, 52, 252, 286);

      ctx.fillStyle = "#aaa18e";
      ctx.beginPath();
      ctx.arc(x + 150, 130, 118, Math.PI, 0);
      ctx.lineTo(x + 268, 338);
      ctx.lineTo(x + 32, 338);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#4d4942";
      ctx.beginPath();
      ctx.arc(x + 150, 138, 85, Math.PI, 0);
      ctx.lineTo(x + 235, 338);
      ctx.lineTo(x + 65, 338);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#776f61";
      ctx.fillRect(x + 18, 335, 264, 12);
      ctx.fillStyle = "#c0b49a";
      ctx.fillRect(x + 25, 341, 250, 4);
    }

    // Clear, slightly textured stone floor area.
    ctx.fillStyle = "#70695e";
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
    ctx.fillStyle = "#a39a88";
    ctx.fillRect(0, GROUND_Y, WIDTH, 5);

    for (let x = -40 - (shift % 80); x < WIDTH; x += 80) {
      ctx.strokeStyle = "rgba(45, 42, 37, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 7);
      ctx.lineTo(x + 34, HEIGHT);
      ctx.stroke();
    }
  }

  function createFallbackAssets() {
    const assets = {
      runner: makeFallbackCanvas(74, 92, drawRunnerFallback),
      obstacle1: makeFallbackCanvas(60, 72, drawObstacle1Fallback),
      obstacle2: makeFallbackCanvas(72, 90, drawObstacle2Fallback),
      doodad1: makeFallbackCanvas(58, 76, drawDoodad1Fallback),
      doodad2: makeFallbackCanvas(48, 38, drawDoodad2Fallback)
    };

    return assets;
  }

  function makeFallbackCanvas(width, height, drawFunction) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const drawingContext = canvas.getContext("2d");
    drawFunction(drawingContext, width, height);
    return { canvas, width, height };
  }

  function drawRunnerFallback(drawingContext, width, height) {
    drawingContext.save();
    drawingContext.translate(0, Math.sin(performance.now() / 110) * 1.2);

    // Short cape.
    drawingContext.fillStyle = "#742e2b";
    drawingContext.beginPath();
    drawingContext.moveTo(29, 37);
    drawingContext.lineTo(8, 68);
    drawingContext.lineTo(35, 61);
    drawingContext.closePath();
    drawingContext.fill();

    // Legs and boots.
    drawingContext.fillStyle = "#34302c";
    drawingContext.fillRect(28, 67, 11, 17);
    drawingContext.fillRect(43, 66, 10, 18);
    drawingContext.fillStyle = "#b68b50";
    drawingContext.fillRect(25, 81, 18, 7);
    drawingContext.fillRect(41, 81, 19, 7);

    // Tunic and belt.
    drawingContext.fillStyle = "#55705a";
    drawingContext.fillRect(27, 37, 30, 34);
    drawingContext.fillStyle = "#c19a5c";
    drawingContext.fillRect(27, 61, 30, 6);
    drawingContext.fillRect(39, 61, 6, 6);

    // Arm.
    drawingContext.fillStyle = "#d6bd94";
    drawingContext.fillRect(50, 43, 9, 20);

    // Helmet and face.
    drawingContext.fillStyle = "#bfc1bc";
    drawingContext.beginPath();
    drawingContext.arc(43, 25, 20, Math.PI, 0);
    drawingContext.lineTo(63, 42);
    drawingContext.lineTo(25, 42);
    drawingContext.closePath();
    drawingContext.fill();
    drawingContext.fillRect(26, 36, 34, 8);

    drawingContext.fillStyle = "#554d42";
    drawingContext.fillRect(35, 31, 22, 5);
    drawingContext.fillRect(52, 27, 8, 4);

    // Face, eye, and helmet plume.
    drawingContext.fillStyle = "#d6bd94";
    drawingContext.fillRect(43, 39, 13, 12);
    drawingContext.fillStyle = "#292724";
    drawingContext.fillRect(52, 41, 3, 3);

    drawingContext.fillStyle = "#8c3930";
    drawingContext.beginPath();
    drawingContext.moveTo(42, 8);
    drawingContext.lineTo(54, 0);
    drawingContext.lineTo(52, 15);
    drawingContext.closePath();
    drawingContext.fill();

    drawingContext.restore();
  }

  function drawObstacle1Fallback(drawingContext) {
    // Green goblin with pointed ears and a small tunic.
    drawingContext.fillStyle = "#536e45";
    drawingContext.beginPath();
    drawingContext.arc(30, 25, 20, 0, Math.PI * 2);
    drawingContext.fill();
    drawingContext.beginPath();
    drawingContext.moveTo(14, 22);
    drawingContext.lineTo(1, 10);
    drawingContext.lineTo(18, 15);
    drawingContext.fill();
    drawingContext.beginPath();
    drawingContext.moveTo(45, 19);
    drawingContext.lineTo(59, 8);
    drawingContext.lineTo(48, 29);
    drawingContext.fill();

    drawingContext.fillStyle = "#e9d9b2";
    drawingContext.fillRect(25, 26, 4, 8);
    drawingContext.fillRect(40, 26, 4, 8);

    drawingContext.fillStyle = "#594c40";
    drawingContext.fillRect(16, 43, 31, 23);
    drawingContext.fillStyle = "#a17a4a";
    drawingContext.fillRect(16, 44, 31, 6);
    drawingContext.fillRect(17, 64, 10, 7);
    drawingContext.fillRect(37, 64, 10, 7);
  }

  function drawObstacle2Fallback(drawingContext) {
    // Dark armored rival knight with a distinct tall silhouette.
    drawingContext.fillStyle = "#34373a";
    drawingContext.fillRect(19, 33, 36, 42);
    drawingContext.fillStyle = "#6b7477";
    drawingContext.fillRect(21, 37, 32, 5);
    drawingContext.fillRect(34, 36, 6, 37);

    drawingContext.fillStyle = "#4b5052";
    drawingContext.beginPath();
    drawingContext.moveTo(16, 31);
    drawingContext.lineTo(20, 10);
    drawingContext.lineTo(47, 10);
    drawingContext.lineTo(57, 29);
    drawingContext.lineTo(49, 38);
    drawingContext.lineTo(21, 38);
    drawingContext.closePath();
    drawingContext.fill();

    drawingContext.fillStyle = "#c5b88f";
    drawingContext.fillRect(29, 24, 20, 5);
    drawingContext.fillStyle = "#9b3731";
    drawingContext.fillRect(40, 24, 8, 3);

    drawingContext.fillStyle = "#252729";
    drawingContext.fillRect(20, 72, 14, 12);
    drawingContext.fillRect(42, 72, 14, 12);
    drawingContext.fillStyle = "#9b3731";
    drawingContext.beginPath();
    drawingContext.moveTo(22, 38);
    drawingContext.lineTo(8, 66);
    drawingContext.lineTo(22, 61);
    drawingContext.closePath();
    drawingContext.fill();
  }

  function drawDoodad1Fallback(drawingContext) {
    // Pale cartoon ghost.
    drawingContext.fillStyle = "rgba(226, 226, 213, 0.78)";
    drawingContext.beginPath();
    drawingContext.arc(29, 27, 21, Math.PI, 0);
    drawingContext.lineTo(50, 62);
    drawingContext.lineTo(41, 56);
    drawingContext.lineTo(32, 64);
    drawingContext.lineTo(22, 56);
    drawingContext.lineTo(11, 63);
    drawingContext.lineTo(8, 38);
    drawingContext.closePath();
    drawingContext.fill();

    drawingContext.fillStyle = "#4f4e49";
    drawingContext.beginPath();
    drawingContext.arc(22, 29, 3, 0, Math.PI * 2);
    drawingContext.arc(37, 29, 3, 0, Math.PI * 2);
    drawingContext.fill();

    drawingContext.beginPath();
    drawingContext.arc(30, 40, 5, 0, Math.PI);
    drawingContext.strokeStyle = "#4f4e49";
    drawingContext.lineWidth = 2;
    drawingContext.stroke();
  }

  function drawDoodad2Fallback(drawingContext) {
    // Raven silhouette with a small beak and wing.
    drawingContext.fillStyle = "#292b2d";
    drawingContext.beginPath();
    drawingContext.ellipse(23, 20, 17, 11, 0, 0, Math.PI * 2);
    drawingContext.fill();
    drawingContext.beginPath();
    drawingContext.arc(36, 12, 8, 0, Math.PI * 2);
    drawingContext.fill();
    drawingContext.beginPath();
    drawingContext.moveTo(42, 11);
    drawingContext.lineTo(48, 14);
    drawingContext.lineTo(41, 17);
    drawingContext.fill();
    drawingContext.beginPath();
    drawingContext.moveTo(14, 19);
    drawingContext.lineTo(0, 9);
    drawingContext.lineTo(7, 26);
    drawingContext.closePath();
    drawingContext.fill();

    drawingContext.fillStyle = "#b68b50";
    drawingContext.fillRect(35, 10, 2, 2);
  }

  let frameDelta = 0;

  function drawDoodad(key, config, scrollAmount) {
    const asset = images[key];
    const fallback = fallbackAssets[key];
    const size = asset
      ? fitImage(asset, config.maxWidth, config.maxHeight)
      : { width: fallback.width, height: fallback.height };

    const drawOne = (x) => {
      drawContained(
        key,
        x + config.imageOffsetX,
        config.y + config.imageOffsetY,
        config.maxWidth,
        config.maxHeight
      );
    };

    if (!config.repeat) {
      drawOne(config.x - scrollAmount);
      return;
    }

    const step = Math.max(1, size.width + Math.max(0, config.spacing));
    const offset = scrollAmount % step;
    let x = config.x - offset;

    while (x > 0) x -= step;
    while (x + size.width < WIDTH) x += step;

    for (; x < WIDTH; x += step) {
      drawOne(x);
    }
  }

  function drawScenery(delta) {
    doodad1Scroll += CONFIG.doodad1.scrollSpeed * delta;
    doodad2Scroll += CONFIG.doodad2.scrollSpeed * delta;

    drawDoodad("doodad1", CONFIG.doodad1, doodad1Scroll);
    drawDoodad("doodad2", CONFIG.doodad2, doodad2Scroll);
  }

  function getRunnerRect() {
    const left = runner.x - runner.width / 2 + CONFIG.runner.imageOffsetX;
    const top = runner.feetY - runner.height + CONFIG.runner.imageOffsetY;

    return {
      x: left + CONFIG.runner.hitboxPaddingX,
      y: top + CONFIG.runner.hitboxPaddingY,
      width: Math.max(0, runner.width - CONFIG.runner.hitboxPaddingX * 2),
      height: Math.max(0, runner.height - CONFIG.runner.hitboxPaddingY * 2)
    };
  }

  function getObstacleRect(obstacle) {
    const config = obstacle.type === "obstacle1"
      ? CONFIG.obstacle1
      : CONFIG.obstacle2;

    const left = obstacle.x - obstacle.width / 2 + config.imageOffsetX;
    const top = obstacle.feetY - obstacle.height + config.imageOffsetY;

    return {
      x: left + config.hitboxPaddingX,
      y: top + config.hitboxPaddingY,
      width: Math.max(0, obstacle.width - config.hitboxPaddingX * 2),
      height: Math.max(0, obstacle.height - config.hitboxPaddingY * 2)
    };
  }

  function rectanglesOverlap(first, second) {
    return first.x < second.x + second.width &&
      first.x + first.width > second.x &&
      first.y < second.y + second.height &&
      first.y + first.height > second.y;
  }

  function drawRunner() {
    const x = runner.x - runner.width / 2 + CONFIG.runner.imageOffsetX;
    const y = runner.feetY - runner.height + CONFIG.runner.imageOffsetY;
    drawContained(
      "runner",
      x,
      y,
      CONFIG.runner.maxWidth,
      CONFIG.runner.maxHeight
    );
  }

  function drawObstacle(obstacle) {
    const config = obstacle.type === "obstacle1"
      ? CONFIG.obstacle1
      : CONFIG.obstacle2;
    const x = obstacle.x - obstacle.width / 2 + config.imageOffsetX;
    const y = obstacle.feetY - obstacle.height + config.imageOffsetY;

    drawContained(
      obstacle.type,
      x,
      y,
      config.maxWidth,
      config.maxHeight
    );
  }

  function drawHitboxes() {
    if (!CONFIG.debug.showHitboxes) return;

    ctx.save();
    ctx.lineWidth = CONFIG.debug.hitboxLineWidth;
    ctx.strokeStyle = CONFIG.debug.runnerHitboxColor;
    const runnerRect = getRunnerRect();
    ctx.strokeRect(runnerRect.x, runnerRect.y, runnerRect.width, runnerRect.height);

    ctx.strokeStyle = CONFIG.debug.obstacleHitboxColor;
    obstacles.forEach((obstacle) => {
      const obstacleRect = getObstacleRect(obstacle);
      ctx.strokeRect(
        obstacleRect.x,
        obstacleRect.y,
        obstacleRect.width,
        obstacleRect.height
      );
    });
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawBackground();
    drawScenery(frameDelta);

    obstacles.forEach(drawObstacle);
    drawRunner();
    drawHitboxes();
  }

  function pickObstacleType() {
    return Math.random() < 0.5 ? "obstacle1" : "obstacle2";
  }

  function spawnObstacle() {
    const type = pickObstacleType();
    const config = type === "obstacle1" ? CONFIG.obstacle1 : CONFIG.obstacle2;
    const size = getAssetSize(type, config.maxWidth, config.maxHeight);

    obstacles.push({
      type,
      x: WIDTH + size.width / 2,
      feetY: GROUND_Y + config.groundOffset,
      width: size.width,
      height: size.height,
      passed: false
    });

    const range = Math.max(
      0,
      CONFIG.gameplay.maxObstacleSpacing - CONFIG.gameplay.minObstacleSpacing
    );
    nextObstacleDistance = distance + CONFIG.gameplay.minObstacleSpacing +
      Math.random() * range;
  }

  function beginGame() {
    if (state === "playing") return;

    state = "playing";
    elapsedTime = 0;
    distance = 0;
    score = 0;
    speed = CONFIG.gameplay.startingSpeed;
    backgroundScroll = 0;
    doodad1Scroll = 0;
    doodad2Scroll = 0;
    obstacles.length = 0;

    runner.x = CONFIG.runner.x;
    runner.feetY = GROUND_Y + CONFIG.runner.yOffset;
    runner.velocityY = 0;
    runner.onGround = true;
    runner.animationTime = 0;

    nextObstacleDistance = WIDTH * 0.72;
    elements.overlayTitle.textContent = "Ready, Knight?";
    elements.overlayMessage.textContent = "Jump over the obstacles and see how far you can run!";
    elements.startButton.textContent = restartText;
    elements.gameOverlay.hidden = true;
    elements.gameOverlay.style.display = "none";

    updateScoreDisplays();
    lastFrameTime = performance.now();

    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(gameLoop);
    }
  }

  function endGame() {
    if (state !== "playing") return;

    state = "gameover";
    if (score > highScore) {
      highScore = score;
      saveHighScore(highScore);
    }

    updateScoreDisplays();
    elements.overlayTitle.textContent = "Game Over";
    elements.overlayMessage.textContent =
      `Your final score is ${Math.floor(score)}. Ready for another run?`;
    elements.startButton.textContent = restartText;
    elements.gameOverlay.hidden = false;
    elements.gameOverlay.style.display = "flex";
  }

  function jump() {
    if (state !== "playing" || !runner.onGround) return;

    runner.velocityY = -CONFIG.runner.jumpStrength;
    runner.onGround = false;
  }

  function handleKeyDown(event) {
    if (event.code === "Space" || event.code === "ArrowUp") {
      event.preventDefault();
      if (state === "ready" || state === "gameover") {
        beginGame();
      } else {
        jump();
      }
    }
  }

  function handleCanvasPointer() {
    if (state === "ready" || state === "gameover") {
      beginGame();
    } else {
      jump();
    }
  }

  function update(delta) {
    if (state !== "playing") return;

    elapsedTime += delta;
    speed = Math.min(
      CONFIG.gameplay.maxSpeed,
      CONFIG.gameplay.startingSpeed + elapsedTime * CONFIG.gameplay.difficultyIncrease
    );
    distance += speed * delta;
    score = distance / 10;

    backgroundScroll += CONFIG.background.scrollSpeed * delta;

    if (distance >= nextObstacleDistance) {
      spawnObstacle();
    }

    runner.velocityY += CONFIG.runner.gravity * delta;
    runner.feetY += runner.velocityY * delta;

    const ground = GROUND_Y + CONFIG.runner.yOffset;
    if (runner.feetY >= ground) {
      runner.feetY = ground;
      runner.velocityY = 0;
      runner.onGround = true;
    }

    runner.animationTime += delta;

    obstacles.forEach((obstacle) => {
      obstacle.x -= speed * delta;

      if (!obstacle.passed && obstacle.x < runner.x) {
        obstacle.passed = true;
      }
    });

    while (obstacles.length > 0 && obstacles[0].x + obstacles[0].width < 0) {
      obstacles.shift();
    }

    refreshObjectSizes();

    const runnerRect = getRunnerRect();
    for (const obstacle of obstacles) {
      if (rectanglesOverlap(runnerRect, getObstacleRect(obstacle))) {
        endGame();
        break;
      }
    }

    updateScoreDisplays();
  }

  function gameLoop(now) {
    animationFrameId = null;

    const delta = Math.min(Math.max((now - lastFrameTime) / 1000, 0), 0.05);
    lastFrameTime = now;
    frameDelta = delta;

    update(delta);
    render();

    if (state === "playing") {
      animationFrameId = requestAnimationFrame(gameLoop);
    }
  }

  function showAssetStatus(results) {
    const missingCount = results.filter((loaded) => !loaded).length;

    if (missingCount === 0) {
      elements.assetStatus.textContent = "All game images loaded.";
    } else {
      elements.assetStatus.textContent =
        `${missingCount} image${missingCount === 1 ? "" : "s"} unavailable; using built-in drawings.`;
    }
  }

  elements.startButton.addEventListener("click", beginGame);
  window.addEventListener("keydown", handleKeyDown);
  elements.gameCanvas.addEventListener("pointerdown", handleCanvasPointer);

  updateScoreDisplays();
  elements.startButton.textContent = startText;
  elements.gameOverlay.hidden = false;

  refreshObjectSizes();
  render();

  loadAssets().then((results) => {
    showAssetStatus(results);
    refreshObjectSizes();
    render();
  });
})();