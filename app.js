// ---------- 設定の永続化 ----------
const STORAGE_KEY = "baito_jobs_v1";

const DEFAULT_JOBS = [
  {
    id: "ministo",
    keyword: "ミニスト",
    baseRate: 1160,
    closingDay: 31,
    payMonthOffset: 1,
    payDay: 25,
    rules: [
      { label: "深夜(22:00-6:00)", dayType: "any", timeStart: "22:00", timeEnd: "06:00", rate: 1450 },
    ],
  },
  {
    id: "gura",
    keyword: "ぐら",
    baseRate: 1150,
    closingDay: 31,
    payMonthOffset: 1,
    payDay: 25,
    rules: [
      { label: "休日", dayType: "holiday", timeStart: "", timeEnd: "", rate: 1200 },
    ],
  },
  {
    id: "juku",
    keyword: "塾",
    baseRate: 1400,
    closingDay: 31,
    payMonthOffset: 1,
    payDay: 25,
    rules: [],
  },
];

const JOB_DEFAULTS = { closingDay: 31, payMonthOffset: 1, payDay: 25 };

function loadJobs() {
  const raw = localStorage.getItem(STORAGE_KEY);
  let parsed;
  if (!raw) {
    parsed = structuredClone(DEFAULT_JOBS);
  } else {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = structuredClone(DEFAULT_JOBS);
    }
  }
  // 既存データに締め日/支払サイクルが無ければ補完する(移行処理)
  return parsed.map((job) => ({ ...JOB_DEFAULTS, ...job }));
}

