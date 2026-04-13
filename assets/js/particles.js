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
        var particles   = [];

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

        function init(w, h) {
            particles.length = 0;
            for (var i = 0; i < dustCount;  i++) particles.push(spawnDust(w, h));
            for (var j = 0; j < emberCount; j++) {
                var e = spawnEmber(w, h);
                e.y = rand(h * 0.2, h);      // pre-seed spread so we don't wait
                e.life = rand(0, e.ttl * 0.7);
                particles.push(e);
            }
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
            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                p.x += p.vx;
                p.y += p.vy;

                if (p.type === 'dust') {
                    p.alphaPhase += p.alphaSpeed;
                    // Wrap around edges.
                    if (p.x < -4)     p.x = w + 4;
                    if (p.x > w + 4)  p.x = -4;
                    if (p.y < -4)     p.y = h + 4;
                    if (p.y > h + 4)  p.y = -4;
                } else {
                    // ember — fade in, drift up, fade out, respawn
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
            init:   init,
            resize: resize,
            update: update,
            render: render
        };
    }

    V.createParticleSystem = createParticleSystem;
})();
