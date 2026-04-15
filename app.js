/* Lucky Health Dashboard — Live Notion Data */
let DATA = null;

async function init() {
  setDate();
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
  setGreeting(latest);
  renderAlert(latest);
  renderMeds(latest);
  renderGlucose(latest, logs);
  renderWeight(latest, weights);
  renderAppointments(appts);
  renderFreshness();
  renderGlucoseChart(logs);
  renderCompliance(logs);
  renderInsights(logs, weights, appts);
}

function setDate() {
  const d = new Date(), m = THAI_MONTHS;
  document.getElementById('dateLabel').textContent = d.getDate() + ' ' + m[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_DAYS = ['อา','จ','อ','พ','พฤ','ศ','ส'];

function setGreeting(l) {
  const h = new Date().getHours();
  const g = h < 12 ? 'สวัสดีตอนเช้าค่ะป๊า ☀️' : h < 17 ? 'สวัสดีตอนบ่ายค่ะป๊า 🌤️' : 'สวัสดีตอนเย็นค่ะป๊า 🌙';
  const v = l.glucoseMorning || l.glucoseEvening;
  const s = v ? (v < 140 ? ' น้ำตาลดีมากค่ะ ✨' : v < 180 ? ' น้ำตาลปกติดีค่ะ 🌿' : ' ระวังน้ำตาลหน่อยนะคะ 💛') : '';
  document.getElementById('greetingText').textContent = g + s;
}

function renderAlert(l) {
  const el = document.getElementById('alertBanner'), h = new Date().getHours();
  el.style.display = (h >= 17 && !l.glucoseEvening) ? 'flex' : 'none';
}

function confirmMed() {
  document.getElementById('alertBanner').style.display = 'none';
  const r = document.getElementById('eveningMedRow');
  if (r) { r.classList.remove('pending-row'); r.querySelector('.med-status').textContent = '✅'; r.style.background = 'var(--good-bg)'; }
}

function renderMeds(l) {
  const el = document.getElementById('medRows'); if (!el) return;
  const hm = l.glucoseMorning != null, he = l.glucoseEvening != null, h = new Date().getHours();
  el.innerHTML =
    '<div class="med-row ' + (hm ? '' : 'pending-row') + '"><span class="med-name">ยาเช้า</span><span class="med-detail">Metformin + ยาความดัน</span><span class="med-status">' + (hm ? '✅' : (h < 12 ? '⏳' : '❌')) + '</span></div>' +
    '<div class="med-row ' + (he ? '' : 'pending-row') + '" id="eveningMedRow"><span class="med-name">ยาเย็น</span><span class="med-detail">Metformin</span><span class="med-status">' + (he ? '✅' : (h < 18 ? '⏳' : '❌')) + '</span></div>';
}

function renderGlucose(l, logs) {
  const v = l.glucoseMorning || l.glucoseEvening;
  const ve = document.getElementById('glucoseValue'), be = document.getElementById('glucoseBadge'), me = document.getElementById('glucoseMini');
  if (v == null) { ve.textContent = '—'; be.innerHTML = '<span class="badge neutral">ยังไม่มีข้อมูล</span>'; }
  else {
    ve.textContent = v;
    const s = v < 140 ? ['ดีมาก ✨','good'] : v < 180 ? ['ปกติดี 🌿','good'] : v < 250 ? ['สูงนิด ⚠️','warn'] : ['สูงมาก 🚨','bad'];
    be.innerHTML = '<span class="badge ' + s[1] + '">' + s[0] + '</span>';
  }
  if (me) {
    me.innerHTML = '';
    logs.map(x => x.glucoseMorning || x.glucoseEvening).filter(Boolean).forEach(v => {
      const b = document.createElement('div'); b.className = 'mini-bar';
      b.style.height = Math.max(3, v / 250 * 24) + 'px';
      b.style.background = v < 140 ? 'var(--good)' : v < 180 ? 'var(--warn)' : 'var(--bad)';
      b.style.opacity = '0.6'; me.appendChild(b);
    });
  }
}

/* ====== WEIGHT — labeled chart with trend ====== */
function renderWeight(l, ws) {
  const w = l.weightAM || l.weightPM;
  document.getElementById('weightValue').textContent = w ?? '—';

  // Trend vs 7 days ago
  const wv = ws.map(x => x.weight).filter(Boolean);
  const trendEl = document.getElementById('weightTrend');
  if (wv.length >= 7 && w) {
    const weekAgo = wv[Math.max(0, wv.length - 8)];
    const diff = (w - weekAgo).toFixed(1);
    if (Math.abs(diff) < 0.1) trendEl.innerHTML = '<span class="badge neutral">→ คงที่</span>';
    else if (diff > 0) trendEl.innerHTML = '<span class="badge warn">↑ ' + diff + ' kg</span>';
    else trendEl.innerHTML = '<span class="badge good">↓ ' + Math.abs(diff) + ' kg</span>';
  } else {
    trendEl.innerHTML = '<span class="badge neutral">—</span>';
  }

  // Labeled bar chart (14 days)
  const chartEl = document.getElementById('weightChart');
  if (!chartEl) return;
  chartEl.innerHTML = '';
  const slice = ws.slice(-14);
  if (slice.length === 0) { chartEl.innerHTML = '<div style="color:var(--text-3);font-size:14px;">ยังไม่มีข้อมูล</div>'; return; }
  const vals = slice.map(x => x.weight).filter(Boolean);
  const mn = Math.min(...vals) - 0.2, mx = Math.max(...vals) + 0.2;
  document.getElementById('weightMin').textContent = mn.toFixed(1);
  document.getElementById('weightMax').textContent = mx.toFixed(1);

  slice.forEach(entry => {
    const v = entry.weight;
    if (v == null) return;
    const b = document.createElement('div'); b.className = 'weight-bar';
    b.style.height = Math.max(3, ((v - mn) / (mx - mn)) * 55) + 'px';
    b.title = v + ' kg (' + fmtDate(entry.date) + ')';
    chartEl.appendChild(b);
  });

  // Date range labels
  document.getElementById('weightDateStart').textContent = fmtDate(slice[0].date);
  document.getElementById('weightDateEnd').textContent = fmtDate(slice[slice.length - 1].date);
}

/* ====== APPOINTMENTS — single section, grouped by month ====== */
function renderAppointments(appts) {
  const el = document.getElementById('apptContent');
  const section = document.getElementById('apptSection');
  if (!el) return;

  const upcoming = appts.slice(0, 3);
  if (upcoming.length === 0) {
    el.innerHTML = '<div class="appt-empty">ไม่มีนัดหมอที่กำลังจะถึง</div>';
    return;
  }

  // Group by month
  const groups = {};
  upcoming.forEach(a => {
    const d = new Date(a.date);
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

function renderFreshness() {
  const el = document.getElementById('freshnessLabel'); if (!el || !DATA.fetchedAt) return;
  const m = Math.floor((new Date() - new Date(DATA.fetchedAt)) / 6e4);
  el.textContent = m < 5 ? 'อัปเดตล่าสุด: เมื่อสักครู่' : m < 60 ? 'อัปเดต: ' + m + ' นาทีที่แล้ว' : m < 1440 ? 'อัปเดต: ' + Math.floor(m / 60) + ' ชม. ที่แล้ว' : 'อัปเดต: ' + Math.floor(m / 1440) + ' วันที่แล้ว';
}

/* ====== GLUCOSE CHART — values on ALL bars ====== */
function renderGlucoseChart(logs) {
  const c = document.getElementById('glucoseChart'), ds = document.getElementById('chartDays');
  if (!c || !ds) return;
  c.innerHTML = ''; ds.innerHTML = '';

  logs.forEach(log => {
    const g = document.createElement('div'); g.className = 'bar-group';
    [log.glucoseMorning, log.glucoseEvening].forEach((v, j) => {
      const b = document.createElement('div'); b.className = 'bar';
      if (v == null) {
        b.style.height = '4px'; b.style.background = 'var(--neutral-bg)'; b.style.border = '1px dashed var(--border)';
      } else {
        b.style.height = Math.max(12, v / 250 * 110) + 'px';
        b.style.background = v < 140 ? 'var(--good)' : v < 180 ? 'var(--warn)' : 'var(--bad)';
        b.style.opacity = j === 0 ? '1' : '0.5';
        // Morning: value on top. Evening: value on bottom.
        if (j === 0) b.innerHTML = '<span class="bar-val">' + v + '</span>';
        else b.innerHTML = '<span class="bar-val-bottom">' + v + '</span>';
      }
      g.appendChild(b);
    });
    c.appendChild(g);
    const dl = document.createElement('span');
    dl.textContent = THAI_DAYS[new Date(log.date).getDay()];
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

    d.innerHTML = '<span class="comp-day-label">' + THAI_DAYS[new Date(l.date).getDay()] + '</span><div class="comp-checks">' + mIcon + eIcon + '</div>';
    el.appendChild(d);
  });
}

/* ====== INSIGHTS — grouped by color ====== */
function renderInsights(logs, ws, appts) {
  const el = document.getElementById('insightList'); if (!el) return;
  el.innerHTML = '';
  const normals = [], warnings = [];

  const gv = logs.map(l => l.glucoseMorning || l.glucoseEvening).filter(Boolean);
  if (gv.length) {
    const avg = Math.round(gv.reduce((a, b) => a + b, 0) / gv.length);
    (avg >= 180 ? warnings : normals).push('น้ำตาลเฉลี่ย ' + gv.length + ' วัน: ' + avg + ' mg/dL');
  }
  const hi = gv.filter(v => v >= 180);
  if (hi.length) warnings.push('น้ำตาลสูง (>180) ' + hi.length + ' วันจาก ' + gv.length + ' วัน');

  const wv = ws.map(w => w.weight).filter(Boolean);
  if (wv.length >= 7) {
    const r = wv.slice(-7), o = wv.slice(-14, -7);
    if (o.length) {
      const diff = ((r.reduce((a, b) => a + b, 0) / r.length) - (o.reduce((a, b) => a + b, 0) / o.length)).toFixed(1);
      const text = diff > 0 ? 'น้ำหนักเพิ่ม ' + diff + ' kg จากสัปดาห์ก่อน' : 'น้ำหนักลด ' + Math.abs(diff) + ' kg จากสัปดาห์ก่อน';
      (Math.abs(diff) > 1 ? warnings : normals).push(text);
    }
  }

  const tot = logs.length * 2;
  const fil = logs.reduce((a, l) => a + (l.glucoseMorning != null ? 1 : 0) + (l.glucoseEvening != null ? 1 : 0), 0);
  if (tot) {
    const p = Math.round(fil / tot * 100);
    (p >= 80 ? normals : warnings).push('บันทึกข้อมูลครบ ' + fil + '/' + tot + ' (' + p + '%)');
  }

  if (appts.length) {
    const dd = Math.ceil((new Date(appts[0].date) - new Date()) / 864e5);
    if (dd <= 7) (dd <= 2 ? warnings : normals).push('นัดหมอ ' + (appts[0].title || appts[0].doctor) + ' อีก ' + dd + ' วัน');
  }

  // Render green first, then divider, then amber
  normals.forEach(t => { const d = document.createElement('div'); d.className = 'insight-item normal'; d.textContent = t; el.appendChild(d); });
  if (normals.length && warnings.length) { const div = document.createElement('div'); div.className = 'insight-divider'; el.appendChild(div); }
  warnings.forEach(t => { const d = document.createElement('div'); d.className = 'insight-item warning'; d.textContent = t; el.appendChild(d); });

  if (!normals.length && !warnings.length) {
    const d = document.createElement('div'); d.className = 'insight-item normal'; d.textContent = 'ยังไม่มีข้อมูลเพียงพอสำหรับสรุป'; el.appendChild(d);
  }
}

function fmtDate(s) { if (!s) return '—'; const d = new Date(s); return d.getDate() + ' ' + THAI_MONTHS[d.getMonth()]; }
document.addEventListener('DOMContentLoaded', init);
