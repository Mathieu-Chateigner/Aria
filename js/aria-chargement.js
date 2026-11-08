// ═══════════════════════════════════════════
//  CHARGEMENT — boot screen
// ═══════════════════════════════════════════
// design_handoff_aria/Aria Chargement.dc.html, as a layer over the page that is
// booting rather than a page of its own: the Hub shows it while its first load runs.
//
//   await ariaLoading(promise)
//
// The bar follows the prototype's irregular 4.2s fill, but never passes 92% until
// `promise` has settled; then it finishes, holds "Prêt" 450ms, fades and removes
// itself. 4.2s is therefore a minimum, not a fixed delay. Needs aria-bg.js.

function ariaLoading(promise) {
    const TIPS = [
        'Un critique au d20 déclenche l\'effet de la carte tirée — gardez un œil sur le talon.',
        'Ce que vous n\'avez pas découvert reste noir sur la carte. Rien n\'y attend en silence par hasard.',
        'Le Karma se dépense avant le jet, jamais après. Les dés ne pardonnent pas l\'hésitation.',
        'Les touches 1 à 8 lancent vos jets rapides. K, I, C, A, N et J ouvrent vos grimoires.',
        'Une torche éclaire trois cases. Dans l\'obscurité, ce sont les yeux qui vous trouvent.',
    ];
    const STEPS = ['Allumage des torches', 'Réveil des archives', 'Déroulement des cartes', 'Appel des tables', 'Ouverture des portes'];
    const D = 4200, HOLD = 92;

    const root = document.createElement('div');
    root.className = 'ld-root';
    root.innerHTML = `
        <div class="ld-fade"></div>
        <div class="ld-brand"><div class="ld-word">ARIA</div><div class="ld-sub">Chroniques de table</div></div>
        <div class="ld-bottom">
            <div class="ld-tip-box">
                <div class="ld-tip-head"><div class="ld-tip-l"></div><div class="ld-tip-kicker">Conseil</div><div class="ld-tip-r"></div></div>
                <div class="ld-tip"></div>
            </div>
            <div class="ld-progress">
                <div class="ld-labels"><div class="ld-status"></div><div class="ld-pct"></div></div>
                <div class="ld-bar-row">
                    <div class="ld-gem"></div>
                    <div class="ld-bar"><div class="ld-fill"><div class="ld-spark"></div></div><div class="ld-ticks"></div></div>
                    <div class="ld-gem"></div>
                </div>
            </div>
        </div>`;
    root.querySelector('.ld-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    document.body.append(root);
    const bg = ariaBg.mount('hall', root);
    const fill = root.querySelector('.ld-fill'), status = root.querySelector('.ld-status'), pctEl = root.querySelector('.ld-pct');

    let settled = false, p = 0, raf = 0;
    Promise.resolve(promise).catch(() => {}).then(() => { settled = true; });

    const show = () => {
        fill.style.width = 'calc(' + p.toFixed(2) + '% - 4px)';
        pctEl.textContent = Math.floor(p) + ' %';
        status.textContent = p >= 100 ? 'Prêt' : STEPS[Math.min(STEPS.length - 1, Math.floor(p / 100 * STEPS.length))] + '…';
    };

    return new Promise(resolve => {
        const t0 = performance.now();
        let t1 = 0;   // when the hold was released
        const tick = t => {
            const k = Math.min(1, (t - t0) / D);
            // irregular progress with small stalls, like assets streaming in
            const e = k - 0.035 * Math.sin(k * Math.PI * 5) * (1 - k);
            let target = Math.min(100, e * 100);
            if (!settled) target = Math.min(target, HOLD);
            else if (k >= 1) target = Math.min(100, Math.max(p, HOLD) + (t - (t1 ||= t)) / 3);   // late promise: finish in ~0.3s
            p = Math.max(p, target);
            show();
            if (p < 100) { raf = requestAnimationFrame(tick); return; }
            setTimeout(() => {
                root.classList.add('out');
                setTimeout(() => { bg.destroy(); root.remove(); }, 450);
                resolve();
            }, 450);
        };
        show();
        raf = requestAnimationFrame(tick);
    });
}
