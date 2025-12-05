// ===== 遊戲設定 =====
const ROWS = 9;
const COLS = 9;
const INITIAL_COLORED = 10;
const NEW_CELLS_PER_TURN = 3;
let minGroupToClear = 6;   // 動態消除門檻（起始為 6）
let level = 1;             // 等級，從 1 開始

const COLORS = ["#ff2b2b", "#3498db", "#fff200", "#2ecc71", "#9b59b6", "#e67e22"];
// ===== 狀態 =====
let board = [];

let selectedCell = null;
let moves = 0;
let clearedCount = 0;
let score = 0;
let gameOver = false;

let lastMoveDest = null;
let latestClearingCells = [];
let isAnimating = false; // 動畫進行中時，忽略操作

let debugCount = 0;

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restartBtn");
const levelEl = document.getElementById("level");
const thresholdEl = document.getElementById("threshold");

const levelUpToast = document.getElementById("levelUpToast");

// ===== 初始化 =====
function initGame() {
  board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ color: null, groupSize: 0 }))
  );

  selectedCell = null;
  moves = 0;
  clearedCount = 0;
  score = 0;
  gameOver = false;
  lastMoveDest = null;
  latestClearingCells = [];
  isAnimating = false;

  updateStats();
  setMessage("開始遊戲");

  randomAddColored(INITIAL_COLORED);
  computeGroupSizes(false);
  renderBoard();
}


restartBtn.onclick = initGame;

// ===== UI 顯示 =====
function updateStats() {
  if (scoreEl) scoreEl.textContent = score;
  updateDifficultyAndUI();
}

function updateDifficultyAndUI() {
  const oldLevel = level;

  // 每 1000 分升一級：0~999 分是 Lv1，1000~1999 分是 Lv2 ...
  const newLevel = 1 + Math.floor(score / 100);
  level = newLevel;

  // 基礎門檻 6，每升一級 +1 → Lv1:6, Lv2:7, Lv3:8...
  minGroupToClear = 6 + (level - 1);

  if (levelEl)     levelEl.textContent = level;
  if (thresholdEl) thresholdEl.textContent = minGroupToClear;

  // ▲ 若有「升級」，才顯示訊息 + LvUp 中央提示
  if (newLevel > oldLevel) {
    setMessage(`等級提升為 Lv.${level}！現在需要 ${minGroupToClear} 個相同顏色才會消除。`);
    showLevelUpToast(level, minGroupToClear);
  }
}


function setMessage(msg, gameEnd = false) {
  messageEl.textContent = msg;
  messageEl.classList.toggle("game-over", gameEnd);
}

// ===== 點擊邏輯 =====
function handleCellClick(r, c) {
  if (gameOver || isAnimating) return;

  const cell = board[r][c];

  //test only
  levelUpToast.classList.remove("show");


  // 沒有選擇的情況：只能選有顏色的格子
  if (!selectedCell) {
    if (cell.color) {
      selectedCell = { r, c };
      renderBoard();
    }
    return;
  }

  // 再點同一格：取消選取
  if (selectedCell.r === r && selectedCell.c === c) {
    selectedCell = null;
    renderBoard();
    return;
  }

  // 點到另一個有顏色格：改選
  if (cell.color) {
    selectedCell = { r, c };
    renderBoard();
    return;
  }

  // 點到空格：試著找路徑
  if (!cell.color) {
    const path = findPath(selectedCell.r, selectedCell.c, r, c);
    if (!path) {
      setMessage("無法抵達該空格（路徑需全為空格）");
      selectedCell = null;
      renderBoard();
      return;
    }

    performMoveWithAnimation(selectedCell, { r, c }, path);
  }
}

