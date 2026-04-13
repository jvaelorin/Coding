/* Memorial Wall — Veil scene
 * ------------------------------------------------------------------
 * The Veil is a 2D canvas scene. Each name is a floating label with
 * gentle drift and a small parallax-derived depth so the sky feels
 * volumetric without the cost of a full WebGL stack.
 *
 * Names are clustered into four sacred sections:
 *   - children       (upper-center, brighter/whiter "closest to light")
 *   - loved_one      (center-left,  gold)
 *   - companion      (center-right, warm amber)
 *   - service_member (lower-center, deep blue + gold edge — "still on watch")
 *
 * The scene exposes:
 *   setMemorials(list)  — refresh the name set
 *   setSection(name)    — fade non-matching sections
 *   setStateFilter(abb) — fade names whose state != abbr (null = all)
 *   render(ctx, now)    — draw frame
 *   pickAt(x, y)        — hit-test for tooltips/clicks
 *   each(fn)            — iterate all rendered names with screen coords
 *   resize(w, h)        — relayout
 *   onPointerMove(x,y)  — track hover
 */
(function () {
    'use strict';

    var V = window.VaelorinVeil = window.VaelorinVeil || {};

    var SECTION_COLORS = {
        loved_one:      { r: 245, g: 230, b: 211, edge: '#D4A337' },
        child:          { r: 255, g: 255, b: 255, edge: '#E8E8E8' },
        companion:      { r: 246, g: 224, b: 168, edge: '#C9A227' },
        service_member: { r: 200, g: 220, b: 255, edge: '#D4A337' }
    };

    var CATEGORY_LABELS = {
        loved_one:      'Loved One',
        child:          'Child',
        companion:      'Companion',
        service_member: 'Service Member'
    };

    function createVeilScene(opts) {
        var canvas = opts.canvas;
        var dpr    = Math.min(window.devicePixelRatio || 1, 2);
        var width  = 0;
        var height = 0;
        var names  = [];
        var section = 'all';
        var stateFilter = null;
        var hoveredId = null;
        var pointer = { x: -1, y: -1 };
        var reducedMotion = !!opts.reducedMotion;

        function sectionLayoutBox(sectionKey, w, h) {
            // Returns { cx, cy, rx, ry } — center + radii of the elliptical
            // region in the sky for this section.
            switch (sectionKey) {
                case 'child':
                    return { cx: w * 0.50, cy: h * 0.18, rx: w * 0.32, ry: h * 0.13 };
                case 'loved_one':
                    return { cx: w * 0.28, cy: h * 0.48, rx: w * 0.22, ry: h * 0.22 };
                case 'companion':
                    return { cx: w * 0.72, cy: h * 0.48, rx: w * 0.22, ry: h * 0.22 };
                case 'service_member':
                    return { cx: w * 0.50, cy: h * 0.82, rx: w * 0.36, ry: h * 0.12 };
                default:
                    return { cx: w * 0.50, cy: h * 0.50, rx: w * 0.40, ry: h * 0.30 };
            }
        }

        function layoutNames() {
            // Distribute names into their section's elliptical region using
            // a deterministic seeded layout so the wall feels "placed,"
            // not random — and so each name keeps its position across rerenders.
            var bySection = { loved_one: [], child: [], companion: [], service_member: [] };
            names.forEach(function (n) { (bySection[n.category] || bySection.loved_one).push(n); });

            Object.keys(bySection).forEach(function (key) {
                var box = sectionLayoutBox(key, width, height);
                var arr = bySection[key];
                var count = arr.length;
                arr.forEach(function (n, i) {
                    // Golden-angle spiral within the ellipse for natural spacing.
                    var t = (i + 0.5) / Math.max(count, 1);
                    var angle = i * 2.39996; // golden angle
                    var radius = Math.sqrt(t);
                    n.baseX = box.cx + Math.cos(angle) * radius * box.rx;
                    n.baseY = box.cy + Math.sin(angle) * radius * box.ry;

                    // Depth (0 = far, 1 = near) for parallax + size variance.
                    if (n.depth == null) n.depth = 0.4 + (hash01(n.id || n.name) * 0.6);

                    // Gentle drift parameters
                    n.driftPhaseX = hash01(n.id + 'x') * Math.PI * 2;
                    n.driftPhaseY = hash01(n.id + 'y') * Math.PI * 2;
                    n.driftAmpX   = 6  + hash01(n.id + 'ax') * 14;
                    n.driftAmpY   = 4  + hash01(n.id + 'ay') * 10;
                    n.driftSpeed  = 0.00015 + hash01(n.id + 's') * 0.00025;

                    n.pulseOffset = hash01(n.id + 'p') * 5200;

                    n.x = n.baseX;
                    n.y = n.baseY;

                    // Cached font size based on depth + section
                    var base = key === 'child' ? 15 : 14;
                    n.fontSize = Math.round(base + n.depth * 6);
                });
            });
        }

        // Cheap deterministic 0..1 hash for string keys.
        function hash01(str) {
            str = String(str || '');
            var h = 2166136261 >>> 0;
            for (var i = 0; i < str.length; i++) {
                h ^= str.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return ((h >>> 0) % 100000) / 100000;
        }

        function setMemorials(list) {
            names = list.map(function (m, i) {
                return Object.assign({
                    _idx: i,
                    width: 0,
                    height: 0
                }, m);
            });
            layoutNames();
        }

        function setSection(s) {
            section = s || 'all';
        }

        function setStateFilter(abbr) {
            stateFilter = abbr || null;
        }

        function setStateHover(abbr) {
            for (var i = 0; i < names.length; i++) {
                names[i].stateHovered = !!(abbr && names[i].state === abbr);
            }
        }

        function resize(w, h) {
            width  = w;
            height = h;
            // HiDPI backing store
            canvas.width  = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.width  = w + 'px';
            canvas.style.height = h + 'px';
            layoutNames();
        }

        function update(now) {
            for (var i = 0; i < names.length; i++) {
                var n = names[i];
                if (reducedMotion) {
                    n.x = n.baseX;
                    n.y = n.baseY;
                } else {
                    var t = now * n.driftSpeed;
                    n.x = n.baseX + Math.cos(t + n.driftPhaseX) * n.driftAmpX;
                    n.y = n.baseY + Math.sin(t + n.driftPhaseY) * n.driftAmpY;
                }

                n.dimmed = isDimmed(n);
                n.hovered = (n.id === hoveredId);
            }
        }

        function isDimmed(n) {
            if (section !== 'all' && n.category !== section) return true;
            if (stateFilter && n.state !== stateFilter)       return true;
            return false;
        }

        function render(ctx, now) {
            // Caller is responsible for scaling/clearing AND for calling
            // update() before this if it needs fresh positions. We just
            // paint the names in CSS pixel units against the current transform.

            // Two passes: dimmed names underneath, active on top.
            for (var pass = 0; pass < 2; pass++) {
                for (var i = 0; i < names.length; i++) {
                    var n = names[i];
                    var active = !n.dimmed;
                    if (pass === 0 && active)  continue;
                    if (pass === 1 && !active) continue;
                    drawName(ctx, n);
                }
            }
        }

        function drawName(ctx, n) {
            var color = SECTION_COLORS[n.category] || SECTION_COLORS.loved_one;
            var depthAlpha = 0.55 + n.depth * 0.45;
            var alpha = n.dimmed ? 0.18 : (n.hovered ? 1 : depthAlpha);

            ctx.save();
            ctx.font = '500 ' + n.fontSize + 'px "Cormorant Garamond", Georgia, serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Soft glow halo
            if (!n.dimmed) {
                var glowR = n.hovered ? 26 : 14;
                var halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
                halo.addColorStop(0,
                    'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (alpha * 0.35) + ')');
                halo.addColorStop(1,
                    'rgba(' + color.r + ',' + color.g + ',' + color.b + ',0)');
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
                ctx.fill();
            }

            // Service member tinted underline
            if (n.category === 'service_member' && !n.dimmed) {
                var w = ctx.measureText(n.name).width;
                ctx.strokeStyle = 'rgba(212, 163, 55, ' + (alpha * 0.7) + ')';
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(n.x - w / 2 - 4, n.y + n.fontSize * 0.62);
                ctx.lineTo(n.x + w / 2 + 4, n.y + n.fontSize * 0.62);
                ctx.stroke();
            }

            // The name itself
            ctx.shadowColor = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (alpha * 0.9) + ')';
            ctx.shadowBlur  = n.hovered ? 14 : 6;
            ctx.fillStyle   = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + alpha + ')';
            ctx.fillText(n.name, n.x, n.y);

            // Cache measured size for hit testing
            if (!n._measuredAt || n._measuredFontSize !== n.fontSize) {
                n.width  = ctx.measureText(n.name).width + 12;
                n.height = n.fontSize + 8;
                n._measuredFontSize = n.fontSize;
                n._measuredAt = true;
            }

            ctx.restore();
        }

        function pickAt(x, y) {
            // Top-down hit testing — iterate in reverse render order.
            for (var i = names.length - 1; i >= 0; i--) {
                var n = names[i];
                if (n.dimmed) continue;
                if (Math.abs(x - n.x) <= n.width / 2 && Math.abs(y - n.y) <= n.height / 2) {
                    return n;
                }
            }
            return null;
        }

        function onPointerMove(x, y) {
            pointer.x = x;
            pointer.y = y;
            var hit = pickAt(x, y);
            hoveredId = hit ? hit.id : null;
            return hit;
        }

        function clearHover() {
            hoveredId = null;
            pointer.x = -1;
            pointer.y = -1;
        }

        function each(fn) {
            for (var i = 0; i < names.length; i++) fn(names[i]);
        }

        function getStateCounts() {
            var counts = {};
            for (var i = 0; i < names.length; i++) {
                var s = names[i].state;
                if (!s) continue;
                counts[s] = (counts[s] || 0) + 1;
            }
            return counts;
        }

        return {
            setMemorials:    setMemorials,
            setSection:      setSection,
            setStateFilter:  setStateFilter,
            setStateHover:   setStateHover,
            resize:          resize,
            update:          update,
            render:          render,
            pickAt:          pickAt,
            onPointerMove:   onPointerMove,
            clearHover:      clearHover,
            each:            each,
            getStateCounts:  getStateCounts,
            getMemorials:    function () { return names; },
            getDpr:          function () { return dpr; },
            CATEGORY_LABELS: CATEGORY_LABELS
        };
    }

    V.createVeilScene = createVeilScene;
})();
