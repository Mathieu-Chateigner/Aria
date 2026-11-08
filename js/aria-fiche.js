// ═══════════════════════════════════════════
//  FICHE — the character sheet (views/aria-fiche.html?camp=ID)
// ═══════════════════════════════════════════
// design_handoff_aria/Aria Fiche.dc.html: the account's character at that table,
// read and edited. "Éditer la fiche" works on a copy (draft); "Annuler" drops it,
// "Enregistrer" writes the character row the player panel loads.
//
// The sheet is the panels' character object (ENT.character). What the design adds
// lives inside `physical` (a jsonb column, so no migration): level, origine,
// personnalite, and the two pictures, portrait and backdrop (URLs in the public
// campaign-files bucket). "Équipement notable" is derived: equipped weapons (★ in
// the panel), the armour, the other weapons, then inventory items that carry a
// story ("Objet de quête"); each piece's story is a `story` field on that object.
//
// GM validation (campaigns.sheet_approval, toggled in the GM's Accueil options):
// "Envoyer au MJ" writes the edit to characters.pending_sheet instead, and the sheet
// shows that version under "En attente de validation MJ". The GM opens it from the
// Accueil (`&char=ID`, review mode: read-only, Refuser / Valider → decide_sheet()).
// The player panel's Personnage tab still edits the character directly — locking it
// belongs to the Table's redesign.

const $ = id => document.getElementById(id);
const F = { camp: null, c: null, saveKey: null, edit: false, draft: null, saving: false, failed: false,
            pending: null, review: null };   // review = the charId a GM is validating
const ATTRS = ['FOR', 'DEX', 'END', 'INT', 'CHA'];
const MULT = 3;
const PHYS = [['Âge', 'age'], ['Taille', 'taille'], ['Poids', 'poids'], ['Yeux', 'yeux'], ['Cheveux', 'cheveux'], ['Signes particuliers', 'signes']];
const num = v => String(v).replace(/[^0-9]/g, '').slice(0, 3);

const cur = () => F.edit ? F.draft : F.pending || F.c;
const clone = o => JSON.parse(JSON.stringify(o));
const approval = () => !F.review && F.camp.approval;
const phys = c => c.physical || (c.physical = {});
const armure = c => { const p = c.protection || {}; return (p.nom || '') + (p.valeur ? ' · ' + p.valeur : ''); };
const paras = s => String(s || '').split(/\n\s*\n/).filter(Boolean);

// Équipement notable — references into the character, so an edit writes through.
function gear(c) {
    const w = (c.weapons || []).filter(x => (x.nom || '').trim());
    const p = c.protection && (c.protection.nom || '').trim() ? [c.protection] : [];
    return [
        ...w.filter(x => x.favourite).map(o => ({ o, key: 'nom', tag: 'Équipé' + (o.degats ? ' · ' + o.degats : ''), cls: 'on' })),
        ...p.map(o => ({ o, key: 'nom', tag: 'Équipé · arm. ' + (o.valeur || 0), cls: 'on' })),
        ...w.filter(x => !x.favourite).map(o => ({ o, key: 'nom', tag: o.degats || '', cls: '' })),
        ...(c.inventory || []).filter(x => (x.story || '').trim()).map(o => ({ o, key: 'name', tag: 'Objet de quête', cls: 'quest' })),
    ];
}

