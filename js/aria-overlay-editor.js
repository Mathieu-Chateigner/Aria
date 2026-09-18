// ═══════════════════════════════════════════
//  ARIA OVERLAY EDITOR
// ═══════════════════════════════════════════
const params     = new URLSearchParams(window.location.search);
const OWNER_TYPE = params.get('type') || 'player';
const OWNER_ID   = params.get('id')   || '';
const OVERLAY_ID = OWNER_TYPE + '_' + OWNER_ID;

const ariaConfig = JSON.parse(localStorage.getItem('aria-config') || '{}');
const ABLY_KEY   = ariaConfig.ablyKey || '';

// Same-origin lookup for the join code, so the preview iframe and test-event
// publishers land on the campaign-scoped channels the real overlay listens to
// (see "Per-campaign channel scoping" in CLAUDE.md) instead of the global ones.
function getCampaignCode() {
    try {
        if (OWNER_TYPE === 'gm') {
            const camps = JSON.parse(localStorage.getItem('aria-gm-campaigns') || '[]');
            return (camps.find(c => c.id === OWNER_ID)?.joinCode || '').toUpperCase();
        }
        const chars = JSON.parse(localStorage.getItem('aria-characters') || '[]');
        return (chars.find(c => c.id === OWNER_ID)?.campaignKey || '').toUpperCase();
    } catch (_) { return ''; }
}
const CAMPAIGN = getCampaignCode();
function campaignChannel(base) { return CAMPAIGN ? `${base}-${CAMPAIGN}` : base; }

let widgets       = [];
let selectedId    = null;
let gridSnap      = false;
let ablyClient    = null;
let ablyChannel   = null;
let autoSaveTimer = null;

// Widget types whose render picks a single player from presence — 'character_name'
// used to always show the first one connected. This is the list that gets a "Joueur
// lié" picker in the props panel instead.
const LINKABLE_TYPES = ['character_name', 'hp_bar', 'stats', 'protection', 'skills', 'weapons', 'inventory', 'potions'];

const WIDGET_DEFS = {
    persistent: [
        { type: 'character_name',    label: 'Nom / Classe',        defaultW: 30, defaultH: 8  },
        { type: 'hp_bar',            label: 'Barre de PV',          defaultW: 30, defaultH: 10 },
        { type: 'stats',             label: 'Statistiques',          defaultW: 30, defaultH: 18 },
        { type: 'protection',        label: 'Protection',            defaultW: 25, defaultH: 7  },
        { type: 'skills',            label: 'Compétences',           defaultW: 28, defaultH: 25 },
        { type: 'weapons',           label: 'Armes',                 defaultW: 28, defaultH: 15 },
        { type: 'inventory',         label: 'Inventaire',            defaultW: 28, defaultH: 20 },
        { type: 'potions',           label: 'Potions',               defaultW: 25, defaultH: 15 },
        { type: 'custom_text',       label: 'Texte libre',           defaultW: 30, defaultH: 10 },
        { type: 'map',               label: 'Carte',                 defaultW: 40, defaultH: 45 },
        { type: 'campaign_name',     label: 'Nom campagne',          defaultW: 30, defaultH: 8,  gmOnly: true },
        { type: 'player_hp_summary', label: 'PV joueurs (résumé)',   defaultW: 30, defaultH: 30, gmOnly: true },
        { type: 'player_stats',      label: 'Stats joueurs',         defaultW: 35, defaultH: 35, gmOnly: true },
        { type: 'player_inventory',  label: 'Inventaires joueurs',   defaultW: 30, defaultH: 30, gmOnly: true },
        { type: 'player_skills',     label: 'Compétences joueurs',   defaultW: 30, defaultH: 30, gmOnly: true },
        { type: 'monster_list',      label: 'Monstres',              defaultW: 30, defaultH: 30, gmOnly: true },
        { type: 'roll_history',      label: 'Historique jets',       defaultW: 35, defaultH: 25, gmOnly: true },
        { type: 'camera',            label: 'Caméra joueur',         defaultW: 25, defaultH: 20, gmOnly: true },
    ],
    event: [
        { type: 'roll_card',         label: 'Carte de jet',         defaultW: 35, defaultH: 40 },
        { type: 'card_draw',         label: 'Carte tirée',          defaultW: 15, defaultH: 25 },
        { type: 'damage_number',     label: 'Nombre de dégâts',     defaultW: 15, defaultH: 12 },
        { type: 'heal_number',       label: 'Nombre de soin',       defaultW: 15, defaultH: 12 },
        { type: 'hp_bar_animation',  label: 'Barre PV (animation)', defaultW: 35, defaultH: 12 },
        { type: 'mort_screen',       label: 'Écran MORT',           defaultW: 100, defaultH: 100 },
    ],
};

