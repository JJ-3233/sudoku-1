/* Sudoku Interactive App */
const puzzle = [
  [5,3,0,0,7,0,0,0,0],
  [6,0,0,1,9,5,0,0,0],
  [0,9,8,0,0,0,0,6,0],
  [8,0,0,0,6,0,0,0,3],
  [4,0,0,8,0,3,0,0,1],
  [7,0,0,0,2,0,0,0,6],
  [0,6,0,0,0,0,2,8,0],
  [0,0,0,4,1,9,0,0,5],
  [0,0,0,0,8,0,0,7,9]
];

/* Known solution to the above puzzle */
const solution = [
  [5,3,4,6,7,8,9,1,2],
  [6,7,2,1,9,5,3,4,8],
  [1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],
  [4,2,6,8,5,3,7,9,1],
  [7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],
  [2,8,7,4,1,9,6,3,5],
  [3,4,5,2,8,6,1,7,9]
];

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const btnCheck = document.getElementById('btn-check');
const btnReset = document.getElementById('btn-reset');

function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;

      const val = puzzle[r][c];
      if (val !== 0) {
        const fixed = document.createElement('div');
        fixed.className = 'fixed';
        fixed.textContent = String(val);
        cell.appendChild(fixed);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.maxLength = 1;
        input.setAttribute('aria-label', `Row ${r+1} Column ${c+1}`);
        input.placeholder = '';
        input.addEventListener('input', onInputFilter);
        input.addEventListener('focus', () => cell.classList.remove('error', 'valid'));
        cell.appendChild(input);
      }

      // bold borders between subgrids
      if (r === 2 || r === 5) cell.style.borderBottomWidth = '3px';
      if (c === 2 || c === 5) cell.style.borderRightWidth = '3px';

      boardEl.appendChild(cell);
    }
  }
  document.getElementById('year').textContent = new Date().getFullYear();
}

function onInputFilter(e) {
  // allow only digits 1-9
  const v = e.target.value.replace(/[^1-9]/g, '');
  e.target.value = v.slice(0, 1);
}

function readBoard() {
  const grid = [];
  let idx = 0;
  for (let r = 0; r < 9; r++) {
    const row = [];
    for (let c = 0; c < 9; c++) {
      const cell = boardEl.children[idx++];
      const fixed = cell.querySelector('.fixed');
      if (fixed) {
        row.push(parseInt(fixed.textContent, 10));
      } else {
        const v = cell.querySelector('input').value;
        row.push(v ? parseInt(v, 10) : 0);
      }
    }
    grid.push(row);
  }
  return grid;
}

function checkBoard() {
  const grid = readBoard();
  let mistakes = 0;
  let empty = 0;

  // Clear classes
  for (const cell of boardEl.children) cell.classList.remove('error', 'valid');

  let idx = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = boardEl.children[idx++];
      const fixed = cell.querySelector('.fixed');
      if (fixed) continue; // skip fixed cells
      const val = grid[r][c];
      if (val === 0) {
        empty++;
        continue;
      }
      if (solution[r][c] !== val) {
        mistakes++;
        cell.classList.add('error');
      } else {
        cell.classList.add('valid');
      }
    }
  }

  if (mistakes > 0) {
    setStatus(`有 ${mistakes} 個錯誤，紅色格子請重新檢查。`, 'error');
  } else if (empty > 0) {
    setStatus(`目前沒有錯誤，尚有 ${empty} 個空格。`, 'info');
  } else {
    setStatus('恭喜！全部正確 ✅', 'success');
  }
}

function resetBoard() {
  let idx = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = boardEl.children[idx++];
      const input = cell.querySelector('input');
      if (input) {
        input.value = '';
      }
      cell.classList.remove('error', 'valid');
    }
  }
  setStatus('已清空使用者輸入。', 'info');
}

function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = 'status ' + (type || '');
}

// Wire up
btnCheck.addEventListener('click', checkBoard);
btnReset.addEventListener('click', resetBoard);

// Init
buildBoard();
