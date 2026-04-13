/* Memorial Wall — UI controls
 * ------------------------------------------------------------------
 * Section filter chips, state-hover tooltip, name-hover tooltip,
 * full-tribute modal, ambient-sound toggle, cycling quote, and the
 * accessible list-view fallback.
 */
(function () {
    'use strict';

    var V = window.VaelorinVeil = window.VaelorinVeil || {};

    var QUOTES = [
        'Those who are Loved will never be Forgotten',
        'Their Threads do not end. They weave into the Pattern.',
        'The Veil holds what love refuses to release.',
        'Every name is a Thread. Every Thread is eternal.'
    ];

    var CATEGORY_LABELS = {
        loved_one:      'Loved One',
        child:          'Child',
        companion:      'Companion',
        service_member: 'Service Member'
    };

    function initUIControls(opts) {
        var root            = opts.root;
        var onSectionChange = opts.onSectionChange;
        var onModalOpen     = opts.onModalOpen     || function () {};
        var onModalClose    = opts.onModalClose    || function () {};

        // ---- Section chips ----
        var chips = root.querySelectorAll('.mw-chip');
        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                chips.forEach(function (c) { c.classList.remove('is-active'); });
                chip.classList.add('is-active');
                var section = chip.getAttribute('data-section') || 'all';
                root.setAttribute('data-section', section);
                onSectionChange(section);
            });
        });

        // ---- Name tooltip ----
        var nameTooltipEl = root.querySelector('#mw-name-tooltip');
        function showNameTooltip(memorial, x, y) {
            if (!memorial) { hideNameTooltip(); return; }
            nameTooltipEl.querySelector('[data-name]').textContent = memorial.name;
            nameTooltipEl.querySelector('[data-category]').textContent =
                CATEGORY_LABELS[memorial.category] || '';
            nameTooltipEl.querySelector('[data-state]').textContent = memorial.state || '';
            nameTooltipEl.querySelector('[data-tribute]').textContent = memorial.tribute || '';

            // Position with edge clamping
            var rect = nameTooltipEl.getBoundingClientRect();
            var w = rect.width || 240, h = rect.height || 80;
            var px = x + 16, py = y + 16;
            var vw = window.innerWidth, vh = window.innerHeight;
            if (px + w > vw - 12) px = x - w - 16;
            if (py + h > vh - 12) py = y - h - 16;
            nameTooltipEl.style.left = Math.max(8, px) + 'px';
            nameTooltipEl.style.top  = Math.max(8, py) + 'px';
            nameTooltipEl.classList.add('is-visible');
            nameTooltipEl.setAttribute('aria-hidden', 'false');
        }
        function hideNameTooltip() {
            nameTooltipEl.classList.remove('is-visible');
            nameTooltipEl.setAttribute('aria-hidden', 'true');
        }

        // ---- State tooltip ----
        var stateTooltipEl = root.querySelector('#mw-map-tooltip');
        function showStateTooltip(abbr, name, count, event) {
            if (!abbr) { hideStateTooltip(); return; }
            var noun = count === 1 ? 'Thread' : 'Threads';
            stateTooltipEl.innerHTML = '<strong>' + count + ' ' + noun +
                '</strong> remembered from ' + name;
            var x = event.clientX, y = event.clientY;
            var rect = stateTooltipEl.getBoundingClientRect();
            var w = rect.width || 220, h = rect.height || 40;
            var vw = window.innerWidth;
            var px = x + 14, py = y - h - 14;
            if (px + w > vw - 12) px = x - w - 14;
            if (py < 8) py = y + 14;
            stateTooltipEl.style.left = px + 'px';
            stateTooltipEl.style.top  = py + 'px';
            stateTooltipEl.classList.add('is-visible');
            stateTooltipEl.setAttribute('aria-hidden', 'false');
        }
        function hideStateTooltip() {
            stateTooltipEl.classList.remove('is-visible');
            stateTooltipEl.setAttribute('aria-hidden', 'true');
        }

        // ---- Modal ----
        var modal = root.querySelector('#mw-modal');
        var lastFocused = null;
        function openModal(memorial) {
            if (!memorial) return;
            modal.querySelector('[data-name]').textContent     = memorial.name;
            modal.querySelector('[data-category]').textContent = CATEGORY_LABELS[memorial.category] || '';
            modal.querySelector('[data-state]').textContent    = stateName(memorial.state);
            modal.querySelector('[data-tribute]').textContent  = memorial.tribute || '';
            var submitted = '';
            if (memorial.dateSubmitted) {
                submitted = 'Submitted ' + memorial.dateSubmitted;
                if (memorial.submittedBy && memorial.submittedBy !== 'Anonymous') {
                    submitted += ' by ' + memorial.submittedBy;
                }
            }
            modal.querySelector('[data-submitted]').textContent = submitted;

            lastFocused = document.activeElement;
            modal.hidden = false;
            modal.querySelector('.mw-modal__card').focus();
            document.addEventListener('keydown', onModalKey);
            onModalOpen(memorial);
        }
        function closeModal() {
            modal.hidden = true;
            document.removeEventListener('keydown', onModalKey);
            if (lastFocused && lastFocused.focus) lastFocused.focus();
            onModalClose();
        }
        function onModalKey(e) {
            if (e.key === 'Escape') closeModal();
        }
        modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
            el.addEventListener('click', closeModal);
        });

        // ---- Sound toggle ----
        var soundBtn = root.querySelector('.mw-sound-toggle');
        var audioCtx = null;
        var audioNodes = null;
        soundBtn.addEventListener('click', function () {
            var pressed = soundBtn.getAttribute('aria-pressed') === 'true';
            soundBtn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
            if (pressed) {
                stopAmbient();
            } else {
                startAmbient();
            }
        });
        function startAmbient() {
            try {
                var Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return;
                audioCtx = audioCtx || new Ctx();
                if (audioCtx.state === 'suspended') audioCtx.resume();

                // Two soft drone tones + a slowly modulating noise (wind).
                var master = audioCtx.createGain();
                master.gain.value = 0.0;
                master.connect(audioCtx.destination);
                master.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 1.5);

                var osc1 = audioCtx.createOscillator();
                osc1.type = 'sine';   osc1.frequency.value = 110;
                var osc2 = audioCtx.createOscillator();
                osc2.type = 'sine';   osc2.frequency.value = 165;
                var lfo  = audioCtx.createOscillator();
                lfo.type = 'sine';    lfo.frequency.value = 0.07;
                var lfoGain = audioCtx.createGain(); lfoGain.gain.value = 8;
                lfo.connect(lfoGain); lfoGain.connect(osc1.frequency);

                osc1.connect(master); osc2.connect(master);
                osc1.start(); osc2.start(); lfo.start();

                audioNodes = { master: master, osc1: osc1, osc2: osc2, lfo: lfo };
            } catch (e) {
                console.warn('[Veil] Audio init failed', e);
            }
        }
        function stopAmbient() {
            if (!audioCtx || !audioNodes) return;
            try {
                audioNodes.master.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + 1.0);
                setTimeout(function () {
                    try {
                        audioNodes.osc1.stop(); audioNodes.osc2.stop(); audioNodes.lfo.stop();
                    } catch (_) {}
                    audioNodes = null;
                }, 1100);
            } catch (e) { /* no-op */ }
        }

        // ---- Cycling quote ----
        var quoteEl = root.querySelector('[data-quote-target]');
        var quoteIdx = 0;
        function cycleQuote() {
            quoteEl.textContent = QUOTES[quoteIdx];
            quoteIdx = (quoteIdx + 1) % QUOTES.length;
            // Fade in then out.
            var parent = quoteEl.parentElement;
            if (window.gsap) {
                window.gsap.fromTo(parent,
                    { opacity: 0 },
                    { opacity: 1, duration: 2, ease: 'power2.out',
                      onComplete: function () {
                          window.gsap.to(parent, { opacity: 0, duration: 2, delay: 5, ease: 'power2.in' });
                      }
                    });
            } else {
                parent.style.transition = 'opacity 2s';
                parent.style.opacity = '1';
                setTimeout(function () { parent.style.opacity = '0'; }, 7000);
            }
        }
        // First quote shortly after entry, then cycle every ~16s.
        setTimeout(cycleQuote, 3500);
        setInterval(cycleQuote, 16000);

        // ---- Helpers ----
        function stateName(abbr) {
            // Defer to map module if it's already initialized.
            if (V.map && typeof V.map.getStateName === 'function') {
                return V.map.getStateName(abbr);
            }
            return abbr || '';
        }

        // ---- Accessible list view ----
        function renderList(memorials) {
            var target = root.querySelector('[data-list-target]');
            if (!target) return;
            var bySection = { loved_one: [], child: [], companion: [], service_member: [] };
            memorials.forEach(function (m) {
                (bySection[m.category] || bySection.loved_one).push(m);
            });
            var html = '';
            ['loved_one', 'child', 'companion', 'service_member'].forEach(function (cat) {
                var label = CATEGORY_LABELS[cat];
                html += '<section class="mw-list-section">';
                html += '<h3 class="mw-list-section__title">' + label + 's</h3>';
                html += '<ul class="mw-list-section__names">';
                bySection[cat].forEach(function (m) {
                    html += '<li>' + escape(m.name) +
                        ' <span class="mw-list-state">' + escape(m.state) + '</span>';
                    if (m.tribute) html += '<span class="mw-list-tribute">' + escape(m.tribute) + '</span>';
                    html += '</li>';
                });
                html += '</ul></section>';
            });
            target.innerHTML = html;
        }

        function escape(str) {
            return String(str || '').replace(/[&<>"']/g, function (c) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
            });
        }

        return {
            showNameTooltip:  showNameTooltip,
            hideNameTooltip:  hideNameTooltip,
            showStateTooltip: showStateTooltip,
            hideStateTooltip: hideStateTooltip,
            openModal:        openModal,
            closeModal:       closeModal,
            renderList:       renderList
        };
    }

    V.initUIControls = initUIControls;
})();