const WIDGET_LABELS = Object.fromEntries(
    [...WIDGET_DEFS.persistent, ...WIDGET_DEFS.event].map(d => [d.type, d.label])
);

// Load overlay config from Supabase, connect Ably, and initialize the editor canvas.
async function init() {
    if (!OWNER_ID) {
        document.getElementById('editor-owner-label').textContent = 'Aucun personnage/campagne sélectionné';
        return;
    }

    const rows = await sbSelect('overlay_configs', 'id=eq.' + encodeURIComponent(OVERLAY_ID));
    if (rows.length && rows[0].config?.widgets) {
        widgets = rows[0].config.widgets;
    }

    document.getElementById('editor-owner-label').textContent =
        OWNER_TYPE === 'player' ? 'Joueur — ' + OWNER_ID : 'MJ — ' + OWNER_ID;

    if (ABLY_KEY) {
        ablyClient = new Ably.Realtime({ key: ABLY_KEY, transports: ['web_socket'] });
        ablyChannel = ablyClient.channels.get('aria-overlay-config');
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    renderPalette();
    renderCanvas();
    bindTopbarButtons();
    bindPropsPanel();
    initPreview();

    const canvas = document.getElementById('editor-canvas');
    canvas.addEventListener('mousedown', e => { if (e.target === canvas) selectWidget(null); });
    canvas.addEventListener('dragover', e => e.preventDefault());
    canvas.addEventListener('drop', e => {
        e.preventDefault();
        const type = e.dataTransfer.getData('widgetType');
        if (!type) return;
        const rect = canvas.getBoundingClientRect();
        addWidget(type, ((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100);
    });
}

// Resize the editor canvas AND the live preview frame to the same pixel size —
// widget positions are percentages, so the two only look comparable ("what the
// overlay shows") when both boxes are literally the same size, not just both 16:9.
function resizeCanvas() {
    const wrap        = document.getElementById('editor-canvas-wrap');
    const previewWrap  = document.getElementById('editor-preview');
    const canvas       = document.getElementById('editor-canvas');
    const previewFrame = document.getElementById('preview-frame-wrap');
    const availW = Math.min(wrap.clientWidth - 32, previewWrap.clientWidth - 28);
    const availH = wrap.clientHeight - 32;
    const w = Math.min(availW, availH * 16 / 9);
    const h = w * 9 / 16;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    previewFrame.style.width  = w + 'px';
    previewFrame.style.height = h + 'px';
}

// Bind click handlers for the Save and Grid Snap topbar buttons.
function bindTopbarButtons() {
    document.getElementById('btn-save').addEventListener('click', saveConfig);
    document.getElementById('btn-grid-snap').addEventListener('click', () => {
        gridSnap = !gridSnap;
        document.getElementById('btn-grid-snap').classList.toggle('active', gridSnap);
        document.getElementById('editor-canvas').classList.toggle('grid-on', gridSnap);
    });
}

// Populate the widget palette sidebar from WIDGET_DEFS.
function renderPalette() {
    const persistentEl = document.getElementById('palette-persistent');
    const eventEl      = document.getElementById('palette-event');
    persistentEl.innerHTML = '';
    eventEl.innerHTML = '';

    for (const def of WIDGET_DEFS.persistent) {
        if (def.gmOnly && OWNER_TYPE !== 'gm') continue;
        const el = document.createElement('div');
        el.className = 'palette-item';
        el.textContent = def.label;
        el.draggable = true;
        el.addEventListener('dragstart', e => e.dataTransfer.setData('widgetType', def.type));
        el.addEventListener('click', () => addWidget(def.type, 10, 10));
        persistentEl.appendChild(el);
    }

    for (const def of WIDGET_DEFS.event) {
        const el = document.createElement('div');
        el.className = 'palette-item event-item';
        el.textContent = def.label;
        el.draggable = true;
        el.addEventListener('dragstart', e => e.dataTransfer.setData('widgetType', def.type));
        el.addEventListener('click', () => addWidget(def.type, 30, 30));
        eventEl.appendChild(el);
    }
}

// Create and add a new widget of the given type at (x, y) on the canvas.
function addWidget(type, x, y) {
    const allDefs = [...WIDGET_DEFS.persistent, ...WIDGET_DEFS.event];
    const def = allDefs.find(d => d.type === type);
    if (!def) return;
    const widget = {
        id: crypto.randomUUID(),
        type,
        category: WIDGET_DEFS.event.some(d => d.type === type) ? 'event' : 'persistent',
        x: snapVal(x), y: snapVal(y), w: def.defaultW, h: def.defaultH,
        visible: true,
        config: { opacity: 1, fontSize: 14 },
    };
    if (type === 'custom_text' || type === 'campaign_name') widget.config.content = '';
    if (['skills','inventory','potions','roll_history','player_hp_summary','player_stats',
         'player_inventory','player_skills','monster_list'].includes(type)) widget.config.maxItems = 8;
    if (type === 'camera') widget.config.streamId = '';
    widgets.push(widget);
    renderCanvas();
    selectWidget(widget.id);
    scheduleAutoSave();
}

// Snap a percentage value to the nearest grid step when grid snap is enabled.
function snapVal(v) {
    return gridSnap ? Math.round(v / 5) * 5 : Math.round(v * 10) / 10;
}

// Rebuild all widget DOM elements on the editor canvas from the widgets array.
function renderCanvas() {
    const canvas = document.getElementById('editor-canvas');
    [...canvas.children].forEach(c => c.remove());

    for (const widget of widgets) {
        const el = document.createElement('div');
        el.className = 'editor-widget' + (widget.category === 'event' ? ' event-widget' : '');
        if (widget.id === selectedId) el.classList.add('selected');
        el.dataset.id = widget.id;
        el.style.left = widget.x + '%'; el.style.top = widget.y + '%';
        el.style.width = widget.w + '%'; el.style.height = widget.h + '%';
        el.style.opacity = widget.config?.opacity ?? 1;

        const label = document.createElement('div');
        label.className = 'widget-label';
        label.textContent = WIDGET_LABELS[widget.type] || widget.type;
        el.appendChild(label);

        for (const dir of ['nw','n','ne','e','se','s','sw','w']) {
            const h = document.createElement('div');
            h.className = 'resize-handle ' + dir;
            h.addEventListener('mousedown', e => { e.stopPropagation(); startResize(e, widget.id, dir); });
            el.appendChild(h);
        }

        el.addEventListener('mousedown', e => {
            if (e.target.classList.contains('resize-handle')) return;
            selectWidget(widget.id);
            startDrag(e, widget.id);
        });
        canvas.appendChild(el);
    }
}

// Begin dragging a widget, tracking mouse movement relative to the canvas.
function startDrag(e, widgetId) {
    const canvas = document.getElementById('editor-canvas');
    const rect = canvas.getBoundingClientRect();
    const widget = widgets.find(w => w.id === widgetId);
    const startX = e.clientX, startY = e.clientY, origX = widget.x, origY = widget.y;

    function onMove(e) {
        widget.x = snapVal(Math.max(0, Math.min(100 - widget.w, origX + ((e.clientX - startX) / rect.width) * 100)));
        widget.y = snapVal(Math.max(0, Math.min(100 - widget.h, origY + ((e.clientY - startY) / rect.height) * 100)));
        const el = document.querySelector(`.editor-widget[data-id="${widgetId}"]`);
        if (el) { el.style.left = widget.x + '%'; el.style.top = widget.y + '%'; }
        syncPropsPanel();
    }
    function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); scheduleAutoSave(); }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
}

// Begin resizing a widget using a named handle direction (n/s/e/w corners).
function startResize(e, widgetId, handle) {
    const canvas = document.getElementById('editor-canvas');
    const rect = canvas.getBoundingClientRect();
    const widget = widgets.find(w => w.id === widgetId);
    const startX = e.clientX, startY = e.clientY;
    const { x: sx, y: sy, w: sw, h: sh } = widget;
    const MIN = 5;

    function onMove(e) {
        const dx = ((e.clientX - startX) / rect.width) * 100;
        const dy = ((e.clientY - startY) / rect.height) * 100;
        if (handle.includes('e')) widget.w = snapVal(Math.max(MIN, sw + dx));
        if (handle.includes('s')) widget.h = snapVal(Math.max(MIN, sh + dy));
        if (handle.includes('w')) { const nw = Math.max(MIN, sw - dx); widget.x = snapVal(sx + sw - nw); widget.w = snapVal(nw); }
        if (handle.includes('n')) { const nh = Math.max(MIN, sh - dy); widget.y = snapVal(sy + sh - nh); widget.h = snapVal(nh); }
        const el = document.querySelector(`.editor-widget[data-id="${widgetId}"]`);
        if (el) { el.style.left = widget.x + '%'; el.style.top = widget.y + '%'; el.style.width = widget.w + '%'; el.style.height = widget.h + '%'; }
        syncPropsPanel();
    }
    function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); scheduleAutoSave(); }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
}

