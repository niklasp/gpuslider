/**
 * What the controls of the site set, and what the sliders make of it.
 */
import { canvas } from 'gpuslider/canvas';
import {
	stretch,
	split,
	magnify,
	spotlight,
	bend,
	coverflow,
	parallax,
	smear,
	shift,
	tilt,
	waves,
	reveal,
	glass,
	pixels,
	cells,
	pile,
	fan,
	dome,
	jelly,
	slab,
	type Effect,
} from 'gpuslider/effects';
import * as transitions from '../../../src/gl/transitions/index.js';
import { lightbox } from 'gpuslider/lightbox';
import {
	controls,
	keyboard,
	wheel,
	videos,
	autoplay,
	autoHeight,
	stack,
	progress,
	marquee,
} from 'gpuslider/plugins';
import type { Create } from 'gpuslider';

export const EFFECTS = {
	stretch: { label: 'Stretch', hint: 'The image gives way to the speed' },
	split: { label: 'Split', hint: 'The colours come apart with the speed' },
	magnify: { label: 'Lens', hint: 'A lens under the pointer' },
	spotlight: { label: 'Spotlight', hint: 'Dimmed, except under the pointer' },
	bend: { label: 'Bend', hint: 'The row is an arc' },
	parallax: { label: 'Parallax', hint: 'The image is slower than its slide' },
	jelly: { label: 'Jelly', hint: 'What moves the slides pulls them out of shape' },
	slab: { label: 'Glass', hint: 'Thick glass: its edge bends the image' },
	dome: { label: 'Dome', hint: 'What is far from the middle is smaller' },
} as const;

export type EffectName = keyof typeof EFFECTS;

/** What the pointer does to the slide it is over. */
export const POINTERS = {
	none: 'Nothing',
	waves: 'Waves',
	smear: 'Smear',
	shift: 'Colour shift',
	tilt: 'Tilt',
	reveal: 'Reveal',
	glass: 'Fluted glass',
	pixels: 'Pixels',
	cells: 'Cells',
} as const;

export type PointerName = keyof typeof POINTERS;

/** What draws the canvas. */
export const LAYERS = {
	best: 'The best there is',
	gpu: 'WebGPU',
	gl: 'WebGL',
} as const;

export type LayerName = keyof typeof LAYERS;

/** The sliders of the page. */
export type Kind =
	| 'row'
	| 'stack'
	| 'covers'
	| 'tall'
	| 'ticker'
	| 'pile'
	| 'fan'
	| 'down';

/** The transitions, and none: the slides move. */
export const TRANSITIONS = [ 'none', ...Object.keys( transitions ) ];

export type Config = {
	/** Draw on the canvas; off, the page draws. */
	canvas: boolean;
	/** What draws the canvas. */
	layer: LayerName;
	effects: EffectName[];
	pointer: PointerName;
	/** Strength of the effects, 1 is as they come. */
	intensity: number;
	transition: string;
	loop: boolean;
	autoplay: boolean;
	lightbox: boolean;
	free: boolean;
	/** Time of a move, ms. */
	duration: number;
	/** Set without making the sliders again. */
	perView: number;
	gap: number;
	focus: { x: number; y: number };
};

export const DEFAULTS: Config = {
	canvas: true,
	layer: 'best',
	effects: [ 'stretch', 'split' ],
	pointer: 'waves',
	intensity: 1,
	transition: 'liquid',
	loop: true,
	autoplay: false,
	lightbox: true,
	free: false,
	duration: 600,
	perView: 3,
	gap: 16,
	focus: { x: 50, y: 50 },
};

const make = ( name: EffectName, k: number ) =>
	( {
		stretch: () => stretch( { amount: k } ),
		split: () => split( { amount: k } ),
		magnify: () => magnify( { strength: Math.min( 0.8, 0.35 * k ) } ),
		spotlight: () => spotlight( { dim: Math.min( 0.9, 0.45 * k ) } ),
		bend: () => bend( { amount: 0.5 * k, speed: 0.25 * k } ),
		parallax: () => parallax( { amount: Math.min( 0.4, 0.2 * k ) } ),
		jelly: () => jelly( { amount: k } ),
		slab: () => slab( { bend: Math.min( 1.6, 0.8 * k ) } ),
		dome: () => dome( { amount: 0.8 * k } ),
	} )[ name ]();