// ── pictures ────────────────────────────────────────────────────────────────
const safeUrl = u => /^(https?:|blob:)/.test(u || '') ? u : '';
let _artKind = null;
function pickArt(kind) { _artKind = kind; $('fc-file').value = ''; $('fc-file').click(); }
async function setArt(kind, file) {
    if (F.review || !file || !/^image\//.test(file.type)) return;
    const c = F.edit ? F.draft : approval() ? clone(cur()) : F.c;
    const url = await hubData.uploadArt(c, kind, file);
    if (!url) return;
    phys(c)[kind] = url;
    // outside edit mode a picture is saved at once, as the prototype's slot does
    if (!F.edit && approval()) { if (await hubData.submitSheet(c)) F.pending = c; }
    else if (!F.edit) await hubData.saveCharacter(F.c, F.saveKey);
    render();
}
function artSlot(kind, ph) {
    const url = safeUrl(phys(cur())[kind]);
    const n = el('div', {
        className: 'fc-slot' + (F.review ? '' : ' edit') + (url ? ' filled' : ''), style: { backgroundImage: url ? 'url("' + url + '")' : '' },
        onclick: () => pickArt(kind),
        ondragover: e => { e.preventDefault(); n.classList.add('drag'); },
        ondragleave: () => n.classList.remove('drag'),
        ondrop: e => { e.preventDefault(); n.classList.remove('drag'); setArt(kind, e.dataTransfer.files[0]); },
    }, el('div', { className: 'fc-slot-ph', textContent: ph }));
    return n;
}

// ── inputs bound to the draft ───────────────────────────────────────────────
const input = (cls, value, onInput) => el('input', { className: cls, value: value ?? '', oninput: e => onInput(e.target.value, e.target) });
const area = (cls, value, rows, onInput, placeholder) => el('textarea', { className: cls, value: value ?? '', rows, placeholder, oninput: e => onInput(e.target.value) });
const reads = () => !F.edit;

// ── header ──────────────────────────────────────────────────────────────────
function renderBar() {
    $('fc-editbar').hidden = !F.edit;
    const busy = F.saving ? ' busy' : '';
    fill($('fc-bar-btns'),
        !F.edit && F.pending && el('div', { className: 'fc-pending', textContent: 'En attente de validation MJ' }),
        F.review
            ? F.pending && el('div', { className: 'fc-bar-btns' },
                el('div', { className: 'fc-btn cancel' + busy, textContent: 'Refuser', onclick: () => decide(false) }),
                el('div', { className: 'fc-btn save' + busy, textContent: F.failed ? 'Réessayer' : 'Valider', onclick: () => decide(true) }))
        : F.edit
            ? el('div', { className: 'fc-bar-btns' },
                el('div', { className: 'fc-btn cancel', textContent: 'Annuler', onclick: () => { F.edit = false; F.draft = null; render(); } }),
                el('div', { className: 'fc-btn save' + busy, textContent: F.failed ? 'Réessayer' : approval() ? 'Envoyer au MJ' : 'Enregistrer', onclick: save }))
            : el('div', { className: 'fc-btn edit', textContent: 'Éditer la fiche', onclick: () => {
                F.draft = clone(cur()); F.edit = true; F.failed = false; render();
            } }));
}

async function save() {
    if (F.saving) return;
    F.saving = true; renderBar();
    const ok = approval() ? await hubData.submitSheet(F.draft) : await hubData.saveCharacter(F.draft, F.saveKey);
    F.saving = false;
    if (ok) {
        if (approval()) F.pending = F.draft; else F.c = F.draft;
        F.draft = null; F.edit = false; F.failed = false; render();
    } else { F.failed = true; renderBar(); }
}

// GM review: accept or refuse the waiting edit, then back to the Accueil.
async function decide(accept) {
    if (F.saving) return;
    F.saving = true; renderBar();
    const ok = await hubData.decideSheet(F.review, accept);
    F.saving = false;
    if (ok) location.assign($('fc-back').getAttribute('href'));
    else { F.failed = true; renderBar(); }
}

// ── the sheet ───────────────────────────────────────────────────────────────
function hero(c) {
    const p = phys(c), read = reads(), fond = safeUrl(p.backdrop);
    const ancient = c.ariaType !== 'contemporary';
    return el('div', { className: 'fc-hero' },
        el('div', { className: 'fc-fond' },
            read && fond && el('div', { className: 'fc-fond-img', style: { backgroundImage: 'url("' + fond + '")' } }),
            (!read || fond) && el('div', { className: 'fc-fond-ov' })),
        el('div', { className: 'fc-hero-in' },
            el('div', { className: 'fc-illu-col' },
                el('div', { className: 'fc-illu' },
                    artSlot('portrait', 'Illustration — glisser une image'),
                    el('div', { className: 'fc-illu-c tl' }), el('div', { className: 'fc-illu-c br' }))),
            el('div', { className: 'fc-id-col' },
                read
                    ? el('div', { className: 'fc-id' },
                        el('div', { className: 'fc-cls', textContent: [c.class, p.level && 'Niveau ' + p.level].filter(Boolean).join(' · ') }),
                        el('div', { className: 'fc-name', textContent: c.name || '' }),
                        el('div', { className: 'fc-origine', textContent: p.origine || '' }))
                    : el('div', { className: 'fc-id-edit' }, [['Nom', c, 'name'], ['Classe', c, 'class'], ['Niveau', p, 'level'], ['Origine', p, 'origine']]
                        .map(([label, o, k]) => el('label', { className: 'fc-field' },
                            el('span', { className: 'fc-field-l', textContent: label }),
                            input('fc-field-in', o[k], v => { o[k] = v; })))),
                !read && el('div', { className: 'fc-fondpick' },
                    el('div', { className: 'fc-fondpick-box' }, artSlot('backdrop', 'Glisser une image')),
                    el('div', { className: 'fc-fondpick-txt' },
                        el('div', { className: 'fc-fondpick-k', textContent: 'Image de fond' }),
                        el('div', { className: 'fc-fondpick-d', textContent: 'Paysage, terre natale, blason. Affichée derrière le haut de la fiche.' }))),
                el('div', { className: 'fc-attrs' },
                    ancient && ATTRS.map(k => {
                        const x3 = el('div', { className: 'fc-attr-x', textContent: (+c.stats[k] || 0) * MULT + ' %' });
                        return el('div', { className: 'fc-attr' },
                            el('div', { className: 'fc-attr-k', textContent: k }),
                            read ? el('div', { className: 'fc-attr-v', textContent: String(c.stats[k] ?? '') })
                                 : input('fc-attr-in', c.stats[k], (v, n) => { n.value = num(v); c.stats[k] = +n.value || 0; x3.textContent = c.stats[k] * MULT + ' %'; }),
                            x3);
                    }),
                    el('div', { className: 'fc-vital' },
                        el('div', { className: 'fc-vital-k', textContent: 'Points de vie' }),
                        read ? el('div', { className: 'fc-vital-v', textContent: String(c.stats.PV || 14) })   // the panel's getMaxHP() default
                             : input('fc-vital-in', c.stats.PV, (v, n) => { n.value = num(v); c.stats.PV = +n.value || 0; })),
                    el('div', { className: 'fc-vital' },
                        el('div', { className: 'fc-vital-k', textContent: 'Armure' }),
                        read ? el('div', { className: 'fc-vital-v', textContent: armure(c) })
                             : input('fc-vital-in', armure(c), v => {
                                 const m = v.match(/^(.*?)\s*·\s*(\d+)\s*$/);
                                 c.protection = { ...c.protection, nom: (m ? m[1] : v).trim(), ...(m ? { valeur: +m[2] } : {}) };
                             }))))));
}

function enJeu(c) {
    const read = reads();
    let skills = c.skills || [];
    if (read) skills = skills.slice().sort((a, b) => (+b.pct || 0) - (+a.pct || 0));
    const pctIn = o => input('fc-in-pct', o.pct, (v, n) => { n.value = num(v).slice(0, 2); o.pct = +n.value || 0; });
    return el('div', { className: 'fc-sec' },
        el('div', { className: 'fc-sec-head' },
            el('div', { className: 'fc-sec-t', textContent: 'En jeu' }),
            el('div', { className: 'fc-sec-s', textContent: 'Ce que vous lancez à la table' })),
        el('div', { className: 'fc-grid' },
            el('div', { className: 'fc-col' },
                el('div', { className: 'fc-k-row' },
                    el('div', { className: 'fc-k', textContent: 'Compétences · ' + skills.length }),
                    read ? el('div', { className: 'fc-k-note', textContent: 'Triées par score' })
                         : el('div', { className: 'fc-add', textContent: '+ Ajouter', onclick: () => {
                             c.skills = [...(c.skills || []), { name: 'Nouvelle compétence', link: c.ariaType === 'contemporary' ? '' : 'INT', pct: 30 }];
                             render();
                         } })),
                el('div', { className: 'fc-skills' }, skills.map(s => el('div', { className: 'fc-skill' },
                    el('div', { className: 'fc-skill-l' },
                        read ? el('div', { className: 'fc-skill-n', textContent: s.name }) : input('fc-in', s.name, v => { s.name = v; }),
                        el('div', { className: 'fc-bar-track' }, el('div', { className: 'fc-bar-fill-in', style: { width: Math.min(100, +s.pct || 0) + '%' } }))),
                    s.link ? el('div', { className: 'fc-link', textContent: s.link }) : el('div'),
                    read ? el('div', { className: 'fc-pct', textContent: String(s.pct ?? '') }) : pctIn(s))))),
            el('div', { className: 'fc-col wide' },
                el('div', { className: 'fc-col' },
                    el('div', { className: 'fc-k-row' },
                        el('div', { className: 'fc-k', textContent: 'Compétences spéciales · ' + (c.specials || []).length }),
                        !read && el('div', { className: 'fc-add', textContent: '+ Ajouter', onclick: () => {
                            c.specials = [...(c.specials || []), { name: 'Nouvelle compétence spéciale', pct: 30, desc: '' }];
                            render();
                        } })),
                    (c.specials || []).map((s, i) => el('div', { className: 'fc-special' },
                        read ? el('div', { className: 'fc-special-n', textContent: s.name }) : input('fc-in', s.name, v => { s.name = v; }),
                        read ? el('div', { className: 'fc-special-p', textContent: String(s.pct ?? '') }) : pctIn(s),
                        read ? el('div', { className: 'fc-special-d', textContent: s.desc || '' })
                             : area('fc-special-ta', s.desc, 2, v => { s.desc = v; }, 'Effet de la compétence'),
                        !read && el('div', { className: 'fc-remove', textContent: 'Retirer', onclick: () => { c.specials.splice(i, 1); render(); } })))),
                el('div', { className: 'fc-gear-col' },
                    el('div', { className: 'fc-k-row fc-gear-head' },
                        el('div', { className: 'fc-k', textContent: 'Équipement notable' }),
                        el('div', { className: 'fc-k-note', textContent: 'Sac complet (' + (c.inventory || []).length + ') à la table' })),
                    gear(c).map(g => el('div', { className: 'fc-gear' },
                        read ? el('div', { className: 'fc-gear-n', textContent: g.o[g.key] }) : input('fc-in', g.o[g.key], v => { g.o[g.key] = v; }),
                        el('div', { className: 'fc-gear-tag ' + g.cls, textContent: g.tag }),
                        read ? el('div', { className: 'fc-gear-s', textContent: g.o.story || '' })
                             : input('fc-in story', g.o.story, v => { g.o.story = v; })))))));
}

function recit(c) {
    const p = phys(c), read = reads();
    return el('div', { className: 'fc-sec' },
        el('div', { className: 'fc-sec-head' },
            el('div', { className: 'fc-sec-t', textContent: 'Récit' }),
            el('div', { className: 'fc-sec-s', textContent: 'Qui est votre personnage' })),
        el('div', { className: 'fc-grid story' },
            el('div', { className: 'fc-story' },
                el('div', { className: 'fc-k', textContent: 'Histoire' }),
                read ? el('div', { className: 'fc-paras' }, paras(p.histoire).map(t => el('div', { className: 'fc-para', textContent: t })))
                     : area('fc-ta hist', p.histoire, 14, v => { p.histoire = v; })),
            el('div', { className: 'fc-col wide' },
                el('div', { className: 'fc-perso-col' },
                    el('div', { className: 'fc-k', textContent: 'Personnalité' }),
                    read ? el('div', { className: 'fc-perso', textContent: p.personnalite || '' })
                         : area('fc-ta perso', p.personnalite, 5, v => { p.personnalite = v; })),
                el('div', { className: 'fc-phys-col' },
                    el('div', { className: 'fc-k', textContent: 'Aspect physique' }),
                    PHYS.map(([label, k]) => el('div', { className: 'fc-phys' },
                        el('div', { className: 'fc-phys-l', textContent: label }),
                        read ? el('div', { className: 'fc-phys-v', textContent: p[k] || '' }) : input('fc-in', p[k], v => { p[k] = v; })))))));
}

function render() {
    const c = cur();
    c.stats = c.stats || {};
    renderBar();
    fill($('fc-sheet'), hero(c), el('div', { className: 'fc-main' }, enJeu(c), recit(c)));
}

// ── boot ────────────────────────────────────────────────────────────────────
(async () => {
    if (!hubData.demo && !sbSignedIn()) { location.replace('../index.html'); return; }
    const params = new URLSearchParams(location.search);
    F.review = params.get('char');
    params.delete('char');
    const back = 'aria-accueil.html?' + params;
    F.camp = params.get('camp') && await hubData.camp(params.get('camp'));
    const got = F.camp && (F.review ? F.camp.role === 'MJ' && await hubData.sheetForGM(F.review) : await hubData.character(F.camp));
    if (!got) { location.replace(F.camp ? back : 'aria-hub.html'); return; }
    F.c = got.ch; F.saveKey = got.saveKey; F.pending = got.pending;
    if (F.review) $('fc-bar-label').textContent = 'Fiche de ' + (F.c.name || '—');

    document.title = 'ARIA — ' + (F.c.name || 'Ma fiche');
    $('fc-back').href = back;
    $('fc-back').textContent = '← ' + F.camp.name;
    $('fc-file').onchange = e => setArt(_artKind, e.target.files[0]);
    ariaBg.mount('study', $('fc-root'));
    render();
})();
