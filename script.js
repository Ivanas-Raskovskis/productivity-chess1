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

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function evaluateBoard(chess) {
  const boardState = chess.board();
  let score = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = boardState[row][col];
      if (square) {
        const value = PIECE_VALUES[square.type];
        score += square.color === 'w' ? value : -value;
      }
    }
  }

  return score;
}

function minimax(chess, depth, alpha, beta, isMaximizing) {
  if (depth === 0 || chess.game_over()) {
    return evaluateBoard(chess);
  }

  const moves = chess.moves();

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const evalScore = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const evalScore = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function makeAiMove() {
  if (game.game_over()) return;

  const possibleMoves = game.moves();
  if (possibleMoves.length === 0) return;

  let bestMove = null;
  let bestValue = Infinity;

  for (const move of possibleMoves) {
    game.move(move);
    const boardValue = minimax(game, 2, -Infinity, Infinity, true);
    game.undo();

    if (boardValue < bestValue) {
      bestValue = boardValue;
      bestMove = move;
    }
  }

  game.move(bestMove);
  board.position(game.fen());
  updateStatus();
}

function updateStatus() {
  let status = '';
  const moveColor = game.turn() === 'w' ? 'Baltųjų' : 'Juodųjų';

  if (game.in_checkmate()) {
    const winnerIsPlayer = game.turn() !== 'w';
    status = 'Šachmatas! ' + moveColor + ' pralaimėjo.';
    showGameOver(winnerIsPlayer ? 'win' : 'loss');
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

function confirmNewGame() {
  if (game.history().length === 0) {
    startNewGame();
