// ===== 遊戲設定 =====
const ROWS = 9;
const COLS = 9;
const INITIAL_COLORED = 18;
const NEW_CELLS_PER_TURN = 3;

// 動態消除門檻與等級
let minGroupToClear = 6;   // Lv1: 6 個消除
let level = 1;             // 等級從 1 開始
let lastNotifiedLevel = 1; // 已經顯示過 LvUp 的等級

const COLORS = ["#ff2b2b", "#3498db","#e67e22", "#2ecc71", "#9b59b6"]//, "#e67e22"];
//const COLORS = ["#ff2b2b", "#3498db", "#fff200", "#2ecc71", "#9b59b6", "#e67e22"];
//const COLORS = ["#ff2b2b", "#3498db", "#fff200", "#2ecc71", "#9b59b6", "#e67e22", "#0f0f1079"];
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

let latestSpawnCells = [];   // 記錄本回合新生成的格子

// ===== DOM 取得 =====
const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restartBtn");
const levelEl = document.getElementById("level");
const thresholdEl = document.getElementById("threshold");
const levelUpToast = document.getElementById("levelUpToast");

// LvUp 動畫播完後，自動把 .show 拿掉，避免之後重畫時一直重播
if (levelUpToast) {
  levelUpToast.addEventListener("animationend", () => {
    levelUpToast.classList.remove("show");
  }); 
}

// ===== 初始化 =====
function initGame() {
  board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ color: null, groupSize: 0 }))
  );

  selectedCell = null;
  moves = 0;
  clearedCount = 0;
  //score = 0;
  score = 0;
  gameOver = false;
  lastMoveDest = null;
  latestClearingCells = [];
  isAnimating = false;

  level = 1;
  minGroupToClear = 6;
  lastNotifiedLevel = 1;

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

// 每當分數更新時，根據分數計算等級 & 消除門檻
function updateDifficultyAndUI() {

  if( minGroupToClear < 10 ) {
    const newLevel = 1 + Math.floor(score / 1000);
    level = newLevel;
  } 

  // 基礎門檻 6，每升一級 +1 → Lv1:6, Lv2:7, Lv3:8...
  minGroupToClear = 6 + (level - 1);

  if (levelEl)     levelEl.textContent = level;
  if (thresholdEl) thresholdEl.textContent = minGroupToClear;

  // 只在「這個等級第一次出現」的時候顯示 LvUp 提示
  if (level > lastNotifiedLevel) {
    lastNotifiedLevel = level;
    setMessage(`等級提升為Level ${level}！現在需要 ${minGroupToClear} 個相同顏色才會消除。`);
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

  //選點按鈕後停止levelUpToast
  levelUpToast.classList.remove("show");

  // ✅ 只要點到任何一格（空格 / 有顏色都算），
  // 如果目前有「剛新增」的外框，就先清掉並重畫一次。
  let hadSpawnHighlight = false;
  if (latestSpawnCells.length > 0) {
    latestSpawnCells = [];
    hadSpawnHighlight = true;
  }

  const cell = board[r][c];

  // 沒有選擇的情況：只能選有顏色的格子
  if (!selectedCell) {
    if (cell.color) {
      selectedCell = { r, c };
      renderBoard();                 // 原本就有
    } else if (hadSpawnHighlight) {
      // 點到空格，但我們有清掉外框 → 也要重畫一次讓外框消失
      renderBoard();
    }
    return;
  }


  // 再點同一格：取消選取
  //if (selectedCell.r === r && selectedCell.c === c) {
  //  selectedCell = null;
  //  renderBoard();
  //  return;
  //}

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

  boardEl.appendChild(movingEl);

  let stepIndex = 0;
  function setPosForStep(idx) {
    const { r, c } = path[idx];
    movingEl.style.left = `${c * cellW}px`;
    movingEl.style.top = `${r * cellH}px`;
  }
  setPosForStep(0);

  setTimeout(function goNext() {
    stepIndex++;
    if (stepIndex >= path.length) {
      // 動畫結束：移除浮動方塊，把顏色放到目的地
      boardEl.removeChild(movingEl);

      const destCell = board[to.r][to.c];
      destCell.color = movingColor;

      lastMoveDest = { r: to.r, c: to.c };
      moves++;

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
        setMessage("成功消除！");
        triggerClearAnimation(() => {
          computeGroupSizes(true);  // 真正清除並加分
          computeGroupSizes(false); // 重算 groupSize
          finishTurn();
        });
      } else {
        // 移動後沒有消除 → 新增 3 個顏色
        randomAddColored(NEW_CELLS_PER_TURN);
        computeGroupSizes(false);

        if (latestClearingCells.length > 0) {
          setMessage("新增 3 個顏色後也有消除！");
          triggerClearAnimation(() => {
            computeGroupSizes(true);
            computeGroupSizes(false);
            finishTurn();
          });
        } else {
          setMessage("新增 3 個顏色");
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

      if (size >= minGroupToClear) {
        toClear.push(...group);
        if (clearMode) {
          clearedAny = true;
          score += size * size ;
          clearedCount += size;
        }
      }
    }
  }

  latestClearingCells = toClear;

  if (clearMode && toClear.length > 0) {
    toClear.forEach(({ r, c }) => {
      board[r][c].color = null;
      board[r][c].groupSize = 0;
    });
  }

  return clearedAny;
}

// ===== 觸發消除動畫，再真正清除 =====
function triggerClearAnimation(done) {
  if (!latestClearingCells || latestClearingCells.length === 0) {
    done();
    return;
  }

  renderBoard();

  setTimeout(() => {
    done();
  }, 800); // 對應 clearPulse 0.8s
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

  // ✅ 每次新增前，重置「這一回合新增」清單
  latestSpawnCells = [];

  for (let i = 0; i < n; i++) {
    const { r, c } = empties[i];
    board[r][c].color = COLORS[Math.floor(Math.random() * COLORS.length)];
    latestSpawnCells.push({ r, c });  // ✅ 把座標記起來
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

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c].color) continue;
      if (canMoveToAnyEmpty(r, c)) {
        return;
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
  // 先把目前的 LvUp 元素記住
  const toast = document.getElementById("levelUpToast");

  boardEl.innerHTML = "";

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      const div = document.createElement("div");
      div.classList.add("cell");

      if (cell.color) {
        div.classList.add("filled");
        div.style.background = cell.color;
        div.textContent = cell.groupSize || "";

        // ✅ 如果這格是「剛新增的 3 格」之一 → 加上白色外框
        if (latestSpawnCells.some(p => p.r === r && p.c === c)) {
          div.classList.add("newly-added");
        }
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

  if (toast) {
    boardEl.appendChild(toast);
  }

  // 只讓「剛到達」那一格有 moved 動畫一次
  lastMoveDest = null;
}

// ===== LvUp 提示 =====
function showLevelUpToast(level, threshold) {
  if (!levelUpToast) return;

  levelUpToast.textContent = `恭喜您進入第${level}級！需要 ${threshold} 個相同顏色才會消除`;

  levelUpToast.classList.remove("show");
  // 強制 reflow 讓動畫可以重新開始
  void levelUpToast.offsetWidth;
  levelUpToast.classList.add("show");
}

initGame();