// ===== 移動動畫 + 遊戲邏輯 =====
function performMoveWithAnimation(from, to, path) {
  if (isAnimating) return;
  isAnimating = true;

  const srcCell = board[from.r][from.c];
  const movingColor = srcCell.color;
  if (!movingColor) {
    isAnimating = false;
    return;
  }

  // 先把起點清空（避免看到兩個一樣的）
  srcCell.color = null;
  srcCell.groupSize = 0;
  renderBoard();

  // 建立浮動方塊
  const rect = boardEl.getBoundingClientRect();
  const cellW = rect.width / COLS;
  const cellH = rect.height / ROWS;

  const movingEl = document.createElement("div");
  movingEl.classList.add("moving-piece");
  movingEl.style.background = movingColor;
  movingEl.style.width = `${cellW}px`;
  movingEl.style.height = `${cellH}px`;

  // 不顯示數字，等移動完由 groupSize 計算再顯示
  // movingEl.textContent = ""; 

  boardEl.appendChild(movingEl);

  // 將 path[0] 設為初始位置
  let stepIndex = 0;
  function setPosForStep(idx) {
    const { r, c } = path[idx];
    movingEl.style.left = `${c * cellW}px`;
    movingEl.style.top = `${r * cellH}px`;
  }
  setPosForStep(0);

  // 給瀏覽器一點時間套用起始位置，再開始移動
setTimeout(function goNext() {
  stepIndex++;
if (stepIndex >= path.length) {
  // 動畫結束：移除浮動方塊，把顏色放到目的地
  boardEl.removeChild(movingEl);

  const destCell = board[to.r][to.c];
  destCell.color = movingColor;

  lastMoveDest = { r: to.r, c: to.c };
  moves++;

  // 一個小收尾函式，最後統一更新畫面 / 狀態
  function finishTurn() {
    selectedCell = null;
    updateStats();
    renderBoard();
    checkGameOver();
    isAnimating = false;
  }

  // 先檢查「移動本身」是否產生可消除群組（先不清，只先標記 latestClearingCells）
  computeGroupSizes(false);

  if (latestClearingCells.length > 0) {
    // 有可消除的 → 播放閃爍動畫，再真正清除
    setMessage("成功消除！");
    triggerClearAnimation(() => {
      // 動畫完後，真正清除並加分
      computeGroupSizes(true);
      // 清除後再重算 groupSize（顯示用）
      computeGroupSizes(false);
      finishTurn();
    });
  } else {
    // 移動後沒有消除 → 新增 3 個顏色
    randomAddColored(NEW_CELLS_PER_TURN);

    // 檢查「新增 3 個顏色」後，有沒有可消除群組
    computeGroupSizes(false);

    if (latestClearingCells.length > 0) {
      setMessage("新增 3 個顏色後也有消除！");
      triggerClearAnimation(() => {
        computeGroupSizes(true);  // 真正清除
        computeGroupSizes(false); // 重算 groupSize
        finishTurn();
      });
    } else {
      // 完全沒有消除
      setMessage("新增 3 個顏色");
      // 已經 computeGroupSizes(false) 過了，直接收尾
      finishTurn();
    }
  }

  return;
}


  setPosForStep(stepIndex);
  setTimeout(goNext, 120); // 每步 0.12 秒
}, 50);
}

// ===== BFS 找完整路徑（含起點與終點） =====
function findPath(sr, sc, tr, tc) {
  const visited = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => false)
  );
  const prev = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null)
  );

  const queue = [{ r: sr, c: sc }];
  visited[sr][sc] = true;

  while (queue.length > 0) {
    const { r, c } = queue.shift();
    if (r === tr && c === tc) {
      // 回溯路徑
      const path = [];
      let cr = tr, cc = tc;
      while (!(cr === sr && cc === sc)) {
        path.push({ r: cr, c: cc });
        const p = prev[cr][cc];
        cr = p.r;
        cc = p.c;
      }
      path.push({ r: sr, c: sc });
      path.reverse();
      return path;
    }

    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc) || visited[nr][nc]) continue;

      // 只能經過「空格」或起點本身
      if ((nr === sr && nc === sc) || !board[nr][nc].color) {
        visited[nr][nc] = true;
        prev[nr][nc] = { r, c };
        queue.push({ r: nr, c: nc });
      }
    }
  }

  return null;
}

