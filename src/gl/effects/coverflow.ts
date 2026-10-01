import type { Effect } from '../program.js';

/**
 * The slides next to the active one turn away and step back, like covers
 * in a rack.
 *
 * Moves the mesh, and says where to in JS too (`place`): a click finds
 * the slide that is seen. For a row with the active slide in the middle:
 * `align: 'center'`.
 *
 * @param options Options.
 * @param options.angle How far a slide is turned when it is one
 *                      slide away, in degrees.
 * @param options.depth How far it steps back, in widths of the
 *                      slide.
 * @param options.range Slides further away than this are turned
 *                      as far as this.
 * @return Effect.
 */
export const coverflow = ( { angle = 50, depth = 0.4, range = 1 }: { angle?: number; depth?: number; range?: number } = {} ): Effect => ( {
	params: { angle, depth, range },
	vertex: `
	float away = clamp( uProgress, -range, range );
	// The side towards the middle goes back.
	float turn = radians( angle ) * away;
	float x = p.x;
	p.x = x * cos( turn );
	p.z = x * sin( turn ) - abs( away ) * depth * uSize.x;
	return p;`,
	place( p, { progress, size } ) {
		const away = Math.max( -range, Math.min( range, progress ) );
		const turn = ( angle * Math.PI * away ) / 180;
		const [ x ] = p;
		p[ 0 ] = x * Math.cos( turn );
		p[ 2 ] = x * Math.sin( turn ) - Math.abs( away ) * depth * size[ 0 ];
	},
} );
