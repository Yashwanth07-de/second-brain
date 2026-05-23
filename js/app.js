/* ═══════════════════════════════════════════
   app.js — Main application controller
   Navigation, modal, dashboard, init, search
   Load this LAST after all other JS files
═══════════════════════════════════════════ */

const App = (() => {

  const SECTION_TITLES = {
    dashboard:   'Dashboard',
    notes:       'Notes',
    health:      'Health',
    finance:     'Finance',
    savings:     'Savings',
    bills:       'Bills',
    subscriptions:'Subscriptions',
    creditcards: 'Credit Cards',
    settings:    'Settings'
  };

  const ADD_ACTIONS = {
    notes:        'Notes.openAdd()',
    health:       'Health.openAddAppointment()',
    finance:      'Finance.openAdd()',
    savings:      'Savings.openAdd()',
    bills:        'Bills.openAdd()',
    subscriptions:'Subscriptions.openAdd()',
    creditcards:  'CreditCards.openAdd()',
    settings:     null,
    dashboard:    null
  };

  let currentSection = 'dashboard';
  let currentSession = null;

  function isMobileView() {
    return window.matchMedia('(max-width: 640px)').matches;
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('open');
    document.body.classList.toggle('sidebar-open', isOpen);
  }

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
  }

  /* ── Navigation ── */
  function navigate(section) {
    if (section === currentSection) return;
    currentSection = section;

    if (isMobileView()) closeSidebar();

    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Update sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('section-' + section);
    if (el) el.classList.add('active');

    // Update topbar
    document.getElementById('topbar-title').textContent = SECTION_TITLES[section] || section;

    // Render section
    renderSection(section);
  }

  function renderSection(section, search = '') {
    switch(section) {
      case 'dashboard':     refreshDashboard(); break;
      case 'notes':         Notes.render(search); break;
      case 'health':        Health.render(search); break;
      case 'finance':       Finance.render(search); break;
      case 'savings':       Savings.render(); break;
      case 'bills':         Bills.render(search); break;
      case 'subscriptions': Subscriptions.render(search); break;
      case 'creditcards':   CreditCards.render(search); break;
      case 'settings':      renderSettings(); break;
    }
  }

  /* ── Dashboard ── */
  function refreshDashboard() {
    renderDashStats();
    renderRecentActivity();
    Glance.generate();
  }

  function renderDashStats() {
    const notes = Storage.get(Storage.KEYS.notes).length;
    const bills = Storage.get(Storage.KEYS.bills).filter(b => b.status !== 'paid').length;
    const subs  = Storage.get(Storage.KEYS.subs).filter(s => s.status === 'active').length;
    const cards = Storage.get(Storage.KEYS.cards).length;
    const txns  = Storage.get(Storage.KEYS.transactions);
    const balance = txns.reduce((s, t) => t.type === 'income' ? s + Number(t.amount) : s - Number(t.amount), 0);

    document.getElementById('dash-stats').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Notes</div>
        <div class="stat-value blue">${notes}</div>
        <div class="stat-sub">saved</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Unpaid bills</div>
        <div class="stat-value ${bills>0?'red':'green'}">${bills}</div>
        <div class="stat-sub">${bills > 0 ? 'needs attention' : 'all clear'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Subscriptions</div>
        <div class="stat-value orange">${subs}</div>
        <div class="stat-sub">active</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Net balance</div>
        <div class="stat-value ${balance>=0?'green':'red'}">${formatCurrency(Math.abs(balance))}</div>
        <div class="stat-sub">${balance>=0?'surplus':'deficit'}</div>
      </div>`;
  }

  function renderRecentActivity() {
    const acts = Storage.get(Storage.KEYS.activity);
    const el   = document.getElementById('dash-recent-list');
    if (!el) return;
    if (!acts.length) {
      el.innerHTML = `<div class="empty-state" style="padding:20px 0"><span class="empty-state-text">No activity yet — start adding data!</span></div>`;
      return;
    }
    el.innerHTML = acts.slice(0, 8).map(a => `
      <div class="recent-item">
        <div class="recent-dot" style="background:${a.color}"></div>
        <span class="recent-text">${escHtml(a.text)}</span>
        <span class="recent-time">${a.time}</span>
      </div>`).join('');
  }

  function renderSettings() {
    if (!Storage.getUser()) {
      openAuthModal('Sign in to view your settings.');
      return;
    }

    const profile = Storage.getProfile() || {};
    const fullNameInput = document.getElementById('settings-full-name');
    const mobileInput = document.getElementById('settings-mobile');
    const emailInput = document.getElementById('settings-email');
    const summary = document.getElementById('settings-summary');

    if (fullNameInput) fullNameInput.value = profile.full_name || '';
    if (mobileInput) mobileInput.value = profile.mobile_number || '';
    if (emailInput) emailInput.value = profile.email || Storage.getUser()?.email || '';

    if (summary) {
      summary.innerHTML = `
        <div class="settings-summary-item"><strong>${escHtml(profile.full_name || 'Not set')}</strong><span>Name</span></div>
        <div class="settings-summary-item"><strong>${escHtml(profile.mobile_number || 'Not set')}</strong><span>Mobile</span></div>
        <div class="settings-summary-item"><strong>${escHtml(profile.email || Storage.getUser()?.email || 'Not set')}</strong><span>Email</span></div>
      `;
    }
  }

  /* ── Modal ── */
  function openModal(title, bodyHtml, buttons = []) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = buttons.map(b =>
      `<button class="btn ${b.cls}" onclick="${b.action}">${b.label}</button>`
    ).join('');
    document.getElementById('modal-overlay').classList.add('open');
    // Focus first input
    setTimeout(() => {
      const inp = document.getElementById('modal-body').querySelector('input, textarea, select');
      if (inp) inp.focus();
    }, 80);
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
  }

  function openAddModal() {
    if (!Storage.getUser()) {
      openAuthModal('Sign in first to add or edit your cloud data.');
      return;
    }
    const action = ADD_ACTIONS[currentSection];
    if (action) eval(action);
  }

  function updateAuthUI(session) {
    currentSession = session || null;
    const authBtn = document.getElementById('auth-btn');
    const signedIn = Boolean(session?.user);

    if (authBtn) authBtn.textContent = signedIn ? 'Logout' : 'Login';
  }

  function openAuthModal(message = '') {
    App.openModal('🧠 Second Brain', `
      <div class="form-hint" style="margin-bottom:12px">Sign in or create your account</div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="signin-email" type="email" placeholder="you@example.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-input" id="signin-password" type="password" placeholder="••••••••" />
      </div>
      <div class="form-hint">${escHtml(message || 'Use email/password to keep your data synced across devices.')}</div>
    `, [
      { label: 'Sign in', action: 'App.signIn()', cls: 'btn-ghost' },
      { label: 'Create account', action: 'App.openCreateAccountModal()', cls: 'btn-primary' }
    ]);
  }

  function openCreateAccountModal(message = '') {
    App.openModal('🧠 Create Account', `
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" id="signup-name" placeholder="Your full name" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="signup-email" type="email" placeholder="you@example.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-input" id="signup-password" type="password" placeholder="••••••••" />
      </div>
      <div class="form-hint">${escHtml(message || 'Use at least 6 characters for the password.')}</div>
    `, [
      { label: 'Back', action: 'App.openAuthModal()', cls: 'btn-ghost' },
      { label: 'Create account', action: 'App.signUp()', cls: 'btn-primary' }
    ]);
  }

  function getAuthClient() {
    const authClient = window.SB?.client;
    if (!authClient) {
      App.toast('Supabase client is not ready. Refresh and try again.', 'error');
      return null;
    }
    return authClient;
  }

  function getSignInCredentials() {
    const modalBody = document.getElementById('modal-body');
    const emailInput = modalBody?.querySelector('#signin-email');
    const passwordInput = modalBody?.querySelector('#signin-password');
    const email = (emailInput?.value || '').trim();
    const password = passwordInput?.value || '';
    return { email, password };
  }

  function getSignUpCredentials() {
    const modalBody = document.getElementById('modal-body');
    const nameInput = modalBody?.querySelector('#signup-name');
    const emailInput = modalBody?.querySelector('#signup-email');
    const passwordInput = modalBody?.querySelector('#signup-password');
    const fullName = (nameInput?.value || '').trim();
    const email = (emailInput?.value || '').trim();
    const password = passwordInput?.value || '';
    return { fullName, email, password };
  }

  async function signIn() {
    const authClient = getAuthClient();
    if (!authClient) return;
    const { email, password } = getSignInCredentials();
    if (!email || !password) { App.toast('Email and password are required', 'error'); return; }

    const { error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) { App.toast(error.message, 'error'); return; }
    App.toast('Signed in successfully');
    App.closeModal();
  }

  async function signUp() {
    const authClient = getAuthClient();
    if (!authClient) return;
    const { fullName, email, password } = getSignUpCredentials();
    if (!fullName || !email || !password) { App.toast('Name, email and password are required', 'error'); return; }
    if (password.length < 6) { App.toast('Password must be at least 6 characters', 'error'); return; }

    const { error } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (error) { App.toast(error.message, 'error'); return; }
    App.toast('Account created. Verification email sent. Please confirm your email.', 'success');
    openAuthModal('Account created. Now sign in with your email and password.');
  }

  async function signOut() {
    const authClient = getAuthClient();
    if (!authClient) return;
    const { error } = await authClient.auth.signOut();
    if (error) { App.toast(error.message, 'error'); return; }
    App.toast('Signed out');
  }

  function handleAuthButton() {
    if (Storage.getUser()) {
      void signOut();
      return;
    }
    openAuthModal();
  }

  function syncAuthState(session) {
    updateAuthUI(session);
    if (session?.user) {
      App.closeModal();
      refreshDashboard();
      renderSection(currentSection);
    } else {
      openAuthModal();
    }
  }

  async function saveProfile() {
    const authClient = getAuthClient();
    if (!authClient || !Storage.getUser()) return;

    const fullName = document.getElementById('settings-full-name')?.value.trim();
    const mobileNumber = document.getElementById('settings-mobile')?.value.trim();

    const { error } = await Storage.updateProfile({
      full_name: fullName,
      mobile_number: mobileNumber,
    });

    if (error) {
      App.toast(error.message || 'Could not save profile', 'error');
      return;
    }

    App.toast('Profile updated successfully', 'success');
    renderSettings();
  }

  async function changePassword() {
    const authClient = getAuthClient();
    if (!authClient || !Storage.getUser()) return;

    const password = document.getElementById('settings-password')?.value || '';
    const confirmPassword = document.getElementById('settings-password-confirm')?.value || '';

    if (!password || !confirmPassword) {
      App.toast('Enter and confirm the new password', 'error');
      return;
    }

    if (password.length < 6) {
      App.toast('Password must be at least 6 characters', 'error');
      return;
    }

    if (password !== confirmPassword) {
      App.toast('Passwords do not match', 'error');
      return;
    }

    const { error } = await authClient.auth.updateUser({ password });
    if (error) {
      App.toast(error.message, 'error');
      return;
    }

    document.getElementById('settings-password').value = '';
    document.getElementById('settings-password-confirm').value = '';
    App.toast('Password changed successfully', 'success');
  }

  /* ── Toast ── */
  let toastTimer;
  function toast(msg, type = 'default') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className   = 'toast show ' + (type !== 'default' ? type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.className = 'toast', 300);
    }, 2800);
  }

  /* ── Search ── */
  let searchTimer;
  function handleSearch(e) {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    searchTimer = setTimeout(() => renderSection(currentSection, q), 200);
  }

  /* ── Theme ── */
  function toggleTheme() {
    const html  = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('sb-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-icon-dark').style.display  = isDark ? 'none' : '';
    document.getElementById('theme-icon-light').style.display = isDark ? '' : 'none';
  }

  /* ── Init ── */
  async function init() {
    // Cursor
    Cursor.init();

    // Restore theme
    const savedTheme = localStorage.getItem('sb-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (savedTheme === 'light') {
      document.getElementById('theme-icon-dark').style.display  = 'none';
      document.getElementById('theme-icon-light').style.display = '';
    }

    // Set date in topbar
    document.getElementById('topbar-date').textContent =
      new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    // Nav item click listeners
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.section));
    });

    // Mobile menu toggle
    document.getElementById('mobile-menu-toggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('mobile-fab-menu')?.addEventListener('click', toggleSidebar);

    // Close mobile sidebar when tapping outside it
    document.addEventListener('click', e => {
      if (!isMobileView()) return;
      const sidebar = document.getElementById('sidebar');
      if (!sidebar?.classList.contains('open')) return;
      const clickedInsideSidebar = sidebar.contains(e.target);
      const clickedMenuButton = document.getElementById('mobile-menu-toggle')?.contains(e.target);
      if (!clickedInsideSidebar && !clickedMenuButton) closeSidebar();
    });

    // Ensure sidebar state resets when returning to larger screens
    window.addEventListener('resize', () => {
      if (!isMobileView()) closeSidebar();
    });

    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

    // Search
    document.getElementById('global-search')?.addEventListener('input', handleSearch);

    // Close modal on overlay click
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') closeModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        openAddModal();
      }
    });

    // Notes filter pills
    Notes.init();

    // Wait for Supabase session + data
    await Storage.init();
    Storage.onAuthChange(syncAuthState);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { navigate, refreshDashboard, openModal, closeModal, openAddModal, toast, openAuthModal, openCreateAccountModal, handleAuthButton, signIn, signUp, signOut, updateAuthUI, saveProfile, changePassword };
})();
