/**
 * The image moves slower than its slide, as something further away does.
 *
 * It is drawn a little closer, all round, so that there is image left to
 * move.
 *
 * Both can be arrays of one number, to be written into while it runs.
 *
 * @param {Object}            [options]        Options.
 * @param {number | number[]} [options.amount] How much slower: the share of
 *                                             its width the image stays
 *                                             behind per slide.
 * @param {number | number[]} [options.zoom]   How much closer again, all
 *                                             round: 0.2 is a fifth.
 * @return {import('../program.js').Effect} Effect.
 */
export const parallax = ( { amount = 0.2, zoom = 0 } = {} ) => ( {
	params: { amount, zoom },
	uv: `
	// Closer all round, not wider: the image keeps its shape.
	uv = ( uv - 0.5 ) / ( ( 1.0 + zoom ) * ( 1.0 + amount ) ) + 0.5;
	uv.x += clamp( uProgress, -1.0, 1.0 ) * amount * 0.5 / ( 1.0 + amount );
	return uv;`,
} );
