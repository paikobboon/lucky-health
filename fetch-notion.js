const NOTION_KEY = process.env.NOTION_API_KEY;
const DB = {
  daily: '2c2168ee-ef4a-81ef-b724-ec35c3877e8f',
  appointments: '2c2168ee-ef4a-81b7-aea4-c305fb6233b5',
  medications: '2c2168ee-ef4a-81fc-90ae-ff8d0e66d180'
};

async function query(dbId, body) {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return res.json();
}

function prop(page, name) {
  const p = page.properties[name];
  if (!p) return null;
  switch (p.type) {
    case 'number': return p.number;
    case 'date': return p.date?.start || null;
    case 'select': return p.select?.name || null;
    case 'title': return p.title?.[0]?.plain_text || null;
    case 'rich_text': return p.rich_text?.[0]?.plain_text || null;
    case 'status': return p.status?.name || null;
    default: return null;
  }
}

async function fetchDailyLogs() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const res = await query(DB.daily, {
    filter: { property: 'Date', date: { on_or_after: sevenDaysAgo.toISOString().split('T')[0] } },
    sorts: [{ property: 'Date', direction: 'ascending' }],
    page_size: 7
  });

  return res.results.map(p => ({
    date: prop(p, 'Date'),
    glucoseMorning: prop(p, '(M) Glucose (หลังตื่น)'),
    glucoseEvening: prop(p, '(A) Glucose (ก่อนอาหารเย็น)'),
    weightAM: prop(p, 'Weight (AM)'),
    weightPM: prop(p, 'Weight (PM)'),
    sleep: prop(p, 'Sleep Quality'),
    appetite: prop(p, 'Appetite'),
    exercise: prop(p, 'ออกกำลังกายอะไร')
  }));
}

async function fetchWeightHistory() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const res = await query(DB.daily, {
    filter: { property: 'Date', date: { on_or_after: thirtyDaysAgo.toISOString().split('T')[0] } },
    sorts: [{ property: 'Date', direction: 'ascending' }],
    page_size: 30
  });

  return res.results.map(p => ({
    date: prop(p, 'Date'),
    weight: prop(p, 'Weight (AM)') || prop(p, 'Weight (PM)')
  })).filter(d => d.weight !== null);
}

async function fetchAppointments() {
  const today = new Date().toISOString().split('T')[0];

  const res = await query(DB.appointments, {
    filter: {
      and: [
        { property: 'Date & Time', date: { on_or_after: today } },
        { property: 'Status', select: { equals: 'Scheduled' } }
      ]
    },
    sorts: [{ property: 'Date & Time', direction: 'ascending' }],
    page_size: 5
  });

  return res.results.map(p => ({
    title: prop(p, 'Appointment Title'),
    date: prop(p, 'Date & Time'),
    doctor: prop(p, 'Doctor Name'),
    hospital: prop(p, 'Hospital'),
    type: prop(p, 'Type'),
    purpose: prop(p, 'Purpose')
  }));
}

async function fetchMedications() {
  const res = await query(DB.medications, {
    page_size: 20
  });

  return res.results.map(p => ({
    name: prop(p, 'Name') || prop(p, 'Medication Name'),
    status: prop(p, 'Status')
  }));
}

async function main() {
  const errors = [];
  let dailyLogs = [], weightHistory = [], appointments = [], medications = [];

  try { dailyLogs = await fetchDailyLogs(); } catch (e) { errors.push(`daily: ${e.message}`); }
  try { weightHistory = await fetchWeightHistory(); } catch (e) { errors.push(`weight: ${e.message}`); }
  try { appointments = await fetchAppointments(); } catch (e) { errors.push(`appointments: ${e.message}`); }
  try { medications = await fetchMedications(); } catch (e) { errors.push(`medications: ${e.message}`); }

  const data = {
    fetchedAt: new Date().toISOString(),
    errors: errors.length > 0 ? errors : null,
    dailyLogs,
    weightHistory,
    appointments,
    medications
  };

  const fs = require('fs');
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
  console.log(`Fetched: ${dailyLogs.length} daily logs, ${weightHistory.length} weight entries, ${appointments.length} appointments, ${medications.length} medications`);
  if (errors.length > 0) console.error('Errors:', errors);
}

main().catch(e => { console.error(e); process.exit(1); });