// Set the selected widget by ID and sync the properties panel.
function selectWidget(id) {
    selectedId = id;
    document.querySelectorAll('.editor-widget').forEach(el => el.classList.toggle('selected', el.dataset.id === id));
    syncPropsPanel();
}

// Reflect the selected widget's current properties into the right panel inputs.
function syncPropsPanel() {
    const panel = document.getElementById('props-panel');
    const empty = document.getElementById('props-empty');
    const widget = widgets.find(w => w.id === selectedId);
    if (!widget) { panel.style.display = 'none'; empty.style.display = ''; return; }
    panel.style.display = ''; empty.style.display = 'none';
    document.getElementById('props-type-label').textContent = WIDGET_LABELS[widget.type] || widget.type;
    document.getElementById('prop-x').value         = Math.round(widget.x * 10) / 10;
    document.getElementById('prop-y').value         = Math.round(widget.y * 10) / 10;
    document.getElementById('prop-w').value         = Math.round(widget.w * 10) / 10;
    document.getElementById('prop-h').value         = Math.round(widget.h * 10) / 10;
    document.getElementById('prop-opacity').value   = widget.config?.opacity ?? 1;
    document.getElementById('prop-font-size').value = widget.config?.fontSize ?? 14;
    const hasContent  = ['custom_text','campaign_name'].includes(widget.type);
    const hasMaxItems = ['skills','inventory','potions','roll_history','player_hp_summary',
                         'player_stats','player_inventory','player_skills','monster_list'].includes(widget.type);
    document.getElementById('prop-content-wrap').style.display  = hasContent  ? '' : 'none';
    document.getElementById('prop-maxitems-wrap').style.display = hasMaxItems ? '' : 'none';
    if (hasContent)  document.getElementById('prop-content').value  = widget.config?.content  || '';
    if (hasMaxItems) document.getElementById('prop-maxitems').value = widget.config?.maxItems || 8;
    const hasStreamId = widget.type === 'camera';
    document.getElementById('prop-stream-id-wrap').style.display = hasStreamId ? '' : 'none';
    if (hasStreamId) {
        document.getElementById('prop-stream-id').value = widget.config?.streamId || '';
        refreshStreamPicker();
    }
    const hasCharId = LINKABLE_TYPES.includes(widget.type);
    document.getElementById('prop-charid-wrap').style.display = hasCharId ? '' : 'none';
    if (hasCharId) refreshCharIdPicker(widget.config?.charId || '');
}

