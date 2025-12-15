import { initDB, getRandomWord, createGame, addAttempt, finishGame, getAllGames, getGameWithAttempts, deleteGame, findGamesByPlayer, getStatistics, clearDatabase } from './db.js';
import { Hangman, HANGMAN_PICS } from './game.js';

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const RUS_ALPHABET = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split('');
let game = null;
let gameId = null;
let attemptNo = 0;

let replayTimer = null;
let replayState = null;

async function setup() {
  await initDB();
  bindTabs();
  bindNewGame();
  bindReplayControls();
  bindSearch();
  bindStats();
  showScreen('new');
}

function bindTabs() {
  $('#tab-new').addEventListener('click', () => showScreen('new'));
  $('#tab-list').addEventListener('click', async () => {
    await renderGamesList();
    showScreen('list');
  });
  $('#tab-search').addEventListener('click', () => showScreen('search'));
  $('#tab-stats').addEventListener('click', async () => {
    await renderStatistics();
    showScreen('stats');
  });
}

function showScreen(name) {
  const screens = ['new', 'list', 'search', 'stats'];
  screens.forEach(screen => {
    $(`#screen-${screen}`).classList.toggle('hidden', name !== screen);
  });
}

function bindNewGame() {
  $('#btn-start').addEventListener('click', startGame);
  $('#btn-guess-word').addEventListener('click', onGuessWord);
  $('#btn-restart').addEventListener('click', () => {
    $('#player-name').focus();
    resetUI();
  });
}

async function startGame() {
  resetUI();
  const player = ($('#player-name').value || 'Гость').trim();
  const word = await getRandomWord();
  game = new Hangman(word, 6);
  const dateISO = new Date().toISOString();
  gameId = await createGame({ dateISO, player, word, maxWrong: game.maxWrong });
  attemptNo = 0;

  $('#max-wrong').textContent = String(game.maxWrong);
  $('#wrong-count').textContent = '0';
  $('#hangman').textContent = HANGMAN_PICS[0];
  $('#game-area').classList.remove('hidden');
  $('#status').textContent = '';
  $('#status').className = '';
  $('#full-guess').value = '';

  renderWordCells(word.length);
  renderAlphabet();

  $('#attempts-log').innerHTML = '';
}

function renderWordCells(n) {
  const wrap = $('#word-cells');
  wrap.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const cell = el('div', 'letter-cell', '');
    wrap.appendChild(cell);
  }
  updateWordCells();
}

function updateWordCells() {
  const masked = game.getMasked();
  const chars = [...masked.padEnd(game.word.length, ' ')];
  const cells = $('#word-cells').children;
  for (let i = 0; i < cells.length; i++) {
    cells[i].textContent = chars[i] ? chars[i].toUpperCase() : '';
    if (chars[i] && chars[i] !== ' ') {
      cells[i].classList.add('filled');
    } else {
      cells[i].classList.remove('filled');
    }
  }
}

function renderAlphabet() {
  const wrap = $('#alphabet');
  wrap.innerHTML = '';
  RUS_ALPHABET.forEach(ch => {
    const b = el('div', 'letter-btn', ch);
    b.addEventListener('click', () => onLetter(ch));
    wrap.appendChild(b);
  });
}

async function onLetter(ch) {
  if (!game || game.status !== 'playing') return;
  const res = game.guessLetter(ch);
  if (res.result === 'repeat' || res.result === 'ignored') return;

  attemptNo++;
  await addAttempt({
    gameId,
    number: attemptNo,
    guess: ch,
    type: 'letter',
    result: res.result
  });

  disableLetter(ch, res.result);
  if (res.result === 'hit') {
    updateWordCells();
    addAttemptLog(attemptNo, ch, 'верно');
  } else if (res.result === 'miss') {
    $('#wrong-count').textContent = String(game.wrongCount);
    $('#hangman').textContent = HANGMAN_PICS[Math.min(game.wrongCount, HANGMAN_PICS.length - 1)];
    addAttemptLog(attemptNo, ch, 'ошибка');
  }

  if (game.status === 'won') {
    await finishGame({ gameId, outcome: 'win' });
    onGameEnd(true);
  } else if (game.status === 'lost') {
    await finishGame({ gameId, outcome: 'lose' });
    onGameEnd(false);
  }
}

function disableLetter(ch, result) {
  [...$('#alphabet').children].forEach(b => {
    if (b.textContent.toLowerCase() === ch.toLowerCase()) {
      b.classList.add('used');
      if (result === 'miss') {
        b.classList.add('wrong');
      }
    }
  });
}

function addAttemptLog(no, guess, res) {
  const li = el('li', null, `${no} | ${guess.toUpperCase()} | ${res}`);
  $('#attempts-log').appendChild(li);
}

