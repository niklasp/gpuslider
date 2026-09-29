/**
 * Where the pixels of an image are in its element: `object-fit` and
 * `object-position`, as numbers for the shader.
 */

/**
 * What the page says about a media element, read once per layout.
 *
 * @param {HTMLElement} media Media element.
 * @return {Object} `fit`, `at` (position as fractions or px), `radius`
 *                  and `shape`, the exponent of the corners.
 */
export function styleOf( media ) {
	const style = media.ownerDocument.defaultView.getComputedStyle( media );
	const at = ( style.objectPosition || '50% 50%' )
		.split( ' ' )
		.map( ( value ) =>
			value.endsWith( '%' )
				? { share: parseFloat( value ) / 100 }
				: { px: parseFloat( value ) || 0 }
		);
	// Corners: the element's own, or those of a slide that clips it.
	let corners = style;
	let radius = parseFloat( style.borderTopLeftRadius ) || 0;
	const parent = media.parentElement;
	if ( ! radius && parent ) {
		const around = media.ownerDocument.defaultView.getComputedStyle( parent );
		if ( around.overflowX !== 'visible' ) {
			corners = around;
			radius = parseFloat( around.borderTopLeftRadius ) || 0;
		}
	}
	// Their shape: `superellipse(k)` has the exponent 2^k, so a round
	// corner has 2 and a squircle 4. A browser without `corner-shape`
	// draws round ones, and so does the canvas there.
	const shape =
		2 **
		( Math.min(
			parseFloat( corners.cornerTopLeftShape?.slice( 13 ) ),
			3
		) || 1 );
	return { fit: style.objectFit || 'fill', at, radius, shape };
}

/**
 * @param {number}       iw    Width of the image.
 * @param {number}       ih    Height of the image.
 * @param {Object}       box   The element in px of the quad: `x`, `y`, `w`,
 *                             `h`.
 * @param {number}       qw    Width of the quad.
 * @param {number}       qh    Height of the quad.
 * @param {Object}       style From `styleOf()`.
 * @param {Float32Array} out   Thirteen numbers: `box` (quad uv to texture
 *                             uv: scale x and y, offset x and y), `rect`
 *                             (the element in quad uv: left, top, right,
 *                             bottom), `cut` (1 when the image leaves a
 *                             part of its element empty) and the whole
 *                             image in px of the quad (left, top, width,
 *                             height).
 * @return {number} Width the whole image is drawn at, px.
 */
export function fit( iw, ih, box, qw, qh, style, out ) {
	const { x, y, w, h } = box;
	let sx = w / iw;
	let sy = h / ih;
	const mode = style.fit;
	if ( mode !== 'fill' ) {
		const cover = Math.max( sx, sy );
		const contain = Math.min( sx, sy );
		if ( mode === 'cover' ) {
			sx = cover;
		} else if ( mode === 'contain' ) {
			sx = contain;
		} else if ( mode === 'none' ) {
			sx = 1;
		} else {
			sx = Math.min( 1, contain );
		}
		sy = sx;
	}
	const dw = iw * sx;
	const dh = ih * sy;
	const [ ax, ay = ax ] = style.at;
	const left = x + ( ax.px ?? ax.share * ( w - dw ) );
	const top = y + ( ay.px ?? ay.share * ( h - dh ) );
	out[ 0 ] = qw / dw;
	out[ 1 ] = qh / dh;
	out[ 2 ] = -left / dw;
	out[ 3 ] = -top / dh;
	out[ 4 ] = x / qw;
	out[ 5 ] = y / qh;
	out[ 6 ] = ( x + w ) / qw;
	out[ 7 ] = ( y + h ) / qh;
	out[ 8 ] =
		left > x + 0.5 ||
		top > y + 0.5 ||
		left + dw < x + w - 0.5 ||
		top + dh < y + h - 0.5
			? 1
			: 0;
	out[ 9 ] = left;
	out[ 10 ] = top;
	out[ 11 ] = dw;
	out[ 12 ] = dh;
	return dw;
}
