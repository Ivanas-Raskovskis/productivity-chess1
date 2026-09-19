// ---------- ŠACHMATAI ----------
const game = new Chess();
const statusEl = document.getElementById('status');
const movesCounterEl = document.getElementById('moves-counter');

let availableMoves = parseInt(localStorage.getItem('availableMoves') || '0');

function updateMovesDisplay() {
  movesCounterEl.textContent = 'Available moves: ' + availableMoves;
  localStorage.setItem('availableMoves', availableMoves);
}

function onDragStart(source, piece) {
  if (game.game_over()) return false;
  if (piece.search(/^b/) !== -1) return false;
  if (game.turn() !== 'w') return false;
  if (availableMoves <= 0) {
    alert('Neturi likusių ėjimų! Atlik užduotį, kad gautum ėjimą.');
    return false;
  }
}

function onDrop(source, target) {
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q'
  });

  if (move === null) return 'snapback';

  availableMoves--;
  updateMovesDisplay();
  updateStatus();

  window.setTimeout(makeAiMove, 500);
}

function onSnapEnd() {
  board.position(game.fen());
}

function makeAiMove() {
  if (game.game_over()) return;

  const possibleMoves = game.moves();
  if (possibleMoves.length === 0) return;

  const randomIndex = Math.floor(Math.random() * possibleMoves.length);
  game.move(possibleMoves[randomIndex]);

  board.position(game.fen());
  updateStatus();
}

function updateStatus() {
  let status = '';
  const moveColor = game.turn() === 'w' ? 'Baltųjų' : 'Juodųjų';

  if (game.in_checkmate()) {
    const winner = game.turn() === 'w' ? 'AI' : 'Tu';
    status = 'Šachmatas! ' + moveColor + ' pralaimėjo.';
    showGameOver(winner === 'Tu' ? 'win' : 'loss');
  } else if (game.in_draw()) {
    status = 'Lygiosios.';
    showGameOver('draw');
  } else {
    status = moveColor + ' ėjimas';
    if (game.turn() === 'b') status = 'AI galvoja...';
    if (game.in_check()) {
      status += ' (Šachas!)';
    }
  }
  statusEl.textContent = status;
}

function getStats() {
  return JSON.parse(localStorage.getItem('stats') || '{"wins":0,"losses":0,"draws":0}');
}

function saveStats(stats) {
  localStorage.setItem('stats', JSON.stringify(stats));
}

function showGameOver(result) {
  const stats = getStats();
  const modal = document.getElementById('game-over-modal');
  const title = document.getElementById('modal-title');
  const message = document.getElementById('modal-message');

  if (result === 'win') {
    stats.wins++;
    title.textContent = '🎉 Laimėjai!';
    message.textContent = 'Puikus žaidimas! AI buvo įveiktas.';
  } else if (result === 'loss') {
    stats.losses++;
    title.textContent = '😔 Pralaimėjai';
    message.textContent = 'Kitą kartą pasiseks geriau.';
  } else {
    stats.draws++;
    title.textContent = '🤝 Lygiosios';
    message.textContent = 'Nė vienas nelaimėjo šįkart.';
  }

  saveStats(stats);

  document.getElementById('stat-wins').textContent = stats.wins;
  document.getElementById('stat-losses').textContent = stats.losses;
  document.getElementById('stat-draws').textContent = stats.draws;

  modal.classList.add('show');
}

function startNewGame() {
  game.reset();
  board.position('start');
  document.getElementById('game-over-modal').classList.remove('show');
  updateStatus();
}

const config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
  pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
};

const board = Chessboard('board', config);
updateMovesDisplay();

// ---------- TASKS ----------
let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');

if (tasks.length === 0) {
  tasks = [
    { id: 1, name: '30 min. mokymosi', reward: 1, done: false },
    { id: 2, name: 'Sportas', reward: 1, done: false },
    { id: 3, name: 'Projekto darbas', reward: 2, done: false }
  ];
}

function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function renderTasks() {
  const listEl = document.getElementById('task-list');
  listEl.innerHTML = '';

  tasks.forEach(task => {
    const taskEl = document.createElement('div');
    taskEl.className = 'task' + (task.done ? ' done' : '');

    taskEl.innerHTML = `
      <div class="task-left">
        <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask(${task.id})">
        <span class="task-name">${task.name}</span>
      </div>
      <div class="task-left">
        <span class="task-reward">+${task.reward} move</span>
        <button class="remove" onclick="removeTask(${task.id})">✕</button>
      </div>
    `;

    listEl.appendChild(taskEl);
  });

  saveTasks();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  if (!task.done) {
    availableMoves += task.reward;
  } else {
    availableMoves -= task.reward;
  }

  task.done = !task.done;
  updateMovesDisplay();
  renderTasks();
}

function removeTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  renderTasks();
}

function addTask() {
  const input = document.getElementById('new-task-name');
  const name = input.value.trim();
  if (!name) return;

  tasks.push({
    id: Date.now(),
    name: name,
    reward: 1,
    done: false
  });

  input.value = '';
  renderTasks();
}

renderTasks();
