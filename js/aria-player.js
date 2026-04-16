// ═══════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════
const SUITS = [
    { name: 'spades', sym: '♠', cls: 'c-black', pillCls: '' },
    { name: 'clubs', sym: '♣', cls: 'c-black', pillCls: '' },
    { name: 'hearts', sym: '♥', cls: 'c-red', pillCls: 'c-red' },
    { name: 'diamonds', sym: '♦', cls: 'c-red', pillCls: 'c-red' },
];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_FR = { spades: 'Pique', clubs: 'Trèfle', hearts: 'Cœur', diamonds: 'Carreau' };
const ALL_CARDS = [];
for (const s of SUITS) for (const r of RANKS) ALL_CARDS.push({ id: `${r}-${s.name}`, rank: r, suit: s });
ALL_CARDS.push({ id: 'joker-red', isJoker: true, jokerColor: 'red', label: 'Joker Rouge' });
ALL_CARDS.push({ id: 'joker-black', isJoker: true, jokerColor: 'black', label: 'Joker Noir' });
function cardById(id) { return ALL_CARDS.find(c => c.id === id); }
function shuffle(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]]; } return b; }
function buildDeck() { return shuffle([...ALL_CARDS]); }

// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
const DEFAULT_CHAR = {
    name: "",
    class: "",
    stats: { FOR: 0, DEX: 0, END: 0, INT: 0, CHA: 0, PV: 0 },
    physical: { age: "", taille: "", poids: "", yeux: "", cheveux: "", signes: "" },
    inventory: [],
    weapons: [{ nom: '', degats: '' }, { nom: '', degats: '' }, { nom: '', degats: '' }],
    protection: { nom: '', valeur: 0 },
    skills: [
        { name: "Artisanat, construire", link: "DEX/INT", pct: 0 },
        { name: "Combat rapproché", link: "FOR/DEX", pct: 0 },
        { name: "Combat à distance", link: "FOR/DEX", pct: 0 },
        { name: "Connaissance de la nature", link: "DEX/INT", pct: 0 },
        { name: "Connaissance des secrets", link: "INT/CHA", pct: 0 },
        { name: "Courir, sauter", link: "DEX/END", pct: 0 },
        { name: "Discrétion", link: "DEX/CHA", pct: 0 },
        { name: "Droit", link: "INT/CHA", pct: 0 },
        { name: "Esquiver", link: "DEX/INT", pct: 0 },
        { name: "Intimider", link: "FOR/CHA", pct: 0 },
        { name: "Lire, écrire", link: "INT/CHA", pct: 0 },
        { name: "Mentir, convaincre", link: "INT/CHA", pct: 0 },
        { name: "Perception", link: "INT/CHA", pct: 0 },
        { name: "Piloter", link: "DEX/END", pct: 0 },
        { name: "Psychologie", link: "END/INT", pct: 0 },
        { name: "Réflexes", link: "DEX/INT", pct: 0 },
        { name: "Serrures et pièges", link: "DEX/END", pct: 0 },
        { name: "Soigner", link: "INT/CHA", pct: 0 },
        { name: "Survie", link: "END/INT", pct: 0 },
        { name: "Voler", link: "DEX/INT", pct: 0 },
    ],
    specials: [],
    campaignKey: '',
};

// Character will be loaded after selection
let character = null;
let currentCharId = null;

// Per-tab unique ID — persists across refreshes (sessionStorage) but differs between tabs
let playerId = sessionStorage.getItem('aria-player-id');
if (!playerId) { playerId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 9); sessionStorage.setItem('aria-player-id', playerId); }

let config = JSON.parse(localStorage.getItem('aria-config') || '{}');
if (config.lightMode) document.body.classList.add('light-mode');
let bonusMalus = 0;
let multiplier = 1;
let isRolling = false;
let dddiceAPI = null;
let dddiceSDK = null;            // ThreeDDice SDK instance
let pendingDddiceRoll = null;    // { skillName, threshold } waiting for RollFinished event
let pendingSecondaryRoll = null; // { callback, mapFn } for non-d100 dice (d6, d3, weapon formula…)
let dddiceRollSafetyTimer = null; // fallback timer in case RollFinished never fires
let ablyRolls = null, ablyCards = null, ablyDamage = null;
let ablyInstance = null;
let currentHP = null;
let presenceIntervalId = null;
const knownPlayers = {}; // { playerId: { name, ts } } — other players seen via presence
let soignerTarget = null; // null = self, or { playerId, name }
let soignerPct = 0;

// Card state — initialized after character selection
let cardDeck = null, cardDrawn = null, cardExcluded = null, lastCardId = null;
let cardDrawing = false;
let cardStatusTimer = null;

// tab access granted by GM — stored per character in localStorage
let playerTabs = { cards: false, alchemy: false };

// files granted by GM — stored per character in localStorage
let playerFiles = [];

// pending craft recipe index — set before a roll, cleared by handleResult
let pendingCraft = null;

let saveKey        = localStorage.getItem('aria-save-key') || null;
let _pendingNewKey = null;
let syncTimer      = null;

// ═══════════════════════════════════════════
//  SUPABASE CONFIG
//  Replace with your values from:
//  Supabase dashboard → Project Settings → API
// ═══════════════════════════════════════════
const SUPABASE_URL = 'https://npybuksklkvdmbhyzdjs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hUkdwmlgNNhLXn6t38GHHg_N7XXVOn4';

// ═══════════════════════════════════════════
//  CLOUD SAVE SYSTEM
// ═══════════════════════════════════════════
function _supabaseReady() {
    return !!SUPABASE_URL && !!SUPABASE_ANON_KEY && !!saveKey;
}

async function _sbFetch(path, options = {}) {
    return fetch(SUPABASE_URL + path, {
        ...options,
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
}

function collectPlayerData() {
    const chars = JSON.parse(localStorage.getItem('aria-characters') || '[]');
    const perChar = {};
    chars.forEach(c => {
        const hp    = localStorage.getItem('aria-current-hp-'    + c.id);
        const cards = localStorage.getItem('aria-cards-'         + c.id);
        const notes = localStorage.getItem('aria-notes-'         + c.id);
        const tabs  = localStorage.getItem('aria-player-tabs-'   + c.id);
        const files = localStorage.getItem('aria-player-files-'  + c.id);
        perChar[c.id] = {
            hp:    hp    !== null ? parseInt(hp) : null,
            cards: cards ? JSON.parse(cards) : null,
            notes: notes ? JSON.parse(notes) : null,
            tabs:  tabs  ? JSON.parse(tabs)  : null,
            files: files ? JSON.parse(files) : null,
        };
    });
    return { characters: chars, perChar };
}

function applyPlayerData(data) {
    if (!data || !Array.isArray(data.characters)) return;
    localStorage.setItem('aria-characters', JSON.stringify(data.characters));
    if (!data.perChar) return;
    Object.entries(data.perChar).forEach(([id, s]) => {
        if (s.hp    !== null && s.hp    !== undefined) localStorage.setItem('aria-current-hp-'    + id, s.hp);
        if (s.cards !== null && s.cards !== undefined) localStorage.setItem('aria-cards-'          + id, JSON.stringify(s.cards));
        if (s.notes !== null && s.notes !== undefined) localStorage.setItem('aria-notes-'          + id, JSON.stringify(s.notes));
        if (s.tabs  !== null && s.tabs  !== undefined) localStorage.setItem('aria-player-tabs-'    + id, JSON.stringify(s.tabs));
        if (s.files !== null && s.files !== undefined) localStorage.setItem('aria-player-files-'   + id, JSON.stringify(s.files));
    });
}

async function loadFromSupabase() {
    if (!_supabaseReady()) return;
    try {
        const res = await _sbFetch(`/rest/v1/saves?save_key=eq.${encodeURIComponent(saveKey)}&select=data`);
        if (!res.ok) return;
        const rows = await res.json();
        if (!rows.length) return;
        const data = rows[0].data;
        if (data.player) applyPlayerData(data.player);
        else if (Array.isArray(data.characters)) applyPlayerData(data);
    } catch(e) { console.warn('[ARIA] Supabase load failed:', e); }
}

async function syncToSupabase() {
    if (!_supabaseReady()) return;
    try {
        await _sbFetch('/rest/v1/saves', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({ save_key: saveKey, data: { version: 2, player: collectPlayerData() }, updated_at: new Date().toISOString() }),
        });
    } catch(e) { console.warn('[ARIA] Supabase sync failed:', e); }
}

function debouncedSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncToSupabase, 800);
}

function showGateway() {
    _pendingNewKey = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    document.getElementById('gateway-key-display').textContent = _pendingNewKey;
    document.getElementById('gateway-new').style.display = '';
    document.getElementById('gateway-existing').style.display = 'none';
    document.getElementById('file-gateway').style.display = 'flex';
}

function showGatewayExisting() {
    document.getElementById('gateway-new').style.display = 'none';
    document.getElementById('gateway-existing').style.display = '';
    const input = document.getElementById('gateway-key-input');
    if (input) { input.value = ''; input.focus(); }
}

function hideGateway() {
    document.getElementById('file-gateway').style.display = 'none';
}

function copyGatewayKey() {
    const key = document.getElementById('gateway-key-display').textContent;
    navigator.clipboard.writeText(key).catch(() => {});
    const btn = document.getElementById('gateway-copy-btn');
    if (btn) { btn.textContent = 'Copié !'; setTimeout(() => { btn.textContent = 'Copier'; }, 2000); }
}

async function confirmNewKey() {
    if (!_pendingNewKey) return;
    saveKey = _pendingNewKey;
    localStorage.setItem('aria-save-key', saveKey);
    await syncToSupabase();
    hideGateway();
    showSelectionScreen();
}

async function submitExistingKey() {
    const input = document.getElementById('gateway-key-input');
    const key = input ? input.value.trim() : '';
    if (!key) return;
    saveKey = key;
    localStorage.setItem('aria-save-key', key);
    await loadFromSupabase();
    hideGateway();
    showSelectionScreen();
}

function updateSaveKeyStatus() {
    const label = document.getElementById('sel-save-label');
    if (!label) return;
    label.textContent = saveKey ? saveKey.slice(0, 8) + '…' : '—';
    label.className = 'sel-save-label' + (saveKey ? ' connected' : '');
}

function changeSaveKey() {
    showGatewayExisting();
    document.getElementById('file-gateway').style.display = 'flex';
}

function copySaveKey() {
    if (!saveKey) return;
    navigator.clipboard.writeText(saveKey).catch(() => {});
    const btns = document.querySelectorAll('.sel-save-btn');
    const copyBtn = [...btns].find(b => b.textContent === 'Copier');
    if (copyBtn) { copyBtn.textContent = 'Copié !'; setTimeout(() => { copyBtn.textContent = 'Copier'; }, 2000); }
}

function cancelGateway() {
    if (saveKey) { hideGateway(); } else { showGateway(); }
}

async function tryRestoreSupabase() {
    if (!saveKey) { showGateway(); return; }
    await loadFromSupabase();
    hideGateway();
    showSelectionScreen();
}

// ═══════════════════════════════════════════
//  CHARACTER MANAGEMENT
// ═══════════════════════════════════════════
function hpKey()    { return 'aria-current-hp-' + currentCharId; }
function cardKey()  { return 'aria-cards-'       + currentCharId; }
function notesKey() { return 'aria-notes-'       + currentCharId; }

function getCharacters() { return JSON.parse(localStorage.getItem('aria-characters') || '[]'); }
function saveCharacters(chars) { localStorage.setItem('aria-characters', JSON.stringify(chars)); debouncedSync(); }
function saveCurrentCharacter() {
    if (!currentCharId) return;
    const chars = getCharacters();
    const idx = chars.findIndex(c => c.id === currentCharId);
    const entry = { ...character, id: currentCharId };
    if (idx >= 0) chars[idx] = entry;
    else chars.push(entry);
    saveCharacters(chars);
}

