const DB_NAME = 'hangman-db';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('words')) {
        const store = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_word', 'word', { unique: true });
      }
      if (!db.objectStoreNames.contains('games')) {
        const store = db.createObjectStore('games', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_date', 'date');
      }
      if (!db.objectStoreNames.contains('attempts')) {
        const store = db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_game', 'gameId', { unique: false });
        store.createIndex('by_game_num', ['gameId', 'number'], { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const WORDS_SEED = [
  "аврора",
  "восток",
  "гитара",
  "градус",
  "грусть",
  "деньги",
  "дерево",
  "доктор",
  "дорога",
  "железо",
  "журнал",
  "звезда",
  "грибок"
];

export async function initDB() {
  await openDB();
  await seedWordsIfEmpty();
}

export async function seedWordsIfEmpty() {
  const db = await openDB();
  const count = await new Promise((res, rej) => {
    const tx = db.transaction('words', 'readonly');
    const req = tx.objectStore('words').count();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  if (count > 0) return;

  await new Promise((res, rej) => {
    const tx = db.transaction('words', 'readwrite');
    const store = tx.objectStore('words');
    WORDS_SEED.forEach(w => store.add({ word: w.toLowerCase() }));
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getRandomWord() {
  const db = await openDB();
  const words = await new Promise((res, rej) => {
    const tx = db.transaction('words', 'readonly');
    const req = tx.objectStore('words').getAll();
    req.onsuccess = () => res(req.result.map(x => x.word));
    req.onerror = () => rej(req.error);
  });
  if (!words.length) throw new Error('В базе нет слов');
  const idx = Math.floor(Math.random() * words.length);
  return words[idx];
}

export async function createGame({ dateISO, player, word, maxWrong }) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('games', 'readwrite');
    const idReq = tx.objectStore('games').add({
      date: dateISO,
      player,
      word,
      outcome: null,
      wrongCount: 0,
      attemptsCount: 0,
      maxWrong
    });
    idReq.onsuccess = () => res(idReq.result);
    idReq.onerror = () => rej(idReq.error);
  });
}

export async function addAttempt({ gameId, number, guess, type, result }) {
  const db = await openDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(['attempts','games'], 'readwrite');
    const aStore = tx.objectStore('attempts');
    aStore.add({ gameId, number, guess, type, result });

    const gStore = tx.objectStore('games');
    const gReq = gStore.get(gameId);
    gReq.onsuccess = () => {
      const g = gReq.result;
      g.attemptsCount = number;
      if (result === 'miss') g.wrongCount = (g.wrongCount || 0) + 1;
      gStore.put(g);
    };
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function finishGame({ gameId, outcome }) {
  const db = await openDB();
  await new Promise((res, rej) => {
    const tx = db.transaction('games', 'readwrite');
    const store = tx.objectStore('games');
    const req = store.get(gameId);
    req.onsuccess = () => {
      const g = req.result;
      g.outcome = outcome;
      store.put(g);
    };
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getAllGames() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('games', 'readonly');
    const req = tx.objectStore('games').getAll();
    req.onsuccess = () => {
      const arr = req.result.sort((a,b) => (a.date < b.date ? 1 : -1));
      res(arr);
    };
    req.onerror = () => rej(req.error);
  });
}

export async function getGameWithAttempts(gameId) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(['games','attempts'], 'readonly');
    const gStore = tx.objectStore('games');
    const aStore = tx.objectStore('attempts');
    const gReq = gStore.get(gameId);
    const aReq = aStore.index('by_game').getAll(IDBKeyRange.only(gameId));
    tx.oncomplete = () => {
      const game = gReq.result;
      const attempts = (aReq.result || []).sort((x,y) => x.number - y.number);
      res({ game, attempts });
    };
    tx.onerror = () => rej(tx.error);
  });
}

export async function deleteGame(gameId) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(['games', 'attempts'], 'readwrite');
    const gamesStore = tx.objectStore('games');
    const attemptsStore = tx.objectStore('attempts');
    
    const index = attemptsStore.index('by_game');
    const range = IDBKeyRange.only(gameId);
    const req = index.openCursor(range);
    
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        attemptsStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    
    gamesStore.delete(gameId);
    
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

export async function findGamesByPlayer(playerName) {
  const db = await openDB();
  const games = await getAllGames();
  return games.filter(game => 
    game.player && 
    game.player.toLowerCase().includes(playerName.toLowerCase())
  );
}

export async function getStatistics() {
  const db = await openDB();
  const games = await getAllGames();
  
  const stats = {
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    totalInProgress: 0,
    totalAttempts: 0,
    averageAttemptsPerGame: 0,
    players: {}
  };
  
  games.forEach(game => {
    stats.totalGames++;
    
    if (game.outcome === 'win') {
      stats.totalWins++;
    } else if (game.outcome === 'lose') {
      stats.totalLosses++;
    } else {
      stats.totalInProgress++;
    }
    
    stats.totalAttempts += game.attemptsCount || 0;
    
    const player = game.player || 'Гость';
    if (!stats.players[player]) {
      stats.players[player] = {
        wins: 0,
        losses: 0,
        total: 0
      };
    }
    stats.players[player].total++;
    if (game.outcome === 'win') stats.players[player].wins++;
    if (game.outcome === 'lose') stats.players[player].losses++;
  });
  
  stats.averageAttemptsPerGame = stats.totalGames > 0 
    ? (stats.totalAttempts / stats.totalGames).toFixed(2) 
    : 0;
  
  return stats;
}

export async function clearDatabase() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(['games', 'attempts'], 'readwrite');
    tx.objectStore('games').clear();
    tx.objectStore('attempts').clear();
    tx.oncomplete = () => {
      console.log('База данных очищена');
      res();
    };
    tx.onerror = () => rej(tx.error);
  });
}