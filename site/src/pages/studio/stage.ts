/**
 * Where a film is drawn: a canvas, the shader of the library with all its
 * transitions, and the pictures of the photos it needs, made as they are
 * needed. The preview has one, the export another of the size of the
 * film; both draw a moment of the timeline the same way.
 */
import { frames, type Picture } from '../../../../src/gl/frame';
import { allInOne, at, type Moment, type Plan } from './timeline';
import { pictureFor, type Photo } from './photos';

// Pictures a stage keeps: those of the cut it draws and of the next.
const KEEP = 4;

export type Stage = ReturnType< typeof createStage >;

/**
 * @param canvas Canvas; its size is the size drawn.
 * @param options Options.
 * @param options.preserve Keep the drawing readable after the task.
 */
export function createStage( canvas: HTMLCanvasElement, { preserve = false } = {} ) {
	const turn = allInOne();
	const draw = frames( canvas, [ turn ], { preserve } );
	// By the id of the photo and the size it was made for.
	const pictures = new Map< string, Promise< Picture | null > & { done?: Picture | null } >();
	let used = 0;
	const last = new Map< string, number >();

	const key = ( photo: Photo ) => `${ photo.id } ${ canvas.width }x${ canvas.height }`;

	/** The picture of a photo, asked for when it is not there yet. */
	const picture = ( photo: Photo ) => {
		const k = key( photo );
		last.set( k, ++used );
		let made = pictures.get( k );
		if ( ! made ) {
			made = pictureFor( photo, canvas.width, canvas.height ).then(
				( bitmap ) => {
					// Unless it was let go of while it was made.
					const done = pictures.get( k ) === made ? draw.picture( bitmap ) : null;
					bitmap.close();
					made!.done = done;
					return done;
				},
				() => ( made!.done = null )
			);
			pictures.set( k, made );
			sweep();
		}
		return made;
	};

	// Lets go of the pictures drawn longest ago.
	const sweep = () => {
		[ ...pictures.keys() ]
			.sort( ( a, b ) => last.get( b )! - last.get( a )! )
			.slice( KEEP )
			.forEach( ( k ) => {
				const done = pictures.get( k )!.done;
				if ( done ) {
					draw.forget( done );
				}
				pictures.delete( k );
				last.delete( k );
			} );
	};

	return {
		canvas,

		/** @return Whether the shader is there. */
		ready: () => draw.ready(),

		/**
		 * The pictures of a moment, and of the cut after it, asked for.
		 *
		 * @param photos The photos.
		 * @param moment The moment.
		 * @return When the pictures of the moment are there.
		 */
		prepare( photos: Photo[], moment: Moment ) {
			const now = [ photos[ moment.from ], photos[ moment.to ] ].filter( Boolean ).map( picture );
			const after = photos[ moment.to + 1 ];
			if ( after ) {
				picture( after );
			}
			return Promise.all( now );
		},

		/**
		 * Draws the film at a time, if what it needs is there.
		 *
		 * @param photos The photos.
		 * @param plan The film.
		 * @param t Time, s.
		 * @return Whether it was drawn.
		 */
		draw( photos: Photo[], plan: Plan, t: number ): boolean {
			const moment = at( plan, t );
			const [ a, b ] = [ moment.from, moment.to ].map(
				( i ) => photos[ i ] && picture( photos[ i ] ).done
			);
			this.prepare( photos, moment );
			if ( ! a || ! b || ! draw.ready() ) {
				return false;
			}
			turn.pick( moment.which );
			draw.draw( a, b, moment.progress, t );
			return true;
		},

		/** @param lose Lets go of the context too (see `frames()`). */
		destroy( lose = false ) {
			pictures.forEach( ( made ) => made.done && draw.forget( made.done ) );
			pictures.clear();
			draw.destroy( lose );
		},
	};
}