function saveJobs(jobs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

let jobs = loadJobs();

// ---------- タブ切り替え ----------
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
let reportLoadedOnce = false;

function switchTab(tab) {
  tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  tabPanels.forEach((p) => p.classList.toggle("active", p.dataset.tab === tab));
  if (tab === "report" && accessToken && !reportLoadedOnce) {
    reportLoadedOnce = true;
    loadReport();
  }
}

tabButtons.forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

// ---------- 設定画面の描画 ----------
const jobsContainer = document.getElementById("jobs-container");

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function renderJobs() {
  jobsContainer.innerHTML = "";
  jobs.forEach((job) => {
    const card = document.createElement("div");
    card.className = "job-card";
    card.dataset.jobId = job.id;

    const header = document.createElement("div");
    header.className = "job-card-header";
    header.innerHTML = `
      <div class="row">
        <div class="field">
          <label class="field-label">キーワード</label>
          <input name="keyword" value="${escapeHtml(job.keyword)}">
        </div>
        <div class="field">
          <label class="field-label">基本時給</label>
          <div class="rate-input-wrap"><input name="baseRate" type="number" value="${job.baseRate}"></div>
        </div>
      </div>
      <button class="icon-btn remove-job" title="このバイトを削除">✕</button>
    `;
    card.appendChild(header);

    const payCycle = document.createElement("div");
    payCycle.className = "paycycle-row";
    payCycle.innerHTML = `
      <div class="field">
        <label class="field-label">締め日</label>
        <div class="day-input-wrap"><input name="closingDay" type="number" min="1" max="31" value="${job.closingDay}"></div>
      </div>
      <div class="field">
        <label class="field-label">支払サイクル</label>
        <select name="payMonthOffset">
          <option value="0">当月払い</option>
          <option value="1">翌月払い</option>
          <option value="2">翌々月払い</option>
        </select>
      </div>
      <div class="field">
        <label class="field-label">振込日</label>
        <div class="day-input-wrap"><input name="payDay" type="number" min="1" max="31" value="${job.payDay}"></div>
      </div>
    `;
    payCycle.querySelector('select[name="payMonthOffset"]').value = String(job.payMonthOffset);
    card.appendChild(payCycle);

    const rulesWrap = document.createElement("div");
    rulesWrap.className = "rules-wrap";
    job.rules.forEach((rule) => rulesWrap.appendChild(renderRuleRow(job, rule)));
    card.appendChild(rulesWrap);

    const addRuleBtn = document.createElement("button");
    addRuleBtn.className = "ghost";
    addRuleBtn.textContent = "+ 割増ルールを追加";
    addRuleBtn.addEventListener("click", () => {
      const rule = { label: "割増", dayType: "any", timeStart: "", timeEnd: "", rate: job.baseRate };
      job.rules.push(rule);
      persistAndRerender();
    });
    card.appendChild(addRuleBtn);

    header.querySelector(".remove-job").addEventListener("click", () => {
      if (!confirm(`「${job.keyword}」を削除しますか？`)) return;
      jobs = jobs.filter((j) => j.id !== job.id);
      persistAndRerender();
    });

    header.querySelector('input[name="keyword"]').addEventListener("change", (e) => {
      job.keyword = e.target.value;
      persistAndRerender();
    });
    header.querySelector('input[name="baseRate"]').addEventListener("change", (e) => {
      job.baseRate = Number(e.target.value) || 0;
      persistAndRerender();
    });

    payCycle.querySelector('input[name="closingDay"]').addEventListener("change", (e) => {
      job.closingDay = Math.min(31, Math.max(1, Number(e.target.value) || 31));
      e.target.value = job.closingDay;
      saveJobs(jobs);
    });
    payCycle.querySelector('select[name="payMonthOffset"]').addEventListener("change", (e) => {
      job.payMonthOffset = Number(e.target.value);
      saveJobs(jobs);
    });
    payCycle.querySelector('input[name="payDay"]').addEventListener("change", (e) => {
      job.payDay = Math.min(31, Math.max(1, Number(e.target.value) || 25));
      e.target.value = job.payDay;
      saveJobs(jobs);
    });

    jobsContainer.appendChild(card);
  });
}

function renderRuleRow(job, rule) {
  const row = document.createElement("div");
  row.className = "rule-row";
  row.innerHTML = `
    <div class="field">
      <label class="field-label">ラベル</label>
      <input name="label" value="${escapeHtml(rule.label)}" style="width:110px;">
    </div>
    <div class="field">
      <label class="field-label">曜日区分</label>
      <select name="dayType">
        <option value="any">指定なし</option>
        <option value="weekday">平日のみ</option>
        <option value="holiday">休日のみ(土日祝)</option>
      </select>
    </div>
    <div class="field">
      <label class="field-label">開始時刻</label>
      <input name="timeStart" type="time" value="${rule.timeStart || ""}">
    </div>
    <div class="field">
      <label class="field-label">終了時刻</label>
      <input name="timeEnd" type="time" value="${rule.timeEnd || ""}">
    </div>
    <div class="field">
      <label class="field-label">時給</label>
      <div class="rate-input-wrap"><input name="rate" type="number" value="${rule.rate}"></div>
    </div>
    <button class="icon-btn remove-rule" title="このルールを削除">✕</button>
  `;
  row.querySelector('select[name="dayType"]').value = rule.dayType;

  row.querySelector('input[name="label"]').addEventListener("change", (e) => {
    rule.label = e.target.value;
    saveJobs(jobs);
  });
  row.querySelector('select[name="dayType"]').addEventListener("change", (e) => {
    rule.dayType = e.target.value;
    saveJobs(jobs);
  });
  row.querySelector('input[name="timeStart"]').addEventListener("change", (e) => {
    rule.timeStart = e.target.value;
    saveJobs(jobs);
  });
  row.querySelector('input[name="timeEnd"]').addEventListener("change", (e) => {
    rule.timeEnd = e.target.value;
    saveJobs(jobs);
  });
  row.querySelector('input[name="rate"]').addEventListener("change", (e) => {
    rule.rate = Number(e.target.value) || 0;
    saveJobs(jobs);
  });
  row.querySelector(".remove-rule").addEventListener("click", () => {
    job.rules = job.rules.filter((r) => r !== rule);
    persistAndRerender();
  });

  return row;
}

function persistAndRerender() {
  saveJobs(jobs);
  renderJobs();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

document.getElementById("add-job-btn").addEventListener("click", () => {
  jobs.push({ id: uid(), keyword: "新しいバイト", baseRate: 1000, ...JOB_DEFAULTS, rules: [] });
  persistAndRerender();
});

let saveStatusTimer = null;
document.getElementById("save-settings-btn").addEventListener("click", () => {
  // フォーカス中の入力欄があれば、その変更を確定させてから保存する
  if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
  saveJobs(jobs);

  const statusEl = document.getElementById("save-status");
  statusEl.textContent = "保存しました";
  statusEl.classList.add("saved");
  clearTimeout(saveStatusTimer);
  saveStatusTimer = setTimeout(() => {
    statusEl.textContent = "";
    statusEl.classList.remove("saved");
  }, 2000);
});

renderJobs();

// ---------- Google認証 ----------
let accessToken = null;
let tokenClient = null;

const TOKEN_STORAGE_KEY = "baito_google_token_v1";
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000; // 期限ぎりぎりでの失敗を避けるための余裕

function saveToken(token, expiresInSec) {
  const expiresAt = Date.now() + expiresInSec * 1000;
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token, expiresAt }));
}

