/**
 * The image gives way to the speed of the slider: its middle hangs back
 * like cloth that is pulled at the top and the bottom.
 *
 * @param {Object}            [options]        Options.
 * @param {number | number[]} [options.amount] How much; negative bows the
 *                                             other way. An array of one
 *                                             can be written into while it
 *                                             runs.
 * @return {import('../program.js').Effect} Effect.
 */
export const stretch = ( { amount = 1 } = {} ) => ( {
	params: { amount },
	uv: `
	float v = clamp( uVelocity, -6.0, 6.0 ) * amount;
	float bow = 1.0 - pow( 2.0 * uv.y - 1.0, 2.0 );
	uv.x += v * 0.03 * bow;
	// Closer, so that the edges have something to show.
	return ( uv - 0.5 ) * ( 1.0 - 0.02 * abs( v ) ) + 0.5;`,
} );
