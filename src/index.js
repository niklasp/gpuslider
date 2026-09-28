/**
 * shaderslide: a slider with its own motion, made to be drawn on a canvas.
 *
 * This is the core. It moves the slides of the page and knows nothing
 * about WebGL: what draws on a canvas is a plugin, passed in by the caller
 * (see `gl/`).
 *
 *     <div class="ss" id="photos">
 *         <div class="ss-track">
 *             <div class="ss-slide"><img class="ss-media" src="…" alt="…"></div>
 *             …
 *         </div>
 *         <button data-ss-prev>…</button>
 *         <button data-ss-next>…</button>
 *         <div data-ss-dots></div>
 *     </div>
 *
 * A plugin is a function that gets the slider and returns an object. All
 * of its members are optional:
 *
 *     const plugin = ( slider ) => ( {
 *         name: 'mine',              // slider.plugins.mine is this object
 *         measure( view ) {},        // after every layout
 *         slides() {},               // slides were added or removed
 *         frame( view, dt, now ) {}, // every frame while something moves
 *         busy: () => false,         // true asks for another frame
 *         destroy() {},
 *     } );
 *
 * Events, with what their listeners get before the slider itself:
 *
 *     ready                 the slider
 *     change                index of the snap the slider goes to
 *     settle                index of the snap it came to rest at
 *     frame                 the view, on every frame
 *     measure               the layout, after it was measured
 *     slides                the slides, after some were added or removed
 *     visible               indexes of the slides in view, when they change
 *     edge                  { start, end }: whether it is at one, when that
 *                           changes
 *     dragstart, dragend    the motion; the velocity it was let go with
 *     click                 { index, event }: a click on a slide that was
 *                           not the end of a drag
 *     screen                whether the slider is on the screen
 *     play, pause           autoplay
 *     destroy               the slider
 *     *                     the name of any event, then what it gets
 *
 * Plugins emit their own, named `plugin:event`.
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
 * @typedef {import('./layout.js').Layout} Layout
 * @typedef {import('./engine.js').Motion} Motion
 */

/**
 * @typedef {Object} Place Where a slide is.
 * @property {HTMLElement} el      The slide.
 * @property {number}      x       Its start edge in the view, px.
 * @property {number}      p       How far it is from its resting place, in
 *                                 slides: 1 is one slide after the active
 *                                 one.
 * @property {number}      share   How much of it is in the view, 0 to 1.
 * @property {boolean}     visible Whether any of it is in the view.
 */

/**
 * @typedef {Object} View What plugins and `frame` listeners get.
 * @property {Layout}  layout   The layout.
 * @property {Motion}  motion   The motion.
 * @property {Place[]} places   Where each slide is.
 * @property {number}  velocity Views per second; zero for visitors who
 *                              want less motion.
 */

/**
 * @typedef {Object} Hooks What the slider calls of a plugin.
 * @property {string}                                      [name]    Name
 *           under which the slider has it in `plugins`.
 * @property {(view: View) => void}                        [measure] After
 *           every layout.
 * @property {() => void}                                  [slides]  Slides
 *           were added or removed.
 * @property {(view: View, dt: number, now: number) => void} [frame] Every
 *           frame while something moves.
 * @property {() => boolean}                               [busy]    True
 *           asks for another frame.
 * @property {() => void}                                  [destroy] The
 *           slider goes.
 */

/**
 * @typedef {Hooks & Record<string, any>} Plugin The hooks, and whatever
 *          else the plugin has for those who use it.
 */

/**
 * @typedef {HTMLElement | HTMLElement[] | string} Elements An element,
 *          several, or a selector.
 */

/**
 * @typedef {Object} Events What the listeners of each event get, before the
 *          slider.
 * @property {Slider}           ready     The slider.
 * @property {number}           change    Snap the slider goes to.
 * @property {number}           settle    Snap it came to rest at.
 * @property {View}             frame     The view.
 * @property {Layout}           measure   The layout.
 * @property {HTMLElement[]}    slides    The slides.
 * @property {number[]}         visible   Indexes of the slides in view.
 * @property {{ start: boolean, end: boolean }} edge Whether it is at one.
 * @property {Motion}           dragstart The motion.
 * @property {number}           dragend   Velocity it was let go with, px per
 *                                        second.
 * @property {{ index: number, event: MouseEvent }} click The slide and the
 *                                        click.
 * @property {boolean}          screen    Whether it is on the screen.
 * @property {undefined}        play      Nothing.
 * @property {undefined}        pause     Nothing.
 * @property {Slider}           destroy   The slider.
 */

/**
 * @template {string} K
 * @typedef {K extends keyof Events
 *     ? (detail: Events[K], slider: Slider) => void
 *     : K extends '*'
 *     ? (name: string, detail: any, slider: Slider) => void
 *     : (detail: any, slider: Slider) => void} Listener What listens to the
 *          event of a name.
 */