// Same source as availableStreams(), but the charId rather than the derived
// stream id — the "Joueur lié" picker locks a widget to one player instead of
// falling back to whichever presence entry arrives first.
function availablePlayers() {
    const out = [];
    if (OWNER_TYPE === 'gm' && OWNER_ID) {
        let known = {};
        try { known = JSON.parse(localStorage.getItem('aria-gm-known-players-' + OWNER_ID) || '{}'); } catch (_) {}
        Object.values(known).forEach(p => {
            if (!p?.charId) return;
            out.push({ charId: p.charId, label: p.name || p.charId });
        });
    } else if (OWNER_ID) {
        let chars = [];
        try { chars = JSON.parse(localStorage.getItem('aria-characters') || '[]'); } catch (_) {}
        const me = chars.find(c => c.id === OWNER_ID);
        out.push({ charId: OWNER_ID, label: (me?.name || 'Vous') + ' (vous)' });
    }
    return out;
}

function refreshCharIdPicker(current) {
    const pick = document.getElementById('prop-charid-pick');
    if (!pick) return;
    pick.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— auto (1er joueur connu) —';
    pick.appendChild(none);
    availablePlayers().forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.charId;
        opt.textContent = p.label;   // textContent: names come from presence payloads
        pick.appendChild(opt);
    });
    pick.value = [...pick.options].some(o => o.value === current) ? current : '';
}

