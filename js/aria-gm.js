// ═══════════════════════════════════════════
//  CARD CONSTANTS
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
let config = JSON.parse(localStorage.getItem('aria-config') || '{}');
if (config.lightMode) document.body.classList.add('light-mode');
let ablyInstance = null, ablyRolls = null, ablyCards = null, ablyDamage = null;
let dddiceSDK = null;            // ThreeDDice SDK instance
let dddiceAPI = null;            // { theme } once connected
let pendingGMRoll = null;        // { name, threshold, atk } for GM rolls in progress
let dddiceResizeHandler = null;  // stored so we can remove it before re-registering

// Players presence map: charId (stable UUID) -> {playerId,name,charClass,hp,maxHP,stats,ts,...}
const players = new Map();
const PRESENCE_TIMEOUT = 30000; // 30s offline threshold

// Campaign state — loaded after selection
let currentCampaignId = null;
let currentJoinCode = null;
let monsters = [];
let newMonsterAttacks = [];
let rollFeed = [];
let cardHistory = [];
let sweepIntervalId = null;
let gmClickHandlerRegistered = false;
let renderPlayerCardsTimer = null;
let renderMonstersTimer = null;
let gmPotions = [];
let gmFiles = [];
const filesGrantedSessions = new Set();
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

function collectGMData() {
    const campaigns = JSON.parse(localStorage.getItem('aria-gm-campaigns') || '[]');
    const perCampaign = {};
    campaigns.forEach(c => {
        const monsters      = localStorage.getItem('aria-gm-monsters-'      + c.id);
        const rolls         = localStorage.getItem('aria-gm-rolls-'         + c.id);
        const cardHistory   = localStorage.getItem('aria-gm-card-history-'  + c.id);
        const potions       = localStorage.getItem('aria-gm-potions-'       + c.id);
        const knownPlayers  = localStorage.getItem('aria-gm-known-players-' + c.id);
        const files         = localStorage.getItem('aria-gm-files-'         + c.id);
        perCampaign[c.id] = {
            monsters:     monsters     ? JSON.parse(monsters)     : null,
            rolls:        rolls        ? JSON.parse(rolls)        : null,
            cardHistory:  cardHistory  ? JSON.parse(cardHistory)  : null,
            potions:      potions      ? JSON.parse(potions)      : null,
            knownPlayers: knownPlayers ? JSON.parse(knownPlayers) : null,
            files:        files        ? JSON.parse(files)        : null,
        };
    });
    return { campaigns, perCampaign };
}

