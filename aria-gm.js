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

// Players presence map: playerId -> {name,charClass,hp,maxHP,stats,ts}
const players = new Map();
const PRESENCE_TIMEOUT = 30000; // 30s offline threshold

// Monsters array
let monsters = JSON.parse(localStorage.getItem('aria-gm-monsters') || '[]');
let newMonsterAttacks = [];

// Roll feed
let rollFeed = JSON.parse(localStorage.getItem('aria-gm-rolls') || '[]');

// Card history
let cardHistory = JSON.parse(localStorage.getItem('aria-gm-card-history') || '[]');


// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('version-display').textContent = 'v' + VERSION;
    renderMonsters();
    renderRollFeed();
    renderCardHistory();
    loadConfigInputs();
    if (config.ablyKey) initAbly();
    setInterval(sweepOfflinePlayers, 10000);
});

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
            <div>
              <div class="pc-name">${p.name || playerId} <span style="font-family:monospace;font-size:9px;opacity:.35;">#${playerId.slice(-6)}</span></div>
              <div class="pc-class">${p.charClass || ''}</div>
            </div>
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
function saveMonsters() { localStorage.setItem('aria-gm-monsters', JSON.stringify(monsters)); }
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
function applyMonsterDamage(id) {
    const m = monsters.find(m => m.id === id); if (!m) return;
    const dmg = parseInt(document.getElementById(`mc-dmg-${id}`).value); if (!dmg || dmg <= 0) return;
    m.pv = Math.max(0, m.pv - dmg);
    document.getElementById(`mc-dmg-${id}`).value = '';
    saveMonsters(); renderMonsters();
}
function applyMonsterHeal(id) {
    const m = monsters.find(m => m.id === id); if (!m) return;
    const amt = parseInt(document.getElementById(`mc-heal-${id}`).value); if (!amt || amt <= 0) return;
    m.pv = Math.min(m.maxPV, m.pv + amt);
    document.getElementById(`mc-heal-${id}`).value = '';
    saveMonsters(); renderMonsters();
}
function rollMonsterAttack(mId, pct, atkName) {
    const roll = Math.floor(Math.random() * 100) + 1;
    const success = roll <= pct;
    showGMRollResult(atkName, pct, roll, success);
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
            ${m.attacks.length ? `<div class="mc-attacks">${m.attacks.map(a => `<div class="mc-attack-row" onclick="rollMonsterAttack(${m.id},${a.pct},'${m.name}: ${a.name}')"><span class="mc-atk-name">${a.name}</span><span class="mc-atk-pct">${a.pct}%</span><span class="mc-atk-dmg">${a.dmg || '—'}</span></div>`).join('')}</div>` : ''}
            <div class="mc-actions">
              <input class="mc-input" id="mc-dmg-${m.id}" type="text" inputmode="numeric" placeholder="Dégâts"
                oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                onkeydown="if(event.key==='Enter')applyMonsterDamage(${m.id})" />
              <button class="mc-btn dmg" onclick="applyMonsterDamage(${m.id})">⚔</button>
              <input class="mc-heal-input" id="mc-heal-${m.id}" type="text" inputmode="numeric" placeholder="Soins"
                oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                onkeydown="if(event.key==='Enter')applyMonsterHeal(${m.id})" />
              <button class="mc-btn heal" onclick="applyMonsterHeal(${m.id})">♥</button>
            </div>
          </div>`;
        grid.appendChild(card);
    });
}
function refreshMonsterSelect() {
    const sel = document.getElementById('gm-monster-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Aucun monstre —</option>';
    monsters.forEach(m => { const o = document.createElement('option'); o.value = m.id; o.textContent = m.name; sel.appendChild(o); });
}

// ═══════════════════════════════════════════
//  ROLL FEED
// ═══════════════════════════════════════════
function handleIncomingRoll(data) {
    if (!data) return;
    rollFeed.unshift({ ...data, receivedAt: Date.now() });
    if (rollFeed.length > 50) rollFeed.pop();
    localStorage.setItem('aria-gm-rolls', JSON.stringify(rollFeed));
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
function clearRolls() { rollFeed = []; localStorage.removeItem('aria-gm-rolls'); renderRollFeed(); }

// ═══════════════════════════════════════════
//  GM ROLLS
// ═══════════════════════════════════════════
function doGMFreeRoll() {
    const name = document.getElementById('gm-free-name').value.trim() || 'Jet MJ';
    const t = parseInt(document.getElementById('gm-free-threshold').value);
    if (isNaN(t) || t < 1 || t > 100) { alert('Seuil invalide.'); return; }
    const roll = Math.floor(Math.random() * 100) + 1;
    showGMRollResult(name, t, roll, roll <= t);
}
function doGMMonsterRoll() {
    const mId = parseInt(document.getElementById('gm-monster-select').value);
    const t = parseInt(document.getElementById('gm-monster-threshold').value);
    if (isNaN(t) || t < 1 || t > 100) { alert('Seuil invalide.'); return; }
    const m = monsters.find(m => m.id === mId);
    const name = m ? `${m.name} (${t}%)` : (`Jet MJ (${t}%)`);
    const roll = Math.floor(Math.random() * 100) + 1;
    showGMRollResult(name, t, roll, roll <= t);
}
function showGMRollResult(name, threshold, roll, success) {
    const type = classify(roll, threshold, success);
    const verdicts = { success: 'SUCCÈS', fail: 'ÉCHEC', 'crit-success': 'SUCCÈS CRITIQUE', 'crit-fail': 'ÉCHEC CRITIQUE' };
    const colors = { success: 'var(--success)', fail: 'var(--fail)', 'crit-success': '#a8ff78', 'crit-fail': '#ff4444' };
    const el = document.getElementById('gm-roll-result');
    el.innerHTML = `
        <div style="font-family:'Cinzel',serif;font-size:11px;color:var(--parchment-dim);">${name}</div>
        <div class="gm-rr-roll">${roll}</div>
        <div class="gm-rr-detail">Seuil : ${threshold}%</div>
        <div class="gm-rr-verdict" style="color:${colors[type]};">${verdicts[type]}</div>`;
}

// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════
function loadConfigInputs() { document.getElementById('cfg-ably-key').value = config.ablyKey || ''; }
function saveConfig() {
    config = { ablyKey: document.getElementById('cfg-ably-key').value.trim() };
    localStorage.setItem('aria-gm-config', JSON.stringify(config));
    ablyInstance = null; ablyRolls = null; ablyCards = null; ablyDamage = null;
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
    localStorage.removeItem('aria-gm-card-history');
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
    localStorage.setItem('aria-gm-card-history', JSON.stringify(cardHistory));
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
