/**
 * What an export may do, free or with Pro: here, and nowhere else.
 *
 * Free: films up to 1080 px on their short side, with the mark of the
 * site in a corner. Pro: up to 4K (2160 px on the short side), without
 * the mark. Pro is unlocked by a license key (see `license.ts`); nothing
 * can be paid for yet.
 */

export interface Allowed {
	/** The mark of the site in the film. */
	mark: boolean;
	/** The short side of the film, px. */
	short: number;
}

export const FREE: Allowed = { mark: true, short: 1080 };

/** The short sides Pro offers, with their names. */
export const SIZES = [
	[ 1080, '1080p' ],
	[ 1440, '1440p' ],
	[ 2160, '4K' ],
] as const;

export type Short = ( typeof SIZES )[ number ][ 0 ];

/** What Pro costs, as it is said on the page. */
export const PRICE = '$29, once';

/**
 * Where Pro is bought. TODO: the checkout of the payment provider, once
 * one is chosen. Not live: the button says so.
 */
export const CHECKOUT = '#pro-checkout';

/** Whether `CHECKOUT` leads anywhere yet. */
export const SELLING = ! CHECKOUT.startsWith( '#' );

/**
 * @param pro Whether Pro is unlocked and chosen.
 * @param short The short side chosen, for Pro.
 * @return What the export may do.
 */
export const allowed = ( pro = false, short: Short = 2160 ): Allowed =>
	pro ? { mark: false, short } : FREE;

/** How high the letters of the mark are, of the short side of the film. */
export const MARK_SIZE = 0.0235;

/** The mark, as the film shows it. */
export const MARK = 'gpuslider.com';

/**
 * Draws the mark into a frame: small, light, in the top right corner,
 * where the buttons of TikTok, Reels and Shorts are not (they are at the
 * right from the middle down, and the caption at the bottom).
 *
 * @param context Where to draw.
 * @param width Width of the frame, px.
 * @param height Height of the frame, px.
 */
export function mark( context: CanvasRenderingContext2D, width: number, height: number ) {
	const short = Math.min( width, height );
	// 2.35 % of the short side: 25 px in a film 1080 wide.
	const size = Math.round( short * MARK_SIZE );
	const tall = height > width * 1.2;
	// Below the bar of the apps at the top, in a tall film.
	const x = width - Math.round( short * 0.05 );
	const y = Math.round( tall ? height * 0.085 : short * 0.05 );
	context.save();
	context.font = `600 ${ size }px 'Funnel Display Variable', 'Funnel Sans Variable', system-ui, sans-serif`;
	context.textAlign = 'right';
	context.textBaseline = 'top';
	context.shadowColor = 'rgba(0, 0, 0, 0.55)';
	context.shadowBlur = size * 0.4;
	context.shadowOffsetY = size * 0.06;
	context.fillStyle = 'rgba(255, 255, 255, 0.82)';
	context.fillText( MARK, x, y );
	context.restore();
}