function migrateIfNeeded() {
    if (localStorage.getItem('aria-characters')) return;
    const oldChar = JSON.parse(localStorage.getItem('aria-character') || 'null');
    if (!oldChar) return;
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    saveCharacters([{ ...oldChar, id }]);
    const oldHp = localStorage.getItem('aria-current-hp');
    if (oldHp !== null) localStorage.setItem('aria-current-hp-' + id, oldHp);
    const oldCards = localStorage.getItem('aria-cards');
    if (oldCards !== null) localStorage.setItem('aria-cards-' + id, oldCards);
}

function loadCharacterState(id) {
    const chars = getCharacters();
    const data = chars.find(c => c.id === id);
    if (!data) return false;
    currentCharId = id;
    character = { ...data };
    delete character.id;
    if (!character.physical) character.physical = { age:'', taille:'', poids:'', yeux:'', cheveux:'', signes:'' };
    if (!character.inventory) character.inventory = [];
    if (!character.weapons) character.weapons = [{ nom:'', degats:'' },{ nom:'', degats:'' },{ nom:'', degats:'' }];
    if (!character.protection) character.protection = { nom:'', valeur:0 };
    if (!character.potions) character.potions = [];
    if (!character.potionRecipes) character.potionRecipes = [];
    if (character.vials === undefined || character.vials === null) character.vials = 0;
    if (!character.specials) character.specials = [];
    const saved = JSON.parse(localStorage.getItem(cardKey()) || 'null');
    cardDeck = saved?.deckIds?.map(cid => cardById(cid)).filter(Boolean) || buildDeck();
    cardDrawn = new Set(saved?.drawn || []);
    cardExcluded = new Set(saved?.excluded || []);
    lastCardId = saved?.lastCardId || null;
    return true;
}

function renderSelectionScreen() {
    const chars = getCharacters();
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';
    if (chars.length === 0) {
        grid.innerHTML = '<div class="sel-empty">Aucun personnage. Créez-en un pour commencer.</div>';
        return;
    }
    chars.forEach(c => {
        const card = document.createElement('div');
        card.className = 'sel-card';
        const campBadge = c.campaignKey ? `<div class="sel-card-campaign">🔑 ${c.campaignKey}</div>` : `<div class="sel-card-campaign no-campaign">Sans campagne</div>`;
        card.innerHTML = `<button class="sel-card-delete" onclick="event.stopPropagation();deleteCharacter('${c.id}')" title="Supprimer">✕</button><div class="sel-card-name">${c.name || '—'}</div><div class="sel-card-class">${c.class || ''}</div>${campBadge}`;
        card.addEventListener('click', () => selectCharacter(c.id));
        grid.appendChild(card);
    });
}

function showSelectionScreen() {
    document.getElementById('selection-screen').style.display = 'flex';
    document.getElementById('app-wrapper').style.display = 'none';
    document.getElementById('new-char-form').style.display = 'none';
    renderSelectionScreen();
    updateSaveKeyStatus();
}

function showApp() {
    document.getElementById('selection-screen').style.display = 'none';
    document.getElementById('app-wrapper').style.display = 'flex';
}

function selectCharacter(id) {
    if (!loadCharacterState(id)) return;
    showApp();
    initApp();
}

function deleteCharacter(id) {
    if (!confirm('Supprimer ce personnage ? Cette action est irréversible.')) return;
    const chars = getCharacters().filter(c => c.id !== id);
    saveCharacters(chars);
    localStorage.removeItem('aria-current-hp-' + id);
    localStorage.removeItem('aria-cards-' + id);
    localStorage.removeItem('aria-notes-' + id);
    localStorage.removeItem('aria-player-files-' + id);
    renderSelectionScreen();
}

function createCharacter() {
    document.getElementById('new-char-form').style.display = 'flex';
    document.getElementById('new-char-name').value = '';
    document.getElementById('new-char-class').value = '';
    document.getElementById('new-char-campaign').value = '';
    document.getElementById('new-char-name').focus();
}

function confirmCreateCharacter() {
    const name = document.getElementById('new-char-name').value.trim() || 'Nouveau personnage';
    const cls  = document.getElementById('new-char-class').value.trim();
    const campaignKey = document.getElementById('new-char-campaign').value.trim();
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const chars = getCharacters();
    chars.push({ ...JSON.parse(JSON.stringify(DEFAULT_CHAR)), name, class: cls, campaignKey, id });
    saveCharacters(chars);
    document.getElementById('new-char-form').style.display = 'none';
    selectCharacter(id);
}

function cancelCreateCharacter() {
    document.getElementById('new-char-form').style.display = 'none';
}

function switchCharacter() {
    if (currentCharId) saveCurrentCharacter();
    if (presenceIntervalId) { clearInterval(presenceIntervalId); presenceIntervalId = null; }
    if (dddiceSDK) { try { dddiceSDK.disconnect?.(); } catch(_){} dddiceSDK = null; }
    clearTimeout(dddiceRollSafetyTimer);
    pendingDddiceRoll = null; pendingSecondaryRoll = null; dddiceAPI = null;
    currentHP = null; bonusMalus = 0;
    const doCloseAbly = () => {
        if (ablyInstance) { try { ablyInstance.close(); } catch(_){} ablyInstance = null; }
        ablyRolls = null; ablyCards = null; ablyDamage = null;
    };
    if (ablyDamage) {
        try { ablyDamage.publish('leave', { playerId }, () => doCloseAbly()); } catch(_){ doCloseAbly(); }
    } else {
        doCloseAbly();
    }
    showSelectionScreen();
}

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
    migrateIfNeeded();
    document.getElementById('version-display').textContent = 'v' + VERSION;
    document.getElementById('pid-display').textContent = '#' + playerId.slice(-6);
    await tryRestoreSupabase();
});

function initApp() {
    currentHP = null;
    playerTabs = JSON.parse(localStorage.getItem('aria-player-tabs-' + currentCharId) || '{"cards":false,"alchemy":false}');
    playerFiles = JSON.parse(localStorage.getItem('aria-player-files-' + currentCharId) || '[]');
    initCurrentHP();
    renderAll();
    buildTracker();
    updateDeckCount();
    if (lastCardId) restoreCard();
    loadConfigInputs();
    if (config.dddiceKey && config.dddiceRoom) initDddice();
    if (config.ablyKey) initAbly();
    applyTabVisibility();
    document.getElementById('tab-char').addEventListener('input', scheduleAutoSave);
    document.getElementById('tab-inventory').addEventListener('input', scheduleAutoSave);
    document.getElementById('tab-alchemy').addEventListener('input', scheduleAutoSave);
    loadNotes();
    if (presenceIntervalId) clearInterval(presenceIntervalId);
    presenceIntervalId = setInterval(sendPresence, 5000);
    document.title = character.name ? `ARIA – ${character.name}` : 'ARIA – Joueur';
}

// ═══════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════
function switchTab(id, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
}
// ═══════════════════════════════════════════
//  NOTES
// ═══════════════════════════════════════════
let notesList = [];
let currentNoteId = null;

function loadNotes() {
    const raw = localStorage.getItem(notesKey());
    if (!raw) {
        notesList = [];
    } else {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                notesList = parsed;
            } else {
                // Migrate from plain string
                notesList = [{ id: _noteId(), name: 'Notes', content: raw }];
            }
        } catch(e) {
            // Plain string (not JSON)
            notesList = [{ id: _noteId(), name: 'Notes', content: raw }];
        }
    }
    currentNoteId = notesList.length > 0 ? notesList[0].id : null;
    renderNotesList();
    loadNoteContent();
}

function _noteId() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function persistNotes() {
    localStorage.setItem(notesKey(), JSON.stringify(notesList));
    debouncedSync();
}

function renderNotesList() {
    const list = document.getElementById('notes-list');
    if (!list) return;
    list.innerHTML = '';
    notesList.forEach(note => {
        const item = document.createElement('div');
        item.className = 'notes-item' + (note.id === currentNoteId ? ' active' : '');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'notes-item-name';
        nameSpan.textContent = note.name || 'Sans titre';
        nameSpan.addEventListener('click', () => selectNote(note.id));
        const delBtn = document.createElement('button');
        delBtn.className = 'notes-item-delete';
        delBtn.title = 'Supprimer';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteNote(note.id); });
        item.appendChild(nameSpan);
        item.appendChild(delBtn);
        list.appendChild(item);
    });
}

function loadNoteContent() {
    const nameInput = document.getElementById('notes-name-input');
    const area = document.getElementById('notes-area');
    if (!nameInput || !area) return;
    const note = notesList.find(n => n.id === currentNoteId);
    if (note) {
        nameInput.value = note.name;
        area.value = note.content;
        nameInput.disabled = false;
        area.disabled = false;
    } else {
        nameInput.value = '';
        area.value = '';
        nameInput.disabled = true;
        area.disabled = true;
    }
}

function selectNote(id) {
    currentNoteId = id;
    renderNotesList();
    loadNoteContent();
    document.getElementById('notes-area').focus();
}

function addNote() {
    const note = { id: _noteId(), name: 'Nouvelle note', content: '' };
    notesList.push(note);
    persistNotes();
    selectNote(note.id);
    const nameInput = document.getElementById('notes-name-input');
    if (nameInput) { nameInput.focus(); nameInput.select(); }
}

function deleteNote(id) {
    const idx = notesList.findIndex(n => n.id === id);
    notesList = notesList.filter(n => n.id !== id);
    currentNoteId = notesList[Math.min(idx, notesList.length - 1)]?.id || null;
    persistNotes();
    renderNotesList();
    loadNoteContent();
}

function saveCurrentNote() {
    const note = notesList.find(n => n.id === currentNoteId);
    if (!note) return;
    note.content = document.getElementById('notes-area').value;
    persistNotes();
}

function renameCurrentNote() {
    const note = notesList.find(n => n.id === currentNoteId);
    if (!note) return;
    note.name = document.getElementById('notes-name-input').value;
    persistNotes();
    renderNotesList();
}

function applyTabVisibility() {
    const btnCards = document.getElementById('tab-btn-cards');
    const btnAlchemy = document.getElementById('tab-btn-alchemy');
    const btnFiles = document.getElementById('tab-btn-files');
    if (!btnCards || !btnAlchemy) return;
    btnCards.style.display = playerTabs.cards ? '' : 'none';
    btnAlchemy.style.display = playerTabs.alchemy ? '' : 'none';
    if (btnFiles) btnFiles.style.display = playerFiles.length > 0 ? '' : 'none';
    // If the currently active tab was just hidden, fall back to Compétences
    if (!playerTabs.cards && document.getElementById('tab-cards').classList.contains('active')) {
        switchTab('tab-skills', document.querySelector('.tab-btn'));
    }
    if (!playerTabs.alchemy && document.getElementById('tab-alchemy').classList.contains('active')) {
        switchTab('tab-skills', document.querySelector('.tab-btn'));
    }
    if (!playerFiles.length && document.getElementById('tab-files')?.classList.contains('active')) {
        switchTab('tab-skills', document.querySelector('.tab-btn'));
    }
    renderInventoryEditor();
}

