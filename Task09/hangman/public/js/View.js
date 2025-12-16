export default class View {
  constructor(onGuess, onRestart, onBack) {
    this.hangman = document.getElementById('hangman');
    this.wordEl = document.getElementById('word');
    this.message = document.getElementById('message');
    this.letters = document.getElementById('letters');
    this.restartBtn = document.getElementById('restart');

    this.leftPanel = document.getElementById('left-panel');
    this.rightPanel = document.getElementById('right-panel');
    this.fullArea = document.getElementById('full-area');

    this.restartBtn.addEventListener('click', onRestart);
    this.onBack = onBack;

    this.renderLetters(onGuess);
  }

  hideGamePanels() {
    this.leftPanel.style.display = 'none';
    this.rightPanel.style.display = 'none';
  }

  showGamePanels() {
    this.leftPanel.style.display = 'flex';
    this.rightPanel.style.display = 'flex';
  }

  renderLetters(onGuess) {
    this.letters.innerHTML = '';
    const alphabet = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
    for (const letter of alphabet) {
      const btn = document.createElement('button');
      btn.textContent = letter;
      btn.disabled = false;
      btn.addEventListener('click', () => onGuess(letter, btn));
      this.letters.appendChild(btn);
    }
  }

  renderWord(masked) {
    this.wordEl.innerHTML = '';
    for (const c of masked) {
      const box = document.createElement('div');
      box.className = 'letter-box';
      box.textContent = c !== '_' ? c : '';
      this.wordEl.appendChild(box);
    }
  }

  renderHangman(wrong) {
    const pics = [
      `  +---+\n      |\n      |\n      |\n   =====`,
      `  +---+\n  0   |\n      |\n      |\n   =====`,
      `  +---+\n  0   |\n  |   |\n      |\n   =====`,
      `  +---+\n  0   |\n /|   |\n      |\n   =====`,
      `  +---+\n  0   |\n /|\\  |\n      |\n   =====`,
      `  +---+\n  0   |\n /|\\  |\n /    |\n   =====`,
      `  +---+\n  0   |\n /|\\  |\n / \\  |\n   =====`
    ];
    this.hangman.textContent = pics[Math.min(wrong, pics.length - 1)];
  }

  showMessage(msg) {
    this.message.textContent = msg;
  }

  disableLetter(btn) {
    btn.disabled = true;
  }

  disableAllLetters() {
    this.letters.querySelectorAll('button').forEach(b => b.disabled = true);
  }

  revealWord(word) {
    this.wordEl.innerHTML = '';
    for (const c of word) {
      const box = document.createElement('div');
      box.className = 'letter-box';
      box.textContent = c;
      this.wordEl.appendChild(box);
    }
  }

  renderFull(contentHtml) {
    this.hideGamePanels();
    this.fullArea.style.display = 'block';
    this.fullArea.innerHTML = `
      <button id="back-btn" style="margin-bottom:20px;"> ⮜ Back </button>
      ${contentHtml}
    `;
    document.getElementById('back-btn').onclick = this.onBack;
  }

renderInfo() {
  const html = `
    <h2>Виселица — Игровые возможности</h2>
<p>Классическая игра «Виселица» с современным интерфейсом и системой сохранения результатов.</p>
<h3>Основные режимы:</h3>
<ul>
  <li><b>Новая игра:</b> Старт партии со случайным словом из базы данных.</li>
  <li><b>Архив партий:</b> Полный список всех сыгранных игр с детальной статистикой.</li>
  <li><b>Повтор игры:</b> Пошаговое воспроизведение любой сохранённой партии.</li>
  <li><b>Информация:</b> Описание функционала и правил игры.</li>
</ul>
<h3>Механика игры:</h3>
<ul>
  <li>Выбирайте буквы из русского алфавита, чтобы раскрыть загаданное слово.</li>
  <li>При правильной букве — она появляется в соответствующей позиции слова.</li>
  <li>При ошибке — добавляется новый элемент рисунка виселицы.</li>
  <li>Победа — полное раскрытие слова до завершения рисунка.</li>
</ul>
<h3>Система учёта:</h3>
<ul>
  <li>Все игровые сессии автоматически сохраняются в базе данных браузера.</li>
  <li>Доступен полный архив с историей ходов для каждой партии.</li>
  <li>В детальной статистике отображаются: слово, результат и последовательность попыток.</li>
</ul>
  `;

  this.renderFull(html);
}


  renderSavedGames(games, onReplayClick) {
    if (!games.length) {
      return this.renderFull('<p>Нет сохранённых игр</p>');
    }

    let html = `
      <h2>Saved Games</h2>
      <table>
        <thead>
          <tr><th>ID</th><th>Player</th><th>Word</th><th>Replay</th></tr>
        </thead>
        <tbody>
    `;
    games.forEach(g => {
      html += `<tr>
        <td>${g.id}</td>
        <td>${g.player}</td>
        <td>${g.word}</td>
        <td><button class="menu-btn" data-game='${JSON.stringify(g)}'>Replay</button></td>
      </tr>`;
    });
    html += '</tbody></table>';
    this.renderFull(html);

    this.fullArea.querySelectorAll('button[data-game]').forEach(btn => {
      btn.onclick = () => onReplayClick(btn.dataset.game);
    });
  }

  renderReplay(gameData, info, onBack) {
  let html = `
    <h2>Replay Game #${info.id}</h2>
    <table>
      <thead>
        <tr><th>Player</th><th>Word</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>${info.player}</td>
          <td>${info.word}</td>
        </tr>
      </tbody>
    </table>
  `;

  if(gameData.length){
    html += `
      <h3>History of guesses</h3>
      <table class="guess-history"> 
        <thead>
          <tr><th>Letter</th><th>Result</th></tr>
        </thead>
        <tbody>
    `;
    gameData.forEach(h => {
      let color = h.result === 'ok' ? 'green' : (h.result === 'miss' ? 'red' : 'orange');
      html += `<tr>
        <td>${h.letter}</td>
        <td style="color:${color}">${h.result}</td>
      </tr>`;
    });
    html += '</tbody></table>';
  }

  this.renderFull(html);
  const backBtn = document.getElementById('back-btn');
  backBtn.onclick = onBack;
  }
}
