import "./styles.css";

const board = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const gameMessage = document.querySelector("#game-message");
const gameMessageTitle = document.querySelector("#game-message-title");
const continueButton = document.querySelector("#continue-button");
const restartButtons = document.querySelectorAll('[data-action="restart"]');
const size = 4;
const swipeThreshold = 32;
const bestScoreStorageKey = "2048-best-score";
const winningTileValue = 2048;
let tiles = Array(size * size).fill(null);
let touchStartPoint = null;
let lastDirection = null;
let score = 0;
let bestScore = Number(localStorage.getItem(bestScoreStorageKey)) || 0;
let isGameOver = false;
let hasWon = false;
let nextTileId = 1;
let lineAnimationTimer = null;

function createBoard() {
  const cells = Array.from({ length: size * size }, (_, index) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `第 ${index + 1} 个格子`);
    return cell;
  });

  board.setAttribute("role", "grid");
  board.setAttribute("aria-rowcount", String(size));
  board.setAttribute("aria-colcount", String(size));
  board.replaceChildren(...cells);
}

function getEmptyIndexes() {
  return tiles
    .map((tile, index) => (tile === null ? index : null))
    .filter((index) => index !== null);
}

function getMaxTileValue() {
  return Math.max(...tiles.filter((tile) => tile !== null).map((tile) => tile.value), 0);
}

function getRandomTileValue() {
  if (getMaxTileValue() <= 256) {
    return 2;
  }

  return Math.random() < 0.5 ? 2 : 4;
}

function createTile(value, options = {}) {
  return {
    id: nextTileId,
    value,
    isNew: Boolean(options.isNew),
    isMerged: Boolean(options.isMerged),
  };
}

function getLineIndexes(direction) {
  const lines = [];

  for (let position = 0; position < size; position += 1) {
    const line = [];

    for (let offset = 0; offset < size; offset += 1) {
      if (direction === "up") {
        line.push(offset * size + position);
      }

      if (direction === "down") {
        line.push((size - 1 - offset) * size + position);
      }

      if (direction === "left") {
        line.push(position * size + offset);
      }

      if (direction === "right") {
        line.push(position * size + (size - 1 - offset));
      }
    }

    lines.push(line);
  }

  return lines;
}

function mergeLine(line) {
  const values = line.filter((tile) => tile !== null);
  const merged = [];
  let gainedScore = 0;

  for (let index = 0; index < values.length; index += 1) {
    if (values[index + 1] && values[index].value === values[index + 1].value) {
      const mergedValue = values[index].value * 2;
      merged.push({
        ...values[index],
        value: mergedValue,
        isMerged: true,
        isNew: false,
      });
      gainedScore += mergedValue;
      index += 1;
    } else {
      merged.push({
        ...values[index],
        isMerged: false,
        isNew: false,
      });
    }
  }

  while (merged.length < size) {
    merged.push(null);
  }

  return {
    line: merged,
    gainedScore,
  };
}

function getMovedTiles(direction, sourceTiles) {
  const nextTiles = [...sourceTiles];
  const lines = getLineIndexes(direction);
  let gainedScore = 0;
  const changedLineIndexes = [];

  lines.forEach((lineIndexes, lineNumber) => {
    const line = lineIndexes.map((index) => sourceTiles[index]);
    const mergedLine = mergeLine(line);
    gainedScore += mergedLine.gainedScore;
    const lineChanged = lineIndexes.some((tileIndex, lineIndex) => {
      const sourceTile = sourceTiles[tileIndex];
      const nextTile = mergedLine.line[lineIndex];
      return sourceTile?.id !== nextTile?.id || sourceTile?.value !== nextTile?.value;
    });

    if (lineChanged) {
      changedLineIndexes.push(lineNumber);
    }

    lineIndexes.forEach((tileIndex, lineIndex) => {
      nextTiles[tileIndex] = mergedLine.line[lineIndex];
    });
  });

  return {
    tiles: nextTiles,
    gainedScore,
    changedLineIndexes,
    hasChanged: nextTiles.some((tile, index) => {
      const sourceTile = sourceTiles[index];
      return tile?.id !== sourceTile?.id || tile?.value !== sourceTile?.value;
    }),
  };
}

function moveTiles(direction) {
  const result = getMovedTiles(direction, tiles);
  tiles = result.tiles;
  return result;
}

function canMove(direction) {
  return getMovedTiles(direction, tiles).hasChanged;
}

function hasAvailableMove() {
  return ["up", "right", "down", "left"].some((direction) => canMove(direction));
}

function addRandomTile() {
  const emptyIndexes = getEmptyIndexes();

  if (emptyIndexes.length === 0) {
    return;
  }

  const randomIndex = Math.floor(Math.random() * emptyIndexes.length);
  const tileIndex = emptyIndexes[randomIndex];
  tiles[tileIndex] = createTile(getRandomTileValue(), { isNew: true });
  nextTileId += 1;
}

function updateBestScore() {
  if (score <= bestScore) {
    return;
  }

  bestScore = score;
  localStorage.setItem(bestScoreStorageKey, String(bestScore));
}

function getTileRects() {
  const tileRects = new Map();

  board.querySelectorAll(".tile").forEach((tileElement) => {
    tileRects.set(tileElement.dataset.tileId, tileElement.getBoundingClientRect());
  });

  return tileRects;
}

