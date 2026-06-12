// ── Supabase client ───────────────────────────────────────
const db = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

// ── State ─────────────────────────────────────────────────
let leads        = [];
let currentNotes = [];
let selectedId   = null;
let currentFilter = 'all';
let currentUser  = localStorage.getItem('crm_username') || null;

// ── Bootstrap ─────────────────────────────────────────────
async function init() {
  if (!currentUser) {
    showUsernameModal();
    return;
  }
  document.getElementById('current-user-label').textContent = currentUser;
  updateTelegramDot();
  await loadLeads();
}

function updateTelegramDot() {
  const dot = document.getElementById('telegram-status-dot');
  if (!dot) return;
  const id = localStorage.getItem('crm_telegram_chatid');
  dot.className = id ? 'tg-dot-on' : 'tg-dot-off';
}

// ── Data ──────────────────────────────────────────────────
async function loadLeads() {
  setLoading(true);
  const { data, error } = await db
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { showError('Leadler yüklenemedi: ' + error.message); setLoading(false); return; }
  leads = data || [];
  setLoading(false);
  renderList();
  if (selectedId) await loadAndRenderDetail(selectedId);
  checkAndNotify();
}

async function loadAndRenderDetail(id) {
  const lead = leads.find(l => l.id === id);
  if (!lead) { selectedId = null; renderDetail(null); return; }

  const { data: notes, error } = await db
    .from('notes')
    .select('*')
    .eq('lead_id', id)
    .order('date', { ascending: false });

  if (error) { showError('Notlar yüklenemedi: ' + error.message); return; }
  currentNotes = notes || [];
  renderDetail(lead);
}

// ── Helpers ───────────────────────────────────────────────
function initials(first, last) {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '?';
}

