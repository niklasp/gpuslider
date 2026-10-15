/**
 * The look of each transition, to pick it by: a strip of frames of it
 * between two sample photos, made once with one canvas that is let go of
 * after, and played by CSS (see `.studio-sprite`). Nothing is drawn by
 * WebGL while the strips play.
 */
import { createStage } from './stage';
import { TRANSITIONS } from './timeline';
import type { Photo } from './photos';

/** Frames of a strip: as many as `studio.css` steps through. */
export const FRAMES = 20;

const pause = () =>
	new Promise( ( done ) => ( window.requestIdleCallback || setTimeout )( () => done( 0 ) ) );

/**
 * @param photos Two photos.
 * @param size Side of a frame, px.
 * @param made Called with the index of each transition and its strip, an
 *             address of a blob.
 * @param signal Stops it.
 */
export async function strips(
	photos: Photo[],
	size: number,
	made: ( i: number, url: string ) => void,
	signal: AbortSignal
) {
	const gl = document.createElement( 'canvas' );
	gl.width = gl.height = size;
	const stage = createStage( gl, { preserve: true } );
	const strip = document.createElement( 'canvas' );
	strip.width = size * FRAMES;
	strip.height = size;
	const context = strip.getContext( '2d' )!;
	try {
		for ( let i = 0; i < TRANSITIONS.length && ! signal.aborted; i++ ) {
			// From the first photo to the second in a second, at an even
			// pace: the time whose eased progress is that of the frame, so
			// that the strip is not most of the time at its ends.
			const plan = { count: 2, hold: 0, turn: 1, choice: i, order: [] };
			for ( let k = 0; k < FRAMES; k++ ) {
				const p = k / ( FRAMES - 1 );
				const t = p < 0.5 ? Math.cbrt( p / 4 ) : 1 - Math.cbrt( 2 * ( 1 - p ) ) / 2;
				while ( ! stage.draw( photos, plan, t ) ) {
					if ( signal.aborted ) {
						return;
					}
					await new Promise( ( done ) => setTimeout( done, 30 ) );
				}
				context.drawImage( gl, k * size, 0 );
			}
			const blob = await new Promise< Blob | null >( ( done ) => strip.toBlob( done, 'image/jpeg', 0.82 ) );
			if ( blob && ! signal.aborted ) {
				made( i, URL.createObjectURL( blob ) );
			}
			// The page has its turn between two.
			await pause();
		}
	} finally {
		stage.destroy( true );
	}
}
