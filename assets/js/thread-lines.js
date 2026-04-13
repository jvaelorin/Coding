/* Memorial Wall — Thread lines
 * ------------------------------------------------------------------
 * Renders luminous bezier curves from each name in the Veil down to
 * the anchor point of its origin state on the map. A soft pulse of
 * light travels down each thread to evoke the "living thread" motif.
 *
 * The state anchor points come from the US map module; this module is
 * purely a renderer called from the main raf loop.
 */
(function () {
    'use strict';

    var V = window.VaelorinVeil = window.VaelorinVeil || {};

    function drawThread(ctx, name, anchor, opts, now) {
        // name:   { x, y, section, hovered, dimmed }
        // anchor: { x, y } — in canvas coords, same coordinate system as names
        if (!anchor) return;

        var x1 = name.x,          y1 = name.y;
        var x2 = anchor.x,        y2 = anchor.y;

        // Bezier curve — gentle S-shape
        var midY = (y1 + y2) / 2;
        var cp1x = x1 + (x2 - x1) * 0.15;
        var cp1y = midY - 30;
        var cp2x = x1 + (x2 - x1) * 0.85;
        var cp2y = midY + 30;

        var baseAlpha = name.hovered ? 0.9
                     : name.stateHovered ? 0.75
                     : name.dimmed ? 0.04
                     : 0.18;

        var lineWidth = name.hovered ? 1.4 : 0.6;

        // Shadow / bloom
        ctx.save();
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255, 215, 0, ' + (baseAlpha * 0.8) + ')';
        ctx.shadowBlur  = name.hovered ? 14 : 6;
        ctx.strokeStyle = 'rgba(212, 163, 55, ' + baseAlpha + ')';
        ctx.lineWidth   = lineWidth;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
        ctx.stroke();
        ctx.restore();

        // Pulse — a bright dot traveling down the thread.
        // Each thread has a slightly different phase so they don't march in sync.
        if (!name.dimmed) {
            var period = 5200; // ms per pulse cycle
            var t = ((now + (name.pulseOffset || 0)) % period) / period;
            if (t > 0.02 && t < 0.98) {
                var pt = cubicBezierPoint(t, x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2);
                var pulseAlpha = name.hovered ? 1 : 0.7;
                var pulseR = name.hovered ? 2.4 : 1.6;

                ctx.save();
                var g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pulseR * 4);
                g.addColorStop(0,   'rgba(255, 230, 150, ' + pulseAlpha + ')');
                g.addColorStop(0.5, 'rgba(212, 163, 55, ' + (pulseAlpha * 0.4) + ')');
                g.addColorStop(1,   'rgba(212, 163, 55, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pulseR * 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = 'rgba(255, 240, 200, ' + pulseAlpha + ')';
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pulseR, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    function cubicBezierPoint(t, x0, y0, x1, y1, x2, y2, x3, y3) {
        var mt = 1 - t;
        var mt2 = mt * mt;
        var t2 = t * t;
        return {
            x: mt2 * mt * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t2 * t * x3,
            y: mt2 * mt * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t2 * t * y3
        };
    }

    // ------------------------------------------------------------------
    // The Pattern — name-to-name weave
    // ------------------------------------------------------------------
    // Each name is connected to its 2-3 nearest neighbors within the
    // same section by a faint thread. Together these threads form a
    // tapestry: every name is held by the others, no one floats alone.
    // Hovering a name brightens the threads it touches so you can see
    // its place in the Pattern.

    var SECTION_WEAVE_RGB = {
        loved_one:      '212, 163, 55',   // gold
        child:          '220, 220, 232',  // soft silver
        companion:      '201, 162, 39',   // amber
        service_member: '120, 150, 200'   // steel blue
    };

    function drawWeave(ctx, names, edges, now) {
        if (!edges || !edges.length) return;

        // A slow collective "breath" — the entire weave shimmers as one.
        var breath = 0.65 + 0.35 * Math.sin(now * 0.0007);

        for (var i = 0; i < edges.length; i++) {
            var e = edges[i];
            var a = names[e.a];
            var b = names[e.b];
            if (!a || !b) continue;

            // If both endpoints are dimmed (filtered out), hide the thread.
            if (a.dimmed && b.dimmed) continue;

            var hovered     = a.hovered || b.hovered;
            var bothActive  = !a.dimmed && !b.dimmed;
            var rgb         = SECTION_WEAVE_RGB[e.section] || SECTION_WEAVE_RGB.loved_one;

            var alpha;
            if (hovered)         alpha = 0.55;
            else if (bothActive) alpha = 0.09 * breath;
            else                 alpha = 0.025;

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineWidth = hovered ? 0.9 : 0.45;
            ctx.strokeStyle = 'rgba(' + rgb + ', ' + alpha + ')';
            if (hovered) {
                ctx.shadowColor = 'rgba(' + rgb + ', ' + (alpha * 0.6) + ')';
                ctx.shadowBlur  = 6;
            }

            // Slight perpendicular curve so the weave feels organic,
            // not like a wireframe. Curvature is small and consistent
            // (~6% of segment length) so the lines read as fabric.
            var dx = b.x - a.x;
            var dy = b.y - a.y;
            var midX = (a.x + b.x) / 2;
            var midY = (a.y + b.y) / 2;
            var cx = midX + (-dy * 0.06);
            var cy = midY + ( dx * 0.06);

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.quadraticCurveTo(cx, cy, b.x, b.y);
            ctx.stroke();
            ctx.restore();
        }
    }

    V.threadLines = {
        draw:      drawThread,
        drawWeave: drawWeave
    };
})();
