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
} from 'shaderslide/gl';
import * as transitions from '../../../src/gl/transitions/index.js';
import { lightbox } from 'shaderslide/lightbox';

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
 * The layers of a slider.
 *
 * @param config The settings.
 * @param stack  Whether the slider is a stack: it has a transition, and no
 *               mesh to bend.
 */
export function layersOf( config: Config, stack = false ) {
	const names = config.effects.filter(
		( name ) => ! stack || name !== 'bend'
	);
	const effects = () => names.map( ( name ) => make( name, config.intensity ) );
	const layers = [];
	if ( config.canvas ) {
		layers.push(
			gl( {
				effects: stack
					? [
							...effects(),
							( transitions as Record< string, () => object > )[
								config.transition
							](),
					  ]
					: effects(),
			} )
		);
	}
	if ( config.lightbox ) {
		layers.push(
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
	return layers;
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
