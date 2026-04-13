/* Memorial Wall — Ambient particle system
 * ------------------------------------------------------------------
 * Two layers:
 *   1. "Dust"   — slow drifting gold particles throughout the Veil sky.
 *   2. "Embers" — slower, brighter particles that rise from the map
 *                 toward the names — the visual bridge between earth
 *                 and Veil.
 * Rendered onto the same Veil canvas each frame (see veil-scene.js).
 */
(function () {
    'use strict';

    var V = window.VaelorinVeil = window.VaelorinVeil || {};

    function rand(min, max) { return min + Math.random() * (max - min); }

    function createParticleSystem(opts) {
        opts = opts || {};
        var dustCount   = opts.dustCount   || 80;
        var emberCount  = opts.emberCount  || 12;
        var nebulaCount = opts.nebulaCount || 6;
        var loomCount   = opts.loomCount   || 28;
        var particles   = [];
        var nebula      = [];     // large soft drifting glows — the sky's breath
        var loom        = [];     // long diagonal threads — the sky's fabric

        function spawnDust(w, h) {
            return {
                type: 'dust',
                x: Math.random() * w,
                y: Math.random() * h,
                r: rand(0.4, 1.2),
                vx: rand(-0.08, 0.08),
                vy: rand(-0.04, 0.04),
                alpha: rand(0.15, 0.45),
                alphaPhase: Math.random() * Math.PI * 2,
                alphaSpeed: rand(0.004, 0.012)
            };
        }

        function spawnEmber(w, h) {
            return {
                type: 'ember',
                x: Math.random() * w,
                y: h + rand(0, 80),         // start just below the canvas
                r: rand(0.8, 1.6),
                vx: rand(-0.15, 0.15),
                vy: rand(-0.6, -0.25),      // rising
                alpha: 0,
                maxAlpha: rand(0.4, 0.8),
                life: 0,
                ttl: rand(280, 540)
            };
        }

        // --- Nebula: huge, soft, slowly drifting radial glows.
        // These give the sky mass. Colors are muted from the palette:
        // gold/amber, deep blue, warm white. No single blob is vivid;
        // together they make the void feel like a living presence.
        var NEBULA_COLORS = [
            { r: 212, g: 163, b: 55  },   // gold
            { r: 56,  g: 82,  b: 140 },   // deep blue
            { r: 180, g: 120, b: 70  },   // warm amber
            { r: 230, g: 220, b: 210 }    // warm white
        ];
        function spawnNebula(w, h) {
            var c = NEBULA_COLORS[Math.floor(Math.random() * NEBULA_COLORS.length)];
            var radius = rand(Math.min(w, h) * 0.35, Math.min(w, h) * 0.75);
            return {
                x: rand(-radius * 0.2, w + radius * 0.2),
                y: rand(-radius * 0.2, h + radius * 0.2),
                r: radius,
                color: c,
                alpha: rand(0.05, 0.12),          // deliberately very low
                vx: rand(-0.03, 0.03),
                vy: rand(-0.015, 0.015),
                breathPhase: Math.random() * Math.PI * 2,
                breathSpeed: rand(0.0003, 0.0007)
            };
        }

        // --- Loom: long, faint diagonal threads stretching across the
        // whole sky. These are the fabric — not connecting any specific
        // names, just the visible weave of the Veil itself.
        function spawnLoomThread(w, h) {
            // Angles cluster around two diagonals (~±30° from horizontal)
            // so the threads read as warp/weft, not chaos.
            var base = (Math.random() < 0.5) ? -0.52 : 0.52;   // radians
            var jitter = rand(-0.25, 0.25);
            var angle = base + jitter;
            // Start points randomized along the top + left edges so the
            // lines sweep across the canvas.
            var fromLeft = Math.random() < 0.5;
            var px, py;
            if (fromLeft) { px = rand(-w * 0.2, w * 0.3); py = rand(0, h); }
            else          { px = rand(0, w); py = rand(-h * 0.2, h * 0.3); }
            return {
                x: px, y: py,
                length: rand(Math.max(w, h) * 0.5, Math.max(w, h) * 1.2),
                angle: angle,
                alpha: rand(0.035, 0.075),
                vx: rand(-0.02, 0.02),
                vy: rand(-0.01, 0.01),
                shimmerPhase: Math.random() * Math.PI * 2,
                shimmerSpeed: rand(0.0004, 0.0012)
            };
        }

        function init(w, h) {
            particles.length = 0;
            nebula.length    = 0;
            loom.length      = 0;
            for (var i = 0; i < dustCount;   i++) particles.push(spawnDust(w, h));
            for (var j = 0; j < emberCount;  j++) {
                var e = spawnEmber(w, h);
                e.y = rand(h * 0.2, h);
                e.life = rand(0, e.ttl * 0.7);
                particles.push(e);
            }
            for (var k = 0; k < nebulaCount; k++) nebula.push(spawnNebula(w, h));
            for (var m = 0; m < loomCount;   m++) loom.push(spawnLoomThread(w, h));
        }

        function resize(w, h) {
            // Preserve particles but clamp positions so resize feels continuous.
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                if (p.x > w) p.x = Math.random() * w;
                if (p.y > h + 100) p.y = Math.random() * h;
            }
            // Top up if dimensions grew significantly.
            var targetDust  = Math.min(dustCount,  Math.round(w * h / 9000));
            while (particles.filter(function (p) { return p.type === 'dust'; }).length < targetDust) {
                particles.push(spawnDust(w, h));
            }
        }

        function update(w, h) {
            // Dust + embers
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                p.x += p.vx;
                p.y += p.vy;

                if (p.type === 'dust') {
                    p.alphaPhase += p.alphaSpeed;
                    if (p.x < -4)     p.x = w + 4;
                    if (p.x > w + 4)  p.x = -4;
                    if (p.y < -4)     p.y = h + 4;
                    if (p.y > h + 4)  p.y = -4;
                } else {
                    p.life++;
                    var t = p.life / p.ttl;
                    if (t < 0.3)       p.alpha = (t / 0.3) * p.maxAlpha;
                    else if (t > 0.7)  p.alpha = ((1 - t) / 0.3) * p.maxAlpha;
                    else               p.alpha = p.maxAlpha;
                    if (p.life >= p.ttl || p.y < -20) {
                        particles[i] = spawnEmber(w, h);
                    }
                }
            }

            // Nebula — slow drift, gentle wraparound with plenty of
            // overlap past the edges so we never see a hard boundary.
            for (var n = 0; n < nebula.length; n++) {
                var nb = nebula[n];
                nb.x += nb.vx;
                nb.y += nb.vy;
                nb.breathPhase += nb.breathSpeed;
                var pad = nb.r * 1.1;
                if (nb.x < -pad)       nb.x = w + pad;
                if (nb.x > w + pad)    nb.x = -pad;
                if (nb.y < -pad)       nb.y = h + pad;
                if (nb.y > h + pad)    nb.y = -pad;
            }

            // Loom threads — drift perpendicular to angle so they
            // feel like they're flowing, not just sliding.
            for (var l = 0; l < loom.length; l++) {
                var lt = loom[l];
                lt.x += lt.vx;
                lt.y += lt.vy;
                lt.shimmerPhase += lt.shimmerSpeed;
                // Recycle threads that drift off-canvas.
                if (lt.x > w + lt.length || lt.x < -lt.length * 1.3 ||
                    lt.y > h + lt.length || lt.y < -lt.length * 1.3) {
                    loom[l] = spawnLoomThread(w, h);
                }
            }
        }

        // --- Nebula render (deepest background layer).
        // Uses 'lighter' composite so overlapping blobs add light
        // gently instead of muddying each other.
        function renderNebula(ctx, w, h) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (var i = 0; i < nebula.length; i++) {
                var nb = nebula[i];
                var breath = 0.75 + 0.25 * Math.sin(nb.breathPhase);
                var a = nb.alpha * breath;
                var g = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r);
                g.addColorStop(0,   'rgba(' + nb.color.r + ',' + nb.color.g + ',' + nb.color.b + ',' + a + ')');
                g.addColorStop(0.5, 'rgba(' + nb.color.r + ',' + nb.color.g + ',' + nb.color.b + ',' + (a * 0.35) + ')');
                g.addColorStop(1,   'rgba(' + nb.color.r + ',' + nb.color.g + ',' + nb.color.b + ',0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(nb.x, nb.y, nb.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // --- Loom render (the fabric layer). Thin, faint, long.
        function renderLoom(ctx) {
            ctx.save();
            ctx.lineCap = 'round';
            for (var i = 0; i < loom.length; i++) {
                var lt = loom[i];
                var shimmer = 0.6 + 0.4 * Math.sin(lt.shimmerPhase);
                var a = lt.alpha * shimmer;
                var dx = Math.cos(lt.angle) * lt.length;
                var dy = Math.sin(lt.angle) * lt.length;
                var grad = ctx.createLinearGradient(lt.x, lt.y, lt.x + dx, lt.y + dy);
                grad.addColorStop(0,    'rgba(212, 163, 55, 0)');
                grad.addColorStop(0.2,  'rgba(212, 163, 55, ' + a + ')');
                grad.addColorStop(0.8,  'rgba(212, 163, 55, ' + a + ')');
                grad.addColorStop(1,    'rgba(212, 163, 55, 0)');
                ctx.strokeStyle = grad;
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(lt.x, lt.y);
                ctx.lineTo(lt.x + dx, lt.y + dy);
                ctx.stroke();
            }
            ctx.restore();
        }

        function render(ctx, w, h) {
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                var alpha = p.type === 'dust'
                    ? p.alpha * (0.65 + 0.35 * Math.sin(p.alphaPhase))
                    : p.alpha;
                if (alpha <= 0.01) continue;

                ctx.save();
                if (p.type === 'ember') {
                    // Soft glow for embers
                    var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
                    g.addColorStop(0,    'rgba(255, 215, 0, ' + alpha + ')');
                    g.addColorStop(0.4,  'rgba(212, 163, 55, ' + (alpha * 0.4) + ')');
                    g.addColorStop(1,    'rgba(212, 163, 55, 0)');
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'rgba(255, 230, 160, ' + alpha + ')';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillStyle = 'rgba(212, 163, 55, ' + alpha + ')';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        return {
            init:         init,
            resize:       resize,
            update:       update,
            render:       render,         // dust + embers (foreground)
            renderNebula: renderNebula,   // deep background glows
            renderLoom:   renderLoom      // woven fabric across the sky
        };
    }

    V.createParticleSystem = createParticleSystem;
})();
