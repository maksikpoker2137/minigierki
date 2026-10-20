// Kółko i krzyżyk – logika po stronie serwera.
// KAŻDA gra eksportuje ten sam "kształt": meta, init, move.
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

module.exports = {
  meta: { id: 'tictactoe', name: 'Kółko i krzyżyk', icon: '❌⭕', desc: 'Klasyk. Trzy w rzędzie wygrywa.', min: 2, max: 2 },

  init(players) {
    return { board: Array(9).fill(null), turn: 0, winner: null, line: null, draw: false,
             names: players.map(p => p.name), scores: [0, 0] };
  },

  // zwraca nowy stan albo { error }
  move(state, playerIndex, { cell }) {
    if (state.winner !== null || state.draw) return { error: 'Runda skończona.' };
    if (playerIndex !== state.turn) return { error: 'Teraz ruch przeciwnika.' };
    if (!Number.isInteger(cell) || cell < 0 || cell > 8 || state.board[cell]) return { error: 'To pole jest zajęte.' };
    state.board[cell] = playerIndex === 0 ? 'X' : 'O';
    const line = LINES.find(l => l.every(i => state.board[i] === state.board[l[0]] && state.board[i]));
    if (line) { state.winner = playerIndex; state.line = line; state.scores[playerIndex]++; }
    else if (state.board.every(Boolean)) state.draw = true;
    else state.turn = 1 - state.turn;
    return state;
  },

  // kolejna runda (zaczyna druga osoba, wyniki zostają)
  rematch(state) {
    const first = 1 - ((state.scores[0] + state.scores[1] + (state.draw ? 1 : 0)) % 2);
    return { ...state, board: Array(9).fill(null), turn: first === 1 ? 1 : 0, winner: null, line: null, draw: false };
  }
};
