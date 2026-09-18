// ═══════════════════════════════════════════
//  DUNGEON ENTRANCE BACKGROUND
// ═══════════════════════════════════════════
// Procedural stone archway + twin brazier fire, ported from the "Clé de
// sauvegarde" frame of the graphic redesign mockup (aria/project/Aria Refonte.dc.html).
// Self-contained — no dependency on aria-shared.js — so index.html can load it
// standalone. Auto-mounts into #dungeon-bg-root if that element exists on the page.
//
// Used on: index.html, and the save-key gateway / character-selection screens of
// aria-player.html / aria-gm.html. Never on the live OBS overlay (must stay
// transparent) or the overlay editor (fully covered by opaque panels).

function ariaDungeonBg(container) {
    container.style.pointerEvents = 'none';
    const layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;';
    const stoneCv = document.createElement('canvas');
    stoneCv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    const brazierCv = document.createElement('canvas');
    brazierCv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    const vignette = document.createElement('div');
    vignette.style.cssText = 'position:absolute;inset:0;box-shadow:inset 0 0 220px 46px rgba(2,3,5,.7);';
    layer.append(stoneCv, brazierCv, vignette);
    container.prepend(layer);

    let stoneW = 0, stoneH = 0;
    let raf = null, iv = null, onResize = null, brzWatch = null, active = true;

    // ---- procedural masonry: big shapes -> edges (bevel/chip) -> surface noise -> wear
    function paintStone(tries) {
        tries = tries || 0;
        if (!stoneCv.clientWidth) { if (tries < 40) setTimeout(() => paintStone(tries + 1), 100); return; }
        const w = stoneCv.clientWidth, h = stoneCv.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
        stoneCv.width = Math.round(w * dpr); stoneCv.height = Math.round(h * dpr);
        const c = stoneCv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        stoneW = w; stoneH = h;

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
        for (let y = -20; y < h;) {
            const bh = rr(44, 62);
            let x = -rr(20, 160);
            while (x < w) {
                const bw = rr(82, 186);
                face(x, y, bw, bh, rr(11.5, 16.5));
                x += bw + rr(3.5, 6);
            }
            y += bh + rr(3.5, 6);
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
            for (let y = springY; y < h - FLOOR;) {
                const bh = rr(40, 58), x = side < 0 ? cx - R_OUT : cx + R_IN;
                face(x + rr(0, 2), y, R_OUT - R_IN - rr(1, 3), Math.min(bh, h - FLOOR - y), rr(12.5, 17.5));
                y += bh + rr(3.5, 5);
            }
        }

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
            for (let y = h - FLOOR - PH; y < h - FLOOR;) {
                const bh = rr(38, 52);
                face(x0 + rr(0, 1.5), y, PW - rr(0, 2), Math.min(bh, h - FLOOR - y), rr(12, 17));
                y += bh + rr(3, 4.5);
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

        // ---- floor flagstones
        c.save();
        c.beginPath(); c.rect(0, h - FLOOR, w, FLOOR); c.clip();
        c.fillStyle = '#07080b'; c.fillRect(0, h - FLOOR, w, FLOOR);
        for (let y = h - FLOOR; y < h;) {
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
        // ---- structural cracks: run across several courses, branch, catch light on one lip
        const crack = (x, y, len, dir, depth) => {
            let px0 = x, py0 = y, ang = dir;
            const pts = [[px0, py0]];
            const segs = Math.round(len / rr(12, 22));
            for (let i = 0; i < segs; i++) {
                ang += rr(-0.42, 0.42);
                px0 += Math.cos(ang) * (len / segs); py0 += Math.sin(ang) * (len / segs);
                pts.push([px0, py0]);
            }
            c.lineCap = 'round';
            c.strokeStyle = 'rgba(206,220,238,.05)'; c.lineWidth = rr(1, 2);
            c.beginPath(); c.moveTo(pts[0][0] - 1.5, pts[0][1] - 1.5);
            for (const p of pts) c.lineTo(p[0] - 1.5, p[1] - 1.5);
            c.stroke();
            c.strokeStyle = 'rgba(0,0,0,' + rr(0.5, 0.82).toFixed(2) + ')'; c.lineWidth = rr(1.4, 3.4);
            c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
            for (const p of pts) c.lineTo(p[0], p[1]);
            c.stroke();
            if (depth > 0) {
                for (let b = 0; b < Math.round(rr(1, 3)); b++) {
                    const p = pts[Math.floor(rr(1, pts.length - 1))];
                    crack(p[0], p[1], len * rr(0.25, 0.5), ang + rr(-1.1, 1.1), depth - 1);
                }
            }
        };
        for (let i = 0; i < 9; i++) {
            for (let t = 0; t < 30; t++) {
                const x = rr(0, w), y = rr(-10, h * 0.55);
                if (inOpening(x, y, -30)) continue;
                crack(x, y, rr(120, 380), rr(1.0, 2.1), 2); break;
            }
        }
        for (let i = 0; i < 5; i++) {
            for (let t = 0; t < 30; t++) {
                const x = rr(0, w), y = rr(h - FLOOR - 220, h - FLOOR);
                if (inOpening(x, y, -30)) continue;
                crack(x, y, rr(80, 200), rr(-1.4, -1.9), 1); break;
            }
        }

        // ---- broken stone: missing chunks and shallow spalling
        const chunk = (x, y, rad) => {
            const pts = [], n = Math.round(rr(7, 11));
            for (let i = 0; i < n; i++) {
                const a = (i / n) * 6.2832, rp = rad * rr(0.5, 1.15);
                pts.push([x + Math.cos(a) * rp, y + Math.sin(a) * rp * rr(0.6, 1)]);
            }
            c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
            for (const p of pts) c.lineTo(p[0], p[1]);
            c.closePath();
            c.save(); c.clip();
            c.fillStyle = '#05060a'; c.fillRect(x - rad * 2, y - rad * 2, rad * 4, rad * 4);
            const dg2 = c.createRadialGradient(x - rad * 0.3, y - rad * 0.5, 0, x, y, rad * 1.3);
            dg2.addColorStop(0, 'rgba(58,64,76,.5)'); dg2.addColorStop(0.5, 'rgba(14,16,20,.6)'); dg2.addColorStop(1, 'rgba(0,0,0,.85)');
            c.fillStyle = dg2; c.fillRect(x - rad * 2, y - rad * 2, rad * 4, rad * 4);
            for (let k = 0; k < 30; k++) {
                c.fillStyle = 'rgba(0,0,0,' + rr(0.1, 0.3).toFixed(2) + ')';
                c.beginPath(); c.arc(x + rr(-rad, rad), y + rr(-rad, rad), rr(0.5, 2), 0, 6.2832); c.fill();
            }
            c.restore();
            // fractured lip catching the light
            c.strokeStyle = 'rgba(214,226,242,.1)'; c.lineWidth = 1.6;
            c.beginPath();
            for (let i = 0; i < pts.length / 2; i++) c.lineTo(pts[i][0], pts[i][1] - 1.5);
            c.stroke();
        };
        for (let i = 0; i < 11; i++) {
            for (let t = 0; t < 30; t++) {
                const x = rr(30, w - 30), y = rr(20, h - FLOOR - 30), rad = rr(9, 26);
                if (inOpening(x, y, -(rad + 12))) continue;
                chunk(x, y, rad); break;
            }
        }
        for (let i = 0; i < 6; i++) {   // spalled faces: paler fresh stone under the weathered skin
            let x = 0, y = 0, rad = 0, ok = false;
            for (let t = 0; t < 30; t++) {
                x = rr(40, w - 40); y = rr(30, h - FLOOR - 40); rad = rr(16, 40);
                if (!inOpening(x, y, -(rad + 12))) { ok = true; break; }
            }
            if (!ok) continue;
            c.save();
            c.beginPath();
            for (let k = 0, n = 9; k < n; k++) { const a = (k / n) * 6.2832; c.lineTo(x + Math.cos(a) * rad * rr(0.6, 1.1), y + Math.sin(a) * rad * rr(0.5, 1)); }
            c.closePath(); c.clip();
            c.fillStyle = col(rr(17, 21), 7); c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
            const sp = c.createRadialGradient(x, y - rad * 0.4, 0, x, y, rad * 1.2);
            sp.addColorStop(0, 'rgba(220,230,244,.06)'); sp.addColorStop(1, 'rgba(0,0,0,.4)');
            c.fillStyle = sp; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
            c.restore();
            c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; c.stroke();
        }

        // ---- moss: settles in joints, in shade, and low on the wall
        const mossPatch = (x, y, spread, density) => {
            for (let i = 0; i < density; i++) {
                const mx = x + rr(-spread, spread), my = y + rr(-spread * 0.4, spread * 0.4);
                const rad = rr(1.6, 8);
                const g = c.createRadialGradient(mx, my, 0, mx, my, rad);
                const hue = rr(88, 132), sat = rr(16, 34), lig = rr(11, 23);
                g.addColorStop(0, 'hsla(' + hue.toFixed(0) + ',' + sat.toFixed(0) + '%,' + lig.toFixed(0) + '%,' + rr(0.3, 0.7).toFixed(2) + ')');
                g.addColorStop(1, 'hsla(' + hue.toFixed(0) + ',' + sat.toFixed(0) + '%,' + (lig * 0.6).toFixed(0) + '%,0)');
                c.fillStyle = g;
                c.beginPath(); c.ellipse(mx, my, rad, rad * rr(0.5, 0.9), rr(0, 3), 0, 6.2832); c.fill();
            }
            for (let i = 0; i < density / 3; i++) {   // lit fuzz on top of the cushion
                c.fillStyle = 'hsla(' + rr(78, 108).toFixed(0) + ',' + rr(22, 40).toFixed(0) + '%,' + rr(24, 34).toFixed(0) + '%,' + rr(0.12, 0.3).toFixed(2) + ')';
                c.beginPath(); c.arc(x + rr(-spread, spread), y + rr(-spread * 0.4, spread * 0.2), rr(0.5, 2), 0, 6.2832); c.fill();
            }
        };
        // 1. along the wall-floor junction, where water sits — the heaviest growth
        for (let x = -20; x < w + 20; x += rr(40, 110)) {
            if (inOpening(x, h - FLOOR - 10, -20)) continue;
            mossPatch(x, h - FLOOR - rr(2, 16), rr(26, 64), Math.round(rr(60, 130)));
        }
        // 2. seated in horizontal joints on the lower wall, fading upward
        for (let i = 0; i < 22; i++) {
            for (let t = 0; t < 30; t++) {
                const x = rr(0, w), y = h - FLOOR - Math.pow(rnd(), 1.8) * (h - FLOOR) * 0.72;
                if (inOpening(x, y, -26)) continue;
                mossPatch(x, y, rr(14, 44), Math.round(rr(26, 70))); break;
            }
        }
        // 3. creeping along the outside of the portal reveal, both haunches
        for (const side of [-1, 1]) {
            for (let i = 0; i < 7; i++) {
                const a = Math.PI + side * rr(0.08, 1.5);
                const rad = R_IN + rr(6, 44);
                mossPatch(cx + Math.cos(a) * rad, springY + Math.sin(a) * rad, rr(12, 30), Math.round(rr(22, 54)));
            }
            // base of each jamb and each pillar
            mossPatch(cx + side * (R_IN + rr(10, 46)), h - FLOOR - rr(0, 14), rr(18, 40), Math.round(rr(40, 90)));
            mossPatch(cx + side * PX + rr(-24, 24), h - FLOOR - rr(0, 12), rr(20, 38), Math.round(rr(40, 80)));
            // on the pillar cap ledge, where debris collects
            mossPatch(cx + side * PX + rr(-30, 30), h - FLOOR - PH - CAPH + rr(0, 8), rr(14, 30), Math.round(rr(20, 46)));
        }

        // ---- hanging greenery: strands falling off ledges and the arch
        const leaf = (x, y, r2, ang, hue, alpha) => {
            c.save(); c.translate(x, y); c.rotate(ang);
            const g = c.createLinearGradient(0, -r2, 0, r2);
            g.addColorStop(0, 'hsla(' + hue.toFixed(0) + ',' + rr(24, 44).toFixed(0) + '%,' + rr(20, 32).toFixed(0) + '%,' + alpha.toFixed(2) + ')');
            g.addColorStop(1, 'hsla(' + hue.toFixed(0) + ',' + rr(20, 36).toFixed(0) + '%,' + rr(9, 16).toFixed(0) + '%,' + alpha.toFixed(2) + ')');
            c.fillStyle = g;
            c.beginPath(); c.ellipse(0, 0, r2 * rr(0.4, 0.62), r2, 0, 0, 6.2832); c.fill();
            c.restore();
        };
        const vine = (x, y, len, lean) => {
            const hue = rr(84, 128), steps = Math.round(len / 9);
            let vx = x, vy = y, drift = lean;
            c.strokeStyle = 'hsla(' + hue.toFixed(0) + ',26%,14%,.75)'; c.lineWidth = rr(1, 2.2); c.lineCap = 'round';
            c.beginPath(); c.moveTo(vx, vy);
            const pts = [];
            for (let i = 0; i < steps; i++) {
                drift += rr(-0.12, 0.12);
                vx += drift * 3.2; vy += 9;
                c.lineTo(vx, vy); pts.push([vx, vy, drift]);
            }
            c.stroke();
            for (const p of pts) {
                if (rnd() < 0.62) {
                    const side = rnd() > 0.5 ? 1 : -1;
                    leaf(p[0] + side * rr(1, 5), p[1] + rr(-2, 2), rr(2.6, 6.4), side * rr(0.5, 1.5) + p[2] * 0.4, hue, rr(0.45, 0.85));
                }
            }
            // tip droop
            leaf(vx, vy + 3, rr(3, 6), rr(-0.3, 0.3), hue, rr(0.4, 0.7));
        };
        // off the arch extrados
        for (let i = 0; i < 16; i++) {
            const a = Math.PI + rr(0.12, Math.PI - 0.12);
            const ax = cx + Math.cos(a) * (R_OUT - rr(2, 16)), ay = springY + Math.sin(a) * (R_OUT - rr(2, 16));
            vine(ax, ay, rr(26, 110), rr(-0.5, 0.5));
        }
        // off the pillar caps and bowls' ledge
        for (const side of [-1, 1]) {
            for (let i = 0; i < 4; i++) vine(cx + side * PX + rr(-38, 38), h - FLOOR - PH - CAPH + rr(0, 6), rr(28, 96), rr(-0.4, 0.4));
        }
        // off high wall ledges — solid stone only, and never over the opening
        for (let i = 0; i < 14; i++) {
            for (let t = 0; t < 30; t++) {
                const x = rr(0, w), y = rr(20, h * 0.55), len = rr(24, 90);
                if (inOpening(x, y, -10) || inOpening(x, y + len, -10)) continue;
                vine(x, y, len, rr(-0.5, 0.5)); break;
            }
        }

        // ---- global grain (fine + coarse), keeps the stone from reading as vector
        const N = 160, nc = document.createElement('canvas'); nc.width = N; nc.height = N;
        const nx = nc.getContext('2d'), id = nx.createImageData(N, N), dd = id.data;
        for (let i = 0; i < dd.length; i += 4) {
            const v = 90 + Math.floor(rnd() * 90);
            dd[i] = dd[i + 1] = dd[i + 2] = v; dd[i + 3] = 26;
        }
        nx.putImageData(id, 0, 0);
        c.globalCompositeOperation = 'overlay';
        for (const s of [1, 2.6]) {
            c.globalAlpha = s === 1 ? 0.5 : 0.32;
            for (let y = 0; y < h; y += N * s) for (let x = 0; x < w; x += N * s) c.drawImage(nc, x, y, N * s, N * s);
        }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';

        // ---- ambient occlusion: corners and the deep bottom
        const vg = c.createRadialGradient(cx, h * 0.5, Math.min(w, h) * 0.28, cx, h * 0.5, Math.max(w, h) * 0.78);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,3,5,.72)');
        c.fillStyle = vg; c.fillRect(0, 0, w, h);
    }

    function startEmbers(tries) {
        tries = tries || 0;
        if (!brazierCv.clientWidth) {
            if (tries < 40) setTimeout(() => startEmbers(tries + 1), 100);
            return;
        }
        const ctx = brazierCv.getContext('2d');
        let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
        const fit = () => {
            w = brazierCv.clientWidth; h = brazierCv.clientHeight;
            brazierCv.width = Math.round(w * dpr); brazierCv.height = Math.round(h * dpr);
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
        onResize = () => { fit(); if (stoneCv.clientWidth !== stoneW) paintStone(); em = emitters(); flames.forEach((f, i) => f.e = em[i % 2]); sparks.forEach((s, i) => s.e = em[i % 2]); smoke.forEach((m, i) => m.e = em[i % 2]); };
        window.addEventListener('resize', onResize);

        let last = performance.now(), frames = 0, mode = 'raf';
        const tick = (t) => {
            if (!active) { raf = requestAnimationFrame(tick); return; }
            try {
                const dt = Math.min(t - last, 48); last = t;
                ctx.clearRect(0, 0, w, h);
                ctx.globalCompositeOperation = 'lighter';

                // ---- animated light: flickering pools on wall, arch and floor
                em.forEach((e) => {
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
                frames++;
            } catch (err) { return; }
            if (mode === 'raf') raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        // watchdog: some hosts pause rAF (hidden/offscreen iframe) — fall back to a timer
        brzWatch = setTimeout(() => {
            if (frames === 0) {
                mode = 'timer';
                if (raf) cancelAnimationFrame(raf);
                clearInterval(iv);
                iv = setInterval(() => tick(performance.now()), 34);
            }
        }, 600);
    }

    paintStone();
    startEmbers();

    return {
        // Pauses the fire animation AND hides the layer once the app itself is showing.
        // Hiding matters as much as pausing: the container is `position:fixed` above the
        // rest of the page (so it can sit behind the gateway/selection overlays, which are
        // z-index 9999/10000), and left visible it would paint over the app panel instead
        // of behind it. Pausing on top of that saves CPU/GPU on a machine also running OBS.
        setActive(v) {
            active = v;
            layer.style.display = v ? '' : 'none';
        },
        destroy() {
            active = false;
            if (raf) cancelAnimationFrame(raf);
            clearInterval(iv); clearTimeout(brzWatch);
            if (onResize) window.removeEventListener('resize', onResize);
            layer.remove();
        },
    };
}

(function () {
    const root = document.getElementById('dungeon-bg-root');
    if (root) window.ariaDungeonBg = ariaDungeonBg(root);
})();