function applyGMData(data) {
    if (!data || !Array.isArray(data.campaigns)) return;
    localStorage.setItem('aria-gm-campaigns', JSON.stringify(data.campaigns));
    if (!data.perCampaign) return;
    Object.entries(data.perCampaign).forEach(([id, s]) => {
        if (s.monsters     !== null && s.monsters     !== undefined) localStorage.setItem('aria-gm-monsters-'      + id, JSON.stringify(s.monsters));
        if (s.rolls        !== null && s.rolls        !== undefined) localStorage.setItem('aria-gm-rolls-'         + id, JSON.stringify(s.rolls));
        if (s.cardHistory  !== null && s.cardHistory  !== undefined) localStorage.setItem('aria-gm-card-history-'  + id, JSON.stringify(s.cardHistory));
        if (s.potions      !== null && s.potions      !== undefined) localStorage.setItem('aria-gm-potions-'       + id, JSON.stringify(s.potions));
        if (s.knownPlayers !== null && s.knownPlayers !== undefined) localStorage.setItem('aria-gm-known-players-' + id, JSON.stringify(s.knownPlayers));
        if (s.files        !== null && s.files        !== undefined) localStorage.setItem('aria-gm-files-'         + id, JSON.stringify(s.files));
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
        if (data.gm) applyGMData(data.gm);
    } catch(e) { console.warn('[ARIA] Supabase load failed:', e); }
}

async function syncToSupabase() {
    if (!_supabaseReady()) return;
    try {
        await _sbFetch('/rest/v1/saves', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({ save_key: saveKey, data: { version: 2, gm: collectGMData() }, updated_at: new Date().toISOString() }),
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
//  CAMPAIGN MANAGEMENT
// ═══════════════════════════════════════════
function generateJoinCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function monstersKey()      { return 'aria-gm-monsters-'      + currentCampaignId; }
function rollsKey()         { return 'aria-gm-rolls-'          + currentCampaignId; }
function cardHistKey()      { return 'aria-gm-card-history-'   + currentCampaignId; }
function potionsKey()       { return 'aria-gm-potions-'        + currentCampaignId; }
function knownPlayersKey()  { return 'aria-gm-known-players-'  + currentCampaignId; }
function filesKey()         { return 'aria-gm-files-'          + currentCampaignId; }

function saveKnownPlayers() {
    const obj = {};
    players.forEach((p, id) => { obj[id] = p; });
    localStorage.setItem(knownPlayersKey(), JSON.stringify(obj));
}

function getCampaigns() { return JSON.parse(localStorage.getItem('aria-gm-campaigns') || '[]'); }
function saveCampaigns(campaigns) { localStorage.setItem('aria-gm-campaigns', JSON.stringify(campaigns)); debouncedSync(); }

function migrateGMIfNeeded() {
    if (localStorage.getItem('aria-gm-campaigns')) return;
    const oldMonsters = localStorage.getItem('aria-gm-monsters');
    const oldRolls    = localStorage.getItem('aria-gm-rolls');
    const oldCards    = localStorage.getItem('aria-gm-card-history');
    if (!oldMonsters && !oldRolls && !oldCards) return;
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    saveCampaigns([{ id, name: 'Campagne 1', joinCode: generateJoinCode() }]);
    if (oldMonsters) localStorage.setItem('aria-gm-monsters-' + id, oldMonsters);
    if (oldRolls)    localStorage.setItem('aria-gm-rolls-' + id, oldRolls);
    if (oldCards)    localStorage.setItem('aria-gm-card-history-' + id, oldCards);
}

function loadCampaignState(id) {
    const campaigns = getCampaigns();
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return false;
    if (!camp.joinCode) { camp.joinCode = generateJoinCode(); saveCampaigns(campaigns); }
    currentCampaignId = id;
    currentJoinCode = camp.joinCode;
    monsters    = JSON.parse(localStorage.getItem(monstersKey())  || '[]');
    rollFeed    = JSON.parse(localStorage.getItem(rollsKey())     || '[]');
    cardHistory = JSON.parse(localStorage.getItem(cardHistKey()) || '[]');
    gmPotions   = JSON.parse(localStorage.getItem(potionsKey())  || '[]');
    gmFiles     = JSON.parse(localStorage.getItem(filesKey())    || '[]');
    players.clear();
    const knownRaw = JSON.parse(localStorage.getItem(knownPlayersKey()) || '{}');
    Object.entries(knownRaw).forEach(([, p]) => {
        if (!p.charId) return; // skip legacy entries keyed by session UUID (pre-fix)
        players.set(p.charId, { ...p, online: false });
    });
    return true;
}

function renderCampaignScreen() {
    const campaigns = getCampaigns();
    const grid = document.getElementById('campaign-grid');
    grid.innerHTML = '';
    if (campaigns.length === 0) {
        grid.innerHTML = '<div class="sel-empty">Aucune campagne. Créez-en une pour commencer.</div>';
        return;
    }
    campaigns.forEach(c => {
        const card = document.createElement('div');
        card.className = 'sel-card';
        card.innerHTML = `<button class="sel-card-delete" onclick="event.stopPropagation();deleteCampaign('${c.id}')" title="Supprimer">✕</button><div class="sel-card-row"><div class="sel-card-name">${c.name}</div><div class="sel-card-joincode" onclick="event.stopPropagation();copyJoinCodeFromCard(this,'${c.joinCode||''}')">🔑 ${c.joinCode || '—'}</div></div>`;
        card.addEventListener('click', () => selectCampaign(c.id));
        grid.appendChild(card);
    });
}

function showSelectionScreen() {
    document.getElementById('selection-screen').style.display = 'flex';
    document.getElementById('app-wrapper').style.display = 'none';
    document.getElementById('new-campaign-form').style.display = 'none';
    renderCampaignScreen();
    updateSaveKeyStatus();
}

function copyJoinCodeFromCard(el, code) {
    if (!code) return;
    navigator.clipboard.writeText(code).catch(() => {});
    const orig = el.textContent;
    el.textContent = '✓ Copié !';
    setTimeout(() => { el.textContent = orig; }, 1500);
}

function showApp() {
    document.getElementById('selection-screen').style.display = 'none';
    document.getElementById('app-wrapper').style.display = 'flex';
}

function selectCampaign(id) {
    if (!loadCampaignState(id)) return;
    showApp();
    initApp();
}

function deleteCampaign(id) {
    if (!confirm('Supprimer cette campagne ? Tous les monstres et données seront perdus.')) return;
    const campaigns = getCampaigns().filter(c => c.id !== id);
    saveCampaigns(campaigns);
    localStorage.removeItem('aria-gm-monsters-' + id);
    localStorage.removeItem('aria-gm-rolls-' + id);
    localStorage.removeItem('aria-gm-card-history-' + id);
    localStorage.removeItem('aria-gm-potions-' + id);
    localStorage.removeItem('aria-gm-known-players-' + id);
    localStorage.removeItem('aria-gm-files-' + id);
    renderCampaignScreen();
}

function createCampaign() {
    document.getElementById('new-campaign-form').style.display = 'flex';
    document.getElementById('new-campaign-name').value = '';
    document.getElementById('new-campaign-name').focus();
}

function confirmCreateCampaign() {
    const name = document.getElementById('new-campaign-name').value.trim() || 'Nouvelle campagne';
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const campaigns = getCampaigns();
    campaigns.push({ id, name, joinCode: generateJoinCode() });
    saveCampaigns(campaigns);
    document.getElementById('new-campaign-form').style.display = 'none';
    selectCampaign(id);
}

function cancelCreateCampaign() {
    document.getElementById('new-campaign-form').style.display = 'none';
}

function saveCampaignName(input) {
    const name = input.value.trim();
    const campaigns = getCampaigns();
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp) return;
    if (!name) { input.value = camp.name; return; }
    camp.name = name;
    saveCampaigns(campaigns);
}

function switchCampaign() {
    if (currentCampaignId) {
        saveMonsters();
        saveGMPotions();
        localStorage.setItem(rollsKey(), JSON.stringify(rollFeed));
        localStorage.setItem(cardHistKey(), JSON.stringify(cardHistory));
        debouncedSync();
    }
    gmPotions = [];
    gmFiles = [];
    filesGrantedSessions.clear();
    if (sweepIntervalId) { clearInterval(sweepIntervalId); sweepIntervalId = null; }
    if (renderPlayerCardsTimer) { clearTimeout(renderPlayerCardsTimer); renderPlayerCardsTimer = null; }
    if (renderMonstersTimer) { clearTimeout(renderMonstersTimer); renderMonstersTimer = null; }
    if (dddiceSDK) { try { dddiceSDK.disconnect?.(); } catch(_){} dddiceSDK = null; }
    if (ablyInstance) { try { ablyInstance.close(); } catch(_){} ablyInstance = null; }
    ablyRolls = null; ablyCards = null; ablyDamage = null;
    players.clear();
    currentCampaignId = null;
    showSelectionScreen();
}

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
    migrateGMIfNeeded();
    await tryRestoreSupabase();
});

function initApp() {
    renderMonsters();
    renderRollFeed();
    renderCardHistory();
    renderGMPotions();
    renderGmFiles();
    initGmDeck();
    loadConfigInputs();
    if (config.dddiceKey && config.dddiceRoom) initDddice();
    if (config.ablyKey) initAbly();
    if (sweepIntervalId) clearInterval(sweepIntervalId);
    sweepIntervalId = setInterval(sweepOfflinePlayers, 10000);
    if (!gmClickHandlerRegistered) {
        document.addEventListener('click', e => { if (!e.target.closest('.gm-select')) closeAllSelects(); });
        gmClickHandlerRegistered = true;
    }
    const campaigns = getCampaigns();
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const el = document.getElementById('campaign-display');
    if (el && camp) el.value = camp.name;
    const jel = document.getElementById('joincode-display');
    if (jel) jel.textContent = currentJoinCode || '';
}

function copyJoinCode() {
    if (!currentJoinCode) return;
    navigator.clipboard.writeText(currentJoinCode).catch(() => {});
    const el = document.getElementById('joincode-display');
    if (el) { const t = el.textContent; el.textContent = '✓ Copié !'; setTimeout(() => { el.textContent = t; }, 1500); }
}

// ═══════════════════════════════════════════
//  CUSTOM SELECT
// ═══════════════════════════════════════════
function closeAllSelects() {
    document.querySelectorAll('.gm-select-panel.open').forEach(p => p.classList.remove('open'));
}
function toggleSelect(trigger) {
    const panel = trigger.closest('.gm-select').querySelector('.gm-select-panel');
    const isOpen = panel.classList.contains('open');
    closeAllSelects();
    if (!isOpen) panel.classList.add('open');
}
function getSelectValue(id) { return document.getElementById(id)?.dataset.value ?? ''; }
function setSelectValue(id, value, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.value = value;
    const lbl = el.querySelector('.gm-select-label');
    if (lbl) lbl.textContent = label;
    closeAllSelects();
}
function addSelectOpt(panel, value, label, onClick) {
    const opt = document.createElement('div');
    opt.className = 'gm-select-opt';
    opt.textContent = label;
    opt.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    panel.appendChild(opt);
}

// ═══════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════
function switchTab(id, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
    if (id === 'tab-gm-roll') refreshMonsterSelect();
}

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
        const { ThreeDDice, ThreeDDiceRollEvent } = await import('https://esm.sh/dddice-js');

        // Fetch themes for the dropdown
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

        const canvas = document.getElementById('dddice-canvas');
        dddiceSDK = new ThreeDDice(canvas, config.dddiceKey);
        dddiceSDK.start();
        await dddiceSDK.connect(slug);

        // RollFinished fires for both incoming player rolls and GM rolls initiated locally.
        // Only act on it when a GM roll is pending.
        dddiceSDK.on(ThreeDDiceRollEvent.RollFinished, (roll) => {
            setTimeout(() => dddiceSDK?.clear(), 1500);
            if (!pendingGMRoll) return;
            const { name, threshold, atk } = pendingGMRoll;
            pendingGMRoll = null;
            const total = (roll.total_value ?? 0) === 0 ? 100 : (roll.total_value ?? 0);
            const success = total <= threshold;
            const dmgResult = (success && atk?.dmg?.trim()) ? rollDiceFormula(atk.dmg) : null;
            showGMRollResult(name, threshold, total, success, dmgResult);
        });

        // Keep WebGL viewport in sync with window size
        if (dddiceResizeHandler) window.removeEventListener('resize', dddiceResizeHandler);
        dddiceResizeHandler = () => dddiceSDK?.resize();
        window.addEventListener('resize', dddiceResizeHandler);

        dddiceAPI = { theme: sel.value };
        setDddiceStatus(true, themes.find(t => t.id === sel.value)?.name || sel.value);
        sel.onchange = () => { if (dddiceAPI) dddiceAPI.theme = sel.value; config.dddiceTheme = sel.value; localStorage.setItem('aria-config', JSON.stringify(config)); };
    } catch (e) { console.error('dddice:', e); setDddiceStatus(false, e.message); dddiceSDK = null; dddiceAPI = null; }
}
function setDddiceStatus(ok, detail) {
    ['dddice-dot', 'cfg-dddice-dot'].forEach(id => { const el = document.getElementById(id); if (el) el.className = 'status-dot ' + (ok ? 'connected' : 'error'); });
    ['dddice-status', 'cfg-dddice-status'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ok ? `dddice: ${detail || 'connecté'}` : `Erreur: ${detail || 'dddice'}`; });
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
        ablyInstance.connection.on('connected', () => setAblyStatus(true));
        ablyInstance.connection.on('failed', () => setAblyStatus(false));
        // Listen for player rolls
        ablyRolls.subscribe('roll', msg => handleIncomingRoll(msg.data));
        // Listen for player card draws
        ablyCards.subscribe('draw', msg => handlePlayerCard(msg.data));
        ablyCards.subscribe('reshuffle', () => handlePlayerReshuffle());
        // Listen for player presence heartbeats (published every 5s)
        ablyDamage.subscribe('presence', msg => { handlePresence(msg.data); });
        ablyDamage.subscribe('leave', msg => {
            const sessionId = msg.data?.playerId;
            if (!sessionId) return;
            for (const [key, p] of players) {
                if (p.playerId === sessionId) { players.delete(key); renderPlayerCards(); break; }
            }
        });
    } catch (e) { console.error('Ably:', e); setAblyStatus(false); }
}
function setAblyStatus(ok) {
    ['ably-dot', 'cfg-ably-dot'].forEach(id => { const el = document.getElementById(id); if (el) el.className = 'status-dot ' + (ok ? 'connected' : 'error'); });
    ['ably-status', 'cfg-ably-status'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ok ? 'Ably connecté' : 'Ably erreur'; });
}
function publishDamage(targetId, damage, hpBefore, hpAfter, maxHP, charName) {
    if (!ablyDamage) return;
    ablyDamage.publish('damage', { targetId, damage, hpBefore, hpAfter, maxHP, charName, source: 'gm' });
}
function publishHeal(targetId, amount, hpBefore, hpAfter, maxHP, charName) {
    if (!ablyDamage) return;
    ablyDamage.publish('heal', { targetId, amount, hpBefore, hpAfter, maxHP, charName, source: 'gm' });
}

