// ===============================
// 🎨 Sudoku Puzzle
// ===============================
const PUZZLE =
  "530070000" +
  "600195000" +
  "098000060" +
  "800060003" +
  "400803001" +
  "700020006" +
  "060000280" +
  "000419005" +
  "000080079";

const SIZE = 9;

const boardEl = document.getElementById("board");
const toastEl = document.getElementById("toast");
const resetBtn = document.getElementById("resetBtn");
const clearBtn = document.getElementById("clearBtn");
const notesBtn = document.getElementById("notesBtn");

// 全域狀態
let cells = [];
let fixed = new Set();
let selected = -1;

let notesMode = false;
let notes = Array(81).fill(null).map(() => new Set());

// ===============================
// 初始化按鈕事件（最重要 → 移出 buildBoard）
// ===============================
clearBtn.addEventListener("click", clearSelected);
resetBtn.addEventListener("click", () => buildBoard(PUZZLE));
notesBtn.addEventListener("click", () => {
  notesMode = !notesMode;
  notesBtn.classList.toggle("active", notesMode);
  showToast(notesMode ? "草稿模式：開啟" : "草稿模式：關閉");
});

// ===============================
// 建立棋盤
// ===============================
function buildBoard(puzzleStr) {
  boardEl.innerHTML = "";
  cells = [];
  fixed.clear();
  selected = -1;
  notes = Array(81).fill(null).map(() => new Set());

  for (let i = 0; i < SIZE * SIZE; i++) {
    const ch = puzzleStr[i];
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.tabIndex = 0;
    cell.dataset.index = i;

    // 題目格
    if (ch !== "0") {
      cell.textContent = ch;
      cell.classList.add("given");
      fixed.add(i);
    }

    cell.addEventListener("click", () => selectCell(i));
    cell.addEventListener("keydown", handleKey);

    cells.push(cell);
    boardEl.appendChild(cell);
  }

  // 數字鍵
  document.querySelectorAll(".key").forEach(btn => {
    btn.addEventListener("click", () => placeNumber(btn.dataset.num));
  });
}

// ===============================
// 選取格子 + 行列宮高亮
// ===============================
function selectCell(i) {
  if (i === selected) return;

  clearHighlights();

  if (selected >= 0)
    cells[selected].classList.remove("selected");

  selected = i;
  cells[selected].classList.add("selected");

  const r = Math.floor(i / SIZE);
  const c = i % SIZE;

  highlightGroup(indicesRow(r));
  highlightGroup(indicesCol(c));
  highlightGroup(indicesBox(Math.floor(r / 3), Math.floor(c / 3)));
}

function highlightGroup(indices) {
  indices.forEach(idx => {
    if (idx !== selected)
      cells[idx].classList.add("highlight");
  });
}

function clearHighlights() {
  cells.forEach(c => c.classList.remove("highlight"));
}

// ===============================
// 鍵盤處理
// ===============================
function handleKey(e) {
  if (e.key >= "1" && e.key <= "9") {
    placeNumber(e.key);
    e.preventDefault();
  }
  if (e.key === "Backspace" || e.key === "Delete") {
    clearSelected();
    e.preventDefault();
  }
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
    moveSelection(e.key);
    e.preventDefault();
  }
}

// ===============================
// 移動選擇
// ===============================
function moveSelection(key) {
  if (selected < 0) return;

  const r = Math.floor(selected / SIZE);
  const c = selected % SIZE;
  let nr = r, nc = c;

  if (key === "ArrowUp") nr = Math.max(0, r - 1);
  if (key === "ArrowDown") nr = Math.min(SIZE - 1, r + 1);
  if (key === "ArrowLeft") nc = Math.max(0, c - 1);
  if (key === "ArrowRight") nc = Math.min(SIZE - 1, c + 1);

  selectCell(nr * SIZE + nc);
  cells[selected].focus();
}

// ===============================
// 填入數字（含 Notes）
// ===============================
function placeNumber(n) {
  if (selected < 0)
    return showToast("請先選擇一格");

  if (fixed.has(selected))
    return showToast("題目格不能修改");

  // 草稿模式
  if (notesMode) {
    if (notes[selected].has(n)) notes[selected].delete(n);
    else notes[selected].add(n);

    renderNotes(selected);
    return;
  }

  // 正式輸入
  notes[selected].clear();
  cells[selected].classList.remove("notes");
  cells[selected].textContent = n;

  updateConflicts();
  checkSolved();
}

// ===============================
// Notes 渲染（3×3 迷你九宮格）
// ===============================
function renderNotes(idx) {
  const cell = cells[idx];

  if (notes[idx].size === 0) {
    cell.innerHTML = "";
    cell.textContent = "";
    cell.classList.remove("notes");
    return;
  }

  cell.classList.add("notes");

  let html = '<div class="note-grid">';
  for (let i = 1; i <= 9; i++) {
    html += `<div class="note">${notes[idx].has(i.toString()) ? i : ""}</div>`;
  }
  html += "</div>";

  cell.innerHTML = html;
}

// ===============================
// 清除格子（Notes & 數字都能清除）
// ===============================
function clearSelected() {
  if (selected < 0) return;
  if (fixed.has(selected)) return;  // 題目格不能清除

  // 清 Notes
  notes[selected].clear();
  cells[selected].classList.remove("notes");
  cells[selected].innerHTML = "";
  cells[selected].textContent = "";

  updateConflicts();
}

// ===============================
// 取值工具
// ===============================
function getValueAt(idx) {
  const t = cells[idx].textContent.trim();
  return t === "" ? 0 : Number(t);
}

// ===============================
// 衝突檢查
// ===============================
function updateConflicts() {
  cells.forEach(c => c.classList.remove("conflict"));

  for (let r = 0; r < 9; r++) markConflicts(indicesRow(r));
  for (let c = 0; c < 9; c++) markConflicts(indicesCol(c));
  for (let br = 0; br < 3; br++)
    for (let bc = 0; bc < 3; bc++)
      markConflicts(indicesBox(br, bc));
}

function markConflicts(indices) {
  const seen = new Map();

  for (const i of indices) {
    const v = getValueAt(i);
    if (!v) continue;

    if (seen.has(v)) {
      cells[i].classList.add("conflict");
      cells[seen.get(v)].classList.add("conflict");
    } else {
      seen.set(v, i);
    }
  }
}

// ===============================
// indices 工具
// ===============================
function indicesRow(r) {
  return Array.from({ length: 9 }, (_, i) => r * 9 + i);
}
function indicesCol(c) {
  return Array.from({ length: 9 }, (_, i) => i * 9 + c);
}
function indicesBox(br, bc) {
  const arr = [];
  for (let rr = 0; rr < 3; rr++)
    for (let cc = 0; cc < 3; cc++)
      arr.push((br * 3 + rr) * 9 + (bc * 3 + cc));
  return arr;
}

// ===============================
// 完成判定
// ===============================
function checkSolved() {
  for (let i = 0; i < 81; i++)
    if (getValueAt(i) === 0) return;

  const hasConflict = cells.some(c => c.classList.contains("conflict"));

  if (!hasConflict) {
    showToast("🎉 恭喜完成！");
    cells.forEach((c, idx) => {
      if (!fixed.has(idx)) c.classList.add("given");
    });
  } else {
    showToast("還有衝突！");
  }
}

// ===============================
// Toast
// ===============================
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2000);
}

// ===============================
// 開始
// ===============================
buildBoard(PUZZLE);