function loadStoredToken() {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const { token, expiresAt } = JSON.parse(raw);
    if (token && expiresAt - Date.now() > TOKEN_EXPIRY_BUFFER_MS) return token;
  } catch {
    // ignore
  }
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  return null;
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function markSignedIn() {
  document.getElementById("signin-btn").style.display = "none";
  document.getElementById("signout-btn").style.display = "inline-block";
  setAuthStatus(true);
}

function initGis() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    callback: (resp) => {
      if (resp.error) {
        setStatus("ログインに失敗しました: " + resp.error, true);
        return;
      }
      accessToken = resp.access_token;
      saveToken(resp.access_token, resp.expires_in);
      markSignedIn();
    },
  });

  // 前回のログインがまだ有効なら、ボタンを押さずに自動で復元する
  const stored = loadStoredToken();
  if (stored) {
    accessToken = stored;
    markSignedIn();
  }
}

window.addEventListener("load", () => {
  if (typeof google !== "undefined" && google.accounts) {
    initGis();
  } else {
    setTimeout(initGis, 300);
  }
});

document.getElementById("signin-btn").addEventListener("click", () => {
  if (!tokenClient) {
    setStatus("Google認証の準備中です。数秒後にもう一度お試しください。", true);
    return;
  }
  tokenClient.requestAccessToken();
});

document.getElementById("signout-btn").addEventListener("click", () => {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  clearStoredToken();
  document.getElementById("signin-btn").style.display = "inline-block";
  document.getElementById("signout-btn").style.display = "none";
  setAuthStatus(false);
});

function setAuthStatus(connected) {
  const el = document.getElementById("auth-status");
  el.classList.toggle("connected", connected);
  el.innerHTML = `<span class="dot"></span>${connected ? "接続済み" : "未接続"}`;
}

// ---------- 日本の祝日取得 ----------
const holidayCache = new Map(); // year -> Set of "YYYY-MM-DD"

