/**
 * shaderslide: a slider with its own motion, made to be drawn on a canvas.
 *
 * This is the core. It moves the slides of the page and knows nothing
 * about WebGL: what draws on a canvas is a layer, passed in by the caller
 * (see `gl/`).
 *
 *     <div class="ss">
 *         <div class="ss-track">
 *             <div class="ss-slide"><img class="ss-media" src="…" alt="…"></div>
 *             …
 *         </div>
 *         <button data-ss-prev>…</button>
 *         <button data-ss-next>…</button>
 *         <div data-ss-dots></div>
 *     </div>
 */
import { createEngine } from './engine.js';
import {
	measure,
	place,
	positionOf,
	nearest,
	heightOf,
	mod,
} from './layout.js';
import { createInput } from './input.js';
import { createDom } from './dom.js';
import { createControls } from './controls.js';

/**
 * @typedef {Object} Options
 * @property {'row'|'stack'}          [mode]     Slides next to or on top of
 *                                               each other.
 * @property {number|'auto'}          [perView]  Slides per view; `auto`
 *                                               takes each slide's own
 *                                               width. Without it, the CSS
 *                                               decides (`--ss-per-view`).
 * @property {number}                 [gap]      Gap in px. Without it, the
 *                                               CSS decides (`--ss-gap`).
 * @property {boolean}                [loop]     Go round.
 * @property {'start'|'center'|'end'} [align]    Where the active slide
 *                                               rests in the view.
 * @property {number}                 [group]    Slides per step.
 * @property {boolean}                [contain]  No empty space at the ends.
 * @property {boolean}                [free]     Rest anywhere, not only on
 *                                               slides.
 * @property {boolean}                [autoHeight] The slider is as high as
 *                                               the slides in view.
 * @property {number}                 [autoplay] Time a slide stays, ms; 0
 *                                               for no autoplay.
 * @property {boolean}                [wheel]    Sideways scrolling by
 *                                               trackpad or wheel.
 * @property {number}                 [duration] Time of a move, ms.
 * @property {number}                 [start]    First slide shown.
 * @property {boolean}                [drag]     Pointer dragging.
 * @property {boolean}                [keyboard] Arrow keys, Home, End.
 * @property {HTMLElement}            [controls] Where the arrows and dots
 *                                               are; the slider itself by
 *                                               default.
 * @property {Function[]}             [layers]   What draws the slider
 *                                               besides the page.
 */
const DEFAULTS = {
	mode: 'row',
	loop: false,
	align: 'start',
	group: 1,
	contain: true,
	duration: 600,
	start: 0,
	drag: true,
	keyboard: true,
	wheel: true,
	autoplay: 0,
	layers: [],
};

// How far a let-go slider would glide on, in seconds of its velocity.
const GLIDE = 0.2;

// The same for a slider that may rest anywhere: it glides further.
const GLIDE_FREE = 0.45;

// A drag faster than this moves on by a slide even when it was short,
// px per second.
const FLICK = 250;

/**
 * @param {HTMLElement} root      The slider element.
 * @param {Options}     [options] Options.
 * @return {Object} The slider.
 */
