/* ═══════════════════════════════════════════
   notes.js — Notes section
   CRUD, tag filtering, search, render
═══════════════════════════════════════════ */

const Notes = (() => {
  let activeFilter = 'all';

  function init() {
    // Tag pill filter listeners
    document.querySelectorAll('#notes-filter-pills .tag-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#notes-filter-pills .tag-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeFilter = pill.dataset.filter;
        render();
      });
    });
  }

  function getFiltered(search = '') {
    let items = Storage.get(Storage.KEYS.notes);
    if (activeFilter !== 'all') items = items.filter(n => n.tag === activeFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(n =>
        (n.title + ' ' + n.body + ' ' + n.tag).toLowerCase().includes(q)
      );
    }
    return items;
  }

  function render(search = '') {
    const grid = document.getElementById('notes-grid');
    if (!grid) return;
    const items = getFiltered(search);
    grid.innerHTML = '';

    if (!items.length) {
      grid.innerHTML = `<div style="grid-column:1/-1">
        <div class="empty-state">
          <span class="empty-state-icon">📝</span>
          <div class="empty-state-text">No notes yet</div>
          <div class="empty-state-sub">Click "Add new" to create your first note</div>
        </div>
      </div>`;
    }

    items.forEach(n => {
      const card = document.createElement('div');
      card.className = 'note-card animate-fadeUp';
      card.innerHTML = `
        <span class="note-card-tag tag-${n.tag}">${n.tag}</span>
        <div class="note-card-title">${escHtml(n.title || 'Untitled')}</div>
        <div class="note-card-preview">${escHtml(n.body)}</div>
        <div class="note-card-footer">
          <span class="note-card-date">${n.date}</span>
          <div class="note-card-actions">
            <button class="btn btn-xs btn-ghost" onclick="Notes.openEdit('${n.id}');event.stopPropagation()">Edit</button>
            <button class="btn btn-xs btn-danger" onclick="Notes.delete('${n.id}');event.stopPropagation()">Del</button>
          </div>
        </div>`;
      card.addEventListener('click', () => openEdit(n.id));
      grid.appendChild(card);
    });

    // Add card
    const add = document.createElement('div');
    add.className = 'note-add-card';
    add.innerHTML = `<div class="note-add-icon">+</div><span>New note</span>`;
    add.onclick = () => openAdd();
    grid.appendChild(add);

    // Update badge
    const allNotes = Storage.get(Storage.KEYS.notes);
    const badge = document.getElementById('badge-notes');
    if (badge) badge.textContent = allNotes.length;
  }

  function openAdd() {
    App.openModal('New note', `
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" id="note-title" placeholder="Note title…" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tag</label>
          <select class="form-select" id="note-tag">
            <option>Work</option><option>Ideas</option><option>Personal</option><option>Learning</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Content</label>
        <textarea class="form-textarea" id="note-body" placeholder="Write anything… mention 'today', 'must', 'deadline' to show in daily glance"></textarea>
      </div>`,
      [
        { label: 'Cancel', action: 'App.closeModal()', cls: 'btn-ghost' },
        { label: 'Save note', action: 'Notes.save()', cls: 'btn-primary' }
      ]
    );
  }

  function openEdit(id) {
    const n = Storage.get(Storage.KEYS.notes).find(x => x.id === id);
    if (!n) return;
    App.openModal('Edit note', `
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" id="note-title" value="${escHtml(n.title)}" placeholder="Note title…" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tag</label>
          <select class="form-select" id="note-tag">
            <option ${n.tag==='Work'?'selected':''}>Work</option>
            <option ${n.tag==='Ideas'?'selected':''}>Ideas</option>
            <option ${n.tag==='Personal'?'selected':''}>Personal</option>
            <option ${n.tag==='Learning'?'selected':''}>Learning</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Content</label>
        <textarea class="form-textarea" id="note-body">${escHtml(n.body)}</textarea>
      </div>
      <input type="hidden" id="note-edit-id" value="${n.id}" />`,
      [
        { label: 'Cancel', action: 'App.closeModal()', cls: 'btn-ghost' },
        { label: 'Save changes', action: 'Notes.save()', cls: 'btn-primary' }
      ]
    );
  }

  function save() {
    const id    = document.getElementById('note-edit-id')?.value;
    const title = document.getElementById('note-title')?.value.trim();
    const body  = document.getElementById('note-body')?.value.trim();
    const tag   = document.getElementById('note-tag')?.value;
    if (!title && !body) { App.toast('Please add a title or content', 'error'); return; }

    if (id) {
      Storage.update(Storage.KEYS.notes, id, { title, body, tag, date: todayStr() });
      App.toast('Note updated');
    } else {
      Storage.push(Storage.KEYS.notes, { id: genId(), title, body, tag, date: todayStr(), created: new Date().toISOString() });
      Storage.logActivity(`Added note: ${title || 'Untitled'}`, '#5b8df6');
      App.toast('Note saved');
    }
    App.closeModal();
    render();
    App.refreshDashboard();
  }

  function del(id) {
    if (!confirm('Delete this note?')) return;
    Storage.remove(Storage.KEYS.notes, id);
    App.toast('Note deleted');
    render();
    App.refreshDashboard();
  }

  return { init, render, openAdd, openEdit, save, delete: del };
})();