// ===== 群組計算 & 消除 =====
function computeGroupSizes(clearMode) {
  // 先把 groupSize 清零
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      board[r][c].groupSize = 0;

  const vis = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => false)
  );

  let toClear = [];
  let clearedAny = false;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c].color || vis[r][c]) continue;

      const color = board[r][c].color;
      const q = [{ r, c }];
      vis[r][c] = true;
      let group = [];

      while (q.length > 0) {
        const { r: cr, c: cc } = q.shift();
        group.push({ r: cr, c: cc });

        for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (!inBounds(nr, nc) || vis[nr][nc]) continue;
          if (board[nr][nc].color === color) {
            vis[nr][nc] = true;
            q.push({ r: nr, c: nc });
          }
        }
      }

      const size = group.length;
      group.forEach(pos => board[pos.r][pos.c].groupSize = size);

      // 不論是否真的要清，都先記錄哪些格子是可消除群組
      if (size >= minGroupToClear) {
        toClear.push(...group);
        if (clearMode) {
          clearedAny = true;
          score += size * size;
          clearedCount += size;
        }
      }

    }
  }

  // 給 renderBoard 畫「clearing」動畫用
  latestClearingCells = toClear;

  // 如果這次是真的要清除，就把顏色清掉
  if (clearMode && toClear.length > 0) {
    toClear.forEach(({ r, c }) => {
      board[r][c].color = null;
      board[r][c].groupSize = 0;
    });
  }

  return clearedAny;
}

// ===== 觸發閃爍動畫，再真正清除 =====
function triggerClearAnimation(done) {
  if (!latestClearingCells || latestClearingCells.length === 0) {
    done();
    return;
  }

  // 先 render 一次，讓 .clearing class 生效，跑 clearPulse 動畫
  renderBoard();

  setTimeout(() => {
    done();
  }, 800); // 對應 CSS 的 0.8 秒
}


// ===== 隨機新增顏色 =====
function randomAddColored(count) {
  const empties = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!board[r][c].color) empties.push({ r, c });

  if (empties.length === 0) return;

  shuffle(empties);
  const n = Math.min(count, empties.length);

  for (let i = 0; i < n; i++) {
    const { r, c } = empties[i];
    board[r][c].color = COLORS[Math.floor(Math.random() * COLORS.length)];
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ===== Game Over 判斷 =====
function checkGameOver() {
  // 還有空格才可能繼續
  let hasEmpty = false;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!board[r][c].color) {
        hasEmpty = true;
        break;
      }
  if (!hasEmpty) {
    gameOver = true;
    setMessage("遊戲結束：棋盤已滿", true);
    return;
  }

  // 檢查是否有任一有顏色格子可以走到任一空格
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c].color) continue;
      if (canMoveToAnyEmpty(r, c)) {
        return; // 還有可走的
      }
    }
  }

  gameOver = true;
  setMessage("遊戲結束：無法再移動", true);
}

function canMoveToAnyEmpty(sr, sc) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c].color) {
        const path = findPath(sr, sc, r, c);
        if (path) return true;
      }
    }
  }
  return false;
}

// ===== 小工具 =====
function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

// ===== Render 棋盤 =====
function renderBoard() {
  // 先記住目前的 levelUpToast 節點（如果還在 DOM 裡）
  const toast = document.getElementById("levelUpToast");

  // 清空棋盤格子（會順便把 toast 移除）
  boardEl.innerHTML = "";

  // 重畫 9x9 棋盤格
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      const div = document.createElement("div");
      div.classList.add("cell");

      if (cell.color) {
        div.classList.add("filled");
        div.style.background = cell.color;
        div.textContent = cell.groupSize || "";
      } else {
        div.classList.add("empty");
        div.textContent = "";
      }

      if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
        div.classList.add("selected");
      }

      if (lastMoveDest && lastMoveDest.r === r && lastMoveDest.c === c) {
        div.classList.add("moved");
      }

      if (latestClearingCells.some(p => p.r === r && p.c === c)) {
        div.classList.add("clearing");
      }

      div.onclick = () => handleCellClick(r, c);
      boardEl.appendChild(div);
    }
  }

  // 最後再把 toast 放回棋盤裡（保持在最上層）
  if (toast) {
    boardEl.appendChild(toast);
  }

  // 只讓「剛到達」那一格有 moved 動畫一次
  lastMoveDest = null;
}

function showLevelUpToast(level, threshold) {
  if (!levelUpToast) return;

  debugCount = debugCount + 1;
  levelUpToast.textContent = `${debugCount}.Lv.${level}！需要 ${threshold} 個相同顏色才會消除`;

  // 重新觸發 CSS 動畫
  levelUpToast.classList.remove("show");
  // 強制重排讓動畫可以重新開始
  void levelUpToast.offsetWidth;
  levelUpToast.classList.add("show");
}

initGame();
