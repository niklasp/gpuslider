/**
 * What the controls of the site set, and what the sliders make of it.
 */
import {
	gl,
	stretch,
	split,
	magnify,
	spotlight,
	bend,
	coverflow,
	type Effect,
} from 'shaderslide/gl';
import * as transitions from '../../../src/gl/transitions/index.js';
import { lightbox } from 'shaderslide/lightbox';
import {
	controls,
	keyboard,
	wheel,
	videos,
	autoplay,
	autoHeight,
	progress,
} from 'shaderslide/plugins';
import type { Create } from 'shaderslide';

export const EFFECTS = {
	stretch: { label: 'Stretch', hint: 'The image gives way to the speed' },
	split: { label: 'Split', hint: 'The colours come apart with the speed' },
	magnify: { label: 'Lens', hint: 'A lens under the pointer' },
	spotlight: { label: 'Spotlight', hint: 'Dimmed, except under the pointer' },
	bend: { label: 'Bend', hint: 'The row is an arc' },
} as const;

export type EffectName = keyof typeof EFFECTS;

export const TRANSITIONS = Object.keys( transitions );

export type Config = {
	/** Draw on the canvas; off, the page draws. */
	canvas: boolean;
	effects: EffectName[];
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
	effects: [ 'stretch', 'split' ],
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
	} )[ name ]();

/**
 * The plugins of a slider.
 *
 * @param config The settings.
 * @param kind   A stack has a transition, and no mesh to bend. Covers turn
 *               away from the middle: on the canvas by an effect, on the
 *               page by CSS that the `progress` plugin feeds. Tall is as
 *               high as its slides.
 */
export function pluginsOf(
	config: Config,
	kind: 'row' | 'stack' | 'covers' | 'tall' = 'row'
) {
	const names = config.effects.filter(
		( name ) => kind === 'row' || name !== 'bend'
	);
	const effects = (): Effect[] =>
		names.map( ( name ) => make( name, config.intensity ) );
	// The core moves the slides. All else is asked for.
	const plugins: Create[] = [ controls(), keyboard(), wheel(), videos() ];
	if ( config.autoplay ) {
		plugins.push( autoplay( 3500 ) );
	}
	if ( kind === 'tall' ) {
		plugins.push( autoHeight() );
	}
	if ( config.canvas ) {
		const more: Effect[] = [];
		if ( kind === 'stack' ) {
			more.push(
				( transitions as Record< string, () => Effect > )[
					config.transition
				]()
			);
		}
		if ( kind === 'covers' ) {
			more.push( coverflow( { angle: 45, depth: 0.35 } ) );
		}
		plugins.push( gl( { effects: [ ...effects(), ...more ] } ) );
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

/** What of the settings makes a slider another slider. */
export const keyOf = ( config: Config ) =>
	JSON.stringify( [
		config.canvas,
		config.effects,
		config.intensity,
		config.transition,
		config.loop,
		config.autoplay,
		config.lightbox,
		config.free,
		config.duration,
	] );
