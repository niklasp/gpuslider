/**
 * What an export may do. Free: the films are 1080 px on their short side
 * and carry the mark of the site in a corner.
 *
 * PRO: a paid plan comes in here, and only here: `{ mark: false, short:
 * 2160 }` for films without the mark, in 4K (3840 × 2160 needs H.264 of
 * level 5.1, see `CODECS` in `encode.ts`). Nothing is paid for in v1.
 */
export interface Allowed {
	/** The mark of the site in the film. */
	mark: boolean;
	/** The short side of the film, px. */
	short: number;
}

export const FREE: Allowed = { mark: true, short: 1080 };

/** What the visitor may do. */
export const allowed = (): Allowed => FREE;

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