const point = ( name: PointerName, k: number ): Effect[] =>
	( {
		none: () => [],
		waves: () => [ waves( { amount: k } ) ],
		smear: () => [ smear( { amount: k } ) ],
		shift: () => [ shift( { amount: k } ) ],
		tilt: () => [ tilt( { angle: Math.min( 20, 8 * k ) } ) ],
		reveal: () => [ reveal() ],
		glass: () => [ glass( { amount: k } ) ],
		pixels: () => [ pixels() ],
		cells: () => [ cells( { zoom: 0.8 * k } ) ],
	} )[ name ]();

/**
 * The plugins of a slider.
 *
 * @param config The settings.
 * @param kind   A stack has a transition, and no mesh to bend. Covers turn
 *               away from the middle: on the canvas by an effect, on the
 *               page by CSS that the `progress` plugin feeds. Tall is as
 *               high as its slides. A ticker runs by itself. A pile and a
 *               fan are laid out by an effect.
 */
export function pluginsOf( config: Config, kind: Kind = 'row' ) {
	// What lays the slides out has the mesh and the way of the image.
	const laid = kind === 'covers' || kind === 'pile' || kind === 'fan';
	const names = config.effects.filter(
		( name ) =>
			// What bends a row is for rows.
			( kind === 'row' ||
				! [ 'bend', 'dome', 'jelly' ].includes( name ) ) &&
			! ( name === 'parallax' && ( laid || kind === 'stack' ) )
	);
	const effects = (): Effect[] => [
		...names.map( ( name ) => make( name, config.intensity ) ),
		...point(
			laid && config.pointer === 'tilt' ? 'none' : config.pointer,
			config.intensity
		),
	];
	// The core moves the slides. All else is asked for.
	const plugins: Create[] = [ controls(), keyboard(), wheel(), videos() ];
	if ( kind === 'ticker' ) {
		// Slower under the pointer, faster while the page is scrolled.
		plugins.push( marquee( { speed: 50, hover: 0.2, scroll: 0.4 } ) );
	} else if ( config.autoplay ) {
		plugins.push( autoplay( 3500 ) );
	}
	if ( kind === 'tall' ) {
		plugins.push( autoHeight() );
	}
	if ( kind === 'stack' ) {
		plugins.push( stack() );
	}
	if ( config.canvas ) {
		const more: Effect[] = [];
		// Without a transition a stack fades.
		if ( kind === 'stack' && config.transition !== 'none' ) {
			more.push(
				( transitions as Record< string, () => Effect > )[
					config.transition
				]()
			);
		}
		if ( kind === 'covers' ) {
			more.push( coverflow( { angle: 45, depth: 0.35 } ) );
		}
		if ( kind === 'pile' ) {
			more.push( pile() );
		}
		if ( kind === 'fan' ) {
			more.push( fan() );
		}
		// The layer is loaded when it is known which one: the page has
		// the script of the one it draws with, and not of the other.
		plugins.push(
			canvas( {
				effects: [ ...effects(), ...more ],
				layer: config.layer === 'best' ? undefined : config.layer,
			} )
		);
	} else if ( kind === 'covers' ) {
		plugins.push( progress() );
	}
	if ( config.lightbox ) {
		plugins.push(
			lightbox( {
				// In the lightbox the image is the point: what moves with
				// the speed, and no more.
				effects: config.canvas
					? config.effects
							.filter( ( name ) => name === 'stretch' || name === 'split' )
							.map( ( name ) => make( name, config.intensity ) )
					: [],
			} )
		);
	}
	return plugins;
}

/**
 * What a slider is that shows one slide at a time: with a transition its
 * slides are on top of each other and turn into each other, without one
 * they are in a row and move. A transition is drawn by the canvas.
 */
export const single = ( config: Config ): Kind =>
	config.canvas && config.transition !== 'none' ? 'stack' : 'row';

/** What of the settings makes a slider another slider. */
export const keyOf = ( config: Config ) =>
	JSON.stringify( [
		config.canvas,
		config.layer,
		config.effects,
		config.pointer,
		config.intensity,
		config.transition,
		config.loop,
		config.autoplay,
		config.lightbox,
		config.free,
		config.duration,
	] );