// ═══════════════════════════════════════════
//  HP
// ═══════════════════════════════════════════
function getMaxHP() { return character.stats.PV || 14; }
function initCurrentHP() {
    if (currentHP === null) currentHP = parseInt(localStorage.getItem(hpKey()));
    if (currentHP === null || isNaN(currentHP)) currentHP = getMaxHP();
}
function updateHPDisplay() {
    const max = getMaxHP(), cur = Math.max(0, Math.min(currentHP, max));
    const numEl = document.getElementById('hp-number');
    numEl.textContent = cur;
    document.getElementById('hp-fraction').textContent = `/ ${max} PV`;
    const pct = max > 0 ? cur / max : 0;
    numEl.className = 'hp-number' + (pct <= 0.25 ? ' critical' : pct <= 0.5 ? ' low' : '');
    const fill = document.getElementById('hp-bar-fill');
    fill.style.width = `${pct * 100}%`;
    fill.style.background = pct > 0.5 ? 'var(--success)' : pct > 0.25 ? '#e8a020' : 'var(--fail)';
}
function animateHPChange(hpBefore, hpAfter, maxHP) {
    const ghost = document.getElementById('hp-bar-ghost');
    const fill = document.getElementById('hp-bar-fill');
    const oldPct = maxHP > 0 ? hpBefore / maxHP : 0;
    ghost.style.transition = 'none';
    ghost.style.width = `${oldPct * 100}%`;
    fill.style.transition = 'none';
    fill.style.width = `${oldPct * 100}%`;
    void fill.offsetWidth;
    fill.style.transition = 'width 1.1s ease, background .3s';
    const newPct = maxHP > 0 ? hpAfter / maxHP : 0;
    fill.style.width = `${newPct * 100}%`;
    fill.style.background = newPct > 0.5 ? 'var(--success)' : newPct > 0.25 ? '#e8a020' : 'var(--fail)';
    setTimeout(() => { ghost.style.transition = 'width .4s ease'; ghost.style.width = `${newPct * 100}%`; }, 1200);
}

