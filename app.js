/* Lucky Health Dashboard — Live Notion Data */
let DATA = null;

/* Safe null check — never use || for values where 0 is valid */
function val(a, b) { return a != null ? a : b; }

async function init() {
  if (window.Telegram?.WebApp) { const t = window.Telegram.WebApp; t.ready(); t.expand(); t.setHeaderColor('#f0fdf4'); t.setBackgroundColor('#f0fdf4'); document.documentElement.style.background = '#f0fdf4'; }
  showLoading();
  try {
    // Try live Notion data from Cloudflare Worker first, fall back to static data.json
    let r;
    try {
      r = await fetch('https://lucky-notion-proxy.pai-kobboon.workers.dev');
      if (!r.ok) throw new Error('Worker ' + r.status);
    } catch (_) {
      r = await fetch('data.json?t=' + Date.now());
      if (!r.ok) throw new Error('HTTP ' + r.status);
    }
    DATA = await r.json();
    if (DATA.error) throw new Error(DATA.error);
    hideLoading();
    try { render(); } catch (re) { showError('Render: ' + re.message); }
  } catch (e) { showError(e.message); }
}

function showLoading() { document.getElementById('loadingState').style.display = 'flex'; document.getElementById('errorState').style.display = 'none'; document.getElementById('content').style.display = 'none'; }
function hideLoading() { document.getElementById('loadingState').style.display = 'none'; }
function showError(msg) { document.getElementById('loadingState').style.display = 'none'; document.getElementById('errorState').style.display = 'flex'; document.getElementById('content').style.display = 'none'; document.getElementById('errorMsg').textContent = msg; }
function retry() { init(); }

function render() {
  document.getElementById('content').style.display = 'block';
  if (!DATA) return;
  const logs = DATA.dailyLogs || [];
  const latest = logs.length > 0 ? logs[logs.length - 1] : {};
  const appts = DATA.appointments || [];
  const weights = DATA.weightHistory || [];
  setDate();
  setGreeting(latest);
  renderMetaBadge(latest);
  renderAlert(latest);
  renderMeds(latest);
  renderGlucose(latest, logs);
  renderWeight(latest, weights);
  renderAppointments(appts);
  renderGlucoseChart(logs);
  renderCompliance(logs);
  renderInsights(logs, weights, appts);
}

