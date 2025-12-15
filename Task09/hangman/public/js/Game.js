export default class Game {
  constructor(word) {
    this.word = word.toLowerCase();
    this.maxWrong = 6;
    this.wrong = 0;
    this.guessed = [];
    this.history = [];
  }

  guess(letter) {
    letter = letter.toLowerCase();

    let result;
    if (this.guessed.includes(letter)) {
      result = 'repeat';
    } else {
      this.guessed.push(letter);
      if (this.word.includes(letter)) {
        result = 'ok';
      } else {
        this.wrong++;
        result = 'miss';
      }
    }

    this.history.push({ letter, result });
    return result;
  }

  getMaskedWord() {
    return [...this.word]
      .map(c => (this.guessed.includes(c) ? c : '_'))
      .join('');
  }

  getWrongCount() {
    return this.wrong;
  }

  isWon() {
    return !this.getMaskedWord().includes('_');
  }

  isLost() {
    return this.wrong >= this.maxWrong;
  }

  getWord() {
    return this.word;
  }

  getHistory() {
    return this.history;
  }
}
