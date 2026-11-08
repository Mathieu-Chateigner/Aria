// ═══════════════════════════════════════════
//  CONNEXION — index.html
// ═══════════════════════════════════════════
// Login / signup / forgotten password (design_handoff_aria/Aria Connexion.dc.html).
// The session itself is aria-supabase.js's business; this page is a form over it.
// Validation runs on submit only (`tried`), then live until the next mode change.
//
// A signed-in visitor never sees the form: the page forwards to the Hub. The reset
// link from the recovery mail lands here too (#…type=recovery) and opens 'reset';
// so does the Google / Discord return (#access_token=…), which goes straight in.

const HUB_URL = 'views/aria-hub.html';
const $ = id => document.getElementById(id);

const cx = { mode: 'login', show: false, remember: true, accept: false, tried: false, sent: false, busy: false, server: {}, oauthErr: '', oauthTried: false };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const METER_COL = ['var(--bad)', 'var(--bad)', 'var(--warn)', 'var(--ok)', 'var(--ok)'];
const METER_TXT = ['Trop faible', 'Fragile', 'Correct', 'Solide', 'Inébranlable'];

const val = id => $(id).value;

function errors() {
    const m = cx.mode, errs = {}, email = val('cx-email').trim(), pw = val('cx-pw');
    const emailErr = email ? 'Ce courriel ne semble pas valide.' : 'Indiquez votre courriel.';
    if (m === 'login') {
        if (!EMAIL_RE.test(email)) errs.email = emailErr;
        if (!pw) errs.pw = 'Indiquez votre mot de passe.';
    } else if (m === 'signup') {
        if (val('cx-name').trim().length < 2) errs.name = 'Au moins deux lettres.';
        if (!EMAIL_RE.test(email)) errs.email = emailErr;
        if (pw.length < 8) errs.pw = 'Au moins 8 caractères.';
        if (!cx.accept) errs.accept = true;
    } else if (m === 'reset') {
        if (pw.length < 8) errs.pw = 'Au moins 8 caractères.';
    } else if (!EMAIL_RE.test(email)) errs.email = emailErr;
    return { ...errs, ...cx.server };
}

function setMode(mode) {
    Object.assign(cx, { mode, tried: false, sent: false, server: {}, oauthErr: '', oauthTried: false });
    render();
}