function avatarClass(id) {
  const colors = ['av-0','av-1','av-2','av-3','av-4'];
  let hash = 0;
  for (let c of (id || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

const STATUS_LABEL = {
  'hesap-acildi': 'Hesap Açıldı',
  'yakin-takip':  'Yakın Takip',
  'uzak-takip':   'Uzak Takip',
  'ilgisiz':      'İlgisiz',
  'yatirimci':    'Yatırımcı',
};

// ── Reminder config (gün) ─────────────────────────────────
const REMINDER_DAYS = {
  'yakin-takip': 5,
  'uzak-takip':  10,
};

function getDaysOverdue(lead) {
  const statuses = getStatuses(lead);
  let minDays = null;
  for (const s of statuses) {
    if (REMINDER_DAYS[s] !== undefined) {
      if (minDays === null || REMINDER_DAYS[s] < minDays) minDays = REMINDER_DAYS[s];
    }
  }
  if (minDays === null) return null;
  const ref = lead.last_contact || lead.created_at;
  const daysSince = calendarDaysSince(ref);
  return daysSince >= minDays ? daysSince : null;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' })
       + ' ' + d.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
}

function formatDateShort(iso) {
  if (!iso) return 'Görüşme yok';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' });
}

function calendarDaysSince(iso) {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ref   = new Date(iso); ref.setHours(0, 0, 0, 0);
  return Math.round((today - ref) / 86400000);
}

function formatDaysAgo(iso) {
  if (!iso) return 'Hiç aranmadı';
  const days = calendarDaysSince(iso);
  if (days === 0) return 'Bugün';
  if (days === 1) return 'Dün';
  return `${days} gün önce`;
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setLoading(on) {
  document.getElementById('loading-bar').style.opacity = on ? '1' : '0';
}

function showError(msg) {
  const el = document.getElementById('error-toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ── Status helpers ────────────────────────────────────────
const MAIN_STATUSES = ['uzak-takip', 'yakin-takip', 'ilgisiz', 'yatirimci'];

function getStatuses(lead) {
  return Array.isArray(lead.status) ? lead.status : [lead.status];
}

function computeToggle(current, clicked) {
  let arr = [...current];
  if (clicked === 'hesap-acildi') {
    if (arr.includes('hesap-acildi')) {
      arr = arr.filter(s => s !== 'hesap-acildi');
    } else {
      arr.push('hesap-acildi');
    }
  } else {
    const alreadySelected = arr.includes(clicked);
    arr = arr.filter(s => !MAIN_STATUSES.includes(s));
    if (!alreadySelected) arr.push(clicked);
  }
  if (arr.length === 0) arr = [clicked];
  return arr;
}

// ── Kategori sayıları ─────────────────────────────────────
function updateFilterCounts() {
  const counts = {
    all: leads.length,
    'hesap-acildi': 0, 'yakin-takip': 0, 'uzak-takip': 0, 'ilgisiz': 0, 'yatirimci': 0,
    hatirlat: 0,
  };
  leads.forEach(l => {
    getStatuses(l).forEach(s => { if (counts[s] !== undefined) counts[s]++; });
    if (getDaysOverdue(l) !== null) counts.hatirlat++;
  });
  document.querySelectorAll('.filter-chip').forEach(chip => {
    const key = chip.dataset.filter;
    const badge = chip.querySelector('.chip-count');
    if (badge && counts[key] !== undefined) badge.textContent = counts[key];
  });
}

// ── Render List ───────────────────────────────────────────
function renderList() {
  updateFilterCounts();
  const q  = document.getElementById('search-input').value.toLowerCase().trim();
  const ul = document.getElementById('lead-list');
  ul.innerHTML = '';

  const filtered = leads.filter(l => {
    const statuses = getStatuses(l);
    const matchFilter = currentFilter === 'all'
      || (currentFilter === 'hatirlat' ? getDaysOverdue(l) !== null : statuses.includes(currentFilter));
    const full = `${l.first_name} ${l.last_name} ${l.phone} ${l.email}`.toLowerCase();
    return matchFilter && (!q || full.includes(q));
  });

  // En yeni eklenen en üstte (eklenme tarihine göre azalan)
  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!filtered.length) {
    ul.innerHTML = '<li class="list-empty">Lead bulunamadı</li>';
    return;
  }

  filtered.forEach(lead => {
    const statuses = getStatuses(lead);
    const metaLabel = statuses.map(s => STATUS_LABEL[s] || s).join(' + ');
    const dots = statuses.map(s => `<span class="lead-status-dot dot-${s}"></span>`).join('');
    const overdueDays = getDaysOverdue(lead);

    const li = document.createElement('li');
    li.className = 'lead-item' + (lead.id === selectedId ? ' active' : '') + (overdueDays !== null ? ' overdue' : '');
    li.onclick = () => selectLead(lead.id);
    li.innerHTML = `
      <div class="lead-avatar ${avatarClass(lead.id)}">${initials(lead.first_name, lead.last_name)}</div>
      <div class="lead-info">
        <div class="lead-fullname">${escHtml(lead.first_name)} ${escHtml(lead.last_name || '')}</div>
        <div class="lead-meta">${metaLabel} · ${formatDaysAgo(lead.last_contact)}</div>
        ${overdueDays !== null ? `<div class="reminder-badge">⏰ ${overdueDays} gündür aranmadı</div>` : ''}
      </div>
      <div class="lead-dots">${dots}</div>
    `;
    ul.appendChild(li);
  });
}

// ── Select & Render Detail ────────────────────────────────
async function selectLead(id) {
  selectedId = id;
  renderList();
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('lead-detail').classList.remove('hidden');
  document.getElementById('notes-history').innerHTML = '<div class="list-empty">Yükleniyor…</div>';
  await loadAndRenderDetail(id);
}

function renderDetail(lead) {
  document.getElementById('empty-state').classList.toggle('hidden', !!lead);
  document.getElementById('lead-detail').classList.toggle('hidden', !lead);
  if (!lead) return;

  const av = avatarClass(lead.id);
  document.getElementById('det-avatar').className = `detail-avatar ${av}`;
  document.getElementById('det-avatar').textContent = initials(lead.first_name, lead.last_name);
  document.getElementById('det-name').textContent = `${lead.first_name} ${lead.last_name || ''}`.trim();
  document.getElementById('det-phone').textContent = lead.phone || '—';
  document.getElementById('det-email').textContent = lead.email || '—';
  document.getElementById('det-last-contact').textContent = formatDate(lead.last_contact);
  document.getElementById('det-created').textContent =
    formatDate(lead.created_at) + (lead.added_by ? ` · ${escHtml(lead.added_by)}` : '');

  const overdueDays = getDaysOverdue(lead);
  const banner = document.getElementById('reminder-banner');
  if (overdueDays !== null) {
    const statuses2 = getStatuses(lead);
    const limit = statuses2.includes('yakin-takip') ? REMINDER_DAYS['yakin-takip'] : REMINDER_DAYS['uzak-takip'];
    banner.textContent = `⏰ Son görüşmeden ${overdueDays} gün geçti — ${STATUS_LABEL[statuses2.find(s=>REMINDER_DAYS[s])] || ''} için limit ${limit} gün.`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }

  const ref = lead.last_contact || lead.created_at;
  const daysSince = calendarDaysSince(ref);
  const daysEl = document.getElementById('det-days-since');
  if (daysSince === 0) {
    daysEl.textContent = lead.last_contact ? '🟢 Bugün görüşüldü' : '🆕 Bugün eklendi, henüz aranmadı';
    daysEl.className = 'days-since-row days-ok';
  } else if (getDaysOverdue(lead) !== null) {
    daysEl.textContent = `🔴 ${daysSince} gündür iletişim yok`;
    daysEl.className = 'days-since-row days-overdue';
  } else {
    daysEl.textContent = `🕐 ${daysSince} gündür iletişim yok`;
    daysEl.className = 'days-since-row days-normal';
  }

  const statuses = getStatuses(lead);
  document.querySelectorAll('#detail-status-selector .status-btn').forEach(btn => {
    btn.classList.toggle('active', statuses.includes(btn.dataset.status));
    btn.onclick = () => toggleStatus(lead.id, btn.dataset.status);
  });

  renderNotes();
}

function renderNotes() {
  const container = document.getElementById('notes-history');
  container.innerHTML = '';
  if (!currentNotes.length) {
    container.innerHTML = '<div class="list-empty">Henüz not eklenmemiş</div>';
    return;
  }
  currentNotes.forEach(note => {
    const div = document.createElement('div');
    div.className = 'note-card';
    div.innerHTML = `
      <div class="note-meta">
        <span class="note-dot"></span>
        ${formatDate(note.date)}
        ${note.added_by ? `<span class="note-author">· ${escHtml(note.added_by)}</span>` : ''}
      </div>
      <div class="note-text">${escHtml(note.text)}</div>
      <button class="note-delete" onclick="deleteNote('${note.id}')" title="Notu sil">✕</button>
    `;
    container.appendChild(div);
  });
}

// ── Add Note ──────────────────────────────────────────────
async function addNote() {
  const text = document.getElementById('note-input').value.trim();
  if (!text || !selectedId) return;

  const btn = document.querySelector('.btn-add-note');
  btn.disabled = true;

  const now = new Date().toISOString();

  const { error: noteErr } = await db.from('notes').insert({
    lead_id:  selectedId,
    text,
    date:     now,
    added_by: currentUser,
  });
  if (noteErr) { showError('Not eklenemedi: ' + noteErr.message); btn.disabled = false; return; }

  await db.from('leads').update({ last_contact: now }).eq('id', selectedId);

  document.getElementById('note-input').value = '';
  btn.disabled = false;
  await loadLeads();
}

// ── Delete Note ───────────────────────────────────────────
async function deleteNote(noteId) {
  const { error } = await db.from('notes').delete().eq('id', noteId);
  if (error) { showError('Not silinemedi'); return; }

  const { data: remaining } = await db
    .from('notes')
    .select('date')
    .eq('lead_id', selectedId)
    .order('date', { ascending: false })
    .limit(1);

  const lastContact = remaining?.length ? remaining[0].date : null;
  await db.from('leads').update({ last_contact: lastContact }).eq('id', selectedId);
  await loadLeads();
}

// ── Toggle Status ─────────────────────────────────────────
async function toggleStatus(id, clicked) {
  const lead = leads.find(l => l.id === id);
  if (!lead) return;
  const newStatuses = computeToggle(getStatuses(lead), clicked);
  const { error } = await db.from('leads').update({ status: newStatuses }).eq('id', id);
  if (error) { showError('Durum güncellenemedi'); return; }
  await loadLeads();
}

// ── Delete Lead ───────────────────────────────────────────
async function deleteLead() {
  if (!selectedId) return;
  const lead = leads.find(l => l.id === selectedId);
  if (!lead) return;
  if (!confirm(`"${lead.first_name} ${lead.last_name || ''}" silinecek. Emin misin?`)) return;

  const { error } = await db.from('leads').delete().eq('id', selectedId);
  if (error) { showError('Lead silinemedi'); return; }
  selectedId = null;
  currentNotes = [];
  await loadLeads();
  renderDetail(null);
}

// ── Add / Edit Lead Modal ─────────────────────────────────
let modalStatuses = ['uzak-takip'];
let editingLeadId = null;

function openAddModal() {
  editingLeadId = null;
  ['inp-firstname','inp-lastname','inp-phone','inp-email'].forEach(id => {
    document.getElementById(id).value = '';
  });
  modalStatuses = ['uzak-takip'];
  document.getElementById('modal-title').textContent = 'Yeni Lead Ekle';
  syncModalStatusBtns();
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('inp-firstname').focus();
}

function openEditModal() {
  if (!selectedId) return;
  const lead = leads.find(l => l.id === selectedId);
  if (!lead) return;
  editingLeadId = selectedId;
  document.getElementById('modal-title').textContent = 'Lead Düzenle';
  document.getElementById('inp-firstname').value = lead.first_name || '';
  document.getElementById('inp-lastname').value  = lead.last_name  || '';
  document.getElementById('inp-phone').value     = lead.phone      || '';
  document.getElementById('inp-email').value     = lead.email      || '';
  modalStatuses = getStatuses(lead);
  syncModalStatusBtns();
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('inp-firstname').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function syncModalStatusBtns() {
  document.querySelectorAll('#modal-status-selector .status-btn').forEach(btn => {
    btn.classList.toggle('active', modalStatuses.includes(btn.dataset.status));
    btn.onclick = () => {
      modalStatuses = computeToggle(modalStatuses, btn.dataset.status);
      syncModalStatusBtns();
    };
  });
}

async function saveLead() {
  const firstName = document.getElementById('inp-firstname').value.trim();
  const lastName  = document.getElementById('inp-lastname').value.trim();
  if (!firstName) { document.getElementById('inp-firstname').focus(); return; }

  const phone = document.getElementById('inp-phone').value.trim();
  const email = document.getElementById('inp-email').value.trim();

  // ── Aynı telefon numarası uyarısı ──
  // Son 10 haneye bakar; böylece +90 / 0 / boşluk-tire farkları sorun olmaz.
  if (phone) {
    const digits = p => (p || '').replace(/\D/g, '').slice(-10);
    const np = digits(phone);
    if (np) {
      const dup = leads.find(l => l.id !== editingLeadId && digits(l.phone) === np);
      if (dup) {
        const dupName = [dup.first_name, dup.last_name].filter(Boolean).join(' ') || 'İsimsiz kayıt';
        if (!confirm(`⚠️ Bu telefon numarası zaten kayıtlı:\n\n${dupName} — ${dup.phone}\n\nYine de kaydetmek istiyor musun?`)) {
          return;
        }
      }
    }
  }

  const btn = document.querySelector('.btn-save');
  btn.disabled = true;

  if (editingLeadId) {
    const { error } = await db.from('leads').update({
      first_name: firstName,
      last_name:  lastName  || null,
      phone:      phone || null,
      email:      email || null,
      status:     modalStatuses,
    }).eq('id', editingLeadId);

    btn.disabled = false;
    if (error) { showError('Lead güncellenemedi: ' + error.message); return; }
    closeModal();
    await loadLeads();
  } else {
    const { data, error } = await db.from('leads').insert({
      first_name: firstName,
      last_name:  lastName  || null,
      phone:      phone || null,
      email:      email || null,
      status:     modalStatuses,
      added_by:   currentUser,
    }).select().single();

    btn.disabled = false;
    if (error) { showError('Lead eklenemedi: ' + error.message); return; }
    closeModal();
    await loadLeads();
    selectLead(data.id);
  }
}

// ── Copy to clipboard ─────────────────────────────────────
function copyField(field) {
  const lead = leads.find(l => l.id === selectedId);
  if (!lead) return;
  const val = lead[field];
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => {
    showCopyToast(val);
  });
}

function showCopyToast(val) {
  const el = document.getElementById('copy-toast');
  el.textContent = `Kopyalandı: ${val}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 2000);
}

// ── Filter ────────────────────────────────────────────────
function setFilter(btn, filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.toggle('active', b === btn));
  renderList();
}

// ── Username Modal ────────────────────────────────────────
function showUsernameModal() {
  document.getElementById('inp-username').value = '';
  document.getElementById('username-modal').classList.remove('hidden');
  document.getElementById('inp-username').focus();
}

function saveUsername() {
  const name = document.getElementById('inp-username').value.trim();
  if (!name) { document.getElementById('inp-username').focus(); return; }
  currentUser = name;
  localStorage.setItem('crm_username', name);
  document.getElementById('username-modal').classList.add('hidden');
  document.getElementById('current-user-label').textContent = name;
  loadLeads();
}

function changeUser() {
  localStorage.removeItem('crm_username');
  currentUser = null;
  showUsernameModal();
}

// ── Telegram ──────────────────────────────────────────────
function openTelegramSettings() {
  const saved = localStorage.getItem('crm_telegram_chatid') || '';
  document.getElementById('inp-telegram-id').value = saved;
  document.getElementById('telegram-modal').classList.remove('hidden');
  document.getElementById('inp-telegram-id').focus();
}

function closeTelegramModal() {
  document.getElementById('telegram-modal').classList.add('hidden');
}

function saveTelegramId() {
  const id = document.getElementById('inp-telegram-id').value.trim();
  localStorage.setItem('crm_telegram_chatid', id);
  closeTelegramModal();
  updateTelegramDot();
  if (id) showCopyToast('Telegram bağlandı ✓');
  else showCopyToast('Telegram bağlantısı kaldırıldı');
}

async function sendTelegram(chatId, text) {
  const token = window.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'BURAYA_BOT_TOKEN' || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch {}
}

async function checkAndNotify() {
  const chatId = localStorage.getItem('crm_telegram_chatid');
  if (!chatId) return;
  const token = window.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'BURAYA_BOT_TOKEN') return;

  const today = new Date().toISOString().slice(0, 10);
  const notified = JSON.parse(localStorage.getItem('crm_notified') || '{}');

  const overdueLeads = leads.filter(l => getDaysOverdue(l) !== null);
  if (!overdueLeads.length) return;

  for (const lead of overdueLeads) {
    const key = `${lead.id}_${today}`;
    if (notified[key]) continue;

    const days = getDaysOverdue(lead);
    const name = `${lead.first_name} ${lead.last_name || ''}`.trim();
    const statusLabel = getStatuses(lead).map(s => STATUS_LABEL[s] || s).join(' + ');
    const msg = `⏰ <b>Takip Hatırlatıcısı</b>\n\n👤 <b>${name}</b>\n📊 ${statusLabel}\n🕐 ${days} gündür görüşme yok`;

    await sendTelegram(chatId, msg);
    notified[key] = true;
  }

  localStorage.setItem('crm_notified', JSON.stringify(notified));
}

// ── Keyboard ──────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!document.getElementById('modal-overlay').classList.contains('hidden')) closeModal();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (!document.getElementById('modal-overlay').classList.contains('hidden')) { saveLead(); return; }
    if (!document.getElementById('username-modal').classList.contains('hidden')) { saveUsername(); return; }
    if (selectedId && document.activeElement === document.getElementById('note-input')) addNote();
  }
});

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

document.getElementById('inp-username').addEventListener('keydown', e => {
  if (e.key === 'Enter') saveUsername();
});

// ── Mobile sidebar ────────────────────────────────────────
function isMobile() { return window.innerWidth <= 768; }

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const isOpen   = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('visible', !isOpen);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

function mobileBack() {
  selectedId = null;
  currentNotes = [];
  document.getElementById('lead-detail').classList.add('hidden');
  document.getElementById('empty-state').classList.remove('hidden');
  renderList();
}

// close sidebar when lead selected on mobile
const _origSelectLead = selectLead;
selectLead = async function(id) {
  if (isMobile()) closeSidebar();
  await _origSelectLead(id);
};

// ── Start ─────────────────────────────────────────────────
init();
