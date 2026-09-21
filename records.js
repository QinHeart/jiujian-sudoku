/* Local completed games and a self-contained PNG renderer. */
(function (root) {
  "use strict";
  const KEY = "jiujian-records-v1",
    $ = (id) => document.getElementById(id);
  function valid(r) {
    return (
      r &&
      Array.isArray(r.puzzle) &&
      Sudoku.valid(r.puzzle) &&
      Array.isArray(r.solution) &&
      Sudoku.valid(r.solution) &&
      r.solution.every(Boolean) &&
      r.puzzle.every((n, i) => !n || n === r.solution[i]) &&
      Number.isFinite(r.seconds) &&
      r.seconds >= 0 &&
      typeof r.completedAt === "string" &&
      Number.isFinite(Date.parse(r.completedAt))
    );
  }
  function read() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(a) ? a.filter(valid).slice(0, 30) : [];
    } catch {
      return [];
    }
  }
  let records = read(),
    current = null,
    storageFailed = false;
  function add(g) {
    if (!g?.finished) return;
    const r = {
      puzzle: g.puzzle.slice(),
      solution: g.solution.slice(),
      seconds: g.seconds,
      completedAt: g.completedAt || new Date().toISOString(),
    };
    if (!valid(r)) return;
    const id = r.puzzle.join("");
    if (
      records.some(
        (x) => x.puzzle.join("") === id && x.completedAt === r.completedAt,
      )
    )
      return;
    // Legacy finished saves are imported once.
    if (!g.completedAt && records.some((x) => x.puzzle.join("") === id)) return;
    records = [r, ...records].slice(0, 30);
    try {
      localStorage.setItem(KEY, JSON.stringify(records));
      storageFailed = false;
    } catch {
      storageFailed = true;
    }
  }
  const duration = (r) =>
    `${Math.floor(r.seconds / 60)} 分 ${Math.floor(r.seconds % 60)} 秒`;
  const date = (r) =>
    new Date(r.completedAt).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  function list() {
    $("records-dialog").classList.remove("viewing-record");
    $("records-list").hidden = false;
    $("record-detail").hidden = true;
    $("records-list").replaceChildren();
    document.querySelector(".records-caption").textContent = storageFailed
      ? "浏览器未允许保存，记录暂留本次打开期间"
      : "保存在此设备 · 最近 30 局";
    if (!records.length) {
      const p = document.createElement("p");
      p.className = "records-empty";
      p.textContent = "完成第一局后，棋盘会留在这里。";
      $("records-list").append(p);
      return;
    }
    records.forEach((r) => {
      const b = document.createElement("button");
      b.className = "record-row";
      const t = document.createElement("span"),
        s = document.createElement("strong");
      t.textContent = date(r);
      s.textContent = duration(r) + "  ↗";
      b.append(t, s);
      b.onclick = () => detail(r);
      $("records-list").append(b);
    });
  }
  function detail(r) {
    $("records-dialog").classList.add("viewing-record");
    current = r;
    $("records-list").hidden = true;
    $("record-detail").hidden = false;
    $("record-info").textContent = date(r) + " · 用时 " + duration(r);
    $("record-export-status").textContent = "";
    $("record-board").replaceChildren();
    r.solution.forEach((n, i) => {
      const c = document.createElement("span");
      c.textContent = n;
      c.className = r.puzzle[i] ? "given" : "";
      $("record-board").append(c);
    });
  }
  async function png(r) {
    if (
      !valid({ ...r, completedAt: r.completedAt || new Date().toISOString() })
    )
      throw Error("没有可保存的完整棋盘");
    if (document.fonts?.ready) await document.fonts.ready;
    const c = document.createElement("canvas");
    c.width = 1000;
    c.height = 1240;
    const x = c.getContext("2d");
    x.fillStyle = "#f3f6fc";
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#24324a";
    x.font = '42px "Songti SC", serif';
    x.fillText("九间 · 数独", 64, 88);
    x.fillStyle = "#65758c";
    x.font = "22px sans-serif";
    x.textAlign = "right";
    x.fillText(
      "完成于 " +
        date({ ...r, completedAt: r.completedAt || new Date().toISOString() }),
      936,
      84,
    );
    const left = 64,
      top = 140,
      size = 872,
      cell = size / 9;
    x.fillStyle = "#ffffff";
    x.fillRect(left, top, size, size);
    for (let i = 0; i <= 9; i++) {
      x.beginPath();
      x.strokeStyle = i % 3 === 0 ? "#62748e" : "#d9e1ed";
      x.lineWidth = i % 3 === 0 ? 3 : 1;
      x.moveTo(left + i * cell, top);
      x.lineTo(left + i * cell, top + size);
      x.stroke();
      x.beginPath();
      x.moveTo(left, top + i * cell);
      x.lineTo(left + size, top + i * cell);
      x.stroke();
    }
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.font = "48px sans-serif";
    r.solution.forEach((n, i) => {
      x.fillStyle = r.puzzle[i] ? "#24324a" : "#2864d7";
      x.fillText(
        n,
        left + ((i % 9) + 0.5) * cell,
        top + (Math.floor(i / 9) + 0.5) * cell,
      );
    });
    x.textAlign = "left";
    x.fillStyle = "#24324a";
    x.font = '32px "Songti SC", serif';
    x.fillText("刚刚好，全部归位。", 64, 1072);
    x.fillStyle = "#526580";
    x.font = "25px sans-serif";
    x.fillText("用时 " + duration(r), 64, 1130);
    x.font = "18px sans-serif";
    x.fillStyle = "#718198";
    x.fillText("九间 · THE QUIET GRID", 64, 1190);
    return new Promise((resolve, reject) =>
      c.toBlob(
        (b) => (b ? resolve(b) : reject(Error("图片生成失败"))),
        "image/png",
      ),
    );
  }
  async function download(r, status, button) {
    button.disabled = true;
    status.textContent = "正在生成图片…";
    try {
      const blob = await png(r),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download =
        "九间数独-" +
        (r.completedAt || new Date().toISOString()).slice(0, 10) +
        ".png";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent = "图片已生成，请在浏览器下载中查看。";
    } catch (e) {
      status.textContent = "图片保存失败，请重试。";
    } finally {
      button.disabled = false;
    }
  }
  $("home-records").onclick = () => {
    list();
    $("records-dialog").showModal();
  };
  $("record-back").onclick = list;
  $("record-save").onclick = () =>
    download(current, $("record-export-status"), $("record-save"));
  root.SudokuRecords = { add, download, png };
})(globalThis);