// ═══════════════════════════════════════════
//  DAMAGE ANIMATIONS (received from GM)
// ═══════════════════════════════════════════
function handleGMDamage(data) {
    const { damage, hpBefore, hpAfter, maxHP } = data;
    animateHPChange(hpBefore, hpAfter, maxHP);
    currentHP = hpAfter;
    localStorage.setItem(hpKey(), currentHP); debouncedSync();
    updateHPDisplay();
    triggerDamageVFX(damage, false);
    showToast('gm-dmg-toast', `⚔ Dégâts reçus : -${damage} PV`);
    if (hpAfter <= 0) showMort();
}
function handleGMHeal(data) {
    const { amount, hpBefore, hpAfter, maxHP } = data;
    animateHPChange(hpBefore, hpAfter, maxHP);
    currentHP = hpAfter;
    localStorage.setItem(hpKey(), currentHP); debouncedSync();
    updateHPDisplay();
    showHealNumber(amount);
    showToast('gm-heal-toast', `♥ Soins reçus : +${amount} PV`);
}
function triggerDamageVFX(dmg, local) {
    // screen shake
    document.body.style.animation = 'none';
    void document.body.offsetWidth;
    const shake = document.createElement('style');
    shake.textContent = '@keyframes _shake{0%,100%{transform:translate(0,0)}20%{transform:translate(-5px,2px)}40%{transform:translate(5px,-2px)}60%{transform:translate(-4px,1px)}80%{transform:translate(4px,-1px)}}';
    document.head.appendChild(shake);
    document.body.style.animation = '_shake .4s ease';
    setTimeout(() => { document.body.style.animation = ''; shake.remove(); }, 400);
    // vignette
    const v = document.getElementById('dmg-vignette');
    v.classList.add('show');
    setTimeout(() => v.classList.remove('show'), 600);
    // blood particles
    spawnBloodParticles();
    // damage number
    spawnDmgNumber(`-${dmg}`, false);
}
function showHealNumber(amt) { spawnDmgNumber(`+${amt}`, true); }
function spawnDmgNumber(txt, isHeal) {
    const el = document.createElement('div');
    el.textContent = txt;
    el.style.cssText = `position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);font-family:'Cinzel',serif;font-size:64px;font-weight:900;color:${isHeal ? '#4cff88' : '#ff4444'};text-shadow:0 0 20px ${isHeal ? 'rgba(76,255,136,.5)' : 'rgba(255,50,50,.6)'};pointer-events:none;z-index:900;transition:all .9s ease-out;`;
    document.body.appendChild(el);
    void el.offsetWidth;
    el.style.transform = 'translate(-50%,-120%)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 1000);
}
function spawnBloodParticles() {
    const canvas = document.getElementById('dmg-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const particles = [];
    for (let i = 0; i < 40; i++) particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height * .4,
        vx: (Math.random() - .5) * 4, vy: Math.random() * 5 + 2,
        r: Math.random() * 4 + 1, life: 1
    });
    function frame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        for (const p of particles) {
            p.x += p.vx; p.y += p.vy; p.vy += .18; p.life -= .025;
            if (p.life <= 0) continue;
            alive = true;
            ctx.globalAlpha = p.life;
            ctx.fillStyle = `hsl(${Math.floor(Math.random() * 15)},90%,30%)`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (alive) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
function showMort() {
    const m = document.getElementById('mort-screen');
    m.classList.add('show');
    setTimeout(() => m.classList.remove('show'), 4000);
}
let toastTimers = {};
function showToast(id, msg) {
    clearTimeout(toastTimers[id]);
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.add('show');
    toastTimers[id] = setTimeout(() => el.classList.remove('show'), 3500);
}

// ═══════════════════════════════════════════
//  BONUS / MALUS
// ═══════════════════════════════════════════
let otherRollToastTimer = null;
function showOtherRollToast(d) {
    const type = classify(d.roll, d.threshold, d.success);
    const vcls = { success: 's', fail: 'f', 'crit-success': 'cs', 'crit-fail': 'cf' };
    const vlbl = { success: 'SUCCÈS', fail: 'ÉCHEC', 'crit-success': 'SUCCÈS CRITIQUE', 'crit-fail': 'ÉCHEC CRITIQUE' };
    const toast = document.getElementById('other-roll-toast');
    document.getElementById('ort-char').textContent = d.char || '?';
    document.getElementById('ort-skill').textContent = d.skillName;
    document.getElementById('ort-roll').textContent = d.roll;
    const vEl = document.getElementById('ort-verdict');
    vEl.textContent = vlbl[type]; vEl.className = `ort-verdict ${vcls[type]}`;
    toast.classList.add('show');
    clearTimeout(otherRollToastTimer);
    otherRollToastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

function addBM(v) { bonusMalus += v; updateBMDisplay(); }
function resetBM() { bonusMalus = 0; updateBMDisplay(); }
function addCustomBM(sign) {
    const v = parseInt(document.getElementById('bm-custom-val').value);
    if (!isNaN(v)) { bonusMalus += sign * Math.abs(v); updateBMDisplay(); }
}
function updateBMDisplay() {
    const el = document.getElementById('bm-display');
    el.textContent = (bonusMalus > 0 ? '+' : '') + bonusMalus;
    el.className = 'bm-display' + (bonusMalus > 0 ? ' positive' : bonusMalus < 0 ? ' negative' : '');
    // Update only the percentage text in existing skill elements — no DOM rebuild
    document.getElementById('skill-list').querySelectorAll('.skill-item').forEach((div, i) => {
        const skill = (character.skills || [])[i];
        if (skill) div.querySelector('.skill-pct').textContent = Math.max(1, Math.min(100, skill.pct + bonusMalus)) + '%';
    });
    document.getElementById('special-list').querySelectorAll('.skill-item').forEach((div, i) => {
        const sp = (character.specials || [])[i];
        if (sp) div.querySelector('.skill-pct').textContent = Math.max(1, Math.min(100, sp.pct + bonusMalus)) + '%';
    });
}

// ═══════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════
function renderAll() {
    document.getElementById('char-display').textContent = `${character.name} — ${character.class}`;
    document.title = character.name ? `ARIA – ${character.name}` : 'ARIA – Joueur';
    renderSkills();
    renderStats();
    updateHPDisplay();
    renderInventorySidebar();
    renderCombatSidebar();
    renderPotions();
    renderEditorForm();
    renderPlayerFiles();
}

function renderSkills() {
    const list = document.getElementById('skill-list');
    list.innerHTML = '';
    (character.skills || []).forEach(skill => {
        const eff = Math.max(1, Math.min(100, skill.pct + bonusMalus));
        const div = document.createElement('div');
        const isSoigner = skill.name === 'Soigner';
        div.className = 'skill-item' + (isSoigner ? ' soigner-skill' : '');
        div.innerHTML = `<span class="skill-link">${skill.link || ''}</span><span class="skill-name">${skill.name}</span><span class="skill-pct">${eff}%</span>`;
        if (isSoigner) {
            div.addEventListener('click', () => openSoignerTargetPicker(skill.pct));
        } else {
            div.addEventListener('click', () => doRoll(skill.name, skill.pct));
        }
        list.appendChild(div);
    });
    const slist = document.getElementById('special-list');
    slist.innerHTML = '';
    (character.specials || []).forEach(sp => {
        const eff = Math.max(1, Math.min(100, sp.pct + bonusMalus));
        const div = document.createElement('div');
        div.className = 'skill-item';
        div.style.borderColor = 'rgba(123,63,160,.3)';
        div.innerHTML = `<span class="skill-link" style="color:var(--card-purple)">Spéciale</span><span class="skill-name">${sp.name}${sp.desc ? ` <span style="font-size:12px;color:var(--parchment-dim)">— ${sp.desc}</span>` : ''}</span><span class="skill-pct" style="color:var(--card-purple)">${eff}%</span>`;
        div.addEventListener('click', () => doRoll(sp.name, sp.pct));
        slist.appendChild(div);
    });
}

function renderStats() {
    const bar = document.getElementById('mult-bar-btns');
    bar.innerHTML = [1, 2, 3, 4, 5].map(m =>
        `<button class="mult-btn${multiplier === m ? ' active' : ''}" onclick="setMult(${m})">${m > 1 ? '×' + m : '×1'}</button>`
    ).join('');
    const grid = document.getElementById('stat-grid');
    grid.innerHTML = '';
    ['FOR', 'DEX', 'END', 'INT', 'CHA'].forEach(key => {
        const val = character.stats[key] || 0;
        const threshold = Math.min(100, val * multiplier + bonusMalus);
        const showThreshold = multiplier > 1;
        const div = document.createElement('div');
        div.className = 'stat-card';
        div.onclick = () => rollStat(key, val);
        div.innerHTML = `<div class="stat-key">${key}</div>
          <div class="stat-val"${showThreshold ? ` style="color:var(--gold);"` : ''}>
            ${showThreshold ? threshold : val}
          </div>`;
        grid.appendChild(div);
    });
}
function setMult(m) {
    multiplier = m;
    renderStats();
}

function renderInventorySidebar() {
    const body = document.getElementById('inv-sidebar-body');
    const items = character.inventory || [];
    const vials = character.vials ?? 0;
    const showVials = playerTabs.alchemy && vials > 0;
    if (!items.length && !showVials) { body.innerHTML = `<div style="font-family:'EB Garamond',serif;font-size:13px;color:var(--parchment-dim);font-style:italic;opacity:.5;">Vide</div>`; return; }
    let html = showVials ? `<div class="inv-item"><span style="font-style:italic">Fioles vides</span><span style="color:var(--gold-dim);font-family:'Cinzel',serif;font-size:12px;">×${vials}</span></div>` : '';
    html += items.map(it => `<div class="inv-item"><span style="font-style:italic">${it.name || '—'}</span><span style="color:var(--gold-dim);font-family:'Cinzel',serif;font-size:12px;">×${it.qty || 1}</span></div>`).join('');
    body.innerHTML = html;
}

function renderCombatSidebar() {
    const body = document.getElementById('combat-sidebar-body');
    if (!body) return;
    const weapons = (character.weapons || []).filter(w => w.nom.trim());
    const prot = character.protection || {};
    let html = '';
    if (weapons.length) {
        weapons.forEach(w => {
            const hasFormula = w.degats && w.degats.trim();
            const rollAttr = hasFormula ? ` onclick="rollWeaponDamage('${w.nom.replace(/'/g,"\\'")}','${w.degats.replace(/'/g,"\\'")}')"` : '';
            const rollableClass = hasFormula ? ' weap-rollable' : '';
            const hint = hasFormula ? `<span class="weap-roll-hint">⚄ lancer</span>` : '';
            html += `<div class="weap-row${rollableClass}"${rollAttr}><span style="font-family:'EB Garamond',serif;font-size:14px;font-style:italic;">${w.nom}</span><span style="display:flex;align-items:center;gap:6px;font-family:'Cinzel',serif;font-size:12px;color:var(--gold-dim);">${hint}${w.degats || '—'}</span></div>`;
        });
    } else {
        html += `<div style="font-family:'EB Garamond',serif;font-size:13px;color:var(--parchment-dim);font-style:italic;opacity:.5;">Aucune arme</div>`;
    }
    html += `<div style="margin:8px 0 6px;border-top:1px solid var(--border);"></div>`;
    html += `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.15em;color:var(--gold-dim);text-transform:uppercase;">Protection</span><span style="font-family:'Cinzel',serif;font-size:12px;">${prot.nom || '—'} ${prot.valeur ? `<span style="color:var(--gold)">${prot.valeur}</span>` : ''}</span></div>`;

    // Reaction buttons — look up Parade and Esquiver in the character's skills/specials
    const allSkills = [...(character.skills || []), ...(character.specials || [])];
    const parrySkill = allSkills.find(s => /combat.rapproch/i.test(s.name));
    const dodgeSkill = allSkills.find(s => /esquiv/i.test(s.name));
    if (parrySkill || dodgeSkill) {
        html += `<div style="margin:8px 0 6px;border-top:1px solid var(--border);"></div>`;
        html += `<div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.15em;color:var(--gold-dim);text-transform:uppercase;margin-bottom:6px;">Réactions</div>`;
        html += `<div class="react-btns">`;
        if (parrySkill) {
            const eff = Math.max(1, Math.min(100, parrySkill.pct + bonusMalus));
            html += `<button class="react-btn" onclick="doRoll('${parrySkill.name.replace(/'/g, "\\'")}',${parrySkill.pct})">🛡 ${parrySkill.name}<br><span class="react-pct">${eff}%</span></button>`;
        }
        if (dodgeSkill) {
            const eff = Math.max(1, Math.min(100, dodgeSkill.pct + bonusMalus));
            html += `<button class="react-btn" onclick="doRoll('${dodgeSkill.name.replace(/'/g, "\\'")}',${dodgeSkill.pct})">⚡ ${dodgeSkill.name}<br><span class="react-pct">${eff}%</span></button>`;
        }
        html += `</div>`;
    }

    body.innerHTML = html;
}

// ═══════════════════════════════════════════
//  ROLLS
// ═══════════════════════════════════════════
function doFreeRoll() {
    const name = document.getElementById('free-name').value.trim() || 'Jet libre';
    const t = parseInt(document.getElementById('free-threshold').value);
    if (isNaN(t) || t < 1 || t > 100) { alert('Seuil invalide (1-100).'); return; }
    doRoll(name, t, true);
}
// Roll a single die via dddice (3D animation); falls back to Math.random when SDK not ready.
// d3 is simulated as d6 with ceil(v/2) mapping.
async function rollDieViaDddice(sides, callback) {
    if (!dddiceAPI || !dddiceSDK || pendingDddiceRoll || pendingSecondaryRoll) {
        callback(Math.floor(Math.random() * sides) + 1);
        return;
    }
    const dieType = sides === 3 ? 'd6' : `d${sides}`;
    const mapFn   = sides === 3 ? v => Math.ceil(v / 2) : null;
    pendingSecondaryRoll = { callback, mapFn };
    showDddiceCanvas();
    dddiceRollSafetyTimer = setTimeout(() => {
        if (pendingSecondaryRoll) {
            pendingSecondaryRoll = null;
            hideDddiceCanvas();
            const v = Math.floor(Math.random() * sides) + 1;
            callback(v);
        }
    }, 12000);
    try {
        await dddiceSDK.roll([{ type: dieType, theme: dddiceAPI.theme }]);
    } catch (e) {
        clearTimeout(dddiceRollSafetyTimer);
        pendingSecondaryRoll = null;
        hideDddiceCanvas();
        callback(Math.floor(Math.random() * sides) + 1);
    }
}
// Parse "2d6+2" → { dice: ['d6','d6'], modifier: 2 }
function formulaToDiceSpec(formula) {
    const tokens = formula.replace(/\s+/g,'').toLowerCase().split(/(?=[+-])/);
    const dice = []; let modifier = 0;
    for (const token of tokens) {
        if (!token) continue;
        const sign = token[0] === '-' ? -1 : 1;
        const raw  = token.replace(/^[+-]/,'');
        const m = raw.match(/^(\d+)d(\d+)$/);
        if (m) { for (let i = 0; i < +m[1]; i++) dice.push(`d${m[2]}`); }
        else    { modifier += sign * (+raw || 0); }
    }
    return { dice, modifier };
}
function rollDie(sides) {
    if (pendingDddiceRoll || pendingSecondaryRoll) return;
    rollDieViaDddice(sides, result => {
        showDieCard(`d${sides}`, result);
        publishRoll({ skillName: `d${sides}`, threshold: null, roll: result, success: null, char: character.name, bonusMalus: 0, playerId });
    });
}

// Parse and roll a dice formula like "2d6+2", "1d8-1", "3d4", "5"
function rollDiceFormula(formula) {
    const expr = (formula || '').replace(/\s+/g, '').toLowerCase();
    if (!expr) return { total: 0, breakdown: '0' };
    // Split on + or - keeping the sign with the following term
    const tokens = expr.split(/(?=[+-])/);
    let total = 0;
    const parts = [];
    for (const token of tokens) {
        if (!token) continue;
        const sign = token[0] === '-' ? -1 : 1;
        const raw = token.replace(/^[+-]/, '');
        const diceMatch = raw.match(/^(\d+)d(\d+)$/);
        if (diceMatch) {
            const count = parseInt(diceMatch[1]);
            const sides = parseInt(diceMatch[2]);
            const rolls = [];
            for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
            const sub = rolls.reduce((a, b) => a + b, 0);
            total += sign * sub;
            const prefix = sign < 0 ? '−' : parts.length ? '+' : '';
            parts.push(`${prefix}[${rolls.join('+')}]`);
        } else {
            const num = parseInt(raw);
            if (!isNaN(num)) {
                total += sign * num;
                parts.push(`${sign < 0 ? '−' : parts.length ? '+' : ''}${num}`);
            }
        }
    }
    return { total, breakdown: parts.join(' ') };
}

function _showWeaponDamageResult(name, formula, result) {
    const card = document.getElementById('float-roll-card');
    const scrim = document.getElementById('roll-scrim');
    card.className = 'float-roll-card';
    clearTimeout(floatCardTimer);
    document.getElementById('fc-char').textContent = name;
    document.getElementById('fc-skill').textContent = formula;
    document.getElementById('fc-roll').textContent = result.total;
    document.getElementById('fc-bonus').textContent = result.breakdown !== String(result.total) ? result.breakdown : '';
    const vEl = document.getElementById('fc-verdict');
    vEl.textContent = 'Dégâts'; vEl.className = 'fc-verdict fv-success';
    document.getElementById('fc-crit-sub').textContent = '';
    void card.offsetWidth;
    scrim.classList.add('show');
    card.classList.add('show');
    floatCardTimer = setTimeout(dismissFloatCard, 5000);
    publishRoll({ skillName: `${name} (dégâts)`, threshold: null, roll: result.total, success: null, char: character.name, bonusMalus: 0, playerId });
}
async function rollWeaponDamage(name, formula) {
    if (!formula || !formula.trim()) return;
    if (pendingDddiceRoll || pendingSecondaryRoll || !dddiceAPI || !dddiceSDK) {
        _showWeaponDamageResult(name, formula, rollDiceFormula(formula));
        return;
    }
    const { dice, modifier } = formulaToDiceSpec(formula);
    if (!dice.length) { _showWeaponDamageResult(name, formula, rollDiceFormula(formula)); return; }
    pendingSecondaryRoll = {
        callback: diceTotal => {
            const total = diceTotal + modifier;
            const breakdown = modifier !== 0 ? `${diceTotal}${modifier > 0 ? '+' : ''}${modifier}` : String(diceTotal);
            _showWeaponDamageResult(name, formula, { total, breakdown });
        },
        mapFn: null
    };
    showDddiceCanvas();
    dddiceRollSafetyTimer = setTimeout(() => {
        if (pendingSecondaryRoll) {
            pendingSecondaryRoll = null;
            hideDddiceCanvas();
            _showWeaponDamageResult(name, formula, rollDiceFormula(formula));
        }
    }, 12000);
    try {
        await dddiceSDK.roll(dice.map(d => ({ type: d, theme: dddiceAPI.theme })));
    } catch (e) {
        clearTimeout(dddiceRollSafetyTimer);
        pendingSecondaryRoll = null;
        hideDddiceCanvas();
        _showWeaponDamageResult(name, formula, rollDiceFormula(formula));
    }
}
function showDieCard(diceName, result) {
    const card = document.getElementById('float-roll-card');
    const scrim = document.getElementById('roll-scrim');
    card.className = 'float-roll-card';
    clearTimeout(floatCardTimer);
    document.getElementById('fc-char').textContent = '';
    document.getElementById('fc-skill').textContent = diceName;
    document.getElementById('fc-roll').textContent = result;
    document.getElementById('fc-bonus').textContent = '';
    const vEl = document.getElementById('fc-verdict');
    vEl.textContent = ''; vEl.className = 'fc-verdict';
    document.getElementById('fc-crit-sub').textContent = '';
    void card.offsetWidth;
    scrim.classList.add('show');
    card.classList.add('show');
    floatCardTimer = setTimeout(dismissFloatCard, 5000);
}
function doRoll(skillName, basePct, skipBM = false) {
    if (isRolling) return;
    const threshold = skipBM ? Math.max(1, Math.min(100, basePct)) : Math.max(1, Math.min(100, basePct + bonusMalus));
    setRolling(true);
    if (dddiceAPI) rollViaDddice(skillName, threshold);
    else setTimeout(() => handleResult(skillName, threshold, Math.floor(Math.random() * 100) + 1), 600);
}
function rollStat(key, val) {
    const t = Math.max(1, Math.min(100, val * multiplier + bonusMalus));
    doRoll(`${multiplier > 1 ? multiplier + '× ' : ''}${key}`, val * multiplier);
}
function handleResult(skillName, threshold, roll) {
    const success = roll <= threshold;
    const data = { skillName, threshold, roll, success, char: character.name, bonusMalus, playerId };
    setRolling(false);
    showFloatCard(data);
    publishRoll(data);
    if (skillName === 'Soigner') applySoigner(success);
    if (pendingCraft !== null) { applyCraft(success, pendingCraft); pendingCraft = null; }
}
function openSoignerTargetPicker(pct) {
    soignerPct = pct;
    const now = Date.now();
    const others = Object.entries(knownPlayers)
        .filter(([, p]) => now - p.ts < 30000)
        .map(([id, p]) => ({ id, name: p.name }));
    const container = document.getElementById('stm-targets');
    container.innerHTML = '';
    const selfBtn = document.createElement('button');
    selfBtn.className = 'stm-btn';
    selfBtn.textContent = `Soi-même (${character.name})`;
    selfBtn.onclick = () => { soignerTarget = null; closeSoignerTargetPicker(); doRoll('Soigner', soignerPct); };
    container.appendChild(selfBtn);
    others.forEach(({ id, name }) => {
        const btn = document.createElement('button');
        btn.className = 'stm-btn';
        btn.textContent = name;
        btn.onclick = () => { soignerTarget = { playerId: id, name }; closeSoignerTargetPicker(); doRoll('Soigner', soignerPct); };
        container.appendChild(btn);
    });
    document.getElementById('soigner-scrim').classList.add('show');
    document.getElementById('soigner-target-modal').classList.add('show');
}
function closeSoignerTargetPicker() {
    document.getElementById('soigner-scrim').classList.remove('show');
    document.getElementById('soigner-target-modal').classList.remove('show');
}
function cancelSoigner() {
    soignerTarget = null;
    closeSoignerTargetPicker();
}
function applySoigner(success) {
    const target = soignerTarget; // capture before async delay
    soignerTarget = null;
    // Small delay so the float card resolves first, then roll the secondary die via dddice
    setTimeout(() => {
        if (success) {
            rollDieViaDddice(6, heal => {
                publishRoll({ skillName: 'Soigner (soins)', threshold: null, roll: heal, success: null, char: character.name, bonusMalus: 0, playerId });
                if (!target) {
                    const max = getMaxHP();
                    const before = currentHP;
                    const after = Math.min(max, before + heal);
                    animateHPChange(before, after, max);
                    currentHP = after;
                    localStorage.setItem(hpKey(), currentHP); debouncedSync();
                    updateHPDisplay();
                    showHealNumber(heal);
                    showToast('gm-heal-toast', `♥ Soins : +${heal} PV`);
                    sendPresence();
                } else {
                    if (ablyDamage) ablyDamage.publish('heal', { targetId: target.playerId, amount: heal, source: 'player' });
                    showToast('gm-heal-toast', `♥ Soins : +${heal} PV → ${target.name}`);
                }
            });
        } else {
            rollDieViaDddice(3, dmg => {
                publishRoll({ skillName: 'Soigner (blessure)', threshold: null, roll: dmg, success: null, char: character.name, bonusMalus: 0, playerId });
                if (!target) {
                    const max = getMaxHP();
                    const before = currentHP;
                    const after = Math.max(0, before - dmg);
                    animateHPChange(before, after, max);
                    currentHP = after;
                    localStorage.setItem(hpKey(), currentHP); debouncedSync();
                    updateHPDisplay();
                    triggerDamageVFX(dmg, true);
                    showToast('gm-dmg-toast', `⚔ Blessure : -${dmg} PV`);
                    if (after <= 0) showMort();
                    sendPresence();
                } else {
                    if (ablyDamage) ablyDamage.publish('damage', { targetId: target.playerId, damage: dmg, source: 'player' });
                    showToast('gm-dmg-toast', `⚔ Blessure : -${dmg} PV → ${target.name}`);
                }
            });
        }
    }, 1500);
}
function classify(roll, threshold, success) {
    if (roll <= 10 && success) return 'crit-success';
    if (roll >= 91 && !success) return 'crit-fail';
    return success ? 'success' : 'fail';
}
let floatCardTimer = null;
function showFloatCard(data) {
    const card = document.getElementById('float-roll-card');
    const scrim = document.getElementById('roll-scrim');
    const type = classify(data.roll, data.threshold, data.success);
    card.className = 'float-roll-card';
    clearTimeout(floatCardTimer);
    document.getElementById('fc-char').textContent = data.char || '';
    document.getElementById('fc-skill').textContent = data.skillName;
    document.getElementById('fc-roll').textContent = data.roll;
    document.getElementById('fc-bonus').textContent = data.bonusMalus && data.bonusMalus !== 0 ? `(Modificateur : ${data.bonusMalus > 0 ? '+' : ''}${data.bonusMalus})` : '';
    const vEl = document.getElementById('fc-verdict');
    const sEl = document.getElementById('fc-crit-sub');
    sEl.textContent = '';
    switch (type) {
        case 'crit-success': vEl.textContent = 'SUCCÈS CRITIQUE'; vEl.className = 'fc-verdict fv-crit-success'; sEl.textContent = '✦ les dieux sourient ✦'; card.classList.add('crit-success'); spawnFcParticles('success'); break;
        case 'crit-fail': vEl.textContent = 'ÉCHEC CRITIQUE'; vEl.className = 'fc-verdict fv-crit-fail'; sEl.textContent = '✦ les dieux se détournent ✦'; card.classList.add('crit-fail'); spawnFcParticles('fail'); break;
        case 'success': vEl.textContent = 'SUCCÈS'; vEl.className = 'fc-verdict fv-success'; break;
        case 'fail': vEl.textContent = 'ÉCHEC'; vEl.className = 'fc-verdict fv-fail'; break;
    }
    void card.offsetWidth;
    scrim.classList.add('show');
    card.classList.add('show');
    const dur = (type === 'crit-success' || type === 'crit-fail') ? 8000 : 5000;
    floatCardTimer = setTimeout(dismissFloatCard, dur);
}
function dismissFloatCard() {
    clearTimeout(floatCardTimer);
    const card = document.getElementById('float-roll-card');
    const scrim = document.getElementById('roll-scrim');
    card.classList.remove('show');
    card.classList.add('leaving');
    scrim.classList.remove('show');
    stopFcParticles();
    setTimeout(() => { card.className = 'float-roll-card'; }, 320);
}
function setRolling(v) {
    isRolling = v;
    document.getElementById('rolling-ind').classList.toggle('active', v);
}

// ═══════════════════════════════════════════
//  ROLL PARTICLES
// ═══════════════════════════════════════════
const fcCanvas = document.getElementById('fc-particles');
const fcCtx = fcCanvas.getContext('2d');
let fcParticles = [], fcAnimFrame = null;
function resizeFcCanvas() { fcCanvas.width = window.innerWidth; fcCanvas.height = window.innerHeight; }
resizeFcCanvas();
window.addEventListener('resize', resizeFcCanvas);
function spawnFcParticles(type) {
    fcParticles = [];
    const cx = fcCanvas.width / 2, cy = fcCanvas.height / 2;
    for (let i = 0; i < 70; i++) {
        const angle = Math.random() * Math.PI * 2, speed = 2.5 + Math.random() * 5.5;
        let hue, sat, lit;
        if (type === 'success') { hue = Math.random() > .45 ? 110 + Math.random() * 30 : 42 + Math.random() * 15; sat = 80 + Math.random() * 20; lit = 55 + Math.random() * 35; }
        else { hue = Math.random() > .4 ? Math.random() * 15 : 18 + Math.random() * 12; sat = 85 + Math.random() * 15; lit = 45 + Math.random() * 35; }
        fcParticles.push({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5, r: 2.5 + Math.random() * 4, color: `hsl(${hue},${sat}%,${lit}%)`, alpha: 1, gravity: .1 + Math.random() * .1, decay: .011 + Math.random() * .014, star: Math.random() > .55 });
    }
    if (fcAnimFrame) cancelAnimationFrame(fcAnimFrame);
    loopFcParticles();
}
function loopFcParticles() {
    fcCtx.clearRect(0, 0, fcCanvas.width, fcCanvas.height);
    fcParticles = fcParticles.filter(p => p.alpha > .02);
    for (const p of fcParticles) {
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.alpha -= p.decay;
        fcCtx.save(); fcCtx.globalAlpha = Math.max(0, p.alpha); fcCtx.fillStyle = p.color; fcCtx.shadowColor = p.color; fcCtx.shadowBlur = 8; fcCtx.translate(p.x, p.y);
        if (p.star) { drawFcStar(fcCtx, p.r); } else { fcCtx.beginPath(); fcCtx.arc(0, 0, p.r / 2, 0, Math.PI * 2); fcCtx.fill(); }
        fcCtx.restore();
    }
    if (fcParticles.length) fcAnimFrame = requestAnimationFrame(loopFcParticles);
    else { fcCtx.clearRect(0, 0, fcCanvas.width, fcCanvas.height); fcAnimFrame = null; }
}
function drawFcStar(ctx, r) { const spikes = 4, out = r / 2, inn = r / 5; let rot = -Math.PI / 2; ctx.beginPath(); for (let i = 0; i < spikes * 2; i++) { const radius = i % 2 === 0 ? out : inn; ctx.lineTo(Math.cos(rot) * radius, Math.sin(rot) * radius); rot += Math.PI / spikes; } ctx.closePath(); ctx.fill(); }
function stopFcParticles() { if (fcAnimFrame) { cancelAnimationFrame(fcAnimFrame); fcAnimFrame = null; } fcCtx.clearRect(0, 0, fcCanvas.width, fcCanvas.height); fcParticles = []; }

// ═══════════════════════════════════════════
//  DDDICE
// ═══════════════════════════════════════════
function extractRoomSlug(val) {
    if (!val) return '';
    const m = val.match(/\/room\/([^/?#]+)/);
    return m ? m[1] : val.trim();
}
async function initDddice() {
    const slug = extractRoomSlug(config.dddiceRoom);
    if (!config.dddiceKey || !slug) return;
    try {
        // Load the dddice browser SDK (embeds 3D dice renderer)
        const { ThreeDDice, ThreeDDiceRollEvent } = await import('https://esm.sh/dddice-js');

        // Fetch available themes for the dropdown
        const h = { 'Authorization': `Bearer ${config.dddiceKey}`, 'Accept': 'application/json' };
        const boxRes = await fetch('https://dddice.com/api/1.0/dice-box', { headers: h });
        if (!boxRes.ok) throw new Error(`Dice box HTTP ${boxRes.status}`);
        const themes = (await boxRes.json()).data || [];
        if (!themes.length) throw new Error('Aucun thème.');

        const sel = document.getElementById('cfg-dddice-theme');
        sel.innerHTML = '';
        themes.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name ? `${t.name} (${t.id})` : t.id; sel.appendChild(o); });
        sel.disabled = false;
        sel.value = config.dddiceTheme && themes.find(t => t.id === config.dddiceTheme) ? config.dddiceTheme : themes[0].id;

        // Create the SDK renderer on the canvas, connect to the room
        const canvas = document.getElementById('dddice-canvas');
        dddiceSDK = new ThreeDDice(canvas, config.dddiceKey);
        dddiceSDK.start();
        await dddiceSDK.connect(slug);

        // When the 3D animation finishes, read the result and handle it.
        // Only act when this tab initiated the roll (pending state is set).
        // Other players' roll animations never show because the wrapper div is visibility:hidden
        // by default and only shown when this tab calls showDddiceCanvas() before rolling.
        // The SDK holds a ref to the canvas element only, not the wrapper — so it cannot
        // override the wrapper's visibility.
        dddiceSDK.on(ThreeDDiceRollEvent.RollFinished, (roll) => {
            if (pendingDddiceRoll) {
                clearTimeout(dddiceRollSafetyTimer);
                const { skillName, threshold } = pendingDddiceRoll;
                pendingDddiceRoll = null;
                setTimeout(() => { dddiceSDK?.clear(); hideDddiceCanvas(); }, 1500);
                const total = roll.total_value ?? 0;
                handleResult(skillName, threshold, total === 0 ? 100 : total);
            } else if (pendingSecondaryRoll) {
                clearTimeout(dddiceRollSafetyTimer);
                const { callback, mapFn } = pendingSecondaryRoll;
                pendingSecondaryRoll = null;
                setTimeout(() => { dddiceSDK?.clear(); hideDddiceCanvas(); }, 1500);
                const total = roll.total_value ?? 1;
                callback(mapFn ? mapFn(total) : total);
            }
            // else: not our roll — canvas is already hidden, nothing to do
        });

        dddiceAPI = { key: config.dddiceKey, room: slug, theme: sel.value };
        setDddiceStatus(true, themes.find(t => t.id === sel.value)?.name || sel.value);
        sel.onchange = () => { if (dddiceAPI) dddiceAPI.theme = sel.value; config.dddiceTheme = sel.value; localStorage.setItem('aria-config', JSON.stringify(config)); };

        // Preload 3D assets without creating a server-side roll, so the first real roll is instant.
        // loadThemeResources is an internal SDK method — call it directly to warm up models/textures/sounds.
        try {
            if (typeof dddiceSDK.loadThemeResources === 'function') {
                await dddiceSDK.loadThemeResources([
                    { type: 'd10x', theme: dddiceAPI.theme },
                    { type: 'd10', theme: dddiceAPI.theme }
                ]);
            }
        } catch (_) {}
    } catch (e) { console.error('dddice:', e); setDddiceStatus(false, e.message); dddiceSDK = null; dddiceAPI = null; }
}
function showDddiceCanvas() { const w = document.getElementById('dddice-wrap'); if (w) w.style.visibility = 'visible'; }
function hideDddiceCanvas() { const w = document.getElementById('dddice-wrap'); if (w) w.style.visibility = 'hidden'; }

async function rollViaDddice(skillName, threshold) {
    if (!dddiceSDK) { handleResult(skillName, threshold, Math.floor(Math.random() * 100) + 1); return; }
    try {
        pendingDddiceRoll = { skillName, threshold };
        showDddiceCanvas();
        // Safety fallback: if RollFinished never fires (e.g. network drop after roll creation),
        // unblock the UI after 12s. Cleared by the RollFinished handler on success.
        dddiceRollSafetyTimer = setTimeout(() => {
            if (pendingDddiceRoll?.skillName === skillName) {
                pendingDddiceRoll = null;
                hideDddiceCanvas();
                handleResult(skillName, threshold, Math.floor(Math.random() * 100) + 1);
            }
        }, 12000);
        await dddiceSDK.roll([{ type: 'd10x', theme: dddiceAPI.theme }, { type: 'd10', theme: dddiceAPI.theme }]);
        // Do NOT clear the timer here — roll() resolves on API response (~200ms),
        // well before the animation ends. RollFinished handles the clear.
    } catch (e) { console.error('dddice roll:', e); pendingDddiceRoll = null; hideDddiceCanvas(); handleResult(skillName, threshold, Math.floor(Math.random() * 100) + 1); }
}
function setDddiceStatus(ok, detail) {
    const d = ['dddice-dot', 'cfg-dddice-dot'], s = ['dddice-status', 'cfg-dddice-status'];
    d.forEach(id => { const el = document.getElementById(id); if (el) el.className = 'status-dot ' + (ok ? 'connected' : 'error'); });
    s.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ok ? `dddice: ${detail || 'connecté'}` : `Erreur: ${detail || 'dddice'}`; });
}

// ═══════════════════════════════════════════
//  ABLY
// ═══════════════════════════════════════════
function initAbly() {
    try {
        ablyInstance = new Ably.Realtime({ key: config.ablyKey, transports: ['web_socket'] });
        ablyRolls = ablyInstance.channels.get('aria-rolls');
        ablyCards = ablyInstance.channels.get('aria-cards');
        ablyDamage = ablyInstance.channels.get('aria-damage');
        ablyInstance.connection.on('connected', () => { setAblyStatus(true); sendPresence(); });
        ablyInstance.connection.on('failed', () => setAblyStatus(false));
        // Listen for GM damage/heal targeted at this player
        const myId = playerId;
        ablyDamage.subscribe(msg => {
            const d = msg.data;
            if (!d) return;
            // Track other players' presence for Soigner targeting
            if (msg.name === 'presence' && d.playerId && d.playerId !== myId) {
                knownPlayers[d.playerId] = { name: d.name, ts: Date.now() };
                return;
            }
            // Handle player-to-player heal/damage (from another player's Soigner)
            if (d.source === 'player') {
                if (d.targetId === myId) {
                    if (msg.name === 'heal') {
                        const amount = d.amount || 0;
                        const max = getMaxHP();
                        const before = currentHP;
                        const after = Math.min(max, before + amount);
                        handleGMHeal({ amount, hpBefore: before, hpAfter: after, maxHP: max });
                        sendPresence();
                    } else if (msg.name === 'damage') {
                        const damage = d.damage || 0;
                        const max = getMaxHP();
                        const before = currentHP;
                        const after = Math.max(0, before - damage);
                        handleGMDamage({ damage, hpBefore: before, hpAfter: after, maxHP: max });
                        sendPresence();
                    }
                }
                return;
            }
            if (msg.name === 'tab-config') {
                if (d.playerId !== myId) return;
                playerTabs = { ...playerTabs, ...d.tabs };
                localStorage.setItem('aria-player-tabs-' + currentCharId, JSON.stringify(playerTabs));
                debouncedSync();
                applyTabVisibility();
                return;
            }
            if (msg.name === 'potion-grant') {
                if (d.playerId !== myId) return;
                if (!d.potion) return;
                if (!character.potionRecipes) character.potionRecipes = [];
                if (!character.potionRecipes.find(r => r.id === d.potion.id)) {
                    character.potionRecipes.push({ ...d.potion });
                    saveCurrentCharacter();
                    renderPotions();
                    showToast('gm-heal-toast', `Recette reçue : ${d.potion.name}`);
                }
                return;
            }
            if (msg.name === 'potion-revoke') {
                if (d.playerId !== myId) return;
                character.potionRecipes = (character.potionRecipes || []).filter(r => r.id !== d.potionId);
                saveCurrentCharacter();
                renderPotions();
                return;
            }
            if (msg.name === 'vial-grant') {
                if (d.playerId !== myId) return;
                character.vials = (character.vials ?? 0) + (d.qty || 1);
                saveCurrentCharacter();
                renderPotions();
                const n = d.qty || 1;
                showToast('gm-heal-toast', `${n} fiole${n > 1 ? 's' : ''} reçue${n > 1 ? 's' : ''}`);
                return;
            }
            if (msg.name === 'file-grant') {
                if (d.playerId !== myId && d.playerId !== 'all') return;
                if (!d.file?.id) return;
                if (!playerFiles.find(f => f.id === d.file.id)) {
                    playerFiles.push(d.file);
                    localStorage.setItem('aria-player-files-' + currentCharId, JSON.stringify(playerFiles));
                    debouncedSync();
                    applyTabVisibility();
                    renderPlayerFiles();
                    showToast('gm-heal-toast', `Document reçu : ${d.file.name}`);
                }
                return;
            }
            if (msg.name === 'file-revoke') {
                if (d.playerId !== myId && d.playerId !== 'all') return;
                if (!d.fileId) return;
                playerFiles = playerFiles.filter(f => f.id !== d.fileId);
                localStorage.setItem('aria-player-files-' + currentCharId, JSON.stringify(playerFiles));
                debouncedSync();
                applyTabVisibility();
                renderPlayerFiles();
                return;
            }
            if (d.targetId && d.targetId !== myId) return;
            if (msg.name === 'damage') handleGMDamage(d);
            if (msg.name === 'heal') handleGMHeal(d);
        });
        // Listen for other players' rolls — show a brief toast
        ablyRolls.subscribe('roll', msg => {
            const d = msg.data;
            if (!d || d.playerId === myId) return; // skip own rolls
            showOtherRollToast(d);
        });
    } catch (e) { console.error('Ably:', e); setAblyStatus(false); }
}
function publishRoll(data) { if (ablyRolls) ablyRolls.publish('roll', data); }
function copyOverlayUrl() {
    const base = window.location.href.replace(/aria-player\.html.*$/, 'aria-overlay.html');
    const params = new URLSearchParams({ mode: 'player', ably: config.ablyKey || '' });
    if (config.dddiceKey) params.set('dddice_key', config.dddiceKey);
    if (config.dddiceRoom) params.set('dddice_room', extractRoomSlug(config.dddiceRoom));
    const url = `${base}?${params}`;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.querySelector('.config-modal button[onclick="copyOverlayUrl()"]');
        const orig = btn.textContent;
        btn.textContent = '✓ Copié !';
        setTimeout(() => btn.textContent = orig, 2000);
    });
}
function publishCard(type, extra = {}) {
    if (ablyCards) ablyCards.publish(type, { ...extra, excluded: [...cardExcluded], drawn: [...cardDrawn], deckIds: cardDeck.map(c => c.id), lastCardId });
}
function sendPresence() {
    if (!ablyDamage) { console.warn('[ARIA] sendPresence: ablyDamage not ready'); return; }
    ablyDamage.publish('presence', {
        playerId, charId: currentCharId, name: character.name, charClass: character.class,
        hp: currentHP, maxHP: getMaxHP(), stats: character.stats,
        protection: character.protection,
        skills: character.skills,
        specials: character.specials,
        weapons: character.weapons,
        inventory: character.inventory,
        potions: character.potions,
        vials: character.vials ?? 0,
        potionRecipeIds: (character.potionRecipes || []).map(r => r.id),
        tabs: playerTabs,
        campaignKey: character.campaignKey || '',
    }, err => { if (err) console.error('[ARIA] publish error:', err); });
}
function setAblyStatus(ok) {
    ['ably-dot', 'cfg-ably-dot2'].forEach(id => { const el = document.getElementById(id); if (el) el.className = 'status-dot ' + (ok ? 'connected' : 'error'); });
    ['ably-status', 'cfg-ably-status2'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ok ? 'Ably connecté' : 'Ably erreur'; });
}

// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════
function applyTheme(light) {
    document.body.classList.toggle('light-mode', !!light);
}
function loadConfigInputs() {
    const idEl = document.getElementById('cfg-identity-display');
    if (idEl) idEl.textContent = character.name || '—';
    document.getElementById('cfg-campaign-key').value = character.campaignKey || '';
    document.getElementById('cfg-dddice-theme').value = config.dddiceTheme || '';
    document.getElementById('cfg-light-mode').checked = !!config.lightMode;
}
function saveConfig() {
    character.campaignKey = document.getElementById('cfg-campaign-key').value.trim().toUpperCase();
    saveCurrentCharacter();
    config = {
        ...config,
        dddiceTheme: document.getElementById('cfg-dddice-theme').value || '',
        lightMode: document.getElementById('cfg-light-mode').checked,
    };
    localStorage.setItem('aria-config', JSON.stringify(config));
    if (dddiceSDK) { try { dddiceSDK.disconnect?.(); } catch (_) {} dddiceSDK = null; }
    clearTimeout(dddiceRollSafetyTimer);
    pendingDddiceRoll = null;
    dddiceAPI = null; ablyRolls = null; ablyCards = null; ablyDamage = null; ablyInstance = null;
    if (config.dddiceKey && config.dddiceRoom) initDddice();
    if (config.ablyKey) initAbly();
}
function toggleConfig() {
    document.getElementById('config-modal').classList.toggle('show');
    document.getElementById('config-scrim').classList.toggle('show');
}

