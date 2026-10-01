/**
 * Where the pixels of an image are in its element: `object-fit` and
 * `object-position`, as numbers for the shader.
 */

import type { Slider } from '../index.js';

/** What the page says about a media element, read once per layout. */
export interface Style {
	/** Its `object-fit`. */
	fit: string;
	/** Its position across and down, as a share of what is left or in px. */
	at: { share?: number; px?: number }[];
	/** Radius of its corners, px. */
	radius: number;
	/** The exponent of the corners: 2 round, 4 a squircle. */
	shape: number;
}

/** Where something is, px. */
export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A media element as the layers measure it. */
export interface Box {
	/** Along the way of the slides, in the slide, px. */
	dx: number;
	/** Across, in the view, px. */
	dy: number;
	/** The element, in px of its quad. */
	at: Rect;
	style: Style;
}

/**
 * What the page says about a media element, read once per layout.
 *
 * @param media Media element.
 * @return `fit`, `at` (position as fractions or px), `radius`
 *         and `shape`, the exponent of the corners.
 */
export function styleOf( media: HTMLElement ): Style {
	const win = media.ownerDocument.defaultView!;
	const style = win.getComputedStyle( media );
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
		const around = win.getComputedStyle( parent );
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
			parseFloat( ( corners as CSSStyleDeclaration & { cornerTopLeftShape?: string } ).cornerTopLeftShape?.slice( 13 )! ),
			3
		) || 1 );
	return { fit: style.objectFit || 'fill', at, radius, shape };
}

/**
 * @param iw Width of the image.
 * @param ih Height of the image.
 * @param box The element in px of the quad: `x`, `y`, `w`,
 *            `h`.
 * @param qw Width of the quad.
 * @param qh Height of the quad.
 * @param style From `styleOf()`.
 * @param out Thirteen numbers: `box` (quad uv to texture
 *            uv: scale x and y, offset x and y), `rect`
 *            (the element in quad uv: left, top, right,
 *            bottom), `cut` (1 when the image leaves a
 *            part of its element empty) and the whole
 *            image in px of the quad (left, top, width,
 *            height).
 * @return Width the whole image is drawn at, px.
 */
export function fit( iw: number, ih: number, box: Rect, qw: number, qh: number, style: Style, out: Float32Array | number[] ): number {
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
	const left = x + ( ax.px ?? ax.share! * ( w - dw ) );
	const top = y + ( ay.px ?? ay.share! * ( h - dh ) );
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

/**
 * Whether a picture has nothing in it. WebKit gives such a bitmap now and
 * then for an image that is loaded and decoded: seen for slides out of
 * view, on a machine that is busy.
 *
 * @param canvas The picture, drawn four by four.
 * @return Nothing in it.
 */
export const empty = ( canvas: OffscreenCanvas ): boolean =>
	! canvas
		.getContext( '2d' )!
		.getImageData( 0, 0, 4, 4 )
		.data.some( ( n ) => n );

/**
 * Makes the textures of the slides next to those in view, when the page
 * has time: the first move to a picture does not wait for its texture,
 * which on a phone costs frames. Images only: a video is uploaded while it
 * plays.
 *
 * @param slider Slider.
 * @param media The media of the slides.
 * @param boxes Their boxes, as the layers measure them.
 * @param get Asks
 *        for the texture of an image drawn so wide, px.
 * @return Does it, when the page has time.
 */
export const nearby = (
	slider: Slider,
	media: ( HTMLElement | null | undefined )[],
	boxes: ( Box | null )[],
	get: ( element: HTMLImageElement, width: number ) => void
): ( () => void ) => () =>
	( slider.win.requestIdleCallback || setTimeout )( () => {
		const { places } = slider.view;
		const n = places.length;
		const { loop } = slider.layout();
		places.forEach( ( { visible }, i ) => {
			const element = media[ i ] as HTMLImageElement | null | undefined;
			const box = boxes[ i ];
			if (
				! visible &&
				element?.naturalWidth &&
				box &&
				[ i - 1, i + 1 ].some(
					( j ) => places[ loop ? ( j + n ) % n : j ]?.visible
				)
			) {
				get(
					element,
					fit( element.naturalWidth, element.naturalHeight, box.at, 1, 1, box.style, [] )
				);
			}
		} );
	} );
