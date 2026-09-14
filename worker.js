importScripts("engine.js");
onmessage = () => {
  try {
    postMessage({ ok: true, data: Sudoku.generate() });
  } catch (e) {
    postMessage({ ok: false, error: e.message });
  }
};
