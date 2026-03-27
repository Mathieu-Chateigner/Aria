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
let config = JSON.parse(localStorage.getItem('aria-gm-config') || '{}');
let ablyInstance = null, ablyRolls = null, ablyCards = null, ablyDamage = null;
let dddiceSDK = null;            // ThreeDDice SDK instance
let dddiceAPI = null;            // { theme } once connected
let pendingGMRoll = null;        // { name, threshold, atk } for GM rolls in progress
let dddiceResizeHandler = null;  // stored so we can remove it before re-registering

// Players presence map: playerId -> {name,charClass,hp,maxHP,stats,ts}
const players = new Map();
const PRESENCE_TIMEOUT = 30000; // 30s offline threshold

// Campaign state — loaded after selection
let currentCampaignId = null;
let monsters = [];
let newMonsterAttacks = [];
let rollFeed = [];
let cardHistory = [];
let sweepIntervalId = null;
let gmClickHandlerRegistered = false;

// ═══════════════════════════════════════════
//  CAMPAIGN MANAGEMENT
// ═══════════════════════════════════════════
function monstersKey()  { return 'aria-gm-monsters-'    + currentCampaignId; }
function rollsKey()     { return 'aria-gm-rolls-'        + currentCampaignId; }
function cardHistKey()  { return 'aria-gm-card-history-' + currentCampaignId; }

function getCampaigns() { return JSON.parse(localStorage.getItem('aria-gm-campaigns') || '[]'); }
function saveCampaigns(campaigns) { localStorage.setItem('aria-gm-campaigns', JSON.stringify(campaigns)); }

function migrateGMIfNeeded() {
    if (localStorage.getItem('aria-gm-campaigns')) return;
    const oldMonsters = localStorage.getItem('aria-gm-monsters');
    const oldRolls    = localStorage.getItem('aria-gm-rolls');
    const oldCards    = localStorage.getItem('aria-gm-card-history');
    if (!oldMonsters && !oldRolls && !oldCards) return;
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    saveCampaigns([{ id, name: 'Campagne 1' }]);
    if (oldMonsters) localStorage.setItem('aria-gm-monsters-' + id, oldMonsters);
    if (oldRolls)    localStorage.setItem('aria-gm-rolls-' + id, oldRolls);
    if (oldCards)    localStorage.setItem('aria-gm-card-history-' + id, oldCards);
}

function loadCampaignState(id) {
    const campaigns = getCampaigns();
    if (!campaigns.find(c => c.id === id)) return false;
    currentCampaignId = id;
    monsters  = JSON.parse(localStorage.getItem(monstersKey())  || '[]');
    rollFeed  = JSON.parse(localStorage.getItem(rollsKey())     || '[]');
    cardHistory = JSON.parse(localStorage.getItem(cardHistKey()) || '[]');
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
        card.innerHTML = `<button class="sel-card-delete" onclick="event.stopPropagation();deleteCampaign('${c.id}')" title="Supprimer">✕</button><div class="sel-card-name">${c.name}</div>`;
        card.addEventListener('click', () => selectCampaign(c.id));
        grid.appendChild(card);
    });
}

function showSelectionScreen() {
    document.getElementById('selection-screen').style.display = 'flex';
    document.getElementById('app-wrapper').style.display = 'none';
    document.getElementById('new-campaign-form').style.display = 'none';
    renderCampaignScreen();
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
    campaigns.push({ id, name });
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
        localStorage.setItem(rollsKey(), JSON.stringify(rollFeed));
        localStorage.setItem(cardHistKey(), JSON.stringify(cardHistory));
    }
    if (sweepIntervalId) { clearInterval(sweepIntervalId); sweepIntervalId = null; }
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
window.addEventListener('DOMContentLoaded', () => {
    migrateGMIfNeeded();
    document.getElementById('version-display').textContent = 'v' + VERSION;
    showSelectionScreen();
});

function initApp() {
    renderMonsters();
    renderRollFeed();
    renderCardHistory();
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
        sel.onchange = () => { if (dddiceAPI) dddiceAPI.theme = sel.value; config.dddiceTheme = sel.value; localStorage.setItem('aria-gm-config', JSON.stringify(config)); };
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
        ablyInstance = new Ably.Realtime({ key: config.ablyKey });
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
        ablyDamage.subscribe('presence', msg => { console.log('[ARIA] presence received:', msg.data?.playerId?.slice(-6), msg.data?.name); handlePresence(msg.data); });
    } catch (e) { console.error('Ably:', e); setAblyStatus(false); }
}
function setAblyStatus(ok) {
    ['ably-dot', 'cfg-ably-dot'].forEach(id => { const el = document.getElementById(id); if (el) el.className = 'status-dot ' + (ok ? 'connected' : 'error'); });
    ['ably-status', 'cfg-ably-status'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ok ? 'Ably connecté' : 'Ably erreur'; });
}
function publishDamage(targetId, damage, hpBefore, hpAfter, maxHP) {
    if (!ablyDamage) return;
    ablyDamage.publish('damage', { targetId, damage, hpBefore, hpAfter, maxHP, source: 'gm' });
}
function publishHeal(targetId, amount, hpBefore, hpAfter, maxHP) {
    if (!ablyDamage) return;
    ablyDamage.publish('heal', { targetId, amount, hpBefore, hpAfter, maxHP, source: 'gm' });
}