/**
 * @typedef {(slider: Slider) => (Plugin | void)} Create What `plugins` and
 *          `use()` take: makes a plugin for a slider.
 */

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
 * @property {Elements}               [prev]     Buttons that go back,
 *                                               anywhere on the page.
 * @property {Elements}               [next]     Buttons that go on.
 * @property {Elements}               [pause]    Buttons that stop autoplay.
 * @property {Elements}               [dots]     Elements to fill with dots.
 * @property {{ [K in keyof Events]?: Listener<K> } & Record<string, Function>} [on]
 *                                               Listeners, by the name of
 *                                               their event.
 * @property {Create[]}               [plugins]  What the slider does
 *                                               besides moving the slides
 *                                               of the page.
 */

/** @type {Options} */
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
	plugins: [],
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
 */
export function createSlider( root, options = {} ) {
	const win = root.ownerDocument.defaultView;
	/** @type {Options} */
	const o = { ...DEFAULTS, ...options };
	/** @type {HTMLElement} */
	const track = root.querySelector( ':scope > .ss-track' );
	/** @type {HTMLElement[]} */
	const slides = [];
	/** @type {Place[]} */
	const places = [];
	const still = win.matchMedia( '(prefers-reduced-motion: reduce)' );
	const listeners = new Map();
	// Ends with the slider: what listens with this signal needs no removing.
	const ending = new win.AbortController();
	const { signal } = ending;
	/** @type {Plugin[]} */
	const used = [];
	/** @type {Record<string, any>} */
	const plugins = {};
	/** @type {Layout} */
	let layout;
	// The snap the slider is at or on its way to. When looping it runs on
	// past both ends while the slider moves.
	let index = 0;
	let previous = 0;
	let destroyed = false;
	let dom;

	let classes = [];
	const dress = () => {
		root.classList.remove( ...classes );
		classes = [
			'ss-on',
			o.mode === 'stack' && 'ss-stack',
			o.perView === 'auto' && 'ss-auto',
			o.autoHeight && 'ss-tall',
		].filter( Boolean );
		root.classList.add( ...classes );
		if ( o.perView > 0 ) {
			root.style.setProperty( '--ss-per-view', String( o.perView ) );
		}
		if ( o.gap >= 0 ) {
			root.style.setProperty( '--ss-gap', `${ o.gap }px` );
		}
	};
	dress();

	/**
	 * Tells the listeners of an event.
	 *
	 * @param {string} name     Event; plugins name theirs `plugin:event`.
	 * @param {*}      [detail] What the listeners get.
	 */
	const emit = ( name, detail ) => {
		listeners
			.get( name )
			?.forEach( ( fn ) => fn( detail, slider ) );
		listeners
			.get( '*' )
			?.forEach( ( fn ) => fn( name, detail, slider ) );
	};

	const count = () => layout.snaps.length;
	const current = () => mod( index, count() );
	// A snap there is, unless the slider goes round.
	const within = ( to ) =>
		layout.loop ? to : Math.min( count() - 1, Math.max( 0, to ) );

	/** @type {View} */
	const view = {
		layout: null,
		motion: null,
		places,
		velocity: 0,
	};

	// Whether the slider is on the screen, and whether the visitor is
	// busy with it: autoplay and videos depend on both.
	let awake = true;
	let held = false;
	let paused = false;
	let height = -1;
	let timer = 0;
	// What was told last, to tell only what changes.
	let seen = '';
	let edges = '';

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

	const visible = () =>
		places.flatMap( ( { visible: is }, i ) => ( is ? [ i ] : [] ) );

	const tell = () => {
		const now = visible();
		if ( String( now ) !== seen ) {
			seen = String( now );
			emit( 'visible', now );
		}
		const edge = { start: ! slider.canPrev, end: ! slider.canNext };
		if ( `${ edge.start }${ edge.end }` !== edges ) {
			edges = `${ edge.start }${ edge.end }`;
			emit( 'edge', edge );
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
			used.forEach( ( plugin ) => plugin.frame?.( view, dt, now ) );
			tell();
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
		busy: () => used.some( ( plugin ) => plugin.busy?.() ),
	} );
	const { motion } = engine;
	view.motion = motion;
	engine.duration( o.duration );

	// A new target: tells it, if it is another snap.
	const aim = ( to, before ) => {
		index = to;
		if ( current() !== before ) {
			previous = before;
			controls.update();
			emit( 'change', current() );
		}
	};

	const go = ( to, instant ) => {
		const before = current();
		win.clearTimeout( timer );
		aim( within( to ), before );
		engine.to( positionOf( layout, index ), instant || still.matches );
	};

	// Reads the slides of the page. True when they are not the ones the
	// slider has.
	const read = () => {
		const now = /** @type {HTMLElement[]} */ ( [ ...track.children ] );
		if (
			now.length === slides.length &&
			now.every( ( el, i ) => el === slides[ i ] )
		) {
			return false;
		}
		dom?.destroy();
		slides.forEach( ( slide ) => observer?.unobserve( slide ) );
		slides.splice( 0, slides.length, ...now );
		places.splice(
			0,
			places.length,
			...now.map( ( el ) => ( {
				el,
				x: 0,
				p: 0,
				share: 0,
				visible: false,
			} ) )
		);
		dom = createDom( root, track, slides );
		slides.forEach( ( slide ) => observer?.observe( slide ) );
		return true;
	};

	const update = () => {
		if ( destroyed ) {
			return;
		}
		const changed = read();
		const resting = ! motion.dragging && motion.pos === motion.target;
		layout = measure( root, track, slides, o, dom.moved );
		view.layout = layout;
		index = within( index );
		if ( changed ) {
			used.forEach( ( plugin ) => plugin.slides?.() );
		}
		used.forEach( ( plugin ) => plugin.measure?.( view ) );
		if ( motion.dragging ) {
			motion.target = positionOf( layout, index );
		} else {
			engine.to( positionOf( layout, index ), resting );
		}
		height = -1;
		controls.update();
		if ( changed ) {
			emit( 'slides', slides );
		}
		emit( 'measure', layout );
	};

	const stop = ( on ) => {
		if ( on !== paused ) {
			paused = on;
			schedule();
			controls.update();
			emit( on ? 'pause' : 'play' );
		}
	};

	const slider = {
		root,
		track,
		slides,
		options: o,
		motion,
		view,
		win,
		/** Ends with the slider: for the listeners of plugins. */
		signal,

		/** Index of the snap the slider is at or moves to. */
		get index() {
			return current();
		},
		/** Index of the snap it was at before. */
		get previous() {
			return previous;
		},
		/** Whether the slider rests: nothing moves, nothing is drawn. */
		get resting() {
			return engine.resting();
		},
		/** Whether there is a snap to go on to. */
		get canNext() {
			return layout.loop || current() < count() - 1;
		},
		/** Whether there is a snap to go back to. */
		get canPrev() {
			return layout.loop || current() > 0;
		},
		/** How far through its slides the slider is, 0 to 1. */
		get progress() {
			const { snaps, loop, length } = layout;
			const from = snaps[ 0 ];
			const way = loop ? length : snaps[ snaps.length - 1 ] - from;
			const at = loop ? mod( motion.pos - from, length ) : motion.pos - from;
			return way ? Math.min( 1, Math.max( 0, at / way ) ) : 0;
		},
		/** @return {number} Number of snaps. */
		count,
		/** @return {Layout} Layout. */
		layout: () => layout,
		/** @return {number[]} Indexes of the slides in view. */
		visible,

		/**
		 * @param {number}  to            Snap index.
		 * @param {Object}  [how]         How.
		 * @param {boolean} [how.instant] Without a move.
		 */
		to( to, { instant = false } = {} ) {
			let step = to - current();
			// The short way round.
			if ( layout.loop ) {
				step = mod( step + count() / 2, count() ) - count() / 2;
				step = Math.round( step );
			}
			go( index + step, instant );
		},
		/**
		 * @param {number}  slide         Index of a slide: with several
		 *                                slides per snap not that of its snap.
		 * @param {Object}  [how]         How.
		 * @param {boolean} [how.instant] Without a move.
		 */
		toSlide( slide, how ) {
			slider.to( layout.snapOf[ slide ] ?? 0, how );
		},
		next: () => go( index + 1 ),
		prev: () => go( index - 1 ),

		/** Whether autoplay is stopped by `pause()`. */
		get paused() {
			return paused;
		},
		/** Stops autoplay until `play()`. */
		pause: () => stop( true ),
		/** Lets autoplay go on. */
		play: () => stop( false ),

		/** The plugins that have a name, by their name. */
		plugins,

		/**
		 * Adds a plugin to a slider that exists.
		 *
		 * @param {Create} create The plugin.
		 * @return {Plugin | void} What it made.
		 */
		use( create ) {
			const plugin = create( slider );
			if ( plugin ) {
				used.push( plugin );
				if ( plugin.name ) {
					plugins[ plugin.name ] = plugin;
				}
				if ( layout ) {
					plugin.measure?.( view );
					engine.wake();
				}
			}
			return plugin;
		},

		/**
		 * Changes options of a slider that exists. Not its plugins.
		 *
		 * @param {Options} change The options that change.
		 */
		set( change ) {
			Object.assign( o, change );
			dress();
			engine.duration( o.duration );
			update();
			schedule();
		},

		/**
		 * Measures again, after a change the slider cannot see. Slides that
		 * were added or removed are seen by themselves.
		 */
		update,
		/** Requests a frame: for plugins that changed what they draw. */
		wake: engine.wake,

		/**
		 * For what moves the slider by hand, as a pointer does: `grab()`,
		 * then `drag( position )` as often as it moves, then
		 * `release( velocity )`.
		 */
		grab() {
			win.clearTimeout( timer );
			engine.grab();
			emit( 'dragstart', motion );
		},
		/**
		 * @param {number} position Position, px.
		 */
		drag: ( position ) => engine.drag( position ),
		/**
		 * @param {number} velocity Velocity it is let go with, px per
		 *                          second.
		 * @param {number} [from]   Position it was grabbed at.
		 */
		release( velocity, from = motion.pos ) {
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
			to = within( to );
			if ( ! layout.loop ) {
				rest = Math.min(
					layout.snaps[ count() - 1 ],
					Math.max( layout.snaps[ 0 ], rest )
				);
			}
			const before = current();
			engine.release(
				still.matches ? 0 : velocity,
				o.free ? rest : positionOf( layout, to )
			);
			emit( 'dragend', velocity );
			aim( to, before );
		},

		/**
		 * @template {string} K
		 * @param {K}           name Event, or `*` for all of them.
		 * @param {Listener<K>} fn   Listener: gets what the event has to
		 *                           say, then the slider.
		 * @return {() => void} Removes the listener.
		 */
		on( name, fn ) {
			if ( ! listeners.has( name ) ) {
				listeners.set( name, new Set() );
			}
			listeners.get( name ).add( fn );
			return () => slider.off( name, fn );
		},
		/**
		 * @template {string} K
		 * @param {K}           name Event.
		 * @param {Listener<K>} fn   Listener, heard once.
		 * @return {() => void} Removes the listener.
		 */
		once( name, fn ) {
			const off = slider.on( name, ( ...heard ) => {
				off();
				fn( ...heard );
			} );
			return off;
		},
		/**
		 * @param {string}   name Event.
		 * @param {Function} fn   Listener to remove.
		 */
		off( name, fn ) {
			listeners.get( name )?.delete( fn );
		},
		emit,

		destroy() {
			if ( destroyed ) {
				return;
			}
			emit( 'destroy', slider );
			destroyed = true;
			win.clearTimeout( timer );
			observer.disconnect();
			watcher.disconnect();
			children.disconnect();
			ending.abort();
			track.style.height = '';
			used.forEach( ( plugin ) => plugin.destroy?.() );
			engine.destroy();
			controls.destroy();
			dom.destroy();
			root.classList.remove( ...classes, 'ss-dragging' );
			listeners.clear();
		},
	};

	// Sizes change with the window, with images that load and with styles.
	let wide = 0;
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

	// Listeners given as an option are there before anything happens.
	Object.entries( o.on || {} ).forEach( ( [ name, fn ] ) =>
		slider.on( name, fn )
	);

	read();
	const controls = createControls( root, slider, o, signal );
	createInput( root, slider, signal );

	layout = measure( root, track, slides, o, dom.moved );
	view.layout = layout;
	o.plugins.forEach( slider.use );
	index = o.start;
	update();
	engine.to( positionOf( layout, index ), true );
	previous = current();

	wide = layout.width;
	observer.observe( root );

	// Slides that are added or removed.
	const children = new win.MutationObserver( update );
	children.observe( track, { childList: true } );

	const watcher = new win.IntersectionObserver( ( entries ) => {
		const on = entries[ entries.length - 1 ].isIntersecting;
		if ( on !== awake ) {
			awake = on;
			emit( 'screen', on );
		}
		schedule();
		// For the videos, which follow the view.
		engine.wake();
	} );
	watcher.observe( root );

	// Autoplay waits while the visitor points at the slider or is in it.
	[ 'pointerenter', 'pointerleave', 'focusin', 'focusout' ].forEach(
		( name, i ) =>
			root.addEventListener(
				name,
				( event ) => {
					if ( event.pointerType !== 'touch' ) {
						held = i % 2 === 0;
						schedule();
					}
				},
				{ signal }
			)
	);
	win.document.addEventListener( 'visibilitychange', schedule, { signal } );

	// A click on a slide. The click that ends a drag does not come here.
	root.addEventListener(
		'click',
		( event ) => {
			const at = slides.indexOf( event.target.closest?.( '.ss-slide' ) );
			if ( at >= 0 ) {
				emit( 'click', { index: at, event } );
			}
		},
		{ signal }
	);

	// `ready` waits for the listeners that are added right after the slider
	// is made.
	win.queueMicrotask( () => destroyed || emit( 'ready', slider ) );
	return slider;
}

/**
 * @typedef {ReturnType<typeof createSlider>} Slider
 */
