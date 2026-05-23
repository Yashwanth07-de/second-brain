/* ═══════════════════════════════════════════
   glance.js — Smart Daily Glance
   No API key needed — scans all data sources
   for tasks, due dates, alerts using keywords
═══════════════════════════════════════════ */

const Glance = (() => {

  const TASK_KEYWORDS = [
    'today', 'tonight', 'urgent', 'asap', 'deadline',
    'need to', 'must', 'should', 'have to', 'remind',
    'call', 'email', 'submit', 'pay', 'book', 'schedule',
    'finish', 'complete', 'review', 'follow up', 'due'
  ];

  function generate() {
    const el = document.getElementById('glance-output');
    el.innerHTML = `<div class="glance-empty">
      <div style="display:flex;align-items:center;gap:8px;justify-content:center;color:var(--text-secondary);font-size:13px;">
        <span style="animation:spin 1s linear infinite;display:inline-block">⟳</span> Scanning your data…
      </div>
    </div>`;

    setTimeout(() => render(el), 400);
  }

  function render(el) {
    const tasks   = extractTasks();
    const alerts  = extractAlerts();
    const focus   = pickFocus(tasks, alerts);
    const summary = buildSummary();

    if (!tasks.length && !alerts.length && !summary) {
      el.innerHTML = `<div class="glance-empty">
        <span style="font-size:28px;display:block;margin-bottom:8px;opacity:0.3">🧠</span>
        Add notes, bills, and appointments — your daily glance will appear here.
      </div>`;
      return;
    }

    let html = '';

    if (focus) {
      html += `<div class="glance-focus-chip">✦ ${escHtml(focus)}</div>`;
    }

    if (summary) {
      html += `<p class="glance-summary">${escHtml(summary)}</p>`;
    }

    const allItems = [...alerts, ...tasks];
    if (allItems.length) {
      html += `<div class="glance-tasks-header">Today's action items</div>`;
      allItems.slice(0, 8).forEach((t, i) => {
        const tagColor = t.section === 'Bills' ? 'badge-overdue' :
                         t.section === 'Finance' ? 'badge-expense' :
                         t.section === 'Health' ? 'badge-soon' : 'badge-income';
        html += `
          <div class="glance-task">
            <div class="glance-task-cb" id="gtcb-${i}" onclick="Glance.toggleTask(${i})"></div>
            <span class="glance-task-text" id="gtt-${i}">${escHtml(t.text)}</span>
            <span class="glance-section-tag badge ${tagColor}">${escHtml(t.section)}</span>
          </div>`;
      });
    }

    if (!allItems.length && summary) {
      html += `<div style="font-size:12px;color:var(--text-tertiary);margin-top:4px">No specific tasks found — you're all clear! 🎉</div>`;
    }

    el.innerHTML = html;
  }

  function extractTasks() {
    const tasks = [];
    const notes = Storage.get(Storage.KEYS.notes);
    notes.forEach(n => {
      const text = ((n.title || '') + ' ' + (n.body || '')).toLowerCase();
      const found = TASK_KEYWORDS.some(kw => text.includes(kw));
      if (found) {
        const lines = (n.body || '').split('\n').filter(l => {
          const ll = l.toLowerCase();
          return TASK_KEYWORDS.some(kw => ll.includes(kw));
        });
        const snippet = lines[0] || n.title || 'Note task';
        tasks.push({ text: snippet.trim().substring(0, 80), section: 'Notes' });
      }
    });
    return tasks.slice(0, 5);
  }

  function extractAlerts() {
    const alerts = [];
    const today = new Date();

    // Bills due within 5 days or overdue
    const bills = Storage.get(Storage.KEYS.bills);
    bills.filter(b => b.status !== 'paid').forEach(b => {
      if (!b.dueDate) return;
      const d = daysUntil(b.dueDate);
      if (d !== null && d <= 5) {
        const label = d < 0 ? `OVERDUE by ${Math.abs(d)}d` : d === 0 ? 'due TODAY' : `due in ${d}d`;
        alerts.push({ text: `${b.name} bill ${label} — ${formatCurrency(b.amount)}`, section: 'Bills' });
      }
    });

    // Credit card payments due within 7 days
    const cards = Storage.get(Storage.KEYS.cards);
    cards.forEach(c => {
      if (!c.dueDate) return;
      const d = daysUntil(c.dueDate);
      if (d !== null && d <= 7) {
        const label = d <= 0 ? 'due TODAY' : `due in ${d}d`;
        alerts.push({ text: `${c.bankName} credit card payment ${label}`, section: 'Finance' });
      }
    });

    // Appointments today or tomorrow
    const appts = Storage.get(Storage.KEYS.appointments);
    appts.forEach(a => {
      if (!a.date) return;
      const d = daysUntil(a.date);
      if (d !== null && d >= 0 && d <= 1) {
        const label = d === 0 ? 'today' : 'tomorrow';
        alerts.push({ text: `Appointment: ${a.title} with ${a.doctor || 'doctor'} ${label} at ${a.time || ''}`, section: 'Health' });
      }
    });

    // Subscriptions renewing within 3 days
    const subs = Storage.get(Storage.KEYS.subs);
    subs.filter(s => s.status === 'active').forEach(s => {
      if (!s.renewalDate) return;
      const d = daysUntil(s.renewalDate);
      if (d !== null && d >= 0 && d <= 3) {
        alerts.push({ text: `${s.name} subscription renews in ${d}d — ${formatCurrency(s.amount)}`, section: 'Subscriptions' });
      }
    });

    return alerts.slice(0, 6);
  }

  function pickFocus(tasks, alerts) {
    if (alerts.length > 0) return alerts[0].text.substring(0, 80);
    if (tasks.length > 0) return tasks[0].text.substring(0, 80);
    const notes = Storage.get(Storage.KEYS.notes);
    if (notes.length > 0) return 'Review your latest note: ' + (notes[0].title || 'Untitled');
    return null;
  }

  function buildSummary() {
    const notes = Storage.get(Storage.KEYS.notes);
    const bills = Storage.get(Storage.KEYS.bills);
    const subs  = Storage.get(Storage.KEYS.subs);
    const cards = Storage.get(Storage.KEYS.cards);

    const parts = [];
    if (notes.length) parts.push(`${notes.length} note${notes.length > 1 ? 's' : ''} saved`);
    const unpaidBills = bills.filter(b => b.status !== 'paid').length;
    if (unpaidBills) parts.push(`${unpaidBills} unpaid bill${unpaidBills > 1 ? 's' : ''}`);
    const activeSubs = subs.filter(s => s.status === 'active').length;
    if (activeSubs) parts.push(`${activeSubs} active subscription${activeSubs > 1 ? 's' : ''}`);
    if (cards.length) parts.push(`${cards.length} card${cards.length > 1 ? 's' : ''} tracked`);

    if (!parts.length) return null;
    return `Here's your overview: ${parts.join(' · ')}.`;
  }

  function toggleTask(i) {
    const cb = document.getElementById('gtcb-' + i);
    const tt = document.getElementById('gtt-' + i);
    if (!cb || !tt) return;
    cb.classList.toggle('done');
    cb.textContent = cb.classList.contains('done') ? '✓' : '';
    tt.classList.toggle('done');
  }

  return { generate, toggleTask };
})();