export function createSlider( root, options = {} ) {
	const win = root.ownerDocument.defaultView;
	const o = { ...DEFAULTS, ...options };
	const track = root.querySelector( ':scope > .ss-track' );
	const slides = [ ...track.children ];
	const places = slides.map( ( el ) => ( {
		el,
		x: 0,
		p: 0,
		visible: false,
	} ) );
	const still = win.matchMedia( '(prefers-reduced-motion: reduce)' );
	const listeners = new Map();
	let layout;
	// The snap the slider is at or on its way to. When looping it runs on
	// past both ends while the slider moves.
	let index = 0;
	let destroyed = false;

	const classes = [
		'ss-on',
		o.mode === 'stack' && 'ss-stack',
		o.perView === 'auto' && 'ss-auto',
		o.autoHeight && 'ss-tall',
	].filter( Boolean );
	root.classList.add( ...classes );
	if ( o.perView > 0 ) {
		root.style.setProperty( '--ss-per-view', o.perView );
	}
	if ( o.gap >= 0 ) {
		root.style.setProperty( '--ss-gap', `${ o.gap }px` );
	}

	const emit = ( name, value ) =>
		listeners.get( name )?.forEach( ( fn ) => fn( value ) );

	const count = () => layout.snaps.length;
	const current = () => mod( index, count() );

	// What layers get on every frame.
	const view = {
		layout: null,
		motion: null,
		places,
		// Viewport widths per second; zero for visitors who want no motion.
		velocity: 0,
	};

	// Whether the slider is on the screen, and whether the visitor is
	// busy with it: autoplay and videos depend on both.
	let awake = true;
	let held = false;
	let paused = false;
	let height = -1;
	let timer = 0;

	const schedule = () => {
		win.clearTimeout( timer );
		if (
			o.autoplay > 0 &&
			awake &&
			! held &&
			! paused &&
			! motion.dragging &&
			! win.document.hidden
		) {
			timer = win.setTimeout( () => {
				const last = ! layout.loop && current() === count() - 1;
				go( last ? 0 : index + 1 );
			}, o.autoplay );
		}
	};

	const engine = createEngine( win, {
		frame( motion, dt, now ) {
			place( layout, motion.pos, places );
			view.velocity = still.matches
				? 0
				: motion.smooth / ( layout.width || 1 );
			dom.frame( layout, motion, places, awake );
			if ( o.autoHeight ) {
				const to = Math.round( heightOf( layout, places ) * 10 ) / 10;
				if ( to !== height ) {
					height = to;
					track.style.height = `${ to }px`;
				}
			}
			layers.forEach( ( layer ) => layer.frame?.( view, dt, now ) );
			emit( 'frame', view );
		},
		settle( motion ) {
			if ( layout.loop ) {
				const rounds = Math.floor( index / count() );
				index -= rounds * count();
				engine.shift( -rounds * layout.length );
			}
			place( layout, motion.pos, places );
			dom.settle( places );
			schedule();
			emit( 'settle', current() );
		},
		busy: () => layers.some( ( layer ) => layer.busy?.() ),
	} );
	const { motion } = engine;
	view.motion = motion;
	engine.duration( o.duration );

	const go = ( to, instant ) => {
		const before = current();
		index = layout.loop
			? to
			: Math.min( count() - 1, Math.max( 0, to ) );
		win.clearTimeout( timer );
		engine.to( positionOf( layout, index ), instant || still.matches );
		if ( current() !== before ) {
			controls.update();
			emit( 'change', current() );
		}
	};

	const update = () => {
		if ( destroyed ) {
			return;
		}
		const resting = ! motion.dragging && motion.pos === motion.target;
		layout = measure( root, track, slides, o, dom.moved );
		view.layout = layout;
		index = layout.loop
			? index
			: Math.min( count() - 1, Math.max( 0, index ) );
		layers.forEach( ( layer ) => layer.measure?.( view ) );
		if ( motion.dragging ) {
			motion.target = positionOf( layout, index );
		} else {
			engine.to( positionOf( layout, index ), resting );
		}
		height = -1;
		controls.update();
	};

	const slider = {
		root,
		track,
		slides,
		options: o,
		motion,
		view,
		win,

		/** Index of the snap the slider is at or moves to. */
		get index() {
			return current();
		},
		/** Whether the slider rests: nothing moves, nothing is drawn. */
		get resting() {
			return engine.resting();
		},
		/** @return {number} Number of snaps. */
		count,
		/** @return {Object} Layout. */
		layout: () => layout,

		/**
		 * @param {number}  to                Snap index.
		 * @param {Object}  [how]             How.
		 * @param {boolean} [how.instant]     Without a move.
		 */
		to( to, { instant } = {} ) {
			let step = to - current();
			// The short way round.
			if ( layout.loop ) {
				step = mod( step + count() / 2, count() ) - count() / 2;
				step = Math.round( step );
			}
			go( index + step, instant );
		},
		next: () => go( index + 1 ),
		prev: () => go( index - 1 ),

		/** Whether autoplay is stopped by `pause()`. */
		get paused() {
			return paused;
		},
		/** Stops autoplay until `play()`. */
		pause() {
			paused = true;
			schedule();
			controls.update();
		},
		/** Lets autoplay go on. */
		play() {
			paused = false;
			schedule();
			controls.update();
		},

		/** The layers, in the order they were given. */
		get layers() {
			return layers;
		},

		/** Measures again, after a change the slider cannot see. */
		update,
		/** Requests a frame: for layers that changed what they draw. */
		wake: engine.wake,

		/**
		 * @param {string}   name `change` (index), `settle` (index) or
		 *                        `frame` (view).
		 * @param {Function} fn   Listener.
		 * @return {Function} Removes the listener.
		 */
		on( name, fn ) {
			if ( ! listeners.has( name ) ) {
				listeners.set( name, new Set() );
			}
			listeners.get( name ).add( fn );
			return () => listeners.get( name ).delete( fn );
		},

		destroy() {
			destroyed = true;
			win.clearTimeout( timer );
			observer.disconnect();
			watcher.disconnect();
			hold.forEach( ( [ name, fn ] ) =>
				root.removeEventListener( name, fn )
			);
			win.document.removeEventListener( 'visibilitychange', schedule );
			track.style.height = '';
			removeInput();
			layers.forEach( ( layer ) => layer.destroy?.() );
			engine.destroy();
			controls.destroy();
			dom.destroy();
			root.classList.remove( ...classes, 'ss-dragging' );
			listeners.clear();
		},
	};

	const dom = createDom( root, track, slides );
	const controls = createControls( o.controls || root, slider );
	const removeInput = createInput( root, {
		options: o,
		motion,
		layout: () => layout,
		count,
		grab() {
			win.clearTimeout( timer );
			engine.grab();
		},
		drag: engine.drag,
		next: slider.next,
		prev: slider.prev,
		to: slider.to,
		release( velocity, from ) {
			const glide = o.free ? GLIDE_FREE : GLIDE;
			let rest = motion.pos + velocity * glide;
			if ( ! o.free ) {
				// However fast: not further than what was in view.
				rest = Math.min(
					from + layout.width,
					Math.max( from - layout.width, rest )
				);
			}
			let to = nearest( layout, rest );
			if (
				! o.free &&
				to === nearest( layout, from ) &&
				Math.abs( velocity ) > FLICK
			) {
				to += Math.sign( velocity );
			}
			if ( ! layout.loop ) {
				to = Math.min( count() - 1, Math.max( 0, to ) );
				rest = Math.min(
					layout.snaps[ count() - 1 ],
					Math.max( layout.snaps[ 0 ], rest )
				);
			}
			const before = current();
			index = to;
			engine.release(
				still.matches ? 0 : velocity,
				o.free ? rest : positionOf( layout, index )
			);
			if ( current() !== before ) {
				controls.update();
				emit( 'change', current() );
			}
		},
	} );

	layout = measure( root, track, slides, o, dom.moved );
	view.layout = layout;
	const layers = o.layers
		.map( ( create ) => create( slider ) )
		.filter( Boolean );
	index = o.start;
	update();
	engine.to( positionOf( layout, index ), true );

	// Sizes change with the window, with images that load and with styles.
	let wide = layout.width;
	const observer = new win.ResizeObserver( ( entries ) => {
		// With auto height the slider changes its own height on every
		// frame of a move: that is no reason to measure.
		const own =
			o.autoHeight &&
			entries.every( ( entry ) => entry.target === root ) &&
			Math.abs( root.clientWidth - wide ) < 1;
		if ( ! own ) {
			update();
			wide = root.clientWidth;
		}
	} );
	observer.observe( root );
	slides.forEach( ( slide ) => observer.observe( slide ) );

	const watcher = new win.IntersectionObserver( ( entries ) => {
		awake = entries[ entries.length - 1 ].isIntersecting;
		schedule();
		// For the videos, which follow the view.
		engine.wake();
	} );
	watcher.observe( root );

	// Autoplay waits while the visitor points at the slider or is in it.
	const hold = [
		[ 'pointerenter', true ],
		[ 'pointerleave', false ],
		[ 'focusin', true ],
		[ 'focusout', false ],
	].map( ( [ name, on ] ) => {
		const fn = ( event ) => {
			if ( event.pointerType !== 'touch' ) {
				held = on;
				schedule();
			}
		};
		root.addEventListener( name, fn );
		return [ name, fn ];
	} );
	win.document.addEventListener( 'visibilitychange', schedule );

	return slider;
}
