"use strict";
const $ = (id) => document.getElementById(id),
  KEY = "jiujian-save-v1";
let game = null,
  selected = -1,
  noteMode = false,
  paused = false,
  loading = true,
  history = [],
  previous = null,
  prepared = null,
  pending = null,
  dialogAction = null;
let started = false;
let onHome = true;
function read() {
  try {
    const g = JSON.parse(localStorage.getItem(KEY));
    if (
      g &&
      Sudoku.valid(g.puzzle) &&
      Sudoku.valid(g.solution) &&
      g.solution.every(Boolean) &&
      g.puzzle.every((n, i) => !n || n === g.solution[i]) &&
      g.values?.length === 81 &&
      g.values.every(
        (n, i) =>
          Number.isInteger(n) &&
          n >= 0 &&
          n <= 9 &&
          (!g.puzzle[i] || n === g.puzzle[i]),
      ) &&
      g.notes?.length === 81 &&
      g.notes.every(
        (a) =>
          Array.isArray(a) &&
          a.every((n) => Number.isInteger(n) && n >= 1 && n <= 9),
      ) &&
      Number.isFinite(g.seconds) &&
      g.seconds >= 0
    )
      return g;
  } catch {}
  return null;
}
previous = read();
if (previous?.finished) previous = null;
function save() {
  if (!game || !started) return;
  previous = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    document.querySelector(".game-footer>span").textContent =
      "浏览器未允许保存进度";
  }
}
function make() {
  return new Promise((resolve, reject) => {
    if (location.protocol === "file:" || !window.Worker) {
      setTimeout(() => {
        try {
          resolve(Sudoku.generate());
        } catch (e) {
          reject(e);
        }
      }, 30);
      return;
    }
    let w = new Worker("worker.js");
    let timeout = setTimeout(() => {
      w.terminate();
      reject(new Error("生成超时"));
    }, 20000);
    w.onmessage = (e) => {
      clearTimeout(timeout);
      w.terminate();
      e.data.ok ? resolve(e.data.data) : reject(new Error(e.data.error));
    };
    w.onerror = () => {
      clearTimeout(timeout);
      w.terminate();
      reject(new Error("生成失败"));
    };
    w.postMessage("generate");
  });
}
function prefetch() {
  if (!pending && !prepared)
    pending = make()
      .then((p) => {
        prepared = p;
      })
      .catch(() => {})
      .finally(() => {
        pending = null;
      });
}
const recent = [];
async function start() {
  onHome = false;
  loading = true;
  paused = false;
  showCover("正在铺开新一局", "给数字一点时间，找到各自的位置。");
  render();
  try {
    if (pending) await pending;
    let p = prepared || (await make());
    prepared = null;
    while (recent.includes(p.id)) p = await make();
    recent.push(p.id);
    if (recent.length > 20) recent.shift();
    game = {
      ...p,
      values: p.puzzle.slice(),
      notes: Array.from({ length: 81 }, () => []),
      seconds: 0,
      finished: false,
    };
    selected = -1;
    history = [];
    noteMode = false;
    started = true;
    loading = false;
    $("cover").hidden = true;
    save();
    render();
    prefetch();
  } catch {
    loading = false;
    showCover("这局还没准备好", "请再试一次，我们会重新生成题目。", "重新生成");
  }
}
function showCover(title, description, action) {
  $("cover").hidden = false;
  $("think").hidden = !paused;
  $("cover-title").textContent = title;
  $("cover-text").textContent = description;
  $("cover-action").hidden = !action;
  $("cover-action").textContent = action || "";
}
function conflicts() {
  const bad = new Set();
  game.values.forEach((n, i) => {
    if (n && !game.puzzle[i] && n !== game.solution[i]) bad.add(i);
  });
  return bad;
}
const cells = Array.from({ length: 81 }, (_, i) => {
  let b = document.createElement("button");
  b.className = "cell";
  b.addEventListener("click", () => {
    if (
      onHome ||
      loading ||
      !game ||
      game.finished ||
      (paused && !$("cover").hidden)
    )
      return;
    selected = i;
    render();
  });
  $("board").append(b);
  return b;
});
for (let n = 1; n <= 9; n++) {
  let b = document.createElement("button");
  b.innerHTML = n + "<small>9</small>";
  b.setAttribute("aria-label", "填入 " + n);
  b.addEventListener("click", () => input(n));
  $("keypad").append(b);
}
function render() {
  $("home").hidden = !onHome;
  $("game-screen").hidden = onHome;
  $("back-home").hidden = onHome;
  $("home-continue").hidden = !(game && !game.finished) && !previous;
  $("pause-state").hidden = !paused;
  $("rest").hidden = !paused || !$("cover").hidden;
  $("pause").textContent = paused ? "▷" : "Ⅱ";
  const locked = onHome || loading || !game || paused || game.finished;
  $("notes").setAttribute("aria-pressed", String(noteMode));
  $("note-state").textContent = noteMode ? "开" : "关";
  for (const id of ["notes", "erase", "undo", "pause"]) $(id).disabled = locked;
  $("new-game").disabled = loading;
  $("undo").disabled = locked || !history.length;
  $("erase").disabled = locked || selected < 0 || !!game?.puzzle[selected];
  $("pause").disabled = onHome || loading || !game || game.finished;
  $("pause").setAttribute("aria-label", paused ? "继续游戏" : "暂停游戏");
  [...$("keypad").children].forEach((b) => (b.disabled = locked));
  if (!game) return;
  const bad = conflicts(),
    value = selected >= 0 ? game.values[selected] : 0;
  cells.forEach((b, i) => {
    const n = game.values[i];
    b.className =
      "cell" +
      (game.puzzle[i] ? " given" : "") +
      (selected >= 0 && Sudoku.peers[selected].includes(i) ? " related" : "") +
      (value && value === n ? " same" : "") +
      (i === selected ? " selected" : "") +
      (bad.has(i) ? " conflict" : "");
    b.disabled =
      onHome || loading || game.finished || (paused && !$("cover").hidden);
    b.tabIndex = i === (selected < 0 ? 0 : selected) ? 0 : -1;
    b.setAttribute(
      "aria-label",
      `第 ${Math.floor(i / 9) + 1} 行第 ${(i % 9) + 1} 列，${n || "空格"}${game.puzzle[i] ? "，已知数字" : ""}${bad.has(i) ? "，数字不正确" : ""}`,
    );
    b.setAttribute("aria-pressed", String(i === selected));
    b.textContent = n || "";
    if (!n && game.notes[i].length) {
      const grid = document.createElement("span");
      grid.className = "pencil";
      for (let k = 1; k <= 9; k++) {
        let s = document.createElement("span");
        s.textContent = game.notes[i].includes(k) ? k : "";
        grid.append(s);
      }
      b.append(grid);
    }
  });
  const filled = game.values.filter((n, i) => n === game.solution[i]).length;
  $("progress").textContent = "还剩 " + (81 - filled) + " 格";
  $("progress").title = "还需要填写或改正的格子数";
  $("progress-bar").style.width = (filled / 81) * 100 + "%";
  $("status").textContent = game.finished
    ? "每一个数字，都找到了自己的位置。"
    : paused
      ? "计时已暂停，可以继续观察棋盘"
      : bad.size
        ? "红色数字不正确，可以擦除或修改"
        : noteMode
          ? "笔记模式 · 记录可能的数字"
          : "选择空格，填入数字";
  $("status").style.color = bad.size ? "#b85147" : "";
  [...$("keypad").children].forEach((b, k) => {
    let left =
      9 -
      game.values.filter((n, i) => n === k + 1 && n === game.solution[i])
        .length;
    b.querySelector("small").textContent = left <= 0 ? "齐" : "余 " + left;
    b.title = "数字 " + (k + 1) + " 还需正确填写 " + left + " 个";
  });
  updateTimer();
}
function updateTimer() {
  if (game)
    $("timer").textContent =
      Math.floor(game.seconds / 60)
        .toString()
        .padStart(2, "0") +
      ":" +
      (game.seconds % 60).toString().padStart(2, "0");
}
function snapshot() {
  started = true;
  history.push({
    values: game.values.slice(),
    notes: game.notes.map((a) => a.slice()),
  });
  if (history.length > 200) history.shift();
}
function input(n) {
  if (
    !game ||
    onHome ||
    loading ||
    paused ||
    game.finished ||
    selected < 0 ||
    game.puzzle[selected]
  )
    return;
  if (noteMode) {
    if (game.values[selected]) return;
    snapshot();
    const a = game.notes[selected];
    game.notes[selected] = a.includes(n)
      ? a.filter((x) => x !== n)
      : [...a, n].sort();
  } else {
    if (game.values[selected] === n) return;
    snapshot();
    game.values[selected] = n;
    game.notes[selected] = [];
    if (n === game.solution[selected])
      for (const j of Sudoku.peers[selected])
        game.notes[j] = game.notes[j].filter((x) => x !== n);
  }
  if (game.values.every(Boolean) && Sudoku.valid(game.values)) {
    game.finished = true;
    showCover(
      "刚刚好，全部归位。",
      `你用 ${Math.floor(game.seconds / 60)} 分 ${game.seconds % 60} 秒，完成了这一方九宫。`,
      "再来一局",
    );
  }
  save();
  render();
}
$("notes").onclick = () => {
  noteMode = !noteMode;
  render();
};
$("erase").onclick = () => {
  if (
    selected < 0 ||
    game.puzzle[selected] ||
    (!game.values[selected] && !game.notes[selected].length)
  )
    return;
  snapshot();
  game.values[selected] = 0;
  game.notes[selected] = [];
  save();
  render();
};
$("undo").onclick = () => {
  const h = history.pop();
  if (h) {
    game.values = h.values;
    game.notes = h.notes;
    save();
    render();
  }
};
function modal(title, body, label, action, cancel = false) {
  $("dialog-title").textContent = title;
  $("dialog-body").innerHTML = body;
  $("confirm").textContent = label;
  $("cancel").hidden = !cancel;
  dialogAction = action;
  $("dialog").showModal();
}
$("confirm").onclick = () => {
  $("dialog").close();
  dialogAction?.();
};
$("cancel").onclick = () => $("dialog").close();
$("help").onclick = () =>
  modal(
    "九宫之间，自有章法。",
    "<p>在空格里填入 1～9，使每一行、每一列、每个 3×3 小宫都没有重复数字。深色数字是题目给定的，无法修改。</p><p>点击空格，再点击下方数字。开启「笔记」可记录候选数，擦除和撤销让你放心尝试。</p><p>正式填写的数字会立即核对唯一解，错误会标红；笔记不判错。</p><p>电脑快捷键：数字 1～9 输入，方向键移动，N 切换笔记，Backspace 擦除，Ctrl / ⌘ + Z 撤销。</p><p>每道题实时生成，经过唯一解和基础逻辑可解检查。关闭后可以从主页「继续游戏」找回进度。「还剩」是待填写或改正的格子数，数字键上的「余」是该数字还需正确填写的个数。暂停后棋盘保持清晰可见，停止计时和填写；点击「休息一下」可遮住棋盘，点击计时器旁的继续按钮恢复。</p>",
    "开始思考",
  );
