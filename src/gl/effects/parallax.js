/**
 * The image moves slower than its slide, as something further away does.
 *
 * It is drawn a little closer, so that there is image left to move.
 *
 * @param {Object} [options]        Options.
 * @param {number} [options.amount] How much slower: the share of its width
 *                                  the image stays behind per slide.
 * @return {import('../program.js').Effect} Effect.
 */
export const parallax = ( { amount = 0.2 } = {} ) => ( {
	params: { amount },
	uv: `
	uv.x = ( uv.x - 0.5 ) / ( 1.0 + amount ) + 0.5;
	uv.x += clamp( uProgress, -1.0, 1.0 ) * amount * 0.5 / ( 1.0 + amount );
	return uv;`,
} );
