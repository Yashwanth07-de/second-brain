/* ═══════════════════════════════════════════
   storage.js — Supabase-backed app state
   Keeps the existing Storage API, but syncs to the cloud.
═══════════════════════════════════════════ */

const Storage = (() => {
  const KEYS = {
    notes: 'notes',
    transactions: 'transactions',
    savings: 'savings',
    bills: 'bills',
    subs: 'subs',
    cards: 'cards',
    appointments: 'appointments',
    medications: 'medications',
    activity: 'activity',
  };

  const TABLES = {
    profiles: 'profiles',
    notes: 'notes',
    transactions: 'transactions',
    savings: 'savings',
    bills: 'bills',
    subs: 'subscriptions',
    cards: 'creditcards',
    appointments: 'appointments',
    medications: 'medications',
    activity: 'activity',
  };

  const LEGACY = {
    notes: 'sb_notes',
    transactions: 'sb_transactions',
    savings: 'sb_savings',
    bills: 'sb_bills',
    subs: 'sb_subscriptions',
    cards: 'sb_creditcards',
    appointments: 'sb_appointments',
    medications: 'sb_medications',
    activity: 'sb_activity',
  };
  const cache = Object.fromEntries(Object.keys(KEYS).map(key => [key, []]));

  let ready = false;
  let currentSession = null;
  let currentUser = null;
  let authSubscription = null;
  const authListeners = [];

  function client() {
    return window.SB?.client || null;
  }

  function table(key) {
    return TABLES[key];
  }

  function notifyAuth() {
    authListeners.forEach(cb => {
      try { cb(currentSession); } catch (err) { console.error(err); }
    });
  }

  function cloneItems(items) {
    return items.map(item => ({ ...item }));
  }

  function readLegacy(key) {
    try { return JSON.parse(localStorage.getItem(LEGACY[key]) || '[]'); }
    catch (err) { return []; }
  }

  function clearLegacy() {
    Object.values(LEGACY).forEach(name => localStorage.removeItem(name));
  }

  function parseAppointmentNotes(notesText = '') {
    const lines = String(notesText || '').split('\n');
    let location = '';
    const remainder = [];

    lines.forEach(line => {
      if (!location && /^location:\s*/i.test(line)) {
        location = line.replace(/^location:\s*/i, '').trim();
      } else {
        remainder.push(line);
      }
    });

    return { location, notes: remainder.join('\n').trim() };
  }

  function appointmentNotes(location, notes) {
    const parts = [];
    if (location) parts.push(`Location: ${location}`);
    if (notes) parts.push(notes);
    return parts.join('\n').trim();
  }

  function toDbRow(key, item) {
    const userId = currentUser?.id;
    if (!userId) return null;
    const safeId = ensureUuid(item.id);

    switch (key) {
      case 'notes':
        return {
          id: safeId,
          user_id: userId,
          title: item.title ?? '',
          body: item.body ?? '',
          tag: item.tag ?? '',
          note_date: item.date ?? todayStr(),
        };
      case 'transactions':
        return {
          id: safeId,
          user_id: userId,
          txn_type: item.type ?? 'expense',
          category: item.category ?? '',
          amount: Number(item.amount ?? 0),
          txn_date: item.date ?? todayISO(),
          note: item.note ?? '',
        };
      case 'savings':
        return {
          id: safeId,
          user_id: userId,
          name: item.name ?? '',
          target: Number(item.target ?? 0),
          saved: Number(item.saved ?? 0),
          icon: item.icon ?? '🎯',
        };
      case 'bills':
        return {
          id: safeId,
          user_id: userId,
          name: item.name ?? '',
          category: item.category ?? '',
          amount: Number(item.amount ?? 0),
          due_date: item.dueDate || null,
          status: item.status ?? 'unpaid',
        };
      case 'subs':
        return {
          id: safeId,
          user_id: userId,
          name: item.name ?? '',
          category: item.category ?? '',
          amount: Number(item.amount ?? 0),
          billing: item.billing ?? 'monthly',
          renewal_date: item.renewalDate || null,
          status: item.status ?? 'active',
        };
      case 'cards':
        return {
          id: safeId,
          user_id: userId,
          name: item.bankName ?? '',
          bank: item.bankName ?? '',
          last4: item.last4 ?? '',
          credit_limit: Number(item.limit ?? 0),
          due_date: item.dueDate || null,
          balance: Number(item.used ?? 0),
          min_payment: Number(item.minPayment ?? 0),
          network: item.network ?? 'Visa',
        };
      case 'appointments': {
        const noteText = appointmentNotes(item.location ?? '', item.notes ?? '');
        return {
          id: safeId,
          user_id: userId,
          title: item.title ?? '',
          appt_date: item.date || null,
          appt_time: item.time ?? '',
          doctor: item.doctor ?? '',
          notes: noteText,
        };
      }
      case 'medications':
        return {
          id: safeId,
          user_id: userId,
          name: item.name ?? '',
          dosage: item.dosage ?? '',
          frequency: item.frequency ?? '',
          notes: item.notes ?? '',
        };
      case 'activity':
        return {
          id: safeId,
          user_id: userId,
          text: item.text ?? '',
          color: item.color ?? '#c8922a',
          activity_time: item.time ?? '',
        };
      default:
        return null;
    }
  }

  function fromDbRow(key, row) {
    switch (key) {
      case 'profiles':
        return {
          id: row.id,
          full_name: row.full_name ?? '',
          email: row.email ?? '',
          mobile_number: row.mobile_number ?? '',
          avatar_url: row.avatar_url ?? '',
          created_at: row.created_at ?? '',
          updated_at: row.updated_at ?? '',
        };
      case 'notes':
        return {
          id: row.id,
          title: row.title ?? '',
          body: row.body ?? '',
          tag: row.tag ?? '',
          date: row.note_date ?? todayStr(),
        };
      case 'transactions':
        return {
          id: row.id,
          type: row.txn_type ?? 'expense',
          category: row.category ?? '',
          amount: Number(row.amount ?? 0),
          date: row.txn_date ?? todayISO(),
          note: row.note ?? '',
          created: row.created_at ?? new Date().toISOString(),
        };
      case 'savings':
        return {
          id: row.id,
          name: row.name ?? '',
          target: Number(row.target ?? 0),
          saved: Number(row.saved ?? 0),
          icon: row.icon ?? '🎯',
        };
      case 'bills':
        return {
          id: row.id,
          name: row.name ?? '',
          category: row.category ?? '',
          amount: Number(row.amount ?? 0),
          dueDate: row.due_date ?? '',
          status: row.status ?? 'unpaid',
        };
      case 'subs':
        return {
          id: row.id,
          name: row.name ?? '',
          category: row.category ?? '',
          amount: Number(row.amount ?? 0),
          billing: row.billing ?? 'monthly',
          renewalDate: row.renewal_date ?? '',
          status: row.status ?? 'active',
        };
      case 'cards':
        return {
          id: row.id,
          bankName: row.bank ?? row.name ?? '',
          network: row.network ?? 'Visa',
          last4: row.last4 ?? '',
          limit: Number(row.credit_limit ?? 0),
          used: Number(row.balance ?? 0),
          minPayment: Number(row.min_payment ?? row.balance ?? 0),
          dueDate: row.due_date ?? '',
        };
      case 'appointments': {
        const parsed = parseAppointmentNotes(row.notes ?? '');
        return {
          id: row.id,
          title: row.title ?? '',
          doctor: row.doctor ?? '',
          location: parsed.location,
          date: row.appt_date ?? '',
          time: row.appt_time ?? '',
          notes: parsed.notes,
        };
      }
      case 'medications':
        return {
          id: row.id,
          name: row.name ?? '',
          dosage: row.dosage ?? '',
          frequency: row.frequency ?? '',
          notes: row.notes ?? '',
        };
      case 'activity':
        return {
          id: row.id,
          text: row.text ?? '',
          color: row.color ?? '#c8922a',
          time: row.activity_time ?? '',
          date: row.created_at ?? new Date().toISOString(),
        };
      default:
        return row;
    }
  }

  async function loadTable(key) {
    const db = client();
    const userId = currentUser?.id;
    if (!db || !userId) {
      cache[key] = [];
      return [];
    }

    const { data, error } = await db
      .from(table(key))
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Failed to load ${key}`, error);
      cache[key] = [];
      return [];
    }

    cache[key] = (data || []).map(row => fromDbRow(key, row));
    return cache[key];
  }

  async function loadAll() {
    await Promise.all(Object.keys(TABLES).map(key => loadTable(key)));
  }

  async function loadProfile() {
    const db = client();
    const userId = currentUser?.id;
    if (!db || !userId) {
      cache.profiles = [];
      return null;
    }

    const { data, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile', error);
      cache.profiles = [];
      return null;
    }

    cache.profiles = data ? [fromDbRow('profiles', data)] : [];
    return cache.profiles[0] || null;
  }

  async function ensureProfile() {
    const db = client();
    if (!db || !currentUser) return;

    const user = currentUser;
    const profileRow = {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      email: user.email || '',
      mobile_number: user.user_metadata?.mobile_number || user.user_metadata?.phone || '',
      avatar_url: user.user_metadata?.avatar_url || '',
    };

    const error = await upsertWithSchemaFallback('profiles', profileRow);
    if (error) console.error('Failed to sync profile', error);
    await loadProfile();
  }

  function getProfile() {
    const cached = cache.profiles?.[0];
    if (cached) {
      const user = currentUser || {};
      return {
        ...cached,
        full_name: cached.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '',
        email: cached.email || user.email || '',
        mobile_number: cached.mobile_number || user.user_metadata?.mobile_number || user.user_metadata?.phone || '',
        avatar_url: cached.avatar_url || user.user_metadata?.avatar_url || '',
      };
    }
    const user = currentUser;
    if (!user) return null;
    return {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      email: user.email || '',
      mobile_number: user.user_metadata?.mobile_number || user.user_metadata?.phone || '',
      avatar_url: user.user_metadata?.avatar_url || '',
    };
  }

  async function updateProfile(updates) {
    const db = client();
    if (!db || !currentUser) return { error: new Error('Not signed in') };

    const existing = getProfile() || {};
    const profileRow = {
      id: currentUser.id,
      full_name: updates.full_name ?? existing.full_name ?? '',
      email: currentUser.email || existing.email || '',
      mobile_number: updates.mobile_number ?? existing.mobile_number ?? '',
      avatar_url: existing.avatar_url || currentUser.user_metadata?.avatar_url || '',
    };

    const error = await upsertWithSchemaFallback('profiles', profileRow);
    if (error) return { error };

    const authPayload = {
      data: {
        full_name: profileRow.full_name,
        mobile_number: profileRow.mobile_number,
      }
    };

    const { error: authError } = await db.auth.updateUser(authPayload);
    if (authError) console.error('Failed to update auth metadata', authError);

    await loadProfile();
    return { error: null, data: getProfile() };
  }

  async function upsertRow(key, item) {
    const db = client();
    if (!db || !currentUser) return;

    let row = toDbRow(key, item);
    if (!row) return;

    const error = await upsertWithSchemaFallback(table(key), row);
    if (error) console.error(`Failed to sync ${key}`, error);
  }

  async function deleteRow(key, id) {
    const db = client();
    if (!db || !currentUser) return;
    const { error } = await db.from(table(key)).delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) console.error(`Failed to delete ${key}`, error);
  }

  async function replaceRows(key, items) {
    const db = client();
    if (!db || !currentUser) return;

    const tableName = table(key);
    const { error: deleteError } = await db.from(tableName).delete().eq('user_id', currentUser.id);
    if (deleteError) {
      console.error(`Failed to clear ${key}`, deleteError);
      return;
    }

    if (!items.length) return;

    const rows = items.map(item => toDbRow(key, item)).filter(Boolean);
    const error = await insertWithSchemaFallback(tableName, rows);
    if (error) console.error(`Failed to replace ${key}`, error);
  }

  function parseMissingColumn(error) {
    const msg = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    const hint = String(error?.hint || '').toLowerCase();
    const source = `${msg} ${details} ${hint}`;

    const patterns = [
      /could not find the '([a-z0-9_]+)' column/,
      /column ['"]?([a-z0-9_]+)['"]? does not exist/,
      /column ([a-z0-9_]+) does not exist/,
      /unknown column ['"]?([a-z0-9_]+)['"]?/
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  async function upsertWithSchemaFallback(tableName, row) {
    const db = client();
    let payload = { ...row };

    for (let i = 0; i < 10; i += 1) {
      const { error } = await db.from(tableName).upsert(payload, { onConflict: 'id' });
      if (!error) return null;

      const missingCol = parseMissingColumn(error);
      if (!missingCol || !(missingCol in payload)) {
        return error;
      }

      const { [missingCol]: _removed, ...nextPayload } = payload;
      payload = nextPayload;
    }

    return { message: `Too many schema fallback retries for ${tableName}` };
  }

  async function insertWithSchemaFallback(tableName, rows) {
    const db = client();
    let payload = rows.map(row => ({ ...row }));

    for (let i = 0; i < 10; i += 1) {
      const { error } = await db.from(tableName).insert(payload);
      if (!error) return null;

      const missingCol = parseMissingColumn(error);
      if (!missingCol) {
        return error;
      }

      let removedAny = false;
      payload = payload.map(row => {
        if (!(missingCol in row)) return row;
        removedAny = true;
        const { [missingCol]: _removed, ...next } = row;
        return next;
      });

      if (!removedAny) {
        return error;
      }
    }

    return { message: `Too many schema fallback retries for ${tableName}` };
  }

  async function migrateLegacyData() {
    const db = client();
    if (!db || !currentUser) return;

    let migratedAny = false;

    for (const key of Object.keys(TABLES)) {
      if (cache[key].length) continue;
      const legacy = readLegacy(key);
      if (!legacy.length) continue;
      cache[key] = cloneItems(legacy);
      await replaceRows(key, legacy);
      migratedAny = true;
    }

    if (migratedAny) {
      clearLegacy();
    }
    await loadAll();
  }

  function get(key) {
    return cloneItems(cache[key] || []);
  }

  function getObj(key, def = {}) {
    const value = localStorage.getItem(LEGACY[key]);
    if (!value) return def;
    try { return JSON.parse(value); }
    catch (err) { return def; }
  }

  function set(key, data) {
    cache[key] = cloneItems(data || []);
    void replaceRows(key, cache[key]);
    return true;
  }

  function push(key, item) {
    const record = { ...item, id: ensureUuid(item.id) };
    cache[key] = [record, ...(cache[key] || [])];
    void upsertRow(key, record);
    return record;
  }

  function update(key, id, updates) {
    const items = cache[key] || [];
    const idx = items.findIndex(entry => entry.id === id);
    if (idx === -1) return false;
    const merged = { ...items[idx], ...updates };
    items[idx] = merged;
    cache[key] = items;
    void upsertRow(key, merged);
    return merged;
  }

  function remove(key, id) {
    cache[key] = (cache[key] || []).filter(entry => entry.id !== id);
    void deleteRow(key, id);
  }

  function logActivity(text, color = '#c8922a') {
    const entry = {
      id: ensureUuid(genId()),
      text,
      color,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toISOString(),
    };
    cache.activity = [entry, ...(cache.activity || [])].slice(0, 20);
    void upsertRow('activity', entry);
  }

  async function init() {
    const db = client();
    if (!db) {
      console.error('Supabase client was not initialized.');
      ready = true;
      notifyAuth();
      return null;
    }

    const { data } = await db.auth.getSession();
    currentSession = data?.session || null;
    currentUser = currentSession?.user || null;

    authSubscription = db.auth.onAuthStateChange(async (_event, session) => {
      currentSession = session || null;
      currentUser = session?.user || null;

      if (currentUser) {
        await ensureProfile();
        await loadAll();
        await migrateLegacyData();
      } else {
        Object.keys(cache).forEach(key => { cache[key] = []; });
      }

      notifyAuth();
    });

    if (currentUser) {
      await ensureProfile();
      await loadAll();
      await migrateLegacyData();
      await loadProfile();
    } else {
      Object.keys(cache).forEach(key => { cache[key] = []; });
    }

    ready = true;
    notifyAuth();
    return currentSession;
  }

  function onAuthChange(cb) {
    authListeners.push(cb);
    if (ready) cb(currentSession);
  }

  function getSession() {
    return currentSession;
  }

  function getUser() {
    return currentUser;
  }

  return {
    KEYS,
    init,
    onAuthChange,
    getSession,
    getUser,
    getProfile,
    updateProfile,
    get,
    getObj,
    set,
    push,
    update,
    remove,
    logActivity,
  };
})();

/* ── ID generator ── */
function genId() {
  return ensureUuid('');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function ensureUuid(value) {
  if (isUuid(value)) return value;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* ── Date helpers ── */
function todayStr() {
  return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