function render() {
    const m = cx.mode, errs = errors(), tried = cx.tried;
    const forgot = m === 'forgot', sentNow = (forgot || m === 'signup') && cx.sent;
    const shown = { name: m === 'signup' && !sentNow, email: m !== 'reset' && !sentNow, pw: !sentNow && (m === 'login' || m === 'signup' || m === 'reset') };

    $('cx-tabs').hidden = forgot || m === 'reset';
    document.querySelectorAll('.cx-tab').forEach(t => t.classList.toggle('on', t.dataset.mode === m));

    $('cx-intro').hidden = !(forgot || m === 'reset');
    // ponytail: the reset copy is ours, not the handoff's — the prototype has no reset screen.
    $('cx-intro-title').textContent = forgot ? 'Sceau perdu' : 'Nouveau sceau';
    $('cx-intro-text').textContent = forgot
        ? 'Indiquez votre courriel : un corbeau vous portera un lien pour choisir un nouveau mot de passe.'
        : 'Choisissez votre nouveau mot de passe.';

    for (const [key, on] of Object.entries(shown)) {
        const box = document.querySelector(`[data-field="${key}"]`);
        box.hidden = !on;
        const bad = !!(tried && errs[key]);
        box.querySelector('.cx-input').classList.toggle('err', bad);
        const e = box.querySelector('.cx-err');
        e.hidden = !bad;
        e.textContent = bad ? errs[key] : '';
    }

    // password: label, placeholder, show/hide, strength meter
    const pwIn = $('cx-pw');
    $('cx-pw-label').textContent = m === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe';
    pwIn.type = cx.show ? 'text' : 'password';
    pwIn.placeholder = m === 'login' ? '••••••••' : '8 caractères minimum';
    pwIn.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    $('cx-show').textContent = cx.show ? 'Masquer' : 'Afficher';
    const metered = m === 'signup' || m === 'reset';
    $('cx-meter').hidden = !metered;
    if (metered) {
        const pw = pwIn.value;
        const score = pw ? [pw.length >= 8, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length : 0;
        document.querySelectorAll('.cx-meter-bar').forEach((b, i) => { b.style.background = i < score ? METER_COL[score] : ''; });
        const lbl = $('cx-meter-label');
        lbl.textContent = pw ? METER_TXT[score] : '';
        lbl.style.color = pw ? METER_COL[score] : '';
    }

    $('cx-accept-wrap').hidden = m !== 'signup' || sentNow;
    const acc = $('cx-accept');
    acc.classList.toggle('on', cx.accept);
    const accBad = !!((tried || cx.oauthTried) && errs.accept);  // OAuth only needs the box, not the fields
    acc.classList.toggle('err', accBad);
    acc.setAttribute('aria-checked', String(cx.accept));
    $('cx-accept-err').hidden = !accBad;

    $('cx-login-row').hidden = m !== 'login';
    $('cx-remember').classList.toggle('on', cx.remember);
    $('cx-remember').setAttribute('aria-checked', String(cx.remember));

    $('cx-sent').hidden = !sentNow;
    $('cx-sent').textContent = m === 'signup'
        ? 'Un corbeau porte à ' + val('cx-email').trim() + ' le lien qui grave votre nom. Ouvrez-le pour entrer ; pensez à regarder vos indésirables.'
        : 'Si un compte existe pour ' + val('cx-email').trim() + ', le corbeau est en route. Pensez à regarder vos indésirables.';

    const cta = sentNow ? 'Retour à la connexion'
              : { login: 'Franchir le seuil', signup: 'Graver mon nom', reset: 'Graver le sceau' }[m] || 'Envoyer un corbeau';
    $('cx-cta').textContent = cta + ' →';
    $('cx-cta').disabled = cx.busy;

    $('cx-oauth').hidden = (m !== 'login' && m !== 'signup') || sentNow;
    $('cx-oauth-note').hidden = m !== 'login';  // signup has its own checkbox
    $('cx-oauth-err').hidden = !cx.oauthErr;
    $('cx-oauth-err').textContent = cx.oauthErr;
    document.querySelectorAll('.cx-oauth-btn').forEach(b => { b.disabled = cx.busy; });

    const foot = m === 'login' ? ['Pas encore de compte ?', "S'inscrire", 'signup']
               : m === 'signup' ? ['Déjà inscrit ?', 'Se connecter', 'login']
               : ['Vous vous en souvenez ?', 'Se connecter', 'login'];
    $('cx-foot').hidden = m === 'reset';
    $('cx-foot-q').textContent = foot[0];
    $('cx-foot-a').textContent = foot[1];
    $('cx-foot-a').dataset.mode = foot[2];
}

// GoTrue speaks English; the field that is wrong gets a French line.
function serverError(res) {
    const c = res.code || '', msg = (res.error || '').toLowerCase();
    if (c === 'invalid_credentials' || msg.includes('invalid login')) return { pw: 'Courriel ou mot de passe incorrect.' };
    if (c === 'user_already_exists' || c === 'email_exists' || msg.includes('already registered')) return { email: 'Un compte existe déjà pour ce courriel.' };
    if (c === 'weak_password') return { pw: 'Mot de passe trop faible.' };
    if (c === 'email_not_confirmed') return { email: 'Ouvrez d’abord le lien reçu par courriel.' };
    if (c === 'over_email_send_rate_limit' || c === 'over_request_rate_limit') return { email: 'Trop de tentatives. Réessayez dans un moment.' };
    return { pw: 'Le seuil reste fermé. Réessayez.' };
}

function enter(kicker, title) {
    $('cx-enter-kicker').textContent = kicker;
    $('cx-enter-title').textContent = title;
    $('cx-enter').hidden = false;
    setTimeout(() => location.assign(HUB_URL + '?boot=1'), 1700);
}

async function submit(e) {
    e.preventDefault();
    if (cx.busy) return;
    const m = cx.mode;
    if ((m === 'forgot' || m === 'signup') && cx.sent) { setMode('login'); return; }
    cx.server = {};
    if (Object.keys(errors()).length) { cx.tried = true; render(); return; }

    const email = val('cx-email').trim(), pw = val('cx-pw'), name = val('cx-name').trim();
    cx.busy = true; render();
    let res;
    try {
        if (m === 'login')       res = await sbSignIn(email, pw);
        else if (m === 'signup') res = await sbSignUp(email, pw, name, location.origin + location.pathname);
        else if (m === 'reset')  res = await sbSetPassword(pw);
        else                     res = await sbRecover(email, location.origin + location.pathname);
    } catch (err) {
        res = { error: String(err) };
    }
    cx.busy = false;

    if (res.error) {
        // the reset mail does not say whether the address exists; neither do we
        if (m === 'forgot' && !/rate_limit/.test(res.code || '')) { cx.sent = true; cx.tried = false; render(); return; }
        cx.server = serverError(res); cx.tried = true; render(); return;
    }
    if (m === 'forgot' || res.pending) { cx.sent = true; cx.tried = false; render(); return; }

    sbRemember(m !== 'login' || cx.remember);
    render();
    if (m === 'signup') enter('Votre nom est gravé', name || 'Voyageur');
    else enter('Le sceau est reconnu', 'Les portes s’ouvrent');
}

// Leaves for Google / Discord; the visitor comes back here with the session in the hash.
function oauth(provider) {
    if (cx.busy) return;
    if (cx.mode === 'signup' && !cx.accept) { cx.oauthTried = true; render(); return; }
    sbRemember(cx.mode !== 'login' || cx.remember);
    cx.busy = true; render();
    location.assign(sbOAuthUrl(provider, location.origin + location.pathname));
}

function toggle(key) { cx[key] = !cx[key]; render(); }
function onCheckKey(e, key) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(key); } }