async function getHolidaySet(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const res = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/JP`);
  const set = new Set();
  if (res.ok) {
    const data = await res.json();
    data.forEach((h) => set.add(h.date));
  }
  holidayCache.set(year, set);
  return set;
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isHoliday(date, holidaySets) {
  const day = date.getDay();
  if (day === 0 || day === 6) return true;
  const set = holidaySets[date.getFullYear()];
  return set ? set.has(formatDateKey(date)) : false;
}

// ---------- 締め日・支払サイクル ----------
function daysInMonth(year, month0) {
  return new Date(year, month0 + 1, 0).getDate();
}

function getClosingDayInMonth(job, year, month0) {
  return Math.min(job.closingDay || 31, daysInMonth(year, month0));
}

// 勤務日がどの「振込月」に属するかを判定する("YYYY-MM")
function paymentMonthForDate(date, job) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const closingDayThisMonth = getClosingDayInMonth(job, y, m);

  let closingY = y;
  let closingM = m;
  if (date.getDate() > closingDayThisMonth) {
    closingM += 1;
    if (closingM > 11) {
      closingM = 0;
      closingY += 1;
    }
  }

  let payTotal = closingY * 12 + closingM + (job.payMonthOffset || 0);
  const payY = Math.floor(payTotal / 12);
  const payM = ((payTotal % 12) + 12) % 12;
  return `${payY}-${String(payM + 1).padStart(2, "0")}`;
}

function monthStrToParts(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  return { year: y, month0: m - 1 };
}

function shiftMonthStr(monthStr, delta) {
  const { year, month0 } = monthStrToParts(monthStr);
  const total = year * 12 + month0 + delta;
  const y = Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function monthStrToLabel(monthStr, short) {
  const { year, month0 } = monthStrToParts(monthStr);
  return short ? `${month0 + 1}月` : `${year}年${month0 + 1}月`;
}

// ---------- 給与計算ロジック ----------
function timeStringToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isTimeInRange(minutesOfDay, startStr, endStr) {
  if (!startStr || !endStr) return true;
  const s = timeStringToMinutes(startStr);
  const e = timeStringToMinutes(endStr);
  if (s === e) return true;
  if (s < e) return minutesOfDay >= s && minutesOfDay < e;
  return minutesOfDay >= s || minutesOfDay < e; // 日をまたぐ範囲
}

function buildSegments(start, end, rules) {
  const points = new Set([start.getTime(), end.getTime()]);

  // 日付が変わる境界(曜日/祝日判定のため)
  const midnightCursor = new Date(start);
  midnightCursor.setHours(0, 0, 0, 0);
  midnightCursor.setDate(midnightCursor.getDate() + 1);
  while (midnightCursor.getTime() < end.getTime()) {
    if (midnightCursor.getTime() > start.getTime()) points.add(midnightCursor.getTime());
    midnightCursor.setDate(midnightCursor.getDate() + 1);
  }

  // 各ルールの時刻境界
  const dayCursor = new Date(start);
  dayCursor.setHours(0, 0, 0, 0);
  dayCursor.setDate(dayCursor.getDate() - 1);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);
  lastDay.setDate(lastDay.getDate() + 1);

  while (dayCursor.getTime() <= lastDay.getTime()) {
    for (const rule of rules) {
      for (const timeStr of [rule.timeStart, rule.timeEnd]) {
        if (!timeStr) continue;
        const mins = timeStringToMinutes(timeStr);
        const dt = new Date(dayCursor);
        dt.setMinutes(dt.getMinutes() + mins);
        if (dt.getTime() > start.getTime() && dt.getTime() < end.getTime()) {
          points.add(dt.getTime());
        }
      }
    }
    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  const sorted = Array.from(points).sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const segStart = new Date(sorted[i]);
    const segEnd = new Date(sorted[i + 1]);
    if (segEnd.getTime() > segStart.getTime()) segments.push({ start: segStart, end: segEnd });
  }
  return segments;
}

function rateForSegment(job, midpoint, holidaySets) {
  const holiday = isHoliday(midpoint, holidaySets);
  const minutesOfDay = midpoint.getHours() * 60 + midpoint.getMinutes();

  let best = { rate: job.baseRate, label: "基本" };
  for (const rule of job.rules) {
    const dayOk =
      rule.dayType === "any" ||
      (rule.dayType === "holiday" && holiday) ||
      (rule.dayType === "weekday" && !holiday);
    if (!dayOk) continue;
    if (!isTimeInRange(minutesOfDay, rule.timeStart, rule.timeEnd)) continue;
    if (rule.rate > best.rate) best = { rate: rule.rate, label: rule.label || "割増" };
  }
  return best;
}

function computeShiftPay(job, start, end, holidaySets) {
  const segments = buildSegments(start, end, job.rules);
  let total = 0;
  const breakdown = new Map(); // label -> {hours, rate}
  for (const seg of segments) {
    const hours = (seg.end.getTime() - seg.start.getTime()) / 3600000;
    const midpoint = new Date((seg.start.getTime() + seg.end.getTime()) / 2);
    const { rate, label } = rateForSegment(job, midpoint, holidaySets);
    total += hours * rate;
    const prev = breakdown.get(label) || { hours: 0, rate };
    prev.hours += hours;
    breakdown.set(label, prev);
  }
  const totalHours = segments.reduce((sum, s) => sum + (s.end - s.start) / 3600000, 0);
  return { pay: total, hours: totalHours, breakdown };
}

// ---------- カレンダー取得 ----------
async function fetchCalendarEvents(timeMin, timeMax) {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "2500");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) {
    accessToken = null;
    clearStoredToken();
    document.getElementById("signin-btn").style.display = "inline-block";
    document.getElementById("signout-btn").style.display = "none";
    setAuthStatus(false);
    throw new Error("ログインの有効期限が切れました。もう一度ログインしてください。");
  }
  if (!res.ok) throw new Error(`カレンダー取得に失敗しました (${res.status})`);
  const data = await res.json();
  return data.items || [];
}

function matchJob(summary) {
  if (!summary) return null;
  const trimmed = summary.trim();
  const candidates = jobs.filter((j) => j.keyword && trimmed.startsWith(j.keyword));
  if (candidates.length === 0) return null;
  // 最も長いキーワードに一致したものを優先
  candidates.sort((a, b) => b.keyword.length - a.keyword.length);
  return candidates[0];
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// 指定した期間内の予定を取得し、各バイトの給与計算＋振込月の判定まで済ませて返す
async function getEnrichedShifts(rangeStart, rangeEnd) {
  const years = new Set();
  for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) years.add(y);
  const holidaySets = {};
  for (const y of years) holidaySets[y] = await getHolidaySet(y);

  const events = await fetchCalendarEvents(rangeStart, rangeEnd);
  const shifts = [];
  for (const ev of events) {
    if (!ev.start?.dateTime || !ev.end?.dateTime) continue; // 終日予定は除外
    const job = matchJob(ev.summary);
    if (!job) continue;

    const start = new Date(ev.start.dateTime);
    const end = new Date(ev.end.dateTime);
    const { pay, hours, breakdown } = computeShiftPay(job, start, end, holidaySets);
    const breakdownText = Array.from(breakdown.entries())
      .map(([label, v]) => `${label} ${v.hours.toFixed(2)}h×${v.rate}円`)
      .join(" / ");

    shifts.push({
      job,
      date: start,
      timeRange: `${formatTime(start)}-${formatTime(end)}`,
      hours,
      pay,
      breakdownText,
      paymentMonth: paymentMonthForDate(start, job),
    });
  }
  return shifts;
}

// ---------- 給与計算タブ ----------
function setStatus(msg, isError) {
  const el = document.getElementById("status-message");
  el.textContent = msg;
  el.className = isError ? "error" : "";
}

document.getElementById("month-input").value = new Date().toISOString().slice(0, 7);

document.getElementById("calc-btn").addEventListener("click", async () => {
  if (!accessToken) {
    setStatus("先にGoogleでログインしてください。", true);
    return;
  }
  const monthValue = document.getElementById("month-input").value;
  if (!monthValue) {
    setStatus("対象月を選択してください。", true);
    return;
  }
  setStatus("計算中...");

  try {
    // 締め日・支払サイクルにより、対象月の振込に含まれる勤務は前後の月にまたがりうるため
    // 前後3ヶ月分の予定を取得してから振込月でフィルタする
    const rangeStartStr = shiftMonthStr(monthValue, -3);
    const rangeEndStr = shiftMonthStr(monthValue, 3);
    const rs = monthStrToParts(rangeStartStr);
    const re = monthStrToParts(rangeEndStr);
    const rangeStart = new Date(rs.year, rs.month0, 1);
    const rangeEnd = new Date(re.year, re.month0, 1);

    const shifts = await getEnrichedShifts(rangeStart, rangeEnd);
    const filtered = shifts.filter((s) => s.paymentMonth === monthValue);

    const jobTotals = new Map(); // jobId -> {hours, pay, keyword}
    for (const s of filtered) {
      const t = jobTotals.get(s.job.id) || { hours: 0, pay: 0, keyword: s.job.keyword };
      t.hours += s.hours;
      t.pay += s.pay;
      jobTotals.set(s.job.id, t);
    }

    const shiftRows = filtered
      .map((s) => ({
        date: s.date,
        jobKeyword: s.job.keyword,
        timeRange: s.timeRange,
        hours: s.hours,
        breakdownText: s.breakdownText,
        pay: s.pay,
      }))
      .sort((a, b) => a.date - b.date);

    renderResults(shiftRows, jobTotals);
    setStatus(`${shiftRows.length}件の勤務予定を集計しました。`);
  } catch (err) {
    console.error(err);
    setStatus(err.message || "エラーが発生しました。", true);
  }
});

function renderResults(shiftRows, jobTotals) {
  const resultSection = document.getElementById("result-section");
  resultSection.style.display = "block";

  const summaryGrid = document.getElementById("summary-grid");
  summaryGrid.innerHTML = "";

  let grandTotal = 0;
  for (const [, t] of jobTotals) {
    grandTotal += t.pay;
    const tile = document.createElement("div");
    tile.className = "summary-tile";
    tile.innerHTML = `
      <div class="tile-label">${escapeHtml(t.keyword)}</div>
      <div class="amount">${Math.round(t.pay).toLocaleString()}円</div>
      <div class="tile-sub">${t.hours.toFixed(2)}h</div>
    `;
    summaryGrid.appendChild(tile);
  }
  const totalTile = document.createElement("div");
  totalTile.className = "summary-tile total";
  totalTile.innerHTML = `
    <div class="tile-label">合計</div>
    <div class="amount">${Math.round(grandTotal).toLocaleString()}円</div>
  `;
  summaryGrid.appendChild(totalTile);

  const body = document.getElementById("shifts-body");
  body.innerHTML = "";
  if (shiftRows.length === 0) {
    body.innerHTML = `<div class="empty-state">この振込月に一致する勤務予定は見つかりませんでした。</div>`;
    return;
  }
  for (const row of shiftRows) {
    const rowEl = document.createElement("div");
    rowEl.className = "shift-row";
    rowEl.innerHTML = `
      <span class="cell-date">${formatDateKey(row.date)}</span>
      <span class="cell-job">${escapeHtml(row.jobKeyword)}</span>
      <span class="cell-time">${row.timeRange}<br><span class="tile-sub">${row.hours.toFixed(2)}h</span></span>
      <span class="cell-breakdown">${escapeHtml(row.breakdownText)}</span>
      <span class="cell-pay">${Math.round(row.pay).toLocaleString()}円</span>
    `;
    body.appendChild(rowEl);
  }
}

// ---------- レポートタブ ----------
const REPORT_MONTHS = 6;
const PALETTE = ["#4f46e5", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#a855f7"];

document.getElementById("report-refresh-btn").addEventListener("click", loadReport);

async function loadReport() {
  const statusEl = document.getElementById("report-status");
  if (!accessToken) {
    statusEl.textContent = "先にGoogleでログインしてください。";
    statusEl.className = "error";
    return;
  }
  statusEl.textContent = "読み込み中...";
  statusEl.className = "muted";

  try {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const months = [];
    for (let i = REPORT_MONTHS - 1; i >= 0; i--) months.push(shiftMonthStr(currentMonthStr, -i));

    const rangeStartStr = shiftMonthStr(months[0], -3);
    const rangeEndStr = shiftMonthStr(months[months.length - 1], 3);
    const rs = monthStrToParts(rangeStartStr);
    const re = monthStrToParts(rangeEndStr);
    const rangeStart = new Date(rs.year, rs.month0, 1);
    const rangeEnd = new Date(re.year, re.month0, 1);

    const shifts = await getEnrichedShifts(rangeStart, rangeEnd);

    const totals = new Map(); // monthStr -> Map(jobId -> {pay, hours, keyword})
    for (const m of months) totals.set(m, new Map());
    for (const s of shifts) {
      const monthMap = totals.get(s.paymentMonth);
      if (!monthMap) continue; // 表示範囲外
      const t = monthMap.get(s.job.id) || { pay: 0, hours: 0, keyword: s.job.keyword };
      t.pay += s.pay;
      t.hours += s.hours;
      monthMap.set(s.job.id, t);
    }

    renderReport(months, totals);
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "エラーが発生しました。";
    statusEl.className = "error";
  }
}

function renderReport(months, totals) {
  const jobColor = new Map(jobs.map((j, i) => [j.id, PALETTE[i % PALETTE.length]]));

  let maxTotal = 0;
  const monthGrand = months.map((m) => {
    let sum = 0;
    for (const [, t] of totals.get(m)) sum += t.pay;
    maxTotal = Math.max(maxTotal, sum);
    return sum;
  });
  if (maxTotal === 0) maxTotal = 1;

  const CHART_MAX_PX = 140;
  const chartWrap = document.getElementById("report-chart-wrap");
  chartWrap.innerHTML = "";
  const chart = document.createElement("div");
  chart.className = "report-chart";

  months.forEach((m, idx) => {
    const monthMap = totals.get(m);
    const col = document.createElement("div");
    col.className = "report-bar-col";

    const amountEl = document.createElement("div");
    amountEl.className = "report-bar-amount";
    amountEl.textContent = monthGrand[idx] > 0 ? Math.round(monthGrand[idx]).toLocaleString() : "";
    col.appendChild(amountEl);

    const stack = document.createElement("div");
    stack.className = "report-bar-stack";
    const stackHeight = monthGrand[idx] > 0 ? Math.max((monthGrand[idx] / maxTotal) * CHART_MAX_PX, 4) : 0;
    stack.style.height = `${stackHeight}px`;

    for (const job of jobs) {
      const t = monthMap.get(job.id);
      if (!t || t.pay <= 0) continue;
      const seg = document.createElement("div");
      seg.className = "report-bar-seg";
      seg.style.background = jobColor.get(job.id);
      seg.style.flexGrow = String(t.pay);
      seg.title = `${job.keyword}: ${Math.round(t.pay).toLocaleString()}円`;
      stack.appendChild(seg);
    }
    col.appendChild(stack);

    const labelEl = document.createElement("div");
    labelEl.className = "report-bar-label";
    labelEl.textContent = monthStrToLabel(m, true);
    col.appendChild(labelEl);

    chart.appendChild(col);
  });
  chartWrap.appendChild(chart);

  const legend = document.getElementById("report-legend");
  legend.innerHTML = "";
  jobs.forEach((job) => {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-dot" style="background:${jobColor.get(job.id)}"></span>${escapeHtml(job.keyword)}`;
    legend.appendChild(item);
  });

  const table = document.getElementById("report-table");
  table.innerHTML = "";
  for (let i = months.length - 1; i >= 0; i--) {
    const m = months[i];
    const monthMap = totals.get(m);
    let total = 0;
    const parts = [];
    for (const job of jobs) {
      const t = monthMap.get(job.id);
      if (!t || t.pay <= 0) continue;
      total += t.pay;
      parts.push(`${job.keyword} ${Math.round(t.pay).toLocaleString()}円`);
    }
    const row = document.createElement("div");
    row.className = "report-row";
    row.innerHTML = `
      <span class="report-row-month">${monthStrToLabel(m, false)}</span>
      <span class="report-row-parts">${parts.length ? escapeHtml(parts.join(" / ")) : "―"}</span>
      <span class="report-row-total">${Math.round(total).toLocaleString()}円</span>
    `;
    table.appendChild(row);
  }
}