async function onGuessWord() {
  if (!game || game.status !== 'playing') return;
  const text = $('#full-guess').value.trim();
  if (!text) return;
  const res = game.guessWord(text);

  attemptNo++;
  await addAttempt({
    gameId,
    number: attemptNo,
    guess: text,
    type: 'word',
    result: res.result
  });

  if (res.result === 'hit') {
    updateWordCells();
    addAttemptLog(attemptNo, text, 'слово: верно');
    await finishGame({ gameId, outcome: 'win' });
    onGameEnd(true);
  } else if (res.result === 'miss') {
    $('#wrong-count').textContent = String(game.wrongCount);
    $('#hangman').textContent = HANGMAN_PICS[Math.min(game.wrongCount, HANGMAN_PICS.length - 1)];
    addAttemptLog(attemptNo, text, 'слово: ошибка');
    if (game.status === 'lost') {
      await finishGame({ gameId, outcome: 'lose' });
      onGameEnd(false);
    }
  }
}

function onGameEnd(win) {
  [...$('#alphabet').children].forEach(b => b.classList.add('used'));
  $('#status').className = win ? 'win' : 'lose';
  $('#status').textContent = win ? 'Победа! Вы угадали слово.' : `Поражение. Было загаданο: ${game.word.toUpperCase()}`;
  $('#btn-restart').classList.remove('hidden');
}

function resetUI() {
  $('#game-area').classList.add('hidden');
  $('#attempts-log').innerHTML = '';
  $('#status').textContent = '';
  $('#status').className = '';
  $('#btn-restart').classList.add('hidden');
  $('#hangman').textContent = HANGMAN_PICS[0];
  $('#wrong-count').textContent = '0';
}

async function renderGamesList() {
  const container = $('#games-list');
  container.innerHTML = '';
  const games = await getAllGames();
  if (!games.length) {
    container.textContent = 'Нет сохранённых партий';
    return;
  }
  
  games.forEach(g => {
    const gameItem = el('div', 'game-item');
    
    const title = el('h3', null, `Игрок: ${g.player || 'Гость'}`);
    const word = el('p', null, `Слово: ${(g.word || '').toUpperCase()}`);
    const date = el('p', null, `Дата: ${new Date(g.date).toLocaleString()}`);
    const attempts = el('p', null, `Попыток: ${g.attemptsCount || 0}`);
    const wrong = el('p', null, `Ошибок: ${g.wrongCount || 0}/${g.maxWrong || 6}`);
    
    const outcome = g.outcome === 'win' ? 'Победа' : (g.outcome === 'lose' ? 'Поражение' : 'В процессе');
    const status = el('p', `status ${g.outcome === 'win' ? 'won' : g.outcome === 'lose' ? 'lost' : ''}`, `Результат: ${outcome}`);
    
    const actions = el('div', 'actions');
    const replayBtn = el('button', null, 'Просмотр');
    replayBtn.addEventListener('click', () => openReplay(g.id));
    
    const deleteBtn = el('button', 'danger', 'Удалить');
    deleteBtn.addEventListener('click', async () => {
      if (confirm('Удалить эту игру?')) {
        await deleteGame(g.id);
        await renderGamesList();
      }
    });
    
    actions.appendChild(replayBtn);
    actions.appendChild(deleteBtn);
    
    gameItem.appendChild(title);
    gameItem.appendChild(word);
    gameItem.appendChild(date);
    gameItem.appendChild(attempts);
    gameItem.appendChild(wrong);
    gameItem.appendChild(status);
    gameItem.appendChild(actions);
    
    container.appendChild(gameItem);
  });
}

function bindReplayControls() {
  $('#btn-replay-close').addEventListener('click', closeReplay);
  $('#btn-replay-play').addEventListener('click', replayPlay);
  $('#btn-replay-pause').addEventListener('click', replayPause);
  $('#btn-replay-step').addEventListener('click', replayStep);
}

async function openReplay(id) {
  const { game, attempts } = await getGameWithAttempts(id);
  replayState = {
    word: game.word,
    maxWrong: game.maxWrong,
    wrong: 0,
    step: 0,
    attempts,
    revealed: new Set()
  };
  $('#replay-word').innerHTML = '';
  for (let i = 0; i < game.word.length; i++) {
    const cell = el('div', 'letter-cell', '');
    $('#replay-word').appendChild(cell);
  }
  $('#replay-hangman').textContent = HANGMAN_PICS[0];
  $('#replay-log').innerHTML = '';
  $('#replay-step').textContent = '0';

  $('#replay-modal').classList.remove('hidden');
}

function closeReplay() {
  replayPause();
  $('#replay-modal').classList.add('hidden');
  replayState = null;
}

function replayPlay() {
  if (!replayState) return;
  if (replayTimer) return;
  replayTimer = setInterval(() => {
    const done = replayStep();
    if (done) replayPause();
  }, 800);
}

function replayPause() {
  if (replayTimer) {
    clearInterval(replayTimer);
    replayTimer = null;
  }
}

function replayStep() {
  if (!replayState) return true;
  const { attempts, step } = replayState;
  if (step >= attempts.length) return true;

  const a = attempts[step];
  applyReplayAttempt(a);
  replayState.step++;
  $('#replay-step').textContent = String(replayState.step);
  return replayState.step >= attempts.length;
}

