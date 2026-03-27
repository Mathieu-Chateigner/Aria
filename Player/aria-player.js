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
    name: "Ewald Asrahan",
    class: "Disciple étranger à l'académie",
    stats: { FOR: 9, DEX: 10, END: 15, INT: 14, CHA: 11, PV: 14 },
    physical: { age: "28", taille: "", poids: "", yeux: "", cheveux: "", signes: "" },
    inventory: [],
    weapons: [{ nom: '', degats: '' }, { nom: '', degats: '' }, { nom: '', degats: '' }],
    protection: { nom: '', valeur: 0 },
    skills: [
        { name: "Artisanat, construire", link: "DEX/INT", pct: 48 },
        { name: "Combat rapproché", link: "FOR/DEX", pct: 38 },
        { name: "Combat à distance", link: "FOR/DEX", pct: 38 },
        { name: "Connaissance de la nature", link: "DEX/INT", pct: 58 },
        { name: "Connaissance des secrets", link: "INT/CHA", pct: 70 },
        { name: "Courir, sauter", link: "DEX/END", pct: 50 },
        { name: "Discrétion", link: "DEX/CHA", pct: 50 },
        { name: "Droit", link: "INT/CHA", pct: 40 },
        { name: "Esquiver", link: "DEX/INT", pct: 48 },
        { name: "Intimider", link: "FOR/CHA", pct: 40 },
        { name: "Lire, écrire", link: "INT/CHA", pct: 70 },
        { name: "Mentir, convaincre", link: "INT/CHA", pct: 50 },
        { name: "Perception", link: "INT/CHA", pct: 70 },
        { name: "Piloter", link: "DEX/END", pct: 50 },
        { name: "Psychologie", link: "END/INT", pct: 58 },
        { name: "Réflexes", link: "DEX/INT", pct: 38 },
        { name: "Serrures et pièges", link: "DEX/END", pct: 50 },
        { name: "Soigner", link: "INT/CHA", pct: 50 },
        { name: "Survie", link: "END/INT", pct: 50 },
        { name: "Voler", link: "DEX/INT", pct: 58 },
    ],
    specials: [{ name: "Bonneteau", desc: "Intervertir 2 petits objets dans le champ de vision", pct: 50 }]
};

let character = JSON.parse(localStorage.getItem('aria-character') || 'null') || DEFAULT_CHAR;

// Per-tab unique ID — persists across refreshes (sessionStorage) but differs between tabs
let playerId = sessionStorage.getItem('aria-player-id');
if (!playerId) { playerId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 9); sessionStorage.setItem('aria-player-id', playerId); }
if (!character.physical) character.physical = { age: '', taille: '', poids: '', yeux: '', cheveux: '', signes: '' };
if (!character.inventory) character.inventory = [];
if (!character.weapons) character.weapons = [{ nom: '', degats: '' }, { nom: '', degats: '' }, { nom: '', degats: '' }];
if (!character.protection) character.protection = { nom: '', valeur: 0 };
if (!character.potions) character.potions = [];

let config = JSON.parse(localStorage.getItem('aria-config') || '{}');
let bonusMalus = 0;
let multiplier = 1;
let isRolling = false;
let dddiceAPI = null;
let dddiceSDK = null;            // ThreeDDice SDK instance
let pendingDddiceRoll = null;    // { skillName, threshold } waiting for RollFinished event
let dddiceRollSafetyTimer = null; // fallback timer in case RollFinished never fires
let ablyRolls = null, ablyCards = null, ablyDamage = null;
let currentHP = null;