// ═══════════════════════════════════════════
//  PLAYER PRESENCE
// ═══════════════════════════════════════════
function handlePresence(data) {
    if (!data?.playerId) return;
    players.set(data.playerId, { ...data, ts: Date.now() });
    renderPlayerCards();
}
function sweepOfflinePlayers() {
    const now = Date.now();
    let changed = false;
    players.forEach((p, id) => {
        const wasOnline = p.online !== false;
        const isOnline = now - p.ts < PRESENCE_TIMEOUT;
        if (wasOnline !== isOnline) { p.online = isOnline; changed = true; }
        else if (p.online === undefined) { p.online = isOnline; changed = true; }
    });
    if (changed) renderPlayerCards();
}
function renderPlayerCards() {
    const grid = document.getElementById('players-grid');
    const noP = document.getElementById('no-players');
    if (players.size === 0) {
        noP.style.display = '';
        grid.innerHTML = '';
        document.getElementById('player-count').textContent = '0 joueur(s) en ligne';
        return;
    }
    noP.style.display = 'none';
    const online = [...players.values()].filter(p => p.online !== false).length;
    document.getElementById('player-count').textContent = `${online}/${players.size} joueur(s) en ligne`;
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
              <div class="pc-name">${p.name || playerId} <span style="font-family:monospace;font-size:9px;opacity:.35;">#${playerId.slice(-6)}</span></div>
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

    let html = '';

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
    const realInv = inventory.filter(i => i.name);
    if (realInv.length) {
        html += `<div class="pdm-section"><div class="pdm-section-title">Inventaire</div><div class="pdm-list">`;
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
    publishDamage(playerId, dmg, hpBefore, hpAfter, p.maxHP || hpBefore);
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
    publishHeal(playerId, amt, hpBefore, hpAfter, p.maxHP || hpBefore);
    renderPlayerCards();
}

// ═══════════════════════════════════════════
//  MONSTERS
// ═══════════════════════════════════════════
function saveMonsters() { localStorage.setItem(monstersKey(), JSON.stringify(monsters)); }
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
    row.innerHTML = `<input placeholder="Nom" oninput="newMonsterAttacks[${idx}].name=this.value" /><input type="number" min="1" max="100" placeholder="%" oninput="newMonsterAttacks[${idx}].pct=+this.value" /><input placeholder="1d6" oninput="newMonsterAttacks[${idx}].dmg=this.value" /><button class="del-btn" onclick="removeAmfAttack(${idx})">✕</button>`;
    list.appendChild(row);
}
function removeAmfAttack(idx) {
    newMonsterAttacks.splice(idx, 1);
    // re-render amf attacks
    const list = document.getElementById('amf-attacks-list');
    list.innerHTML = '';
    newMonsterAttacks.forEach((a, i) => {
        const row = document.createElement('div'); row.className = 'atk-row';
        row.innerHTML = `<input value="${a.name}" placeholder="Nom" oninput="newMonsterAttacks[${i}].name=this.value" /><input type="number" value="${a.pct}" min="1" max="100" placeholder="%" oninput="newMonsterAttacks[${i}].pct=+this.value" /><input value="${a.dmg}" placeholder="1d6" oninput="newMonsterAttacks[${i}].dmg=this.value" /><button class="del-btn" onclick="removeAmfAttack(${i})">✕</button>`;
        list.appendChild(row);
    });
}
function doGMMonsterDamage() {
    const mId = parseInt(getSelectValue('gm-monster-select'));
    const m = monsters.find(m => m.id === mId); if (!m) return;
    const dmg = parseInt(document.getElementById('gm-monster-dmg-input').value); if (!dmg || dmg <= 0) return;
    m.pv = Math.max(0, m.pv - dmg);
    document.getElementById('gm-monster-dmg-input').value = '';
    saveMonsters(); renderMonsters();
}
function doGMMonsterHeal() {
    const mId = parseInt(getSelectValue('gm-monster-select'));
    const m = monsters.find(m => m.id === mId); if (!m) return;
    const amt = parseInt(document.getElementById('gm-monster-heal-input').value); if (!amt || amt <= 0) return;
    m.pv = Math.min(m.maxPV, m.pv + amt);
    document.getElementById('gm-monster-heal-input').value = '';
    saveMonsters(); renderMonsters();
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
    if (!monsters.length) {
        grid.innerHTML = ''; grid.appendChild(noM); noM.style.display = ''; return;
    }
    noM.style.display = 'none'; grid.innerHTML = '';
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
                <input class="mc-atk-input center" type="number" min="1" max="100" value="${a.pct}" placeholder="%" oninput="updateMonsterAttack(${m.id},${i},'pct',+this.value)" />
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
function clearRolls() { rollFeed = []; localStorage.removeItem(rollsKey()); renderRollFeed(); }

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
    publishDamage(playerId, amount, hpBefore, hpAfter, p.maxHP || hpBefore);
    renderPlayerCards();
    const btn = document.querySelector(`.gm-target-btn[data-pid="${playerId}"]`);
    if (btn) { btn.disabled = true; btn.classList.add('applied'); btn.textContent = `✓ ${p.name || playerId}`; }
}

// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════
function loadConfigInputs() {
    document.getElementById('cfg-dddice-key').value = config.dddiceKey || '';
    document.getElementById('cfg-dddice-room').value = config.dddiceRoom || '';
    document.getElementById('cfg-ably-key').value = config.ablyKey || '';
}
function saveConfig() {
    config = {
        dddiceKey: document.getElementById('cfg-dddice-key').value.trim(),
        dddiceRoom: document.getElementById('cfg-dddice-room').value.trim(),
        dddiceTheme: document.getElementById('cfg-dddice-theme').value || '',
        ablyKey: document.getElementById('cfg-ably-key').value.trim(),
    };
    localStorage.setItem('aria-gm-config', JSON.stringify(config));
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
