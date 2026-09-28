/**
 * A lens under the pointer.
 *
 * @param {Object} [options]          Options.
 * @param {number} [options.size]     Radius, in heights of the slide.
 * @param {number} [options.strength] 0 is no lens, 0.5 doubles the size in
 *                                    its middle.
 * @return {Object} Effect.
 */
export const magnify = ( { size = 0.4, strength = 0.35 } = {} ) => ( {
	params: { size, strength },
	uv: `
	vec2 d = uv - uPointer;
	float far = length( d * vec2( uSize.x / uSize.y, 1.0 ) ) / size;
	float lens = pow( 1.0 - smoothstep( 0.0, 1.0, far ), 2.0 );
	return uv - d * lens * strength * uPointerIn;`,
} );