// Stream IDs are derived from UUIDs (player: 'aria_' + charId[0..8], GM:
// 'aria_gm_' + campaignId[0..8]) and displayed nowhere in the player/GM panels, so
// the camera widget's ID field was unfillable without the devtools. Rebuild the
// list from the same localStorage the panels write, on the same origin.
function availableStreams() {
    const out = [];
    if (OWNER_TYPE === 'gm' && OWNER_ID) {
        out.push({ sid: 'aria_gm_' + OWNER_ID.slice(0, 8), label: 'MJ (vous)' });
        let known = {};
        try { known = JSON.parse(localStorage.getItem('aria-gm-known-players-' + OWNER_ID) || '{}'); } catch (_) {}
        Object.values(known).forEach(p => {
            if (!p?.charId) return;
            out.push({ sid: 'aria_' + String(p.charId).slice(0, 8), label: p.name || p.charId });
        });
    } else if (OWNER_ID) {
        let chars = [];
        try { chars = JSON.parse(localStorage.getItem('aria-characters') || '[]'); } catch (_) {}
        const me = chars.find(c => c.id === OWNER_ID);
        out.push({ sid: 'aria_' + OWNER_ID.slice(0, 8), label: (me?.name || 'Vous') + ' (vous)' });
    }
    return out;
}

// Fill the picker with the detected streams and mirror the current value into it.
function refreshStreamPicker() {
    const pick  = document.getElementById('prop-stream-pick');
    const input = document.getElementById('prop-stream-id');
    const hint  = document.getElementById('prop-stream-hint');
    if (!pick || !input) return;
    const streams = availableStreams();
    pick.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— choisir —';
    pick.appendChild(none);
    streams.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.sid;
        opt.textContent = s.label;   // textContent: names come from presence payloads
        pick.appendChild(opt);
    });
    pick.value = streams.some(s => s.sid === input.value) ? input.value : '';
    if (hint) {
        hint.textContent = streams.length > 1
            ? 'Joueurs vus au moins une fois dans cette campagne.'
            : 'Aucun joueur détecté — ouvre le panneau MJ avec les joueurs connectés, puis rouvre cet éditeur.';
    }
}

// Bind change and input events on all properties panel fields.
function bindPropsPanel() {
    function applyNum(fieldId, apply) {
        document.getElementById(fieldId).addEventListener('change', () => {
            const widget = widgets.find(w => w.id === selectedId);
            if (!widget) return;
            apply(widget, parseFloat(document.getElementById(fieldId).value) || 0);
            renderCanvas(); scheduleAutoSave();
        });
    }
    applyNum('prop-x',         (w, v) => { w.x = Math.max(0, Math.min(95, v)); });
    applyNum('prop-y',         (w, v) => { w.y = Math.max(0, Math.min(95, v)); });
    applyNum('prop-w',         (w, v) => { w.w = Math.max(5, v); });
    applyNum('prop-h',         (w, v) => { w.h = Math.max(5, v); });
    applyNum('prop-opacity',   (w, v) => { w.config.opacity  = Math.max(0, Math.min(1, v)); });
    applyNum('prop-font-size', (w, v) => { w.config.fontSize = Math.max(8, v); });
    applyNum('prop-maxitems',  (w, v) => { w.config.maxItems = Math.max(1, v); });

    document.getElementById('prop-content').addEventListener('input', () => {
        const widget = widgets.find(w => w.id === selectedId);
        if (!widget) return;
        widget.config.content = document.getElementById('prop-content').value;
        scheduleAutoSave();
        if (ablyChannel) ablyChannel.publish('content-update', { overlayId: OVERLAY_ID, widgetId: widget.id, content: widget.config.content });
    });

    document.getElementById('prop-stream-id').addEventListener('input', () => {
        const widget = widgets.find(w => w.id === selectedId);
        if (!widget) return;
        widget.config.streamId = document.getElementById('prop-stream-id').value.trim();
        const pick = document.getElementById('prop-stream-pick');
        if (pick) pick.value = [...pick.options].some(o => o.value === widget.config.streamId) ? widget.config.streamId : '';
        scheduleAutoSave();
    });

    document.getElementById('prop-stream-pick').addEventListener('change', () => {
        const widget = widgets.find(w => w.id === selectedId);
        if (!widget) return;
        const sid = document.getElementById('prop-stream-pick').value;
        if (!sid) return;   // '— choisir —' keeps whatever was typed manually
        widget.config.streamId = sid;
        document.getElementById('prop-stream-id').value = sid;
        scheduleAutoSave();
    });

    document.getElementById('prop-charid-pick').addEventListener('change', () => {
        const widget = widgets.find(w => w.id === selectedId);
        if (!widget) return;
        widget.config.charId = document.getElementById('prop-charid-pick').value;
        scheduleAutoSave();
    });

    document.getElementById('btn-delete-widget').addEventListener('click', () => {
        if (!selectedId) return;
        widgets = widgets.filter(w => w.id !== selectedId);
        selectedId = null; renderCanvas(); syncPropsPanel(); scheduleAutoSave();
    });
}

