/* Memorial Wall — Firebase data loader
 * ------------------------------------------------------------------
 * Establishes the global VaelorinVeil namespace and exposes a fetch()
 * function that returns the memorial list. Uses the Firebase Realtime
 * Database REST endpoint (no SDK required). If no Firebase config is
 * available, falls back to a small bundled sample set so the Veil
 * always renders something.
 */
(function () {
    'use strict';

    window.VaelorinVeil = window.VaelorinVeil || {};

    var CATEGORIES = ['loved_one', 'child', 'companion', 'service_member'];

    // Sample fallback data — used when Firebase isn't configured yet.
    // Real names would come from Firebase. Kept deliberately small and
    // representative across all four sections and several states.
    var FALLBACK = [
        { name: 'Eleanor Mae Whitfield', category: 'loved_one',      state: 'IN', tribute: 'Her garden still blooms.' },
        { name: 'Thomas Reyes',          category: 'loved_one',      state: 'CA', tribute: 'The stories he told us live on.' },
        { name: 'Margaret O\u2019Connell', category: 'loved_one',    state: 'MA', tribute: '' },
        { name: 'David Hollings',        category: 'loved_one',      state: 'TX', tribute: 'Steady as the oak he planted.' },
        { name: 'Ruth Anderssen',        category: 'loved_one',      state: 'MN', tribute: '' },
        { name: 'Joseph Calabrese',      category: 'loved_one',      state: 'NY', tribute: 'Sunday dinners forever.' },
        { name: 'Iris Beaumont',         category: 'loved_one',      state: 'LA', tribute: '' },
        { name: 'Walter Kimura',         category: 'loved_one',      state: 'WA', tribute: '' },

        { name: 'Sophie Grace',          category: 'child',          state: 'OH', tribute: 'Our little light.' },
        { name: 'Micah James',           category: 'child',          state: 'IN', tribute: 'Forever four, forever loved.' },
        { name: 'Ava Rose',              category: 'child',          state: 'FL', tribute: '' },
        { name: 'Oliver',                category: 'child',          state: 'CO', tribute: 'Born still, held always.' },

        { name: 'Duke',                  category: 'companion',      state: 'TX', tribute: 'Best boy.' },
        { name: 'Luna',                  category: 'companion',      state: 'OR', tribute: 'She hunted moonlight.' },
        { name: 'Pepper',                category: 'companion',      state: 'IL', tribute: '' },
        { name: 'Maple',                 category: 'companion',      state: 'VT', tribute: 'Fifteen good years.' },
        { name: 'Biscuit',               category: 'companion',      state: 'GA', tribute: '' },

        { name: 'SSG Marcus Hale',       category: 'service_member', state: 'KY', tribute: 'Army — still on post.' },
        { name: 'Lt. Cdr. Alice Park',   category: 'service_member', state: 'VA', tribute: 'Navy.' },
        { name: 'Sgt. Rafael Ortiz',     category: 'service_member', state: 'AZ', tribute: 'Marines — semper fi.' },
        { name: 'TSgt. Diana Voss',      category: 'service_member', state: 'NE', tribute: 'Air Force.' }
    ];

    function normalize(record, idx) {
        return {
            id:            record.id || ('fallback-' + idx),
            name:          String(record.name || '').trim(),
            category:      CATEGORIES.indexOf(record.category) >= 0 ? record.category : 'loved_one',
            state:         String(record.state || '').toUpperCase().slice(0, 2),
            tribute:       String(record.tribute || '').trim(),
            submittedBy:   record.submittedBy || 'Anonymous',
            dateSubmitted: record.dateSubmitted || ''
        };
    }

    function buildFirebaseUrl(config) {
        // Support either { databaseURL } or { projectId } shapes.
        if (config.databaseURL) {
            return config.databaseURL.replace(/\/$/, '') + '/memorials.json?orderBy="approved"&equalTo=true';
        }
        if (config.projectId) {
            return 'https://' + config.projectId + '-default-rtdb.firebaseio.com/memorials.json';
        }
        return null;
    }

    function fetchFromFirebase(config) {
        var url = buildFirebaseUrl(config);
        if (!url) return Promise.reject(new Error('No Firebase URL'));

        return fetch(url, { mode: 'cors' })
            .then(function (res) {
                if (!res.ok) throw new Error('Firebase responded ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (!data) return [];
                // Firebase returns an object keyed by id. Convert to array.
                return Object.keys(data)
                    .map(function (id) { return Object.assign({ id: id }, data[id]); })
                    .filter(function (r) { return r && r.name && r.approved !== false; });
            });
    }

    function fetchMemorials() {
        var cfg = (window.VaelorinVeilConfig && window.VaelorinVeilConfig.firebase) || {};
        var hasConfig = cfg && (cfg.databaseURL || cfg.projectId);

        var promise = hasConfig
            ? fetchFromFirebase(cfg).catch(function (err) {
                console.warn('[Veil] Firebase fetch failed, using fallback data:', err);
                return FALLBACK.slice();
            })
            : Promise.resolve(FALLBACK.slice());

        return promise.then(function (raw) {
            return raw.map(normalize).filter(function (r) { return r.name && r.state; });
        });
    }

    window.VaelorinVeil.fetchMemorials = fetchMemorials;
    window.VaelorinVeil.CATEGORIES = CATEGORIES;
    window.VaelorinVeil.CATEGORY_LABELS = {
        loved_one:      'Loved One',
        child:          'Child',
        companion:      'Companion',
        service_member: 'Service Member'
    };
})();
