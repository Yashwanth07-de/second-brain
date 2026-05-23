/* ═══════════════════════════════════════════
   health.js — Health section
   Appointments + Medications tracking
═══════════════════════════════════════════ */

const Health = (() => {

  function render(search = '') {
    renderAppointments(search);
    renderMedications(search);
    updateBadge();
  }

  function renderAppointments(search = '') {
    let items = Storage.get(Storage.KEYS.appointments);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(a => (a.title + a.doctor + a.notes).toLowerCase().includes(q));
    }
    items.sort((a, b) => new Date(a.date) - new Date(b.date));
    const el = document.getElementById('appointments-list');
    if (!el) return;
    if (!items.length) {
      el.innerHTML = `<div class="empty-state"><span class="empty-state-icon">🏥</span><div class="empty-state-text">No appointments</div></div>`;
      return;
    }
    el.innerHTML = items.map(a => {
      const d = new Date(a.date);
      const day = d.getDate();
      const mon = d.toLocaleString('en-IN', { month: 'short' });
      const delta = daysUntil(a.date);
      const upcoming = delta !== null && delta >= 0 && delta <= 2;
      return `
        <div class="appointment-card ${upcoming ? 'highlight' : ''}">
          <div class="appointment-date-block">
            <div class="appt-day">${day}</div>
            <div class="appt-mon">${mon}</div>
          </div>
          <div class="appointment-details">
            <div class="appt-title">${escHtml(a.title)}</div>
            <div class="appt-doctor">${escHtml(a.doctor || '')}</div>
            <div class="appt-time">${a.time || ''} ${a.location ? '· ' + a.location : ''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            ${upcoming ? `<span class="badge badge-soon">Soon</span>` : ''}
            <button class="btn btn-xs btn-danger" onclick="Health.deleteAppt('${a.id}')">Del</button>
          </div>
        </div>`;
    }).join('');
  }

  function renderMedications(search = '') {
    let items = Storage.get(Storage.KEYS.medications);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(m => (m.name + m.dosage + m.frequency).toLowerCase().includes(q));
    }
    const el = document.getElementById('meds-list');
    if (!el) return;
    if (!items.length) {
      el.innerHTML = `<div class="empty-state"><span class="empty-state-icon">💊</span><div class="empty-state-text">No medications tracked</div></div>`;
      return;
    }
    el.innerHTML = items.map(m => `
      <div class="list-item">
        <div class="list-item-icon" style="background:var(--blue-muted)">💊</div>
        <div class="list-item-main">
          <div class="list-item-name">${escHtml(m.name)}</div>
          <div class="list-item-sub">${escHtml(m.dosage)} · ${escHtml(m.frequency)}</div>
        </div>
        <div class="list-item-right">
          <span class="badge badge-active">Active</span>
          <div class="list-item-actions">
            <button class="btn btn-xs btn-danger" onclick="Health.deleteMed('${m.id}')">Del</button>
          </div>
        </div>
      </div>`).join('');
  }

  function updateBadge() {
    const appts = Storage.get(Storage.KEYS.appointments);
    const upcoming = appts.filter(a => {
      const d = daysUntil(a.date);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    const badge = document.getElementById('badge-health');
    if (badge) { badge.textContent = upcoming; badge.style.display = upcoming ? '' : 'none'; }
  }

  function openAddAppointment() {
    App.openModal('New appointment', `
      <div class="form-group">
        <label class="form-label">Title / Reason</label>
        <input class="form-input" id="appt-title" placeholder="e.g. General checkup" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Doctor / Hospital</label>
          <input class="form-input" id="appt-doctor" placeholder="Dr. Name / Hospital" />
        </div>
        <div class="form-group">
          <label class="form-label">Location</label>
          <input class="form-input" id="appt-location" placeholder="Clinic / Hospital" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input class="form-input" id="appt-date" type="date" value="${todayISO()}" />
        </div>
        <div class="form-group">
          <label class="form-label">Time</label>
          <input class="form-input" id="appt-time" type="time" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="appt-notes" placeholder="Any notes…" style="min-height:60px"></textarea>
      </div>`,
      [
        { label: 'Cancel', action: 'App.closeModal()', cls: 'btn-ghost' },
        { label: 'Save appointment', action: 'Health.saveAppt()', cls: 'btn-primary' }
      ]
    );
  }

  function saveAppt() {
    const title    = document.getElementById('appt-title')?.value.trim();
    const doctor   = document.getElementById('appt-doctor')?.value.trim();
    const location = document.getElementById('appt-location')?.value.trim();
    const date     = document.getElementById('appt-date')?.value;
    const time     = document.getElementById('appt-time')?.value;
    const notes    = document.getElementById('appt-notes')?.value.trim();
    if (!title || !date) { App.toast('Title and date are required', 'error'); return; }
    Storage.push(Storage.KEYS.appointments, { id: genId(), title, doctor, location, date, time, notes });
    Storage.logActivity(`🏥 Appointment: ${title} on ${date}`, '#5b8df6');
    App.toast('Appointment saved');
    App.closeModal();
    render();
    App.refreshDashboard();
  }

  function openAddMed() {
    App.openModal('Add medication', `
      <div class="form-group">
        <label class="form-label">Medication name</label>
        <input class="form-input" id="med-name" placeholder="e.g. Vitamin D3" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Dosage</label>
          <input class="form-input" id="med-dosage" placeholder="e.g. 500mg" />
        </div>
        <div class="form-group">
          <label class="form-label">Frequency</label>
          <select class="form-select" id="med-frequency">
            <option>Once daily</option><option>Twice daily</option><option>Three times daily</option>
            <option>Weekly</option><option>As needed</option>
          </select>
        </div>
      </div>`,
      [
        { label: 'Cancel', action: 'App.closeModal()', cls: 'btn-ghost' },
        { label: 'Save medication', action: 'Health.saveMed()', cls: 'btn-primary' }
      ]
    );
  }

  function saveMed() {
    const name      = document.getElementById('med-name')?.value.trim();
    const dosage    = document.getElementById('med-dosage')?.value.trim();
    const frequency = document.getElementById('med-frequency')?.value;
    if (!name) { App.toast('Medication name required', 'error'); return; }
    Storage.push(Storage.KEYS.medications, { id: genId(), name, dosage, frequency });
    App.toast('Medication added');
    App.closeModal();
    render();
  }

  function deleteAppt(id) {
    Storage.remove(Storage.KEYS.appointments, id);
    App.toast('Appointment removed');
    render();
    App.refreshDashboard();
  }

  function deleteMed(id) {
    Storage.remove(Storage.KEYS.medications, id);
    App.toast('Medication removed');
    render();
  }

  return { render, openAddAppointment, saveAppt, openAddMed, saveMed, deleteAppt, deleteMed };
})();
