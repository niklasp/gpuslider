/**
 * The slides next to the active one turn away and step back, like covers
 * in a rack.
 *
 * Moves the mesh. For a row with the active slide in the middle:
 * `align: 'center'`.
 *
 * @param {Object} [options]       Options.
 * @param {number} [options.angle] How far a slide is turned when it is one
 *                                 slide away, in degrees.
 * @param {number} [options.depth] How far it steps back, in widths of the
 *                                 slide.
 * @param {number} [options.range] Slides further away than this are turned
 *                                 as far as this.
 * @return {import('../program.js').Effect} Effect.
 */
export const coverflow = ( { angle = 50, depth = 0.4, range = 1 } = {} ) => ( {
	params: { angle, depth, range },
	vertex: `
	float away = clamp( uProgress, -range, range );
	// The side towards the middle goes back.
	float turn = radians( angle ) * away;
	float x = p.x;
	p.x = x * cos( turn );
	p.z = x * sin( turn ) - abs( away ) * depth * uSize.x;
	return p;`,
} );
