/* Original Sudoku engine. No third-party puzzle code. */
(function (root) {
  "use strict";
  const FULL = 0x3fe;
  const units = [];
  for (let r = 0; r < 9; r++)
    units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++)
    units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++)
    units.push(
      Array.from(
        { length: 9 },
        (_, k) =>
          (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 +
          (b % 3) * 3 +
          (k % 3),
      ),
    );
  const peers = Array.from({ length: 81 }, (_, i) =>
    [...new Set(units.filter((u) => u.includes(i)).flat())].filter(
      (j) => i !== j,
    ),
  );
  const digits = (m) =>
    Array.from({ length: 9 }, (_, k) => k + 1).filter((n) => m & (1 << n));
  function mask(a, i) {
    let m = FULL;
    for (const j of peers[i]) m &= ~(1 << a[j]);
    return m;
  }
  function valid(a) {
    return (
      a.length === 81 &&
      a.every(
        (n, i) =>
          Number.isInteger(n) &&
          n >= 0 &&
          n <= 9 &&
          (!n || peers[i].every((j) => a[j] !== n)),
      )
    );
  }
  function search(a, limit = 2, random = false) {
    if (!valid(a)) return { count: 0, solution: null };
    let count = 0,
      solution = null;
    function visit() {
      let at = -1,
        choices = null;
      for (let i = 0; i < 81; i++)
        if (!a[i]) {
          let d = digits(mask(a, i));
          if (!d.length) return;
          if (!choices || d.length < choices.length) {
            at = i;
            choices = d;
            if (d.length === 1) break;
          }
        }
      if (at < 0) {
        count++;
        solution = a.slice();
        return;
      }
      if (random) shuffle(choices);
      for (const n of choices) {
        a[at] = n;
        visit();
        a[at] = 0;
        if (count >= limit) return;
      }
    }
    visit();
    return { count, solution };
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function logical(puzzle) {
    let a = puzzle.slice(),
      steps = 0,
      hidden = 0;
    while (a.includes(0)) {
      let moved = false;
      for (let i = 0; i < 81; i++)
        if (!a[i]) {
          let d = digits(mask(a, i));
          if (!d.length) return { solved: false };
          if (d.length === 1) {
            a[i] = d[0];
            steps++;
            moved = true;
          }
        }
      if (moved) continue;
      outer: for (const u of units)
        for (let n = 1; n <= 9; n++) {
          if (u.some((i) => a[i] === n)) continue;
          let spots = u.filter((i) => !a[i] && mask(a, i) & (1 << n));
          if (spots.length === 1) {
            a[spots[0]] = n;
            steps++;
            hidden++;
            moved = true;
            break outer;
          }
        }
      if (!moved) return { solved: false };
    }
    return { solved: true, steps, hidden };
  }
  function generate() {
    const solution = search(Array(81).fill(0), 1, true).solution;
    let puzzle = solution.slice();
    const order = shuffle(Array.from({ length: 81 }, (_, i) => i));
    const target = 34 + Math.floor(Math.random() * 5);
    let clues = 81;
    for (const i of order) {
      if (clues <= target) break;
      let n = puzzle[i];
      puzzle[i] = 0;
      if (search(puzzle.slice(), 2).count !== 1 || !logical(puzzle).solved)
        puzzle[i] = n;
      else clues--;
    }
    return {
      puzzle,
      solution,
      id: puzzle.join(""),
      clues,
      rating: logical(puzzle),
    };
  }
  root.Sudoku = { generate, search, logical, valid, peers, units };
})(globalThis);