// ═══════════════════════════════════════════
//  CHARACTER EDITOR
// ═══════════════════════════════════════════
function renderEditorForm() {
    document.getElementById('ed-name').value = character.name;
    document.getElementById('ed-class').value = character.class || '';
    document.getElementById('ed-for').value = character.stats.FOR;
    document.getElementById('ed-dex').value = character.stats.DEX;
    document.getElementById('ed-end').value = character.stats.END;
    document.getElementById('ed-int').value = character.stats.INT;
    document.getElementById('ed-cha').value = character.stats.CHA;
    document.getElementById('ed-pv').value = character.stats.PV;
    const p = character.physical || {};
    document.getElementById('ed-age').value = p.age || '';
    document.getElementById('ed-taille').value = p.taille || '';
    document.getElementById('ed-poids').value = p.poids || '';
    document.getElementById('ed-yeux').value = p.yeux || '';
    document.getElementById('ed-cheveux').value = p.cheveux || '';
    document.getElementById('ed-signes').value = p.signes || '';
    const prot = character.protection || {};
    document.getElementById('ed-prot-nom').value = prot.nom || '';
    document.getElementById('ed-prot-val').value = prot.valeur || 0;
    renderWeaponsEditor();
    renderInventoryEditor();
    renderSkillsEditor();
    renderSpecialsEditor();
}
function renderWeaponsEditor() {
    const list = document.getElementById('weapons-editor-list');
    if (!list) return;
    list.innerHTML = '';
    (character.weapons || []).forEach((w, i) => {
        const row = document.createElement('div');
        row.className = 'weap-row';
        row.innerHTML = `<input class="editor-input" value="${w.nom}" placeholder="Nom de l'arme" oninput="character.weapons[${i}].nom=this.value" /><input class="editor-input weap-dmg" value="${w.degats}" placeholder="ex: 2d6+2" oninput="character.weapons[${i}].degats=this.value" />`;
        list.appendChild(row);
    });
}
function renderInventoryEditor() {
    const list = document.getElementById('inv-editor-list');
    if (!list) return;
    list.innerHTML = '';
    (character.inventory || []).forEach((it, i) => {
        const row = document.createElement('div');
        row.className = 'inv-row';
        row.innerHTML = `<input class="editor-input" value="${it.name || ''}" placeholder="Nom de l'objet" oninput="character.inventory[${i}].name=this.value;renderInventorySidebar()" /><input class="editor-input inv-qty" type="text" inputmode="numeric" value="${it.qty || 1}" oninput="this.value=this.value.replace(/[^0-9]/g,'');character.inventory[${i}].qty=+this.value||1;renderInventorySidebar()" /><button class="del-btn" onclick="removeInventoryRow(${i})">✕</button>`;
        list.appendChild(row);
    });
    if (playerTabs.alchemy) {
        const v = character.vials ?? 0;
        const vRow = document.createElement('div');
        vRow.className = 'inv-row';
        vRow.innerHTML = `<span style="font-family:'EB Garamond',serif;font-size:14px;font-style:italic;padding:6px 8px;color:var(--parchment-dim);">Fioles vides</span><input class="editor-input inv-qty" type="text" inputmode="numeric" value="${v}" oninput="this.value=this.value.replace(/[^0-9]/g,'');character.vials=Math.max(0,+this.value||0);saveCurrentCharacter();renderInventorySidebar();renderPotions()" /><span></span>`;
        list.insertBefore(vRow, list.firstChild);
    }
}
function addInventoryRow() { character.inventory.push({ name: '', qty: 1 }); renderInventoryEditor(); renderInventorySidebar(); }
function removeInventoryRow(i) { character.inventory.splice(i, 1); renderInventoryEditor(); renderInventorySidebar(); }

