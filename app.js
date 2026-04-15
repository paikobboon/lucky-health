/* Lucky Health Dashboard — Live Notion Data */
let DATA = null;

async function init() {
  setDate();
  if (window.Telegram?.WebApp) { const t = window.Telegram.WebApp; t.ready(); t.expand(); t.setHeaderColor('#f0fdf4'); t.setBackgroundColor('#f0fdf4'); }
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
  setGreeting(latest); renderAlert(latest); renderMeds(latest); renderGlucose(latest, logs);
  renderApptHero(appts); renderWeight(latest, weights); renderFreshness();
  renderGlucoseChart(logs); renderCompliance(logs); renderWeightChart(weights);
  renderApptList(appts); renderInsights(logs, weights, appts);
}

function setDate() { const d = new Date(), m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']; document.getElementById('dateLabel').textContent = d.getDate() + ' ' + m[d.getMonth()] + ' ' + (d.getFullYear() + 543); }

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
  el.innerHTML = '<div class="med-row ' + (hm ? '' : 'pending-row') + '"><span class="med-name">ยาเช้า</span><span class="med-detail">Metformin + ยาความดัน</span><span class="med-status">' + (hm ? '✅' : (h < 12 ? '⏳' : '❌')) + '</span></div>' +
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
  if (me) { me.innerHTML = ''; logs.map(x => x.glucoseMorning || x.glucoseEvening).filter(Boolean).forEach(v => { const b = document.createElement('div'); b.className = 'mini-bar'; b.style.height = Math.max(3, v/250*24) + 'px'; b.style.background = v < 140 ? 'var(--good)' : v < 180 ? 'var(--warn)' : 'var(--bad)'; b.style.opacity = '0.6'; me.appendChild(b); }); }
}

function renderApptHero(appts) {
  const c = document.getElementById('apptCard'); if (!c) return;
  if (!appts.length) { c.style.display = 'none'; return; }
  c.style.display = 'block';
  const a = appts[0], d = new Date(a.date), diff = Math.ceil((d - new Date()) / 864e5);
  const when = diff <= 0 ? 'วันนี้' : diff === 1 ? 'พรุ่งนี้' : fmtDate(a.date);
  const time = a.date.includes('T') ? a.date.split('T')[1].substring(0, 5) : '';
  c.querySelector('.appt-when').textContent = when;
  c.querySelector('.appt-time').textContent = time || '—';
  c.querySelector('.appt-doctor').textContent = a.doctor || a.title || '—';
  c.querySelector('.appt-where').textContent = [a.hospital, a.type].filter(Boolean).join(' · ');
  if (diff <= 2) c.classList.add('card-highlight');
}

function renderWeight(l, ws) {
  document.getElementById('weightValue').textContent = (l.weightAM || l.weightPM) ?? '—';
  const me = document.getElementById('weightMini'); if (!me) return;
  me.innerHTML = '';
  const wv = ws.map(w => w.weight).filter(Boolean);
  if (!wv.length) return;
  const mn = Math.min(...wv) - 0.3, mx = Math.max(...wv) + 0.3;
  wv.slice(-14).forEach(v => { const b = document.createElement('div'); b.className = 'mini-bar'; b.style.height = Math.max(2, ((v-mn)/(mx-mn))*24) + 'px'; b.style.background = 'var(--good)'; b.style.opacity = '0.5'; me.appendChild(b); });
}

function renderFreshness() {
  const el = document.getElementById('freshnessLabel'); if (!el || !DATA.fetchedAt) return;
  const m = Math.floor((new Date() - new Date(DATA.fetchedAt)) / 6e4);
  el.textContent = m < 5 ? 'อัปเดตล่าสุด: เมื่อสักครู่' : m < 60 ? 'อัปเดต: ' + m + ' นาทีที่แล้ว' : m < 1440 ? 'อัปเดต: ' + Math.floor(m/60) + ' ชม. ที่แล้ว' : 'อัปเดต: ' + Math.floor(m/1440) + ' วันที่แล้ว';
}

function renderGlucoseChart(logs) {
  const c = document.getElementById('glucoseChart'), ds = document.getElementById('chartDays'); if (!c || !ds) return;
  c.innerHTML = ''; ds.innerHTML = '';
  const td = ['อา','จ','อ','พ','พฤ','ศ','ส'];
  logs.forEach(log => {
    const g = document.createElement('div'); g.className = 'bar-group';
    [log.glucoseMorning, log.glucoseEvening].forEach((v, j) => {
      const b = document.createElement('div'); b.className = 'bar';
      if (v == null) { b.style.height = '4px'; b.style.background = 'var(--neutral-bg)'; b.style.border = '1px dashed var(--border)'; }
      else { b.style.height = Math.max(8, v/250*100) + 'px'; b.style.background = v < 140 ? 'var(--good)' : v < 180 ? 'var(--warn)' : 'var(--bad)'; b.style.opacity = j === 0 ? '1' : '0.5'; if (j === 0) b.innerHTML = '<span class="bar-val">' + v + '</span>'; }
      g.appendChild(b);
    });
    c.appendChild(g);
    const dl = document.createElement('span'); dl.textContent = td[new Date(log.date).getDay()]; ds.appendChild(dl);
  });
}