// card state
const saved = JSON.parse(localStorage.getItem('aria-cards') || 'null');
let cardDeck = saved?.deckIds?.map(id => cardById(id)).filter(Boolean) || buildDeck();
let cardDrawn = new Set(saved?.drawn || []);
let cardExcluded = new Set(saved?.excluded || []);
let lastCardId = saved?.lastCardId || null;
let cardDrawing = false;

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('version-display').textContent = 'v' + VERSION;
    document.getElementById('pid-display').textContent = '#' + playerId.slice(-6);
    initCurrentHP();
    renderAll();
    buildTracker();
    updateDeckCount();
    if (lastCardId) restoreCard();
    loadConfigInputs();
    if (config.dddiceKey && config.dddiceRoom) initDddice();
    if (config.ablyKey) initAbly();
    // Auto-save on any input change in the character tab
    document.getElementById('tab-char').addEventListener('input', scheduleAutoSave);
    document.getElementById('tab-alchemy').addEventListener('input', scheduleAutoSave);
    // Send presence heartbeat every 5s
    setInterval(sendPresence, 5000);
});

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
//  HP
// ═══════════════════════════════════════════
function getMaxHP() { return character.stats.PV || 14; }
function initCurrentHP() {
    if (currentHP === null) currentHP = parseInt(localStorage.getItem('aria-current-hp'));
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
    localStorage.setItem('aria-current-hp', currentHP);
    updateHPDisplay();
    triggerDamageVFX(damage, false);
    showToast('gm-dmg-toast', `⚔ Dégâts reçus : -${damage} PV`);
    if (hpAfter <= 0) showMort();
}
function handleGMHeal(data) {
    const { amount, hpBefore, hpAfter, maxHP } = data;
    animateHPChange(hpBefore, hpAfter, maxHP);
    currentHP = hpAfter;
    localStorage.setItem('aria-current-hp', currentHP);
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
    renderSkills();
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
}