$("new-game").onclick = () => {
  if (game && !game.finished && started)
    modal(
      "换一方新的九宫？",
      "<p>开始新一局将替换当前进度。</p>",
      "开始新一局",
      () => {
        previous = null;
        start();
      },
      true,
    );
  else {
    previous = null;
    start();
  }
};
$("home-continue").onclick = () => {
  if (!game || game.finished) {
    if (!previous) return;
    game = previous;
    previous = null;
    history = [];
    selected = -1;
    noteMode = false;
  }
  onHome = false;
  paused = false;
  loading = false;
  started = true;
  $("cover").hidden = true;
  save();
  render();
};
$("home-new").onclick = () => {
  if ((game && !game.finished) || previous) {
    modal(
      "开始新一局？",
      "<p>新的题目会替换未完成的进度。</p>",
      "开始新一局",
      () => {
        previous = null;
        start();
      },
      true,
    );
  } else start();
};
$("back-home").onclick = () => {
  save();
  onHome = true;
  paused = false;
  $("cover").hidden = true;
  render();
};
$("think").onclick = () => {
  $("cover").hidden = true;
  render();
};
$("pause").onclick = () => {
  if (paused) {
    paused = false;
    $("cover").hidden = true;
    render();
    return;
  }
  paused = true;
  save();
  $("cover").hidden = true;
  render();
};
$("rest").onclick = () => {
  showCover("让思绪歇一会儿", "数字会在这里，等你回来。", "继续游戏");
  render();
};
$("cover-action").onclick = () => {
  if (paused) {
    paused = false;
    $("cover").hidden = true;
    render();
  } else {
    previous = null;
    start();
  }
};
window.addEventListener("keydown", (e) => {
  if (onHome || $("dialog").open || loading || paused || !game || game.finished)
    return;
  if (
    e.target.closest("button") &&
    !e.target.classList.contains("cell") &&
    (e.key === "Enter" || e.key === " ")
  )
    return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    $("undo").click();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    input(Number(e.key));
  } else if (e.key.toLowerCase() === "n") $("notes").click();
  else if (["Backspace", "Delete"].includes(e.key)) {
    e.preventDefault();
    $("erase").click();
  } else if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    if (selected < 0) selected = 0;
    else {
      const r = Math.floor(selected / 9),
        c = selected % 9;
      if (e.key === "ArrowLeft") selected = r * 9 + Math.max(0, c - 1);
      if (e.key === "ArrowRight") selected = r * 9 + Math.min(8, c + 1);
      if (e.key === "ArrowUp") selected = Math.max(0, r - 1) * 9 + c;
      if (e.key === "ArrowDown") selected = Math.min(8, r + 1) * 9 + c;
    }
    render();
    cells[selected].focus();
  }
});
setInterval(() => {
  if (
    game &&
    !onHome &&
    !loading &&
    !paused &&
    !game.finished &&
    !document.hidden &&
    !$("dialog").open
  ) {
    game.seconds++;
    updateTimer();
    if (game.seconds % 5 === 0 && started) save();
  }
}, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game && started) save();
});
window.addEventListener("pagehide", () => {
  if (game && started) save();
});
loading = false;
render();
prefetch();