function renderCompliance(logs) {
  const el = document.getElementById('complianceGrid'); if (!el) return;
  const td = ['อา','จ','อ','พ','พฤ','ศ','ส']; el.innerHTML = '';
  logs.forEach((l, i) => {
    const d = document.createElement('div'); d.className = 'comp-day' + (i === logs.length - 1 ? ' today' : '');
    const mc = l.glucoseMorning != null ? '✅' : '❌', ec = l.glucoseEvening != null ? '✅' : (i === logs.length - 1 ? '⏳' : '❌');
    d.innerHTML = '<span class="comp-day-label">' + td[new Date(l.date).getDay()] + '</span><div class="comp-checks">' + mc + '<br>' + ec + '</div>';
    el.appendChild(d);
  });
}

function renderWeightChart(ws) {
  const el = document.getElementById('weightChart'); if (!el) return;
  const vs = ws.map(w => w.weight).filter(Boolean);
  if (!vs.length) { el.innerHTML = '<div style="color:var(--text-3);font-size:14px;padding:16px;">ยังไม่มีข้อมูล</div>'; return; }
  const mn = Math.min(...vs) - 0.5, mx = Math.max(...vs) + 0.5; el.innerHTML = '';
  vs.forEach(v => { const b = document.createElement('div'); b.className = 'weight-bar'; b.style.height = Math.max(3, ((v-mn)/(mx-mn))*60) + 'px'; el.appendChild(b); });
}

function renderApptList(appts) {
  const el = document.getElementById('apptList'); if (!el) return;
  if (!appts.length) { el.innerHTML = '<div style="color:var(--text-3);font-size:14px;padding:8px;">ไม่มีนัดหมอที่กำลังจะถึง</div>'; return; }
  el.innerHTML = '';
  appts.forEach(a => {
    const r = document.createElement('div'); r.className = 'appt-row';
    const t = a.date.includes('T') ? a.date.split('T')[1].substring(0, 5) : '';
    r.innerHTML = '<div class="appt-row-date">' + fmtDate(a.date) + '<br>' + t + '</div><div class="appt-row-info"><div class="appt-row-doctor">' + (a.doctor || a.title || '—') + '</div><div class="appt-row-hospital">' + [a.hospital, a.type].filter(Boolean).join(' · ') + '</div></div>';
    el.appendChild(r);
  });
}

function renderInsights(logs, ws, appts) {
  const el = document.getElementById('insightList'); if (!el) return;
  el.innerHTML = ''; const ins = [];
  const gv = logs.map(l => l.glucoseMorning || l.glucoseEvening).filter(Boolean);
  if (gv.length) { const avg = Math.round(gv.reduce((a,b) => a+b, 0) / gv.length); ins.push({ t: 'น้ำตาลเฉลี่ย ' + gv.length + ' วัน: ' + avg + ' mg/dL', c: avg >= 180 ? 'warning' : 'normal' }); }
  const hi = gv.filter(v => v >= 180);
  if (hi.length) ins.push({ t: 'น้ำตาลสูง (>180) ' + hi.length + ' วันจาก ' + gv.length + ' วัน', c: 'warning' });
  const wv = ws.map(w => w.weight).filter(Boolean);
  if (wv.length >= 7) { const r = wv.slice(-7), o = wv.slice(-14, -7); if (o.length) { const d = ((r.reduce((a,b)=>a+b,0)/r.length) - (o.reduce((a,b)=>a+b,0)/o.length)).toFixed(1); ins.push({ t: d > 0 ? 'น้ำหนักเพิ่ม ' + d + ' kg' : 'น้ำหนักลด ' + Math.abs(d) + ' kg จากสัปดาห์ก่อน', c: Math.abs(d) > 1 ? 'warning' : 'normal' }); } }
  const tot = logs.length * 2, fil = logs.reduce((a, l) => a + (l.glucoseMorning != null ? 1 : 0) + (l.glucoseEvening != null ? 1 : 0), 0);
  if (tot) { const p = Math.round(fil/tot*100); ins.push({ t: 'บันทึกข้อมูลครบ ' + fil + '/' + tot + ' (' + p + '%)', c: p >= 80 ? 'normal' : 'warning' }); }
  if (appts.length) { const dd = Math.ceil((new Date(appts[0].date) - new Date()) / 864e5); if (dd <= 7) ins.push({ t: 'นัดหมอ ' + (appts[0].doctor || appts[0].title) + ' อีก ' + dd + ' วัน', c: dd <= 2 ? 'warning' : 'normal' }); }
  if (!ins.length) ins.push({ t: 'ยังไม่มีข้อมูลเพียงพอสำหรับสรุป', c: 'normal' });
  ins.forEach(i => { const d = document.createElement('div'); d.className = 'insight-item ' + i.c; d.textContent = i.t; el.appendChild(d); });
}

function fmtDate(s) { if (!s) return '—'; const d = new Date(s), m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']; return d.getDate() + ' ' + m[d.getMonth()]; }
document.addEventListener('DOMContentLoaded', init);
