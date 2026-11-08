// ═══════════════════════════════════════════
//  PROCEDURAL BACKGROUNDS
// ═══════════════════════════════════════════
// Every painted backdrop of the redesign, in one place. Ported as-is from the
// design handoff (design_handoff_aria/*.dc.html); the painters are seeded, so a
// scene paints the same picture on every load.
//
//   ariaBg.mount('door')    Connexion — stone wall, closed oak door with a barred
//                           judas, sconce fires, eyes behind the judas
//   ariaBg.mount('arch')    Accueil — the same wall around an open arch, braziers
//                           on pillars, eyes in the dark beyond
//   ariaBg.mount('hall')    Chargement ┐
//   ariaBg.mount('tavern')  Hub        │
//   ariaBg.mount('desk')    Journal    ├ one still 1920×1080 painting, cover-fit
//   ariaBg.mount('study')   Fiche      │
//   ariaBg.mount('oath')    Code de la table  │
//   ariaBg.mount('vault')   Confidentialité   │
//   ariaBg.mount('notice')  Mentions légales  ┘
//
// mount(scene, root = document.body) prepends a fixed, full-viewport layer that never
// takes pointer events, and returns { layer, fire, destroy() }. `fire` is the
// animated canvas of a stone scene (Accueil fades it), null otherwise.
//
// The stone scenes paint on a fixed 1600×960 stage, cover-scaled to the viewport —
// a resize only rescales it, nothing is repainted. The fire and eyes run on
// requestAnimationFrame, which the browser already suspends in a hidden tab (dt is
// capped at 48ms, so the scene resumes without a jump). prefers-reduced-motion
// freezes them: one still frame of fire, no eyes, live again if the setting flips.
// Self-contained — no dependency on aria-shared.js.