function renderSkills() {
    const list = document.getElementById('skill-list');
    list.innerHTML = '';
    (character.skills || []).forEach(skill => {
        const eff = Math.max(1, Math.min(100, skill.pct + bonusMalus));
        const div = document.createElement('div');
        div.className = 'skill-item';
        div.innerHTML = `<span class="skill-link">${skill.link || ''}</span><span class="skill-name">${skill.name}</span><span class="skill-pct">${eff}%</span>`;
        div.addEventListener('click', () => doRoll(skill.name, skill.pct));
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
    if (!items.length) { body.innerHTML = `<div style="font-family:'EB Garamond',serif;font-size:13px;color:var(--parchment-dim);font-style:italic;opacity:.5;">Vide</div>`; return; }
    body.innerHTML = items.map(it => `<div class="inv-item"><span style="font-style:italic">${it.name || '—'}</span><span style="color:var(--gold-dim);font-family:'Cinzel',serif;font-size:12px;">×${it.qty || 1}</span></div>`).join('');
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
function rollDie(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    showDieCard(`d${sides}`, result);
    publishRoll({ skillName: `d${sides}`, threshold: null, roll: result, success: null, char: character.name, bonusMalus: 0, playerId });
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

function rollWeaponDamage(name, formula) {
    if (!formula || !formula.trim()) return;
    const result = rollDiceFormula(formula);
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
}
function applySoigner(success) {
    // Small delay so the float card resolves first
    setTimeout(() => {
        const max = getMaxHP();
        const before = currentHP;
        if (success) {
            const heal = Math.floor(Math.random() * 6) + 1;
            const after = Math.min(max, before + heal);
            animateHPChange(before, after, max);
            currentHP = after;
            localStorage.setItem('aria-current-hp', currentHP);
            updateHPDisplay();
            showHealNumber(heal);
            showToast('gm-heal-toast', `♥ Soins : +${heal} PV`);
        } else {
            const dmg = Math.floor(Math.random() * 3) + 1;
            const after = Math.max(0, before - dmg);
            animateHPChange(before, after, max);
            currentHP = after;
            localStorage.setItem('aria-current-hp', currentHP);
            updateHPDisplay();
            triggerDamageVFX(dmg, true);
            showToast('gm-dmg-toast', `⚔ Blessure : -${dmg} PV`);
            if (after <= 0) showMort();
        }
        sendPresence();
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

        // When the 3D animation finishes, read the result and handle it
        dddiceSDK.on(ThreeDDiceRollEvent.RollFinished, (roll) => {
            clearTimeout(dddiceRollSafetyTimer);
            setTimeout(() => dddiceSDK?.clear(), 1500);
            if (!pendingDddiceRoll) return;
            const { skillName, threshold } = pendingDddiceRoll;
            pendingDddiceRoll = null;
            const total = roll.total_value ?? 0;
            handleResult(skillName, threshold, total === 0 ? 100 : total);
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
async function rollViaDddice(skillName, threshold) {
    if (!dddiceSDK) { handleResult(skillName, threshold, Math.floor(Math.random() * 100) + 1); return; }
    try {
        pendingDddiceRoll = { skillName, threshold };
        // Safety fallback: if RollFinished never fires (e.g. network drop after roll creation),
        // unblock the UI after 12s. Cleared by the RollFinished handler on success.
        dddiceRollSafetyTimer = setTimeout(() => {
            if (pendingDddiceRoll?.skillName === skillName) {
                pendingDddiceRoll = null;
                handleResult(skillName, threshold, Math.floor(Math.random() * 100) + 1);
            }
        }, 12000);
        await dddiceSDK.roll([{ type: 'd10x', theme: dddiceAPI.theme }, { type: 'd10', theme: dddiceAPI.theme }]);
        // Do NOT clear the timer here — roll() resolves on API response (~200ms),
        // well before the animation ends. RollFinished handles the clear.
    } catch (e) { console.error('dddice roll:', e); pendingDddiceRoll = null; handleResult(skillName, threshold, Math.floor(Math.random() * 100) + 1); }
}
function setDddiceStatus(ok, detail) {
    const d = ['dddice-dot', 'cfg-dddice-dot'], s = ['dddice-status', 'cfg-dddice-status'];
    d.forEach(id => { const el = document.getElementById(id); if (el) el.className = 'status-dot ' + (ok ? 'connected' : 'error'); });
    s.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ok ? `dddice: ${detail || 'connecté'}` : `Erreur: ${detail || 'dddice'}`; });
}

// ═══════════════════════════════════════════
//  ABLY
// ═══════════════════════════════════════════
let ablyInstance = null;
function initAbly() {
    try {
        ablyInstance = new Ably.Realtime({ key: config.ablyKey });
        ablyRolls = ablyInstance.channels.get('aria-rolls');
        ablyCards = ablyInstance.channels.get('aria-cards');
        ablyDamage = ablyInstance.channels.get('aria-damage');
        ablyInstance.connection.on('connected', () => { setAblyStatus(true); sendPresence(); });
        ablyInstance.connection.on('failed', () => setAblyStatus(false));
        // Listen for GM damage/heal targeted at this player
        const myId = playerId;
        ablyDamage.subscribe(msg => {
            const d = msg.data;
            if (!d || d.source === 'player') return;
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
    const base = window.location.href.replace(/\/Player\/[^/]+$/, '/Overlay/aria-overlay.html');
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
    console.log('[ARIA] sendPresence →', playerId.slice(-6), character.name);
    ablyDamage.publish('presence', {
        playerId, name: character.name, charClass: character.class,
        hp: currentHP, maxHP: getMaxHP(), stats: character.stats,
        protection: character.protection,
        skills: character.skills,
        specials: character.specials,
        weapons: character.weapons,
        inventory: character.inventory,
        potions: character.potions,
    }, err => { if (err) console.error('[ARIA] publish error:', err); });
}
function setAblyStatus(ok) {
    ['ably-dot', 'cfg-ably-dot2'].forEach(id => { const el = document.getElementById(id); if (el) el.className = 'status-dot ' + (ok ? 'connected' : 'error'); });
    ['ably-status', 'cfg-ably-status2'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ok ? 'Ably connecté' : 'Ably erreur'; });
}

// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════
function loadConfigInputs() {
    const idEl = document.getElementById('cfg-identity-display');
    if (idEl) idEl.textContent = character.name || '—';
    document.getElementById('cfg-dddice-key').value = config.dddiceKey || '';
    document.getElementById('cfg-dddice-room').value = config.dddiceRoom || '';
    document.getElementById('cfg-dddice-theme').value = config.dddiceTheme || '';
    document.getElementById('cfg-ably-key').value = config.ablyKey || '';
}
function saveConfig() {
    config = {
        dddiceKey: document.getElementById('cfg-dddice-key').value.trim(),
        dddiceRoom: document.getElementById('cfg-dddice-room').value.trim(),
        dddiceTheme: document.getElementById('cfg-dddice-theme').value || '',
        ablyKey: document.getElementById('cfg-ably-key').value.trim(),
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
        row.innerHTML = `<input class="editor-input" value="${it.name || ''}" placeholder="Nom de l'objet" oninput="character.inventory[${i}].name=this.value;renderInventorySidebar()" /><input class="editor-input inv-qty" type="number" min="1" value="${it.qty || 1}" oninput="character.inventory[${i}].qty=+this.value;renderInventorySidebar()" /><button class="del-btn" onclick="removeInventoryRow(${i})">✕</button>`;
        list.appendChild(row);
    });
}
function addInventoryRow() { character.inventory.push({ name: '', qty: 1 }); renderInventoryEditor(); renderInventorySidebar(); }
function removeInventoryRow(i) { character.inventory.splice(i, 1); renderInventoryEditor(); renderInventorySidebar(); }

// ── POTIONS ──────────────────────────────────
function renderPotions() {
    const list = document.getElementById('potion-list');
    const empty = document.getElementById('alchemy-empty');
    if (!list) return;
    const potions = character.potions || [];
    list.innerHTML = '';
    if (empty) empty.style.display = potions.length ? 'none' : '';
    potions.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'potion-row';
        row.innerHTML = `
            <input class="editor-input potion-name-input" value="${p.name || ''}" placeholder="Nom de la potion"
                oninput="character.potions[${i}].name=this.value" />
            <input class="editor-input potion-desc-input" value="${p.desc || ''}" placeholder="Effet…"
                oninput="character.potions[${i}].desc=this.value" />
            <input class="editor-input potion-ing-input" value="${p.ingredients || ''}" placeholder="Ingrédients…"
                oninput="character.potions[${i}].ingredients=this.value" />
            <input class="editor-input potion-qty-input" type="text" inputmode="numeric" value="${p.qty ?? 1}"
                oninput="this.value=this.value.replace(/[^0-9]/g,'');character.potions[${i}].qty=+this.value||0;renderPotions()" />
            <button class="potion-use-btn" onclick="usePotion(${i})" ${!p.qty ? 'disabled' : ''} title="Utiliser une dose">Utiliser</button>
            <button class="del-btn" onclick="removePotion(${i})">✕</button>`;
        list.appendChild(row);
    });
}
function addPotion() {
    character.potions.push({ name: '', desc: '', ingredients: '', qty: 1 });
    localStorage.setItem('aria-character', JSON.stringify(character));
    renderPotions();
}
function removePotion(i) {
    character.potions.splice(i, 1);
    localStorage.setItem('aria-character', JSON.stringify(character));
    renderPotions();
}
function usePotion(i) {
    const p = character.potions[i];
    if (!p || !p.qty) return;
    p.qty--;
    localStorage.setItem('aria-character', JSON.stringify(character));
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
        row.innerHTML = `<span class="sname">${sk.name}</span><input class="spct" type="number" min="1" max="100" value="${sk.pct}" oninput="character.skills[${i}].pct=+this.value" />`;
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
        row.innerHTML = `<input value="${sp.name || ''}" placeholder="Nom" oninput="character.specials[${i}].name=this.value" /><input type="number" min="0" max="100" value="${sp.pct || 0}" oninput="character.specials[${i}].pct=+this.value" /><input value="${sp.desc || ''}" placeholder="Description" oninput="character.specials[${i}].desc=this.value" /><button class="del-btn" onclick="removeSpecial(${i})">✕</button>`;
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
    readEditorInputs();
    localStorage.setItem('aria-character', JSON.stringify(character));
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
function saveCardState() { localStorage.setItem('aria-cards', JSON.stringify({ excluded: [...cardExcluded], drawn: [...cardDrawn], deckIds: cardDeck.map(c => c.id), lastCardId })); }
function updateDeckCount() {
    const n = cardDeck.length;
    document.getElementById('deck-count').textContent = n === 0 ? 'Vide' : `${n} carte${n !== 1 ? 's' : ''}`;
    document.getElementById('deck-wrap').classList.toggle('empty', n === 0);
    document.getElementById('reshuffle-btn').classList.toggle('visible', n === 0);
    document.getElementById('reshuffle-remaining-btn').classList.toggle('visible', n > 1 && n < ALL_CARDS.length - cardExcluded.size);
    updateClearBtn();
}
function updateClearBtn() { document.getElementById('clear-exclusions-btn').classList.toggle('visible', cardExcluded.size > 0); }
function showCardStatus(msg) { const el = document.getElementById('card-status'); el.textContent = msg; clearTimeout(showCardStatus._t); showCardStatus._t = setTimeout(() => el.textContent = '', 2200); }
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
    else { cardDrawn.clear(); cardDeck = buildDeck(); lastCardId = null; }
    buildTracker(); updateDeckCount(); updateClearBtn(); saveCardState(); publishCard('reshuffle');
    const flash = document.getElementById('reshuffle-flash');
    document.getElementById('reshuffle-msg').textContent = remainingOnly ? '↺ Restant mélangé' : '↺ Mélangé';
    flash.classList.add('show'); await delay(900); flash.classList.remove('show');
    cardDrawing = false;
}
