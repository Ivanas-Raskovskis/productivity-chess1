let liveGame = null;
let liveBoard = null;
let currentGameId = null;
let myColor = null;

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
        time: '10',
        increment: '0',
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
    myColor = data.white.id === getMyLichessUsername() ? 'white' : 'black';

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
    updateLiveStatus(data.state);
  } else if (data.type === 'gameState') {
    applyMoves(data.moves);
    updateLiveStatus(data);
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
