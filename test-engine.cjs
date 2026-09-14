const assert = require("node:assert/strict");
require("./engine.js");
// Independent row/column/box solver cross-checks uniqueness.
function countSolutions(input) {
  const a = input.slice();
  let count = 0;
  function options(i) {
    let out = [];
    for (let n = 1; n <= 9; n++) {
      let ok = true;
      for (let j = 0; j < 81; j++)
        if (
          a[j] === n &&
          (Math.floor(j / 9) === Math.floor(i / 9) ||
            j % 9 === i % 9 ||
            (Math.floor(j / 27) === Math.floor(i / 27) &&
              Math.floor((j % 9) / 3) === Math.floor((i % 9) / 3)))
        ) {
          ok = false;
          break;
        }
      if (ok) out.push(n);
    }
    return out;
  }
  function go() {
    let best = -1,
      d;
    for (let i = 0; i < 81; i++)
      if (!a[i]) {
        const o = options(i);
        if (!o.length) return;
        if (!d || o.length < d.length) {
          d = o;
          best = i;
          if (d.length === 1) break;
        }
      }
    if (best < 0) {
      count++;
      return;
    }
    for (const n of d) {
      a[best] = n;
      go();
      a[best] = 0;
      if (count >= 2) return;
    }
  }
  go();
  return count;
}
const ids = new Set(),
  times = [];
for (let k = 0; k < 100; k++) {
  const t = performance.now(),
    p = Sudoku.generate();
  times.push(performance.now() - t);
  assert(Sudoku.valid(p.solution));
  assert(p.solution.every(Boolean));
  assert(p.puzzle.every((n, i) => !n || n === p.solution[i]));
  assert.equal(countSolutions(p.puzzle), 1);
  assert(Sudoku.logical(p.puzzle).solved);
  assert(!ids.has(p.id));
  ids.add(p.id);
}
assert.equal(Sudoku.search(Array(81).fill(0), 2).count, 2);
const bad = Array(81).fill(0);
bad[0] = bad[1] = 1;
assert.equal(Sudoku.search(bad).count, 0);
console.log(
  `PASS: 100 different puzzles, independently verified unique solutions, valid givens, logic solvability; empty / invalid boards checked. Generation avg ${Math.round(times.reduce((a, b) => a + b) / 100)} ms, max ${Math.round(Math.max(...times))} ms.`,
);
