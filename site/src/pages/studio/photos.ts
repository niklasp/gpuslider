/**
 * The photos of the film: files of the visitor, read by this page and
 * nowhere else. Nothing is sent: a file becomes a picture in the memory of
 * the browser, and a small one for the list.
 */

export interface Photo {
	id: string;
	name: string;
	/** Where the picture is: the file, or an address of the site. */
	source: Blob | string;
	width: number;
	height: number;
	/** A small picture for the list: an address of a blob. */
	thumb: string;
	/** Its colour, on average: for the light behind the preview. */
	color: string;
}

let made = 0;

const decode = async ( source: Blob | string, size?: { resizeWidth: number; resizeHeight: number } ) => {
	const blob = typeof source === 'string' ? await ( await fetch( source ) ).blob() : source;
	// The way a phone held it, turned as it was meant to be.
	return createImageBitmap( blob, {
		imageOrientation: 'from-image',
		...( size ? { ...size, resizeQuality: 'high' } : {} ),
	} as ImageBitmapOptions );
};

/**
 * @param source A file, or the address of a photo of the site.
 * @param name What to call it.
 * @return The photo; throws when the browser cannot read it.
 */
export async function read( source: Blob | string, name: string ): Promise< Photo > {
	const full = await decode( source );
	const { width, height } = full;
	// The small one: 240 px on its short side.
	const scale = Math.min( 1, 240 / Math.min( width, height ) );
	const canvas = document.createElement( 'canvas' );
	canvas.width = Math.max( 1, Math.round( width * scale ) );
	canvas.height = Math.max( 1, Math.round( height * scale ) );
	canvas.getContext( '2d' )!.drawImage( full, 0, 0, canvas.width, canvas.height );
	full.close();
	const one = document.createElement( 'canvas' );
	one.width = one.height = 1;
	const dot = one.getContext( '2d', { willReadFrequently: true } )!;
	dot.drawImage( canvas, 0, 0, 1, 1 );
	const [ r, g, b ] = dot.getImageData( 0, 0, 1, 1 ).data;
	const thumb = await new Promise< Blob | null >( ( done ) =>
		canvas.toBlob( done, 'image/jpeg', 0.8 )
	);
	return {
		id: `p${ ++made }`,
		name,
		source,
		width,
		height,
		thumb: thumb ? URL.createObjectURL( thumb ) : '',
		color: `rgb(${ r } ${ g } ${ b })`,
	};
}

/**
 * The picture as large as it is drawn to cover a frame of this size, no
 * larger than the file: a texture that is not larger than it needs to be,
 * also for twenty photos of a phone.
 *
 * @param photo The photo.
 * @param width Width of the frame, px.
 * @param height Height of the frame, px.
 * @return The picture.
 */
export function pictureFor( photo: Photo, width: number, height: number ) {
	const scale = Math.min( 1, Math.max( width / photo.width, height / photo.height ) );
	return decode( photo.source, {
		resizeWidth: Math.max( 1, Math.round( photo.width * scale ) ),
		resizeHeight: Math.max( 1, Math.round( photo.height * scale ) ),
	} );
}

/** Lets go of what a photo holds. */
export const drop = ( photo: Photo ) => photo.thumb && URL.revokeObjectURL( photo.thumb );
