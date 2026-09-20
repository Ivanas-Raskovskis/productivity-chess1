let liveGame = null;
let liveBoard = null;
let currentGameId = null;
let myColor = null;
let opponentName = '—';
let clockInterval = null;
let clocks = { white: 0, black: 0 };
let activeClockColor = null;

function getLichessToken() {
  return localStorage.getItem('lichess_token');
}

function getMyLichessUsername() {
  return localStorage.getItem('lichess_username');
}

async function startSeek() {
  const token = getLichessToken();
  if (!token) {
    alert('Pirma prisijunk su Lichess.');
    return;
  }

  const seekButton = document.querySelector('[onclick="startSeek()"]');
  if (seekButton) {
    if (seekButton.disabled) return;
    seekButton.disabled = true;
    seekButton.textContent = 'Ieškoma...';
  }

  document.getElementById('lichess-live-section').style.display = 'flex';
  document.getElementById('lichess-game-status').textContent = 'Ieškoma varžovo... (gali užtrukti kelias minutes)';

  listenForGameStart(token);
  sendSeekRequest(token);
}

async function sendSeekRequest(token) {
  try {
    const response = await fetch('https://lichess.org/api/board/seek', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        rated: 'true',
        time: '5',
        increment: '3',
        variant: 'standard'
      })
    });

    const reader = response.body.getReader();
    while (true) {
      const result = await reader.read();
      if (result.done) break;
    }
  } catch (err) {
    console.error('Seek klaida:', err);
  }
}

async function challengeFriend(username) {
  const token = getLichessToken();
  if (!token) {
    alert('Pirma prisijunk su Lichess.');
    return;
  }

  document.getElementById('lichess-live-section').style.display = 'flex';
  document.getElementById('lichess-game-status').textContent = 'Siunčiamas iššūkis vartotojui ' + username + '...';

  listenForGameStart(token);

  try {
    const response = await fetch('https://lichess.org/api/challenge/' + username, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        rated: 'true',
        'clock.limit': '300',
        'clock.increment': '3'
      })
    });

    const data = await response.json();
    console.log('Challenge response:', data);
  } catch (err) {
    console.error('Challenge klaida:', err);
  }
}

async function listenForGameStart(token) {
  const response = await fetch('https://lichess.org/api/stream/event', {
    headers: { Authorization: 'Bearer ' + token }
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const result = await reader.read();
    if (result.done) break;

    buffer += decoder.decode(result.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);

      if (event.type === 'gameStart') {
        const gameId = event.game.gameId;
        document.getElementById('lichess-game-status').textContent = 'Partija prasidėjo!';
        openGameStream(gameId, token);
        return;
      }
    }
  }
}

function uciToMoveObj(uci) {
  const move = {
    from: uci.substring(0, 2),
    to: uci.substring(2, 4)
  };
  if (uci.length > 4) move.promotion = uci.substring(4, 5);
  return move;
}