function clearAnimationFlags() {
  tiles = tiles.map((tile) =>
    tile
      ? {
          ...tile,
          isNew: false,
          isMerged: false,
        }
      : null,
  );
}

function renderBoard(options = {}) {
  const previousRects = options.animate ? getTileRects() : new Map();
  const cells = board.querySelectorAll(".cell");
  updateBestScore();
  scoreElement.textContent = score;
  bestScoreElement.textContent = bestScore;

  tiles.forEach((tile, index) => {
    const cell = cells[index];
    cell.replaceChildren();
    cell.dataset.value = tile?.value ?? "";
    cell.setAttribute(
      "aria-label",
      tile === null ? `第 ${index + 1} 个格子，空` : `第 ${index + 1} 个格子，数字 ${tile.value}`,
    );

    if (!tile) {
      return;
    }

    const tileElement = document.createElement("div");
    tileElement.className = "tile";
    tileElement.dataset.value = tile.value;
    tileElement.dataset.tileId = tile.id;

    const tileContent = document.createElement("span");
    tileContent.className = "tile-content";
    tileContent.textContent = tile.value;
    tileElement.appendChild(tileContent);

    if (tile.isNew) {
      tileElement.classList.add("tile--new");
    }

    if (tile.isMerged) {
      tileElement.classList.add("tile--merged");
    }

    cell.appendChild(tileElement);

    const previousRect = previousRects.get(String(tile.id));

    if (previousRect) {
      const nextRect = tileElement.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (deltaX !== 0 || deltaY !== 0) {
        tileElement.classList.add("tile--moving");
        tileElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        tileElement.style.transition = "none";

        requestAnimationFrame(() => {
          tileElement.style.transition = "";
          tileElement.style.transform = "";
        });

        window.setTimeout(() => {
          tileElement.classList.remove("tile--moving");
        }, 160);
      }
    }
  });

  window.setTimeout(clearAnimationFlags, 360);
}

function playLineEdgeAnimation(direction, changedLineIndexes) {
  const cells = board.querySelectorAll(".cell");
  const lines = getLineIndexes(direction);
  const edgeClasses = ["cell--edge-up", "cell--edge-right", "cell--edge-down", "cell--edge-left"];
  const className = `cell--edge-${direction}`;

  window.clearTimeout(lineAnimationTimer);
  cells.forEach((cell) => {
    cell.classList.remove(...edgeClasses);
  });

  requestAnimationFrame(() => {
    changedLineIndexes.forEach((lineIndex) => {
      const targetEdgeCellIndex = lines[lineIndex][0];
      cells[targetEdgeCellIndex].classList.add(className);
    });
  });

  lineAnimationTimer = window.setTimeout(() => {
    cells.forEach((cell) => {
      cell.classList.remove(...edgeClasses);
    });
  }, 300);
}

function showMessage(title, options = {}) {
  gameMessageTitle.textContent = title;
  continueButton.hidden = !options.canContinue;
  gameMessage.hidden = false;
}

function hideMessage() {
  gameMessage.hidden = true;
}

function showGameOver() {
  isGameOver = true;
  showMessage("游戏结束");
}

function checkWin() {
  if (hasWon || getMaxTileValue() < winningTileValue) {
    return false;
  }

  hasWon = true;
  showMessage("胜利！达到 2048", { canContinue: true });
  return true;
}

function checkGameOver() {
  if (getEmptyIndexes().length > 0 || hasAvailableMove()) {
    return false;
  }

  showGameOver();
  return true;
}

function startGame() {
  tiles = Array(size * size).fill(null);
  score = 0;
  isGameOver = false;
  hasWon = false;
  nextTileId = 1;
  hideMessage();
  addRandomTile();
  addRandomTile();
  renderBoard();
}

function handleMove(direction) {
  if (isGameOver || !gameMessage.hidden) {
    return;
  }

  lastDirection = direction;
  board.dataset.lastDirection = direction;

  const result = moveTiles(direction);

  if (!result.hasChanged) {
    checkGameOver();
    return;
  }

  score += result.gainedScore;
  addRandomTile();
  renderBoard({ animate: true });
  playLineEdgeAnimation(direction, result.changedLineIndexes);
  checkWin();
  checkGameOver();
}

function handleKeyDown(event) {
  const keyDirectionMap = {
    ArrowUp: "up",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowLeft: "left",
  };
  const direction = keyDirectionMap[event.key];

  if (!direction) {
    return;
  }

  event.preventDefault();
  handleMove(direction);
}

function handleTouchStart(event) {
  const touch = event.changedTouches[0];
  touchStartPoint = {
    x: touch.clientX,
    y: touch.clientY,
  };
}

function handleTouchEnd(event) {
  if (!touchStartPoint) {
    return;
  }

  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartPoint.x;
  const deltaY = touch.clientY - touchStartPoint.y;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  touchStartPoint = null;

  if (Math.max(absX, absY) < swipeThreshold) {
    return;
  }

  const direction =
    absX > absY ? (deltaX > 0 ? "right" : "left") : deltaY > 0 ? "down" : "up";

  event.preventDefault();
  handleMove(direction);
}

function bindControls() {
  document.addEventListener("keydown", handleKeyDown);
  board.addEventListener("touchstart", handleTouchStart, { passive: true });
  board.addEventListener("touchend", handleTouchEnd);
  restartButtons.forEach((button) => {
    button.addEventListener("click", startGame);
  });
  continueButton.addEventListener("click", hideMessage);
}

createBoard();
bindControls();
startGame();
