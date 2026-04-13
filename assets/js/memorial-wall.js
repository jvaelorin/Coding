/* Memorial Wall — Main orchestrator
 * ------------------------------------------------------------------
 * Wires together: data load → map render → veil scene → UI controls →
 * single requestAnimationFrame loop that paints particles, threads,
 * and names onto the same canvas. The map lives in a separate SVG.
 *
 * Coordinate model:
 *   - Veil canvas uses CSS pixels (logical) inside its own bounding rect.
 *   - Map anchors are stored in *page* coords; we translate them into
 *     veil-canvas coords each frame so threads can extend outside the
 *     veil's own rect into the map below.
 *
 * Performance notes:
 *   - Single canvas, single rAF loop.
 *   - Particles + names + threads share the same paint pass.
 *   - Threads only drawn for non-dimmed names (keeps frame budget low
 *     when filtering).
 *   - Reduced motion: no drift, no particles, no pulses.
 */
(function () {
    'use strict';

    var V = window.VaelorinVeil = window.VaelorinVeil || {};

    document.addEventListener('DOMContentLoaded', boot);

    function boot() {
        var root         = document.getElementById('memorial-wall');
        if (!root) return;

        var veilSection  = root.querySelector('.mw-veil');
        var canvas       = root.querySelector('#mw-veil-canvas');
        var ctx          = canvas.getContext('2d');
        var mapSvg       = root.querySelector('#mw-map-svg');

        var prefersReduced = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) root.classList.add('mw-reduced-motion');

        var config       = window.VaelorinVeilConfig || {};

        // 1. Veil scene
        var scene = V.createVeilScene({
            canvas: canvas,
            reducedMotion: prefersReduced
        });

        // 2. Particle system (skipped under reduced motion)
        var particles = prefersReduced ? null : V.createParticleSystem({
            dustCount:  isMobile() ? 36 : 80,
            emberCount: isMobile() ? 5  : 12
        });

        // 3. Map
        var map = V.createUSMap({
            svg:     mapSvg,
            dataUrl: config.usMapUrl,
            onHover: function (abbr, name, count, event) {
                if (!abbr) {
                    ui.hideStateTooltip();
                    scene.setStateHover(null);
                    return;
                }
                ui.showStateTooltip(abbr, name, count, event);
                scene.setStateHover(abbr);
            },
            onSelect: function (abbr) {
                scene.setStateFilter(abbr);
            }
        });
        V.map = map; // expose for ui-controls.stateName()

        // 4. UI controls
        var ui = V.initUIControls({
            root: root,
            onSectionChange: function (section) {
                scene.setSection(section);
            }
        });

        // ---- Pointer interaction on the veil canvas ----
        canvas.addEventListener('mousemove', function (e) {
            var rect = canvas.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;
            var hit = scene.onPointerMove(x, y);
            if (hit) {
                canvas.style.cursor = 'pointer';
                ui.showNameTooltip(hit, e.clientX, e.clientY);
            } else {
                canvas.style.cursor = 'default';
                ui.hideNameTooltip();
            }
        });
        canvas.addEventListener('mouseleave', function () {
            scene.clearHover();
            ui.hideNameTooltip();
            canvas.style.cursor = 'default';
        });
        canvas.addEventListener('click', function (e) {
            var rect = canvas.getBoundingClientRect();
            var hit = scene.pickAt(e.clientX - rect.left, e.clientY - rect.top);
            if (hit) ui.openModal(hit);
        });

        canvas.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) return;
            var t = e.touches[0];
            var rect = canvas.getBoundingClientRect();
            var hit = scene.pickAt(t.clientX - rect.left, t.clientY - rect.top);
            if (hit) {
                e.preventDefault();
                ui.openModal(hit);
            }
        }, { passive: false });

        canvas.setAttribute('tabindex', '0');
        canvas.setAttribute('role', 'application');
        canvas.setAttribute('aria-label', 'The Veil — interactive memorial sky');

        window.addEventListener('resize', debounce(handleResize, 150));
        window.addEventListener('scroll', function () {
            map.recomputeAnchors && map.recomputeAnchors();
        }, { passive: true });

        // 5. Load data, then bring the wall up.
        V.fetchMemorials().then(function (memorials) {
            scene.setMemorials(memorials);
            ui.renderList(memorials);

            return map.load().then(function () {
                map.init();
                handleResize();
                map.setCounts(scene.getStateCounts());
                start();
                requestAnimationFrame(function () {
                    root.classList.add('is-ready');
                });
            });
        }).catch(function (err) {
            console.error('[Veil] Boot failed', err);
            root.classList.add('is-ready');
        });

        function handleResize() {
            var vr = veilSection.getBoundingClientRect();
            scene.resize(vr.width, vr.height);
            map.resize();
            if (particles) particles.init(vr.width, vr.height);
        }

        // ---- The single render loop ----
        function frame(now) {
            if (document.hidden) {
                requestAnimationFrame(frame);
                return;
            }

            var vr   = veilSection.getBoundingClientRect();
            var w    = vr.width;
            var h    = vr.height;
            var dpr  = scene.getDpr();

            // Establish a single transform for the whole frame: scale by
            // DPR so we can author all draws in CSS pixel units.
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            // Update background motion once per frame.
            if (particles) particles.update(w, h);

            // 1. Nebula — deep glowing clouds. Gives the void mass.
            //    Drawn first so everything else sits in front of it.
            if (particles) particles.renderNebula(ctx, w, h);

            // 2. Loom — long faint diagonal threads stretched across the
            //    entire sky. The visible fabric of the Veil itself.
            if (particles) particles.renderLoom(ctx, w, h);

            // 3. Update name positions BEFORE drawing any threads so the
            //    weave + down-threads aim at this frame's positions.
            scene.update(now);

            // 4. The Pattern — name-to-name weave (knots in the fabric).
            V.threadLines.drawWeave(ctx, scene.getMemorials(), scene.getEdges(), now);

            // 5. Down-threads — from each visible name to its state anchor.
            //    Map anchors are in page coords; translate into canvas-local.
            var canvasRect = canvas.getBoundingClientRect();
            scene.each(function (n) {
                if (!n.state || n.dimmed) return;
                var anchor = map.getAnchor(n.state);
                if (!anchor) return;
                V.threadLines.draw(ctx, n, {
                    x: anchor.px - canvasRect.left,
                    y: anchor.py - canvasRect.top
                }, null, now);
            });

            // 6. Names — drawn on top of all threads
            scene.render(ctx, now);

            // 7. Dust + embers — foreground sparkle; sits in front of names
            //    so they shimmer past, the way real motes catch the light.
            if (particles) particles.render(ctx, w, h);

            requestAnimationFrame(frame);
        }

        function start() {
            requestAnimationFrame(frame);
        }

        function isMobile() {
            return window.innerWidth < 768;
        }

        function debounce(fn, ms) {
            var t;
            return function () {
                clearTimeout(t);
                var args = arguments, ctx = this;
                t = setTimeout(function () { fn.apply(ctx, args); }, ms);
            };
        }
    }
})();