document.addEventListener('keydown', e => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    if (!selectedId) return;
    widgets = widgets.filter(w => w.id !== selectedId);
    selectedId = null; renderCanvas(); syncPropsPanel(); scheduleAutoSave();
});

// Debounce auto-save: saves 1.5s after the last widget change.
function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveConfig, 1500);
}

// Save the widget layout to Supabase and broadcast a layout-update via Ably.
async function saveConfig() {
    clearTimeout(autoSaveTimer);
    const config = { widgets };
    await sbUpsert('overlay_configs', { id: OVERLAY_ID, owner_type: OWNER_TYPE, owner_id: OWNER_ID, config, updated_at: new Date().toISOString() }, 'id');
    if (ablyChannel) ablyChannel.publish('layout-update', { overlayId: OVERLAY_ID, config });
    const btn = document.getElementById('btn-save');
    const orig = btn.textContent;
    btn.textContent = '✓ Sauvegardé';
    setTimeout(() => { btn.textContent = orig; }, 1200);
}

// ── PREVIEW ───────────────────────────────────
// Live "what the overlay shows" panel. Rather than re-implementing overlay
// rendering here, embed the real aria-overlay.html for this owner/campaign —
// it already listens to the same layout-update channel this editor publishes
// on, plus every game channel, so it stays live with zero extra sync code.
function buildPreviewUrl() {
    const p = new URLSearchParams({ mode: OWNER_TYPE, ably: ABLY_KEY, overlay: OVERLAY_ID });
    if (CAMPAIGN) p.set('campaign', CAMPAIGN);
    return '../views/aria-overlay.html?' + p.toString();
}

const TEST_EVENTS = [
    { label: 'Succès',          fn: () => testRoll(45, 60, true)  },
    { label: 'Échec',           fn: () => testRoll(75, 60, false) },
    { label: 'Critique succès', fn: () => testRoll(5, 60, true)   },
    { label: 'Critique échec',  fn: () => testRoll(95, 60, false) },
    { label: 'Dé simple',       fn: () => testRoll(4, null, null, 'd6') },
    { label: 'Carte tirée',     fn: () => testPublish('aria-cards', 'draw', { cardId: 'A-spades' }) },
    { label: 'Dégâts',          fn: () => testDamage(6) },
    { label: 'Soin',            fn: () => testHeal(6) },
    { label: 'Écran MORT',      fn: () => testDamage(999) },
];

function initPreview() {
    document.getElementById('preview-frame').src = buildPreviewUrl();
    const wrap = document.getElementById('preview-tests');
    wrap.innerHTML = '';
    TEST_EVENTS.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'test-btn';
        btn.type = 'button';
        btn.textContent = t.label;
        btn.addEventListener('click', t.fn);
        wrap.appendChild(btn);
    });
}

function testPlayer() {
    const players = availablePlayers();
    return players[0] || { charId: 'test-char', label: 'Joueur test' };
}

function testPublish(baseChannel, event, data) {
    if (!ablyClient) return;
    ablyClient.channels.get(campaignChannel(baseChannel)).publish(event, data);
}

function testRoll(roll, threshold, success, skillName) {
    const p = testPlayer();
    testPublish('aria-rolls', 'roll', {
        skillName: skillName || 'Compétence test', threshold, roll, success,
        char: p.label, bonusMalus: 0, playerId: 'preview',
    });
}

function testDamage(damage) {
    const p = testPlayer();
    const maxHP = 20;
    const hpBefore = Math.min(maxHP, damage + 8);
    const hpAfter = Math.max(0, hpBefore - damage);
    testPublish('aria-damage', 'damage', { targetId: p.charId, damage, hpBefore, hpAfter, maxHP, charName: p.label, source: 'gm' });
}

function testHeal(amount) {
    const p = testPlayer();
    const maxHP = 20;
    const hpBefore = Math.max(0, maxHP - amount - 4);
    const hpAfter = Math.min(maxHP, hpBefore + amount);
    testPublish('aria-damage', 'heal', { targetId: p.charId, amount, hpBefore, hpAfter, maxHP, charName: p.label, source: 'gm' });
}

document.addEventListener('DOMContentLoaded', init);
