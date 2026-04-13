/* Memorial Wall — US Map module
 * ------------------------------------------------------------------
 * Renders a stylized US state map using D3 + topojson, exposes per-state
 * centroid coordinates (in *page* coordinates, so the Veil canvas can
 * draw thread lines into the map region), and dispatches state events.
 *
 * The map lives in its own SVG below the Veil. Anchor centroids are
 * recomputed on resize.
 */
(function () {
    'use strict';

    var V = window.VaelorinVeil = window.VaelorinVeil || {};

    function createUSMap(opts) {
        var svgEl     = opts.svg;            // <svg> element
        var dataUrl   = opts.dataUrl;        // states-10m.json
        var onHover   = opts.onHover  || function () {};
        var onSelect  = opts.onSelect || function () {};

        var svg       = d3.select(svgEl);
        var width     = 0;
        var height    = 0;
        var projection;
        var pathGen;
        var statesLayer;
        var anchorsLayer;
        var statesData;             // GeoJSON feature collection
        var anchorByAbbr  = {};     // { 'IN': { x, y, count, name } }
        var counts        = {};     // { 'IN': 12 }
        var selectedAbbr  = null;
        var hoveredAbbr   = null;

        // Mapping from FIPS state IDs → USPS abbreviations.
        var FIPS_TO_ABBR = {
            '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
            '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
            '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
            '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
            '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
            '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
            '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
            '55':'WI','56':'WY','72':'PR'
        };
        var ABBR_TO_NAME = {
            AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
            CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',
            FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',
            IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',
            ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
            MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',
            NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',
            NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
            OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
            SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
            VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
            PR:'Puerto Rico'
        };

        function load() {
            return fetch(dataUrl)
                .then(function (r) {
                    if (!r.ok) throw new Error('Map fetch ' + r.status);
                    return r.json();
                })
                .then(function (us) {
                    statesData = topojson.feature(us, us.objects.states);
                    return statesData;
                });
        }

        function init() {
            svg.selectAll('*').remove();
            statesLayer  = svg.append('g').attr('class', 'mw-states-layer');
            anchorsLayer = svg.append('g').attr('class', 'mw-anchors-layer');
        }

        function resize() {
            var rect = svgEl.getBoundingClientRect();
            width  = rect.width;
            height = rect.height;
            if (!statesData || width === 0 || height === 0) return;

            svg.attr('viewBox', '0 0 ' + width + ' ' + height);
            projection = d3.geoAlbersUsa().fitSize([width, height * 0.95], statesData);
            pathGen    = d3.geoPath(projection);

            var paths = statesLayer.selectAll('path').data(statesData.features, function (d) { return d.id; });

            paths.enter()
                .append('path')
                .attr('class', 'mw-state')
                .attr('data-abbr', function (d) { return FIPS_TO_ABBR[d.id] || ''; })
                .on('mouseenter', function (event, d) {
                    var abbr = FIPS_TO_ABBR[d.id];
                    hoveredAbbr = abbr;
                    d3.select(this).classed('is-hovered', true);
                    onHover(abbr, ABBR_TO_NAME[abbr], counts[abbr] || 0, event);
                })
                .on('mousemove', function (event, d) {
                    var abbr = FIPS_TO_ABBR[d.id];
                    onHover(abbr, ABBR_TO_NAME[abbr], counts[abbr] || 0, event, true);
                })
                .on('mouseleave', function (event, d) {
                    hoveredAbbr = null;
                    d3.select(this).classed('is-hovered', false);
                    onHover(null);
                })
                .on('click', function (event, d) {
                    var abbr = FIPS_TO_ABBR[d.id];
                    selectedAbbr = (selectedAbbr === abbr) ? null : abbr;
                    statesLayer.selectAll('path').classed('is-selected', function (f) {
                        return FIPS_TO_ABBR[f.id] === selectedAbbr;
                    });
                    onSelect(selectedAbbr);
                })
                .merge(paths)
                .attr('d', pathGen);

            // Compute centroids for each state in *page* coordinates so the
            // Veil canvas can draw threads to the right place.
            recomputeAnchors();
            renderAnchors();
        }

        function recomputeAnchors() {
            if (!projection || !statesData) return;
            var svgRect = svgEl.getBoundingClientRect();
            anchorByAbbr = {};
            statesData.features.forEach(function (f) {
                var abbr = FIPS_TO_ABBR[f.id];
                if (!abbr) return;
                var c = pathGen.centroid(f);
                if (!c || isNaN(c[0])) return;
                anchorByAbbr[abbr] = {
                    abbr:  abbr,
                    name:  ABBR_TO_NAME[abbr],
                    // SVG-local coords:
                    sx: c[0],
                    sy: c[1],
                    // Page coords (used by the Veil canvas):
                    px: svgRect.left + c[0],
                    py: svgRect.top  + c[1],
                    count: counts[abbr] || 0
                };
            });
        }

        function renderAnchors() {
            var data = Object.keys(anchorByAbbr)
                .map(function (k) { return anchorByAbbr[k]; })
                .filter(function (a) { return a.count > 0; });

            var sel = anchorsLayer.selectAll('circle.mw-state-anchor').data(data, function (d) { return d.abbr; });

            sel.enter()
                .append('circle')
                .attr('class', 'mw-state-anchor is-active')
                .attr('r', function (d) { return Math.min(2 + Math.sqrt(d.count) * 1.2, 6); })
                .merge(sel)
                .attr('cx', function (d) { return d.sx; })
                .attr('cy', function (d) { return d.sy; })
                .attr('r',  function (d) { return Math.min(2 + Math.sqrt(d.count) * 1.2, 6); });

            sel.exit().remove();
        }

        function setCounts(c) {
            counts = c || {};
            // Update count on already-computed anchors and re-render anchor dots.
            Object.keys(anchorByAbbr).forEach(function (k) {
                anchorByAbbr[k].count = counts[k] || 0;
            });
            renderAnchors();
        }

        function getAnchor(abbr) {
            return anchorByAbbr[abbr] || null;
        }

        function getAllAnchors() {
            return anchorByAbbr;
        }

        function getStateName(abbr) {
            return ABBR_TO_NAME[abbr] || abbr;
        }

        function selectState(abbr) {
            selectedAbbr = abbr || null;
            statesLayer.selectAll('path').classed('is-selected', function (f) {
                return FIPS_TO_ABBR[f.id] === selectedAbbr;
            });
        }

        return {
            load:           load,
            init:           init,
            resize:         resize,
            recomputeAnchors: recomputeAnchors,
            setCounts:      setCounts,
            getAnchor:      getAnchor,
            getAllAnchors:  getAllAnchors,
            getStateName:   getStateName,
            selectState:    selectState,
            get selected()  { return selectedAbbr; }
        };
    }

    V.createUSMap = createUSMap;
})();