// ── POTIONS ──────────────────────────────────
function renderPotions() {
    const container = document.getElementById('potion-list');
    const empty = document.getElementById('alchemy-empty');
    if (!container) return;
    const recipes = character.potionRecipes || [];
    const potions = character.potions || [];
    const vials = character.vials ?? 0;

    container.innerHTML = '';

    // Vials counter
    const vialsDiv = document.createElement('div');
    vialsDiv.className = 'alchemy-vials';
    vialsDiv.innerHTML = `
        <span class="alchemy-vials-label">Fioles vides</span>
        <div class="alchemy-vials-ctrl">
            <button class="vial-btn" onclick="changeVials(-1)" ${vials <= 0 ? 'disabled' : ''}>−</button>
            <span class="vial-count">${vials}</span>
            <button class="vial-btn" onclick="changeVials(1)">+</button>
        </div>`;
    container.appendChild(vialsDiv);

    // Recipes section
    if (recipes.length) {
        const hdr = document.createElement('div');
        hdr.className = 'alchemy-section-hdr';
        hdr.textContent = 'Recettes connues';
        container.appendChild(hdr);
        recipes.forEach((r, i) => {
            const row = document.createElement('div');
            row.className = 'recipe-row';
            const meta = [r.ingredients || '', r.desc || ''].filter(Boolean).join(' — ');
            row.innerHTML = `
                <span class="recipe-name">${r.name}</span>
                ${meta ? `<span class="recipe-meta">${meta}</span>` : '<span class="recipe-meta"></span>'}
                <span class="recipe-chance">${r.successChance || 0}%</span>
                <button class="recipe-craft-btn" onclick="craftPotion(${i})" ${vials <= 0 || isRolling ? 'disabled' : ''}>Créer</button>`;
            container.appendChild(row);
        });
    }

    // Crafted potions section
    const stock = potions.filter(p => p.name);
    if (stock.length) {
        const hdr = document.createElement('div');
        hdr.className = 'alchemy-section-hdr';
        hdr.textContent = 'Potions en stock';
        container.appendChild(hdr);
        potions.forEach((p, i) => {
            if (!p.name) return;
            const row = document.createElement('div');
            row.className = 'potion-row';
            row.innerHTML = `
                <div class="potion-info">
                    <div class="potion-name">${p.name}</div>
                </div>
                <div class="potion-actions">
                    <span class="potion-qty${!p.qty ? ' depleted' : ''}">×${p.qty ?? 0}</span>
                    <button class="potion-use-btn" onclick="usePotion(${i})" ${!p.qty ? 'disabled' : ''}>Utiliser</button>
                    <button class="del-btn" onclick="removePotion(${i})">✕</button>
                </div>`;
            container.appendChild(row);
        });
    }

    const hasContent = recipes.length > 0 || stock.length > 0;
    if (empty) empty.style.display = hasContent ? 'none' : '';
}


function changeVials(delta) {
    character.vials = Math.max(0, (character.vials ?? 0) + delta);
    saveCurrentCharacter();
    renderInventoryEditor();
    renderInventorySidebar();
    renderPotions();
}
function craftPotion(recipeIdx) {
    if ((character.vials ?? 0) <= 0 || isRolling) return;
    const recipe = (character.potionRecipes || [])[recipeIdx];
    if (!recipe) return;
    character.vials = (character.vials ?? 0) - 1;
    saveCurrentCharacter();
    pendingCraft = recipeIdx;
    doRoll(recipe.name, recipe.successChance || 0);
}
function applyCraft(success, recipeIdx) {
    setTimeout(() => {
        const recipe = (character.potionRecipes || [])[recipeIdx];
        if (!recipe) return;
        if (success) {
            if (!character.potions) character.potions = [];
            const existing = character.potions.find(p => p.recipeId === recipe.id);
            if (existing) {
                existing.qty = (existing.qty || 0) + 1;
            } else {
                character.potions.push({ recipeId: recipe.id, name: recipe.name, qty: 1 });
            }
            if (!character.inventory) character.inventory = [];
            const invEntry = character.inventory.find(i => i.name === recipe.name);
            if (invEntry) { invEntry.qty = (invEntry.qty || 0) + 1; }
            else { character.inventory.push({ name: recipe.name, qty: 1 }); }
            showToast('gm-heal-toast', `${recipe.name} créée avec succès !`);
        } else {
            showToast('gm-dmg-toast', `Création échouée — fiole brisée`);
        }
        saveCurrentCharacter();
        renderPotions();
        renderInventorySidebar();
        sendPresence();
    }, 1500);
}
function removePotion(i) {
    if (!character.potions) return;
    character.potions.splice(i, 1);
    saveCurrentCharacter();
    renderPotions();
}
function usePotion(i) {
    const p = character.potions[i];
    if (!p || !p.qty) return;
    p.qty--;
    saveCurrentCharacter();
    renderPotions();
    showToast('gm-heal-toast', `${p.name || 'Potion'} utilisée${p.qty > 0 ? ` (×${p.qty} restante${p.qty > 1 ? 's' : ''})` : ' — épuisée'}`);
}
function renderSkillsEditor() {
    const list = document.getElementById('skills-editor-list');
    if (!list) return;
    list.innerHTML = '';
    (character.skills || []).forEach((sk, i) => {
        const row = document.createElement('div');
        row.className = 'skill-editor-row';
        row.innerHTML = `<span class="sname">${sk.name}</span><input class="spct" type="text" inputmode="numeric" value="${sk.pct}" oninput="this.value=this.value.replace(/[^0-9]/g,'');character.skills[${i}].pct=+this.value||0" />`;
        list.appendChild(row);
    });
}
function renderSpecialsEditor() {
    const list = document.getElementById('specials-editor-list');
    if (!list) return;
    list.innerHTML = '';
    (character.specials || []).forEach((sp, i) => {
        const row = document.createElement('div');
        row.className = 'specials-row';
        row.innerHTML = `<input value="${sp.name || ''}" placeholder="Nom" oninput="character.specials[${i}].name=this.value" /><input type="text" inputmode="numeric" value="${sp.pct || 0}" oninput="this.value=this.value.replace(/[^0-9]/g,'');character.specials[${i}].pct=+this.value||0" /><input value="${sp.desc || ''}" placeholder="Description" oninput="character.specials[${i}].desc=this.value" /><button class="del-btn" onclick="removeSpecial(${i})">✕</button>`;
        list.appendChild(row);
    });
}
function addSpecialRow() { character.specials.push({ name: '', desc: '', pct: 0 }); renderSpecialsEditor(); }
function removeSpecial(i) { character.specials.splice(i, 1); renderSpecialsEditor(); }
function readEditorInputs() {
    character.name = document.getElementById('ed-name').value.trim();
    character.class = document.getElementById('ed-class').value.trim();
    character.stats.FOR = +document.getElementById('ed-for').value;
    character.stats.DEX = +document.getElementById('ed-dex').value;
    character.stats.END = +document.getElementById('ed-end').value;
    character.stats.INT = +document.getElementById('ed-int').value;
    character.stats.CHA = +document.getElementById('ed-cha').value;
    character.stats.PV = +document.getElementById('ed-pv').value;
    character.physical = {
        age: document.getElementById('ed-age').value.trim(),
        taille: document.getElementById('ed-taille').value.trim(),
        poids: document.getElementById('ed-poids').value.trim(),
        yeux: document.getElementById('ed-yeux').value.trim(),
        cheveux: document.getElementById('ed-cheveux').value.trim(),
        signes: document.getElementById('ed-signes').value.trim(),
    };
    character.protection = { nom: document.getElementById('ed-prot-nom').value.trim(), valeur: +document.getElementById('ed-prot-val').value || 0 };
}

