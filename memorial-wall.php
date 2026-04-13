<?php
/**
 * Template Name: Memorial Wall - The Veil
 *
 * VaelorinVerse Memorial Wall page template.
 * An immersive, interactive visualization of the Veil — the space between
 * worlds where the Threads of the departed still glow.
 *
 * URL: vaelorinverse.com/memorial-wall
 *
 * @package VaelorinVerse
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

get_header();

// Firebase configuration is expected to be defined in the active theme's
// functions.php as VAELORIN_FIREBASE_CONFIG (associative array). We emit it
// as a JSON object that the client-side loader consumes. A falsy/empty
// configuration causes firebase-fetch.js to fall back to bundled sample data.
$firebase_config = defined( 'VAELORIN_FIREBASE_CONFIG' ) ? VAELORIN_FIREBASE_CONFIG : array();
$asset_base      = trailingslashit( get_stylesheet_directory_uri() );

wp_enqueue_style(
    'vaelorin-cinzel',
    'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500&display=swap',
    array(),
    null
);

wp_enqueue_style(
    'memorial-wall',
    $asset_base . 'assets/css/memorial-wall.css',
    array( 'vaelorin-cinzel' ),
    '1.0.0'
);

// Third-party libraries (CDN). Versions pinned for cache stability.
wp_enqueue_script( 'd3', 'https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js', array(), '7.8.5', false );
wp_enqueue_script( 'topojson', 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js', array(), '3.1.0', false );
wp_enqueue_script( 'gsap', 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js', array(), '3.12.5', false );

// Memorial Wall modules. Order matters — each module attaches to window.VaelorinVeil.
$modules = array(
    'firebase-fetch',
    'particles',
    'thread-lines',
    'us-map',
    'veil-scene',
    'ui-controls',
    'memorial-wall',
);
foreach ( $modules as $i => $module ) {
    wp_enqueue_script(
        'memorial-wall-' . $module,
        $asset_base . 'assets/js/' . $module . '.js',
        $i === 0 ? array( 'd3', 'topojson', 'gsap' ) : array( 'memorial-wall-' . $modules[ $i - 1 ] ),
        '1.0.0',
        true
    );
}

wp_localize_script(
    'memorial-wall-firebase-fetch',
    'VaelorinVeilConfig',
    array(
        'firebase'       => $firebase_config,
        'usMapUrl'       => 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json',
        'rememberUrl'    => home_url( '/remember-a-name' ),
        'prefersReduced' => null, // resolved client-side from media query
    )
);
?>

<main id="memorial-wall" class="memorial-wall" role="main" aria-label="Memorial Wall — The Veil">

    <!-- Black veil that fades away on load -->
    <div class="mw-entry-veil" aria-hidden="true"></div>

    <!-- Cycling quote overlay -->
    <div class="mw-quote" aria-live="polite">
        <p class="mw-quote__text" data-quote-target></p>
    </div>

    <!-- The Veil — upper canvas region (names + particles + threads) -->
    <section class="mw-veil" aria-label="The Veil — names of the remembered">
        <canvas id="mw-veil-canvas" class="mw-veil__canvas"></canvas>
        <div class="mw-veil__section-labels" aria-hidden="true">
            <span class="mw-veil__label mw-veil__label--children">Children</span>
            <span class="mw-veil__label mw-veil__label--loved">Loved Ones</span>
            <span class="mw-veil__label mw-veil__label--companions">Companions</span>
            <span class="mw-veil__label mw-veil__label--service">Service Members</span>
        </div>
    </section>

    <!-- The Map — lower region (states + thread anchors) -->
    <section class="mw-map" aria-label="Map of the United States — origins of the remembered">
        <svg id="mw-map-svg" class="mw-map__svg" role="img" aria-label="U.S. state map">
            <title>Map of U.S. states showing remembered origins</title>
        </svg>
        <div id="mw-map-tooltip" class="mw-tooltip mw-tooltip--state" role="tooltip" aria-hidden="true"></div>
    </section>

    <!-- Section filter controls -->
    <nav class="mw-controls" aria-label="Memorial section filters">
        <button type="button" class="mw-chip is-active" data-section="all">All</button>
        <button type="button" class="mw-chip" data-section="loved_one">Loved Ones</button>
        <button type="button" class="mw-chip" data-section="child">Children</button>
        <button type="button" class="mw-chip" data-section="companion">Companions</button>
        <button type="button" class="mw-chip" data-section="service_member">Service Members</button>
    </nav>

    <!-- Ambient sound toggle -->
    <button type="button" class="mw-sound-toggle" aria-pressed="false" aria-label="Toggle ambient sound">
        <span class="mw-sound-toggle__icon" aria-hidden="true"></span>
        <span class="mw-sound-toggle__text">Ambient</span>
    </button>

    <!-- Remember a Name CTA -->
    <a class="mw-cta" href="<?php echo esc_url( home_url( '/remember-a-name' ) ); ?>">
        <span class="mw-cta__text">Remember a Name</span>
    </a>

    <!-- Hover tooltip for names -->
    <div id="mw-name-tooltip" class="mw-tooltip mw-tooltip--name" role="tooltip" aria-hidden="true">
        <p class="mw-tooltip__name" data-name></p>
        <p class="mw-tooltip__meta">
            <span data-category></span>
            <span class="mw-tooltip__dot" aria-hidden="true">·</span>
            <span data-state></span>
        </p>
        <p class="mw-tooltip__tribute" data-tribute></p>
    </div>

    <!-- Full tribute modal -->
    <div id="mw-modal" class="mw-modal" role="dialog" aria-modal="true" aria-labelledby="mw-modal-name" hidden>
        <div class="mw-modal__backdrop" data-close-modal></div>
        <article class="mw-modal__card" tabindex="-1">
            <button type="button" class="mw-modal__close" data-close-modal aria-label="Close">×</button>
            <p class="mw-modal__category" data-category></p>
            <h2 class="mw-modal__name" id="mw-modal-name" data-name></h2>
            <p class="mw-modal__state" data-state></p>
            <p class="mw-modal__tribute" data-tribute></p>
            <p class="mw-modal__submitted" data-submitted></p>
        </article>
    </div>

    <!-- Accessible list-view fallback (screen readers + prefers-reduced-motion) -->
    <div id="mw-list-fallback" class="mw-list-fallback" aria-label="List of remembered names">
        <h2 class="mw-list-fallback__title">The Veil — List View</h2>
        <div class="mw-list-fallback__sections" data-list-target></div>
    </div>

    <noscript>
        <p class="mw-noscript">The Memorial Wall requires JavaScript. A static list of remembered names follows.</p>
    </noscript>

</main>

<?php get_footer();