// ═══════════════════════════════════════════
//  PLAYER PRESENCE
// ═══════════════════════════════════════════
function handlePresence(data) {
    if (!data?.playerId || !data?.charId) return;
    if (currentJoinCode && (data.campaignKey || '') !== currentJoinCode) return;
    players.set(data.charId, { ...data, ts: Date.now(), online: true });
    saveKnownPlayers();
    clearTimeout(renderPlayerCardsTimer);
    renderPlayerCardsTimer = setTimeout(renderPlayerCards, 150);
    // Auto-send file grants to newly connected sessions
    if (!filesGrantedSessions.has(data.playerId)) {
        filesGrantedSessions.add(data.playerId);
        sendFileGrantsToPlayer(data);
    }
}
function sweepOfflinePlayers() {
    const now = Date.now();
    let changed = false;
    players.forEach((p, id) => {
        const age = now - (p.ts || 0);
        if (age > PRESENCE_TIMEOUT * 4) { // gone for 120s+ → remove entirely
            players.delete(id);
            changed = true;
            return;
        }
        const wasOnline = p.online !== false;
        const isOnline = age < PRESENCE_TIMEOUT;
        if (wasOnline !== isOnline) { p.online = isOnline; changed = true; }
        else if (p.online === undefined) { p.online = isOnline; changed = true; }
    });
    if (changed) { saveKnownPlayers(); renderPlayerCards(); }
}
function renderPlayerCards() {
    const grid = document.getElementById('players-grid');
    const noP = document.getElementById('no-players');
    if (players.size === 0) {
        noP.style.display = '';
        grid.innerHTML = '';
        return;
    }
    noP.style.display = 'none';
    const savedDmg = {}, savedHeal = {};
    const focusedId = document.activeElement?.id;
    players.forEach((_, playerId) => {
        const d = document.getElementById(`dmg-${playerId}`);
        const h = document.getElementById(`heal-${playerId}`);
        if (d) savedDmg[playerId] = d.value;
        if (h) savedHeal[playerId] = h.value;
    });
    grid.innerHTML = '';
    players.forEach((p, playerId) => {
        const isOnline = p.online !== false && Date.now() - p.ts < PRESENCE_TIMEOUT;
        const hp = p.hp ?? p.maxHP ?? '?', maxHP = p.maxHP ?? '?';
        const pct = maxHP > 0 ? hp / maxHP : 0;
        const hpColor = pct > 0.5 ? 'var(--success)' : pct > 0.25 ? '#e8a020' : 'var(--fail)';
        const hpClass = pct <= 0.25 ? 'critical' : pct <= 0.5 ? 'low' : '';
        const stats = p.stats || {};
        const card = document.createElement('div');
        card.className = `player-card ${isOnline ? 'online' : 'offline'}`;
        card.innerHTML = `
          <div class="pc-header">
            <div class="pc-online-dot ${isOnline ? 'online' : ''}"></div>
            <div style="flex:1;min-width:0;">
              <div class="pc-name">${p.name || playerId}</div>
              <div class="pc-class">${p.charClass || ''}</div>
            </div>
            <button class="pc-btn details" onclick="openPlayerDetails('${playerId}')" title="Voir la fiche">📋</button>
          </div>
          <div class="pc-body">
            <div class="pc-hp-row">
              <div>
                <div class="pc-hp-num ${hpClass}">${hp}</div>
                <div style="font-family:'Cinzel',serif;font-size:9px;color:var(--parchment-dim);">/ ${maxHP} PV</div>
              </div>
              <div class="pc-hp-bar-wrap"><div class="pc-hp-bar" style="width:${Math.round(pct * 100)}%;background:${hpColor};"></div></div>
              ${p.protection ? `<div class="pc-prot" title="Protection">🛡 ${p.protection.nom || ''} ${p.protection.valeur ? p.protection.valeur : ''}</div>` : ''}
            </div>
            <div class="pc-stats">
              ${Object.entries(stats).filter(([k]) => k !== 'PV').map(([k, v]) => `<span class="pc-stat">${k} <span>${v}</span></span>`).join('')}
            </div>
            <div class="pc-actions">
              <input class="pc-dmg-input" id="dmg-${playerId}" type="text" inputmode="numeric"
                placeholder="Dégâts" oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                onkeydown="if(event.key==='Enter')applyPlayerDamage('${playerId}')" />
              <button class="pc-btn dmg" onclick="applyPlayerDamage('${playerId}')">⚔</button>
              <input class="pc-heal-input" id="heal-${playerId}" type="text" inputmode="numeric"
                placeholder="Soins" oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                onkeydown="if(event.key==='Enter')applyPlayerHeal('${playerId}')" />
              <button class="pc-btn heal" onclick="applyPlayerHeal('${playerId}')">♥</button>
            </div>
          </div>`;
        grid.appendChild(card);
    });
    players.forEach((_, playerId) => {
        const d = document.getElementById(`dmg-${playerId}`);
        const h = document.getElementById(`heal-${playerId}`);
        if (d && savedDmg[playerId]) d.value = savedDmg[playerId];
        if (h && savedHeal[playerId]) h.value = savedHeal[playerId];
    });
    if (focusedId) document.getElementById(focusedId)?.focus();
}
function openPlayerDetails(playerId) {
    const p = players.get(playerId);
    if (!p) return;
    document.getElementById('pdm-name').textContent = p.name || playerId;
    document.getElementById('pdm-class').textContent = p.charClass || '';

    const hp = p.hp ?? p.maxHP ?? '?', maxHP = p.maxHP ?? '?';
    const pct = maxHP > 0 ? hp / maxHP : 0;
    const hpColor = pct > 0.5 ? 'var(--success)' : pct > 0.25 ? '#e8a020' : 'var(--fail)';
    const stats = p.stats || {};
    const skills = p.skills || [];
    const specials = p.specials || [];
    const weapons = p.weapons || [];
    const inventory = p.inventory || [];
    const potions = p.potions || [];
    const tabs = p.tabs || { cards: false, alchemy: false };
    const grantedRecipeIds = new Set(p.potionRecipeIds || []);

    let html = '';

    // Tab access toggles
    html += `<div class="pdm-section">`;
    html += `<div class="pdm-section-title">Accès aux onglets</div>`;
    html += `<div class="pdm-tab-toggles">`;
    html += `<button class="pdm-tab-toggle${tabs.cards ? ' active' : ''}" onclick="sendTabConfig('${playerId}','cards',${!tabs.cards})">🂠 Cartes</button>`;
    html += `<button class="pdm-tab-toggle${tabs.alchemy ? ' active' : ''}" onclick="sendTabConfig('${playerId}','alchemy',${!tabs.alchemy})">⚗ Alchimie</button>`;
    html += `</div></div>`;

    // Files
    if (gmFiles.length) {
        html += `<div class="pdm-section"><div class="pdm-section-title">Documents</div><div class="pdm-tab-toggles">`;
        for (const f of gmFiles) {
            const isAll = f.grantedTo === 'all';
            const hasAccess = isAll || (Array.isArray(f.grantedTo) && f.grantedTo.includes(playerId));
            const icon = _fileIcon(f.type);
            const disabledAttr = isAll ? ' disabled title="Accès accordé à tous"' : '';
            const clickAttr = isAll ? '' : ` onclick="grantFileToPlayer('${f.id}','${playerId}')"`;
            html += `<button class="pdm-tab-toggle${hasAccess ? ' active' : ''}"${disabledAttr}${clickAttr}>${icon} ${_escHtml(f.name)}</button>`;
        }
        html += `</div></div>`;
    }

    // Alchemy — only show recipe grants if alchemy tab is enabled for this player
    if (tabs.alchemy && gmPotions.length) {
        html += `<div class="pdm-section"><div class="pdm-section-title">Recettes alchimiques</div><div class="pdm-tab-toggles">`;
        for (const pot of gmPotions) {
            const granted = grantedRecipeIds.has(pot.id);
            const safeTitle = (pot.desc || '').replace(/"/g, '&quot;');
            html += `<button class="pdm-tab-toggle${granted ? ' active' : ''}" onclick="sendPotionGrant('${playerId}','${pot.id}')" title="${safeTitle}">⚗ ${pot.name}</button>`;
        }
        html += `</div></div>`;
    }

    // Stats + HP row
    html += `<div class="pdm-section">`;
    html += `<div class="pdm-section-title">Attributs</div>`;
    html += `<div class="pdm-stats-row">`;
    html += `<div class="pdm-hp-block"><span class="pdm-hp-num" style="color:${hpColor}">${hp}</span><span class="pdm-hp-sep">/</span><span class="pdm-hp-max">${maxHP} PV</span></div>`;
    const statOrder = ['FOR','DEX','END','INT','CHA'];
    for (const k of statOrder) {
        if (stats[k] !== undefined) html += `<div class="pdm-stat-block"><span class="pdm-stat-key">${k}</span><span class="pdm-stat-val">${stats[k]}</span></div>`;
    }
    if (p.protection?.nom) html += `<div class="pdm-stat-block"><span class="pdm-stat-key">Armure</span><span class="pdm-stat-val">${p.protection.nom}${p.protection.valeur ? ' '+p.protection.valeur : ''}</span></div>`;
    html += `</div></div>`;

    // Weapons
    const realWeapons = weapons.filter(w => w.nom);
    if (realWeapons.length) {
        html += `<div class="pdm-section"><div class="pdm-section-title">Armes</div><div class="pdm-list">`;
        for (const w of realWeapons) {
            html += `<div class="pdm-list-row"><span class="pdm-list-name">${w.nom}</span><span class="pdm-list-val">${w.degats || '—'}</span></div>`;
        }
        html += `</div></div>`;
    }

    // Skills
    if (skills.length) {
        html += `<div class="pdm-section"><div class="pdm-section-title">Compétences</div><div class="pdm-skills-grid">`;
        for (const s of skills) {
            html += `<div class="pdm-skill-row"><span class="pdm-skill-name">${s.name}</span><span class="pdm-skill-pct">${s.pct ?? 0}%</span></div>`;
        }
        html += `</div></div>`;
    }

    // Specials
    if (specials.length) {
        html += `<div class="pdm-section"><div class="pdm-section-title">Compétences spéciales</div><div class="pdm-list">`;
        for (const s of specials) {
            html += `<div class="pdm-special-row"><div class="pdm-special-header"><span class="pdm-skill-name">${s.name}</span><span class="pdm-skill-pct">${s.pct ?? 0}%</span></div>${s.desc ? `<div class="pdm-special-desc">${s.desc}</div>` : ''}</div>`;
        }
        html += `</div></div>`;
    }

    // Inventory
    const vials = p.vials ?? 0;
    const showVials = tabs.alchemy && vials > 0;
    const realInv = inventory.filter(i => i.name);
    if (showVials || realInv.length) {
        html += `<div class="pdm-section"><div class="pdm-section-title">Inventaire</div><div class="pdm-list">`;
        if (showVials) html += `<div class="pdm-list-row"><span class="pdm-list-name" style="font-style:italic;">Fioles vides</span><span class="pdm-list-val">×${vials}</span></div>`;
        for (const i of realInv) {
            html += `<div class="pdm-list-row"><span class="pdm-list-name">${i.name}</span><span class="pdm-list-val">×${i.qty ?? 1}</span></div>`;
        }
        html += `</div></div>`;
    }

    // Potions
    const realPotions = potions.filter(p => p.name);
    if (realPotions.length) {
        html += `<div class="pdm-section"><div class="pdm-section-title">Potions</div><div class="pdm-list">`;
        for (const p of realPotions) {
            html += `<div class="pdm-list-row"><span class="pdm-list-name">${p.name}${p.desc ? ` <span class="pdm-list-desc">— ${p.desc}</span>` : ''}${p.ingredients ? ` <span class="pdm-list-desc pdm-list-ing">⚗ ${p.ingredients}</span>` : ''}</span><span class="pdm-list-val">×${p.qty ?? 1}</span></div>`;
        }
        html += `</div></div>`;
    }

    document.getElementById('pdm-body').innerHTML = html;
    document.getElementById('details-scrim').classList.add('show');
    document.getElementById('player-details-modal').classList.add('show');
}
function closePlayerDetails() {
    document.getElementById('details-scrim').classList.remove('show');
    document.getElementById('player-details-modal').classList.remove('show');
}
function sendTabConfig(playerId, tab, enabled) {
    if (!ablyDamage) return;
    const p = players.get(playerId);
    if (!p) return;
    if (!p.tabs) p.tabs = { cards: false, alchemy: false };
    p.tabs[tab] = enabled;
    ablyDamage.publish('tab-config', { playerId: p.playerId, tabs: p.tabs });
    openPlayerDetails(playerId); // refresh modal to reflect new state
}

function applyPlayerDamage(playerId) {
    const inp = document.getElementById(`dmg-${playerId}`);
    const dmg = parseInt(inp.value);
    if (!dmg || dmg <= 0) return;
    const p = players.get(playerId);
    if (!p) return;
    const hpBefore = p.hp ?? p.maxHP ?? 0;
    const hpAfter = Math.max(0, hpBefore - dmg);
    p.hp = hpAfter;
    inp.value = '';
    publishDamage(p.playerId, dmg, hpBefore, hpAfter, p.maxHP || hpBefore, p.name);
    renderPlayerCards();
}
function applyPlayerHeal(playerId) {
    const inp = document.getElementById(`heal-${playerId}`);
    const amt = parseInt(inp.value);
    if (!amt || amt <= 0) return;
    const p = players.get(playerId);
    if (!p) return;
    const hpBefore = p.hp ?? 0;
    const hpAfter = Math.min(p.maxHP || hpBefore, hpBefore + amt);
    p.hp = hpAfter;
    inp.value = '';
    publishHeal(p.playerId, amt, hpBefore, hpAfter, p.maxHP || hpBefore, p.name);
    renderPlayerCards();
}

// ═══════════════════════════════════════════
//  MONSTERS
// ═══════════════════════════════════════════
function saveMonsters() { localStorage.setItem(monstersKey(), JSON.stringify(monsters)); debouncedSync(); }
function addMonster() {
    const name = document.getElementById('amf-name').value.trim();
    if (!name) { alert('Entrez un nom.'); return; }
    const pv = parseInt(document.getElementById('amf-pv').value) || 20;
    const armor = parseInt(document.getElementById('amf-armor').value) || 0;
    const stats = {
        FOR: parseInt(document.getElementById('amf-for').value) || 10,
        DEX: parseInt(document.getElementById('amf-dex').value) || 10,
        END: parseInt(document.getElementById('amf-end').value) || 10,
        INT: parseInt(document.getElementById('amf-int').value) || 10,
        CHA: parseInt(document.getElementById('amf-cha').value) || 10,
    };
    const monster = { id: Date.now(), name, pv, maxPV: pv, armor, stats, attacks: [...newMonsterAttacks] };
    monsters.push(monster);
    saveMonsters();
    // Reset form
    ['amf-name', 'amf-pv', 'amf-armor', 'amf-for', 'amf-dex', 'amf-end', 'amf-int', 'amf-cha'].forEach(id => { document.getElementById(id).value = ''; });
    newMonsterAttacks = [];
    document.getElementById('amf-attacks-list').innerHTML = '';
    renderMonsters();
    refreshMonsterSelect();
}
function removeMonster(id) {
    monsters = monsters.filter(m => m.id !== id);
    saveMonsters();
    renderMonsters();
    refreshMonsterSelect();
}
function addAmfAttack() {
    const idx = newMonsterAttacks.length;
    newMonsterAttacks.push({ name: '', pct: 50, dmg: '' });
    const list = document.getElementById('amf-attacks-list');
    const row = document.createElement('div'); row.className = 'atk-row'; row.id = `amf-atk-${idx}`;
    row.innerHTML = `<input placeholder="Nom" oninput="newMonsterAttacks[${idx}].name=this.value" /><input type="text" inputmode="numeric" placeholder="%" oninput="this.value=this.value.replace(/[^0-9]/g,'');newMonsterAttacks[${idx}].pct=+this.value||0" /><input placeholder="1d6" oninput="newMonsterAttacks[${idx}].dmg=this.value" /><button class="del-btn" onclick="removeAmfAttack(${idx})">✕</button>`;
    list.appendChild(row);
}
function removeAmfAttack(idx) {
    newMonsterAttacks.splice(idx, 1);
    // re-render amf attacks
    const list = document.getElementById('amf-attacks-list');
    list.innerHTML = '';
    newMonsterAttacks.forEach((a, i) => {
        const row = document.createElement('div'); row.className = 'atk-row';
        row.innerHTML = `<input value="${a.name}" placeholder="Nom" oninput="newMonsterAttacks[${i}].name=this.value" /><input type="text" inputmode="numeric" value="${a.pct}" placeholder="%" oninput="this.value=this.value.replace(/[^0-9]/g,'');newMonsterAttacks[${i}].pct=+this.value||0" /><input value="${a.dmg}" placeholder="1d6" oninput="newMonsterAttacks[${i}].dmg=this.value" /><button class="del-btn" onclick="removeAmfAttack(${i})">✕</button>`;
        list.appendChild(row);
    });
}
function doGMMonsterDamage() {
    const mId = parseInt(getSelectValue('gm-monster-select'));
    const m = monsters.find(m => m.id === mId); if (!m) return;
    const dmg = parseInt(document.getElementById('gm-monster-dmg-input').value); if (!dmg || dmg <= 0) return;
    m.pv = Math.max(0, m.pv - dmg);
    document.getElementById('gm-monster-dmg-input').value = '';
    saveMonsters();
    clearTimeout(renderMonstersTimer); renderMonstersTimer = setTimeout(renderMonsters, 50);
}
function doGMMonsterHeal() {
    const mId = parseInt(getSelectValue('gm-monster-select'));
    const m = monsters.find(m => m.id === mId); if (!m) return;
    const amt = parseInt(document.getElementById('gm-monster-heal-input').value); if (!amt || amt <= 0) return;
    m.pv = Math.min(m.maxPV, m.pv + amt);
    document.getElementById('gm-monster-heal-input').value = '';
    saveMonsters();
    clearTimeout(renderMonstersTimer); renderMonstersTimer = setTimeout(renderMonsters, 50);
}
function rollDiceFormula(formula) {
    const expr = (formula || '').replace(/\s+/g, '').toLowerCase();
    if (!expr) return { total: 0, breakdown: '' };
    const tokens = expr.split(/(?=[+-])/);
    let total = 0;
    const parts = [];
    for (const token of tokens) {
        if (!token) continue;
        const sign = token[0] === '-' ? -1 : 1;
        const raw = token.replace(/^[+-]/, '');
        const m = raw.match(/^(\d+)d(\d+)$/);
        if (m) {
            const rolls = [];
            for (let i = 0; i < parseInt(m[1]); i++) rolls.push(Math.floor(Math.random() * parseInt(m[2])) + 1);
            const sub = rolls.reduce((a, b) => a + b, 0);
            total += sign * sub;
            parts.push(`${sign < 0 ? '−' : parts.length ? '+' : ''}[${rolls.join('+')}]`);
        } else {
            const num = parseInt(raw);
            if (!isNaN(num)) { total += sign * num; parts.push(`${sign < 0 ? '−' : parts.length ? '+' : ''}${num}`); }
        }
    }
    return { total, breakdown: parts.join(' ') };
}
function onMonsterSelectChange() {
    const mId = parseInt(getSelectValue('gm-monster-select'));
    const panel = document.getElementById('gm-attack-select')?.querySelector('.gm-select-panel');
    if (!panel) return;
    panel.innerHTML = '';
    setSelectValue('gm-attack-select', '', '— Attaque personnalisée —');
    document.getElementById('gm-monster-threshold').value = '';
    const m = monsters.find(m => m.id === mId);
    if (!m) return;
    addSelectOpt(panel, '', '— Attaque personnalisée —', () => setSelectValue('gm-attack-select', '', '— Attaque personnalisée —'));
    m.attacks.forEach((a, i) => {
        const label = `${a.name} (${a.pct}%)${a.dmg ? ' · ' + a.dmg : ''}`;
        addSelectOpt(panel, String(i), label, () => { setSelectValue('gm-attack-select', String(i), label); onAttackSelectChange(); });
    });
}
function onAttackSelectChange() {
    const mId = parseInt(getSelectValue('gm-monster-select'));
    const atkIdx = getSelectValue('gm-attack-select');
    if (atkIdx === '') return;
    const m = monsters.find(m => m.id === mId);
    if (!m) return;
    const atk = m.attacks[parseInt(atkIdx)];
    if (atk) document.getElementById('gm-monster-threshold').value = atk.pct;
}
function renderMonsters() {
    const grid = document.getElementById('monsters-grid');
    const noM = document.getElementById('no-monsters');
    grid.innerHTML = '';
    if (!monsters.length) {
        if (noM) { noM.style.display = ''; grid.appendChild(noM); }
        return;
    }
    if (noM) noM.style.display = 'none';
    monsters.forEach(m => {
        const pct = m.maxPV > 0 ? m.pv / m.maxPV : 0;
        const hpColor = pct > 0.5 ? 'var(--fail)' : pct > 0.25 ? '#e85020' : '#ff4444';
        const card = document.createElement('div'); card.className = 'monster-card';
        card.innerHTML = `
          <div class="mc-header">
            <div class="mc-name">${m.name}</div>
            <button class="mc-del" onclick="removeMonster(${m.id})">✕</button>
          </div>
          <div class="mc-body">
            <div class="mc-hp-row">
              <div><div class="mc-hp-num" style="color:${hpColor}">${m.pv}</div><div style="font-family:'Cinzel',serif;font-size:9px;color:rgba(255,150,150,.5);">/ ${m.maxPV} PV</div></div>
              <div class="mc-hp-bar-wrap"><div class="mc-hp-bar" style="width:${Math.round(pct * 100)}%;background:${hpColor};"></div></div>
              <div style="font-family:'Cinzel',serif;font-size:10px;color:rgba(255,150,150,.5);">🛡 ${m.armor}</div>
            </div>
            <div class="mc-stats">
              ${Object.entries(m.stats).map(([k, v]) => `<span class="mc-stat">${k} <span>${v}</span></span>`).join('')}
            </div>
            <div class="mc-atk-section">
              <div class="mc-atk-hdr">
                <span class="mc-atk-col-label">Nom</span>
                <span class="mc-atk-col-label center">%</span>
                <span class="mc-atk-col-label center">Dégâts</span>
                <span></span>
              </div>
              ${m.attacks.map((a, i) => `
              <div class="mc-atk-edit-row">
                <input class="mc-atk-input" value="${a.name}" placeholder="Nom" oninput="updateMonsterAttack(${m.id},${i},'name',this.value)" />
                <input class="mc-atk-input center" type="text" inputmode="numeric" value="${a.pct}" placeholder="%" oninput="this.value=this.value.replace(/[^0-9]/g,'');updateMonsterAttack(${m.id},${i},'pct',+this.value||0)" />
                <input class="mc-atk-input center" value="${a.dmg || ''}" placeholder="1d6" oninput="updateMonsterAttack(${m.id},${i},'dmg',this.value)" />
                <button class="del-btn" onclick="removeMonsterAttack(${m.id},${i})">✕</button>
              </div>`).join('')}
              <button class="add-atk-btn mc-add-atk" onclick="addMonsterAttack(${m.id})">+ Attaque</button>
            </div>
          </div>`;
        grid.appendChild(card);
    });
}
function addMonsterAttack(mId) {
    const m = monsters.find(m => m.id === mId); if (!m) return;
    m.attacks.push({ name: '', pct: 50, dmg: '' });
    saveMonsters(); renderMonsters(); refreshMonsterSelect();
}
function removeMonsterAttack(mId, idx) {
    const m = monsters.find(m => m.id === mId); if (!m) return;
    m.attacks.splice(idx, 1);
    saveMonsters(); renderMonsters(); refreshMonsterSelect();
}
function updateMonsterAttack(mId, idx, field, value) {
    const m = monsters.find(m => m.id === mId); if (!m || !m.attacks[idx]) return;
    m.attacks[idx][field] = value;
    saveMonsters();
    // Silently refresh GM roll dropdowns without re-rendering cards (preserves focus)
    const prevMonster = getSelectValue('gm-monster-select');
    refreshMonsterSelect();
    if (prevMonster) setSelectValue('gm-monster-select', prevMonster, monsters.find(x => String(x.id) === prevMonster)?.name || '');
}
function refreshMonsterSelect() {
    const wrapper = document.getElementById('gm-monster-select');
    if (!wrapper) return;
    const prevId = wrapper.dataset.value;
    const panel = wrapper.querySelector('.gm-select-panel');
    panel.innerHTML = '';
    addSelectOpt(panel, '', '— Aucun monstre —', () => { setSelectValue('gm-monster-select', '', '— Aucun monstre —'); onMonsterSelectChange(); });
    monsters.forEach(m => {
        addSelectOpt(panel, String(m.id), m.name, () => { setSelectValue('gm-monster-select', String(m.id), m.name); onMonsterSelectChange(); });
    });
    if (!monsters.find(m => String(m.id) === prevId)) {
        setSelectValue('gm-monster-select', '', '— Aucun monstre —');
        onMonsterSelectChange();
    }
}

// ═══════════════════════════════════════════
//  ROLL FEED
// ═══════════════════════════════════════════
function handleIncomingRoll(data) {
    if (!data) return;
    rollFeed.unshift({ ...data, receivedAt: Date.now() });
    if (rollFeed.length > 50) rollFeed.pop();
    localStorage.setItem(rollsKey(), JSON.stringify(rollFeed));
    debouncedSync();
    renderRollFeed();
}
function classify(roll, threshold, success) {
    if (roll <= 10 && success) return 'crit-success';
    if (roll >= 91 && !success) return 'crit-fail';
    return success ? 'success' : 'fail';
}
function renderRollFeed() {
    const feed = document.getElementById('rolls-feed');
    if (!rollFeed.length) { feed.innerHTML = '<div class="rolls-empty">En attente de jets…</div>'; return; }
    feed.innerHTML = '';
    rollFeed.forEach(d => {
        const isDie = d.threshold === null;
        const type = isDie ? 'die' : classify(d.roll, d.threshold, d.success);
        const verdicts = { success: 'SUCCÈS', fail: 'ÉCHEC', 'crit-success': 'SUCCÈS CRITIQUE', 'crit-fail': 'ÉCHEC CRITIQUE' };
        const vcls = { success: 's', fail: 'f', 'crit-success': 'cs', 'crit-fail': 'cf' };
        const row = document.createElement('div'); row.className = `roll-entry ${type}`;
        row.innerHTML = `
          <div class="re-char">${d.char || d.playerId || '?'}</div>
          <div class="re-context">
            <div class="re-skill">${d.skillName}</div>
            ${isDie ? '' : `<div class="re-threshold">Seuil : ${d.threshold}%${d.bonusMalus ? ` · BM : ${d.bonusMalus > 0 ? '+' : ''}${d.bonusMalus}` : ''}</div>`}
          </div>
          <div class="re-result">
            <div class="re-roll">${d.roll}</div>
            ${isDie ? '' : `<div class="re-verdict ${vcls[type]}">${verdicts[type]}</div>`}
          </div>`;
        feed.appendChild(row);
    });
}
function clearRolls() { rollFeed = []; localStorage.removeItem(rollsKey()); debouncedSync(); renderRollFeed(); }

// ═══════════════════════════════════════════
//  GM ROLLS
// ═══════════════════════════════════════════
function doGMFreeRoll() {
    const name = document.getElementById('gm-free-name').value.trim() || 'Jet MJ';
    const t = parseInt(document.getElementById('gm-free-threshold').value);
    if (isNaN(t) || t < 1 || t > 100) { alert('Seuil invalide.'); return; }
    if (dddiceSDK && dddiceAPI) {
        pendingGMRoll = { name, threshold: t, atk: null };
        dddiceSDK.roll([{ type: 'd10x', theme: dddiceAPI.theme }, { type: 'd10', theme: dddiceAPI.theme }])
            .catch(e => { console.error('dddice GM roll:', e); pendingGMRoll = null; const r = Math.floor(Math.random() * 100) + 1; showGMRollResult(name, t, r, r <= t); });
    } else {
        const roll = Math.floor(Math.random() * 100) + 1;
        showGMRollResult(name, t, roll, roll <= t);
    }
}
function doGMMonsterRoll() {
    const mId = parseInt(getSelectValue('gm-monster-select'));
    const t = parseInt(document.getElementById('gm-monster-threshold').value);
    if (isNaN(t) || t < 1 || t > 100) { alert('Seuil invalide.'); return; }
    const m = monsters.find(m => m.id === mId);
    const atkIdx = getSelectValue('gm-attack-select');
    const atk = (m && atkIdx !== '') ? m.attacks[parseInt(atkIdx)] : null;
    const name = atk ? `${m.name} — ${atk.name}` : m ? `${m.name} (${t}%)` : `Jet MJ (${t}%)`;
    if (dddiceSDK && dddiceAPI) {
        pendingGMRoll = { name, threshold: t, atk };
        dddiceSDK.roll([{ type: 'd10x', theme: dddiceAPI.theme }, { type: 'd10', theme: dddiceAPI.theme }])
            .catch(e => {
                console.error('dddice GM roll:', e);
                pendingGMRoll = null;
                const roll = Math.floor(Math.random() * 100) + 1;
                const success = roll <= t;
                const dmgResult = (success && atk?.dmg?.trim()) ? rollDiceFormula(atk.dmg) : null;
                showGMRollResult(name, t, roll, success, dmgResult);
            });
    } else {
        const roll = Math.floor(Math.random() * 100) + 1;
        const success = roll <= t;
        const dmgResult = (success && atk && atk.dmg && atk.dmg.trim()) ? rollDiceFormula(atk.dmg) : null;
        showGMRollResult(name, t, roll, success, dmgResult);
    }
}
function showGMRollResult(name, threshold, roll, success, dmgResult) {
    // Add to the roll feed
    handleIncomingRoll({ skillName: name, threshold, roll, success, char: 'MJ', bonusMalus: 0, playerId: 'gm' });
    if (dmgResult) handleIncomingRoll({ skillName: `${name} — Dégâts`, threshold: null, roll: dmgResult.total, success: null, char: 'MJ', bonusMalus: 0, playerId: 'gm' });
    const type = classify(roll, threshold, success);
    const verdicts = { success: 'SUCCÈS', fail: 'ÉCHEC', 'crit-success': 'SUCCÈS CRITIQUE', 'crit-fail': 'ÉCHEC CRITIQUE' };
    const colors = { success: 'var(--success)', fail: 'var(--fail)', 'crit-success': '#a8ff78', 'crit-fail': '#ff4444' };
    const dmgHtml = dmgResult
        ? `<div class="gm-rr-dmg">⚔ Dégâts : <strong>${dmgResult.total}</strong>${dmgResult.breakdown && dmgResult.breakdown !== String(dmgResult.total) ? ` <span class="gm-rr-breakdown">${dmgResult.breakdown}</span>` : ''}</div>`
        : '';
    let targetHtml = '';
    if (dmgResult) {
        const online = [...players.entries()].filter(([, p]) => p.online !== false && Date.now() - p.ts < PRESENCE_TIMEOUT);
        if (online.length) {
            const btns = online.map(([id, p]) => `<button class="gm-target-btn" data-pid="${id}" onclick="applyDamageToPlayer('${id}',${dmgResult.total})">${p.name || id.slice(-4)}</button>`).join('');
            targetHtml = `<div class="gm-target-section"><div class="gm-target-label">Appliquer à :</div><div class="gm-target-btns">${btns}</div></div>`;
        }
    }
    const el = document.getElementById('gm-roll-result');
    el.innerHTML = `
        <div class="gm-rr-name">${name}</div>
        <div class="gm-rr-roll">${roll}</div>
        <div class="gm-rr-detail">Seuil : ${threshold}%</div>
        <div class="gm-rr-verdict" style="color:${colors[type]};">${verdicts[type]}</div>
        ${dmgHtml}${targetHtml}`;
}
function applyDamageToPlayer(playerId, amount) {
    const p = players.get(playerId);
    if (!p) return;
    const hpBefore = p.hp ?? p.maxHP ?? 0;
    const hpAfter = Math.max(0, hpBefore - amount);
    p.hp = hpAfter;
    publishDamage(p.playerId, amount, hpBefore, hpAfter, p.maxHP || hpBefore, p.name);
    renderPlayerCards();
    const btn = document.querySelector(`.gm-target-btn[data-pid="${playerId}"]`);
    if (btn) { btn.disabled = true; btn.classList.add('applied'); btn.textContent = `✓ ${p.name || playerId}`; }
}

// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════
function applyTheme(light) {
    document.body.classList.toggle('light-mode', !!light);
}
function loadConfigInputs() {
    document.getElementById('cfg-light-mode').checked = !!config.lightMode;
}
function saveConfig() {
    config = {
        ...config,
        dddiceTheme: document.getElementById('cfg-dddice-theme').value || '',
        lightMode: document.getElementById('cfg-light-mode').checked,
    };
    localStorage.setItem('aria-config', JSON.stringify(config));
    if (dddiceSDK) { try { dddiceSDK.disconnect?.(); } catch (_) {} dddiceSDK = null; }
    if (dddiceResizeHandler) { window.removeEventListener('resize', dddiceResizeHandler); dddiceResizeHandler = null; }
    pendingGMRoll = null; dddiceAPI = null;
    ablyInstance = null; ablyRolls = null; ablyCards = null; ablyDamage = null;
    if (config.dddiceKey && config.dddiceRoom) initDddice();
    if (config.ablyKey) initAbly();
    toggleConfig();
}
function toggleConfig() {
    document.getElementById('config-modal').classList.toggle('show');
    document.getElementById('config-scrim').classList.toggle('show');
}

// ═══════════════════════════════════════════
//  CARD DISPLAY (player draws only)
// ═══════════════════════════════════════════
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
function renderCardHistory() {
    const feed = document.getElementById('card-history-feed');
    if (!cardHistory.length) { feed.innerHTML = '<div class="rolls-empty">Aucun tirage pour l\'instant…</div>'; return; }
    feed.innerHTML = '';
    cardHistory.forEach(entry => {
        const card = cardById(entry.cardId);
        const label = card ? (card.isJoker ? card.label : `${card.rank} de ${SUIT_FR[card.suit.name] || card.suit.name}`) : entry.cardId;
        const colorCls = card ? (card.isJoker ? 'c-purple' : card.suit.cls) : '';
        const sym = card ? (card.isJoker ? '★' : card.suit.sym) : '?';
        const row = document.createElement('div');
        row.className = 'card-history-row';
        row.innerHTML = `
          <div class="chr-player">${entry.playerName || '?'}</div>
          <div class="chr-card ${colorCls}">${sym} ${label}</div>
          <div class="chr-time">${new Date(entry.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>`;
        feed.appendChild(row);
    });
}
function clearCardHistory() {
    cardHistory = [];
    localStorage.removeItem(cardHistKey());
    debouncedSync();
    renderCardHistory();
}
async function handlePlayerCard(data) {
    if (!data?.cardId) return;
    const card = cardById(data.cardId);
    if (!card) return;
    const label = card.isJoker ? card.label : `${card.rank} de ${SUIT_FR[card.suit.name] || card.suit.name}`;
    const who = data.playerName ? `${data.playerName} — ${label}` : label;
    document.getElementById('gm-card-info').textContent = who;
    cardHistory.unshift({ cardId: data.cardId, playerName: data.playerName || '?', ts: Date.now() });
    localStorage.setItem(cardHistKey(), JSON.stringify(cardHistory));
    debouncedSync();
    renderCardHistory();
    const flipWrap = document.getElementById('flip-wrap');
    const flipInner = flipWrap.querySelector('.flip-inner');
    // Reset state
    flipWrap.classList.add('hidden');
    flipWrap.classList.remove('flipped');
    document.getElementById('drawn-card').classList.remove('ready');
    renderCardContent(card);
    document.getElementById('drawn-card').classList.add('ready');
    // Show back face instantly (no animation), then flip to reveal front
    flipInner.style.transition = 'none';
    flipWrap.classList.add('flipped');
    flipWrap.classList.remove('hidden');
    flipWrap.getBoundingClientRect();
    flipInner.style.transition = '';
    await delay(400);
    flipWrap.classList.remove('flipped');
}
function handlePlayerReshuffle() {
    const flipWrap = document.getElementById('flip-wrap');
    flipWrap.classList.remove('flipped'); flipWrap.classList.add('hidden');
    document.getElementById('drawn-card').classList.remove('ready');
    document.getElementById('gm-card-info').textContent = 'Jeu mélangé par le joueur';
}

// ═══════════════════════════════════════════
//  GM PRIVATE DECK
// ═══════════════════════════════════════════
let gmCardDeck = [];
let gmCardDrawn = new Set();
let gmCardExcluded = new Set();
let gmLastCardId = null;
let gmCardDrawing = false;
let gmCardStatusTimer = null;

function initGmDeck() {
    gmCardDeck = buildDeck();
    gmCardDrawn = new Set();
    gmCardExcluded = new Set();
    gmLastCardId = null;
    gmCardDrawing = false;
    gmBuildTracker();
    gmUpdateDeckCount();
}

function gmBuildTracker() {
    const container = document.getElementById('gm-tracker-suits');
    if (!container) return;
    container.innerHTML = '';
    for (const suit of SUITS) {
        const row = document.createElement('div'); row.className = 'suit-row-t';
        const sym = document.createElement('span'); sym.className = `suit-sym ${suit.cls}`; sym.textContent = suit.sym;
        row.appendChild(sym);
        const pills = document.createElement('div'); pills.className = 'rank-pills';
        for (const rank of RANKS) { pills.appendChild(gmMakePill(`${rank}-${suit.name}`, rank, suit.pillCls)); }
        row.appendChild(pills); container.appendChild(row);
    }
    const jRow = document.createElement('div'); jRow.className = 'suit-row-t';
    const jSym = document.createElement('span'); jSym.className = 'suit-sym c-purple'; jSym.textContent = '★';
    jRow.appendChild(jSym);
    const jPills = document.createElement('div'); jPills.className = 'rank-pills';
    jPills.appendChild(gmMakePill('joker-red', 'R★', 'is-joker'));
    jPills.appendChild(gmMakePill('joker-black', 'N★', 'is-joker'));
    jRow.appendChild(jPills); container.appendChild(jRow);
}

function gmMakePill(id, label, extraCls) {
    const p = document.createElement('span');
    p.className = `rank-pill${extraCls ? ' ' + extraCls : ''}`;
    p.id = `gm-pill-${id}`;
    p.textContent = label;
    p.onclick = () => gmTogglePill(id);
    return p;
}

function gmRefreshPill(p, id) {
    p.classList.toggle('drawn', gmCardDrawn.has(id));
    p.classList.toggle('excluded', gmCardExcluded.has(id));
}

function gmRefreshAllPills() {
    ALL_CARDS.forEach(c => { const p = document.getElementById(`gm-pill-${c.id}`); if (p) gmRefreshPill(p, c.id); });
}

function gmTogglePill(id) {
    const card = cardById(id);
    if (!card) return;
    if (gmCardExcluded.has(id)) { gmCardExcluded.delete(id); gmCardDeck.splice(Math.floor(Math.random() * (gmCardDeck.length + 1)), 0, card); gmUpdateDeckCount(); }
    else if (gmCardDrawn.has(id)) { gmCardDrawn.delete(id); gmCardDeck.splice(Math.floor(Math.random() * (gmCardDeck.length + 1)), 0, card); gmUpdateDeckCount(); }
    else { gmCardExcluded.add(id); const idx = gmCardDeck.findIndex(c => c.id === id); if (idx !== -1) { gmCardDeck.splice(idx, 1); gmUpdateDeckCount(); } }
    const p = document.getElementById(`gm-pill-${id}`); if (p) gmRefreshPill(p, id);
    gmUpdateClearBtn();
}

function gmClearExclusions() { if (gmCardDrawing) return; gmCardExcluded.clear(); gmRefreshAllPills(); gmUpdateClearBtn(); gmShowCardStatus('Exclusions effacées'); }

function gmUpdateDeckCount() {
    const n = gmCardDeck.length;
    const countEl = document.getElementById('gm-deck-count');
    if (countEl) countEl.textContent = n === 0 ? 'Vide' : `${n} carte${n !== 1 ? 's' : ''}`;
    const wrap = document.getElementById('gm-deck-wrap');
    if (wrap) wrap.classList.toggle('empty', n === 0);
    const rBtn = document.getElementById('gm-reshuffle-btn');
    if (rBtn) rBtn.classList.toggle('visible', n === 0);
    const rrBtn = document.getElementById('gm-reshuffle-remaining-btn');
    if (rrBtn) rrBtn.classList.toggle('visible', n > 1 && n < ALL_CARDS.length - gmCardExcluded.size);
    gmUpdateClearBtn();
}

function gmUpdateClearBtn() { const btn = document.getElementById('gm-clear-exclusions-btn'); if (btn) btn.classList.toggle('visible', gmCardExcluded.size > 0); }

function gmShowCardStatus(msg) {
    const el = document.getElementById('gm-card-status');
    if (!el) return;
    el.textContent = msg;
    clearTimeout(gmCardStatusTimer);
    gmCardStatusTimer = setTimeout(() => el.textContent = '', 2200);
}

function gmRenderCardContent(card) {
    const el = document.getElementById('gm-drawn-card');
    if (!el) return;
    if (card.isJoker) {
        el.className = `flip-face ${card.jokerColor === 'red' ? 'c-red' : 'c-black'}`;
        el.innerHTML = `<div class="card-corner tl"><span class="rank" style="font-size:14px;color:var(--card-purple)">JKR</span></div><div class="card-center" style="flex-direction:column;gap:6px;"><span style="font-size:50px;line-height:1;color:var(--card-purple)">★</span><span style="font-family:'Playfair Display',serif;font-size:10px;font-weight:700;letter-spacing:.12em;color:var(--card-purple)">${card.label.toUpperCase()}</span></div><div class="card-corner br"><span class="rank" style="font-size:14px;color:var(--card-purple)">JKR</span></div>`;
    } else {
        el.className = `flip-face ${card.suit.cls}`;
        el.innerHTML = `<div class="card-corner tl"><span class="rank">${card.rank}</span><span class="suit-small">${card.suit.sym}</span></div><div class="card-center">${card.suit.sym}</div><div class="card-corner br"><span class="rank">${card.rank}</span><span class="suit-small">${card.suit.sym}</span></div>`;
    }
}

async function gmRevealCard(card) {
    const flipWrap = document.getElementById('gm-flip-wrap');
    const drawnEl = document.getElementById('gm-drawn-card');
    gmRenderCardContent(card);
    drawnEl.classList.add('ready');
    const flipInner = flipWrap.querySelector('.flip-inner');
    flipInner.style.transition = 'none';
    flipWrap.classList.add('flipped');
    flipWrap.classList.remove('hidden');
    flipWrap.getBoundingClientRect();
    flipInner.style.transition = '';
    await delay(30);
    flipWrap.classList.remove('flipped');
}

async function gmDrawCard() {
    if (gmCardDrawing || gmCardDeck.length === 0) return;
    gmCardDrawing = true;
    const flipWrap = document.getElementById('gm-flip-wrap');
    if (flipWrap) { flipWrap.classList.remove('flipped'); flipWrap.classList.add('hidden'); }
    const drawnEl = document.getElementById('gm-drawn-card');
    if (drawnEl) drawnEl.classList.remove('ready');
    const drawn = gmCardDeck.pop();
    gmCardDrawn.add(drawn.id);
    gmLastCardId = drawn.id;
    const pill = document.getElementById(`gm-pill-${drawn.id}`); if (pill) gmRefreshPill(pill, drawn.id);
    gmUpdateDeckCount();
    await gmRevealCard(drawn);
    gmShowCardStatus(drawn.isJoker ? drawn.label : `${drawn.rank} de ${SUIT_FR[drawn.suit.name] || drawn.suit.name}`);
    gmCardDrawing = false;
}

async function gmAnimateShuffle() {
    const overlay = document.getElementById('gm-shuffle-overlay');
    const wrap = document.getElementById('gm-deck-wrap');
    if (!overlay || !wrap) { await delay(300); return; }
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

async function gmManualReshuffle(remainingOnly) {
    if (gmCardDrawing) return;
    gmCardDrawing = true;
    const flipWrap = document.getElementById('gm-flip-wrap');
    if (flipWrap) { flipWrap.classList.remove('flipped'); flipWrap.classList.add('hidden'); }
    const drawnEl = document.getElementById('gm-drawn-card');
    if (drawnEl) drawnEl.classList.remove('ready');
    await gmAnimateShuffle();
    if (remainingOnly) { gmCardDeck = shuffle(gmCardDeck); }
    else { gmCardDrawn.clear(); gmCardDeck = shuffle([...ALL_CARDS].filter(c => !gmCardExcluded.has(c.id))); gmLastCardId = null; gmRefreshAllPills(); }
    gmUpdateDeckCount();
    gmShowCardStatus(remainingOnly ? '↺ Restant mélangé' : '↺ Mélangé');
    gmCardDrawing = false;
}

// ═══════════════════════════════════════════
//  GM FILE VIEWER
// ═══════════════════════════════════════════
function openGmFileViewer(fileId) {
    const f = gmFiles.find(f => f.id === fileId);
    if (!f) return;
    document.getElementById('gm-fv-title').textContent = f.name;
    const body = document.getElementById('gm-fv-body');
    body.innerHTML = '';
    if (f.type && f.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = f.url; img.className = 'fv-image';
        body.appendChild(img);
    } else if (f.type === 'application/pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = f.url; iframe.className = 'fv-iframe';
        body.appendChild(iframe);
    } else if (f.type && f.type.startsWith('text/')) {
        const pre = document.createElement('pre');
        pre.className = 'fv-text'; pre.textContent = 'Chargement…';
        body.appendChild(pre);
        fetch(f.url).then(r => r.text()).then(t => { pre.textContent = t; }).catch(() => { pre.textContent = 'Erreur de chargement.'; });
    } else {
        const wrap = document.createElement('div');
        wrap.className = 'fv-unsupported';
        wrap.innerHTML = `<div class="fv-unsupported-icon">${_fileIcon(f.type)}</div><div class="fv-unsupported-name">${_escHtml(f.name)}</div><a class="fv-download-link" href="${f.url}" target="_blank" rel="noopener">Ouvrir dans un nouvel onglet</a>`;
        body.appendChild(wrap);
    }
    document.getElementById('gm-file-viewer-scrim').classList.add('show');
    document.getElementById('gm-file-viewer-modal').classList.add('show');
}

function closeGmFileViewer() {
    document.getElementById('gm-file-viewer-scrim').classList.remove('show');
    document.getElementById('gm-file-viewer-modal').classList.remove('show');
    document.getElementById('gm-fv-body').innerHTML = '';
}

// ═══════════════════════════════════════════
//  GM ALCHEMY
// ═══════════════════════════════════════════
function saveGMPotions() { if (currentCampaignId) { localStorage.setItem(potionsKey(), JSON.stringify(gmPotions)); debouncedSync(); } }

function addGMPotion() {
    const name = document.getElementById('apf-name').value.trim();
    if (!name) { alert('Entrez un nom.'); return; }
    const desc = document.getElementById('apf-desc').value.trim();
    const ingredients = document.getElementById('apf-ingredients').value.trim();
    const successChance = parseInt(document.getElementById('apf-chance').value) || 0;
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    gmPotions.push({ id, name, desc, ingredients, successChance });
    saveGMPotions();
    ['apf-name', 'apf-desc', 'apf-ingredients', 'apf-chance'].forEach(eid => { const el = document.getElementById(eid); if (el) el.value = ''; });
    renderGMPotions();
}

function removeGMPotion(id) {
    gmPotions = gmPotions.filter(p => p.id !== id);
    saveGMPotions();
    renderGMPotions();
}

function updateGMPotion(id, field, value) {
    const p = gmPotions.find(p => p.id === id);
    if (!p) return;
    p[field] = value;
    saveGMPotions();
}

function renderGMPotions() {
    const list = document.getElementById('gm-pot-list');
    const empty = document.getElementById('gm-pot-empty');
    if (!list) return;
    list.innerHTML = '';
    if (!gmPotions.length) {
        if (empty) { empty.style.display = ''; list.appendChild(empty); }
        return;
    }
    if (empty) empty.style.display = 'none';
    gmPotions.forEach(p => {
        const card = document.createElement('div');
        card.className = 'gm-pot-card';
        card.innerHTML = `
            <div class="gm-pot-card-header">
                <span class="gm-pot-card-icon">⚗</span>
                <input class="gm-pot-name-input" value="${p.name.replace(/"/g,'&quot;')}" placeholder="Nom" oninput="updateGMPotion('${p.id}','name',this.value)" />
                <div class="gm-pot-chance-wrap"><input class="gm-pot-chance-badge" type="text" inputmode="numeric" value="${p.successChance || ''}" placeholder="—" oninput="this.value=this.value.replace(/[^0-9]/g,'');updateGMPotion('${p.id}','successChance',+this.value||0)" /><span class="gm-pot-chance-suffix">%</span></div>
            </div>
            <div class="gm-pot-card-body">
                <div class="gm-pot-field-row">
                    <span class="gm-pot-field-icon">✦</span>
                    <input class="gm-pot-text-input" value="${(p.desc||'').replace(/"/g,'&quot;')}" placeholder="Description / Effet" oninput="updateGMPotion('${p.id}','desc',this.value)" />
                </div>
                <div class="gm-pot-field-row">
                    <span class="gm-pot-field-icon">◈</span>
                    <input class="gm-pot-text-input" value="${(p.ingredients||'').replace(/"/g,'&quot;')}" placeholder="Ingrédients" oninput="updateGMPotion('${p.id}','ingredients',this.value)" />
                </div>
            </div>
            <button class="gm-pot-del-btn" onclick="removeGMPotion('${p.id}')">✕</button>`;
        list.appendChild(card);
    });
}

function toggleAlchemyImportPicker(btn) {
    const picker = document.getElementById('alchemy-import-picker');
    if (picker.style.display !== 'none') { picker.style.display = 'none'; return; }
    const campaigns = getCampaigns().filter(c => c.id !== currentCampaignId);
    if (!campaigns.length) {
        picker.innerHTML = '<div class="alchemy-import-empty">Aucune autre campagne disponible.</div>';
    } else {
        picker.innerHTML = campaigns.map(c => {
            const safeName = c.name.replace(/'/g, '\\\'').replace(/"/g, '&quot;');
            return `<button class="alchemy-import-option" onclick="importAlchemyFrom('${c.id}','${safeName}')">${c.name}</button>`;
        }).join('');
    }
    picker.style.display = '';
}

function importAlchemyFrom(sourceId, sourceName) {
    document.getElementById('alchemy-import-picker').style.display = 'none';
    const sourcePotions = JSON.parse(localStorage.getItem('aria-gm-potions-' + sourceId) || '[]');
    if (!sourcePotions.length) { alert(`Aucune recette dans la campagne "${sourceName}".`); return; }
    if (!confirm(`Remplacer le grimoire actuel par les ${sourcePotions.length} recette(s) de "${sourceName}" ?`)) return;
    gmPotions = sourcePotions.map(p => ({
        ...p,
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)
    }));
    saveGMPotions();
    renderGMPotions();
}

function sendPotionGrant(playerId, potionId) {
    if (!ablyDamage) return;
    const player = players.get(playerId);
    if (!player) return;
    if (!player.potionRecipeIds) player.potionRecipeIds = [];
    const alreadyGranted = player.potionRecipeIds.includes(potionId);
    if (alreadyGranted) {
        // Revoke
        ablyDamage.publish('potion-revoke', { playerId: player.playerId, potionId });
        player.potionRecipeIds = player.potionRecipeIds.filter(id => id !== potionId);
    } else {
        // Grant
        const pot = gmPotions.find(p => p.id === potionId);
        if (!pot) return;
        ablyDamage.publish('potion-grant', { playerId: player.playerId, potion: { ...pot } });
        player.potionRecipeIds.push(potionId);
    }
    openPlayerDetails(playerId);
}
function sendVialGrant(playerId, qty) {
    if (!ablyDamage) return;
    const p = players.get(playerId);
    if (!p) return;
    ablyDamage.publish('vial-grant', { playerId: p.playerId, qty });
}

// ═══════════════════════════════════════════
//  GM FILES
// ═══════════════════════════════════════════
function _escHtml(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _fileIcon(type) {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼';
    if (type === 'application/pdf') return '📕';
    if (type.startsWith('text/')) return '📝';
    return '📄';
}

function saveGmFiles() { localStorage.setItem(filesKey(), JSON.stringify(gmFiles)); debouncedSync(); }

async function uploadFileToStorage(file) {
    const fileId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const parts = file.name.split('.');
    const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
    const storageName = ext ? `${fileId}.${ext}` : fileId;
    const path = `${currentCampaignId}/${storageName}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/campaign-files/${path}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': file.type || 'application/octet-stream',
            'x-upsert': 'false',
        },
        body: file,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Erreur ${res.status}`);
    }
    return { fileId, path, url: `${SUPABASE_URL}/storage/v1/object/public/campaign-files/${path}` };
}

async function deleteFileFromStorage(path) {
    try {
        await fetch(`${SUPABASE_URL}/storage/v1/object/campaign-files/${path}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        });
    } catch(e) { console.warn('[ARIA] Storage delete failed:', e); }
}

async function handleFileUpload(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('Fichier trop volumineux (max 50 Mo).'); return; }
    const btn = document.getElementById('file-upload-btn');
    const progress = document.getElementById('file-upload-progress');
    if (btn) btn.disabled = true;
    if (progress) { progress.style.display = ''; progress.textContent = 'Envoi en cours…'; progress.className = 'gm-files-progress'; }
    try {
        const { fileId, path, url } = await uploadFileToStorage(file);
        gmFiles.push({ id: fileId, name: file.name, type: file.type || 'application/octet-stream', path, url, grantedTo: [] });
        saveGmFiles();
        renderGmFiles();
        if (progress) { progress.textContent = '✓ Fichier ajouté.'; setTimeout(() => { progress.style.display = 'none'; }, 2500); }
    } catch(e) {
        if (progress) { progress.textContent = `Erreur : ${e.message}`; progress.className = 'gm-files-progress error'; setTimeout(() => { progress.style.display = 'none'; }, 4000); }
        console.error('[ARIA] Upload error:', e);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function removeGmFile(fileId) {
    const f = gmFiles.find(f => f.id === fileId);
    if (!f) return;
    if (ablyDamage) ablyDamage.publish('file-revoke', { playerId: 'all', fileId });
    await deleteFileFromStorage(f.path);
    gmFiles = gmFiles.filter(f => f.id !== fileId);
    saveGmFiles();
    renderGmFiles();
}

function grantFileToAll(fileId) {
    const f = gmFiles.find(f => f.id === fileId);
    if (!f) return;
    if (f.grantedTo === 'all') {
        f.grantedTo = [];
        if (ablyDamage) ablyDamage.publish('file-revoke', { playerId: 'all', fileId });
    } else {
        f.grantedTo = 'all';
        if (ablyDamage) {
            players.forEach(p => {
                if (p.online !== false && Date.now() - p.ts < PRESENCE_TIMEOUT) {
                    ablyDamage.publish('file-grant', { playerId: p.playerId, file: { id: f.id, name: f.name, type: f.type, url: f.url } });
                }
            });
        }
    }
    saveGmFiles();
    renderGmFiles();
}

function grantFileToPlayer(fileId, charId) {
    const f = gmFiles.find(f => f.id === fileId);
    const p = players.get(charId);
    if (!f || !p) return;
    if (f.grantedTo === 'all') { openPlayerDetails(charId); return; }
    if (!Array.isArray(f.grantedTo)) f.grantedTo = [];
    if (f.grantedTo.includes(charId)) {
        f.grantedTo = f.grantedTo.filter(id => id !== charId);
        if (ablyDamage) ablyDamage.publish('file-revoke', { playerId: p.playerId, fileId });
    } else {
        f.grantedTo.push(charId);
        if (ablyDamage) ablyDamage.publish('file-grant', { playerId: p.playerId, file: { id: f.id, name: f.name, type: f.type, url: f.url } });
    }
    saveGmFiles();
    openPlayerDetails(charId);
}

function sendFileGrantsToPlayer(playerData) {
    if (!ablyDamage) return;
    for (const f of gmFiles) {
        const shouldGrant = f.grantedTo === 'all' || (Array.isArray(f.grantedTo) && f.grantedTo.includes(playerData.charId));
        if (shouldGrant) {
            ablyDamage.publish('file-grant', { playerId: playerData.playerId, file: { id: f.id, name: f.name, type: f.type, url: f.url } });
        }
    }
}

function renderGmFiles() {
    const list = document.getElementById('gm-files-list');
    const empty = document.getElementById('gm-files-empty');
    if (!list) return;
    list.innerHTML = '';
    if (!gmFiles.length) {
        if (empty) { empty.style.display = ''; list.appendChild(empty); }
        return;
    }
    if (empty) empty.style.display = 'none';
    gmFiles.forEach(f => {
        const isAll = f.grantedTo === 'all';
        const count = isAll ? 'Tous' : (Array.isArray(f.grantedTo) ? f.grantedTo.length : 0);
        const grantLabel = isAll ? 'Tous les joueurs' : (count > 0 ? `${count} joueur(s)` : 'Aucun accès');
        const card = document.createElement('div');
        card.className = 'gm-file-card';
        card.innerHTML = `
            <div class="gm-file-icon">${_fileIcon(f.type)}</div>
            <div class="gm-file-info">
                <div class="gm-file-name">${_escHtml(f.name)}</div>
                <div class="gm-file-grant-status">${grantLabel}</div>
            </div>
            <div class="gm-file-actions">
                <button class="gm-file-open-btn" onclick="openGmFileViewer('${f.id}')" title="Ouvrir">Ouvrir</button>
                <button class="gm-file-btn${isAll ? ' active' : ''}" onclick="grantFileToAll('${f.id}')" title="${isAll ? 'Révoquer accès global' : 'Accorder à tous'}">🌍</button>
                <button class="gm-file-del-btn" onclick="removeGmFile('${f.id}')" title="Supprimer">✕</button>
            </div>`;
        list.appendChild(card);
    });
}