const ariaBg = (() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const css = (tag, style) => { const n = document.createElement(tag); n.style.cssText = style; return n; };
  const FILL = 'position:absolute;inset:0;width:100%;height:100%;';

  function stone(root, door) {
    const bg = { door, live: !reduced.matches };
    const layer = css('div', 'position:fixed;inset:0;background:#030405;overflow:hidden;pointer-events:none;z-index:0;');
    const stage = css('div', 'position:absolute;left:50%;top:50%;width:1600px;height:960px;transform:translate(-50%,-50%);transform-origin:50% 50%;');
    bg.stoneCv = css('canvas', FILL);
    bg.eyesCv = css('canvas', FILL);
    bg.fireCv = css('canvas', FILL + 'transition:opacity 1.2s ease;');
    stage.append(bg.stoneCv, bg.eyesCv, bg.fireCv,
      css('div', 'position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(0deg, rgba(3,4,6,.8), rgba(3,4,6,0));'));
    layer.append(stage, css('div', 'position:absolute;inset:0;box-shadow:inset 0 0 240px 60px rgba(1,2,3,.85);'));
    root.prepend(layer);

    function paintStone(tries = 0) {
      const cv = bg.stoneCv;
      if (!cv || !cv.clientWidth) { if (tries < 40) bg._retry = setTimeout(() => paintStone(tries + 1), 100); return; }
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      let c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      bg._stoneCv = cv;
      const SH = document.createElement('canvas'); SH.width = cv.width; SH.height = cv.height;
      const SHc = SH.getContext('2d'); SHc.setTransform(dpr, 0, 0, dpr, 0, 0);
      let MAINc = c;
      const shadowBegin = () => { MAINc = c; SHc.setTransform(1, 0, 0, 1, 0, 0); SHc.clearRect(0, 0, SH.width, SH.height); SHc.setTransform(dpr, 0, 0, dpr, 0, 0); c = SHc; };
      const shadowEnd = (blur) => { c = MAINc; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'blur(' + (blur * dpr) + 'px)'; c.drawImage(SH, 0, 0); c.restore(); c.filter = 'none'; }; bg._stoneW = w; bg._stoneH = h;

      let sd = 20260916 >>> 0;
      const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      const rr = (a, b) => a + rnd() * (b - a);
      const col = (l, s) => 'hsl(214,' + (s == null ? rr(5, 11) : s).toFixed(1) + '%,' + l.toFixed(1) + '%)';

      const FLOOR = 132, AW = 988, AH = 668, OW = 884, OH = 612;
      const cx = w / 2, R_OUT = AW / 2, R_IN = OW / 2;
      const springY = h - FLOOR - (AH - R_OUT);
      const PX = 511, PW = 58, PH = 300, CAPW = 78, CAPH = 16, BOWLH = 26;

      // mortar bed
      c.fillStyle = '#080a0d'; c.fillRect(0, 0, w, h);
      const bed = c.createLinearGradient(0, 0, 0, h);
      bed.addColorStop(0, '#0e1116'); bed.addColorStop(1, '#070809');
      c.fillStyle = bed; c.fillRect(0, 0, w, h);

      // one stone face: jittered quad + bevel + pitting + wear
      const face = (x, y, bw, bh, L, opt) => {
        const o = opt || {}, j = o.jit == null ? 1.6 : o.jit;
        const p = [
          [x + rr(0, j), y + rr(0, j)],
          [x + bw - rr(0, j), y + rr(0, j)],
          [x + bw - rr(0, j), y + bh - rr(0, j)],
          [x + rr(0, j), y + bh - rr(0, j)],
        ];
        c.beginPath();
        c.moveTo(p[0][0], p[0][1]);
        c.lineTo((p[0][0] + p[1][0]) / 2 + rr(-j, j), (p[0][1] + p[1][1]) / 2 + rr(-j, j));
        c.lineTo(p[1][0], p[1][1]);
        c.lineTo((p[1][0] + p[2][0]) / 2 + rr(-j, j), (p[1][1] + p[2][1]) / 2 + rr(-j, j));
        c.lineTo(p[2][0], p[2][1]);
        c.lineTo((p[2][0] + p[3][0]) / 2 + rr(-j, j), (p[2][1] + p[3][1]) / 2 + rr(-j, j));
        c.lineTo(p[3][0], p[3][1]);
        c.lineTo((p[3][0] + p[0][0]) / 2 + rr(-j, j), (p[3][1] + p[0][1]) / 2 + rr(-j, j));
        c.closePath();
        c.save(); c.clip();
        const Lv = L + rr(-3.2, 3.2);
        c.fillStyle = col(Lv); c.fillRect(x - 2, y - 2, bw + 4, bh + 4);
        // face undulation
        for (let i = 0; i < 5; i++) {
          const gx = x + rr(0, bw), gy = y + rr(0, bh), gr = rr(bh * 0.4, bh * 1.5);
          const g = c.createRadialGradient(gx, gy, 0, gx, gy, gr);
          const up = rnd() > 0.5;
          g.addColorStop(0, up ? 'rgba(206,220,238,' + rr(0.02, 0.055).toFixed(3) + ')' : 'rgba(0,0,0,' + rr(0.05, 0.13).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.fillRect(x - 2, y - 2, bw + 4, bh + 4);
        }
        // pitting + grit
        const pits = Math.round(bw * bh / 210);
        for (let i = 0; i < pits; i++) {
          const px = x + rr(1, bw - 1), py = y + rr(1, bh - 1), pr = rr(0.4, 1.5);
          c.fillStyle = rnd() > 0.72 ? 'rgba(210,222,238,' + rr(0.03, 0.09).toFixed(3) + ')' : 'rgba(0,0,0,' + rr(0.06, 0.2).toFixed(3) + ')';
          c.beginPath(); c.arc(px, py, pr, 0, 6.2832); c.fill();
        }
        // hairline crack
        if (rnd() < 0.22) {
          c.strokeStyle = 'rgba(0,0,0,' + rr(0.16, 0.34).toFixed(2) + ')'; c.lineWidth = rr(0.6, 1.2);
          let ax = x + rr(2, bw - 2), ay = y + rr(0, 2);
          c.beginPath(); c.moveTo(ax, ay);
          const segs = Math.round(rr(3, 6));
          for (let i = 0; i < segs; i++) { ax += rr(-7, 7); ay += bh / segs; c.lineTo(ax, ay); }
          c.stroke();
        }
        // bevel: lit top/left edge, shaded bottom/right
        c.strokeStyle = 'rgba(214,226,242,.085)'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x, y + bh - 1); c.lineTo(x, y + 1); c.lineTo(x + bw, y + 1); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(x + bw - 1, y); c.lineTo(x + bw - 1, y + bh); c.lineTo(x, y + bh - 1); c.stroke();
        // chipped corner
        if (rnd() < 0.3) {
          const cw = rr(4, 11), corner = Math.floor(rnd() * 4);
          const pts = [[x, y], [x + bw, y], [x + bw, y + bh], [x, y + bh]][corner];
          c.fillStyle = 'rgba(0,0,0,.42)';
          c.beginPath();
          c.moveTo(pts[0] + (corner === 1 || corner === 2 ? -cw : cw), pts[1]);
          c.lineTo(pts[0], pts[1] + (corner >= 2 ? -cw : cw));
          c.lineTo(pts[0], pts[1]); c.closePath(); c.fill();
        }
        c.restore();
      };

      // ---- wall: coursed ashlar, offsets never repeating
      const rows = [];
      for (let y = -20; y < h; ) {
        const bh = rr(44, 62), row = { y, bh, blocks: [], gap: 0 };
        let x = -rr(20, 160);
        while (x < w) {
          const bw = rr(82, 186);
          face(x, y, bw, bh, rr(11.5, 16.5));
          row.blocks.push({ x, bw });
          x += bw + rr(3.5, 6);
        }
        row.gap = rr(3.5, 6); rows.push(row);
        y += bh + row.gap;
      }

      // ---- portal: voussoirs around the head, jambs below the springline
      for (let a = 180, i = 0; a < 360; i++) {
        const step = rr(6.4, 9.2), a2 = Math.min(a + step, 360);
        const r0 = R_IN + rr(0, 3), r1 = R_OUT - rr(0, 3);
        const t0 = a * Math.PI / 180, t1 = a2 * Math.PI / 180;
        c.beginPath();
        c.arc(cx, springY, r0, t0, t1);
        c.arc(cx, springY, r1, t1, t0, true);
        c.closePath();
        c.save(); c.clip();
        const L = rr(13, 18.5);
        c.fillStyle = col(L); c.fillRect(cx - R_OUT - 4, springY - R_OUT - 4, AW + 8, R_OUT + 8);
        const mid = (t0 + t1) / 2, mx = cx + Math.cos(mid) * (r0 + r1) / 2, my = springY + Math.sin(mid) * (r0 + r1) / 2;
        const g = c.createRadialGradient(mx, my, 0, mx, my, (r1 - r0) * 1.1);
        g.addColorStop(0, 'rgba(208,222,240,.05)'); g.addColorStop(1, 'rgba(0,0,0,.24)');
        c.fillStyle = g; c.fillRect(cx - R_OUT - 4, springY - R_OUT - 4, AW + 8, R_OUT + 8);
        for (let k = 0; k < 26; k++) {
          c.fillStyle = 'rgba(0,0,0,' + rr(0.05, 0.18).toFixed(3) + ')';
          c.beginPath(); c.arc(mx + rr(-26, 26), my + rr(-26, 26), rr(0.4, 1.4), 0, 6.2832); c.fill();
        }
        c.restore();
        // joint between voussoirs
        c.strokeStyle = 'rgba(0,0,0,.62)'; c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(cx + Math.cos(t1) * r0, springY + Math.sin(t1) * r0); c.lineTo(cx + Math.cos(t1) * r1, springY + Math.sin(t1) * r1); c.stroke();
        a = a2;
        if (a >= 360) break;
      }
      // jambs
      for (const side of [-1, 1]) {
        const jx = side < 0 ? cx - R_OUT : cx + R_IN, jw = R_OUT - R_IN;
        c.fillStyle = '#0b0e13'; c.fillRect(jx - 2, springY, jw + 4, h - FLOOR - springY);
        for (let y = springY; y < h - FLOOR; ) {
          const bh = rr(40, 58);
          face(jx, y, jw, Math.min(bh, h - FLOOR - y) + 1.4, rr(12.5, 17.5), { jit: 0.9 });
          y += bh + rr(1.4, 2.4);
        }
      }

      if (bg.door) {
        // ---- the door: two oak leaves, iron-banded, a barred judas on the right leaf
        {
          const dTop = springY - R_IN, dBot = h - FLOOR;
          const doorPath = () => { c.beginPath(); c.moveTo(cx - R_IN, dBot); c.lineTo(cx - R_IN, springY); c.arc(cx, springY, R_IN, Math.PI, 0); c.lineTo(cx + R_IN, dBot); c.closePath(); };
          c.save(); doorPath(); c.clip();
          c.fillStyle = '#080604'; c.fillRect(cx - R_IN, dTop, OW, dBot - dTop);
          for (const leaf of [-1, 1]) {
            const x0 = leaf < 0 ? cx - R_IN : cx + 3, x1 = leaf < 0 ? cx - 3 : cx + R_IN;
            for (let x = x0; x < x1; ) {
              const pw = Math.min(rr(50, 68), x1 - x), L = rr(9.5, 14), hue = rr(18, 28), sat = rr(24, 34);
              const g = c.createLinearGradient(x, 0, x + pw, 0);
              g.addColorStop(0, 'hsl(' + hue.toFixed(0) + ',' + sat.toFixed(0) + '%,' + (L - 3.5).toFixed(1) + '%)');
              g.addColorStop(0.35, 'hsl(' + hue.toFixed(0) + ',' + sat.toFixed(0) + '%,' + (L + 1.2).toFixed(1) + '%)');
              g.addColorStop(1, 'hsl(' + hue.toFixed(0) + ',' + sat.toFixed(0) + '%,' + (L - 4.5).toFixed(1) + '%)');
              c.fillStyle = g; c.fillRect(x, dTop, pw, dBot - dTop);
              // grain: long wavy fibres
              for (let k = 0; k < pw / 2.6; k++) {
                const gx = x + rr(2, pw - 2), ph = rr(0, 6.28), amp = rr(0.6, 2.2), fq = rr(0.006, 0.014);
                c.strokeStyle = rnd() < 0.7 ? 'rgba(0,0,0,' + rr(0.12, 0.3).toFixed(2) + ')' : 'rgba(210,160,110,' + rr(0.03, 0.07).toFixed(3) + ')';
                c.lineWidth = rr(0.5, 1.2);
                c.beginPath();
                for (let y = dTop; y <= dBot; y += 8) { const xx = gx + Math.sin(y * fq + ph) * amp + Math.sin(y * fq * 3.1 + ph) * amp * 0.3; y === dTop ? c.moveTo(xx, y) : c.lineTo(xx, y); }
                c.stroke();
              }
              // knots with rings the grain swirls around
              for (let k = 0; k < (rnd() < 0.6 ? 1 : 2); k++) {
                const kx = x + rr(10, pw - 10), ky = rr(dTop + 60, dBot - 40), kr = rr(3, 6.5);
                for (let q = 4; q >= 1; q--) {
                  c.strokeStyle = 'rgba(0,0,0,' + (0.1 + q * 0.05).toFixed(2) + ')'; c.lineWidth = 0.8;
                  c.beginPath(); c.ellipse(kx, ky, kr * q * 0.55 + 1, kr * q * 1.6 + 2, 0, 0, 6.2832); c.stroke();
                }
                c.fillStyle = 'rgba(8,4,2,.8)'; c.beginPath(); c.ellipse(kx, ky, kr * 0.7, kr * 1.1, 0, 0, 6.2832); c.fill();
              }
              // scratches and gouges
              for (let k = 0; k < 3; k++) {
                const sx0 = x + rr(4, pw - 4), sy0 = rr(dTop + 40, dBot - 30), ln = rr(8, 26), an = rr(-0.6, 0.6) + Math.PI / 2;
                c.strokeStyle = 'rgba(214,170,120,.07)'; c.lineWidth = 0.7;
                c.beginPath(); c.moveTo(sx0, sy0); c.lineTo(sx0 + Math.cos(an) * ln, sy0 + Math.sin(an) * ln); c.stroke();
              }
              // plank gap
              c.fillStyle = 'rgba(0,0,0,.85)'; c.fillRect(x + pw - 1.6, dTop, 1.8, dBot - dTop);
              c.fillStyle = 'rgba(230,180,120,.05)'; c.fillRect(x, dTop, 1, dBot - dTop);
              x += pw;
            }
          }
          // meeting stiles + astragal between the leaves
          c.fillStyle = '#030201'; c.fillRect(cx - 3, dTop, 6, dBot - dTop);
          const ast = c.createLinearGradient(cx - 6, 0, cx + 6, 0);
          ast.addColorStop(0, 'hsl(22,26%,7%)'); ast.addColorStop(0.4, 'hsl(22,28%,14%)'); ast.addColorStop(1, 'hsl(22,26%,5%)');
          c.fillStyle = ast; c.fillRect(cx - 6, dTop, 12, dBot - dTop);
          // rot and damp at the foot of the door
          const rot = c.createLinearGradient(0, dBot - 90, 0, dBot);
          rot.addColorStop(0, 'rgba(10,14,8,0)'); rot.addColorStop(1, 'rgba(8,12,6,.75)');
          c.fillStyle = rot; c.fillRect(cx - R_IN, dBot - 90, OW, 90);
          // iron bands with rivets and rust bleed
          const iron = (y0, hh) => {
            const g = c.createLinearGradient(0, y0, 0, y0 + hh);
            g.addColorStop(0, '#23262b'); g.addColorStop(0.35, '#16181c'); g.addColorStop(1, '#0a0b0d');
            c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(cx - R_IN, y0 + hh, OW, 4);
            c.fillStyle = g; c.fillRect(cx - R_IN, y0, OW, hh);
            c.fillStyle = 'rgba(210,220,235,.12)'; c.fillRect(cx - R_IN, y0, OW, 1.2);
            for (let k = 0; k < 9; k++) {
              const rx = cx + rr(-R_IN, R_IN), rg = c.createRadialGradient(rx, y0 + hh, 0, rx, y0 + hh, rr(10, 26));
              rg.addColorStop(0, 'rgba(120,58,24,.35)'); rg.addColorStop(1, 'rgba(120,58,24,0)');
              c.fillStyle = rg; c.fillRect(rx - 30, y0 - 4, 60, hh + 40);
            }
            for (let rx = cx - R_IN + 22; rx < cx + R_IN; rx += 44) {
              if (Math.abs(rx - cx) < 12) continue;
              const ry = y0 + hh / 2, rv = c.createRadialGradient(rx - 1, ry - 1.2, 0, rx, ry, 4);
              rv.addColorStop(0, '#5a5f68'); rv.addColorStop(0.5, '#23262b'); rv.addColorStop(1, '#0a0b0d');
              c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.arc(rx + 1, ry + 1.6, 4, 0, 6.2832); c.fill();
              c.fillStyle = rv; c.beginPath(); c.arc(rx, ry, 3.6, 0, 6.2832); c.fill();
            }
          };
          iron(dTop + 196, 24); iron(springY + 30, 24); iron(dBot - 118, 24);
          // judas: barred window in the right leaf; eyes are drawn behind the bars on the eyes layer
          const J = { x: cx + 258, y: 440, w: 92, h: 58 };
          c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(J.x - 9, J.y - 7, J.w + 18, J.h + 18);
          const fr = c.createLinearGradient(0, J.y - 9, 0, J.y + J.h + 9);
          fr.addColorStop(0, '#2a2d33'); fr.addColorStop(1, '#0c0d10');
          c.fillStyle = fr; c.fillRect(J.x - 8, J.y - 8, J.w + 16, J.h + 16);
          c.fillStyle = '#010102'; c.fillRect(J.x, J.y, J.w, J.h);
          const ins = c.createLinearGradient(0, J.y, 0, J.y + 12);
          ins.addColorStop(0, 'rgba(0,0,0,.9)'); ins.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = ins; c.fillRect(J.x, J.y, J.w, 12);
          c.fillStyle = 'rgba(210,220,235,.1)'; c.fillRect(J.x - 8, J.y - 8, J.w + 16, 1.2);
          for (const [qx, qy] of [[J.x - 4, J.y - 4], [J.x + J.w + 4, J.y - 4], [J.x - 4, J.y + J.h + 4], [J.x + J.w + 4, J.y + J.h + 4]]) {
            c.fillStyle = '#4a4f57'; c.beginPath(); c.arc(qx, qy, 2.4, 0, 6.2832); c.fill();
          }
          bg._judas = J;
          // ring pulls on both leaves
          for (const side of [-1, 1]) {
            const rx = cx + side * 52, ry = springY + 150;
            c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.arc(rx + 2, ry + 3, 17, 0, 6.2832); c.fill();
            const bp = c.createRadialGradient(rx - 4, ry - 5, 0, rx, ry, 17);
            bp.addColorStop(0, '#3a3e45'); bp.addColorStop(1, '#0d0e11');
            c.fillStyle = bp; c.beginPath(); c.arc(rx, ry, 16, 0, 6.2832); c.fill();
            c.strokeStyle = 'rgba(0,0,0,.65)'; c.lineWidth = 6.5; c.beginPath(); c.arc(rx + 2, ry + 26, 22, 0, 6.2832); c.stroke();
            c.strokeStyle = '#1c1e22'; c.lineWidth = 5.5; c.beginPath(); c.arc(rx, ry + 22, 22, 0, 6.2832); c.stroke();
            c.strokeStyle = 'rgba(210,220,235,.2)'; c.lineWidth = 1.2; c.beginPath(); c.arc(rx, ry + 22, 23.5, Math.PI * 1.1, Math.PI * 1.7); c.stroke();
            c.fillStyle = '#2a2d33'; c.beginPath(); c.arc(rx, ry, 5, 0, 6.2832); c.fill();
          }
          // depth: the door sits back in the reveal
          c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 34;
          doorPath(); c.stroke();
          c.restore();
        }

        // ---- wall sconces: riveted plate, forged arm, iron fire basket (flames sit on the basket)
        for (const side of [-1, 1]) {
          const sx = cx + side * PX, bY = h - FLOOR - PH - CAPH - BOWLH, bw = 50;
          for (let k = 0; k < 16; k++) {
            const yy = bY - 20 - k * 20, sp = 20 + k * 5.5;
            const sg = c.createRadialGradient(sx, yy, 0, sx, yy, sp);
            sg.addColorStop(0, 'rgba(7,6,8,' + (0.22 - k * 0.012).toFixed(3) + ')');
            sg.addColorStop(1, 'rgba(7,6,8,0)');
            c.fillStyle = sg; c.beginPath(); c.arc(sx, yy, sp, 0, 6.2832); c.fill();
          }
          const py0 = bY + 52, ph = 86;
          c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(sx - 11 + 3, py0 + 4, 22, ph);
          const pg = c.createLinearGradient(sx - 12, 0, sx + 12, 0);
          pg.addColorStop(0, '#0d0e11'); pg.addColorStop(0.4, '#262a30'); pg.addColorStop(1, '#0b0c0e');
          c.fillStyle = pg;
          c.beginPath(); c.moveTo(sx - 12, py0); c.lineTo(sx + 12, py0); c.lineTo(sx + 12, py0 + ph - 10); c.lineTo(sx, py0 + ph); c.lineTo(sx - 12, py0 + ph - 10); c.closePath(); c.fill();
          for (const ry of [py0 + 10, py0 + ph - 20]) { c.fillStyle = '#4a4f57'; c.beginPath(); c.arc(sx, ry, 2.6, 0, 6.2832); c.fill(); }
          c.lineCap = 'round';
          c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 8;
          c.beginPath(); c.moveTo(sx + 3, py0 + 30); c.bezierCurveTo(sx + side * 18 + 3, py0 + 10, sx - side * 14 + 3, bY + BOWLH + 18, sx + 3, bY + BOWLH + 8); c.stroke();
          c.strokeStyle = '#1b1d21'; c.lineWidth = 6.5;
          c.beginPath(); c.moveTo(sx, py0 + 26); c.bezierCurveTo(sx + side * 18, py0 + 6, sx - side * 14, bY + BOWLH + 14, sx, bY + BOWLH + 4); c.stroke();
          c.strokeStyle = 'rgba(210,220,235,.14)'; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(sx - 2, py0 + 24); c.bezierCurveTo(sx + side * 16 - 2, py0 + 4, sx - side * 16 - 2, bY + BOWLH + 12, sx - 2, bY + BOWLH + 4); c.stroke();
          c.fillStyle = '#16181c'; c.beginPath(); c.ellipse(sx, bY + BOWLH + 3, 17, 4.5, 0, 0, 6.2832); c.fill();
          c.fillStyle = '#07080a';
          c.beginPath(); c.moveTo(sx - bw / 2, bY); c.lineTo(sx + bw / 2, bY); c.lineTo(sx + bw / 2 - 11, bY + BOWLH); c.lineTo(sx - bw / 2 + 11, bY + BOWLH); c.closePath(); c.fill();
          c.strokeStyle = '#23262b'; c.lineWidth = 2.4;
          for (let k = 0; k <= 5; k++) {
            const t = k / 5, xt = sx - bw / 2 + bw * t, xb = sx - bw / 2 + 11 + (bw - 22) * t;
            c.beginPath(); c.moveTo(xt, bY); c.lineTo(xb, bY + BOWLH); c.stroke();
          }
          c.strokeStyle = '#2c3036'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(sx - bw / 2 - 1, bY + 1); c.lineTo(sx + bw / 2 + 1, bY + 1); c.stroke();
          c.beginPath(); c.moveTo(sx - bw / 2 + 7, bY + BOWLH * 0.62); c.lineTo(sx + bw / 2 - 7, bY + BOWLH * 0.62); c.stroke();
        }
      } else {
        // ---- opening: the dark beyond
        c.save();
        c.beginPath();
        c.moveTo(cx - R_IN, h - FLOOR);
        c.lineTo(cx - R_IN, springY);
        c.arc(cx, springY, R_IN, Math.PI, 0);
        c.lineTo(cx + R_IN, h - FLOOR);
        c.closePath();
        c.clip();
        const vd = c.createLinearGradient(0, springY - R_IN, 0, h - FLOOR);
        vd.addColorStop(0, '#04050a'); vd.addColorStop(1, '#010103');
        c.fillStyle = vd; c.fillRect(cx - R_IN, springY - R_IN, OW, OH + 40);
        const dg = c.createRadialGradient(cx, h - FLOOR, 0, cx, h - FLOOR, 420);
        dg.addColorStop(0, 'rgba(98,76,148,.16)'); dg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = dg; c.fillRect(cx - R_IN, springY - R_IN, OW, OH + 40);
        // reveal AO around the opening edge
        c.strokeStyle = 'rgba(0,0,0,.85)'; c.lineWidth = 26; c.filter = 'none';
        c.beginPath();
        c.moveTo(cx - R_IN, h - FLOOR); c.lineTo(cx - R_IN, springY);
        c.arc(cx, springY, R_IN, Math.PI, 0); c.lineTo(cx + R_IN, h - FLOOR);
        c.stroke();
        c.restore();

        // ---- pillars, caps, bowls
        for (const side of [-1, 1]) {
          const x0 = cx + side * PX - PW / 2;
          // solid shaft behind the courses: blocks bed into this, so joints read as mortar, not gaps
          const shaft = c.createLinearGradient(x0, 0, x0 + PW, 0);
          shaft.addColorStop(0, '#080a0e'); shaft.addColorStop(0.45, '#12151c'); shaft.addColorStop(1, '#070809');
          c.fillStyle = shaft; c.fillRect(x0 - 2, h - FLOOR - PH - 2, PW + 4, PH + 4);
          // contact shadow onto the wall behind
          c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x0 + PW, h - FLOOR - PH, 9, PH);
          c.fillStyle = 'rgba(0,0,0,.34)'; c.fillRect(x0 - 7, h - FLOOR - PH, 7, PH);
          for (let y = h - FLOOR - PH; y < h - FLOOR; ) {
            const bh = rr(38, 52), hh = Math.min(bh, h - FLOOR - y);
            face(x0, y, PW, hh + 1.4, rr(12, 17), { jit: 0.7 });
            y += bh + rr(1.2, 2.2);
          }
          const capY = h - FLOOR - PH - CAPH;
          face(cx + side * PX - CAPW / 2, capY, CAPW, CAPH, 17.5, { jit: 1 });
          // bowl
          const bY = capY - BOWLH, bw = 52;
          c.save();
          c.beginPath();
          c.moveTo(cx + side * PX - bw / 2, bY);
          c.lineTo(cx + side * PX + bw / 2, bY);
          c.lineTo(cx + side * PX + bw / 2 - 8, bY + BOWLH);
          c.lineTo(cx + side * PX - bw / 2 + 8, bY + BOWLH);
          c.closePath(); c.clip();
          c.fillStyle = col(16); c.fillRect(cx + side * PX - 30, bY, 60, BOWLH);
          const bg = c.createLinearGradient(0, bY, 0, bY + BOWLH);
          bg.addColorStop(0, 'rgba(226,232,244,.10)'); bg.addColorStop(1, 'rgba(0,0,0,.6)');
          c.fillStyle = bg; c.fillRect(cx + side * PX - 30, bY, 60, BOWLH);
          for (let k = 0; k < 40; k++) {
            c.fillStyle = 'rgba(0,0,0,' + rr(0.06, 0.22).toFixed(3) + ')';
            c.beginPath(); c.arc(cx + side * PX + rr(-26, 26), bY + rr(0, BOWLH), rr(0.4, 1.4), 0, 6.2832); c.fill();
          }
          c.restore();
          // charred rim + soot plume up the wall
          c.fillStyle = 'rgba(8,7,9,.5)';
          c.beginPath(); c.ellipse(cx + side * PX, bY + 1, bw / 2 - 1, 4, 0, 0, 6.2832); c.fill();
          for (let k = 0; k < 16; k++) {
            const yy = bY - 20 - k * 20, sp = 20 + k * 5.5;
            const sg = c.createRadialGradient(cx + side * PX, yy, 0, cx + side * PX, yy, sp);
            sg.addColorStop(0, 'rgba(7,6,8,' + (0.2 - k * 0.011).toFixed(3) + ')');
            sg.addColorStop(1, 'rgba(7,6,8,0)');
            c.fillStyle = sg; c.beginPath(); c.arc(cx + side * PX, yy, sp, 0, 6.2832); c.fill();
          }
        }
      }

      // ---- floor flagstones
      c.save();
      c.beginPath(); c.rect(0, h - FLOOR, w, FLOOR); c.clip();
      c.fillStyle = '#07080b'; c.fillRect(0, h - FLOOR, w, FLOOR);
      for (let y = h - FLOOR; y < h; ) {
        const bh = rr(34, 46);
        let x = -rr(10, 120);
        while (x < w) {
          const bw = rr(86, 160);
          face(x, y, bw, bh, rr(10, 15));
          x += bw + rr(4, 7);
        }
        y += bh + rr(4, 7);
      }
      // AO where floor meets wall
      const fao = c.createLinearGradient(0, h - FLOOR, 0, h - FLOOR + 46);
      fao.addColorStop(0, 'rgba(0,0,0,.72)'); fao.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = fao; c.fillRect(0, h - FLOOR, w, 46);
      c.restore();

      // solid-masonry test: nothing may be painted inside the opening
      const inOpening = (x, y, pad) => {
        const p = pad || 0;
        if (y > h - FLOOR - p) return false;
        if (Math.abs(x - cx) > R_IN - p) return false;
        if (y >= springY) return true;
        const dx = x - cx, dy = y - springY;
        return Math.sqrt(dx * dx + dy * dy) < R_IN - p;
      };
      const onSolid = (fn, pad) => {   // rejection sampling, bounded
        for (let t = 0; t < 40; t++) {
          const x = rr(0, w), y = rr(0, h);
          if (!inOpening(x, y, -(pad || 0))) return fn(x, y);
        }
      };
      // ---- organic noise
      const NS = 64, perm = new Float32Array(NS * NS);
      for (let i = 0; i < perm.length; i++) perm[i] = rnd();
      const vn = (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
        const g = (p, q) => perm[(((p % NS) + NS) % NS) + (((q % NS) + NS) % NS) * NS];
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        return (g(xi, yi) * (1 - u) + g(xi + 1, yi) * u) * (1 - v) + (g(xi, yi + 1) * (1 - u) + g(xi + 1, yi + 1) * u) * v;
      };
      const fbm = (x, y) => vn(x, y) * 0.55 + vn(x * 2.13 + 17, y * 2.13 + 9) * 0.28 + vn(x * 4.37 + 3, y * 4.37 + 31) * 0.17;
      const sstep = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
      const capY = h - FLOOR - PH - CAPH;
      const outsidePortal = (x, y, pad) => Math.abs(x - cx) > R_OUT + pad || (y < springY && Math.hypot(x - cx, y - springY) > R_OUT + pad);
      const onPillar = bg.door
        ? (x, y, pad) => Math.abs(Math.abs(x - cx) - PX) < 30 + pad && y > capY - BOWLH - pad && y < capY + 150 + pad
        : (x, y, pad) => Math.abs(Math.abs(x - cx) - PX) < CAPW / 2 + pad && y > capY - BOWLH - pad;
      const plainWall = (x, y, pad) => y > -30 && y < h - FLOOR - pad && outsidePortal(x, y, pad) && !onPillar(x, y, pad);
      const rectPlain = (x, y, bw, bh) => [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]].every(([u, v]) => plainWall(x + bw * u, y + bh * v, 4));
      const jointY = (row) => row.y + row.bh + row.gap / 2;

      // ---- cracks: tapered, lit lower lip, chipped edges
      const strokeCrack = (pts, w0) => {
        const n = pts.length; if (n < 2) return;
        c.lineCap = 'round'; c.lineJoin = 'round';
        const wAt = (i) => Math.max(0.35, w0 * Math.pow(1 - i / (n - 1), 0.75) * (0.7 + 0.6 * vn(i * 0.4, w0 * 13)));
        for (let i = 1; i < n; i++) {
          c.strokeStyle = 'rgba(214,226,242,.08)'; c.lineWidth = wAt(i) * 0.7 + 0.5;
          c.beginPath(); c.moveTo(pts[i - 1][0] + 0.9, pts[i - 1][1] + 1.3); c.lineTo(pts[i][0] + 0.9, pts[i][1] + 1.3); c.stroke();
        }
        for (let i = 1; i < n; i++) {
          c.strokeStyle = 'rgba(2,2,4,.92)'; c.lineWidth = wAt(i);
          c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
        }
        for (let i = 1; i < n - 1; i++) {
          if (rnd() > 0.18 || wAt(i) < 1.3) continue;
          const p = pts[i], s2 = wAt(i) * rr(1.3, 2.6), an = rr(0, 6.28);
          c.fillStyle = 'rgba(3,3,5,.85)';
          c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + Math.cos(an) * s2, p[1] + Math.sin(an) * s2); c.lineTo(p[0] + Math.cos(an + 0.9) * s2 * 0.7, p[1] + Math.sin(an + 0.9) * s2 * 0.7); c.closePath(); c.fill();
        }
      };
      const crackPath = (x, y, ang, len, stepL, keep) => {
        const pts = [[x, y]], sd2 = rr(0, 50);
        for (let d = 0; d < len; d += stepL) {
          const an = ang + (vn(sd2 + d * 0.025, 7.7) - 0.5) * 1.3 + rr(-0.2, 0.2);
          x += Math.cos(an) * stepL; y += Math.sin(an) * stepL;
          if (!keep(x, y)) break;
          pts.push([x, y]);
        }
        return pts;
      };
      const growCrack = (x, y, ang, len, w0, depth, keep) => {
        const pts = crackPath(x, y, ang, len, 4, keep);
        strokeCrack(pts, w0);
        if (depth > 0 && pts.length > 8) {
          const nb = rnd() < 0.5 ? 1 : 2;
          for (let k = 0; k < nb; k++) {
            const p = pts[Math.floor(rr(0.2, 0.6) * pts.length)];
            growCrack(p[0], p[1], ang + (rnd() < 0.5 ? -1 : 1) * rr(0.5, 1.1), len * rr(0.3, 0.5), w0 * 0.5, depth - 1, keep);
          }
        }
      };
      // settlement crack: steps down head joints and along bed joints, leaning away from the arch
      const steppedCrack = (ri, x0, dir, courses, w0) => {
        let r = ri, x = x0;
        const pts = [[x, rows[r].y + rows[r].bh * rr(0.2, 0.5)]];
        for (let k = 0; k < courses && r < rows.length - 1; k++) {
          const by = jointY(rows[r]);
          pts.push([x + rr(-1.5, 1.5), by]);
          let hx = null;
          for (const bl of rows[r + 1].blocks) {
            const jx = dir > 0 ? bl.x + bl.bw + 2.4 : bl.x - 2.4;
            const ahead = dir > 0 ? jx > x + 14 : jx < x - 14;
            if (ahead && (hx === null || Math.abs(jx - x) < Math.abs(hx - x))) hx = jx;
          }
          if (hx === null || Math.abs(hx - x) > 170 || !plainWall(hx, by, 6)) break;
          pts.push([hx, by + rr(-1, 1)]);
          x = hx; r++;
        }
        pts.push([x + rr(-1, 1), jointY(rows[Math.min(r, rows.length - 1)])]);
        const fine = [];
        for (let i = 1; i < pts.length; i++) {
          const p0 = pts[i - 1], p1 = pts[i], n = Math.max(1, Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 5));
          for (let j = 0; j < n; j++) fine.push([p0[0] + (p1[0] - p0[0]) * j / n + rr(-0.7, 0.7), p0[1] + (p1[1] - p0[1]) * j / n + rr(-0.7, 0.7)]);
        }
        fine.push(pts[pts.length - 1]);
        const cut = fine.findIndex(p => !plainWall(p[0], p[1], 2));
        strokeCrack(cut < 0 ? fine : fine.slice(0, cut), w0);
      };
      for (const side of [-1, 1]) {
        for (let t = 0; t < 40; t++) {
          const ri = Math.floor(rr(1, Math.max(2, rows.length - 6)));
          const row = rows[ri], bl = row.blocks[Math.floor(rr(0, row.blocks.length))];
          const x0 = bl.x + bl.bw * rr(0.3, 0.7);
          if (!plainWall(x0, row.y + row.bh / 2, 12) || (side < 0 ? x0 > cx - R_OUT - 20 : x0 < cx + R_OUT + 20)) continue;
          steppedCrack(ri, x0, side, Math.round(rr(4, 7)), rr(3.6, 4.6));
          break;
        }
      }
      // arch: crown crack opens at the intrados, hinge cracks open at the extrados
      {
        const an = (270 + rr(-10, 10)) * Math.PI / 180;
        const pts = crackPath(cx + Math.cos(an) * (R_IN + 1), springY + Math.sin(an) * (R_IN + 1), an, (R_OUT - R_IN) + rr(50, 120), 3.5, (x, y) => !inOpening(x, y, -2) && y > -10);
        strokeCrack(pts, 3.4);
        for (const side of [-1, 1]) {
          const ha = Math.PI * 1.5 + side * rr(0.72, 0.95);
          const sx0 = cx + Math.cos(ha) * (R_OUT + 1), sy0 = springY + Math.sin(ha) * (R_OUT + 1);
          growCrack(sx0, sy0, ha + side * rr(0.1, 0.3), rr(90, 160), 2.6, 1, (x, y) => plainWall(x, y, -1));
        }
      }
      // through-block cracks and hairline crazing
      const pickBlock = (yMin, yMax) => {
        for (let t = 0; t < 60; t++) {
          const row = rows[Math.floor(rr(0, rows.length))], bl = row.blocks[Math.floor(rr(0, row.blocks.length))];
          if (row.y < yMin || row.y > yMax) continue;
          if (rectPlain(bl.x, row.y, bl.bw, row.bh)) return { row, bl };
        }
        return null;
      };
      for (let i = 0; i < 7; i++) {
        const pb = pickBlock(0, h - FLOOR - 60); if (!pb) continue;
        const { row, bl } = pb;
        growCrack(bl.x + bl.bw * rr(0.2, 0.8), row.y + 1, Math.PI / 2 + rr(-0.55, 0.55), row.bh * rr(1.1, 2.4), rr(1.3, 2.1), 1, (x, y) => plainWall(x, y, 0));
      }
      for (let i = 0; i < 4; i++) {
        const pb = pickBlock(0, h - FLOOR - 60); if (!pb) continue;
        const { row, bl } = pb;
        const ccx = bl.x + bl.bw * rr(0.3, 0.7), ccy = row.y + row.bh * rr(0.3, 0.7);
        for (let k = 0; k < 7; k++) {
          const pts = crackPath(ccx + rr(-10, 10), ccy + rr(-6, 6), rr(0, 6.28), rr(8, 22), 2.5, (x, y) => x > bl.x + 2 && x < bl.x + bl.bw - 2 && y > row.y + 2 && y < row.y + row.bh - 2);
          strokeCrack(pts, 0.7);
        }
      }

      // ---- broken stone: sheared corners and one missing block, with debris on the floor
      const debrisAt = [];
      const breakCorner = (bl, row, corner) => {
        const right = corner === 1 || corner === 2, bottom = corner >= 2;
        const ox = right ? bl.x + bl.bw : bl.x, oy = bottom ? row.y + row.bh : row.y;
        const sx = right ? -1 : 1, sy = bottom ? -1 : 1;
        const ax = rr(18, Math.min(54, bl.bw * 0.45)), ay = rr(12, Math.min(36, row.bh * 0.75));
        const arc = [];
        for (let i = 0; i <= 10; i++) {
          const th = (i / 10) * Math.PI / 2, jit = 1 + rr(-0.18, 0.18);
          arc.push([ox + sx * ax * Math.cos(th) * jit, oy + sy * ay * Math.sin(th) * jit]);
        }
        c.save();
        c.beginPath(); c.moveTo(ox - sx * 3, oy - sy * 3);
        for (const p of arc) c.lineTo(p[0], p[1]);
        c.closePath(); c.clip();
        const g = c.createRadialGradient(ox, oy, 0, ox, oy, Math.max(ax, ay) * 1.1);
        g.addColorStop(0, '#060709'); g.addColorStop(1, col(10, 7));
        c.fillStyle = g; c.fillRect(ox - ax - 6, oy - ay - 6, ax * 2 + 12, ay * 2 + 12);
        for (let k = 0; k < 80; k++) {
          c.fillStyle = rnd() < 0.35 ? 'rgba(200,212,230,' + rr(0.03, 0.09).toFixed(3) + ')' : 'rgba(0,0,0,' + rr(0.15, 0.4).toFixed(3) + ')';
          c.fillRect(ox + sx * rr(0, ax), oy + sy * rr(0, ay), rr(0.8, 2.2), rr(0.8, 2.2));
        }
        c.restore();
        c.lineCap = 'round';
        c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.6;
        c.beginPath(); arc.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
        c.strokeStyle = 'rgba(214,226,242,.11)'; c.lineWidth = 1;
        c.beginPath(); arc.forEach((p, i) => i ? c.lineTo(p[0] + sx * 1.3, p[1] + sy * 1.3) : c.moveTo(p[0] + sx * 1.3, p[1] + sy * 1.3)); c.stroke();
        if (rnd() < 0.6) debrisAt.push(ox + sx * ax * 0.5);
      };
      for (let i = 0; i < 8; i++) {
        const pb = pickBlock(0, h - FLOOR - 50); if (!pb) continue;
        breakCorner(pb.bl, pb.row, Math.floor(rr(0, 4)));
      }
      {
        let pb = null;
        for (let t = 0; t < 30 && !pb; t++) { const q = pickBlock(h * 0.12, h * 0.42); if (q && q.bl.bw < 150 && (q.bl.x < cx - R_OUT - 60 || q.bl.x > cx + R_OUT + 60)) pb = q; }
        if (pb) {
          const { row, bl } = pb, x0 = bl.x - 1, y0 = row.y - 1, bw = bl.bw + 2, bh = row.bh + 2;
          const edge = [];
          const push = (x, y) => edge.push([x + rr(-2.2, 2.2), y + rr(-2.2, 2.2)]);
          for (let x = x0; x < x0 + bw; x += 8) push(x, y0);
          for (let y = y0; y < y0 + bh; y += 8) push(x0 + bw, y);
          for (let x = x0 + bw; x > x0; x -= 8) push(x, y0 + bh);
          for (let y = y0 + bh; y > y0; y -= 8) push(x0, y);
          c.save();
          c.beginPath(); edge.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.clip();
          c.fillStyle = '#030304'; c.fillRect(x0 - 4, y0 - 4, bw + 8, bh + 8);
          const back = c.createRadialGradient(x0 + bw * 0.5, y0 + bh * 0.7, 0, x0 + bw * 0.5, y0 + bh * 0.6, bw * 0.6);
          back.addColorStop(0, 'rgba(40,46,56,.35)'); back.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = back; c.fillRect(x0, y0, bw, bh);
          const top = c.createLinearGradient(0, y0, 0, y0 + 14);
          top.addColorStop(0, 'rgba(0,0,0,.95)'); top.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = top; c.fillRect(x0, y0, bw, 14);
          c.fillStyle = col(13, 8); c.fillRect(x0, y0 + bh - 6, bw, 6);
          c.fillStyle = 'rgba(214,226,242,.07)'; c.fillRect(x0, y0 + bh - 6, bw, 1.2);
          for (let k = 0; k < 5; k++) {
            const rx = x0 + rr(8, bw - 8), ry = y0 + bh - 6 - rr(1, 4), rs = rr(3, 7);
            c.fillStyle = col(rr(11, 15), 7);
            c.beginPath(); for (let q = 0; q < 6; q++) { const aa = q / 6 * 6.28; c.lineTo(rx + Math.cos(aa) * rs * rr(0.6, 1), ry + Math.sin(aa) * rs * rr(0.4, 0.7)); } c.closePath(); c.fill();
          }
          c.restore();
          c.strokeStyle = 'rgba(214,226,242,.1)'; c.lineWidth = 1;
          c.beginPath(); edge.forEach((p, i) => i ? c.lineTo(p[0], p[1] + 1.2) : c.moveTo(p[0], p[1] + 1.2)); c.closePath(); c.stroke();
          debrisAt.push(x0 + bw * 0.4, x0 + bw * 0.7);
        }
      }
      const debris = (x, y, sz) => {
        c.fillStyle = 'rgba(0,0,0,.55)';
        c.beginPath(); c.ellipse(x + sz * 0.25, y + sz * 0.3, sz * 1.15, sz * 0.32, 0, 0, 6.2832); c.fill();
        const pts = [];
        for (let q = 0; q < 7; q++) { const aa = q / 7 * 6.28 + rr(-0.2, 0.2); pts.push([x + Math.cos(aa) * sz * rr(0.65, 1.05), y + Math.sin(aa) * sz * rr(0.45, 0.72)]); }
        c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
        const g = c.createLinearGradient(x - sz, y - sz, x + sz, y + sz);
        g.addColorStop(0, col(rr(17, 21), 8)); g.addColorStop(1, col(rr(7, 10), 8));
        c.fillStyle = g; c.fill();
        c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 0.8; c.stroke();
      };
      const floorTop = h - FLOOR;
      for (const dx of debrisAt) for (let k = 0; k < 2; k++) debris(dx + rr(-40, 40), floorTop + rr(10, 36), rr(3, 8));
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) debris(cx + side * (PX + rr(-60, 60)), floorTop + rr(12, 40), rr(2.5, 7));

      // ---- moss: stippled cushions from a noise mask, in wet joints and low on the wall
      let mLit = 0;
      const mossDot = (x, y, m) => {
        // the pillars stand in front of the wall: wall/arch moss never paints over their shafts
        if (!bg.door && y > capY + CAPH - 1 && y < floorTop - 1 && Math.abs(Math.abs(x - cx) - PX) < PW / 2 + 3) return;
        if (m > 0.45 && rnd() < 0.25) { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 1, y + 2.4, 1.8, 1.8); }
        const hue = 70 + fbm(x * 0.015 + 40, y * 0.015) * 60;
        const lig = 9 + m * 16 + mLit * 10 + (rnd() < 0.12 ? 8 : 0);
        c.fillStyle = 'hsla(' + hue.toFixed(0) + ',' + (26 + m * 24).toFixed(0) + '%,' + lig.toFixed(1) + '%,' + (0.5 + m * 0.45).toFixed(2) + ')';
        const s2 = rr(0.8, 1.6) + m * 0.9;
        c.fillRect(x + rr(-0.9, 0.9), y + rr(-0.9, 0.9), s2, s2);
      };
      const stipple = (x0, y0, x1, y1, fn) => {
        for (let y = y0; y < y1; y += 1.5) for (let x = x0; x < x1; x += 1.5) {
          const m = fn(x, y);
          if (!(m > 0.02) || rnd() > m * 1.1) continue;
          mossDot(x, y, Math.min(1, m));
        }
      };
      // wall-floor junction: irregular mounds climbing the wall, spilling onto the flagstones
      stipple(0, floorTop - 70, w, floorTop + 14, (x, y) => {
        if (inOpening(x, y, -1)) return 0;
        let cov = sstep(0.36, 0.6, fbm(x * 0.011, 3.1));
        if (!cov) return 0;
        if (y > floorTop && Math.abs(x - cx) < R_IN - 10) cov *= 0.2;
        const ht = 6 + 56 * Math.pow(fbm(x * 0.021 + 11, 5.7), 1.6) * cov, d = floorTop - y;
        if (d < -12 || d > ht) return 0;
        mLit = d > ht * 0.55 ? 0.7 : 0.15;
        const edge = d < 0 ? 1 + d / 12 : 1 - Math.pow(d / ht, 1.4);
        return cov * edge * sstep(0.28, 0.52, fbm(x * 0.06, y * 0.06));
      });
      // bed joints on the lower wall, wetter toward the ground
      for (const row of rows) {
        const by = jointY(row);
        if (by < h * 0.3 || by > floorTop - 12) continue;
        const wet = sstep(h * 0.28, floorTop, by);
        stipple(0, by - 10, w, by + 10, (x, y) => {
          if (!plainWall(x, y, 0)) return 0;
          const cov = sstep(0.5, 0.72, fbm(x * 0.014 + by * 0.05, by * 0.03)) * wet;
          if (!cov) return 0;
          const th = 1.5 + 7 * fbm(x * 0.05, by * 0.1) * cov, dy = y - by;
          if (Math.abs(dy) > th) return 0;
          mLit = dy < -th * 0.3 ? 0.7 : 0.15;
          return cov * (1 - Math.pow(Math.abs(dy) / th, 2)) * sstep(0.25, 0.5, fbm(x * 0.08, y * 0.08));
        });
        // a few head joints fill in below a mossy bed joint
        for (const bl of row.blocks) {
          const hx = bl.x + bl.bw + 2.4;
          if (!plainWall(hx, row.y + row.bh / 2, 4) || fbm(hx * 0.014 + by * 0.05, by * 0.03) < 0.62 || rnd() > 0.5 * wet + 0.1) continue;
          stipple(hx - 5, row.y, hx + 5, by, (x, y) => {
            const th = 1.2 + 2.6 * fbm(y * 0.08, hx), dx = Math.abs(x - hx);
            if (dx > th) return 0;
            mLit = 0.2;
            return (1 - dx / th) * sstep(row.y, by, y) * 0.9;
          });
        }
      }
      // cushions on the pillar caps, around the foot of each bowl, dripping over the front edge
      if (!bg.door) for (const side of [-1, 1]) {
        const px = cx + side * PX;
        stipple(px - CAPW / 2 - 2, capY - 12, px + CAPW / 2 + 2, capY + CAPH + 16, (x, y) => {
          if (Math.abs(x - px) > CAPW / 2) return 0;
          const cov = sstep(0.3, 0.55, fbm(x * 0.05 + side * 9, 2));
          const th = 4 + 8 * fbm(x * 0.09, 4), drip = 3 + 14 * Math.pow(fbm(x * 0.12, 9 + side), 3), dy = y - capY;
          if (dy < -th || dy > drip) return 0;
          if (Math.abs(x - px) < 21 && dy < 0) return 0;
          mLit = dy < 0 ? 0.85 : 0.2;
          return cov * (dy < 0 ? 1 + dy / th : 1 - dy / drip);
        });
      }
      // the seam where the arch meets the wall, where water seeps
      stipple(cx - R_OUT - 12, springY - R_OUT - 12, cx + R_OUT + 12, springY, (x, y) => {
        const dr = Math.hypot(x - cx, y - springY) - R_OUT;
        if (Math.abs(dr) > 10) return 0;
        const an = Math.atan2(y - springY, x - cx);
        const cov = sstep(0.5, 0.7, fbm(an * 6 + 20, 1.3));
        if (!cov) return 0;
        const th = 2 + 7 * fbm(an * 20, 3);
        if (Math.abs(dr) > th) return 0;
        mLit = dr < 0 ? 0.25 : 0.7;
        return cov * (1 - Math.abs(dr) / th);
      });

      // ---- ivy: lobed leaves on woody stems, massed — a cascade over each haunch, a curtain from the top, a climber from the floor
      const leaves = [], stems = [], ivyBoxes = [];
      const brX = [cx - PX, cx + PX], brY = capY - BOWLH - 12;
      const addLeaf = (sx0, sy0, x, y, sz, an) => {
        const d = Math.min(Math.hypot(x - brX[0], y - brY), Math.hypot(x - brX[1], y - brY));
        const warm = Math.pow(Math.max(0, 1 - d / 420), 1.5), old = rnd() < 0.07;
        leaves.push({ sx0, sy0, x, y, s: sz * 1.55, a: an,
          hue: old ? rr(36, 56) : rr(92, 128) - warm * 34,
          sat: old ? rr(22, 34) : rr(24, 44),
          lig: rr(14, 23) + warm * 16 + (old ? 3 : 0) });
      };
      const hangStrand = (x, y, len, sway) => {
        const pts = [[x, y]], ph = rr(0, 6), n = Math.round(len / 6);
        let vx = x, vy = y;
        for (let i = 1; i <= n; i++) { const t = i / n; vx += Math.sin(ph + t * 3.4) * 0.7 * sway + sway * 0.5 * t; vy += 6; pts.push([vx, vy]); }
        stems.push({ pts, w0: rr(1.8, 2.6) });
        let x0 = x, x1 = x, y1 = y;
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y1 = p[1];
          if (i % 2 === 0 && rnd() > 0.35) continue;
          const t = i / pts.length, side = i % 4 < 2 ? 1 : -1, sz = (10.5 - t * 5.5) * rr(0.8, 1.15);
          addLeaf(p[0], p[1], p[0] + side * rr(4, 8), p[1] + rr(-1, 3), sz, Math.PI - side * rr(0.5, 1.1));
        }
        ivyBoxes.push({ x0: x0 - 12, x1: x1 + 12, y0: y - 12, y1: y1 + 12 });
      };
      const clump = (x, y, rx, ry, count) => {
        for (let k = 0; k < 5; k++) {
          const pts = []; let px = x - rx * rr(0.6, 1), py = y + rr(-ry, ry) * 0.6;
          const ex = x + rx * rr(0.6, 1), ey = y + rr(-ry, ry) * 0.6, n = 18;
          for (let i = 0; i <= n; i++) { const t = i / n; pts.push([px + (ex - px) * t, py + (ey - py) * t + Math.sin(t * 3.14 + k) * ry * 0.35]); }
          stems.push({ pts, w0: rr(1.8, 2.8) });
        }
        for (let i = 0; i < count; i++) {
          const an = rr(0, 6.28), r = Math.sqrt(rnd());
          const lx = x + Math.cos(an) * rx * r, ly = y + Math.sin(an) * ry * r;
          addLeaf(lx, ly, lx + rr(-3, 3), ly + rr(-3, 3), rr(7, 12.5) * (1 - r * 0.3), rr(-1.3, 1.3) + (ly > y + ry * 0.3 ? Math.PI * (rnd() < 0.5 ? 0.7 : -0.7) : 0));
        }
        ivyBoxes.push({ x0: x - rx - 14, x1: x + rx + 14, y0: y - ry - 14, y1: y + ry + 14 });
      };
      const climb = (x, y, len, ang, w0, depth) => {
        const pts = [[x, y]], sd2 = rr(0, 40);
        for (let d = 0; d < len; d += 6) {
          const an = ang + (vn(sd2 + d * 0.02, 2.2) - 0.5) * 1.4;
          x += Math.cos(an) * 6; y += Math.sin(an) * 6;
          if (!plainWall(x, y, -6)) break;
          pts.push([x, y]);
        }
        if (pts.length < 3) return;
        stems.push({ pts, w0 });
        pts.forEach((p, i) => {
          if (i % 2 || rnd() > 0.92) return;
          const side = (i / 2) % 2 ? 1 : -1, t = i / pts.length;
          addLeaf(p[0], p[1], p[0] + side * rr(3, 7), p[1] + rr(-3, 3), rr(7, 12) * (1 - t * 0.35), side * rr(0.5, 1.4) + rr(-0.2, 0.2));
        });
        if (depth > 0) for (let k = 0; k < 3; k++) {
          const p = pts[Math.floor(rr(0.15, 0.85) * pts.length)];
          if (p) climb(p[0], p[1], len * rr(0.3, 0.55), ang + (rnd() < 0.5 ? -1 : 1) * rr(0.5, 1.0), w0 * 0.6, depth - 1);
        }
      };
      // curtain from the top edge, right of the arch
      {
        const x0 = Math.min(w - 60, cx + R_OUT + 120);
        clump(x0 + 120, 8, 170, 34, 170);
        for (let k = 0; k < 14; k++) hangStrand(x0 + rr(-30, 270), rr(0, 30), rr(80, 320), rr(-0.6, 0.6));
      }
      // climber from the floor, left wall
      climb(Math.max(60, cx - PX - 150), floorTop, 460, -Math.PI / 2 + rr(-0.15, 0.15), 4.2, 2);
      climb(Math.max(40, cx - PX - 240), floorTop, 300, -Math.PI / 2 + rr(-0.3, 0.1), 3.2, 1);

      const leafPath = (sz) => {
        c.beginPath();
        c.moveTo(0, 0.08 * sz);
        c.quadraticCurveTo(0.5 * sz, 0.32 * sz, 0.6 * sz, 0.1 * sz);
        c.quadraticCurveTo(0.28 * sz, -0.08 * sz, 0.6 * sz, -0.5 * sz);
        c.quadraticCurveTo(0.2 * sz, -0.46 * sz, 0, -sz);
        c.quadraticCurveTo(-0.2 * sz, -0.46 * sz, -0.6 * sz, -0.5 * sz);
        c.quadraticCurveTo(-0.28 * sz, -0.08 * sz, -0.6 * sz, 0.1 * sz);
        c.quadraticCurveTo(-0.5 * sz, 0.32 * sz, 0, 0.08 * sz);
        c.closePath();
      };
      const drawStem = (S, shadow) => {
        const n = S.pts.length, o = shadow ? 2.4 : 0;
        c.lineCap = 'round';
        for (let i = 1; i < n; i++) {
          c.strokeStyle = shadow ? 'rgba(0,0,0,.5)' : 'hsl(30,14%,12%)';
          c.lineWidth = Math.max(0.6, S.w0 * (1 - (i / n) * 0.6));
          c.beginPath(); c.moveTo(S.pts[i - 1][0] + o, S.pts[i - 1][1] + o * 1.4); c.lineTo(S.pts[i][0] + o, S.pts[i][1] + o * 1.4); c.stroke();
        }
      };
      // pass 1: soft shadows cast on the stone
      shadowBegin(); c.save();
      for (const S of stems) drawStem(S, true);
      for (const L of leaves) { c.save(); c.translate(L.x + L.s * 0.25, L.y + L.s * 0.4); c.rotate(L.a); leafPath(L.s); c.fillStyle = 'rgba(0,0,0,.5)'; c.fill(); c.restore(); }
      c.restore(); shadowEnd(2);
      // pass 2: stems, petioles, leaves
      for (const S of stems) drawStem(S, false);
      for (const L of leaves) {
        c.strokeStyle = 'hsl(80,20%,' + (L.lig * 0.7).toFixed(0) + '%)'; c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(L.sx0, L.sy0); c.lineTo(L.x, L.y); c.stroke();
        c.save(); c.translate(L.x, L.y); c.rotate(L.a);
        leafPath(L.s);
        const g = c.createLinearGradient(-L.s * 0.6, -L.s, L.s * 0.6, L.s * 0.3);
        g.addColorStop(0, 'hsl(' + L.hue.toFixed(0) + ',' + L.sat.toFixed(0) + '%,' + (L.lig + 7).toFixed(1) + '%)');
        g.addColorStop(1, 'hsl(' + (L.hue + 8).toFixed(0) + ',' + Math.max(10, L.sat - 6).toFixed(0) + '%,' + Math.max(4, L.lig - 5).toFixed(1) + '%)');
        c.fillStyle = g; c.fill();
        c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 0.6; c.stroke();
        c.strokeStyle = 'hsla(' + (L.hue - 24).toFixed(0) + ',28%,' + (L.lig + 18).toFixed(0) + '%,.32)';
        c.lineWidth = Math.max(0.4, L.s * 0.05);
        c.beginPath();
        c.moveTo(0, 0.05 * L.s); c.lineTo(0, -0.85 * L.s);
        c.moveTo(0, 0); c.lineTo(0.48 * L.s, -0.42 * L.s);
        c.moveTo(0, 0); c.lineTo(-0.48 * L.s, -0.42 * L.s);
        c.moveTo(0, 0.02 * L.s); c.lineTo(0.46 * L.s, 0.06 * L.s);
        c.moveTo(0, 0.02 * L.s); c.lineTo(-0.46 * L.s, 0.06 * L.s);
        c.stroke();
        c.restore();
      }
      bg._ivyBoxes = ivyBoxes;

      // ---- around the door: thorned bramble, roots hanging from the dark, pale fungus
      const portalPt = (d, r, side) => {
        const vert = floorTop - springY;
        if (d < vert) return [cx + side * r, floorTop - d];
        const an = (d - vert) / r, a2 = side < 0 ? Math.PI + an : 2 * Math.PI - an;
        return [cx + Math.cos(a2) * r, springY + Math.sin(a2) * r];
      };
      const inkStem = (pts, w0, core, rim, taper) => {
        const n = pts.length; if (n < 2) return;
        c.lineCap = 'round'; c.lineJoin = 'round';
        const wAt = (i) => Math.max(0.5, w0 * (1 - (i / n) * (taper == null ? 0.65 : taper)));
        shadowBegin(); c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = 'rgba(0,0,0,.6)';
        for (let i = 1; i < n; i++) { c.lineWidth = wAt(i) + 1.2; c.beginPath(); c.moveTo(pts[i - 1][0] + 2, pts[i - 1][1] + 3); c.lineTo(pts[i][0] + 2, pts[i][1] + 3); c.stroke(); }
        c.restore(); shadowEnd(1.6);
        for (let i = 1; i < n; i++) { c.strokeStyle = core; c.lineWidth = wAt(i); c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
        for (let i = 1; i < n; i++) { const wd = wAt(i); c.strokeStyle = rim; c.lineWidth = Math.max(0.35, wd * 0.28); c.beginPath(); c.moveTo(pts[i - 1][0] - wd * 0.28, pts[i - 1][1] - wd * 0.3); c.lineTo(pts[i][0] - wd * 0.28, pts[i][1] - wd * 0.3); c.stroke(); }
        return wAt;
      };
      const thorns = (pts, wAt, density) => {
        for (let i = 2; i < pts.length - 1; i++) {
          if (rnd() > density) continue;
          const p = pts[i], q = pts[i + 1], ta = Math.atan2(q[1] - p[1], q[0] - p[0]), side = rnd() < 0.5 ? 1 : -1;
          const wd = wAt(i), L = wd * rr(1.4, 2.4) + 2.2, tipA = ta + side * rr(1.95, 2.35);
          const nx = Math.cos(ta + side * Math.PI / 2) * wd * 0.42, ny = Math.sin(ta + side * Math.PI / 2) * wd * 0.42;
          const ux = Math.cos(ta) * (wd * 0.8 + 0.8), uy = Math.sin(ta) * (wd * 0.8 + 0.8);
          c.fillStyle = 'hsl(335,12%,7%)';
          c.beginPath(); c.moveTo(p[0] + ux + nx, p[1] + uy + ny); c.lineTo(p[0] + nx + Math.cos(tipA) * L, p[1] + ny + Math.sin(tipA) * L); c.lineTo(p[0] - ux + nx, p[1] - uy + ny); c.closePath(); c.fill();
          c.strokeStyle = 'hsla(20,14%,30%,.4)'; c.lineWidth = 0.5;
          c.beginPath(); c.moveTo(p[0] + ux + nx, p[1] + uy + ny); c.lineTo(p[0] + nx + Math.cos(tipA) * L, p[1] + ny + Math.sin(tipA) * L); c.stroke();
        }
      };
      const curl = (x, y, ang, len, dir) => {
        const pts = [[x, y]]; let an = ang, stepL = 2.2, k = 0.035;
        for (let d = 0; d < len; d += stepL) { an += dir * k; k *= 1.045; x += Math.cos(an) * stepL; y += Math.sin(an) * stepL; pts.push([x, y]); }
        inkStem(pts, 1.3, 'hsl(335,10%,9%)', 'hsla(20,14%,28%,.45)', 0.7);
      };
      const deadLeaf = (x, y, sz, an) => {
        c.save(); c.translate(x, y); c.rotate(an);
        c.fillStyle = 'hsl(' + rr(18, 34).toFixed(0) + ',' + rr(18, 30).toFixed(0) + '%,' + rr(9, 15).toFixed(0) + '%)';
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sz * 0.55, -sz * 0.2, sz * 0.2, -sz); c.quadraticCurveTo(-sz * 0.1, -sz * 0.55, -sz * 0.35, -sz * 0.7); c.quadraticCurveTo(-sz * 0.3, -sz * 0.2, 0, 0); c.fill();
        c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 0.6; c.stroke();
        c.restore();
      };
      const flameY = capY - BOWLH - 40;
      const nearFlame = (x, y, pad) => {
        for (const fx of [cx - PX, cx + PX]) {
          const dx = (x - fx) / (70 + pad), dy = (y - flameY) / (y < flameY ? 190 + pad : 90 + pad);
          if (dx * dx + dy * dy < 1) return true;
        }
        return false;
      };
      // brambles: canes rooted at each jamb foot, following the portal band with smooth offsets;
      // the offset limit near each fire is itself smoothed so stems ease away instead of kinking
      const chaikin = (pts, it) => {
        let p = pts;
        for (let k = 0; k < it; k++) {
          const q = [p[0]];
          for (let i = 0; i < p.length - 1; i++) {
            const A = p[i], B = p[i + 1];
            q.push([A[0] * 0.75 + B[0] * 0.25, A[1] * 0.75 + B[1] * 0.25], [A[0] * 0.25 + B[0] * 0.75, A[1] * 0.25 + B[1] * 0.75]);
          }
          q.push(p[p.length - 1]); p = q;
        }
        return p;
      };
      const smooth1 = (arr, rad) => arr.map((_, i) => {
        let sum = 0, wsum = 0;
        for (let j = -rad; j <= rad; j++) {
          const v = arr[Math.max(0, Math.min(arr.length - 1, i + j))], wt = 1 - Math.abs(j) / (rad + 1);
          sum += v * wt; wsum += wt;
        }
        return sum / wsum;
      });
      const flameDist = (x, y) => Math.min(...[cx - PX, cx + PX].map(fx => {
        const dx = x - fx, dy = y - flameY;
        return Math.hypot(dx, dy < 0 ? dy * 0.45 : dy);
      }));
      const band = R_OUT - R_IN;
      const caneShadow = [], caneBody = [];
      const buildCane = (side, d0, d1, seed, wide) => {
        const STEP = 5, ds = [];
        for (let d = d0; d < d1; d += STEP) ds.push(d);
        if (ds.length < 6) return null;
        let off = ds.map(d => 0.5 + (fbm(d * 0.006 + seed, seed * 1.7) - 0.5) * 1.5 * wide);
        off = off.map(v => Math.max(0.04, Math.min(0.96, v)));
        // how far out may the cane sit at this point without nearing a flame?
        let lim = ds.map(d => {
          for (let f = 0.96; f >= 0; f -= 0.06) {
            const p = portalPt(d, R_IN + 3 + (band - 6) * f, side);
            if (flameDist(p[0], p[1]) > 118) return f;
          }
          return 0;
        });
        lim = smooth1(smooth1(lim, 14), 14);
        const pts = ds.map((d, i) => portalPt(d, R_IN + 3 + (band - 6) * Math.min(off[i], lim[i]), side));
        return chaikin(pts, 2);
      };
      const drawCane = (pts, w0, tone) => {
        const n = pts.length; if (n < 2) return null;
        const wAt = (i) => Math.max(0.55, w0 * (1 - Math.pow(i / n, 1.2) * 0.72));
        caneShadow.push({ pts, wAt });
        caneBody.push({ pts, wAt, tone });
        return wAt;
      };
      const thornList = [], tendrils = [];
      const addThorns = (pts, wAt, every) => {
        for (let i = 4; i < pts.length - 3; i += Math.max(3, Math.round(every * rr(0.7, 1.4)))) {
          const p = pts[i], q = pts[i + 2], ta = Math.atan2(q[1] - p[1], q[0] - p[0]);
          thornList.push({ x: p[0], y: p[1], ta, side: rnd() < 0.5 ? 1 : -1, wd: wAt(i) });
        }
      };
      // arching side cane: leaves the main cane at a shallow angle, bows out and curves back to the stone
      const sideCane = (pts, i, side, w0) => {
        const p = pts[i], q = pts[Math.min(pts.length - 1, i + 3)];
        let an = Math.atan2(q[1] - p[1], q[0] - p[0]), x = p[0], y = p[1];
        const dir = rnd() < 0.5 ? 1 : -1, len = rr(40, 90), k0 = rr(0.012, 0.02) * -dir;
        an += dir * rr(0.35, 0.6);
        const out = [[x, y]];
        for (let d = 0; d < len; d += 3) {
          an += k0 * 3;
          x += Math.cos(an) * 3; y += Math.sin(an) * 3;
          if (flameDist(x, y) < 110 || inOpening(x, y, 26) || !(outsidePortal(x, y, 16) === false || plainWall(x, y, -2))) break;
          out.push([x, y]);
        }
        if (out.length < 6) return;
        const wAt = drawCane(out, w0, 1);
        if (wAt) addThorns(out, wAt, 6);
        if (rnd() < 0.5) tendrils.push({ x: out[out.length - 1][0], y: out[out.length - 1][1], an, dir: -dir });
      };
      for (const side of []) {
        const vert = floorTop - springY, arcLen = Math.PI * R_IN;
        const canes = side < 0
          ? [[0, vert + arcLen * 0.30, 3.8, 0.9], [20, vert + arcLen * 0.18, 3.0, 1.1], [60, vert * 0.9, 2.4, 1.3]]
          : [[0, vert + arcLen * 0.42, 4.2, 0.9], [14, vert + arcLen * 0.30, 3.4, 1.0], [40, vert + arcLen * 0.12, 2.8, 1.2], [90, vert * 0.8, 2.2, 1.3]];
        canes.forEach(([d0, d1, w0, wide], ci) => {
          const pts = buildCane(side, d0, d1, side * 13 + ci * 5.3, wide);
          if (!pts) return;
          const wAt = drawCane(pts, w0, 0);
          addThorns(pts, wAt, 7);
          const nSide = Math.round(pts.length / 70);
          for (let k = 0; k < nSide; k++) {
            const i = Math.floor(rr(0.15, 0.8) * pts.length);
            if (flameDist(pts[i][0], pts[i][1]) > 150) sideCane(pts, i, side, wAt(i) * 0.6);
          }
          for (let i = 30; i < pts.length - 10; i += Math.round(rr(40, 80))) {
            if (flameDist(pts[i][0], pts[i][1]) < 150) continue;
            const q = pts[i + 2], an = Math.atan2(q[1] - pts[i][1], q[0] - pts[i][0]);
            tendrils.push({ x: pts[i][0], y: pts[i][1], an: an + (rnd() < 0.5 ? 1 : -1) * rr(0.4, 0.8), dir: rnd() < 0.5 ? 1 : -1 });
          }
        });
      }
      // render: soft shadow, body, lit rim, thorns, tendrils, a few withered leaves
      shadowBegin(); c.save(); c.strokeStyle = 'rgba(0,0,0,.62)'; c.lineCap = 'round'; c.lineJoin = 'round';
      for (const C of caneShadow) for (let i = 1; i < C.pts.length; i++) {
        c.lineWidth = C.wAt(i) + 1.4;
        c.beginPath(); c.moveTo(C.pts[i - 1][0] + 2.2, C.pts[i - 1][1] + 3.2); c.lineTo(C.pts[i][0] + 2.2, C.pts[i][1] + 3.2); c.stroke();
      }
      c.restore(); shadowEnd(1.8);
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const C of caneBody) {
        const n = C.pts.length;
        for (let i = 1; i < n; i++) {
          const t = i / n, l = C.tone === 2 ? 17 + t * 4 : C.tone ? 11 : 8 + t * 4;
          c.strokeStyle = 'hsl(' + (340 - t * 20).toFixed(0) + ',' + (C.tone === 2 ? 20 : 14 + t * 6).toFixed(0) + '%,' + l.toFixed(1) + '%)';
          c.lineWidth = C.wAt(i);
          c.beginPath(); c.moveTo(C.pts[i - 1][0], C.pts[i - 1][1]); c.lineTo(C.pts[i][0], C.pts[i][1]); c.stroke();
        }
        for (let i = 1; i < n; i++) {
          const wd = C.wAt(i);
          c.strokeStyle = C.tone === 2 ? 'hsla(14,26%,44%,.6)' : 'hsla(12,22%,34%,.42)'; c.lineWidth = Math.max(0.35, wd * (C.tone === 2 ? 0.3 : 0.24));
          c.beginPath(); c.moveTo(C.pts[i - 1][0] - wd * 0.26, C.pts[i - 1][1] - wd * 0.3); c.lineTo(C.pts[i][0] - wd * 0.26, C.pts[i][1] - wd * 0.3); c.stroke();
        }
      }
      for (const T of thornList) {
        const L = T.wd * rr(1.1, 1.8) + 2.4, base = T.wd * 0.55 + 0.9;
        const nx = Math.cos(T.ta + T.side * Math.PI / 2), ny = Math.sin(T.ta + T.side * Math.PI / 2);
        const bx = T.x + nx * T.wd * 0.4, by = T.y + ny * T.wd * 0.4;
        const tipA = T.ta + T.side * Math.PI / 2 - T.side * 0.0 + Math.PI * 0.62 * -1 * 0 ;
        // hooked backward: tip leans against growth direction
        const tx = bx + nx * L - Math.cos(T.ta) * L * 0.7, ty = by + ny * L - Math.sin(T.ta) * L * 0.7;
        c.fillStyle = 'hsl(338,14%,8%)';
        c.beginPath();
        c.moveTo(bx + Math.cos(T.ta) * base, by + Math.sin(T.ta) * base);
        c.quadraticCurveTo(bx + nx * L * 0.55, by + ny * L * 0.55, tx, ty);
        c.lineTo(bx - Math.cos(T.ta) * base * 0.6, by - Math.sin(T.ta) * base * 0.6);
        c.closePath(); c.fill();
        c.strokeStyle = 'hsla(14,22%,36%,.38)'; c.lineWidth = 0.5;
        c.beginPath(); c.moveTo(bx + Math.cos(T.ta) * base, by + Math.sin(T.ta) * base); c.quadraticCurveTo(bx + nx * L * 0.55, by + ny * L * 0.55, tx, ty); c.stroke();
      }
      for (const Td of tendrils) {
        let x = Td.x, y = Td.y, an = Td.an, k = 0.03;
        const pts = [[x, y]];
        for (let d = 0; d < rr(26, 44); d += 1.8) { an += Td.dir * k; k *= 1.05; x += Math.cos(an) * 1.8; y += Math.sin(an) * 1.8; pts.push([x, y]); }
        c.strokeStyle = 'hsl(345,12%,11%)'; c.lineWidth = 1.1;
        c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
        c.strokeStyle = 'hsla(14,20%,34%,.35)'; c.lineWidth = 0.4;
        c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0] - 0.4, p[1] - 0.4) : c.moveTo(p[0] - 0.4, p[1] - 0.4)); c.stroke();
      }
      for (const C of caneBody) {
        if (C.tone) continue;
        for (let i = 40; i < C.pts.length - 20; i += Math.round(rr(60, 120))) {
          const p = C.pts[i]; if (flameDist(p[0], p[1]) < 150) continue;
          const q = C.pts[i + 2], ta = Math.atan2(q[1] - p[1], q[0] - p[0]), dir = rnd() < 0.5 ? 1 : -1, sz = rr(6, 10);
          c.save(); c.translate(p[0], p[1]); c.rotate(ta + dir * rr(0.9, 1.4));
          c.strokeStyle = 'hsl(24,16%,12%)'; c.lineWidth = 0.7;
          c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -sz * 0.35); c.stroke();
          c.translate(0, -sz * 0.35);
          c.fillStyle = 'hsl(' + rr(18, 32).toFixed(0) + ',' + rr(22, 32).toFixed(0) + '%,' + rr(11, 16).toFixed(0) + '%)';
          c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sz * 0.45, -sz * 0.35, sz * 0.12, -sz); c.quadraticCurveTo(-sz * 0.05, -sz * 0.6, -sz * 0.38, -sz * 0.62); c.quadraticCurveTo(-sz * 0.32, -sz * 0.2, 0, 0); c.fill();
          c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 0.5; c.stroke();
          c.restore();
        }
      }
      // roots hanging from the soffit into the dark — short at the crown so the title stays clear
      const rootBoxes = [];
      const hangRoot = (x, y, len, w0, depth) => {
        const pts = [[x, y]], sd2 = rr(0, 40);
        let an = Math.PI / 2 + rr(-0.25, 0.25);
        for (let d = 0; d < len; d += 3.5) {
          an = Math.PI / 2 + (vn(sd2 + d * 0.03, 4.4) - 0.5) * 1.1;
          x += Math.cos(an) * 3.5; y += Math.sin(an) * 3.5; pts.push([x, y]);
        }
        inkStem(pts, w0, 'hsl(28,14%,6%)', 'hsla(30,18%,30%,.55)', 0.9);
        rootBoxes.push({ x0: Math.min(...pts.map(p => p[0])) - 10, x1: Math.max(...pts.map(p => p[0])) + 10, y0: pts[0][1] - 6, y1: pts[pts.length - 1][1] + 10 });
        if (depth > 0) for (let q = 0; q < 2; q++) {
          const p = pts[Math.floor(rr(0.2, 0.7) * pts.length)];
          if (p) hangRoot(p[0], p[1], len * rr(0.3, 0.55), w0 * 0.5, depth - 1);
        }
        // a few hair-thin rootlets at the tip
        const tip = pts[pts.length - 1];
        for (let q = 0; q < 3; q++) {
          const rl = [[tip[0], tip[1]]]; let rx = tip[0], ry = tip[1];
          for (let d = 0; d < rr(8, 20); d += 2) { rx += rr(-1.2, 1.2); ry += 2; rl.push([rx, ry]); }
          c.strokeStyle = 'hsla(30,14%,24%,.5)'; c.lineWidth = 0.5;
          c.beginPath(); rl.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
        }
      };
      for (let i = 0; i < 11; i++) {
        const an = rr(4.05, 5.37), x = cx + Math.cos(an) * (R_IN - 1), y = springY + Math.sin(an) * (R_IN - 1);
        const nearTitle = Math.abs(x - cx) < 230;
        const len = nearTitle ? Math.max(12, Math.min(rr(20, 60), 250 - y)) : rr(50, 190);
        hangRoot(x, y, len, rr(2, 4.2), nearTitle ? 0 : 1);
      }
      // pale fungus: clusters at the foot of each jamb, bracket shelves up the jambs
      const shrooms = [];
      const mushCluster = (x, y, n, scale) => {
        const caps = [];
        for (let k = 0; k < n; k++) {
          const hgt = rr(6, 22) * scale * (k === 0 ? 1.3 : 1), lean = rr(-0.35, 0.35), bx = x + rr(-10, 10) * scale;
          caps.push({ bx, by: y, tx: bx + Math.sin(lean) * hgt, ty: y - hgt, cw: rr(4, 10) * scale * (k === 0 ? 1.4 : 1) });
        }
        caps.sort((p, q) => q.ty - p.ty);
        c.fillStyle = 'rgba(0,0,0,.5)';
        c.beginPath(); c.ellipse(x + 3, y + 1.5, 14 * scale, 3.5 * scale, 0, 0, 6.2832); c.fill();
        for (const m of caps) {
          c.strokeStyle = 'hsl(60,10%,58%)'; c.lineWidth = Math.max(1, m.cw * 0.22); c.lineCap = 'round';
          c.beginPath(); c.moveTo(m.bx, m.by); c.quadraticCurveTo(m.bx, (m.by + m.ty) / 2, m.tx, m.ty); c.stroke();
          c.fillStyle = 'rgba(20,24,20,.6)';
          c.beginPath(); c.ellipse(m.tx, m.ty + 0.6, m.cw, m.cw * 0.22, 0, 0, 6.2832); c.fill();
          const g = c.createLinearGradient(m.tx, m.ty - m.cw * 0.8, m.tx, m.ty);
          g.addColorStop(0, 'hsl(' + rr(62, 84).toFixed(0) + ',24%,' + rr(70, 80).toFixed(0) + '%)');
          g.addColorStop(1, 'hsl(80,14%,40%)');
          c.fillStyle = g;
          c.beginPath(); c.ellipse(m.tx, m.ty, m.cw, m.cw * 0.72, 0, Math.PI, 2 * Math.PI); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 0.6; c.stroke();
          for (let q = 0; q < 3; q++) { c.fillStyle = 'rgba(40,46,36,.5)'; c.beginPath(); c.arc(m.tx + rr(-m.cw * 0.6, m.cw * 0.6), m.ty - rr(m.cw * 0.15, m.cw * 0.5), rr(0.5, 1.1), 0, 6.2832); c.fill(); }
          shrooms.push({ x: m.tx, y: m.ty - m.cw * 0.3, r: m.cw * 3.2, ph: rr(0, 6.28) });
        }
      };
      const bracket = (x, y, n, dir) => {
        for (let k = 0; k < n; k++) {
          const bw = rr(12, 26) * (1 - k * 0.15), bh = bw * rr(0.32, 0.42), yy = y + k * rr(9, 14), xx = x + dir * rr(-2, 4);
          c.fillStyle = 'rgba(0,0,0,.55)';
          c.beginPath(); c.ellipse(xx + dir * bw * 0.35, yy + bh * 0.9, bw * 0.55, bh * 0.45, 0, 0, 6.2832); c.fill();
          const g = c.createLinearGradient(xx, yy - bh, xx, yy + bh * 0.3);
          g.addColorStop(0, 'hsl(' + rr(40, 58).toFixed(0) + ',18%,' + rr(56, 66).toFixed(0) + '%)');
          g.addColorStop(0.6, 'hsl(35,14%,34%)'); g.addColorStop(1, 'hsl(30,12%,16%)');
          c.fillStyle = g;
          c.beginPath(); c.ellipse(xx + dir * bw * 0.35, yy, bw * 0.55, bh, 0, Math.PI, 2 * Math.PI); c.lineTo(xx + dir * bw * 0.9, yy + bh * 0.25); c.lineTo(xx - dir * bw * 0.2, yy + bh * 0.25); c.closePath(); c.fill();
          c.strokeStyle = 'hsla(50,20%,74%,.35)'; c.lineWidth = 0.6;
          for (let q = 1; q <= 2; q++) { c.beginPath(); c.ellipse(xx + dir * bw * 0.35, yy, bw * 0.55 * (1 - q * 0.22), bh * (1 - q * 0.3), 0, Math.PI, 2 * Math.PI); c.stroke(); }
          shrooms.push({ x: xx + dir * bw * 0.35, y: yy - bh * 0.3, r: bw * 1.6, ph: rr(0, 6.28) });
        }
      };
      for (const side of [-1, 1]) {
        mushCluster(cx + side * (R_IN + rr(8, 22)), floorTop - 1, Math.round(rr(5, 7)), 1.1);
        mushCluster(cx + side * (R_OUT + rr(6, 26)), floorTop - 1, Math.round(rr(3, 4)), 0.8);
        bracket(cx + side * (R_IN + 2), springY + rr(40, 90), Math.round(rr(2, 3)), side);
      }
      if (!bg.door) mushCluster(cx + PX + rr(-20, 20), floorTop - 1, 3, 0.7);
      bg._shrooms = shrooms;
      bg._ivyBoxes = ivyBoxes.concat(rootBoxes);

      // ---- global grain (fine + coarse), keeps the stone from reading as vector
      const N = 160, nc = document.createElement('canvas'); nc.width = N; nc.height = N;
      const nx = nc.getContext('2d'), id = nx.createImageData(N, N), dd = id.data;
      for (let i = 0; i < dd.length; i += 4) {
        const v = 90 + Math.floor(rnd() * 90);
        dd[i] = dd[i + 1] = dd[i + 2] = v; dd[i + 3] = 26;
      }
      nx.putImageData(id, 0, 0);
      c.globalCompositeOperation = 'overlay';
      for (const sc of [1, 2.6]) {
        c.globalAlpha = sc === 1 ? 0.5 : 0.32;
        for (let y = 0; y < h; y += N * sc) for (let x = 0; x < w; x += N * sc) c.drawImage(nc, x, y, N * sc, N * sc);
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';

      // ---- ambient occlusion: corners and the deep bottom
      const vg = c.createRadialGradient(cx, h * 0.5, Math.min(w, h) * 0.28, cx, h * 0.5, Math.max(w, h) * 0.78);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,3,5,.72)');
      c.fillStyle = vg; c.fillRect(0, 0, w, h);
    }

    function drawEyes(t, dt) {
      const cv = bg.eyesCv;
      if (!cv || !cv.clientWidth) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv !== bg._eyesCv || cv.width !== Math.round(w * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        bg._eyesCv = cv; bg._eyes = []; bg._eyeNext = t + 1400;
      }
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      if (bg._shrooms) {
        c.globalCompositeOperation = 'lighter';
        for (const m of bg._shrooms) {
          const al = 0.05 + 0.045 * (0.5 + 0.5 * Math.sin(t * 0.0009 + m.ph));
          const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
          g.addColorStop(0, 'rgba(170,236,196,' + al.toFixed(3) + ')');
          g.addColorStop(1, 'rgba(120,200,160,0)');
          c.fillStyle = g; c.beginPath(); c.arc(m.x, m.y, m.r, 0, 6.2832); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
      }

      const FLOOR = 132, R_OUT = 494, R_IN = 442, AH = 668;
      const cx = w / 2, springY = h - FLOOR - (AH - R_OUT);
      const inside = (x, y, pad) => {
        if (y > h - FLOOR - pad || Math.abs(x - cx) > R_IN - pad) return false;
        if (y >= springY) return true;
        return Math.hypot(x - cx, y - springY) < R_IN - pad;
      };
      // keep clear of the title + menu column
      const clearOfUI = (x, y) => !(x > cx - 270 && x < cx + 270 && y > 230 && y < 720) && (bg.door || !(y > 250 && y < 470 && Math.abs(x - cx) < 520));
      const kinds = [
        { core: [255, 214, 120], glow: [236, 150, 50], r: 4.2, sep: 17, slit: true, w: 3 },   // amber, cat-like
        { core: [200, 255, 150], glow: [110, 190, 70], r: 3.4, sep: 13, slit: false, w: 3 },  // sickly green, small
        { core: [255, 150, 120], glow: [210, 50, 36], r: 5.6, sep: 30, slit: true, w: 1 },    // red, large
        { core: [230, 236, 255], glow: [130, 150, 220], r: 3, sep: 11, slit: false, w: 1 },   // pale, tiny
      ];
      const pickKind = () => { const tot = kinds.reduce((a, k) => a + k.w, 0); let r = Math.random() * tot; for (const k of kinds) { r -= k.w; if (r <= 0) return k; } return kinds[0]; };

      const E = bg._eyes || (bg._eyes = []);
      const JD = bg.door ? bg._judas : null;
      if (bg.door ? JD && t > (bg._eyeNext || 0) && E.length < 1 : t > (bg._eyeNext || 0) && E.length < 3) {
        for (let tries = 0; tries < 40; tries++) {
          const x = JD ? JD.x + JD.w / 2 + (Math.random() - 0.5) * (JD.w - 50) : cx + (Math.random() * 2 - 1) * (R_IN - 50);
          const y = JD ? JD.y + JD.h * (0.4 + Math.random() * 0.22) : springY - R_IN + 60 + Math.random() * (R_IN + (h - FLOOR - springY) - 90);
          if (!JD && (!inside(x, y, 46) || !clearOfUI(x, y))) continue;
          if (E.some(e => Math.hypot(e.x - x, e.y - y) < 90)) continue;
          if ((bg._ivyBoxes || []).some(bx => x > bx.x0 - 24 && x < bx.x1 + 24 && y > bx.y0 - 16 && y < bx.y1 + 16)) continue;
          const k = pickKind();
          E.push({ x, y, k, born: t, life: 3200 + Math.random() * 5200, tilt: (Math.random() - 0.5) * 0.18,
            nextBlink: t + 700 + Math.random() * 1600, blinkT: -1, look: 0, lookTo: 0, nextLook: t + 1200 + Math.random() * 1800 });
          break;
        }
        bg._eyeNext = t + 1300 + Math.random() * 3200;
      }

      c.save();
      if (JD) { c.beginPath(); c.rect(JD.x, JD.y, JD.w, JD.h); c.clip(); }
      c.globalCompositeOperation = 'lighter';
      for (let i = E.length - 1; i >= 0; i--) {
        const e = E[i], age = t - e.born;
        if (age > e.life) { E.splice(i, 1); continue; }
        const fade = Math.min(1, age / 700) * Math.min(1, (e.life - age) / 600);
        // blink: 150ms close, 120ms open; occasional double blink
        if (e.blinkT < 0 && t > e.nextBlink) e.blinkT = t;
        let open = 1;
        if (e.blinkT >= 0) {
          const b = t - e.blinkT;
          open = b < 150 ? 1 - b / 150 : b < 270 ? (b - 150) / 120 : 1;
          if (b >= 270) { e.blinkT = -1; e.nextBlink = t + (Math.random() < 0.25 ? 180 : 1400 + Math.random() * 2600); }
        }
        // glance: pupils shift left/right
        if (t > e.nextLook) { e.lookTo = (Math.random() - 0.5) * 2; e.nextLook = t + 900 + Math.random() * 2200; }
        e.look += (e.lookTo - e.look) * Math.min(1, dt * 0.006);
        const flick = 0.9 + 0.1 * Math.sin(t * 0.004 + e.x);
        const a = fade * flick;
        if (a <= 0.01) continue;
        const k = e.k, rgb = (v, al) => 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + al.toFixed(3) + ')';
        for (const side of [-1, 1]) {
          const ex = e.x + side * k.sep / 2, ey = e.y + side * e.tilt * k.sep;
          // soft halo
          const hg = c.createRadialGradient(ex, ey, 0, ex, ey, k.r * 6);
          hg.addColorStop(0, rgb(k.glow, 0.22 * a * (0.4 + open * 0.6)));
          hg.addColorStop(1, rgb(k.glow, 0));
          c.fillStyle = hg; c.beginPath(); c.arc(ex, ey, k.r * 6, 0, 6.2832); c.fill();
          if (open < 0.06) continue;
          // almond eye, lid squashes it vertically
          c.save();
          c.translate(ex, ey); c.rotate(side * 0.16 + e.tilt);
          const rw = k.r * 1.5, rh = k.r * 0.85 * open;
          const g = c.createRadialGradient(0, 0, 0, 0, 0, rw);
          g.addColorStop(0, rgb(k.core, 0.95 * a));
          g.addColorStop(0.55, rgb(k.glow, 0.7 * a));
          g.addColorStop(1, rgb(k.glow, 0));
          c.fillStyle = g;
          c.beginPath(); c.ellipse(0, 0, rw, rh, 0, 0, 6.2832); c.fill();
          c.restore();
        }
        // pupils (drawn normally so they cut dark into the glow)
        c.globalCompositeOperation = 'source-over';
        if (open > 0.3) {
          for (const side of [-1, 1]) {
            const ex = e.x + side * k.sep / 2 + e.look * k.r * 0.45, ey = e.y + side * e.tilt * k.sep;
            c.fillStyle = 'rgba(8,4,2,' + (0.85 * a).toFixed(3) + ')';
            c.beginPath();
            if (k.slit) c.ellipse(ex, ey, k.r * 0.2, k.r * 0.72 * open, 0, 0, 6.2832);
            else c.arc(ex, ey, k.r * 0.34 * open, 0, 6.2832);
            c.fill();
          }
        }
        c.globalCompositeOperation = 'lighter';
      }
      c.globalCompositeOperation = 'source-over';
      c.restore();
      if (JD) {
        for (let k = 1; k <= 3; k++) {
          const bx = JD.x + JD.w * k / 4;
          c.fillStyle = '#0e1013'; c.fillRect(bx - 2.6, JD.y, 5.2, JD.h);
          c.fillStyle = 'rgba(210,220,235,.13)'; c.fillRect(bx - 2.6, JD.y, 1.2, JD.h);
        }
      }
    }

    function startEmbers(tries = 0) {
      const cv = bg.fireCv;
      if (!cv || !cv.clientWidth) {
        if (tries < 40) bg._retry = setTimeout(() => startEmbers(tries + 1), 100);
        return;
      }
      const ctx = cv.getContext('2d');
      let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
      const fit = () => {
        w = cv.clientWidth; h = cv.clientHeight;
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      fit();
      // brazier emitters sit on the two pillar bowls (geometry mirrors the template)
      const emitters = () => [
        { x: w / 2 - 511, y: h - 474, ph: 0 },
        { x: w / 2 + 511, y: h - 474, ph: 2.3 },
      ];
      const newFlame = (e) => ({
        e, x: e.x + (Math.random() - 0.5) * 22, y: e.y + 2 + (Math.random() - 0.5) * 5,
        r: 7 + Math.random() * 13,
        vy: 0.46 + Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 0.22,
        life: 0, span: 560 + Math.random() * 720,
        hot: Math.random(), wob: 0.5 + Math.random() * 1.4,
      });
      const newSmoke = (e) => ({
        e, x: e.x + (Math.random() - 0.5) * 18, y: e.y - 70 - Math.random() * 40,
        r: 12 + Math.random() * 16,
        vy: 0.34 + Math.random() * 0.4,
        vx: (Math.random() - 0.5) * 0.18,
        ph: Math.random() * 6.28,
        life: 0, span: 2600 + Math.random() * 2400,
      });
      const newSpark = (e) => ({
        e, x: e.x + (Math.random() - 0.5) * 16, y: e.y - 6,
        r: 0.5 + Math.random() * 1.1,
        vy: 0.5 + Math.random() * 1.1,
        vx: (Math.random() - 0.5) * 0.4,
        ph: Math.random() * 6.28,
        life: 0, span: 1300 + Math.random() * 1900,
      });
      let em = emitters();
      let flames = [], sparks = [], smoke = [];
      for (const e of em) {
        for (let i = 0; i < 46; i++) { const f = newFlame(e); f.life = Math.random() * f.span; flames.push(f); }
        for (let i = 0; i < 9; i++) { const s = newSpark(e); s.life = Math.random() * s.span; s.y -= Math.random() * 140; sparks.push(s); }
        for (let i = 0; i < 12; i++) { const m = newSmoke(e); m.life = Math.random() * m.span; smoke.push(m); }
      }
      bg.onDpr = () => { const d = Math.min(window.devicePixelRatio || 1, 2); if (d === dpr) return; dpr = d; fit(); if (!bg.live) tick(performance.now()); };

      let last = performance.now();
      const tick = (t) => {
        try {
        const dt = Math.max(0, Math.min(t - last, 48)); last = t;
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';

        // ---- animated light: flickering pools on wall, arch and floor
        em.forEach((e, i) => {
          const fl = 0.78
            + 0.13 * Math.sin(t * 0.0042 + e.ph)
            + 0.07 * Math.sin(t * 0.0131 + e.ph * 2.1)
            + 0.05 * Math.sin(t * 0.0307 + e.ph * 3.7);
          const R = 340 * (0.94 + fl * 0.1);
          const halo = ctx.createRadialGradient(e.x, e.y - 10, 0, e.x, e.y - 10, R);
          halo.addColorStop(0, 'rgba(255,196,118,' + (0.20 * fl).toFixed(3) + ')');
          halo.addColorStop(0.28, 'rgba(238,150,70,' + (0.10 * fl).toFixed(3) + ')');
          halo.addColorStop(0.62, 'rgba(190,104,48,' + (0.036 * fl).toFixed(3) + ')');
          halo.addColorStop(1, 'rgba(160,80,40,0)');
          ctx.fillStyle = halo;
          ctx.beginPath(); ctx.arc(e.x, e.y - 10, R, 0, 6.2832); ctx.fill();

          // grazing light on the stone right above the bowl
          const graze = ctx.createRadialGradient(e.x, e.y - 34, 0, e.x, e.y - 34, 118 * (0.9 + fl * 0.14));
          graze.addColorStop(0, 'rgba(255,186,104,' + (0.15 * fl).toFixed(3) + ')');
          graze.addColorStop(1, 'rgba(255,150,70,0)');
          ctx.fillStyle = graze;
          ctx.beginPath(); ctx.arc(e.x, e.y - 34, 118, 0, 6.2832); ctx.fill();
          // embers glowing inside the bowl
          const bowl = ctx.createRadialGradient(e.x, e.y + 4, 0, e.x, e.y + 4, 26);
          bowl.addColorStop(0, 'rgba(255,214,150,' + (0.5 * fl).toFixed(3) + ')');
          bowl.addColorStop(0.5, 'rgba(240,124,48,' + (0.22 * fl).toFixed(3) + ')');
          bowl.addColorStop(1, 'rgba(200,70,26,0)');
          ctx.fillStyle = bowl;
          ctx.beginPath(); ctx.ellipse(e.x, e.y + 4, 26, 12, 0, 0, 6.2832); ctx.fill();
        });

        // ---- flame body
        for (const f of flames) {
          f.life += dt;
          if (f.life > f.span) { Object.assign(f, newFlame(f.e)); }
          const k = f.life / f.span;
          f.y -= f.vy * dt * 0.06 * (1 + k * 2.1);
          f.x += (f.vx + Math.sin(f.life * 0.0075 * f.wob + f.hot * 6) * 0.3) * dt * 0.06;
          const a = Math.pow(Math.sin(Math.min(k, 1) * Math.PI), 0.8) * (0.44 - k * 0.2);
          const rr = f.r * (0.55 + Math.sin(Math.min(k, 1) * 2.6) * 0.62) * (1 - k * 0.3);
          if (a <= 0.01 || rr <= 0.3) continue;
          const dx = f.x + (f.e.x - f.x) * k * k * 0.85;   // flame necks in as it rises
          const g = ctx.createRadialGradient(dx, f.y, 0, dx, f.y, rr);
          const core = k < 0.2 ? 'rgba(255,248,226,' : k < 0.42 ? 'rgba(255,214,142,' : k < 0.68 ? 'rgba(252,160,74,' : 'rgba(214,92,38,';
          g.addColorStop(0, core + (a * 0.9).toFixed(3) + ')');
          g.addColorStop(0.45, 'rgba(236,128,50,' + (a * 0.34).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(176,60,22,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(dx, f.y, rr * (1 - k * 0.3), rr * (1 + k * 0.5), 0, 0, 6.2832); ctx.fill();
        }

        // ---- rising sparks
        for (const s of sparks) {
          s.life += dt;
          if (s.life > s.span || s.y < -10) Object.assign(s, newSpark(s.e));
          s.y -= s.vy * dt * 0.06;
          s.x += (s.vx + Math.sin(s.ph + s.life * 0.0016) * 0.3) * dt * 0.05;
          const k = s.life / s.span;
          const a = Math.sin(Math.min(k, 1) * Math.PI) * 0.55;
          if (a <= 0.01) continue;
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
          g.addColorStop(0, 'rgba(255,208,140,' + (a * 0.9).toFixed(3) + ')');
          g.addColorStop(0.4, 'rgba(236,150,74,' + (a * 0.26).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(236,150,74,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 6, 0, 6.2832); ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        // ---- smoke: thins the light it passes through
        for (const m of smoke) {
          m.life += dt;
          if (m.life > m.span || m.y < -60) Object.assign(m, newSmoke(m.e));
          m.y -= m.vy * dt * 0.06;
          m.x += (m.vx + Math.sin(m.ph + m.life * 0.0009) * 0.24) * dt * 0.05;
          const k = m.life / m.span;
          const a = Math.sin(Math.min(k, 1) * Math.PI) * 0.09;
          const rr = m.r * (1 + k * 2.4);
          if (a <= 0.004) continue;
          const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, rr);
          g.addColorStop(0, 'rgba(22,20,24,' + (a).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(22,20,24,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(m.x, m.y, rr, 0, 6.2832); ctx.fill();
        }
        if (bg.live) try { drawEyes(t, dt); } catch (er) { bg._eyes = []; }
        } catch (err) { console.error('[ariaBg] fire:', err); return; }
        if (bg.live) bg._raf = requestAnimationFrame(tick);
      };
      bg.tick = tick;
      if (bg.live) bg._raf = requestAnimationFrame(tick); else tick(last + 16);   // reduced motion: one still frame
    }

    // stage and UI share one cover-scale, so the UI always sits inside the arch
    const fit = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      if (!vw || !vh) return;
      stage.style.transform = 'translate(-50%,-50%) scale(' + Math.max(vw / 1600, vh / 960) + ')';
      if (bg.onDpr) bg.onDpr();
    };
    const onMotion = () => {
      bg.live = !reduced.matches;
      cancelAnimationFrame(bg._raf);
      if (!bg.live) { bg._eyes = []; const c = bg.eyesCv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, bg.eyesCv.width, bg.eyesCv.height); }
      else if (bg.tick) bg._raf = requestAnimationFrame(bg.tick);
    };
    window.addEventListener('resize', fit);
    reduced.addEventListener('change', onMotion);
    fit();
    try { paintStone(); } catch (err) { console.error('[ariaBg] stone:', err); }
    startEmbers();

    return {
      layer, fire: bg.fireCv,
      destroy() {
        bg.live = false;
        cancelAnimationFrame(bg._raf);
        clearTimeout(bg._retry);
        window.removeEventListener('resize', fit);
        reduced.removeEventListener('change', onMotion);
        layer.remove();
      },
    };
  }

  // film grain shared by the tavern and the study
  function grain(c, W, H, rnd) {
      const T = 256, tile = document.createElement('canvas'); tile.width = tile.height = T;
      const tc = tile.getContext('2d'), id = tc.createImageData(T, T);
      for (let i = 0; i < id.data.length; i += 4) { const v = rnd() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 14; }
      tc.putImageData(id, 0, 0);
      c.save(); c.globalCompositeOperation = 'overlay'; c.fillStyle = c.createPattern(tile, 'repeat'); c.fillRect(0, 0, W, H); c.restore();
  }

  function paintTavern(cv) {
      const c = cv.getContext('2d'), W = 1920, H = 1080, HZ = 770;
      let sd = 1130771 >>> 0;
      const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      const rr = (a, b) => a + rnd() * (b - a);
      const LS = [[640, 690, 440, 1], [1190, 330, 250, 0.6], [1620, 300, 250, 0.6], [250, 320, 230, 0.45]];
      const lit = (x, y) => Math.min(1, LS.reduce((a, l) => a + l[3] * Math.exp(-Math.hypot(x - l[0], y - l[1]) / l[2]), 0));
      const wood = (l, h, s) => 'hsl(' + (h == null ? 24 : h) + ',' + (s == null ? 40 : s) + '%,' + Math.max(1, l).toFixed(1) + '%)';
      const glow = (x, y, r, col, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(0.35, 'rgba(' + col + ',' + (a * 0.35) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
      const rrect = (x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
      let g;
      c.fillStyle = '#080504'; c.fillRect(0, 0, W, H);
      for (let x = -10; x < W;) {
        const w = rr(64, 118), cx = x + w / 2;
        g = c.createLinearGradient(0, 0, 0, HZ);
        [0, 0.35, 0.7, 1].forEach((t) => g.addColorStop(t, wood(3 + 24 * lit(cx, t * HZ) + rr(-0.8, 0.8), rr(20, 28), rr(34, 46))));
        c.fillStyle = g; c.fillRect(x, 0, w, HZ);
        for (let i = 0; i < 7; i++) { const gx = x + rr(4, w - 4), amp = rr(0.5, 3); c.strokeStyle = 'rgba(0,0,0,' + rr(0.12, 0.3).toFixed(2) + ')'; c.lineWidth = rr(0.6, 1.6); c.beginPath(); c.moveTo(gx, 0); for (let y = 0; y <= HZ; y += 50) c.lineTo(gx + Math.sin(y * 0.011 + i) * amp, y); c.stroke(); }
        if (rnd() < 0.5) { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + rr(12, w - 12), rr(60, HZ - 40), rr(4, 8), rr(8, 14), 0, 0, 6.283); c.fill(); }
        c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(x, 0, 2.5, HZ);
        c.fillStyle = 'rgba(255,180,110,' + (0.14 * lit(cx, 500)).toFixed(3) + ')'; c.fillRect(x + 2.5, 0, 1, HZ);
        x += w;
      }
      [[530, 26], [HZ - 34, 34]].forEach(([y, h]) => { for (let x = 0; x < W; x += 40) { c.fillStyle = wood(2 + 20 * lit(x + 20, y), 22, 42); c.fillRect(x, y, 41, h); c.fillStyle = 'rgba(255,190,120,' + (0.3 * lit(x + 20, y)).toFixed(3) + ')'; c.fillRect(x, y, 41, 1.5); } c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, y + h, W, 3); });
      g = c.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, 'rgba(3,2,1,.95)'); g.addColorStop(1, 'rgba(3,2,1,0)'); c.fillStyle = g; c.fillRect(0, 0, W, 220);
      [[0, 44], [124, 50]].forEach(([y, h]) => { for (let x = 0; x < W; x += 30) { const l = lit(x + 15, y + h); c.fillStyle = wood(1.5 + 10 * l, 22, 40); c.fillRect(x, y, 31, h); c.fillStyle = 'rgba(255,170,100,' + (0.4 * l).toFixed(3) + ')'; c.fillRect(x, y + h - 2, 31, 2); } c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, y + h, W, 6); });
      const post = (x, w) => { const l = lit(x + w / 2, 500); g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, wood(1.5 + 8 * l)); g.addColorStop(0.5, wood(3 + 18 * l)); g.addColorStop(1, wood(1 + 5 * l)); c.fillStyle = g; c.fillRect(x, 0, w, HZ + 8); for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + rr(4, w - 4), 0, 1, HZ); } };
      post(70, 72); post(1060, 64); post(1872, 70);
      const bl = 1220;
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(bl + 40, 220, W - bl - 110, 390);
      const hues = [120, 38, 350, 28, 90, 200];
      [300, 400, 500].forEach((sy) => {
        for (let x = bl + 70; x < W - 110;) {
          const bw = rr(14, 24), bh = rr(40, 80), hue = hues[Math.floor(rnd() * hues.length)], l = lit(x, sy - bh / 2);
          c.fillStyle = 'hsla(' + hue + ',45%,' + (6 + 24 * l).toFixed(1) + '%,.95)';
          rrect(x, sy - bh * 0.72, bw, bh * 0.72, 3); c.fill(); c.fillRect(x + bw * 0.34, sy - bh, bw * 0.32, bh * 0.3);
          c.fillStyle = 'rgba(255,220,170,' + (0.15 + 0.55 * l).toFixed(2) + ')'; c.fillRect(x + 3, sy - bh * 0.66, 2, bh * 0.5);
          if (rnd() < 0.4) { c.fillStyle = 'rgba(230,210,170,' + (0.1 + 0.3 * l).toFixed(2) + ')'; c.fillRect(x + 1, sy - bh * 0.45, bw - 2, bh * 0.18); }
          x += bw + rr(4, 14) + (rnd() < 0.12 ? rr(20, 50) : 0);
        }
        c.fillStyle = wood(4 + 24 * lit(1500, sy), 24, 45); c.fillRect(bl + 50, sy, W - bl - 120, 12);
        c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(bl + 50, sy + 12, W - bl - 120, 5);
      });
      const fx = 640, fl = 450, frt = 830, ftop = 150;
      c.fillStyle = '#0d0907'; c.fillRect(fl, ftop, frt - fl, HZ - ftop);
      c.save(); c.beginPath(); c.rect(fl, ftop, frt - fl, HZ - ftop); c.clip();
      for (let y = HZ, row = 0; y > ftop; row++) {
        const h = rr(34, 50); let x = fl - (row % 2 ? rr(20, 40) : 0);
        while (x < frt) {
          const w = rr(48, 92), l = lit(x + w / 2, y - h / 2);
          c.fillStyle = 'hsl(' + rr(18, 30).toFixed(0) + ',' + (10 + 28 * l).toFixed(0) + '%,' + (5 + 34 * l + rr(-2, 2)).toFixed(1) + '%)';
          rrect(x + 2, y - h + 2, w - 4, h - 4, 5); c.fill();
          c.fillStyle = 'rgba(255,200,140,' + (0.2 * l).toFixed(3) + ')'; c.fillRect(x + 5, y - h + 3, w - 10, 1.5);
          c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + 4, y - 6, w - 8, 2);
          x += w;
        }
        y -= h;
      }
      c.restore();
      const ol = 540, orr = 740, ot = 570;
      const op = () => { c.beginPath(); c.moveTo(ol, HZ); c.lineTo(ol, ot); c.quadraticCurveTo(fx, ot - 110, orr, ot); c.lineTo(orr, HZ); c.closePath(); };
      op(); c.fillStyle = '#040201'; c.fill();
      c.save(); op(); c.clip();
      g = c.createRadialGradient(fx, HZ - 20, 5, fx, HZ - 40, 210); g.addColorStop(0, '#fff2cf'); g.addColorStop(0.15, '#ffc070'); g.addColorStop(0.4, '#d0561c'); g.addColorStop(0.75, '#4a1406'); g.addColorStop(1, '#0a0302');
      c.fillStyle = g; c.fillRect(ol, ot - 120, orr - ol, HZ - ot + 120);
      [[70, 150, 'rgba(170,40,10,.8)'], [56, 120, 'rgba(230,100,30,.85)'], [40, 90, 'rgba(255,170,70,.92)'], [22, 58, 'rgba(255,240,200,1)']].forEach(([wd, ht, col]) => {
        for (let j = -2; j <= 2; j++) { const ox = fx + j * wd * 0.55 + rr(-6, 6), hh = ht * (1 - Math.abs(j) * 0.22) * rr(0.85, 1.1), ww = wd * 0.5, by = HZ - 26; c.beginPath(); c.moveTo(ox - ww, by); c.bezierCurveTo(ox - ww, by - hh * 0.5, ox - ww * 0.2, by - hh * 0.7, ox + rr(-8, 8), by - hh); c.bezierCurveTo(ox + ww * 0.25, by - hh * 0.6, ox + ww, by - hh * 0.45, ox + ww, by); c.closePath(); c.fillStyle = col; c.fill(); }
      });
      [[-1, 0.18], [1, -0.16], [0, 0.03]].forEach(([sg, a]) => { c.save(); c.translate(fx + sg * 30, HZ - 18); c.rotate(a); c.fillStyle = '#1a0d06'; c.fillRect(-80, -12, 160, 24); c.fillStyle = 'rgba(255,120,40,.6)'; c.fillRect(-80, -12, 160, 3); c.fillStyle = '#ff8a3a'; c.beginPath(); c.ellipse(sg >= 0 ? 80 : -80, 0, 5, 12, 0, 0, 6.283); c.fill(); c.restore(); });
      for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,' + rr(150, 230).toFixed(0) + ',100,' + rr(0.4, 1).toFixed(2) + ')'; const r = rr(1, 2.6); c.fillRect(fx + rr(-90, 90), rr(ot - 60, HZ - 90), r, r); }
      c.restore();
      g = c.createLinearGradient(0, 438, 0, 480); g.addColorStop(0, wood(14, 24, 45)); g.addColorStop(0.7, wood(9, 22, 42)); g.addColorStop(1, wood(30, 26, 60)); c.fillStyle = g; c.fillRect(420, 438, 440, 42);
      c.fillStyle = wood(26, 26, 50); c.fillRect(420, 436, 440, 3);
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(430, 480, 420, 8);
      [[470, 396], [812, 404]].forEach(([x, y]) => { c.fillStyle = '#d9cbb0'; c.fillRect(x - 5, y, 10, 436 - y); c.fillStyle = '#fff1c8'; c.beginPath(); c.ellipse(x, y - 8, 3.5, 8, 0, 0, 6.283); c.fill(); });
      c.fillStyle = '#120a06'; c.beginPath(); c.moveTo(530, 436); c.lineTo(526, 400); c.quadraticCurveTo(540, 384, 552, 400); c.lineTo(548, 436); c.closePath(); c.fill();
      const shx = 640, shy = 318, shr = 70;
      g = c.createRadialGradient(shx - 20, shy + 30, 5, shx, shy, shr); g.addColorStop(0, wood(22, 24, 45)); g.addColorStop(1, wood(7, 22, 40)); c.fillStyle = g; c.beginPath(); c.arc(shx, shy, shr, 0, 6.283); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.5; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(shx + i * 20, shy - Math.sqrt(shr * shr - (i * 20) ** 2)); c.lineTo(shx + i * 20, shy + Math.sqrt(shr * shr - (i * 20) ** 2)); c.stroke(); }
      c.strokeStyle = '#2a2622'; c.lineWidth = 8; c.beginPath(); c.arc(shx, shy, shr - 3, 0, 6.283); c.stroke();
      c.strokeStyle = 'rgba(255,190,120,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(shx, shy, shr - 3, 0.3, 2.8); c.stroke();
      c.strokeStyle = '#c98a3e'; c.lineWidth = 4; c.beginPath(); c.moveTo(shx, shy - 34); c.lineTo(shx + 34, shy); c.lineTo(shx, shy + 34); c.lineTo(shx - 34, shy); c.closePath(); c.stroke();
      c.fillStyle = '#c98a3e'; c.beginPath(); c.arc(shx, shy, 7, 0, 6.283); c.fill();
      const VX = 960, VY = 150;
      c.fillStyle = '#0a0604'; c.fillRect(0, HZ, W, H - HZ);
      const tt = (HZ - VY) / (H - VY);
      for (let i = -24; i < 24; i++) {
        const xb0 = VX + i * 120, xb1 = xb0 + 120, xt0 = VX + (xb0 - VX) * tt, xt1 = VX + (xb1 - VX) * tt;
        g = c.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, wood(3 + 20 * lit(xt0 + 30, HZ + 10) + rr(-1, 1), 22, 42)); g.addColorStop(1, wood(2 + 9 * lit((xb0 + xb1) / 2, 950) + rr(-1, 1), 22, 42));
        c.fillStyle = g; c.beginPath(); c.moveTo(xt0, HZ); c.lineTo(xt1, HZ); c.lineTo(xb1, H); c.lineTo(xb0, H); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(xt0, HZ); c.lineTo(xb0, H); c.stroke();
      }
      for (let k = 0; k < 70; k++) { const i = Math.floor(rr(-16, 16)), y = rr(HZ + 10, H), sp = (y - VY) / (H - VY); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(VX + i * 120 * sp, y, 120 * sp, 2); }
      c.fillStyle = '#1a120d'; c.fillRect(fl - 30, HZ - 4, frt - fl + 60, 24); c.fillStyle = 'rgba(255,160,90,.35)'; c.fillRect(fl - 30, HZ - 4, frt - fl + 60, 2);
      const barrel = (cx, by, w, h) => { const l = lit(cx, by - h / 2); c.beginPath(); c.moveTo(cx - w * 0.42, by); c.bezierCurveTo(cx - w * 0.56, by - h * 0.35, cx - w * 0.56, by - h * 0.65, cx - w * 0.42, by - h); c.lineTo(cx + w * 0.42, by - h); c.bezierCurveTo(cx + w * 0.56, by - h * 0.65, cx + w * 0.56, by - h * 0.35, cx + w * 0.42, by); c.closePath(); g = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); g.addColorStop(0, wood(4 + 22 * l, 24, 45)); g.addColorStop(0.6, wood(3 + 12 * l)); g.addColorStop(1, wood(1.5 + 4 * l)); c.fillStyle = g; c.fill(); [0.12, 0.3, 0.7, 0.88].forEach((t) => { c.fillStyle = 'rgba(20,18,16,.9)'; c.fillRect(cx - w * 0.5, by - h * t - 3, w, 6); }); c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(cx, by + 2, w * 0.55, 8, 0, 0, 6.283); c.fill(); };
      barrel(915, HZ + 28, 86, 124); barrel(1005, HZ + 36, 86, 124); barrel(958, HZ + 36 - 124, 80, 112);
      const ct = 612, cb = 860;
      for (let x = bl; x < W; x += 76) { const l = lit(x + 38, 700); g = c.createLinearGradient(x, 0, x + 76, 0); g.addColorStop(0, wood(3 + 10 * l)); g.addColorStop(0.5, wood(5 + 16 * l)); g.addColorStop(1, wood(2 + 8 * l)); c.fillStyle = g; c.fillRect(x, ct + 26, 76, cb - ct - 26); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 3; c.strokeRect(x + 10, ct + 50, 56, cb - ct - 84); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x, ct + 26, 3, cb - ct - 26); }
      g = c.createLinearGradient(0, ct, 0, ct + 26); g.addColorStop(0, wood(34, 26, 55)); g.addColorStop(1, wood(10, 24, 45)); c.fillStyle = g; c.fillRect(bl - 10, ct, W - bl + 10, 26);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(bl, ct + 26, W - bl, 6);
      [1330, 1372, 1560, 1745].forEach((x, i) => { const y = ct; c.fillStyle = i === 2 ? '#1c140e' : '#140d09'; c.fillRect(x - 13, y - 34, 26, 34); c.strokeStyle = '#140d09'; c.lineWidth = 5; c.beginPath(); c.arc(x + 15, y - 17, 9, -1.3, 1.3); c.stroke(); c.fillStyle = 'rgba(255,190,120,.35)'; c.fillRect(x - 10, y - 32, 2, 30); c.fillStyle = 'rgba(240,225,190,.5)'; c.fillRect(x - 13, y - 36, 26, 4); });
      const lantern = (x, y) => { c.strokeStyle = '#050302'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 174); c.lineTo(x, y - 34); c.stroke(); c.fillStyle = '#0c0705'; c.beginPath(); c.moveTo(x - 20, y - 22); c.lineTo(x + 20, y - 22); c.lineTo(x + 8, y - 36); c.lineTo(x - 8, y - 36); c.closePath(); c.fill(); g = c.createLinearGradient(0, y - 22, 0, y + 22); g.addColorStop(0, '#ffcf7a'); g.addColorStop(0.5, '#fff1c8'); g.addColorStop(1, '#e2862e'); c.fillStyle = g; c.fillRect(x - 15, y - 22, 30, 44); c.strokeStyle = '#0c0705'; c.lineWidth = 3; c.strokeRect(x - 15, y - 22, 30, 44); c.beginPath(); c.moveTo(x, y - 22); c.lineTo(x, y + 22); c.stroke(); c.fillStyle = '#0c0705'; c.fillRect(x - 19, y + 22, 38, 7); };
      LS.slice(1).forEach(([x, y]) => lantern(x, y));
      c.save(); c.globalCompositeOperation = 'lighter';
      glow(fx, 660, 560, '255,130,50', 0.34);
      LS.slice(1).forEach(([x, y]) => glow(x, y, 320, '255,170,80', 0.26));
      [[470, 388], [812, 396]].forEach(([x, y]) => glow(x, y, 60, '255,190,110', 0.3));
      c.save(); c.translate(fx, 850); c.scale(1, 0.22); glow(0, 0, 520, '255,120,50', 0.3); c.restore();
      LS.slice(1).forEach(([x, y]) => { for (let i = 0; i < 70; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * 200, r = rr(0.8, 2); c.fillStyle = 'rgba(255,220,170,' + rr(0.05, 0.3).toFixed(2) + ')'; c.fillRect(x + Math.cos(a) * d, y + 40 + Math.sin(a) * d, r, r); } });
      c.restore();
      c.save(); c.globalCompositeOperation = 'screen';
      g = c.createLinearGradient(0, 160, 0, 480); g.addColorStop(0, 'rgba(120,70,40,0)'); g.addColorStop(0.5, 'rgba(120,76,48,.1)'); g.addColorStop(1, 'rgba(120,70,40,0)'); c.fillStyle = g; c.fillRect(0, 160, W, 320);
      c.restore();
      c.fillStyle = '#050302'; c.beginPath(); c.ellipse(300, 1070, 430, 112, 0, 0, 6.283); c.fill();
      c.strokeStyle = 'rgba(255,150,80,.28)'; c.lineWidth = 3; c.beginPath(); c.ellipse(300, 1070, 430, 112, 0, Math.PI * 1.08, Math.PI * 1.75); c.stroke();
      [[180, 990], [296, 978]].forEach(([x, y]) => { c.fillStyle = '#0a0503'; c.fillRect(x - 24, y - 54, 48, 58); c.strokeStyle = '#0a0503'; c.lineWidth = 9; c.beginPath(); c.arc(x + 28, y - 26, 15, -1.3, 1.3); c.stroke(); c.fillStyle = 'rgba(255,160,90,.38)'; c.fillRect(x + 20, y - 52, 3, 52); });
      c.fillStyle = '#cdbd9e'; c.fillRect(424, 950, 14, 36); c.fillStyle = '#fff1c8'; c.beginPath(); c.ellipse(431, 940, 4, 10, 0, 0, 6.283); c.fill();
      c.save(); c.globalCompositeOperation = 'lighter'; glow(431, 945, 140, '255,180,100', 0.3); c.restore();
      c.fillStyle = '#040201'; c.fillRect(1640, 870, 26, 210); c.fillRect(1800, 870, 26, 210); c.fillRect(1636, 888, 194, 24); c.fillRect(1640, 950, 186, 16);
      c.strokeStyle = 'rgba(255,170,100,.18)'; c.lineWidth = 2; c.beginPath(); c.moveTo(1636, 888); c.lineTo(1830, 888); c.stroke();
      g = c.createRadialGradient(900, 560, 280, 900, 560, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, 'rgba(2,1,0,.45)'); g.addColorStop(1, 'rgba(2,1,0,.92)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      grain(c, W, H, rnd);
  }

  function paintDesk(cv) {
      const c = cv.getContext('2d'), W = 1920, H = 1080;
      let sd = 7720413 >>> 0;
      const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      const rr = (a, b) => a + rnd() * (b - a);
      const CX = 300, CY = 230;
      const L = (x, y) => Math.exp(-Math.hypot(x - CX, y - CY) / 560);
      const K = (x, y) => 0.5 * Math.exp(-Math.hypot(x - 1900, y - 0) / 700);
      const wood = (l, h, s) => 'hsl(' + (h == null ? 24 : h) + ',' + (s == null ? 40 : s) + '%,' + Math.max(1, l).toFixed(1) + '%)';
      const parch = (l) => 'hsl(38,' + (30 + 8 * l).toFixed(0) + '%,' + (7 + 50 * l).toFixed(1) + '%)';
      const ink = (l) => 'rgba(40,24,10,' + (0.25 + 0.4 * l).toFixed(2) + ')';
      const shadow = (x, y, rx, ry, a, rot) => { c.fillStyle = 'rgba(0,0,0,' + a + ')'; c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, 6.283); c.fill(); };
      const glow = (x, y, r, col, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(0.35, 'rgba(' + col + ',' + (a * 0.35) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
      let g;
      c.fillStyle = '#060403'; c.fillRect(0, 0, W, H);
      for (let y = -20; y < H;) {
        const h = rr(150, 200);
        g = c.createLinearGradient(0, 0, W, 0);
        [0, 0.12, 0.25, 0.4, 0.6, 0.8, 1].forEach((t) => { const x = t * W, yy = y + h / 2; g.addColorStop(t, 'hsl(' + (24 + 160 * K(x, yy) / (L(x, yy) + K(x, yy) + 0.01)).toFixed(0) + ',' + rr(32, 44).toFixed(0) + '%,' + (2.5 + 30 * L(x, yy) + 7 * K(x, yy) + rr(-0.8, 0.8)).toFixed(1) + '%)'); });
        c.fillStyle = g; c.fillRect(0, y, W, h);
        for (let k = 0; k < 14; k++) { const gy = y + rr(4, h - 4); c.strokeStyle = 'rgba(0,0,0,' + rr(0.1, 0.28).toFixed(2) + ')'; c.lineWidth = rr(0.6, 1.6); c.beginPath(); c.moveTo(0, gy); for (let x = 0; x <= W; x += 50) c.lineTo(x, gy + Math.sin(x * 0.004 + k * 1.7) * rr(1, 4)); c.stroke(); }
        if (rnd() < 0.6) { const kx = rr(200, W - 200), ky = y + rr(30, h - 30); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.2; for (let r = 4; r < 26; r += 5) { c.beginPath(); c.ellipse(kx, ky, r * 2.4, r * 0.7, 0, 0, 6.283); c.stroke(); } }
        c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(0, y, W, 3);
        c.fillStyle = 'rgba(255,190,120,' + (0.12 * L(CX, y)).toFixed(3) + ')'; c.fillRect(0, y + 3, W, 1.2);
        y += h;
      }
      const sheet = (x, y, w, h, rot, lines, seal) => {
        c.save(); c.translate(x, y); c.rotate(rot);
        const l = L(x, y);
        c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-w / 2 + 10, -h / 2 + 14, w, h);
        g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, parch(l * 1.15)); g.addColorStop(1, parch(l * 0.8)); c.fillStyle = g; c.fillRect(-w / 2, -h / 2, w, h);
        c.strokeStyle = 'rgba(60,36,14,' + (0.2 + 0.3 * l).toFixed(2) + ')'; c.lineWidth = 6; c.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
        c.fillStyle = ink(l);
        c.fillRect(-w / 2 + 28, -h / 2 + 32, w * 0.45, 5);
        for (let i = 0; i < lines; i++) { const ly = -h / 2 + 60 + i * 15; if (ly > h / 2 - 24) break; c.fillRect(-w / 2 + 28, ly, (i % 6 === 5 ? rr(0.2, 0.5) : rr(0.75, 0.9)) * (w - 56), 1.8); }
        if (seal) { c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(w / 2 - 48, h / 2 - 44, 24, 0, 6.283); c.fill(); c.fillStyle = 'hsl(4,62%,' + (8 + 26 * l).toFixed(1) + '%)'; c.beginPath(); c.arc(w / 2 - 52, h / 2 - 48, 22, 0, 6.283); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(w / 2 - 52, h / 2 - 48, 13, 0, 6.283); c.stroke(); c.fillStyle = 'rgba(255,170,140,' + (0.2 + 0.3 * l).toFixed(2) + ')'; c.fillRect(w / 2 - 62, h / 2 - 60, 4, 4); }
        c.restore();
      };
      sheet(1040, 210, 300, 380, -0.22, 20, false);
      sheet(760, 300, 320, 410, 0.1, 22, true);
      sheet(560, 860, 280, 220, -0.06, 10, false);
      c.save(); c.translate(1420, 790); c.rotate(-0.07);
      const bl = L(1420, 790) + 0.6 * K(1420, 790);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(-440, -280, 900, 600);
      c.fillStyle = 'hsl(8,40%,' + (5 + 18 * bl).toFixed(1) + '%)'; c.beginPath(); if (c.roundRect) c.roundRect(-460, -300, 920, 600, 10); else c.rect(-460, -300, 920, 600); c.fill();
      c.strokeStyle = 'rgba(200,150,80,' + (0.15 + 0.3 * bl).toFixed(2) + ')'; c.lineWidth = 2; c.strokeRect(-446, -286, 892, 572);
      for (let i = 0; i < 5; i++) { c.fillStyle = parch(bl * (0.55 - i * 0.06)); c.fillRect(-440 + i * 2, -282 + i * 3, 880 - i * 4, 560 - i * 3); }
      [[-1, -0.35], [1, 0.3]].forEach(([side, tilt]) => {
        g = c.createLinearGradient(side * 430, 0, 0, 0); g.addColorStop(0, parch(bl * 1.05)); g.addColorStop(0.85, parch(bl * 0.85)); g.addColorStop(1, parch(bl * 0.45)); c.fillStyle = g;
        c.beginPath(); c.moveTo(0, -268); c.quadraticCurveTo(side * 200, -286, side * 428, -270); c.lineTo(side * 428, 266); c.quadraticCurveTo(side * 200, 252, 0, 270); c.closePath(); c.fill();
        c.fillStyle = ink(bl);
        const x0 = side < 0 ? -396 : 40;
        c.fillRect(x0, -226, 140, 6);
        for (let i = 0; i < 28; i++) { const ly = -196 + i * 15; c.fillRect(x0, ly, (i % 7 === 6 ? rr(80, 200) : rr(300, 350)), 1.8); }
      });
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-6, -270, 12, 540);
      c.fillStyle = 'hsl(350,55%,' + (8 + 22 * bl).toFixed(1) + '%)'; c.beginPath(); c.moveTo(-8, -10); c.lineTo(8, -10); c.lineTo(16, 340); c.lineTo(4, 326); c.lineTo(-4, 344); c.closePath(); c.fill();
      c.restore();
      shadow(1580, 290, 64, 52, 0.6);
      g = c.createRadialGradient(1550, 248, 6, 1560, 262, 54); g.addColorStop(0, '#34405a'); g.addColorStop(0.6, '#0e131c'); g.addColorStop(1, '#05070a'); c.fillStyle = g; c.beginPath(); c.arc(1560, 262, 50, 0, 6.283); c.fill();
      c.fillStyle = '#020305'; c.beginPath(); c.arc(1560, 262, 20, 0, 6.283); c.fill();
      c.strokeStyle = 'rgba(200,220,255,.28)'; c.lineWidth = 3; c.beginPath(); c.arc(1560, 262, 42, 3.6, 4.6); c.stroke();
      c.save(); c.translate(1572, 252); c.rotate(-0.78);
      c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(170, 26, 160, 22, 0.04, 0, 6.283); c.fill();
      const ql = 0.25 + K(1700, 140) * 1.2;
      c.fillStyle = 'hsl(36,22%,' + (14 + 50 * ql).toFixed(1) + '%)'; c.beginPath(); c.moveTo(20, 0); c.quadraticCurveTo(140, -40, 330, -8); c.quadraticCurveTo(160, 30, 20, 0); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; for (let i = 0; i < 26; i++) { const t = 40 + i * 11; c.beginPath(); c.moveTo(t, 0); c.lineTo(t + 16, -16 + Math.abs(i - 14) * 0.6); c.moveTo(t, 0); c.lineTo(t + 14, 13 - Math.abs(i - 14) * 0.4); c.stroke(); }
      c.strokeStyle = 'hsl(36,20%,' + (30 + 40 * ql).toFixed(1) + '%)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-10, 0); c.lineTo(330, -6); c.stroke();
      c.restore();
      shadow(330, 262, 90, 70, 0.55);
      g = c.createRadialGradient(300, 230, 10, 300, 230, 78); g.addColorStop(0, '#8a6630'); g.addColorStop(0.7, '#4a3216'); g.addColorStop(1, '#1c1208'); c.fillStyle = g; c.beginPath(); c.arc(300, 230, 76, 0, 6.283); c.fill();
      c.strokeStyle = 'rgba(255,210,140,.45)'; c.lineWidth = 2; c.beginPath(); c.arc(300, 230, 70, 0, 6.283); c.stroke();
      c.fillStyle = '#e9dcc0'; c.beginPath(); c.arc(300, 230, 30, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(255,240,210,.9)'; c.beginPath(); c.ellipse(306, 226, 14, 10, 0.5, 0, 6.283); c.fill();
      [[332, 248, 7], [278, 256, 6], [318, 200, 5]].forEach(([x, y, r]) => { c.fillStyle = '#d8c8a6'; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); });
      glow(300, 230, 520, '255,170,80', 0.28);
      glow(300, 230, 120, '255,220,150', 0.7);
      c.fillStyle = '#fff6dc'; c.beginPath(); c.arc(300, 230, 7, 0, 6.283); c.fill();
      g = c.createRadialGradient(W * 0.42, H * 0.45, H * 0.3, W * 0.5, H * 0.5, W * 0.72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  function paintStudy(cv) {
      const c = cv.getContext('2d'), W = 1920, H = 1080, HZ = 650;
      let sd = 2203117 >>> 0;
      const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      const rr = (a, b) => a + rnd() * (b - a);
      const CW = [330, 600], CM = [1500, 380];
      const lw = (x, y) => Math.exp(-Math.hypot(x - CW[0], y - CW[1]) / 430);
      const lc = (x, y) => 0.75 * Math.exp(-Math.hypot(x - CM[0], y - CM[1]) / 360);
      const wood = (l, h, s) => 'hsl(' + (h == null ? 24 : h) + ',' + (s == null ? 40 : s) + '%,' + Math.max(1, l).toFixed(1) + '%)';
      const glow = (x, y, r, col, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(0.35, 'rgba(' + col + ',' + (a * 0.35) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
      const rrect = (x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
      const parch = (l, k) => 'hsl(' + (38 + 120 * k).toFixed(0) + ',' + (34 - 20 * k).toFixed(0) + '%,' + (8 + 46 * l + 30 * k).toFixed(1) + '%)';
      let g;
      c.fillStyle = '#050403'; c.fillRect(0, 0, W, H);
      for (let y = HZ, row = 0; y > -60; row++) {
        const h = rr(46, 64); let x = -rr(0, 120);
        while (x < W) {
          const w = rr(96, 170), cx = x + w / 2, cy = y - h / 2, l = lw(cx, cy), k = lc(cx, cy), mix = k / (l + k + 0.001);
          c.fillStyle = 'hsl(' + (26 + 190 * mix).toFixed(0) + ',' + (10 + 10 * (l + k)).toFixed(0) + '%,' + (4 + 24 * l + 16 * k + rr(-1.5, 1.5)).toFixed(1) + '%)';
          rrect(x + 2, y - h + 2, w - 4, h - 4, 4); c.fill();
          c.fillStyle = 'rgba(255,200,140,' + (0.16 * l).toFixed(3) + ')'; c.fillRect(x + 5, y - h + 3, w - 10, 1.5);
          x += w;
        }
        y -= h;
      }
      const wx0 = 1350, wx1 = 1650, wt = 120, wb = 590, wm = (wx0 + wx1) / 2;
      const arch = () => { c.beginPath(); c.moveTo(wx0, wb); c.lineTo(wx0, wt + 150); c.quadraticCurveTo(wx0, wt, wm, wt); c.quadraticCurveTo(wx1, wt, wx1, wt + 150); c.lineTo(wx1, wb); c.closePath(); };
      arch(); g = c.createLinearGradient(0, wt, 0, wb); g.addColorStop(0, '#081226'); g.addColorStop(0.7, '#15294a'); g.addColorStop(1, '#22406a'); c.fillStyle = g; c.fill();
      c.save(); arch(); c.clip();
      for (let i = 0; i < 70; i++) { c.fillStyle = 'rgba(220,230,255,' + rr(0.2, 0.9).toFixed(2) + ')'; const r = rr(0.8, 2); c.fillRect(rr(wx0, wx1), rr(wt, wb - 120), r, r); }
      c.fillStyle = '#e9eefc'; c.beginPath(); c.arc(1570, 250, 30, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(8,18,38,.9)'; c.beginPath(); c.arc(1582, 244, 27, 0, 6.283); c.fill();
      c.fillStyle = '#0a1426'; c.beginPath(); c.moveTo(wx0, wb); for (let x = wx0; x <= wx1; x += 20) c.lineTo(x, wb - 70 - Math.sin(x * 0.013) * 28 - Math.sin(x * 0.041) * 10); c.lineTo(wx1, wb); c.closePath(); c.fill();
      c.fillStyle = '#060c18'; c.beginPath(); c.moveTo(wx0, wb); for (let x = wx0; x <= wx1; x += 14) c.lineTo(x, wb - 34 - Math.sin(x * 0.03 + 1) * 14); c.lineTo(wx1, wb); c.closePath(); c.fill();
      c.restore();
      arch(); c.strokeStyle = '#1b1e24'; c.lineWidth = 22; c.stroke();
      arch(); c.strokeStyle = 'rgba(160,185,230,.25)'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#0b0c0f'; c.fillRect(wm - 4, wt, 8, wb - wt); c.fillRect(wx0, wt + 250, wx1 - wx0, 8);
      c.fillStyle = 'hsl(215,14%,20%)'; c.fillRect(wx0 - 26, wb, wx1 - wx0 + 52, 20); c.fillStyle = 'rgba(190,210,250,.35)'; c.fillRect(wx0 - 26, wb, wx1 - wx0 + 52, 2);
      const sy = 300;
      const hues = [12, 38, 350, 28, 150, 210, 260];
      for (let x = 90; x < 700;) {
        const bw = rr(16, 28), bh = rr(56, 96), hue = hues[Math.floor(rnd() * hues.length)], l = lw(x, sy - bh / 2), lean = rnd() < 0.1;
        c.save(); if (lean) { c.translate(x, sy); c.rotate(-0.18); c.translate(-x, -sy); }
        c.fillStyle = 'hsla(' + hue + ',40%,' + (5 + 28 * l).toFixed(1) + '%,.96)'; rrect(x, sy - bh, bw, bh, 2); c.fill();
        c.fillStyle = 'rgba(255,215,160,' + (0.1 + 0.5 * l).toFixed(2) + ')'; c.fillRect(x + 3, sy - bh + 6, 2, bh - 12);
        if (rnd() < 0.5) { c.fillStyle = 'rgba(220,180,110,' + (0.15 + 0.4 * l).toFixed(2) + ')'; c.fillRect(x + 1, sy - bh * 0.7, bw - 2, 3); c.fillRect(x + 1, sy - bh * 0.3, bw - 2, 3); }
        c.restore();
        x += bw + rr(2, 8) + (rnd() < 0.15 ? rr(30, 60) : 0);
      }
      g = c.createLinearGradient(0, sy, 0, sy + 16); g.addColorStop(0, wood(6 + 28 * lw(400, sy), 24, 45)); g.addColorStop(1, wood(4 + 10 * lw(400, sy))); c.fillStyle = g; c.fillRect(70, sy, 660, 16);
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(70, sy + 16, 660, 8);
      [[120, 1], [680, 1]].forEach(([x]) => { c.fillStyle = wood(3 + 8 * lw(x, sy + 30)); c.beginPath(); c.moveTo(x - 6, sy + 16); c.lineTo(x + 6, sy + 16); c.lineTo(x, sy + 60); c.closePath(); c.fill(); });
      c.save(); c.translate(1000, 340); c.rotate(-0.035);
      const pl = lw(1000, 340), pk = lc(1000, 340);
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-166, -176, 344, 340);
      g = c.createLinearGradient(-170, -180, 170, 160); g.addColorStop(0, parch(pl * 1.2, pk * 0.3)); g.addColorStop(1, parch(pl * 0.8, pk * 0.6)); c.fillStyle = g; c.fillRect(-172, -182, 344, 340);
      c.strokeStyle = 'rgba(40,24,10,.55)'; c.lineWidth = 2; c.strokeRect(-150, -160, 300, 296);
      c.strokeRect(-138, -146, 92, 118);
      c.fillStyle = 'rgba(40,24,10,.5)'; c.fillRect(-30, -142, 150, 8); c.fillRect(-30, -118, 110, 4);
      for (let i = 0; i < 5; i++) { c.fillRect(-30, -96 + i * 14, rr(60, 150), 2); }
      for (let i = 0; i < 5; i++) { c.strokeRect(-138 + i * 58, -14, 48, 40); }
      for (let i = 0; i < 7; i++) { c.fillRect(-138, 44 + i * 13, rr(120, 276), 2); }
      [[-160, -170], [160, -170], [-160, 146], [160, 146]].forEach(([x, y]) => { c.fillStyle = '#5a1a12'; c.beginPath(); c.arc(x, y, 6, 0, 6.283); c.fill(); c.fillStyle = 'rgba(255,170,140,.4)'; c.fillRect(x - 2, y - 3, 2, 2); });
      c.restore();
      c.fillStyle = '#0a0705'; c.fillRect(0, HZ, W, H - HZ);
      for (let y = HZ + 14, i = 0; y < H; i++) {
        const h = 34 + (y - HZ) * 0.16;
        g = c.createLinearGradient(0, 0, W, 0);
        [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1].forEach((s) => g.addColorStop(s, wood(2.5 + 26 * lw(s * W, y + h / 2) + 12 * lc(s * W, y + h / 2) + rr(-0.8, 0.8), rr(20, 28), rr(34, 46))));
        c.fillStyle = g; c.fillRect(0, y, W, h);
        for (let k = 0; k < 6; k++) { const gy = y + rr(3, h - 3); c.strokeStyle = 'rgba(0,0,0,' + rr(0.12, 0.3).toFixed(2) + ')'; c.lineWidth = rr(0.6, 1.4); c.beginPath(); c.moveTo(0, gy); for (let x = 0; x <= W; x += 60) c.lineTo(x, gy + Math.sin(x * 0.006 + k) * rr(0.5, 2.5)); c.stroke(); }
        c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(0, y, W, 2.5);
        y += h;
      }
      g = c.createLinearGradient(0, HZ, 0, HZ + 16); g.addColorStop(0, wood(32, 26, 55)); g.addColorStop(1, wood(10, 24, 45)); c.fillStyle = g; c.fillRect(0, HZ, W, 16);
      c.fillStyle = 'rgba(255,190,120,.3)'; c.fillRect(0, HZ, W, 1.5);
      const shadow = (x, y, rx, ry, a) => { c.fillStyle = 'rgba(0,0,0,' + a + ')'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.283); c.fill(); };
      shadow(720, 905, 230, 26, 0.55);
      const page = (pts, l, k) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fillStyle = parch(l, k); c.fill(); };
      page([[500, 770], [700, 792], [700, 902], [478, 884]], lw(590, 830) * 1.05, lc(590, 830) * 0.2);
      page([[700, 792], [902, 770], [924, 884], [700, 902]], lw(810, 830) * 0.95, lc(810, 830) * 0.3);
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2; c.beginPath(); c.moveTo(700, 792); c.lineTo(700, 902); c.stroke();
      c.fillStyle = 'rgba(40,24,10,.45)';
      for (let i = 0; i < 7; i++) { const t2 = i / 7; c.fillRect(520 - t2 * 18, 790 + t2 * 90, rr(110, 160), 1.6); c.fillRect(720, 800 + t2 * 88, rr(110, 170), 1.6); }
      c.fillStyle = wood(8, 18, 40); c.fillRect(478, 884, 446, 8);
      shadow(990, 812, 46, 10, 0.6);
      g = c.createRadialGradient(978, 778, 4, 990, 790, 40); g.addColorStop(0, '#2b3446'); g.addColorStop(1, '#07090d'); c.fillStyle = g; c.beginPath(); c.ellipse(990, 790, 34, 26, 0, 0, 6.283); c.fill();
      c.fillStyle = '#05070a'; c.fillRect(978, 756, 24, 14); c.fillStyle = 'rgba(180,200,240,.35)'; c.fillRect(972, 778, 3, 14);
      c.strokeStyle = 'rgba(230,220,200,.75)'; c.lineWidth = 3; c.beginPath(); c.moveTo(992, 760); c.quadraticCurveTo(1040, 660, 1120, 590); c.stroke();
      c.fillStyle = 'rgba(220,210,190,.55)'; c.beginPath(); c.moveTo(1010, 720); c.quadraticCurveTo(1080, 610, 1130, 584); c.quadraticCurveTo(1100, 650, 1030, 724); c.closePath(); c.fill();
      const d20 = (x, y, r) => { const l = lw(x, y), k = lc(x, y); const pts = []; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
        shadow(x + 6, y + r * 0.9, r * 1.1, r * 0.25, 0.55);
        c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = 'hsl(355,48%,' + (8 + 30 * l + 10 * k).toFixed(1) + '%)'; c.fill();
        const tri = [[x, y - r * 0.55], [x + r * 0.5, y + r * 0.32], [x - r * 0.5, y + r * 0.32]];
        c.beginPath(); tri.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = 'hsl(355,50%,' + (11 + 38 * l + 12 * k).toFixed(1) + '%)'; c.fill();
        c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.5; tri.forEach((p, i) => { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(pts[[0, 2, 4][i]][0], pts[[0, 2, 4][i]][1]); c.stroke(); });
        c.fillStyle = 'rgba(255,230,200,.7)'; c.font = '600 ' + (r * 0.42).toFixed(0) + 'px Georgia, serif'; c.textAlign = 'center'; c.fillText('20', x, y + r * 0.16); };
      d20(1190, 850, 36); d20(1272, 905, 24);
      [[1110, 920], [1132, 928], [1096, 934]].forEach(([x, y]) => { shadow(x, y + 4, 16, 5, 0.5); c.fillStyle = 'hsl(42,60%,' + (10 + 36 * lw(x, y)).toFixed(1) + '%)'; c.beginPath(); c.ellipse(x, y, 15, 5.5, 0, 0, 6.283); c.fill(); c.fillStyle = 'rgba(255,230,160,.4)'; c.fillRect(x - 8, y - 3, 10, 1.5); });
      [[1470, 860, 0.09, 300, 190], [1560, 820, -0.05, 260, 170]].forEach(([x, y, a, w, h]) => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-w / 2 + 8, -h / 2 + 10, w, h); c.fillStyle = parch(lw(x, y) * 0.9, lc(x, y) * 1.2); c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = 'rgba(30,30,50,.4)'; for (let i = 0; i < 8; i++) c.fillRect(-w / 2 + 20, -h / 2 + 22 + i * 18, rr(w * 0.4, w - 40), 1.6); c.restore(); });
      const cx = CW[0], base = 760, top = 640;
      shadow(cx, base + 6, 80, 14, 0.6);
      g = c.createLinearGradient(cx - 70, 0, cx + 70, 0); g.addColorStop(0, '#3a2510'); g.addColorStop(0.4, '#c08a3e'); g.addColorStop(1, '#2a1a0a'); c.fillStyle = g; c.beginPath(); c.ellipse(cx, base, 66, 14, 0, 0, 6.283); c.fill();
      c.fillRect(cx - 18, base - 22, 36, 22);
      g = c.createLinearGradient(cx - 15, 0, cx + 15, 0); g.addColorStop(0, '#b9a98a'); g.addColorStop(0.45, '#fff3d6'); g.addColorStop(1, '#8c7c60'); c.fillStyle = g; c.fillRect(cx - 15, top, 30, base - 22 - top);
      c.fillStyle = '#f4e6c4'; c.beginPath(); c.ellipse(cx, top, 15, 4, 0, 0, 6.283); c.fill();
      c.fillStyle = '#efe0bc'; c.beginPath(); c.moveTo(cx + 8, top); c.quadraticCurveTo(cx + 14, top + 30, cx + 10, top + 46); c.quadraticCurveTo(cx + 5, top + 30, cx + 6, top); c.fill();
      c.fillStyle = '#1a1008'; c.fillRect(cx - 1, top - 10, 2, 10);
      [[16, 52, 'rgba(230,110,30,.75)'], [11, 40, 'rgba(255,180,80,.9)'], [6, 26, 'rgba(255,245,215,1)']].forEach(([wd, ht, col]) => { c.beginPath(); c.moveTo(cx, top - 6 - ht); c.bezierCurveTo(cx + wd, top - 6 - ht * 0.5, cx + wd, top - 4, cx, top - 2); c.bezierCurveTo(cx - wd, top - 4, cx - wd, top - 6 - ht * 0.5, cx, top - 6 - ht); c.fillStyle = col; c.fill(); });
      c.save(); c.globalCompositeOperation = 'lighter';
      glow(cx, top - 30, 640, '255,140,60', 0.34); glow(cx, top - 30, 140, '255,200,120', 0.45);
      c.save(); c.translate(cx + 260, 860); c.scale(1, 0.22); glow(0, 0, 620, '255,130,50', 0.28); c.restore();
      glow(1570, 250, 240, '150,180,255', 0.22); glow(1500, 400, 520, '110,140,210', 0.12);
      c.fillStyle = 'rgba(120,150,215,.05)'; c.beginPath(); c.moveTo(wx0, wb); c.lineTo(wx1, wb); c.lineTo(1840, H); c.lineTo(1120, H); c.closePath(); c.fill();
      for (let i = 0; i < 60; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * 260, r = rr(0.8, 2); c.fillStyle = 'rgba(255,220,170,' + rr(0.05, 0.3).toFixed(2) + ')'; c.fillRect(cx + Math.cos(a) * d, top - 60 + Math.sin(a) * d, r, r); }
      c.restore();
      g = c.createRadialGradient(960, 520, 300, 960, 540, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, 'rgba(2,1,0,.45)'); g.addColorStop(1, 'rgba(2,1,0,.92)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      grain(c, W, H, rnd);
  }

  function paintHall(cv) {
      const c = cv.getContext('2d'), W = 1920, H = 1080, HZ = 610, VX = 960, E = 480, GZ = 11;
      let sd = 20260924 >>> 0;
      const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      const rr = (a, b) => a + rnd() * (b - a);
      const sx = (u, z) => VX + u * E / z, sy = (v, z) => HZ + (1 - v) * E / z;
      const gx = VX, gy = sy(1.3, GZ);
      const glow = (x, y, r) => Math.exp(-Math.hypot(x - gx, (y - gy) * 1.3) / r);
      const stone = (l, s) => 'hsl(214,' + (s == null ? rr(5, 10) : s).toFixed(1) + '%,' + l.toFixed(1) + '%)';
      const warm = (l, a) => 'hsla(' + (28 - l * 0.2).toFixed(0) + ',' + (62 - l * 0.6).toFixed(0) + '%,' + l.toFixed(1) + '%,' + (a == null ? 1 : a) + ')';

      // void
      let g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#040507'); g.addColorStop(0.55, '#0b0e12'); g.addColorStop(1, '#050608');
      c.fillStyle = g; c.fillRect(0, 0, W, H);

      // back wall masonry, lit by the gate
      const wl = sx(-7, GZ), wr = sx(7, GZ), wt = sy(5.2, GZ), wb = sy(0, GZ);
      const RH = 0.32 * E / GZ;
      for (let y = wb - RH, row = 0; y > wt; y -= RH, row++) {
        let x = wl - rr(0, 20);
        while (x < wr) {
          const bw = rr(0.55, 1.05) * E / GZ, cxm = x + bw / 2, cym = y + RH / 2;
          const L = 5 + 30 * glow(cxm, cym, 150) + rr(-1.2, 1.2);
          c.fillStyle = glow(cxm, cym, 150) > 0.08 ? warm(L) : stone(L);
          c.fillRect(x + 0.8, y + 0.8, bw - 1.6, RH - 1.6);
          x += bw;
        }
      }
      // gate opening
      const gw = 0.85 * E / GZ, gb = sy(0, GZ), gs = sy(2.1, GZ);
      const archPath = (pad) => { c.beginPath(); c.moveTo(gx - gw - pad, gb); c.lineTo(gx - gw - pad, gs); c.arc(gx, gs, gw + pad, Math.PI, 0); c.lineTo(gx + gw + pad, gb); c.closePath(); };
      // voussoirs
      for (let i = 0; i < 13; i++) {
        const a0 = Math.PI + i * Math.PI / 13, a1 = a0 + Math.PI / 13;
        c.beginPath(); c.arc(gx, gs, gw + 16, a0 + 0.015, a1 - 0.015); c.arc(gx, gs, gw + 2, a1 - 0.02, a0 + 0.02, true); c.closePath();
        c.fillStyle = warm(30 + rr(-4, 4)); c.fill();
      }
      archPath(2); c.fillStyle = '#1a0a05'; c.fill();
      archPath(0);
      g = c.createRadialGradient(gx, gb - 30, 4, gx, gb - 40, gw * 2.4);
      g.addColorStop(0, '#fff6df'); g.addColorStop(0.18, '#ffd08a'); g.addColorStop(0.45, '#e2782f'); g.addColorStop(0.8, '#7a2a10'); g.addColorStop(1, '#2a0d06');
      c.fillStyle = g; c.fill();
      // far steps inside the gate
      c.save(); archPath(0); c.clip();
      for (let i = 0; i < 6; i++) { const y = gb - i * 7; c.fillStyle = 'rgba(60,18,6,' + (0.55 - i * 0.07) + ')'; c.fillRect(gx - gw, y - 3, gw * 2, 2); }
      c.restore();

      // floor flagstones in perspective
      const zs = []; for (let z = 0.62; z < GZ; z *= 1.14) zs.push(z); zs.push(GZ);
      for (let k = zs.length - 2; k >= 0; k--) {
        const z0 = zs[k], z1 = zs[k + 1], off = (k % 2) * 0.55;
        for (let u = -9 + off; u < 9; u += 1.1) {
          const u1 = u + 1.1, p = [[sx(u, z0), sy(0, z0)], [sx(u1, z0), sy(0, z0)], [sx(u1, z1), sy(0, z1)], [sx(u, z1), sy(0, z1)]];
          const mx = (p[0][0] + p[2][0]) / 2, my = (p[0][1] + p[2][1]) / 2;
          const gl = glow(mx, my, 330), aisle = Math.exp(-Math.abs(u + 0.55) / 2.2);
          const L = 3.5 + 20 * gl + 7 * aisle * Math.exp(-(GZ - z1) / 6) + rr(-1, 1.2);
          c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) c.lineTo(p[i][0], p[i][1]); c.closePath();
          c.fillStyle = gl > 0.1 ? warm(L) : stone(L); c.fill();
          c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = Math.max(0.6, 3.2 / z0); c.stroke();
          // lit far lip of each stone
          c.beginPath(); c.moveTo(p[2][0], p[2][1] + 1); c.lineTo(p[3][0], p[3][1] + 1);
          c.strokeStyle = 'rgba(255,190,120,' + (0.18 * gl + 0.03).toFixed(3) + ')'; c.lineWidth = Math.max(0.5, 1.4 / z0); c.stroke();
          if (rnd() < 0.12) { // crack
            c.beginPath(); let x = rr(p[0][0], p[1][0]), y = p[0][1]; c.moveTo(x, y);
            for (let i = 0; i < 5; i++) { x += rr(-14, 14) / z0; y -= rr(4, 12) / z0; c.lineTo(x, y); }
            c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = Math.max(0.5, 1.6 / z0); c.stroke();
          }
        }
      }
      // wet reflection of the gate
      c.save(); c.globalCompositeOperation = 'lighter';
      g = c.createLinearGradient(0, gb, 0, H);
      g.addColorStop(0, 'rgba(255,170,90,.32)'); g.addColorStop(0.35, 'rgba(236,120,50,.12)'); g.addColorStop(1, 'rgba(236,120,50,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(gx - gw * 0.9, gb); c.lineTo(gx + gw * 0.9, gb); c.lineTo(gx + 190, H); c.lineTo(gx - 190, H); c.closePath(); c.fill();
      for (let i = 0; i < 160; i++) { const y = rr(gb + 4, H), sp = (y - gb) / (H - gb); const x = gx + rr(-1, 1) * (gw + 170 * sp); c.fillStyle = 'rgba(255,190,120,' + rr(0.02, 0.1) * (1 - sp) + ')'; c.fillRect(x, y, rr(6, 40) * (0.3 + sp), 1); }
      c.restore();

      // pillars, vault ribs, banners, braziers — far to near
      const PZ = [10.2, 8.1, 6.4, 5, 3.9, 3, 2.25, 1.65, 1.15];
      const PU = 2.5, PW = 0.3, PH = 4.3;
      const pillar = (side, z) => {
        const x = sx(side * PU, z), hw = PW * E / z, top = sy(PH, z), bot = sy(0, z);
        const lit = Math.exp(-(GZ - z) / 3.4), inner = side < 0 ? x + hw : x - hw;
        // cast shadow on floor
        c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(x - side * hw * 0.4, bot, hw * 1.9, hw * 0.35, 0, 0, 6.283); c.fill();
        g = c.createLinearGradient(x - hw, 0, x + hw, 0);
        const dark = stone(3 + lit * 6, 8), rim = 'hsl(' + 26 + ',55%,' + (6 + lit * 34).toFixed(1) + '%)';
        if (side < 0) { g.addColorStop(0, dark); g.addColorStop(0.62, stone(4 + lit * 12, 9)); g.addColorStop(1, rim); }
        else { g.addColorStop(0, rim); g.addColorStop(0.38, stone(4 + lit * 12, 9)); g.addColorStop(1, dark); }
        c.fillStyle = g; c.fillRect(x - hw, top, hw * 2, bot - top);
        // drum joints
        for (let v = 0.55; v < PH - 0.4; v += rr(0.45, 0.62)) { const y = sy(v, z); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x - hw, y, hw * 2, Math.max(0.6, 2 / z)); c.fillStyle = 'rgba(255,190,120,' + (lit * 0.12).toFixed(3) + ')'; c.fillRect(side < 0 ? x : x - hw, y + Math.max(0.6, 2 / z), hw, Math.max(0.5, 1 / z)); }
        // base & capital
        const bw2 = hw * 1.45;
        [[0, 0.32], [PH - 0.3, PH]].forEach(([v0, v1]) => {
          const y0 = sy(v1, z), y1 = sy(v0, z);
          g = c.createLinearGradient(x - bw2, 0, x + bw2, 0);
          if (side < 0) { g.addColorStop(0, stone(3 + lit * 5)); g.addColorStop(1, 'hsl(26,50%,' + (7 + lit * 30).toFixed(1) + '%)'); }
          else { g.addColorStop(0, 'hsl(26,50%,' + (7 + lit * 30).toFixed(1) + '%)'); g.addColorStop(1, stone(3 + lit * 5)); }
          c.fillStyle = g; c.fillRect(x - bw2, y0, bw2 * 2, y1 - y0);
          c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x - bw2, y1 - Math.max(1, 3 / z), bw2 * 2, Math.max(1, 3 / z));
        });
        // moss at the foot
        for (let i = 0; i < 60 / z; i++) { c.fillStyle = 'hsla(' + rr(88, 110).toFixed(0) + ',30%,' + rr(6, 14 + lit * 10).toFixed(0) + '%,.8)'; const r = rr(1, 3.2) / Math.sqrt(z); c.fillRect(x + rr(-bw2, bw2), bot - rr(0, 0.5) * E / z * rr(0, 1), r, r); }
        return { x, inner, top, hw, lit };
      };
      const rib = (z) => {
        const xl = sx(-PU, z), xr = sx(PU, z), y = sy(PH, z), peak = sy(PH + 2.3, z), lit = Math.exp(-(GZ - z) / 3.4);
        c.beginPath(); c.moveTo(xl, y); c.bezierCurveTo(xl, peak, xr, peak, xr, y);
        c.strokeStyle = stone(3 + lit * 8, 8); c.lineWidth = 0.32 * E / z; c.stroke();
        c.beginPath(); c.moveTo(xl + 0.15 * E / z, y); c.bezierCurveTo(xl + 0.15 * E / z, peak + 0.16 * E / z, xr - 0.15 * E / z, peak + 0.16 * E / z, xr - 0.15 * E / z, y);
        c.strokeStyle = 'rgba(255,170,100,' + (lit * 0.3).toFixed(3) + ')'; c.lineWidth = Math.max(0.6, 2.2 / z); c.stroke();
        // side arches toward the aisles
        [-1, 1].forEach((s) => { const x0 = sx(s * PU, z); c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo(sx(s * (PU + 2.2), z), sy(PH + 1.4, z), sx(s * (PU + 4.4), z), y + 0.2 * E / z); c.strokeStyle = stone(2.5 + lit * 5, 8); c.lineWidth = 0.26 * E / z; c.stroke(); });
      };
      const banner = (side, z) => {
        const x = sx(side * (PU - 0.55), z), top = sy(PH - 0.35, z), bw = 0.52 * E / z, len = 1.9 * E / z, lit = Math.exp(-(GZ - z) / 4);
        c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - bw / 2 - 2 / z, top - 4 / z, bw + 4 / z, 6 / z);
        c.beginPath(); c.moveTo(x - bw / 2, top);
        c.lineTo(x + bw / 2, top); c.lineTo(x + bw / 2 + rr(-2, 2), top + len * 0.9);
        for (let i = 1; i <= 6; i++) { const t = i / 6; c.lineTo(x + bw / 2 - bw * t, top + len * (i % 2 ? rr(0.8, 0.9) : rr(0.92, 1.0))); }
        c.closePath();
        g = c.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
        g.addColorStop(0, 'hsl(356,48%,' + (7 + (side < 0 ? 0 : lit * 16)).toFixed(1) + '%)'); g.addColorStop(0.5, 'hsl(356,46%,' + (9 + lit * 8).toFixed(1) + '%)'); g.addColorStop(1, 'hsl(356,48%,' + (7 + (side < 0 ? lit * 16 : 0)).toFixed(1) + '%)');
        c.fillStyle = g; c.fill();
        // folds
        for (let i = 1; i < 4; i++) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x - bw / 2 + bw * i / 4 - 1 / z, top, 3 / z, len * 0.86); }
        // sigil: diamond + lines, faded gold
        const cy = top + len * 0.36, d = bw * 0.2;
        c.strokeStyle = 'rgba(236,164,86,' + (0.25 + lit * 0.35).toFixed(3) + ')'; c.lineWidth = Math.max(0.8, 3 / z);
        c.beginPath(); c.moveTo(x, cy - d); c.lineTo(x + d, cy); c.lineTo(x, cy + d); c.lineTo(x - d, cy); c.closePath(); c.stroke();
        c.beginPath(); c.moveTo(x - bw * 0.36, top + len * 0.12); c.lineTo(x + bw * 0.36, top + len * 0.12); c.moveTo(x - bw * 0.36, top + len * 0.6); c.lineTo(x + bw * 0.36, top + len * 0.6); c.stroke();
      };
      const brazier = (side, z) => {
        const x = sx(side * (PU - 0.75), z), bot = sy(0, z), u = E / z;
        c.save(); c.globalCompositeOperation = 'lighter';
        g = c.createRadialGradient(x, bot - 1.05 * u, 0, x, bot - 1.05 * u, 2.6 * u);
        g.addColorStop(0, 'rgba(255,160,70,.42)'); g.addColorStop(0.35, 'rgba(220,100,40,.14)'); g.addColorStop(1, 'rgba(200,80,30,0)');
        c.fillStyle = g; c.fillRect(x - 2.6 * u, bot - 3.7 * u, 5.2 * u, 5.2 * u);
        c.restore();
        c.strokeStyle = '#0b0c0e'; c.lineWidth = 0.035 * u;
        c.beginPath(); c.moveTo(x - 0.2 * u, bot); c.lineTo(x, bot - 0.85 * u); c.lineTo(x + 0.2 * u, bot); c.moveTo(x, bot + 0.02 * u); c.lineTo(x, bot - 0.85 * u); c.stroke();
        c.fillStyle = '#120d0a'; c.beginPath(); c.moveTo(x - 0.26 * u, bot - 0.95 * u); c.lineTo(x + 0.26 * u, bot - 0.95 * u); c.lineTo(x + 0.16 * u, bot - 0.8 * u); c.lineTo(x - 0.16 * u, bot - 0.8 * u); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,170,90,.55)'; c.fillRect(x - 0.26 * u, bot - 0.96 * u, 0.52 * u, 0.02 * u);
        // frozen flame: layered tongues, red tail -> white core
        const tongues = [[0.34, 0.62, 'rgba(160,30,10,.75)'], [0.27, 0.52, 'rgba(226,90,24,.85)'], [0.19, 0.4, 'rgba(255,160,60,.92)'], [0.1, 0.26, 'rgba(255,236,190,1)']];
        tongues.forEach(([wd, ht, col], i) => {
          for (let j = 0; j < 3; j++) {
            const ox = (j - 1) * wd * 0.35 * u, hh = ht * u * (j === 1 ? 1 : 0.7), ww = wd * u * 0.6, by = bot - 0.95 * u;
            c.beginPath(); c.moveTo(x + ox - ww, by);
            c.bezierCurveTo(x + ox - ww, by - hh * 0.5, x + ox - ww * 0.1 + (i - 1.5) * 0.02 * u, by - hh * 0.7, x + ox + (j - 1) * 0.05 * u, by - hh);
            c.bezierCurveTo(x + ox + ww * 0.2, by - hh * 0.6, x + ox + ww, by - hh * 0.45, x + ox + ww, by);
            c.closePath(); c.fillStyle = col; c.fill();
          }
        });
        for (let i = 0; i < 26; i++) { c.fillStyle = 'rgba(255,' + rr(140, 220).toFixed(0) + ',90,' + rr(0.3, 0.9).toFixed(2) + ')'; const r = rr(0.008, 0.02) * u; c.fillRect(x + rr(-0.5, 0.5) * u, bot - rr(1.3, 3.2) * u, r, r); }
      };
      PZ.forEach((z) => {
        rib(z);
        pillar(-1, z); pillar(1, z);
        if (z === 3.9) { banner(-1, z); banner(1, z); }
        if (z === 3) { brazier(-1, z); brazier(1, z); }
      });

      // bloom around the gate
      c.save(); c.globalCompositeOperation = 'lighter';
      g = c.createRadialGradient(gx, gy, 0, gx, gy, 520);
      g.addColorStop(0, 'rgba(255,190,110,.45)'); g.addColorStop(0.15, 'rgba(236,130,60,.18)'); g.addColorStop(0.5, 'rgba(180,70,30,.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.restore();

      // cold light shaft from a crack in the vault
      c.save(); c.globalCompositeOperation = 'screen';
      const shaft = [[1260, -20], [1345, -20], [930, H * 0.93], [720, H * 0.93]];
      g = c.createLinearGradient(1300, 0, 820, H * 0.93);
      g.addColorStop(0, 'rgba(170,196,230,.16)'); g.addColorStop(0.6, 'rgba(150,176,214,.07)'); g.addColorStop(1, 'rgba(150,176,214,.015)');
      c.fillStyle = g; c.beginPath(); shaft.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
      c.fillStyle = 'rgba(190,210,236,.07)'; c.beginPath(); c.ellipse(825, H * 0.93, 150, 26, 0, 0, 6.283); c.fill();
      for (let i = 0; i < 380; i++) {
        const t = rnd(), s = rnd(), x0 = 1260 + (720 - 1260) * t, x1 = 1345 + (930 - 1345) * t, y = -20 + (H * 0.93 + 20) * t;
        const r = rr(0.6, 2.2); c.fillStyle = 'rgba(210,224,244,' + rr(0.08, 0.5).toFixed(2) + ')'; c.fillRect(x0 + (x1 - x0) * s, y, r, r);
      }
      c.restore();

      // haze & floor mist
      c.save(); c.globalCompositeOperation = 'screen';
      g = c.createLinearGradient(0, HZ - 180, 0, HZ + 160);
      g.addColorStop(0, 'rgba(40,48,60,0)'); g.addColorStop(0.55, 'rgba(56,50,48,.22)'); g.addColorStop(1, 'rgba(40,48,60,0)');
      c.fillStyle = g; c.fillRect(0, HZ - 180, W, 340);
      for (let i = 0; i < 70; i++) { const y = rr(HZ + 40, H), x = rr(-100, W + 100), rx = rr(120, 420), ry = rx * 0.12; g = c.createRadialGradient(x, y, 0, x, y, rx); g.addColorStop(0, 'rgba(90,100,116,' + rr(0.02, 0.05).toFixed(3) + ')'); g.addColorStop(1, 'rgba(90,100,116,0)'); c.fillStyle = g; c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); c.fillRect(x - rx, y - rx, rx * 2, rx * 2); c.restore(); }
      c.restore();

      // hanging chains in the foreground
      [[330, 0, 300], [1640, 0, 420], [1510, 0, 170]].forEach(([x, y0, len]) => {
        for (let y = y0; y < len; y += 13) { c.strokeStyle = '#07080a'; c.lineWidth = 3.2; c.beginPath(); c.ellipse(x + Math.sin(y * 0.01) * 3, y, (y / 13) % 2 ? 2 : 5, 7, 0, 0, 6.283); c.stroke(); }
      });

      // vignette
      g = c.createRadialGradient(VX, HZ - 40, 260, VX, HZ, 1250);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, 'rgba(1,2,3,.42)'); g.addColorStop(1, 'rgba(1,2,3,.92)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      g = c.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, 'rgba(1,2,3,.85)'); g.addColorStop(1, 'rgba(1,2,3,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, 260);

      // grain
      grain(c, W, H, rnd);
  }

  // ── the three legal pages: objects kept to the left/right thirds, the text column
  // (centre, ~720px) sits on its own scrim in aria-code.css ──
  function kit(c, seed, L) {
      let sd = seed >>> 0;
      const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      const rr = (a, b) => a + rnd() * (b - a);
      const k = {
        rnd, rr,
        parch: (l) => 'hsl(38,' + (30 + 8 * l).toFixed(0) + '%,' + (7 + 50 * l).toFixed(1) + '%)',
        ink: (l) => 'rgba(40,24,10,' + (0.25 + 0.4 * l).toFixed(2) + ')',
        shadow(x, y, rx, ry, a) { c.fillStyle = 'rgba(0,0,0,' + a + ')'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.283); c.fill(); },
        glow(x, y, r, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(0.35, 'rgba(' + col + ',' + (a * 0.35) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); },
        // ashlar wall lit by L(x, y)
        wall(W, H) {
          c.fillStyle = '#040405'; c.fillRect(0, 0, W, H);
          for (let y = 0, row = 0; y < H; row++) {
            const h = rr(70, 96);
            for (let x = -(row % 2) * rr(40, 120); x < W;) {
              const w = rr(150, 260), l = L(x + w / 2, y + h / 2);
              c.fillStyle = 'hsl(' + rr(24, 32).toFixed(0) + ',' + rr(10, 18).toFixed(0) + '%,' + (1.5 + 24 * l * l + rr(-0.6, 0.6)).toFixed(1) + '%)';
              c.fillRect(x + 3, y + 3, w - 6, h - 6);
              c.fillStyle = 'rgba(255,200,140,' + (0.08 * l).toFixed(3) + ')'; c.fillRect(x + 3, y + 3, w - 6, 2);
              c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + 3, y + h - 6, w - 6, 3);
              for (let p = 0; p < 6; p++) { c.fillStyle = 'rgba(0,0,0,' + rr(0.05, 0.18).toFixed(2) + ')'; c.fillRect(x + rr(6, w - 12), y + rr(6, h - 12), rr(2, 9), rr(2, 6)); }
              x += w;
            }
            y += h;
          }
        },
        candle(x, y, h) {
          k.shadow(x, y + 6, 46, 12, 0.55);
          c.fillStyle = '#1a1410'; c.fillRect(x - 34, y - 8, 68, 14);                   // iron dish
          const g = c.createLinearGradient(x - 16, 0, x + 16, 0);
          g.addColorStop(0, '#6e5c44'); g.addColorStop(0.45, '#e8dcc0'); g.addColorStop(1, '#5a4a36');
          c.fillStyle = g; c.fillRect(x - 16, y - 8 - h, 32, h);
          c.fillStyle = '#f2e8d0'; c.beginPath(); c.ellipse(x, y - 8 - h, 16, 5, 0, 0, 6.283); c.fill();
          c.fillStyle = '#e8dcc0'; c.beginPath(); c.ellipse(x + 10, y - h + 20, 4, 14, 0, 0, 6.283); c.fill();   // drip
          const fy = y - 8 - h - 26;
          k.glow(x, fy, 560, '255,170,80', 0.26);
          k.glow(x, fy, 90, '255,220,150', 0.65);
          c.fillStyle = '#ffd890'; c.beginPath(); c.moveTo(x, fy - 26); c.quadraticCurveTo(x + 11, fy + 6, x, fy + 18); c.quadraticCurveTo(x - 11, fy + 6, x, fy - 26); c.fill();
          c.fillStyle = '#fff6dc'; c.beginPath(); c.ellipse(x, fy + 6, 4, 9, 0, 0, 6.283); c.fill();
        },
        sheet(x, y, w, h, rot, lines, seal) {
          c.save(); c.translate(x, y); c.rotate(rot);
          const l = L(x, y);
          c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-w / 2 + 10, -h / 2 + 14, w, h);
          const g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, k.parch(l * 1.15)); g.addColorStop(1, k.parch(l * 0.8));
          c.fillStyle = g; c.fillRect(-w / 2, -h / 2, w, h);
          c.fillStyle = k.ink(l); c.fillRect(-w / 2 + 24, -h / 2 + 28, w * 0.45, 5);
          for (let i = 0; i < lines; i++) { const ly = -h / 2 + 54 + i * 14; if (ly > h / 2 - 20) break; c.fillRect(-w / 2 + 24, ly, (i % 6 === 5 ? rr(0.2, 0.5) : rr(0.75, 0.9)) * (w - 48), 1.8); }
          if (seal) k.seal(w / 2 - 46, h / 2 - 42, 22, l);
          c.restore();
        },
        seal(x, y, r, l) {
          c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(x + 4, y + 4, r + 2, 0, 6.283); c.fill();
          c.fillStyle = 'hsl(4,62%,' + (8 + 26 * l).toFixed(1) + '%)'; c.beginPath();
          for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, rad = r * (i % 2 ? 0.92 : 1.04); c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
          c.fill();
          c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * 0.58, 0, 6.283); c.stroke();
          c.fillStyle = 'rgba(255,170,140,' + (0.2 + 0.3 * l).toFixed(2) + ')'; c.fillRect(x - r * 0.45, y - r * 0.55, 4, 4);
        },
        vignette(W, H) {
          const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.72);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.78)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
          grain(c, W, H, rnd);
        },
      };
      return k;
  }

  // Code de la table — an open codex on a lectern by a candle; a carved stone tablet
  function paintOath(cv) {
      const c = cv.getContext('2d'), W = 1920, H = 1080;
      const L = (x, y) => Math.min(1, Math.exp(-Math.hypot(x - 300, y - 470) / 520) + 0.55 * Math.exp(-Math.hypot(x - 1640, y - 330) / 420));
      const k = kit(c, 4410923, L), { rr } = k;
      k.wall(W, H);
      // lectern
      c.fillStyle = '#120b06'; c.fillRect(372, 700, 56, 380);
      c.fillStyle = '#1d1209'; c.beginPath(); c.moveTo(250, 1080); c.lineTo(550, 1080); c.lineTo(470, 1040); c.lineTo(330, 1040); c.fill();
      c.save(); c.translate(400, 690); c.rotate(-0.08);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(-250, -40, 520, 90);
      c.fillStyle = 'hsl(22,38%,' + (6 + 14 * L(400, 690)).toFixed(1) + '%)'; c.fillRect(-260, -30, 520, 60);
      // open book
      const bl = L(400, 640);
      [-1, 1].forEach((s) => {
        const g = c.createLinearGradient(s * 240, 0, 0, 0); g.addColorStop(0, k.parch(bl * 1.05)); g.addColorStop(0.8, k.parch(bl * 0.85)); g.addColorStop(1, k.parch(bl * 0.4));
        c.fillStyle = g; c.beginPath(); c.moveTo(0, -150); c.quadraticCurveTo(s * 120, -170, s * 240, -152); c.lineTo(s * 236, -26); c.quadraticCurveTo(s * 120, -40, 0, -20); c.closePath(); c.fill();
        c.fillStyle = k.ink(bl);
        const x0 = s < 0 ? -214 : 26;
        for (let i = 0; i < 8; i++) c.fillRect(x0, -132 + i * 13, i === 0 ? 70 : rr(140, 186), i === 0 ? 4 : 1.6);
      });
      c.fillStyle = 'hsl(350,55%,' + (8 + 22 * bl).toFixed(1) + '%)'; c.beginPath(); c.moveTo(-5, -30); c.lineTo(5, -30); c.lineTo(8, 70); c.lineTo(0, 62); c.lineTo(-8, 70); c.fill();
      c.restore();
      k.candle(170, 760, 150);
      // stone tablet, right
      c.save(); c.translate(1640, 560); c.rotate(0.03);
      const tl = L(1640, 500);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.moveTo(-190, -300); c.quadraticCurveTo(10, -400, 210, -300); c.lineTo(210, 440); c.lineTo(-190, 440); c.fill();
      const g = c.createLinearGradient(-200, -360, 200, 400); g.addColorStop(0, 'hsl(30,8%,' + (10 + 30 * tl).toFixed(1) + '%)'); g.addColorStop(1, 'hsl(30,8%,' + (5 + 12 * tl).toFixed(1) + '%)');
      c.fillStyle = g; c.beginPath(); c.moveTo(-200, -310); c.quadraticCurveTo(0, -410, 200, -310); c.lineTo(200, 430); c.lineTo(-200, 430); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-170, -290); c.quadraticCurveTo(0, -376, 170, -290); c.lineTo(170, 400); c.lineTo(-170, 400); c.closePath(); c.stroke();
      // carved sigil + engraved lines
      c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 4; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 - 1.571; c.lineTo(Math.cos(a) * 46, -250 + Math.sin(a) * 46); } c.closePath(); c.stroke();
      c.strokeStyle = 'rgba(236,164,86,' + (0.15 + 0.25 * tl).toFixed(2) + ')'; c.lineWidth = 1.5; c.stroke();
      for (let i = 0; i < 16; i++) {
        const ly = -160 + i * 32, w = i % 4 === 3 ? rr(90, 180) : rr(240, 300);
        c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(-140, ly, w, 4);
        c.fillStyle = 'rgba(255,220,170,' + (0.06 * tl).toFixed(3) + ')'; c.fillRect(-140, ly + 4, w, 1);
      }
      c.restore();
      k.vignette(W, H);
  }

  // Confidentialité — a sealed letter by a candle; an iron-bound chest under a padlock
  function paintVault(cv) {
      const c = cv.getContext('2d'), W = 1920, H = 1080;
      const L = (x, y) => Math.min(1, Math.exp(-Math.hypot(x - 260, y - 520) / 560) + 0.4 * Math.exp(-Math.hypot(x - 1600, y - 520) / 380));
      const k = kit(c, 9902117, L), { rr } = k;
      k.wall(W, H);
      // floor
      const fg = c.createLinearGradient(0, 860, 0, H); fg.addColorStop(0, '#0d0906'); fg.addColorStop(1, '#030202'); c.fillStyle = fg; c.fillRect(0, 860, W, H - 860);
      c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(0, 856, W, 6);
      // letter + candle, left
      k.candle(150, 880, 190);
      c.save(); c.translate(380, 920); c.rotate(-0.12);
      const ll = L(380, 900);
      k.shadow(10, 22, 190, 26, 0.5);
      c.fillStyle = k.parch(ll * 0.95); c.fillRect(-170, -70, 340, 140);
      c.fillStyle = k.parch(ll * 0.7); c.beginPath(); c.moveTo(-170, -70); c.lineTo(0, 10); c.lineTo(170, -70); c.fill();
      c.strokeStyle = 'rgba(60,36,14,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-170, 70); c.lineTo(-30, -6); c.moveTo(170, 70); c.lineTo(30, -6); c.stroke();
      k.seal(0, 8, 26, ll);
      c.restore();
      // a key on the floor
      c.save(); c.translate(560, 990); c.rotate(0.3);
      c.strokeStyle = 'hsl(36,30%,' + (10 + 30 * L(560, 990)).toFixed(1) + '%)'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 18, 0, 6.283); c.moveTo(18, 0); c.lineTo(110, 0); c.moveTo(92, 0); c.lineTo(92, 16); c.moveTo(106, 0); c.lineTo(106, 12); c.stroke();
      c.restore();
      // chest, right
      const cx = 1620, cy = 760, cw = 420, ch = 240, lh = 130, cl = L(cx, cy);
      k.shadow(cx, cy + ch / 2 + 10, cw * 0.62, 30, 0.6);
      const wood = (l) => 'hsl(22,40%,' + Math.max(2, 4 + 20 * l).toFixed(1) + '%)';
      c.fillStyle = wood(cl); c.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
      c.fillStyle = wood(cl * 1.1); c.beginPath(); c.moveTo(cx - cw / 2, cy - ch / 2); c.lineTo(cx - cw / 2, cy - ch / 2 - lh * 0.55); c.quadraticCurveTo(cx, cy - ch / 2 - lh * 1.35, cx + cw / 2, cy - ch / 2 - lh * 0.55); c.lineTo(cx + cw / 2, cy - ch / 2); c.fill();
      for (let i = 0; i < 9; i++) { c.strokeStyle = 'rgba(0,0,0,' + rr(0.15, 0.3).toFixed(2) + ')'; c.lineWidth = 1; const gy = cy - ch / 2 + 14 + i * 26; c.beginPath(); c.moveTo(cx - cw / 2, gy); c.lineTo(cx + cw / 2, gy + rr(-2, 2)); c.stroke(); }
      const iron = 'hsl(220,8%,' + (6 + 16 * cl).toFixed(1) + '%)';
      c.fillStyle = iron;
      [-0.38, 0.38].forEach((t) => { const bx = cx + t * cw; c.fillRect(bx - 14, cy - ch / 2 - lh * (1 - Math.abs(t) * 0.9) + 6, 28, ch + lh * (1 - Math.abs(t) * 0.9) - 6); });
      c.fillRect(cx - cw / 2, cy - ch / 2 - 6, cw, 14);
      c.fillRect(cx - cw / 2 - 4, cy + ch / 2 - 16, cw + 8, 16);
      c.fillStyle = 'rgba(255,220,180,' + (0.25 * cl).toFixed(3) + ')';
      for (let x = cx - cw / 2 + 20; x < cx + cw / 2; x += 40) { c.beginPath(); c.arc(x, cy - ch / 2 + 1, 3, 0, 6.283); c.fill(); }
      // hasp + padlock
      c.fillStyle = iron; c.fillRect(cx - 22, cy - ch / 2 - 10, 44, 70);
      c.strokeStyle = 'hsl(40,40%,' + (12 + 34 * cl).toFixed(1) + '%)'; c.lineWidth = 9; c.beginPath(); c.arc(cx, cy + 34, 26, 3.14, 6.283); c.stroke();
      const pg = c.createLinearGradient(cx - 40, 0, cx + 40, 0); pg.addColorStop(0, 'hsl(40,40%,' + (8 + 20 * cl).toFixed(1) + '%)'); pg.addColorStop(0.5, 'hsl(40,50%,' + (16 + 40 * cl).toFixed(1) + '%)'); pg.addColorStop(1, 'hsl(40,40%,' + (6 + 16 * cl).toFixed(1) + '%)');
      c.fillStyle = pg; c.beginPath(); if (c.roundRect) c.roundRect(cx - 40, cy + 30, 80, 74, 10); else c.rect(cx - 40, cy + 30, 80, 74); c.fill();
      c.fillStyle = '#050403'; c.beginPath(); c.arc(cx, cy + 60, 8, 0, 6.283); c.fill(); c.fillRect(cx - 3, cy + 60, 6, 22);
      k.glow(cx, cy + 66, 90, '236,164,86', 0.12 * cl + 0.04);
      k.vignette(W, H);
  }

  // Mentions légales — a hanging lantern; a notice board with pinned proclamations
  function paintNotice(cv) {
      const c = cv.getContext('2d'), W = 1920, H = 1080;
      const L = (x, y) => Math.min(1, Math.exp(-Math.hypot(x - 280, y - 430) / 540) + 0.35 * Math.exp(-Math.hypot(x - 1620, y - 400) / 420));
      const k = kit(c, 6630481, L), { rr } = k;
      k.wall(W, H);
      // lantern on a bracket
      c.strokeStyle = '#141210'; c.lineWidth = 10; c.beginPath(); c.moveTo(60, 220); c.lineTo(290, 220); c.stroke();
      c.lineWidth = 5; c.beginPath(); c.moveTo(80, 220); c.quadraticCurveTo(140, 300, 60, 330); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(280, 220); c.lineTo(280, 300); c.stroke();
      const lx = 280, ly = 400;
      k.glow(lx, ly, 620, '255,170,80', 0.28);
      c.fillStyle = 'rgba(255,196,120,.85)'; c.fillRect(lx - 44, ly - 70, 88, 130);
      k.glow(lx, ly, 70, '255,230,170', 0.9);
      c.fillStyle = '#18140f';
      c.beginPath(); c.moveTo(lx - 60, ly - 70); c.lineTo(lx + 60, ly - 70); c.lineTo(lx + 24, ly - 110); c.lineTo(lx - 24, ly - 110); c.fill();
      c.fillRect(lx - 64, ly + 60, 128, 18);
      [-48, -16, 16, 48].forEach((dx) => c.fillRect(lx + dx - 4, ly - 72, 8, 134));
      c.strokeStyle = '#18140f'; c.lineWidth = 4; c.beginPath(); c.arc(lx, ly - 118, 14, 0, 6.283); c.stroke();
      // notice board, right
      const bx = 1380, by = 180, bw = 480, bh = 640, bl = L(bx + bw / 2, by + bh / 2);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(bx + 16, by + 20, bw, bh);
      c.fillStyle = 'hsl(24,36%,' + (4 + 16 * bl).toFixed(1) + '%)'; c.fillRect(bx, by, bw, bh);
      c.fillStyle = 'hsl(28,30%,' + (3 + 9 * bl).toFixed(1) + '%)'; c.fillRect(bx + 26, by + 26, bw - 52, bh - 52);
      for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(0,0,0,' + rr(0.1, 0.3).toFixed(2) + ')'; c.fillRect(bx + rr(30, bw - 40), by + rr(30, bh - 40), rr(1, 3), rr(1, 3)); }
      [[bx + 140, by + 170, 190, 240, -0.05, 13, true], [bx + 340, by + 150, 170, 200, 0.06, 10, false],
       [bx + 150, by + 470, 180, 200, 0.04, 9, false], [bx + 340, by + 440, 190, 260, -0.04, 14, true]]
        .forEach(([x, y, w, h, r, n, s]) => { k.sheet(x, y, w, h, r, n, s); c.fillStyle = '#2a2622'; c.beginPath(); c.arc(x + Math.sin(r) * h / 2, y - h / 2 + 12, 6, 0, 6.283); c.fill(); });
      c.fillStyle = 'hsl(24,30%,' + (6 + 20 * bl).toFixed(1) + '%)'; c.fillRect(bx + 60, by + bh, 30, H - by - bh); c.fillRect(bx + bw - 90, by + bh, 30, H - by - bh);
      k.vignette(W, H);
  }

  const STILL = { tavern: paintTavern, desk: paintDesk, study: paintStudy, hall: paintHall, oath: paintOath, vault: paintVault, notice: paintNotice };

  function mount(scene, root = document.body) {
    if (scene === 'door' || scene === 'arch') return stone(root, scene === 'door');
    const cv = css('canvas', 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:0;');
    cv.width = 1920; cv.height = 1080;
    root.prepend(cv);
    STILL[scene](cv);
    return { layer: cv, fire: null, destroy() { cv.remove(); } };
  }

  return { mount };
})();

// <script src="aria-bg.js" data-scene="…">: pages with no script of their own (the legal
// pages) mount their scene this way, since the CSP refuses inline scripts.
if (document.currentScript && document.currentScript.dataset.scene) ariaBg.mount(document.currentScript.dataset.scene);