function setDate() {
  const d = new Date();
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

function renderMetaBadge(latest) {
  const el = document.getElementById('metaBadge');
  if (!el) return;
  const today = localDateStr();
  const isToday = latest.date === today;
  if (isToday) {
    el.textContent = 'ข้อมูลวันนี้';
    el.className = 'meta-badge current';
  } else if (latest.date) {
    el.textContent = 'ข้อมูล ' + fmtDate(latest.date);
    el.className = 'meta-badge stale';
  } else {
    el.textContent = 'ยังไม่มีข้อมูล';
    el.className = 'meta-badge stale';
  }
}

function renderAlert(l) {
  const el = document.getElementById('alertBanner'), h = new Date().getHours();
  el.style.display = (h >= 17 && l.glucoseEvening == null) ? 'flex' : 'none';
}

function confirmMed() {
  document.getElementById('alertBanner').style.display = 'none';
  const r = document.getElementById('eveningMedRow');
  if (r) { r.classList.remove('pending-row'); r.querySelector('.med-status').innerHTML = '<i class="icon-check"></i>'; r.style.background = 'var(--good-bg)'; }
}

/* ====== MEDS — real schedule from care-agent medications.md ====== */
const MED_SCHEDULE = {
  morning: 'Metformin, Tanzaril, Amlodipine, Vit B, Ferli-6 + อินซูลิน 15u',
  evening: 'Metformin, Vit B + อินซูลิน 15u'
};

function renderMeds(l) {
  const el = document.getElementById('medRows'); if (!el) return;
  const hm = l.glucoseMorning != null, he = l.glucoseEvening != null, h = new Date().getHours();

  el.innerHTML =
    '<div class="med-row ' + (hm ? '' : 'pending-row') + '"><span class="med-name">ยาเช้า</span><span class="med-detail">' + MED_SCHEDULE.morning + '</span><span class="med-status">' + (hm ? '<i class="icon-check"></i>' : (h < 12 ? '<i class="icon-pending"></i>' : '<i class="icon-miss"></i>')) + '</span></div>' +
    '<div class="med-row ' + (he ? '' : 'pending-row') + '" id="eveningMedRow"><span class="med-name">ยาเย็น</span><span class="med-detail">' + MED_SCHEDULE.evening + '</span><span class="med-status">' + (he ? '<i class="icon-check"></i>' : (h < 18 ? '<i class="icon-pending"></i>' : '<i class="icon-miss"></i>')) + '</span></div>';
}

/* ====== GLUCOSE — show both morning and evening ====== */
function glucoseBadge(v) {
  if (v == null) return '';
  const s = v < 70 ? ['ต่ำ','bad'] : v < 140 ? ['ดีมาก','good'] : v < 180 ? ['ปกติ','good'] : v < 250 ? ['สูงนิด','warn'] : ['สูงมาก','bad'];
  return '<span class="badge ' + s[1] + '">' + s[0] + '</span>';
}

function renderGlucose(l, logs) {
  const mVal = document.getElementById('glucoseMorningVal');
  const eVal = document.getElementById('glucoseEveningVal');
  const mBadge = document.getElementById('glucoseMorningBadge');
  const eBadge = document.getElementById('glucoseEveningBadge');

  if (l.glucoseMorning != null) { mVal.textContent = l.glucoseMorning; mVal.className = 'glucose-val'; }
  else { mVal.textContent = '—'; mVal.className = 'glucose-val no-data'; }
  mBadge.innerHTML = glucoseBadge(l.glucoseMorning);

  if (l.glucoseEvening != null) { eVal.textContent = l.glucoseEvening; eVal.className = 'glucose-val'; }
  else { eVal.textContent = '—'; eVal.className = 'glucose-val no-data'; }
  eBadge.innerHTML = glucoseBadge(l.glucoseEvening);

}

/* ====== WEIGHT — AM/PM split + trend ====== */
function renderWeight(l, ws) {
  const amEl = document.getElementById('weightAMVal');
  const pmEl = document.getElementById('weightPMVal');

  if (l.weightAM != null) { amEl.textContent = l.weightAM; amEl.className = 'glucose-val'; }
  else { amEl.textContent = '—'; amEl.className = 'glucose-val no-data'; }

  if (l.weightPM != null) { pmEl.textContent = l.weightPM; pmEl.className = 'glucose-val'; }
  else { pmEl.textContent = '—'; pmEl.className = 'glucose-val no-data'; }

  // Trend: compare latest vs 7 days ago from weightHistory
  const trendEl = document.getElementById('weightTrendRow');
  if (!trendEl) return;
  const wv = ws.map(x => x.weight).filter(v => v != null);
  if (wv.length >= 2) {
    const current = wv[wv.length - 1];
    const weekAgoIdx = Math.max(0, wv.length - 8);
    const weekAgo = wv[weekAgoIdx];
    const rawDiff = current - weekAgo;
    const absDiff = Math.abs(rawDiff);
    const refEntry = ws.filter(x => x.weight != null)[weekAgoIdx];
    const weekAgoDate = refEntry ? fmtDate(refEntry.date) : '';

    if (absDiff < 0.1) {
      trendEl.innerHTML = '<span class="trend-arrow flat">→</span> คงที่จาก ' + weekAgoDate;
    } else if (rawDiff > 0) {
      trendEl.innerHTML = '<span class="trend-arrow up">↑</span> เพิ่ม ' + absDiff.toFixed(1) + ' kg จาก ' + weekAgoDate + ' (' + weekAgo + ' kg)';
    } else {
      trendEl.innerHTML = '<span class="trend-arrow down">↓</span> ลด ' + absDiff.toFixed(1) + ' kg จาก ' + weekAgoDate + ' (' + weekAgo + ' kg)';
    }
  } else {
    trendEl.innerHTML = '';
  }
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

/* ====== INSIGHTS — categorised with icons ====== */
function renderInsights(logs, ws, appts) {
  // SVG icons (inline, tiny)
  const ICONS = {
    glucose: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    weight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M16 3h5v5M8 3H3v5M3 16v5h5M16 21h5v-5"/><circle cx="12" cy="12" r="4"/></svg>',
    med: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="11" width="18" height="6" rx="3"/><line x1="12" y1="11" x2="12" y2="17"/></svg>',
    appt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
  };

  const categories = [
    { key: 'glucose', label: 'น้ำตาล', icon: ICONS.glucose, items: [] },
    { key: 'weight', label: 'น้ำหนัก', icon: ICONS.weight, items: [] },
    { key: 'med', label: 'ยา', icon: ICONS.med, items: [] },
    { key: 'appt', label: 'นัดหมอ', icon: ICONS.appt, items: [] }
  ];

  function cat(key) { return categories.find(c => c.key === key); }

  // --- Glucose insights ---
  const gm = logs.map(l => l.glucoseMorning).filter(v => v != null);
  const ge = logs.map(l => l.glucoseEvening).filter(v => v != null);
  if (gm.length) {
    const avg = Math.round(gm.reduce((a, b) => a + b, 0) / gm.length);
    const mn = Math.min(...gm), mx = Math.max(...gm);
    cat('glucose').items.push({ text: 'เช้าเฉลี่ย: ' + avg + ' mg/dL (ต่ำสุด ' + mn + ', สูงสุด ' + mx + ')', sub: 'คำนวณจากค่าน้ำตาลตอนเช้า ' + gm.length + ' วันล่าสุด', type: avg >= 180 ? 'warning' : 'normal' });
  }
  if (ge.length) {
    const avg = Math.round(ge.reduce((a, b) => a + b, 0) / ge.length);
    const mn = Math.min(...ge), mx = Math.max(...ge);
    cat('glucose').items.push({ text: 'เย็นเฉลี่ย: ' + avg + ' mg/dL (ต่ำสุด ' + mn + ', สูงสุด ' + mx + ')', sub: 'คำนวณจากค่าน้ำตาลตอนเย็น ' + ge.length + ' วันล่าสุด', type: avg >= 180 ? 'warning' : 'normal' });
  }
  const allG = [...gm, ...ge];
  const hi = allG.filter(v => v >= 180);
  if (hi.length) cat('glucose').items.push({ text: 'สูง (>180) ' + hi.length + ' ครั้งจาก ' + allG.length + ' ครั้ง', sub: 'นับรวมทุกครั้งที่วัด (เช้า ' + gm.length + ' ครั้ง + เย็น ' + ge.length + ' ครั้ง)', type: 'warning' });

  // --- Weight insights ---
  const wv = ws.map(w => w.weight).filter(v => v != null);
  if (wv.length >= 7) {
    const r = wv.slice(-7), o = wv.slice(-14, -7);
    if (o.length) {
      const rAvg = r.reduce((a, b) => a + b, 0) / r.length;
      const oAvg = o.reduce((a, b) => a + b, 0) / o.length;
      const rawDiff = rAvg - oAvg;
      const absDiff = Math.abs(rawDiff);
      const text = absDiff < 0.1 ? 'คงที่' : (rawDiff > 0 ? 'เพิ่ม ' + absDiff.toFixed(1) + ' kg' : 'ลด ' + absDiff.toFixed(1) + ' kg');
      cat('weight').items.push({ text: text, sub: 'เทียบเฉลี่ยน้ำหนักเช้า 7 วันล่าสุด (' + rAvg.toFixed(1) + ' kg) กับ 7 วันก่อนหน้า (' + oAvg.toFixed(1) + ' kg)', type: absDiff > 1 ? 'warning' : 'normal' });
    }
  }

  // --- Med compliance ---
  const tot = logs.length * 2;
  const fil = logs.reduce((a, l) => a + (l.glucoseMorning != null ? 1 : 0) + (l.glucoseEvening != null ? 1 : 0), 0);
  if (tot) {
    const p = Math.round(fil / tot * 100);
    cat('med').items.push({ text: 'บันทึกครบ ' + fil + '/' + tot + ' (' + p + '%)', sub: 'นับจากค่าน้ำตาลเช้า+เย็น ' + logs.length + ' วัน = ' + tot + ' ช่อง (ใช้แทนการบันทึกยา)', type: p >= 80 ? 'normal' : 'warning' });
  }

  // --- Appointment ---
  if (appts.length) {
    const dd = daysUntil(appts[0].date);
    if (dd <= 14) cat('appt').items.push({ text: (appts[0].title || appts[0].doctor) + ' อีก ' + dd + ' วัน', sub: fmtDate(appts[0].date) + (appts[0].hospital ? ' · ' + appts[0].hospital : ''), type: dd <= 2 ? 'warning' : 'normal' });
  }

  // --- Render each category as its own card ---
  const container = document.getElementById('insightCards');
  if (!container) return;
  container.innerHTML = '';

  categories.forEach(c => {
    if (c.items.length === 0) return;
    const card = document.createElement('div');
    card.className = 'card card-insights';
    let html = '<div class="card-label"><span class="label-icon">' + c.icon + '</span>สรุป' + c.label + '</div>';
    html += '<div class="insight-list">';
    c.items.forEach(item => {
      html += '<div class="insight-item ' + item.type + '"><div class="insight-text">' + item.text + '</div>' + (item.sub ? '<div class="insight-sub">' + item.sub + '</div>' : '') + '</div>';
    });
    html += '</div>';
    card.innerHTML = html;
    container.appendChild(card);
  });

  if (categories.every(c => c.items.length === 0)) {
    const card = document.createElement('div');
    card.className = 'card card-insights';
    card.innerHTML = '<div class="card-label"><span class="label-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="7" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="5" cy="14" r="2"/><circle cx="19" cy="14" r="2"/><path d="M12 18c-2.5 0-4-1.5-4-3.5S9.5 11 12 11s4 1.5 4 3.5-1.5 3.5-4 3.5z"/></svg></span>สรุป</div><div class="insight-list"><div class="insight-item normal"><div class="insight-text">ยังไม่มีข้อมูลเพียงพอสำหรับสรุป</div></div></div>';
    container.appendChild(card);
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
