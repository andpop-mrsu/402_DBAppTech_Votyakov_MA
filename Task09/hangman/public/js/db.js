export async function createGame(data) {
  const slimData = {
    player: data.player || 'Anonymous',
    word: data.word,
    won: data.won ? 1 : 0,
    wrong: data.wrong || 0,
    history: data.history || []
  };

  const res = await fetch('/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slimData)
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Ошибка ${res.status}`);
  }
  
  return res.json();
}

export async function addStep(gameId, step) {
  const res = await fetch(`/step/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      letter: step.letter,
      result: step.result
    })
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Ошибка ${res.status}`);
  }
  
  return res.json();
}

export async function updateGame(gameId, updates) {
  const res = await fetch(`/games/${gameId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Ошибка ${res.status}`);
  }
  
  return res.json();
}

export async function getAllGames() {
  const res = await fetch('/games');
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Ошибка ${res.status}`);
  }
  
  return res.json();
}

export async function getGameById(id) {
  const res = await fetch(`/games/${id}`);
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Ошибка ${res.status}`);
  }
  
  const data = await res.json();
  return data.steps || [];
}