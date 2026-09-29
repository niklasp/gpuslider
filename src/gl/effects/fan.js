import { CENTRE } from '../glsl.js';

/**
 * The slides are a hand of cards, or a wheel: they turn around a point
 * below the view.
 *
 * Moves the mesh. For one slide per view, or `align: 'center'`.
 *
 * @param {Object} [options]        Options.
 * @param {number} [options.angle]  Between a slide and the next, in degrees.
 * @param {number} [options.radius] How far below the point is, in heights of
 *                                  the slide.
 * @return {import('../program.js').Effect} Effect.
 */
export const fan = ( { angle = 14, radius = 2.2 } = {} ) => ( {
	head: CENTRE,
	params: { angle, radius },
	vertex: `
	float a = radians( angle ) * uProgress;
	vec2 from = vec2( p.x, p.y - radius * uSize.y );
	p.x = toCentre() + from.x * cos( a ) - from.y * sin( a );
	p.y = radius * uSize.y + from.x * sin( a ) + from.y * cos( a );
	p.z -= abs( uProgress ) * 0.02 * uSize.x;
	return p;`,
	place( p, { progress, size, view, quad } ) {
		const a = ( angle * Math.PI * progress ) / 180;
		const x = p[ 0 ];
		const y = p[ 1 ] - radius * size[ 1 ];
		p[ 0 ] =
			view[ 0 ] / 2 -
			quad[ 0 ] -
			quad[ 2 ] / 2 +
			x * Math.cos( a ) -
			y * Math.sin( a );
		p[ 1 ] = radius * size[ 1 ] + x * Math.sin( a ) + y * Math.cos( a );
		p[ 2 ] -= Math.abs( progress ) * 0.02 * size[ 0 ];
	},
} );
