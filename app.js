/* Lucky Health Dashboard — Live Notion Data */
let DATA = null;

/* Safe null check — never use || for values where 0 is valid */
function val(a, b) { return a != null ? a : b; }

async function init() {
  if (window.Telegram?.WebApp) { const t = window.Telegram.WebApp; t.ready(); t.expand(); t.setHeaderColor('#f0fdf4'); t.setBackgroundColor('#f0fdf4'); document.documentElement.style.background = '#f0fdf4'; }
  showLoading();
  try {
    const r = await fetch('data.json?t=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    DATA = await r.json();
    hideLoading();
    render();
  } catch (e) { showError(e.message); }
}

function showLoading() { document.getElementById('loadingState').style.display = 'flex'; document.getElementById('errorState').style.display = 'none'; document.getElementById('content').style.display = 'none'; }
function hideLoading() { document.getElementById('loadingState').style.display = 'none'; }
function showError(msg) { document.getElementById('loadingState').style.display = 'none'; document.getElementById('errorState').style.display = 'flex'; document.getElementById('content').style.display = 'none'; document.getElementById('errorMsg').textContent = msg; }
function retry() { init(); }

function render() {
  document.getElementById('content').style.display = 'block';
  const logs = DATA.dailyLogs || [], latest = logs[logs.length - 1] || {}, appts = DATA.appointments || [], weights = DATA.weightHistory || [];
  setDate(latest.date);
  setGreeting(latest);
  renderMetaBadge();
  renderAlert(latest);
  renderMeds(latest, DATA.medications || []);
  renderGlucose(latest, logs);
  renderWeight(latest, weights);
  renderAppointments(appts);
  renderGlucoseChart(logs);
  renderCompliance(logs);
  renderInsights(logs, weights, appts);
}

function setDate(dataDate) {
  const d = dataDate ? parseLocalDate(dataDate) : new Date();
  document.getElementById('dateLabel').textContent = d.getDate() + ' ' + THAI_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_DAYS = ['อา','จ','อ','พ','พฤ','ศ','ส'];

function setGreeting(l) {
  const h = new Date().getHours();
  const g = h < 12 ? 'สวัสดีตอนเช้าค่ะป๊า ☀️' : h < 17 ? 'สวัสดีตอนบ่ายค่ะป๊า 🌤️' : 'สวัสดีตอนเย็นค่ะป๊า 🌙';
  const v = val(l.glucoseMorning, l.glucoseEvening);
  const s = v != null ? (v < 140 ? ' น้ำตาลดีมากค่ะ ✨' : v < 180 ? ' น้ำตาลปกติดีค่ะ 🌿' : ' ระวังน้ำตาลหน่อยนะคะ 💛') : '';
  document.getElementById('greetingText').textContent = g + s;
}

function renderMetaBadge() {
  const el = document.getElementById('metaBadge');
  if (!el || !DATA.fetchedAt) return;
  const mins = Math.floor((new Date() - new Date(DATA.fetchedAt)) / 6e4);
  const freshness = mins < 5 ? 'เมื่อสักครู่' : mins < 60 ? mins + ' นาทีที่แล้ว' : mins < 1440 ? Math.floor(mins / 60) + ' ชม.' : Math.floor(mins / 1440) + ' วัน';
  el.textContent = '🔄 ' + freshness;
  el.className = 'meta-badge ' + (mins < 60 ? 'current' : 'stale');
}

function renderAlert(l) {
  const el = document.getElementById('alertBanner'), h = new Date().getHours();
  el.style.display = (h >= 17 && l.glucoseEvening == null) ? 'flex' : 'none';
}

function confirmMed() {
  document.getElementById('alertBanner').style.display = 'none';
  const r = document.getElementById('eveningMedRow');
  if (r) { r.classList.remove('pending-row'); r.querySelector('.med-status').textContent = '✅'; r.style.background = 'var(--good-bg)'; }
}

/* ====== MEDS — use real medication list from Notion ====== */
function renderMeds(l, medications) {
  const el = document.getElementById('medRows'); if (!el) return;
  const hm = l.glucoseMorning != null, he = l.glucoseEvening != null, h = new Date().getHours();

  // Build med list from Notion data
  const medNames = medications.map(m => m.name).filter(Boolean);
  const medSummary = medNames.length > 0 ? medNames.slice(0, 4).join(', ') + (medNames.length > 4 ? ' +' + (medNames.length - 4) + ' อื่นๆ' : '') : 'ตามใบสั่งยา';

  // Note: glucose presence is an imperfect proxy for med compliance.
  // The Notion daily log doesn't have explicit med-taken fields yet.
  el.innerHTML =
    '<div class="med-row ' + (hm ? '' : 'pending-row') + '"><span class="med-name">ยาเช้า</span><span class="med-detail">' + medSummary + '</span><span class="med-status">' + (hm ? '✅' : (h < 12 ? '⏳' : '❌')) + '</span></div>' +
    '<div class="med-row ' + (he ? '' : 'pending-row') + '" id="eveningMedRow"><span class="med-name">ยาเย็น</span><span class="med-detail">' + medSummary + '</span><span class="med-status">' + (he ? '✅' : (h < 18 ? '⏳' : '❌')) + '</span></div>';
}

/* ====== GLUCOSE — fix null-vs-falsy with val() ====== */
function renderGlucose(l, logs) {
  const v = val(l.glucoseMorning, l.glucoseEvening);
  const ve = document.getElementById('glucoseValue'), be = document.getElementById('glucoseBadge'), me = document.getElementById('glucoseMini');
  if (v == null) { ve.textContent = '—'; be.innerHTML = '<span class="badge neutral">ยังไม่มีข้อมูล</span>'; }
  else {
    ve.textContent = v;
    const s = v < 70 ? ['ต่ำ ⚠️','bad'] : v < 140 ? ['ดีมาก ✨','good'] : v < 180 ? ['ปกติดี 🌿','good'] : v < 250 ? ['สูงนิด ⚠️','warn'] : ['สูงมาก 🚨','bad'];
    be.innerHTML = '<span class="badge ' + s[1] + '">' + s[0] + '</span>';
  }
  if (me) {
    me.innerHTML = '';
    logs.forEach(x => {
      const gv = val(x.glucoseMorning, x.glucoseEvening);
      if (gv == null) return;
      const b = document.createElement('div'); b.className = 'mini-bar';
      b.style.height = Math.max(3, gv / 250 * 24) + 'px';
      b.style.background = gv < 140 ? 'var(--good)' : gv < 180 ? 'var(--warn)' : 'var(--bad)';
      b.style.opacity = '0.6'; me.appendChild(b);
    });
  }
}

/* ====== WEIGHT — fix trend to use same data source ====== */
function renderWeight(l, ws) {
  const w = val(l.weightAM, l.weightPM);
  document.getElementById('weightValue').textContent = w != null ? w : '—';

  // Trend: use weightHistory only (single source of truth)
  const wv = ws.map(x => x.weight).filter(v => v != null);
  const trendEl = document.getElementById('weightTrend');
  if (wv.length >= 2) {
    const current = wv[wv.length - 1];
    const weekAgoIdx = Math.max(0, wv.length - 8);
    const weekAgo = wv[weekAgoIdx];
    const rawDiff = current - weekAgo;
    const absDiff = Math.abs(rawDiff);
    if (absDiff < 0.1) trendEl.innerHTML = '<span class="badge neutral">→ คงที่</span>';
    else if (rawDiff > 0) trendEl.innerHTML = '<span class="badge warn">↑ ' + absDiff.toFixed(1) + ' kg</span>';
    else trendEl.innerHTML = '<span class="badge good">↓ ' + absDiff.toFixed(1) + ' kg</span>';
  } else {
    trendEl.innerHTML = '<span class="badge neutral">—</span>';
  }

  // Labeled bar chart (14 days)
  const chartEl = document.getElementById('weightChart');
  if (!chartEl) return;
  chartEl.innerHTML = '';
  const slice = ws.slice(-14).filter(e => e.weight != null);
  if (slice.length === 0) { chartEl.innerHTML = '<div style="color:var(--text-3);font-size:14px;">ยังไม่มีข้อมูล</div>'; return; }
  const vals = slice.map(x => x.weight);
  const mn = Math.min(...vals) - 0.2, mx = Math.max(...vals) + 0.2;
  document.getElementById('weightMin').textContent = mn.toFixed(1);
  document.getElementById('weightMax').textContent = mx.toFixed(1);

  slice.forEach(entry => {
    const b = document.createElement('div'); b.className = 'weight-bar';
    b.style.height = Math.max(3, ((entry.weight - mn) / (mx - mn)) * 55) + 'px';
    b.title = entry.weight + ' kg (' + fmtDate(entry.date) + ')';
    chartEl.appendChild(b);
  });

  document.getElementById('weightDateStart').textContent = fmtDate(slice[0].date);
  document.getElementById('weightDateEnd').textContent = fmtDate(slice[slice.length - 1].date);
}

/* ====== APPOINTMENTS — single section, grouped by month ====== */
function renderAppointments(appts) {
  const el = document.getElementById('apptContent');
  if (!el) return;

  const upcoming = appts.slice(0, 3);
  if (upcoming.length === 0) {
    el.innerHTML = '<div class="appt-empty">ไม่มีนัดหมอที่กำลังจะถึง</div>';
    return;
  }

  const groups = {};
  upcoming.forEach(a => {
    const d = new Date(a.date + 'T00:00:00'); // Parse as local
    const key = THAI_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });

  let html = '';
  const keys = Object.keys(groups);
  keys.forEach(month => {
    if (keys.length > 1) html += '<div class="appt-month-header">' + month + '</div>';
    groups[month].forEach(a => {
      const time = a.date.includes('T') ? a.date.split('T')[1].substring(0, 5) : '';
      html += '<div class="appt-row"><div class="appt-row-date">' + fmtDate(a.date) + (time ? '<br>' + time : '') + '</div><div class="appt-row-info"><div class="appt-row-doctor">' + (a.title || a.doctor || '—') + '</div><div class="appt-row-hospital">' + [a.hospital, a.type].filter(Boolean).join(' · ') + '</div></div></div>';
    });
  });
  el.innerHTML = html;
}

/* renderFreshness merged into renderDataDate */

/* ====== GLUCOSE CHART — values on ALL bars ====== */
function renderGlucoseChart(logs) {
  const c = document.getElementById('glucoseChart'), ds = document.getElementById('chartDays');
  if (!c || !ds) return;
  c.innerHTML = ''; ds.innerHTML = '';

  logs.forEach(log => {
    const g = document.createElement('div'); g.className = 'bar-group';
    [log.glucoseMorning, log.glucoseEvening].forEach((v, j) => {
      const b = document.createElement('div'); b.className = 'bar' + (j === 1 ? ' evening-bar' : '');
      if (v == null) {
        b.style.height = '4px'; b.style.background = 'var(--neutral-bg)'; b.style.border = '1px dashed var(--border)';
      } else {
        b.style.height = Math.max(12, v / 250 * 110) + 'px';
        b.style.background = v < 140 ? 'var(--good)' : v < 180 ? 'var(--warn)' : 'var(--bad)';
        b.innerHTML = '<span class="bar-val">' + v + '</span>';
      }
      g.appendChild(b);
    });
    c.appendChild(g);
    const dl = document.createElement('span');
    dl.textContent = THAI_DAYS[parseLocalDate(log.date).getDay()];
    ds.appendChild(dl);
  });
}

/* ====== COMPLIANCE — CSS icons, row labels ====== */
function renderCompliance(logs) {
  const el = document.getElementById('complianceGrid'); if (!el) return;
  el.innerHTML = '';

  logs.forEach((l, i) => {
    const d = document.createElement('div');
    d.className = 'comp-day' + (i === logs.length - 1 ? ' today' : '');

    const mIcon = l.glucoseMorning != null ? '<span class="comp-icon taken"></span>' : '<span class="comp-icon missed"></span>';
    const eIcon = l.glucoseEvening != null ? '<span class="comp-icon taken"></span>' : (i === logs.length - 1 ? '<span class="comp-icon pending"></span>' : '<span class="comp-icon missed"></span>');

    d.innerHTML = '<span class="comp-day-label">' + THAI_DAYS[parseLocalDate(l.date).getDay()] + '</span><div class="comp-checks">' + mIcon + eIcon + '</div>';
    el.appendChild(d);
  });
}

/* ====== INSIGHTS — grouped by color, fix toFixed string issue ====== */
function renderInsights(logs, ws, appts) {
  const el = document.getElementById('insightList'); if (!el) return;
  el.innerHTML = '';
  const normals = [], warnings = [];

  const gm = logs.map(l => l.glucoseMorning).filter(v => v != null);
  const ge = logs.map(l => l.glucoseEvening).filter(v => v != null);
  if (gm.length) {
    const avg = Math.round(gm.reduce((a, b) => a + b, 0) / gm.length);
    (avg >= 180 ? warnings : normals).push('น้ำตาลเช้าเฉลี่ย: ' + avg + ' mg/dL (' + gm.length + ' วัน)');
  }
  if (ge.length) {
    const avg = Math.round(ge.reduce((a, b) => a + b, 0) / ge.length);
    (avg >= 180 ? warnings : normals).push('น้ำตาลเย็นเฉลี่ย: ' + avg + ' mg/dL (' + ge.length + ' วัน)');
  }
  const allG = [...gm, ...ge];
  const hi = allG.filter(v => v >= 180);
  if (hi.length) warnings.push('น้ำตาลสูง (>180) ' + hi.length + ' ครั้งจาก ' + allG.length + ' ครั้ง');

  const wv = ws.map(w => w.weight).filter(v => v != null);
  if (wv.length >= 7) {
    const r = wv.slice(-7), o = wv.slice(-14, -7);
    if (o.length) {
      const rawDiff = (r.reduce((a, b) => a + b, 0) / r.length) - (o.reduce((a, b) => a + b, 0) / o.length);
      const absDiff = Math.abs(rawDiff);
      const text = rawDiff > 0 ? 'น้ำหนักเพิ่ม ' + absDiff.toFixed(1) + ' kg จากสัปดาห์ก่อน' : 'น้ำหนักลด ' + absDiff.toFixed(1) + ' kg จากสัปดาห์ก่อน';
      (absDiff > 1 ? warnings : normals).push(text);
    }
  }

  const tot = logs.length * 2;
  const fil = logs.reduce((a, l) => a + (l.glucoseMorning != null ? 1 : 0) + (l.glucoseEvening != null ? 1 : 0), 0);
  if (tot) {
    const p = Math.round(fil / tot * 100);
    (p >= 80 ? normals : warnings).push('บันทึกข้อมูลครบ ' + fil + '/' + tot + ' (' + p + '%)');
  }

  if (appts.length) {
    const dd = daysUntil(appts[0].date);
    if (dd <= 7) (dd <= 2 ? warnings : normals).push('นัดหมอ ' + (appts[0].title || appts[0].doctor) + ' อีก ' + dd + ' วัน');
  }

  normals.forEach(t => { const d = document.createElement('div'); d.className = 'insight-item normal'; d.textContent = t; el.appendChild(d); });
  if (normals.length && warnings.length) { const div = document.createElement('div'); div.className = 'insight-divider'; el.appendChild(div); }
  warnings.forEach(t => { const d = document.createElement('div'); d.className = 'insight-item warning'; d.textContent = t; el.appendChild(d); });

  if (!normals.length && !warnings.length) {
    const d = document.createElement('div'); d.className = 'insight-item normal'; d.textContent = 'ยังไม่มีข้อมูลเพียงพอสำหรับสรุป'; el.appendChild(d);
  }
}

/* ====== HELPERS ====== */

// Parse YYYY-MM-DD as local date (not UTC)
function parseLocalDate(s) { if (!s) return new Date(); const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

// Format date as Thai
function fmtDate(s) { if (!s) return '—'; const d = parseLocalDate(s); return d.getDate() + ' ' + THAI_MONTHS[d.getMonth()]; }

// Today as YYYY-MM-DD in local timezone
function localDateStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// Days until a date (local, no UTC issues)
function daysUntil(dateStr) {
  const target = parseLocalDate(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 864e5);
}

document.addEventListener('DOMContentLoaded', init);