async function openGameStream(gameId, token) {
  currentGameId = gameId;

  const response = await fetch('https://lichess.org/api/board/game/stream/' + gameId, {
    headers: { Authorization: 'Bearer ' + token }
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const result = await reader.read();
    if (result.done) break;

    buffer += decoder.decode(result.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      const data = JSON.parse(line);
      handleGameEvent(data);
    }
  }
}

function handleGameEvent(data) {
  if (data.type === 'gameFull') {
    const myUsername = (getMyLichessUsername() || '').toLowerCase();
    myColor = data.white.id === myUsername ? 'white' : 'black';

    const opponent = myColor === 'white' ? data.black : data.white;
    opponentName = (opponent.name || opponent.id || '—') + (opponent.rating ? ' (' + opponent.rating + ')' : '');
    document.getElementById('lichess-opponent').textContent = 'Varžovas: ' + opponentName;

    liveGame = new Chess();
    liveBoard = Chessboard('lichess-board', {
      draggable: true,
      position: 'start',
      orientation: myColor,
      onDragStart: onLiveDragStart,
      onDrop: onLiveDrop,
      onSnapEnd: function () { liveBoard.position(liveGame.fen()); },
      pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });

    applyMoves(data.state.moves);
    updateClocksFromState(data.state);
    updateLiveStatus(data.state);
    renderCaptured();
  } else if (data.type === 'gameState') {
    applyMoves(data.moves);
    updateClocksFromState(data);
    updateLiveStatus(data);
    renderCaptured();
  }
}

function applyMoves(movesString) {
  liveGame.reset();
  const moves = movesString ? movesString.split(' ') : [];
  moves.forEach(function (uci) {
    if (uci) liveGame.move(uciToMoveObj(uci));
  });
  if (liveBoard) liveBoard.position(liveGame.fen());
}

function updateLiveStatus(state) {
  const statusEl = document.getElementById('lichess-game-status');

  if (state.status && state.status !== 'started' && state.status !== 'created') {
    statusEl.textContent = 'Partija baigta: ' + state.status;
    stopClockTimer();
    return;
  }

  const turn = liveGame.turn() === 'w' ? 'white' : 'black';
  const isMyTurn = turn === myColor;
  statusEl.textContent = isMyTurn ? 'Tavo ėjimas' : 'Varžovo ėjimas...';
}

function onLiveDragStart(source, piece) {
  if (!liveGame || liveGame.game_over()) return false;
  const turn = liveGame.turn() === 'w' ? 'white' : 'black';
  if (turn !== myColor) return false;
  if ((myColor === 'white' && piece.search(/^b/) !== -1) ||
      (myColor === 'black' && piece.search(/^w/) !== -1)) {
    return false;
  }
}

function onLiveDrop(source, target) {
  const move = liveGame.move({ from: source, to: target, promotion: 'q' });
  if (move === null) return 'snapback';

  const uci = source + target + (move.promotion ? move.promotion : '');
  sendMoveToLichess(uci);
  renderCaptured();
  updateLiveStatus({ status: 'started' });
}

async function sendMoveToLichess(uci) {
  const token = getLichessToken();
  try {
    await fetch('https://lichess.org/api/board/game/' + currentGameId + '/move/' + uci, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    });
  } catch (err) {
    console.error('Nepavyko išsiųsti ėjimo:', err);
  }
}

function updateClocksFromState(state) {
  if (typeof state.wtime !== 'number' || typeof state.btime !== 'number') return;

  clocks.white = Math.floor(state.wtime / 1000);
  clocks.black = Math.floor(state.btime / 1000);

  renderClocks();
  restartClockTimer();
}

function restartClockTimer() {
  stopClockTimer();
  if (!liveGame || liveGame.game_over()) return;

  activeClockColor = liveGame.turn() === 'w' ? 'white' : 'black';

  clockInterval = setInterval(function () {
    clocks[activeClockColor] = Math.max(0, clocks[activeClockColor] - 1);
    renderClocks();
  }, 1000);
}

function stopClockTimer() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function renderClocks() {
  const myClockEl = document.getElementById('clock-mine');
  const oppClockEl = document.getElementById('clock-opponent');
  if (!myClockEl || !oppClockEl) return;

  const oppColor = myColor === 'white' ? 'black' : 'white';
  myClockEl.textContent = formatClock(clocks[myColor] || 0);
  oppClockEl.textContent = formatClock(clocks[oppColor] || 0);
}

const STANDARD_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const PIECE_SYMBOLS = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' }
};

function renderCaptured() {
  if (!liveGame) return;

  const boardState = liveGame.board();
  const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = boardState[row][col];
      if (square && counts[square.color][square.type] !== undefined) {
        counts[square.color][square.type]++;
      }
    }
  }

  const capturedByMe = [];
  const capturedByOpponent = [];

  const oppColorCode = myColor === 'white' ? 'b' : 'w';
  const myColorCode = myColor === 'white' ? 'w' : 'b';

  Object.keys(STANDARD_COUNTS).forEach(function (type) {
    const missingOpp = STANDARD_COUNTS[type] - counts[oppColorCode][type];
    for (let i = 0; i < missingOpp; i++) capturedByMe.push(PIECE_SYMBOLS[oppColorCode][type]);

    const missingMine = STANDARD_COUNTS[type] - counts[myColorCode][type];
    for (let i = 0; i < missingMine; i++) capturedByOpponent.push(PIECE_SYMBOLS[myColorCode][type]);
  });

  const topEl = document.getElementById('captured-top');
  const bottomEl = document.getElementById('captured-bottom');
  if (topEl) topEl.textContent = capturedByOpponent.join(' ');
  if (bottomEl) bottomEl.textContent = capturedByMe.join(' ');
}
