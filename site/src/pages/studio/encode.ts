/**
 * The film as an MP4: drawn frame by frame at the time of each frame, not
 * recorded from the screen, so every frame is the one the timeline says,
 * however slow the device. H.264 by the encoder of the browser
 * (WebCodecs), put into a file by `mp4.ts`.
 */
import { createStage } from './stage';
import { length, at, type Plan } from './timeline';
import { mark, MARK_SIZE, type Allowed } from './plan';
import { mux, type Sample } from './mp4';
import type { Photo } from './photos';

/** Frames per second. */
export const FPS = 30;

// Main, then Baseline, then High, at the level that a size needs: 4.0
// carries 1080 × 1920 at 30 frames, 5.0 1440 × 2560, 5.1 4K.
const CODECS = [
	[ 2.1e6, [ 'avc1.4d0028', 'avc1.420028', 'avc1.640028' ] ],
	[ 3.7e6, [ 'avc1.4d0032', 'avc1.420032', 'avc1.640032' ] ],
	[ 8.9e6, [ 'avc1.4d0033', 'avc1.420033', 'avc1.640033' ] ],
] as const;

const SCALE = 90000;

/** Whether the browser has what an export needs. */
export const canEncode = () =>
	typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;

/**
 * @param width Width, px.
 * @param height Height, px.
 * @return The first setting of the encoder the browser takes; null for none.
 */
export async function settingFor( width: number, height: number ): Promise< VideoEncoderConfig | null > {
	if ( ! canEncode() ) {
		return null;
	}
	const [ , codecs ] = CODECS.find( ( [ most ] ) => width * height <= most ) || CODECS[ CODECS.length - 1 ];
	for ( const codec of codecs ) {
		const config: VideoEncoderConfig = {
			codec,
			width,
			height,
			framerate: FPS,
			// About 0.15 bits a pixel: photos that move stay sharp.
			bitrate: Math.round( Math.min( 40e6, Math.max( 2e6, width * height * FPS * 0.15 ) ) ),
			avc: { format: 'avc' },
			latencyMode: 'quality',
		};
		try {
			const { supported } = await VideoEncoder.isConfigSupported( config );
			if ( supported ) {
				return config;
			}
		} catch {}
	}
	return null;
}

// Gives the page a turn: progress is painted, cancel is heard. Not a
// timer, which a tab in the background has only once a second.
const breathe = () =>
	new Promise< void >( ( done ) => {
		const { port1, port2 } = new MessageChannel();
		port1.onmessage = () => done();
		port2.postMessage( 0 );
	} );

const later = ( ms: number ) => new Promise( ( done ) => setTimeout( done, ms ) );

/**
 * @param options What to export.
 * @param options.photos The photos.
 * @param options.plan The film.
 * @param options.width Width, px.
 * @param options.height Height, px.
 * @param options.allowed What the export may do.
 * @param options.progress Hears how far it is, 0 to 1.
 * @param options.signal Stops it.
 * @return The file.
 */
export async function encode( {
	photos,
	plan,
	width,
	height,
	allowed,
	progress,
	signal,
}: {
	photos: Photo[];
	plan: Plan;
	width: number;
	height: number;
	allowed: Allowed;
	progress: ( done: number ) => void;
	signal: AbortSignal;
} ): Promise< Blob > {
	const config = await settingFor( width, height );
	if ( ! config ) {
		throw new Error( `This browser cannot encode H.264 at ${ width } × ${ height }.` );
	}
	const gl = document.createElement( 'canvas' );
	gl.width = width;
	gl.height = height;
	const stage = createStage( gl, { preserve: true } );
	const film = document.createElement( 'canvas' );
	film.width = width;
	film.height = height;
	const context = film.getContext( '2d' )!;
	if ( allowed.mark ) {
		await document.fonts.load( `600 ${ Math.round( Math.min( width, height ) * MARK_SIZE ) }px 'Funnel Display Variable'` ).catch( () => {} );
	}

	const samples: Sample[] = [];
	let description: Uint8Array | null = null;
	let failed: unknown = null;
	let previous = -1;
	const encoder = new VideoEncoder( {
		output( chunk, meta ) {
			const data = new Uint8Array( chunk.byteLength );
			chunk.copyTo( data );
			if ( chunk.timestamp < previous ) {
				failed = new Error( 'The encoder gave frames out of order.' );
			}
			previous = chunk.timestamp;
			samples.push( { data, key: chunk.type === 'key', duration: SCALE / FPS } );
			const made = meta?.decoderConfig?.description;
			if ( made && ! description ) {
				description = new Uint8Array(
					ArrayBuffer.isView( made ) ? made.buffer.slice( made.byteOffset, made.byteOffset + made.byteLength ) : made.slice( 0 )
				);
			}
		},
		error( error ) {
			failed = error;
		},
	} );
	try {
		encoder.configure( config );
		while ( ! stage.ready() ) {
			signal.throwIfAborted();
			await later( 16 );
		}
		const count = Math.max( 1, Math.round( length( plan ) * FPS ) );
		for ( let i = 0; i < count; i++ ) {
			signal.throwIfAborted();
			if ( failed ) {
				throw failed;
			}
			const t = i / FPS;
			await stage.prepare( photos, at( plan, t ) );
			// The pictures are there; one that could not be made is not.
			if ( ! stage.draw( photos, plan, t ) ) {
				throw new Error( 'A photo could not be drawn.' );
			}
			context.fillStyle = '#000';
			context.fillRect( 0, 0, width, height );
			context.drawImage( gl, 0, 0, width, height );
			if ( allowed.mark ) {
				mark( context, width, height );
			}
			const frame = new VideoFrame( film, {
				timestamp: Math.round( ( i * 1e6 ) / FPS ),
				duration: Math.round( 1e6 / FPS ),
			} );
			// A key frame every two seconds.
			encoder.encode( frame, { keyFrame: i % ( FPS * 2 ) === 0 } );
			frame.close();
			// The encoder says when it has taken a frame; a timer, only for
			// a browser that does not.
			while ( encoder.encodeQueueSize > 4 ) {
				await Promise.race( [
					new Promise( ( done ) => encoder.addEventListener( 'dequeue', done, { once: true } ) ),
					later( 50 ),
				] );
			}
			progress( ( i + 1 ) / count );
			await breathe();
		}
		await encoder.flush();
		if ( failed ) {
			throw failed;
		}
		if ( ! description ) {
			throw new Error( 'The encoder said nothing of how to decode the film.' );
		}
		return new Blob( [ mux( samples, { width, height, config: description, scale: SCALE } ) ], {
			type: 'video/mp4',
		} );
	} finally {
		if ( encoder.state !== 'closed' ) {
			encoder.close();
		}
		stage.destroy( true );
	}
}