function applyReplayAttempt(a) {
  const li = el('li', null, `${a.number} | ${a.guess.toUpperCase()} | ${a.type === 'word' ? 'слово: ' : ''}${a.result === 'hit' ? 'верно' : 'ошибка'}`);
  $('#replay-log').appendChild(li);

  if (a.type === 'letter' && a.result === 'hit') {
    [...replayState.word].forEach((ch, i) => {
      if (ch.toLowerCase() === a.guess.toLowerCase()) {
        const cell = $('#replay-word').children[i];
        cell.textContent = ch.toUpperCase();
        cell.classList.add('filled');
      }
    });
  } else if (a.result === 'miss') {
    replayState.wrong++;
    $('#replay-hangman').textContent = HANGMAN_PICS[Math.min(replayState.wrong, HANGMAN_PICS.length - 1)];
  }

  if (a.type === 'word' && a.result === 'hit') {
    [...replayState.word].forEach((ch, i) => {
      const cell = $('#replay-word').children[i];
      cell.textContent = ch.toUpperCase();
      cell.classList.add('filled');
    });
  }
}

function bindSearch() {
  $('#btn-search-player').addEventListener('click', async () => {
    const playerName = $('#search-player').value.trim();
    if (!playerName) return;
    
    const games = await findGamesByPlayer(playerName);
    renderSearchResults(games);
  });
  
  $('#btn-clear-search').addEventListener('click', () => {
    $('#search-player').value = '';
    $('#search-results').innerHTML = '';
  });
}

function renderSearchResults(games) {
  const container = $('#search-results');
  container.innerHTML = '';
  
  if (!games.length) {
    container.textContent = 'Игр не найдено';
    return;
  }
  
  const title = el('h3', null, `Найдено игр: ${games.length}`);
  container.appendChild(title);
  
  games.forEach(g => {
    const gameItem = el('div', 'game-item');
    
    const details = el('div', 'game-details');
    details.innerHTML = `
      <strong>Игрок:</strong> ${g.player || 'Гость'}<br>
      <strong>Слово:</strong> ${(g.word || '').toUpperCase()}<br>
      <strong>Дата:</strong> ${new Date(g.date).toLocaleString()}<br>
      <strong>Результат:</strong> ${g.outcome === 'win' ? 'Победа' : g.outcome === 'lose' ? 'Поражение' : 'В процессе'}
    `;
    
    const actions = el('div', 'actions');
    const replayBtn = el('button', null, 'Просмотр');
    replayBtn.addEventListener('click', () => openReplay(g.id));
    
    const deleteBtn = el('button', 'danger', 'Удалить');
    deleteBtn.addEventListener('click', async () => {
      if (confirm('Удалить эту игру?')) {
        await deleteGame(g.id);
        await renderSearchResults(await findGamesByPlayer($('#search-player').value.trim()));
        await renderGamesList();
      }
    });
    
    actions.appendChild(replayBtn);
    actions.appendChild(deleteBtn);
    
    gameItem.appendChild(details);
    gameItem.appendChild(actions);
    container.appendChild(gameItem);
  });
}

function bindStats() {
}

async function renderStatistics() {
  const stats = await getStatistics();
  const container = $('#stats-content');
  container.innerHTML = '';
  
  const statsHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Общая статистика</h3>
        <p>Всего игр: <strong>${stats.totalGames}</strong></p>
        <p>Побед: <strong class="won">${stats.totalWins}</strong></p>
        <p>Поражений: <strong class="lost">${stats.totalLosses}</strong></p>
        <p>В процессе: <strong>${stats.totalInProgress}</strong></p>
        <p>Среднее попыток на игру: <strong>${stats.averageAttemptsPerGame}</strong></p>
      </div>
      
      <div class="stat-card">
        <h3>Статистика по игрокам</h3>
        ${Object.entries(stats.players).map(([player, data]) => `
          <div class="player-stats">
            <strong>${player}:</strong>
            <span>Игр: ${data.total}</span>
            <span class="won">Побед: ${data.wins}</span>
            <span class="lost">Поражений: ${data.losses}</span>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="stats-actions">
      <button id="btn-export-stats">Экспорт статистики</button>
      <button id="btn-clear-all" class="danger">Очистить все игры</button>
    </div>
  `;
  
  container.innerHTML = statsHTML;
  
  $('#btn-export-stats').addEventListener('click', exportStatistics);
  $('#btn-clear-all').addEventListener('click', async () => {
    if (confirm('Удалить ВСЕ сохраненные игры? Это действие нельзя отменить.')) {
      await clearDatabase();
      await renderStatistics();
      await renderGamesList();
      alert('Все игры удалены');
    }
  });
}

function exportStatistics() {
  const statsContent = document.querySelector('.stats-grid').innerText;
  const blob = new Blob([statsContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hangman-stats-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', setup);