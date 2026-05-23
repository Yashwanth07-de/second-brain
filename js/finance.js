/* ═══════════════════════════════════════════
   finance.js — Finance section
   Income/expense tracking, categories, totals
═══════════════════════════════════════════ */

const Finance = (() => {
  const CATEGORIES = {
    income: ['Salary','Freelance','Investment','Business','Gift','Other Income'],
    expense: ['Food','Rent','Transport','Utilities','Healthcare','Entertainment','Shopping','Education','Other']
  };

  const ICONS = {
    'Salary':'💼','Freelance':'💻','Investment':'📈','Business':'🏢','Gift':'🎁','Other Income':'💰',
    'Food':'🍔','Rent':'🏠','Transport':'🚗','Utilities':'💡','Healthcare':'🏥','Entertainment':'🎬',
    'Shopping':'🛍️','Education':'📚','Other':'📌'
  };

  function render(search = '') {
    renderStats();
    renderTransactions(search);
    renderCategories();
  }

  function renderStats() {
    const txns = Storage.get(Storage.KEYS.transactions);
    const income  = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const balance = income - expense;
    document.getElementById('finance-stats').innerHTML = `
      <div class="stat-card"><div class="stat-label">Total income</div><div class="stat-value green">${formatCurrency(income)}</div><div class="stat-sub">all time</div></div>
      <div class="stat-card"><div class="stat-label">Total expenses</div><div class="stat-value red">${formatCurrency(expense)}</div><div class="stat-sub">all time</div></div>
      <div class="stat-card"><div class="stat-label">Balance</div><div class="stat-value ${balance >= 0 ? 'green' : 'red'}">${formatCurrency(balance)}</div><div class="stat-sub">net</div></div>`;
  }

  function renderTransactions(search = '') {
    let txns = Storage.get(Storage.KEYS.transactions);
    if (search) {
      const q = search.toLowerCase();
      txns = txns.filter(t => (t.note + t.category + t.type).toLowerCase().includes(q));
    }
    const el = document.getElementById('transactions-list');
    if (!el) return;
    if (!txns.length) {
      el.innerHTML = `<div class="empty-state"><span class="empty-state-icon">💸</span><div class="empty-state-text">No transactions yet</div></div>`;
      return;
    }
    el.innerHTML = txns.slice(0, 15).map(t => `
      <div class="list-item">
        <div class="list-item-icon" style="background:${t.type==='income'?'var(--green-muted)':'var(--red-muted)'}">${ICONS[t.category] || '💰'}</div>
        <div class="list-item-main">
          <div class="list-item-name">${escHtml(t.note || t.category)}</div>
          <div class="list-item-sub">${escHtml(t.category)} · ${t.date}</div>
        </div>
        <div class="list-item-right">
          <div class="list-item-amount ${t.type}">${t.type==='income'?'+':'−'}${formatCurrency(t.amount)}</div>
          <div class="list-item-actions">
            <button class="btn btn-xs btn-danger" onclick="Finance.delete('${t.id}')">Del</button>
          </div>
        </div>
      </div>`).join('');
  }

  function renderCategories() {
    const txns = Storage.get(Storage.KEYS.transactions).filter(t => t.type === 'expense');
    const totals = {};
    txns.forEach(t => { totals[t.category] = (totals[t.category] || 0) + Number(t.amount); });
    const sorted = Object.entries(totals).sort((a,b) => b[1]-a[1]);
    const max = sorted[0]?.[1] || 1;
    const el = document.getElementById('finance-categories');
    if (!el) return;
    if (!sorted.length) {
      el.innerHTML = `<div class="empty-state"><span class="empty-state-icon">📊</span><div class="empty-state-text">No expense data yet</div></div>`;
      return;
    }
    el.innerHTML = sorted.map(([cat, amt]) => `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="color:var(--text-secondary)">${ICONS[cat]||''} ${escHtml(cat)}</span>
          <span style="color:var(--text-primary);font-weight:600">${formatCurrency(amt)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${(amt/max*100).toFixed(1)}%;background:var(--red)"></div></div>
      </div>`).join('');
  }

  function openAdd() {
    App.openModal('Add transaction', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-select" id="txn-type" onchange="Finance.updateCategories()">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Amount (₹)</label>
          <input class="form-input" id="txn-amount" type="number" placeholder="0" min="0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-select" id="txn-category">
            ${CATEGORIES.expense.map(c => `<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input class="form-input" id="txn-date" type="date" value="${todayISO()}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Note</label>
        <input class="form-input" id="txn-note" placeholder="Description (optional)" />
      </div>`,
      [
        { label: 'Cancel', action: 'App.closeModal()', cls: 'btn-ghost' },
        { label: 'Add transaction', action: 'Finance.save()', cls: 'btn-primary' }
      ]
    );
  }

  function updateCategories() {
    const type = document.getElementById('txn-type')?.value;
    const sel  = document.getElementById('txn-category');
    if (!sel || !type) return;
    sel.innerHTML = CATEGORIES[type].map(c => `<option>${c}</option>`).join('');
  }

  function save() {
    const type     = document.getElementById('txn-type')?.value;
    const amount   = document.getElementById('txn-amount')?.value;
    const category = document.getElementById('txn-category')?.value;
    const date     = document.getElementById('txn-date')?.value || todayISO();
    const note     = document.getElementById('txn-note')?.value.trim();
    if (!amount || isNaN(amount) || Number(amount) <= 0) { App.toast('Enter a valid amount', 'error'); return; }
    Storage.push(Storage.KEYS.transactions, { id: genId(), type, amount: Number(amount), category, date, note, created: new Date().toISOString() });
    Storage.logActivity(`${type === 'income' ? '💰' : '💸'} ${type}: ${formatCurrency(amount)} (${category})`, type === 'income' ? '#4caf72' : '#e05555');
    App.toast('Transaction added');
    App.closeModal();
    render();
    App.refreshDashboard();
  }

  function del(id) {
    Storage.remove(Storage.KEYS.transactions, id);
    App.toast('Transaction removed');
    render();
    App.refreshDashboard();
  }

  return { render, openAdd, save, updateCategories, delete: del };
})();