let autoSaveTimer = null;
function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(autoSaveChar, 700);
}
function autoSaveChar() {
    initCurrentHP();
    const oldMax = getMaxHP();
    readEditorInputs();
    const newMax = character.stats.PV;
    if (newMax !== oldMax) {
        if (newMax > oldMax) {
            currentHP = Math.min(newMax, currentHP + (newMax - oldMax));
        } else {
            currentHP = Math.min(currentHP, newMax);
        }
        localStorage.setItem(hpKey(), currentHP);
    }
    saveCurrentCharacter();
    // Refresh non-editor UI only — avoids rebuilding editor DOM and losing focus
    document.getElementById('char-display').textContent = `${character.name} — ${character.class}`;
    document.title = character.name ? `ARIA – ${character.name}` : 'ARIA – Joueur';
    renderSkills();
    renderStats();
    updateHPDisplay();
    renderInventorySidebar();
    renderCombatSidebar();
    renderPotions();
    sendPresence();
    flashSaveStatus();
}
let saveStatusTimer = null;
function flashSaveStatus() {
    const el = document.getElementById('cs-save-status');
    if (!el) return;
    el.classList.add('show');
    clearTimeout(saveStatusTimer);
    saveStatusTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ═══════════════════════════════════════════
//  CARD SYSTEM
// ═══════════════════════════════════════════
function buildTracker() {
    const container = document.getElementById('tracker-suits');
    container.innerHTML = '';
    for (const suit of SUITS) {
        const row = document.createElement('div'); row.className = 'suit-row-t';
        const sym = document.createElement('span'); sym.className = `suit-sym ${suit.cls}`; sym.textContent = suit.sym;
        row.appendChild(sym);
        const pills = document.createElement('div'); pills.className = 'rank-pills';
        for (const rank of RANKS) { pills.appendChild(makePill(`${rank}-${suit.name}`, rank, suit.pillCls)); }
        row.appendChild(pills); container.appendChild(row);
    }
    const jRow = document.createElement('div'); jRow.className = 'suit-row-t';
    const jSym = document.createElement('span'); jSym.className = 'suit-sym c-purple'; jSym.textContent = '★';
    jRow.appendChild(jSym);
    const jPills = document.createElement('div'); jPills.className = 'rank-pills';
    jPills.appendChild(makePill('joker-red', 'R★', 'is-joker'));
    jPills.appendChild(makePill('joker-black', 'N★', 'is-joker'));
    jRow.appendChild(jPills); container.appendChild(jRow);
}
function makePill(id, label, extraCls) {
    const p = document.createElement('span');
    p.id = `pill-${id}`; p.className = 'rank-pill' + (extraCls ? ' ' + extraCls : ''); p.textContent = label;
    refreshPill(p, id); p.addEventListener('click', () => togglePill(id)); return p;
}
function refreshPill(p, id) { const drawn = cardDrawn.has(id), excl = cardExcluded.has(id); p.classList.toggle('drawn', drawn); p.classList.toggle('excluded', excl); }
function refreshAllPills() { ALL_CARDS.forEach(c => { const p = document.getElementById(`pill-${c.id}`); if (p) refreshPill(p, c.id); }); }
function togglePill(id) {
    if (cardDrawing) return;
    const card = cardById(id);
    const name = card.isJoker ? card.label : `${card.rank} de ${SUIT_FR[card.suit.name] || card.suit.name}`;
    if (cardExcluded.has(id)) { cardExcluded.delete(id); cardDeck.splice(Math.floor(Math.random() * (cardDeck.length + 1)), 0, card); updateDeckCount(); showCardStatus(`${name} re-inclus`); }
    else if (cardDrawn.has(id)) { cardDrawn.delete(id); cardDeck.splice(Math.floor(Math.random() * (cardDeck.length + 1)), 0, card); updateDeckCount(); showCardStatus(`${name} remis`); }
    else { cardExcluded.add(id); const idx = cardDeck.findIndex(c => c.id === id); if (idx !== -1) { cardDeck.splice(idx, 1); updateDeckCount(); } showCardStatus(`${name} exclu`); }
    const p = document.getElementById(`pill-${id}`); if (p) refreshPill(p, id);
    updateClearBtn(); saveCardState();
}
function clearExclusions() { if (cardDrawing) return; cardExcluded.clear(); refreshAllPills(); updateClearBtn(); saveCardState(); showCardStatus('Exclusions effacées'); }
function saveCardState() { localStorage.setItem(cardKey(), JSON.stringify({ excluded: [...cardExcluded], drawn: [...cardDrawn], deckIds: cardDeck.map(c => c.id), lastCardId })); debouncedSync(); }
function updateDeckCount() {
    const n = cardDeck.length;
    document.getElementById('deck-count').textContent = n === 0 ? 'Vide' : `${n} carte${n !== 1 ? 's' : ''}`;
    document.getElementById('deck-wrap').classList.toggle('empty', n === 0);
    document.getElementById('reshuffle-btn').classList.toggle('visible', n === 0);
    document.getElementById('reshuffle-remaining-btn').classList.toggle('visible', n > 1 && n < ALL_CARDS.length - cardExcluded.size);
    updateClearBtn();
}
function updateClearBtn() { document.getElementById('clear-exclusions-btn').classList.toggle('visible', cardExcluded.size > 0); }
function showCardStatus(msg) { const el = document.getElementById('card-status'); el.textContent = msg; clearTimeout(cardStatusTimer); cardStatusTimer = setTimeout(() => el.textContent = '', 2200); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function renderCardContent(card) {
    const el = document.getElementById('drawn-card');
    if (card.isJoker) {
        el.className = `flip-face ${card.jokerColor === 'red' ? 'c-red' : 'c-black'}`;
        el.innerHTML = `<div class="card-corner tl"><span class="rank" style="font-size:14px;color:var(--card-purple)">JKR</span></div><div class="card-center" style="flex-direction:column;gap:6px;"><span style="font-size:50px;line-height:1;color:var(--card-purple)">★</span><span style="font-family:'Playfair Display',serif;font-size:10px;font-weight:700;letter-spacing:.12em;color:var(--card-purple)">${card.label.toUpperCase()}</span></div><div class="card-corner br"><span class="rank" style="font-size:14px;color:var(--card-purple)">JKR</span></div>`;
    } else {
        el.className = `flip-face ${card.suit.cls}`;
        el.innerHTML = `<div class="card-corner tl"><span class="rank">${card.rank}</span><span class="suit-small">${card.suit.sym}</span></div><div class="card-center">${card.suit.sym}</div><div class="card-corner br"><span class="rank">${card.rank}</span><span class="suit-small">${card.suit.sym}</span></div>`;
    }
}
function restoreCard() {
    const card = cardById(lastCardId); if (!card) return;
    const flipWrap = document.getElementById('flip-wrap');
    renderCardContent(card);
    document.getElementById('drawn-card').classList.add('ready');
    flipWrap.classList.remove('hidden');
    flipWrap.style.transition = 'none';
    flipWrap.classList.add('flipped');
    flipWrap.getBoundingClientRect();
    flipWrap.style.transition = '';
}
async function animateShuffle() {
    const overlay = document.getElementById('shuffle-overlay');
    const wrap = document.getElementById('deck-wrap');
    const rect = wrap.getBoundingClientRect();
    const ghosts = [];
    for (let i = 0; i < 4; i++) {
        const g = document.createElement('div'); g.className = 'shuffle-ghost';
        g.appendChild(Object.assign(document.createElement('div'), { className: 'deck-pattern' }));
        g.style.cssText = `width:${rect.width}px;height:${rect.height}px;left:${rect.left}px;top:${rect.top}px;`;
        overlay.appendChild(g); ghosts.push(g);
    }
    const dirs = ['left', 'right', 'left', 'right'];
    ghosts.forEach((g, i) => { g.style.animation = `shuffle-${dirs[i]} 0.52s ${i * 0.08}s ease-in-out forwards`; });
    wrap.classList.remove('shuffling'); wrap.getBoundingClientRect(); wrap.classList.add('shuffling');
    await delay(680); ghosts.forEach(g => g.remove()); wrap.classList.remove('shuffling');
}
async function animateFly() {
    const stage = document.querySelector('.card-stage');
    const wrap = document.getElementById('deck-wrap');
    const flyEl = document.getElementById('fly-card');
    const deckRect = wrap.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const cw = deckRect.width, ch = deckRect.height, sx = deckRect.left, sy = deckRect.top;
    const ex = stageRect.left + (stageRect.width - cw) / 2, ey = stageRect.top + (stageRect.height - ch) / 2;
    const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 30;
    flyEl.style.cssText = `left:${sx}px;top:${sy}px;width:${cw}px;height:${ch}px;opacity:1;`;
    flyEl.style.setProperty('--fly-x0', '0px'); flyEl.style.setProperty('--fly-y0', '0px');
    flyEl.style.setProperty('--fly-xm', `${mx - sx}px`); flyEl.style.setProperty('--fly-ym', `${my - sy}px`);
    flyEl.style.setProperty('--fly-x1', `${ex - sx}px`); flyEl.style.setProperty('--fly-y1', `${ey - sy}px`);
    flyEl.classList.remove('flying'); flyEl.getBoundingClientRect(); flyEl.classList.add('flying');
    await delay(430); flyEl.classList.remove('flying'); flyEl.style.opacity = '0';
}
async function revealCard(card) {
    const flipWrap = document.getElementById('flip-wrap');
    const drawnEl = document.getElementById('drawn-card');
    renderCardContent(card); drawnEl.classList.add('ready');
    flipWrap.classList.remove('hidden'); flipWrap.getBoundingClientRect();
    await delay(30); flipWrap.classList.add('flipped');
}
async function drawCard() {
    if (cardDrawing || cardDeck.length === 0) return;
    cardDrawing = true;
    const flipWrap = document.getElementById('flip-wrap');
    flipWrap.classList.remove('flipped'); flipWrap.classList.add('hidden');
    document.getElementById('drawn-card').classList.remove('ready');
    await animateFly();
    const drawn = cardDeck.pop();
    cardDrawn.add(drawn.id); lastCardId = drawn.id;
    const pill = document.getElementById(`pill-${drawn.id}`); if (pill) refreshPill(pill, drawn.id);
    updateDeckCount(); await revealCard(drawn);
    showCardStatus(drawn.isJoker ? drawn.label : `${drawn.rank} de ${SUIT_FR[drawn.suit.name] || drawn.suit.name}`);
    saveCardState(); publishCard('draw', { cardId: drawn.id, playerName: character.name });
    cardDrawing = false;
}
async function manualReshuffle(remainingOnly) {
    if (cardDrawing) return;
    cardDrawing = true;
    const flipWrap = document.getElementById('flip-wrap');
    flipWrap.classList.remove('flipped');
    await delay(200); flipWrap.classList.add('hidden');
    document.getElementById('drawn-card').classList.remove('ready');
    await animateShuffle();
    if (remainingOnly) { cardDeck = shuffle(cardDeck); }
    else { cardDrawn.clear(); cardDeck = shuffle([...ALL_CARDS].filter(c => !cardExcluded.has(c.id))); lastCardId = null; }
    buildTracker(); updateDeckCount(); updateClearBtn(); saveCardState(); publishCard('reshuffle');
    const flash = document.getElementById('reshuffle-flash');
    document.getElementById('reshuffle-msg').textContent = remainingOnly ? '↺ Restant mélangé' : '↺ Mélangé';
    flash.classList.add('show'); await delay(900); flash.classList.remove('show');
    cardDrawing = false;
}

// ═══════════════════════════════════════════
//  PLAYER FILES
// ═══════════════════════════════════════════
function _pfEscHtml(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _pfFileIcon(type) {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼';
    if (type === 'application/pdf') return '📕';
    if (type.startsWith('text/')) return '📝';
    return '📄';
}

function renderPlayerFiles() {
    const list = document.getElementById('player-files-list');
    const empty = document.getElementById('player-files-empty');
    if (!list) return;
    list.innerHTML = '';
    if (!playerFiles.length) {
        if (empty) empty.style.display = '';
        return;
    }
    if (empty) empty.style.display = 'none';
    playerFiles.forEach(f => {
        const row = document.createElement('div');
        row.className = 'player-file-row';
        row.innerHTML = `
            <div class="pf-icon">${_pfFileIcon(f.type)}</div>
            <div class="pf-name">${_pfEscHtml(f.name)}</div>
            <button class="pf-open-btn" onclick="openFileViewer('${f.id}')">Ouvrir</button>`;
        list.appendChild(row);
    });
}

function openFileViewer(fileId) {
    const f = playerFiles.find(f => f.id === fileId);
    if (!f) return;
    document.getElementById('fv-title').textContent = f.name;
    const body = document.getElementById('fv-body');
    body.innerHTML = '';
    if (f.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = f.url;
        img.className = 'fv-image';
        body.appendChild(img);
    } else if (f.type === 'application/pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = f.url;
        iframe.className = 'fv-iframe';
        body.appendChild(iframe);
    } else if (f.type.startsWith('text/')) {
        const pre = document.createElement('pre');
        pre.className = 'fv-text';
        pre.textContent = 'Chargement…';
        body.appendChild(pre);
        fetch(f.url)
            .then(r => r.text())
            .then(text => { pre.textContent = text; })
            .catch(() => { pre.textContent = 'Erreur de chargement.'; });
    } else {
        const wrap = document.createElement('div');
        wrap.className = 'fv-unsupported';
        wrap.innerHTML = `<div class="fv-unsupported-icon">${_pfFileIcon(f.type)}</div>
            <div class="fv-unsupported-name">${_pfEscHtml(f.name)}</div>
            <a class="fv-download-link" href="${f.url}" target="_blank" rel="noopener">Ouvrir dans un nouvel onglet</a>`;
        body.appendChild(wrap);
    }
    document.getElementById('file-viewer-scrim').classList.add('show');
    document.getElementById('file-viewer-modal').classList.add('show');
}

function closeFileViewer() {
    document.getElementById('file-viewer-scrim').classList.remove('show');
    document.getElementById('file-viewer-modal').classList.remove('show');
    document.getElementById('fv-body').innerHTML = '';
}
