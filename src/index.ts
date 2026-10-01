/**
 * gpuslider: a slider with its own motion, made to be drawn on a canvas.
 *
 * This is the core: it moves the slides of the page when they are dragged
 * or told to. Everything else is a plugin, passed in by the caller: arrows
 * and dots, keys, the wheel, autoplay (see `plugins/`), and what draws on a
 * canvas (see `gl/`). `gpuslider/full` is the core with all of `plugins/`.
 *
 *     <div class="gs" id="photos">
 *         <div class="gs-track">
 *             <div class="gs-slide"><img class="gs-media" src="…" alt="…"></div>
 *             …
 *         </div>
 *     </div>
 *
 * A plugin is a function that gets the slider and returns an object. All
 * of its members are optional:
 *
 *     const plugin = ( slider ) => ( {
 *         name: 'mine',              // slider.plugins.mine is this object
 *         layout( measured ) {},     // may change what was measured
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
 *     dragstart, dragend    the motion; the velocity it was let go with
 *     click                 { index, event }: a click on a slide that was
 *                           not the end of a drag
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
	resist,
	mod,
} from './layout.js';
import { createInput } from './input.js';
import { createDom } from './dom.js';

import type { Layout, Measured } from './layout.js';
import type { Motion } from './engine.js';

export type { Layout, Measured, Motion };

/** Where a slide is. */
export interface Place {
	/** The slide. */
	el: HTMLElement;
	/** Its start edge in the view, px. */
	x: number;
	/**
	 * How far it is from its resting place, in slides: 1 is one slide after
	 * the active one.
	 */
	p: number;
	/** How much of it is in the view, 0 to 1. */
	share: number;
	/** Whether any of it is in the view. */
	visible: boolean;
}

/** What plugins and `frame` listeners get. */
export interface View {
	/** The layout. */
	layout: Layout;
	/** The motion. */
	motion: Motion;
	/** Where each slide is. */
	places: Place[];
	/** Views per second; zero for visitors who want less motion. */
	velocity: number;
}

/** What the slider calls of a plugin. */
export interface Hooks {
	/** Name under which the slider has it in `plugins`. */
	name?: string;
	/**
	 * Gets what was measured of the slides and may change it, to lay them
	 * out another way.
	 */
	layout?: ( measured: Measured ) => void;
	/** After every layout. */
	measure?: ( view: View ) => void;
	/** Slides were added or removed. */
	slides?: () => void;
	/** Every frame while something moves. */
	frame?: ( view: View, dt: number, now: number ) => void;
	/** True asks for another frame. */
	busy?: () => boolean;
	/**
	 * Which slide is seen at a point of the page, for a plugin that draws
	 * them elsewhere than the page has them; -1 for none, nothing when the
	 * page draws them.
	 */
	at?: ( x: number, y: number ) => number | undefined;
	/** The slider goes. */
	destroy?: () => void;
}

/** The hooks, and whatever else the plugin has for those who use it. */
export type Plugin = Hooks & Record< string, any >;

/** What the listeners of each event get, before the slider. */
export interface Events {
	/** The slider. */
	ready: Slider;
	/** Snap the slider goes to. */
	change: number;
	/** Snap it came to rest at. */
	settle: number;
	/** The view. */
	frame: View;
	/** The layout. */
	measure: Layout;
	/** The slides. */
	slides: HTMLElement[];
	/** Indexes of the slides in view. */
	visible: number[];
	/** The motion. */
	dragstart: Motion;
	/** Velocity it was let go with, px per second. */
	dragend: number;
	/** The slide and the click. */
	click: { index: number; event: MouseEvent };
	/** The slider. */
	destroy: Slider;
}

/** What listens to the event of a name. */
export type Listener< K extends string > = K extends keyof Events
	? ( detail: Events[ K ], slider: Slider ) => void
	: K extends '*'
	? ( name: string, detail: any, slider: Slider ) => void
	: ( detail: any, slider: Slider ) => void;

/** What `plugins` and `use()` take: makes a plugin for a slider. */
export type Create = ( slider: Slider ) => Plugin | void;

export interface Options {
	/**
	 * Slides per view; `auto` takes each slide's own width. Without it, the
	 * CSS decides (`--gs-per-view`).
	 */
	perView?: number | 'auto';
	/** Gap in px. Without it, the CSS decides (`--gs-gap`). */
	gap?: number;
	/**
	 * `y`: the slides follow each other downwards. The slider needs a height
	 * then.
	 */
	axis?: 'x' | 'y';
	/** Go round. */
	loop?: boolean;
	/** Where the active slide rests in the view. */
	align?: 'start' | 'center' | 'end';
	/** Slides per step. */
	group?: number;
	/** No empty space at the ends. */
	contain?: boolean;
	/** Rest anywhere, not only on slides. */
	free?: boolean;
	/** Time of a move, ms. */
	duration?: number;
	/**
	 * Curve of a move to a slide, from 0 to 1 in `duration`: instead of the
	 * spring. A drag let go is the spring all the same.
	 */
	ease?: ( u: number ) => number;
	/** First slide shown. */
	start?: number;
	/** Pointer dragging. */
	drag?: boolean;
	/** Listeners, by the name of their event. */
	on?: { [ K in keyof Events ]?: Listener< K > } & Record< string, Function >;
	/** What the slider does besides moving the slides of the page. */
	plugins?: Create[];
}

