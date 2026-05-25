/* ═══════════════════════════════════════════
   savings.js — Savings goals
═══════════════════════════════════════════ */

const Savings = (() => {
  const COLORS = ['accent', 'green', 'blue', 'purple', 'orange'];
  const ICONS  = ['🏠','✈️','🚗','💍','📱','🎓','💊','🏖️','💰','🎯'];

  function render() {
    const items = Storage.get(Storage.KEYS.savings);
    const grid  = document.getElementById('savings-grid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><span class="empty-state-icon">🎯</span><div class="empty-state-text">No savings goals yet</div><div class="empty-state-sub">Set a goal and track your progress</div></div></div>`;
      return;
    }
    grid.innerHTML = items.map((g, idx) => {
      const pct  = Math.min(100, Math.round((g.saved / g.target) * 100)) || 0;
      const col  = COLORS[idx % COLORS.length];
      const remaining = Math.max(0, g.target - g.saved);
      return `
        <div class="savings-card animate-fadeUp">
          <div class="savings-card-header">
            <div>
              <div style="font-size:22px;margin-bottom:4px">${g.icon || '🎯'}</div>
              <div class="savings-card-name">${escHtml(g.name)}</div>
              <div class="savings-card-target">Target: ${formatCurrency(g.target)}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
              <span style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--${col==='accent'?'accent':'--'+col})">${pct}%</span>
              <button class="btn btn-xs btn-ghost" onclick="Savings.openDeposit('${g.id}')">+ Add</button>
              <button class="btn btn-xs btn-danger" onclick="Savings.delete('${g.id}')">Del</button>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-fill ${col}" style="width:${pct}%"></div></div>
          <div class="savings-card-numbers">
            <span>Saved: ${formatCurrency(g.saved)}</span>
            <span>Left: ${formatCurrency(remaining)}</span>
          </div>
        </div>`;
    }).join('');
  }

  function openAdd() {
    App.openModal('New savings goal', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Goal name</label>
          <input class="form-input" id="sv-name" placeholder="e.g. Vacation fund" />
        </div>
        <div class="form-group">
          <label class="form-label">Icon</label>
          <select class="form-select" id="sv-icon">${ICONS.map(i=>`<option value="${i}">${i}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Target amount (₹)</label>
          <input class="form-input" id="sv-target" type="number" placeholder="100000" min="1" />
        </div>
        <div class="form-group">
          <label class="form-label">Already saved (₹)</label>
          <input class="form-input" id="sv-saved" type="number" placeholder="0" min="0" />
        </div>
      </div>`,
      [
        { label: 'Cancel', action: 'App.closeModal()', cls: 'btn-ghost' },
        { label: 'Create goal', action: 'Savings.save()', cls: 'btn-primary' }
      ]
    );
  }

  function save() {
    const name   = document.getElementById('sv-name')?.value.trim();
    const target = document.getElementById('sv-target')?.value;
    const saved  = document.getElementById('sv-saved')?.value || 0;
    const icon   = document.getElementById('sv-icon')?.value;
    if (!name || !target) { App.toast('Name and target required', 'error'); return; }
    Storage.push(Storage.KEYS.savings, { id: genId(), name, target: Number(target), saved: Number(saved), icon });
    Storage.logActivity(`🎯 New savings goal: ${name}`, '#9b7ff4');
    App.toast('Savings goal created');
    App.closeModal();
    render();
    App.refreshDashboard();
  }

  function openDeposit(id) {
    App.openModal('Add to savings', `
      <div class="form-group">
        <label class="form-label">Amount to add (₹)</label>
        <input class="form-input" id="sv-deposit" type="number" placeholder="0" min="1" />
      </div>
      <input type="hidden" id="sv-deposit-id" value="${id}" />`,
      [
        { label: 'Cancel', action: 'App.closeModal()', cls: 'btn-ghost' },
        { label: 'Add amount', action: 'Savings.deposit()', cls: 'btn-primary' }
      ]
    );
  }

  function deposit() {
    const id  = document.getElementById('sv-deposit-id')?.value;
    const amt = Number(document.getElementById('sv-deposit')?.value);
    if (!amt || amt <= 0) { App.toast('Enter valid amount', 'error'); return; }
    const items = Storage.get(Storage.KEYS.savings);
    const item  = items.find(s => s.id === id);
    if (item) {
      item.saved += amt;
      Storage.set(Storage.KEYS.savings, items);
    }
    App.toast('Amount added to savings!', 'success');
    App.closeModal();
    render();
    App.refreshDashboard();
  }

  function del(id) {
    if (!confirm('Delete this savings goal?')) return;
    Storage.remove(Storage.KEYS.savings, id);
    App.toast('Goal removed');
    render();
    App.refreshDashboard();
  }

  return { render, openAdd, save, openDeposit, deposit, delete: del };
})();


/* ═══════════════════════════════════════════
   bills.js — Bills tracker
═══════════════════════════════════════════ */

const Bills = (() => {
  let activeFilter = 'all';

  function render(search = '') {
    renderStats();
    renderList(search);
    updateBadge();
    // Attach filter pill listeners
    document.querySelectorAll('#bills-filter-pills .tag-pill').forEach(pill => {
      pill.onclick = () => {
        document.querySelectorAll('#bills-filter-pills .tag-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeFilter = pill.dataset.filter;
        renderList(search);
      };
    });
  }

  function getStatus(bill) {
    if (bill.status === 'paid') return 'paid';
    if (!bill.dueDate) return 'unpaid';
    const d = daysUntil(bill.dueDate);
    if (d !== null && d < 0) return 'overdue';
    return 'unpaid';
  }

  function renderStats() {
    const bills = Storage.get(Storage.KEYS.bills);
    const unpaid = bills.filter(b => b.status !== 'paid');
    const total  = unpaid.reduce((s, b) => s + Number(b.amount || 0), 0);
    const overdue = bills.filter(b => getStatus(b) === 'overdue').length;
    document.getElementById('bills-stats').innerHTML = `
      <div class="stat-card"><div class="stat-label">Total bills</div><div class="stat-value accent">${bills.length}</div></div>
      <div class="stat-card"><div class="stat-label">Unpaid total</div><div class="stat-value red">${formatCurrency(total)}</div></div>
      <div class="stat-card"><div class="stat-label">Overdue</div><div class="stat-value ${overdue?'red':'green'}">${overdue}</div></div>`;
  }

  function renderList(search = '') {
    let items = Storage.get(Storage.KEYS.bills);
    if (search) items = items.filter(b => (b.name + b.category).toLowerCase().includes(search.toLowerCase()));
    if (activeFilter !== 'all') items = items.filter(b => getStatus(b) === activeFilter);
    items.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
    const el = document.getElementById('bills-list');
    if (!el) return;
    if (!items.length) {
      el.innerHTML = `<div class="empty-state"><span class="empty-state-icon">🧾</span><div class="empty-state-text">No bills found</div></div>`;
      return;
    }
    el.innerHTML = items.map(b => {
      const status = getStatus(b);
      const d = b.dueDate ? daysUntil(b.dueDate) : null;
      const dueLabel = d === null ? '' : d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'due today' : `due in ${d}d`;
      return `
        <div class="list-item">
          <div class="list-item-icon" style="background:var(--${status==='paid'?'green':status==='overdue'?'red':'orange'}-muted)">🧾</div>
          <div class="list-item-main">
            <div class="list-item-name">${escHtml(b.name)}</div>
            <div class="list-item-sub">${escHtml(b.category||'')} ${dueLabel ? '· ' + dueLabel : ''}</div>
          </div>
          <div class="list-item-right">
            <div class="list-item-amount neutral">${formatCurrency(b.amount)}</div>
            <span class="badge badge-${status}">${status}</span>
            <div class="list-item-actions">
              ${status !== 'paid' ? `<button class="btn btn-xs btn-success" onclick="Bills.markPaid('${b.id}')">Paid</button>` : ''}
              <button class="btn btn-xs btn-danger" onclick="Bills.delete('${b.id}')">Del</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function updateBadge() {
    const bills = Storage.get(Storage.KEYS.bills);
    const urgent = bills.filter(b => {
      const s = getStatus(b);
      if (s === 'paid') return false;
      const d = daysUntil(b.dueDate);
      return s === 'overdue' || (d !== null && d <= 3);
    }).length;
    const badge = document.getElementById('badge-bills');
    if (badge) { badge.textContent = urgent; badge.style.display = urgent ? '' : 'none'; }
  }

  function openAdd() {
    App.openModal('Add bill', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Bill name</label>
          <input class="form-input" id="bill-name" placeholder="e.g. Electricity bill" />
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-select" id="bill-category">
            <option>Electricity</option><option>Water</option><option>Internet</option>
            <option>Gas</option><option>Insurance</option><option>Rent</option>
            <option>Phone</option><option>Other</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount (₹)</label>
          <input class="form-input" id="bill-amount" type="number" placeholder="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Due date</label>
          <input class="form-input" id="bill-due" type="date" />
        </div>
      </div>`,
      [
        { label: 'Cancel', action: 'App.closeModal()', cls: 'btn-ghost' },
        { label: 'Add bill', action: 'Bills.save()', cls: 'btn-primary' }
      ]
    );
  }

  function save() {
    const name     = document.getElementById('bill-name')?.value.trim();
    const category = document.getElementById('bill-category')?.value;
    const amount   = document.getElementById('bill-amount')?.value;
    const dueDate  = document.getElementById('bill-due')?.value;
    if (!name || !amount) { App.toast('Name and amount required', 'error'); return; }
    Storage.push(Storage.KEYS.bills, { id: genId(), name, category, amount: Number(amount), dueDate, status: 'unpaid' });
    Storage.logActivity(`🧾 Bill added: ${name} — ${formatCurrency(amount)}`, '#e8873a');
    App.toast('Bill added');
    App.closeModal();
    render();
    App.refreshDashboard();
  }

  function markPaid(id) {
    Storage.update(Storage.KEYS.bills, id, { status: 'paid' });
    App.toast('Marked as paid ✓', 'success');
    render();
    App.refreshDashboard();
  }

  function del(id) {
    Storage.remove(Storage.KEYS.bills, id);
    App.toast('Bill removed');
    render();
    App.refreshDashboard();
  }

  return { render, openAdd, save, markPaid, delete: del };
})();


/* ═══════════════════════════════════════════
   subscriptions.js — Subscriptions tracker
═══════════════════════════════════════════ */

const Subscriptions = (() => {
  const SUB_ICONS = { 'Netflix':'🎬','Spotify':'🎵','YouTube Premium':'▶️','Amazon Prime':'📦','Disney+':'🏰','Apple One':'🍎','Hotstar':'🌟','Zee5':'📺','SonyLiv':'📡','Other':'📦' };

  function render(search = '') {
    renderStats();
    renderGrid(search);
  }

  function renderStats() {
    const subs = Storage.get(Storage.KEYS.subs);
    const active = subs.filter(s => s.status === 'active');
    const monthly = active.reduce((sum, s) => {
      if (s.billing === 'yearly') return sum + (Number(s.amount) / 12);
      return sum + Number(s.amount);
    }, 0);
    document.getElementById('subs-stats').innerHTML = `
      <div class="stat-card"><div class="stat-label">Active subs</div><div class="stat-value accent">${active.length}</div></div>
      <div class="stat-card"><div class="stat-label">Monthly cost</div><div class="stat-value red">${formatCurrency(Math.round(monthly))}</div></div>
      <div class="stat-card"><div class="stat-label">Yearly total</div><div class="stat-value orange">${formatCurrency(Math.round(monthly * 12))}</div></div>`;
  }

  function renderGrid(search = '') {
    let items = Storage.get(Storage.KEYS.subs);
    if (search) items = items.filter(s => (s.name + s.category).toLowerCase().includes(search.toLowerCase()));
    const grid = document.getElementById('subs-grid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><span class="empty-state-icon">📦</span><div class="empty-state-text">No subscriptions yet</div></div></div>`;
      return;
    }
    grid.innerHTML = items.map(s => {
      const d = s.renewalDate ? daysUntil(s.renewalDate) : null;
      const renewLabel = d !== null ? (d === 0 ? 'renews today' : d > 0 ? `renews in ${d}d` : 'expired') : '';
      return `
        <div class="savings-card animate-fadeUp" style="min-height:auto">
          <div class="savings-card-header">
            <div>
              <div style="font-size:22px;margin-bottom:4px">${SUB_ICONS[s.name] || '📦'}</div>
              <div class="savings-card-name">${escHtml(s.name)}</div>
              <div class="savings-card-target">${s.billing || 'monthly'} · ${renewLabel}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
              <span class="badge badge-${s.status==='active'?'active':'paused'}">${s.status}</span>
              <div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text-primary)">${formatCurrency(s.amount)}</div>
              <div style="display:flex;gap:4px">
                ${s.status==='active'
                  ? `<button class="btn btn-xs btn-ghost" onclick="Subscriptions.toggle('${s.id}','paused')">Pause</button>`
                  : `<button class="btn btn-xs btn-success" onclick="Subscriptions.toggle('${s.id}','active')">Resume</button>`}
                <button class="btn btn-xs btn-danger" onclick="Subscriptions.delete('${s.id}')">Del</button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function openAdd() {
    App.openModal('Add subscription', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Service</label>
          <input class="form-input" id="sub-name" placeholder="e.g. Netflix" list="sub-list" />
          <datalist id="sub-list">${Object.keys(SUB_ICONS).map(s=>`<option value="${s}">`).join('')}</datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Billing cycle</label>
          <select class="form-select" id="sub-billing">
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount (₹)</label>
          <input class="form-input" id="sub-amount" type="number" placeholder="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Next renewal date</label>
          <input class="form-input" id="sub-renewal" type="date" />
        </div>
      </div>`,
      [
        { label: 'Cancel', action: 'App.closeModal()', cls: 'btn-ghost' },
        { label: 'Add subscription', action: 'Subscriptions.save()', cls: 'btn-primary' }
      ]
    );
  }

  function save() {
    const name        = document.getElementById('sub-name')?.value.trim();
    const billing     = document.getElementById('sub-billing')?.value;
    const amount      = document.getElementById('sub-amount')?.value;
    const renewalDate = document.getElementById('sub-renewal')?.value;
    if (!name || !amount) { App.toast('Name and amount required', 'error'); return; }
    Storage.push(Storage.KEYS.subs, { id: genId(), name, billing, amount: Number(amount), renewalDate, status: 'active' });
    App.toast('Subscription added');
    App.closeModal();
    render();
    App.refreshDashboard();
  }

  function toggle(id, status) {
    Storage.update(Storage.KEYS.subs, id, { status });
    App.toast(status === 'active' ? 'Subscription resumed' : 'Subscription paused');
    render();
    App.refreshDashboard();
  }

  function del(id) {
    Storage.remove(Storage.KEYS.subs, id);
    App.toast('Subscription removed');
    render();
    App.refreshDashboard();
  }

  return { render, openAdd, save, toggle, delete: del };
})();


/* ═══════════════════════════════════════════
   creditcards.js — Credit card tracker
═══════════════════════════════════════════ */

const CreditCards = (() => {

  function render(search = '') {
    renderCards();
    renderPayments(search);
    updateBadge();
  }

  function renderCards() {
    const cards = Storage.get(Storage.KEYS.cards);
    const grid  = document.getElementById('cc-grid');
    if (!grid) return;
    if (!cards.length) {
      grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><span class="empty-state-icon">💳</span><div class="empty-state-text">No credit cards added</div></div></div>`;
      return;
    }
    grid.innerHTML = cards.map(c => {
      const used = Number(c.used || 0);
      const limit = Number(c.limit || 1);
      const pct = Math.round((used / limit) * 100);
      const utilClass = pct > 75 ? 'high' : pct > 40 ? 'mid' : 'low';
      const daysLeft = c.dueDate ? daysUntil(c.dueDate) : null;
      const dueLabel = daysLeft !== null ? (daysLeft < 0 ? 'Overdue!' : daysLeft === 0 ? 'Due today!' : `Due in ${daysLeft}d`) : 'No due date';
      return `
        <div class="cc-card animate-fadeUp">
          <div class="cc-card-top">
            <div>
              <div class="cc-card-bank">${escHtml(c.bankName)}</div>
              <div class="cc-card-network">${escHtml(c.network || 'Visa')}</div>
            </div>
            <div class="cc-card-chip"></div>
          </div>
          <div class="cc-card-number">•••• •••• •••• ${escHtml(c.last4 || '0000')}</div>
          <div class="cc-utilization">
            <div class="cc-util-label">
              <span>Used: ${formatCurrency(used)}</span>
              <span>${pct}% of ${formatCurrency(limit)}</span>
            </div>
            <div class="cc-util-bar"><div class="cc-util-fill ${utilClass}" style="width:${pct}%"></div></div>
          </div>
          <div class="cc-card-bottom" style="margin-top:10px">
            <div>
              <div class="cc-card-due-label">Payment due</div>
              <div class="cc-card-due-date ${daysLeft !== null && daysLeft <= 3 ? 'color:var(--red)' : ''}">${dueLabel}</div>
            </div>
            <div style="display:flex;gap:5px">
              <button class="btn btn-xs btn-ghost" onclick="CreditCards.openEdit('${c.id}')">Edit</button>
              <button class="btn btn-xs btn-danger" onclick="CreditCards.delete('${c.id}')">Del</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function renderPayments(search = '') {
    const cards = Storage.get(Storage.KEYS.cards);
    const el = document.getElementById('cc-payments-list');
    if (!el) return;
    let items = cards.filter(c => c.dueDate);
    if (search) items = items.filter(c => c.bankName.toLowerCase().includes(search.toLowerCase()));
    items.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    if (!items.length) {
      el.innerHTML = `<div class="empty-state" style="padding:20px"><span class="empty-state-text">No upcoming payments</span></div>`;
      return;
    }
    el.innerHTML = items.map(c => {
      const d = daysUntil(c.dueDate);
      const status = d < 0 ? 'overdue' : d <= 3 ? 'soon' : 'unpaid';
      return `
        <div class="list-item">
          <div class="list-item-icon" style="background:var(--accent-muted)">💳</div>
          <div class="list-item-main">
            <div class="list-item-name">${escHtml(c.bankName)} — •••• ${escHtml(c.last4 || '0000')}</div>
            <div class="list-item-sub">Due: ${c.dueDate} ${d !== null ? '· ' + (d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'today' : `in ${d}d`) : ''}</div>
          </div>
          <div class="list-item-right">
            <div class="list-item-amount expense">${formatCurrency(c.minPayment || c.used)}</div>
            <span class="badge badge-${status}">${status}</span>
          </div>
        </div>`;
    }).join('');
  }

  function updateBadge() {
    const cards = Storage.get(Storage.KEYS.cards);
    const urgent = cards.filter(c => {
      const d = daysUntil(c.dueDate);
      return d !== null && d <= 5;
    }).length;
    const badge = document.getElementById('badge-cc');
    if (badge) { badge.textContent = urgent; badge.style.display = urgent ? '' : 'none'; }
  }

  function openAdd() {
    App.openModal('Add credit card', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Bank name</label>
          <input class="form-input" id="cc-bank" placeholder="e.g. HDFC Bank" />
        </div>
        <div class="form-group">
          <label class="form-label">Card network</label>
          <select class="form-select" id="cc-network">
            <option>Visa</option><option>Mastercard</option><option>Rupay</option><option>Amex</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Name on card</label>
          <input class="form-input" id="cc-name" placeholder="Cardholder name" />
        </div>
        <div class="form-group">
          <label class="form-label">Card type</label>
          <select class="form-select" id="cc-type">
            <option>Credit</option><option>Debit</option><option>Prepaid</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Card number</label>
          <input class="form-input" id="cc-number" maxlength="23" placeholder="xxxx xxxx xxxx xxxx" />
        </div>
        <div class="form-group">
          <label class="form-label">Expiry</label>
          <input class="form-input" id="cc-exp" type="month" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Last 4 digits</label>
          <input class="form-input" id="cc-last4" maxlength="4" placeholder="0000" />
        </div>
        <div class="form-group">
          <label class="form-label">Credit limit (₹)</label>
          <input class="form-input" id="cc-limit" type="number" placeholder="100000" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount used (₹)</label>
          <input class="form-input" id="cc-used" type="number" placeholder="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Min payment (₹)</label>
          <input class="form-input" id="cc-min" type="number" placeholder="0" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Due date</label>
        <input class="form-input" id="cc-due" type="date" />
      </div>`,
      [
        { label: 'Cancel', action: 'App.closeModal()', cls: 'btn-ghost' },
        { label: 'Add card', action: 'CreditCards.save()', cls: 'btn-primary' }
      ]
    );
  }

  function openEdit(id) {
    const c = Storage.get(Storage.KEYS.cards).find(x => x.id === id);
    if (!c) return;
    App.openModal('Edit card', `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Amount used (₹)</label><input class="form-input" id="cc-used-edit" type="number" value="${c.used}" /></div>
        <div class="form-group"><label class="form-label">Due date</label><input class="form-input" id="cc-due-edit" type="date" value="${c.dueDate||''}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Min payment (₹)</label><input class="form-input" id="cc-min-edit" type="number" value="${c.minPayment||0}" /></div>
      <input type="hidden" id="cc-edit-id" value="${id}" />`,
      [
        { label: 'Cancel', action: 'App.closeModal()', cls: 'btn-ghost' },
        { label: 'Save changes', action: 'CreditCards.saveEdit()', cls: 'btn-primary' }
      ]
    );
  }

  function save() {
    const bankName    = document.getElementById('cc-bank')?.value.trim();
    const network     = document.getElementById('cc-network')?.value;
    const nameOnCard  = document.getElementById('cc-name')?.value.trim() || '';
    const cardType    = document.getElementById('cc-type')?.value || '';
    const fullNumber  = (document.getElementById('cc-number')?.value || '').replace(/\s+/g, '');
    const last4Input  = document.getElementById('cc-last4')?.value.trim();
    const expDate     = document.getElementById('cc-exp')?.value || '';
    const limit       = document.getElementById('cc-limit')?.value;
    const used        = document.getElementById('cc-used')?.value || 0;
    const minPayment  = document.getElementById('cc-min')?.value || 0;
    const dueDate     = document.getElementById('cc-due')?.value;
    if (!bankName) { App.toast('Bank name required', 'error'); return; }
    const last4 = fullNumber ? (fullNumber.slice(-4)) : last4Input;
    Storage.push(Storage.KEYS.cards, { id: genId(), bankName, network, cardType, nameOnCard, fullNumber: fullNumber || null, last4, expDate, limit: Number(limit), used: Number(used), minPayment: Number(minPayment), dueDate });
    Storage.logActivity(`💳 Card added: ${bankName} •••• ${last4}`, '#c8922a');
    App.toast('Card added');
    App.closeModal();
    render();
    App.refreshDashboard();
  }

  function saveEdit() {
    const id         = document.getElementById('cc-edit-id')?.value;
    const used       = document.getElementById('cc-used-edit')?.value;
    const dueDate    = document.getElementById('cc-due-edit')?.value;
    const minPayment = document.getElementById('cc-min-edit')?.value;
    Storage.update(Storage.KEYS.cards, id, { used: Number(used), dueDate, minPayment: Number(minPayment) });
    App.toast('Card updated');
    App.closeModal();
    render();
    App.refreshDashboard();
  }

  function del(id) {
    if (!confirm('Remove this card?')) return;
    Storage.remove(Storage.KEYS.cards, id);
    App.toast('Card removed');
    render();
    App.refreshDashboard();
  }

  return { render, openAdd, openEdit, save, saveEdit, delete: del };
})();
