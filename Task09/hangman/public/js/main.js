import Game from './Game.js';
import View from './View.js';
import { createGame, addStep, getAllGames, getGameById, updateGame } from './db.js';

const playerInput = document.getElementById("player-name");

let game;
let currentGameId = null;
const view = new View(handleGuess, startGame, () => {
  view.fullArea.style.display = 'none';
  view.showGamePanels();
});

document.getElementById("btn-info").onclick = () => view.renderInfo();
document.getElementById("btn-list").onclick = async () => {
  const games = await getAllGames();
  view.renderSavedGames(games, renderReplay);
};

async function startGame() {
  const words = ["АВРОРА", "ВОСТОК", "ГИТАРА", "ГРАДУС", "ГРУСТЬ", "ДЕНЬГИ",
  "ДЕРЕВО", "ДОКТОР", "ДОРОГА", "ЖЕЛЕЗО", "ЖУРНАЛ", "ЗВЕЗДА",
  "КОСМОС", "МОЛНИЯ", "РАДУГА", "СУМРАК", "ТАЙНИК",
  "УЛЫБКА", "ФОНТАН", "ЦВЕТОК", "ЮНОСТЬ", "ЯБЛОКО", "ЯНТАРЬ", "БАНКЕТ"];
  const randomWord = words[Math.floor(Math.random() * words.length)];
  game = new Game(randomWord);
  currentGameId = null;

  view.fullArea.style.display = 'none';
  view.showGamePanels();
  view.renderLetters(handleGuess);
  view.renderWord(game.getMaskedWord());
  view.renderHangman(game.getWrongCount());
  view.showMessage('Начните угадывать!');
}

async function handleGuess(letter, btn) {
  const result = game.guess(letter);
  view.disableLetter(btn);
  view.renderWord(game.getMaskedWord());
  view.renderHangman(game.getWrongCount());

  if (result === 'ok') view.showMessage(`Хорошо! '${letter}' есть в слове.`);
  if (result === 'miss') view.showMessage(`Извините, '${letter}' нет в слове.`);
  if (result === 'repeat') view.showMessage(`Вы уже использовали '${letter}'.`);

  const player = playerInput.value.trim() || "Anonymous";

  if (!currentGameId) {
    const gameData = {
      player,
      word: game.getWord(),
      won: game.isWon(),
      wrong: game.getWrongCount(),
      history: game.getHistory()
    };
    
    try {
      const res = await createGame(gameData);
      currentGameId = res.id;
      console.log('Игра создана, ID:', currentGameId);
    } catch (error) {
      console.error('Ошибка создания игры:', error);
      view.showMessage('Ошибка сохранения игры');
    }
  } else {
    const lastStep = game.getHistory().slice(-1)[0];
    try {
      await addStep(currentGameId, lastStep);
      console.log('Шаг сохранён:', lastStep);
    } catch (error) {
      console.error('Ошибка сохранения шага:', error);
    }
  }

  if (game.isWon() || game.isLost()) {
    if (game.isWon()) {
      view.showMessage(`Вы угадали! Слово было '${game.getWord()}'`);
    } else if (game.isLost()) {
      view.showMessage(`Вы проиграли! Слово было '${game.getWord()}'`);
    }
    view.disableAllLetters();
    
    if (currentGameId) {
      try {
        await updateGame(currentGameId, {
          won: game.isWon(),
          wrong: game.getWrongCount()
        });
        console.log('Статус игры обновлён');
      } catch (error) {
        console.error('Ошибка обновления игры:', error);
      }
    }
  }
}

async function renderSavedGames() {
  try {
    const games = await getAllGames();
    view.renderSavedGames(games, renderReplay);
  } catch (error) {
    console.error('Ошибка загрузки игр:', error);
    view.showMessage('Ошибка загрузки списка игр');
  }
}

async function renderReplay(data) {
  try {
    const info = JSON.parse(data);
    const steps = await getGameById(info.id);
    
    if (!steps || steps.length === 0) {
      alert("История игры не найдена");
      return;
    }
    
    view.renderReplay(steps, info, renderSavedGames);
  } catch (error) {
    console.error('Ошибка загрузки повтора:', error);
    alert('Ошибка загрузки истории игры');
  }
}

startGame();