// What the slider has whatever it is given.
type Given = Options &
	Required<
		Pick< Options, 'loop' | 'align' | 'group' | 'contain' | 'duration' | 'start' | 'drag' | 'plugins' >
	>;

const DEFAULTS: Given = {
	loop: false,
	align: 'start',
	group: 1,
	contain: true,
	duration: 600,
	start: 0,
	drag: true,
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
 * @param root The slider element.
 * @param options Options.
 */
export function createSlider( root: HTMLElement, options: Options = {} ) {
	const win = root.ownerDocument.defaultView!;
	const o: Given = { ...DEFAULTS, ...options };
	const track = root.querySelector< HTMLElement >( ':scope > .gs-track' )!;
	const slides: HTMLElement[] = [];
	const places: Place[] = [];
	const still = win.matchMedia( '(prefers-reduced-motion: reduce)' );
	const listeners = new Map< string, Set< Function > >();
	// Ends with the slider: what listens with this signal needs no removing.
	const ending = new win.AbortController();
	const { signal } = ending;
	const used: Plugin[] = [];
	const plugins: Record< string, any > = {};
	let layout!: Layout;
	// The snap the slider is at or on its way to. When looping it runs on
	// past both ends while the slider moves.
	let index = 0;
	let previous = 0;
	let destroyed = false;
	let dom: ReturnType< typeof createDom >;

	let classes: string[] = [];
	const dress = () => {
		root.classList.remove( ...classes );
		classes = [
			'gs-on',
			o.axis === 'y' && 'gs-y',
			o.perView === 'auto' && 'gs-auto',
		].filter( Boolean ) as string[];
		root.classList.add( ...classes );
		if ( ( o.perView as number ) > 0 ) {
			root.style.setProperty( '--gs-per-view', String( o.perView ) );
		}
		if ( ( o.gap as number ) >= 0 ) {
			root.style.setProperty( '--gs-gap', `${ o.gap }px` );
		}
	};
	dress();

	/**
	 * Tells the listeners of an event.
	 *
	 * @param name Event; plugins name theirs `plugin:event`.
	 * @param detail What the listeners get.
	 */
	const emit = ( name: string, detail?: any ) => {
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
	const within = ( to: number ) =>
		layout.loop ? to : Math.min( count() - 1, Math.max( 0, to ) );

	const view: View = {
		layout: null as unknown as Layout,
		motion: null as unknown as Motion,
		places,
		velocity: 0,
	};

	// The slides in view that were told last.
	let seen = '';

	const visible = () =>
		places.flatMap( ( { visible: is }, i ) => ( is ? [ i ] : [] ) );

	const engine = createEngine( win, {
		frame( motion, dt, now ) {
			place( layout, motion.pos, places );
			view.velocity = still.matches
				? 0
				: motion.smooth / ( layout.span || 1 );
			dom.frame( layout, motion, places );
			used.forEach( ( plugin ) => plugin.frame?.( view, dt, now ) );
			// Costs nothing while nobody listens.
			if ( listeners.get( 'visible' )?.size ) {
				const now_ = visible();
				if ( String( now_ ) !== seen ) {
					seen = String( now_ );
					emit( 'visible', now_ );
				}
			}
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
			emit( 'settle', current() );
		},
		busy: () => used.some( ( plugin ) => plugin.busy?.() ),
	} );
	const { motion } = engine;
	view.motion = motion;
	engine.duration( o.duration );
	engine.ease( o.ease || null );

	// A new target: tells it, if it is another snap.
	const aim = ( to: number, before: number ) => {
		index = to;
		if ( current() !== before ) {
			previous = before;
			emit( 'change', current() );
		}
	};

	const go = ( to: number, instant?: boolean ) => {
		const before = current();
		aim( within( to ), before );
		engine.to( positionOf( layout, index ), instant || still.matches );
	};

	// Reads the slides of the page. True when they are not the ones the
	// slider has.
	const read = () => {
		const now = [ ...track.children ] as HTMLElement[];
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
		layout = measure( root, track, slides, o, dom.moved, ( measured ) =>
			used.forEach( ( plugin ) => plugin.layout?.( measured ) )
		);
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
		if ( changed ) {
			emit( 'slides', slides );
		}
		emit( 'measure', layout );
	};

	const slider: Slider = {
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
		layout: (): Layout => layout,
		/** @return {number[]} Indexes of the slides in view. */
		visible,

		/**
		 * @param to Snap index.
		 * @param how How.
		 * @param how.instant Without a move.
		 */
		to( to: number, { instant = false }: { instant?: boolean } = {} ) {
			let step = to - current();
			// The short way round.
			if ( layout.loop ) {
				step = mod( step + count() / 2, count() ) - count() / 2;
				step = Math.round( step );
			}
			go( index + step, instant );
		},
		/**
		 * @param slide Index of a slide: with several
		 *              slides per snap not that of its snap.
		 * @param how How.
		 * @param how.instant Without a move.
		 */
		toSlide( slide: number, how?: { instant?: boolean } ) {
			slider.to( layout.snapOf[ slide ] ?? 0, how );
		},
		next: () => go( index + 1 ),
		prev: () => go( index - 1 ),

		/** The plugins that have a name, by their name. */
		plugins,

		/**
		 * Adds a plugin to a slider that exists.
		 *
		 * @param create The plugin.
		 * @return What it made.
		 */
		use( create: Create ): Plugin | void {
			const plugin = create( slider );
			if ( plugin ) {
				used.push( plugin );
				if ( plugin.name ) {
					plugins[ plugin.name ] = plugin;
				}
				// Later than the slider: it is measured again, with it.
				if ( layout ) {
					update();
				}
			}
			return plugin;
		},

		/**
		 * Changes options of a slider that exists. Not its plugins.
		 *
		 * @param change The options that change.
		 */
		set( change: Options ) {
			Object.assign( o, change );
			dress();
			engine.duration( o.duration );
			engine.ease( o.ease || null );
			update();
		},

		/**
		 * Measures again, after a change the slider cannot see. Slides that
		 * were added or removed are seen by themselves.
		 */
		update,
		/** Requests a frame: for plugins that changed what they draw. */
		wake: engine.wake,
		/**
		 * Moves the slider and where it is going by the same distance: what
		 * it is doing goes on from there.
		 *
		 * @param by Distance, px.
		 * @param push Whether it counts as speed of the slider,
		 *             which effects react to.
		 */
		shift( by: number, push?: boolean ) {
			engine.shift( by, push );
			engine.wake();
		},

		/**
		 * For what moves the slider by hand, as a pointer does: `grab()`,
		 * then `drag( position )` as often as it moves, then
		 * `release( velocity )`.
		 */
		grab() {
			engine.grab();
			emit( 'dragstart', motion );
		},
		/**
		 * @param position Position, px. Past its ends the slider
		 *                 follows only a part of the way.
		 */
		drag: ( position: number ) => engine.drag( resist( layout, position ) ),
		/**
		 * @param velocity Velocity it is let go with, px per
		 *                 second.
		 * @param from Position it was grabbed at.
		 */
		release( velocity: number, from: number = motion.pos ) {
			const glide = o.free ? GLIDE_FREE : GLIDE;
			let rest = motion.pos + velocity * glide;
			if ( ! o.free ) {
				// However fast: not further than what was in view.
				rest = Math.min(
					from + layout.span,
					Math.max( from - layout.span, rest )
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
		 * @param name Event, or `*` for all of them.
		 * @param fn Listener: gets what the event has to
		 *           say, then the slider.
		 * @return Removes the listener.
		 */
		on( name, fn ) {
			if ( ! listeners.has( name ) ) {
				listeners.set( name, new Set() );
			}
			listeners.get( name )!.add( fn );
			return () => slider.off( name, fn );
		},
		/**
		 * @param name Event.
		 * @param fn Listener, heard once.
		 * @return Removes the listener.
		 */
		once( name, fn ) {
			const off = slider.on( name, ( ( ...heard: [ any, any, any ] ) => {
				off();
				( fn as Function )( ...heard );
			} ) as typeof fn );
			return off;
		},
		/**
		 * @param name Event.
		 * @param fn Listener to remove.
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
			observer.disconnect();
			children.disconnect();
			ending.abort();
			used.forEach( ( plugin ) => plugin.destroy?.() );
			engine.destroy();
			dom.destroy();
			root.classList.remove( ...classes, 'gs-dragging' );
			listeners.clear();
		},
	};

	// Sizes change with the window, with images that load and with styles.
	let wide = 0;
	const observer = new win.ResizeObserver( ( entries ) => {
		// The slider alone, and as wide as before: its height has changed,
		// which a plugin may do on every frame of a move. What the height
		// of its slides does is seen on them.
		const own =
			entries.every( ( entry ) => entry.target === root ) &&
			Math.abs( root.clientWidth - wide ) < 1;
		if ( ! own ) {
			update();
			wide = root.clientWidth;
		}
	} );

	// Listeners given as an option are there before anything happens.
	Object.entries( o.on || {} ).forEach( ( [ name, fn ] ) =>
		slider.on( name, fn as Listener< string > )
	);

	read();
	createInput( root, slider, signal );

	// The layout is there from the first `measure` of a plugin on.
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

	// A click on a slide. The click that ends a drag does not come here.
	root.addEventListener(
		'click',
		( event ) => {
			const target = event.target as Element;
			const slide = target.closest?.( '.gs-slide' ) as HTMLElement;
			let at = -1;
			// The canvas may draw a slide elsewhere than the page has it:
			// then a plugin says which one is seen at a point. What is
			// there to be used is where the page has it.
			if ( ! target.closest?.( 'a, button, input, select, textarea, label' ) ) {
				used.forEach( ( plugin ) => {
					at = plugin.at?.( event.clientX, event.clientY ) ?? at;
				} );
			}
			if ( at < 0 ) {
				at = slides.indexOf( slide );
			}
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

/** A slider. */
export interface Slider {
	/** The slider element. */
	root: HTMLElement;
	/** Parent of the slides. */
	track: HTMLElement;
	/** The slides. */
	slides: HTMLElement[];
	/** Its options, as they are now. */
	options: Options;
	/** The motion. */
	motion: Motion;
	/** What plugins and `frame` listeners get. */
	view: View;
	/** Its window. */
	win: Window & typeof globalThis;
	/** Ends with the slider: for the listeners of plugins. */
	signal: AbortSignal;
	/** Index of the snap the slider is at or moves to. */
	readonly index: number;
	/** Index of the snap it was at before. */
	readonly previous: number;
	/** Whether the slider rests: nothing moves, nothing is drawn. */
	readonly resting: boolean;
	/** Whether there is a snap to go on to. */
	readonly canNext: boolean;
	/** Whether there is a snap to go back to. */
	readonly canPrev: boolean;
	/** How far through its slides the slider is, 0 to 1. */
	readonly progress: number;
	/** Number of snaps. */
	count: () => number;
	/** Layout. */
	layout: () => Layout;
	/** Indexes of the slides in view. */
	visible: () => number[];
	/**
	 * @param to          Snap index.
	 * @param how.instant Without a move.
	 */
	to( to: number, how?: { instant?: boolean } ): void;
	/**
	 * @param slide       Index of a slide: with several slides per snap not
	 *                    that of its snap.
	 * @param how.instant Without a move.
	 */
	toSlide( slide: number, how?: { instant?: boolean } ): void;
	next: () => void;
	prev: () => void;
	/** The plugins that have a name, by their name. */
	plugins: Record< string, any >;
	/**
	 * Adds a plugin to a slider that exists.
	 *
	 * @return What it made.
	 */
	use( create: Create ): Plugin | void;
	/** Changes options of a slider that exists. Not its plugins. */
	set( change: Options ): void;
	/**
	 * Measures again, after a change the slider cannot see. Slides that were
	 * added or removed are seen by themselves.
	 */
	update: () => void;
	/** Requests a frame: for plugins that changed what they draw. */
	wake: () => void;
	/**
	 * Moves the slider and where it is going by the same distance: what it
	 * is doing goes on from there.
	 *
	 * @param by   Distance, px.
	 * @param push Whether it counts as speed of the slider, which effects
	 *             react to.
	 */
	shift( by: number, push?: boolean ): void;
	/**
	 * For what moves the slider by hand, as a pointer does: `grab()`, then
	 * `drag( position )` as often as it moves, then `release( velocity )`.
	 */
	grab(): void;
	/**
	 * @param position Position, px. Past its ends the slider follows only a
	 *                 part of the way.
	 */
	drag: ( position: number ) => void;
	/**
	 * @param velocity Velocity it is let go with, px per second.
	 * @param from     Position it was grabbed at.
	 */
	release( velocity: number, from?: number ): void;
	/**
	 * @param name Event, or `*` for all of them.
	 * @param fn   Listener: gets what the event has to say, then the slider.
	 * @return Removes the listener.
	 */
	on< K extends string >( name: K, fn: Listener< K > ): () => void;
	/**
	 * @param name Event.
	 * @param fn   Listener, heard once.
	 * @return Removes the listener.
	 */
	once< K extends string >( name: K, fn: Listener< K > ): () => void;
	/**
	 * @param name Event.
	 * @param fn   Listener to remove.
	 */
	off( name: string, fn: Function ): void;
	/**
	 * Tells the listeners of an event.
	 *
	 * @param name   Event; plugins name theirs `plugin:event`.
	 * @param detail What the listeners get.
	 */
	emit: ( name: string, detail?: any ) => void;
	destroy(): void;
}
