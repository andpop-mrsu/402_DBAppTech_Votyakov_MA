export async function createGame(data) {
  const res = await fetch('/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Ошибка ${res.status}`);
  return res.json();
}

export async function addStep(gameId, step) {
  const res = await fetch(`/step/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(step)
  });
  if (!res.ok) throw new Error(`Ошибка ${res.status}`);
  return res.json();
}

export async function getAllGames() {
  const res = await fetch('/games');
  if (!res.ok) throw new Error(`Ошибка ${res.status}`);
  return res.json();
}

export async function getGameById(id) {
  const res = await fetch(`/games/${id}`);
  if (!res.ok) throw new Error(`Ошибка ${res.status}`);
  return res.json();
}
