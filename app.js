/* Lucky Health Dashboard */

const DATA = {
  glucose: {
    morning: [138, 145, 152, 140, 165, 148, 145],
    evening: [155, 142, 160, 138, 172, 150, 138],
    days: ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
  },
  weight: genWeight(30),
  meds: [
    { m: true, e: true },
    { m: true, e: true },
    { m: true, e: false },
    { m: true, e: true },
    { m: true, e: true },
    { m: true, e: false },
    { m: true, e: null }
  ],
  appointments: [
    { date: 'พรุ่งนี้', time: '10:00', doctor: 'อ.วรวิทย์', hospital: 'เกษมราษฎร์' },
    { date: '22 เม.ย.', time: '14:00', doctor: 'อ.นพพล', hospital: 'KCMH' },
    { date: '29 เม.ย.', time: '09:30', doctor: 'อ.ลักษมัน', hospital: 'SiPH' }
  ],
  insights: [
    { text: 'น้ำตาลเฉลี่ย 7 วัน: 148 mg/dL — อยู่ในเกณฑ์ดีค่ะ', type: 'normal' },
    { text: 'น้ำตาลเย็นวันศุกร์สูง 172 — ลองเช็คอาหารวันนั้นนะคะ', type: 'warning' },
    { text: 'น้ำหนักลดลง 0.3 kg จากสัปดาห์ก่อน', type: 'normal' },
    { text: 'ทานยาครบ 5/7 วัน (71%) — พยายามอีกนิดนะคะป๊า 💪', type: 'warning' }
  ]
};

let currentView = 'simple';

function init() {
  setDate();
  setGreeting();
  renderSparkline();
  renderGlucoseChart();
  renderCompliance();
  renderWeightChart();
  renderAppointments();
  renderInsights();

  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#f0fdf4');
    tg.setBackgroundColor('#f0fdf4');
  }
}

function setDate() {
  const d = new Date();
  const m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  document.getElementById('dateLabel').textContent = `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function setGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'สวัสดีตอนเช้าค่ะป๊า ☀️' : h < 17 ? 'สวัสดีตอนบ่ายค่ะป๊า 🌤️' : 'สวัสดีตอนเย็นค่ะป๊า 🌙';
  const v = DATA.glucose.morning[6];
  const s = v < 140 ? ' น้ำตาลดีมากเลยค่ะวันนี้ ✨' : v < 180 ? ' น้ำตาลปกติดีค่ะ 🌿' : ' ระวังน้ำตาลหน่อยนะคะ 💛';
  document.getElementById('greetingText').textContent = g + s;
}

function toggleView() {
  const s = document.getElementById('simpleView');
  const d = document.getElementById('detailView');
  const i = document.getElementById('toggleIcon');
  if (currentView === 'simple') {
    s.classList.remove('active'); d.classList.add('active');
    i.textContent = '🐕'; currentView = 'detail';
  } else {
    d.classList.remove('active'); s.classList.add('active');
    i.textContent = '📋'; currentView = 'simple';
  }
}

function renderSparkline() {
  const el = document.getElementById('weightSparkline');
  if (!el) return;
  const d = DATA.weight.slice(-14);
  const mn = Math.min(...d) - 0.3, mx = Math.max(...d) + 0.3;
  el.innerHTML = '';
  d.forEach(v => {
    const b = document.createElement('div');
    b.className = 'spark-bar';
    b.style.height = Math.max(2, ((v - mn) / (mx - mn)) * 18) + 'px';
    el.appendChild(b);
  });
}

function renderGlucoseChart() {
  const c = document.getElementById('glucoseChart');
  const days = document.getElementById('chartDays');
  if (!c || !days) return;
  c.innerHTML = ''; days.innerHTML = '';

  DATA.glucose.morning.forEach((mv, i) => {
    const ev = DATA.glucose.evening[i];
    const g = document.createElement('div');
    g.className = 'bar-group';

    [mv, ev].forEach((v, j) => {
      const b = document.createElement('div');
      b.className = 'bar';
      b.style.height = Math.max(6, (v / 200) * 90) + 'px';
      b.style.background = v < 140 ? 'var(--good)' : v < 180 ? 'var(--warn)' : 'var(--bad)';
      b.style.opacity = j === 0 ? '1' : '0.5';
      if (j === 0) b.innerHTML = `<span class="bar-val">${v}</span>`;
      g.appendChild(b);
    });
    c.appendChild(g);
    const dl = document.createElement('span');
    dl.textContent = DATA.glucose.days[i];
    days.appendChild(dl);
  });
}

function renderCompliance() {
  const el = document.getElementById('complianceGrid');
  if (!el) return;
  const days = ['จ','อ','พ','พฤ','ศ','ส','อา'];
  el.innerHTML = '';
  DATA.meds.forEach((d, i) => {
    const div = document.createElement('div');
    div.className = 'comp-day' + (i === 6 ? ' today' : '');
    const mc = d.m ? '✅' : '❌';
    const ec = d.e === null ? '⏳' : (d.e ? '✅' : '❌');
    div.innerHTML = `<span class="comp-day-label">${days[i]}</span><div class="comp-checks">${mc}<br>${ec}</div>`;
    el.appendChild(div);
  });
}

function renderWeightChart() {
  const el = document.getElementById('weightChart');
  if (!el) return;
  const d = DATA.weight;
  const mn = Math.min(...d) - 0.5, mx = Math.max(...d) + 0.5;
  el.innerHTML = '';
  d.forEach(v => {
    const b = document.createElement('div');
    b.className = 'weight-bar';
    b.style.height = Math.max(3, ((v - mn) / (mx - mn)) * 50) + 'px';
    el.appendChild(b);
  });
}

function renderAppointments() {
  const el = document.getElementById('apptList');
  if (!el) return;
  el.innerHTML = '';
  DATA.appointments.forEach(a => {
    const r = document.createElement('div');
    r.className = 'appt-row';
    r.innerHTML = `<div class="appt-row-date">${a.date}<br>${a.time}</div><div class="appt-row-info"><div class="appt-row-doctor">${a.doctor}</div><div class="appt-row-hospital">${a.hospital}</div></div>`;
    el.appendChild(r);
  });
}

function renderInsights() {
  const el = document.getElementById('insightList');
  if (!el) return;
  el.innerHTML = '';
  DATA.insights.forEach(ins => {
    const d = document.createElement('div');
    d.className = 'insight-item ' + ins.type;
    d.textContent = ins.text;
    el.appendChild(d);
  });
}

function genWeight(n) {
  const b = 61.2, d = [];
  for (let i = n - 1; i >= 0; i--) d.push(+(b - (Math.random() * 0.6 - 0.1) - (i * 0.012)).toFixed(1));
  return d;
}

document.addEventListener('DOMContentLoaded', init);