// ── wiring ──
const recovering = sbAdoptRecovery();
(recovering ? Promise.resolve(null) : sbAdoptOAuth().catch(() => ({ error: 'network' }))).then(back => {
    if (back && back.ok) {
        ariaBg.mount('door', document.querySelector('.cx-root'));
        enter('Le sceau est reconnu', sbUserName() || 'Les portes s’ouvrent');
    } else if (sbSignedIn() && !recovering) {
        location.replace(HUB_URL);
    } else {
        wire();
        if (back) cx.oauthErr = 'Connexion refusée ou interrompue. Réessayez.';
        if (recovering) setMode('reset'); else render();
    }
});

function wire() {
    ariaBg.mount('door', document.querySelector('.cx-root'));
    $('cx-form').addEventListener('submit', submit);
    document.querySelectorAll('.cx-tab').forEach(t => t.addEventListener('click', () => { if (cx.mode !== t.dataset.mode) setMode(t.dataset.mode); }));
    document.querySelectorAll('.cx-oauth-btn').forEach(b => b.addEventListener('click', () => oauth(b.dataset.provider)));
    $('cx-show').addEventListener('click', () => toggle('show'));
    $('cx-accept').addEventListener('click', () => toggle('accept'));
    $('cx-accept').addEventListener('keydown', e => onCheckKey(e, 'accept'));
    // the link opens the Code in a new tab; it must not tick the box (nor Enter be swallowed by it)
    ['click', 'keydown'].forEach(t => $('cx-code-link').addEventListener(t, e => e.stopPropagation()));
    $('cx-remember').addEventListener('click', () => toggle('remember'));
    $('cx-remember').addEventListener('keydown', e => onCheckKey(e, 'remember'));
    $('cx-to-forgot').addEventListener('click', e => { e.preventDefault(); setMode('forgot'); });
    $('cx-foot-a').addEventListener('click', e => { e.preventDefault(); setMode(e.currentTarget.dataset.mode); });
    // a server error belongs to what was typed; editing clears it, the rest re-validates live
    document.querySelectorAll('.cx-input').forEach(i => i.addEventListener('input', () => { cx.server = {}; render(); }));
    // Back from the provider's consent screen restores this page busy from bfcache
    addEventListener('pageshow', e => { if (e.persisted) { cx.busy = false; render(); } });
}
