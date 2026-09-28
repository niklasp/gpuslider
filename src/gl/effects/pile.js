import { CENTRE } from '../glsl.js';

/**
 * A pile of cards: the slides lie on top of each other in the middle of
 * the view, each a little further away and turned, and the one on top
 * leaves to the side.
 *
 * Moves the mesh. For one slide per view, or `align: 'center'`.
 *
 * @param {Object} [options]        Options.
 * @param {number} [options.offset] How far a card looks out from under the
 *                                  one above it, in widths of the slide.
 * @param {number} [options.turn]   How far it is turned, in degrees.
 * @return {import('../program.js').Effect} Effect.
 */
export const pile = ( { offset = 0.06, turn = 5 } = {} ) => ( {
	head: CENTRE,
	params: { offset, turn },
	vertex: `
	// Cards that wait, and how far the card on top has left.
	float below = max( uProgress, 0.0 );
	float gone = clamp( -uProgress, 0.0, 1.0 );
	float a = radians( turn ) * ( below - gone * 4.0 );
	p.xy = vec2( p.x * cos( a ) - p.y * sin( a ), p.x * sin( a ) + p.y * cos( a ) );
	p.x += toCentre() + ( below * offset - gone * 1.2 ) * uSize.x;
	p.y -= below * offset * 0.5 * uSize.y;
	p.z -= below * 0.1 * uSize.x - gone;
	return p;`,
} );
