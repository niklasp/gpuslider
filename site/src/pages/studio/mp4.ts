/**
 * An MP4 file of H.264 frames that the browser has encoded (WebCodecs,
 * `avc: { format: 'avc' }`): one track, not fragmented, `moov` before
 * `mdat`. No codec of its own and nothing it depends on.
 *
 * Taken from the muxer of logoanimator (`packages/core/src/render/mp4.ts`),
 * which writes the films of its exports the same way. The same frames give
 * the same bytes: nothing in it is of the clock.
 *
 * The frames are in the order they are shown: the encoder is asked for
 * none that point forward (B-frames), so no `ctts` is needed.
 */

export interface Sample {
	/** NAL units, each after its length in four bytes. */
	data: Uint8Array;
	/** Decodable without the frames before it. */
	key: boolean;
	/** In units of the timescale. */
	duration: number;
}

const u16 = ( n: number ) => new Uint8Array( [ ( n >>> 8 ) & 0xff, n & 0xff ] );
const u32 = ( n: number ) =>
	new Uint8Array( [ ( n >>> 24 ) & 0xff, ( n >>> 16 ) & 0xff, ( n >>> 8 ) & 0xff, n & 0xff ] );
const ascii = ( text: string ) => new Uint8Array( [ ...text ].map( ( c ) => c.charCodeAt( 0 ) ) );

function concat( parts: Uint8Array[] ) {
	const out = new Uint8Array( parts.reduce( ( sum, part ) => sum + part.length, 0 ) );
	let at = 0;
	for ( const part of parts ) {
		out.set( part, at );
		at += part.length;
	}
	return out;
}

const box = ( type: string, ...body: Uint8Array[] ) => {
	const inner = concat( body );
	return concat( [ u32( inner.length + 8 ), ascii( type ), inner ] );
};

// The identity, as nine numbers 16.16 and 2.30.
const MATRIX = concat( [ 0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000 ].map( u32 ) );
const zeros = ( n: number ) => new Uint8Array( n );

function moov( samples: Sample[], width: number, height: number, config: Uint8Array, scale: number, offset: number ) {
	const duration = samples.reduce( ( sum, { duration: d } ) => sum + d, 0 );
	const mvhd = box( 'mvhd', u32( 0 ), u32( 0 ), u32( 0 ), u32( scale ), u32( duration ), u32( 0x10000 ), u16( 0x100 ), zeros( 10 ), MATRIX, zeros( 24 ), u32( 2 ) );
	const tkhd = box( 'tkhd', u32( 7 ), u32( 0 ), u32( 0 ), u32( 1 ), u32( 0 ), u32( duration ), zeros( 16 ), MATRIX, u32( width << 16 ), u32( height << 16 ) );
	// Language: `und`.
	const mdhd = box( 'mdhd', u32( 0 ), u32( 0 ), u32( 0 ), u32( scale ), u32( duration ), u16( 0x55c4 ), u16( 0 ) );
	const hdlr = box( 'hdlr', u32( 0 ), u32( 0 ), ascii( 'vide' ), zeros( 12 ), ascii( 'VideoHandler' ), zeros( 1 ) );
	const vmhd = box( 'vmhd', u32( 1 ), zeros( 8 ) );
	const dinf = box( 'dinf', box( 'dref', u32( 0 ), u32( 1 ), box( 'url ', u32( 1 ) ) ) );
	const avc1 = box(
		'avc1',
		zeros( 6 ), u16( 1 ), zeros( 16 ),
		u16( width ), u16( height ),
		u32( 0x480000 ), u32( 0x480000 ), u32( 0 ), u16( 1 ),
		zeros( 32 ), u16( 0x18 ), u16( 0xffff ),
		box( 'avcC', config )
	);
	// The durations, as runs of the same.
	const runs: [ number, number ][] = [];
	for ( const { duration: d } of samples ) {
		const last = runs[ runs.length - 1 ];
		if ( last && last[ 1 ] === d ) {
			last[ 0 ]++;
		} else {
			runs.push( [ 1, d ] );
		}
	}
	const keys = samples.flatMap( ( { key }, i ) => ( key ? [ i + 1 ] : [] ) );
	const stbl = box(
		'stbl',
		box( 'stsd', u32( 0 ), u32( 1 ), avc1 ),
		box( 'stts', u32( 0 ), u32( runs.length ), ...runs.flatMap( ( [ n, d ] ) => [ u32( n ), u32( d ) ] ) ),
		...( keys.length < samples.length ? [ box( 'stss', u32( 0 ), u32( keys.length ), ...keys.map( u32 ) ) ] : [] ),
		// One chunk with all the samples, as `mdat` has them.
		box( 'stsc', u32( 0 ), u32( 1 ), u32( 1 ), u32( samples.length ), u32( 1 ) ),
		box( 'stsz', u32( 0 ), u32( 0 ), u32( samples.length ), ...samples.map( ( { data } ) => u32( data.length ) ) ),
		box( 'stco', u32( 0 ), u32( 1 ), u32( offset ) )
	);
	const mdia = box( 'mdia', mdhd, hdlr, box( 'minf', vmhd, dinf, stbl ) );
	return box( 'moov', mvhd, box( 'trak', tkhd, mdia ) );
}

/**
 * @param samples The frames, encoded.
 * @param options Options.
 * @param options.width Width, px.
 * @param options.height Height, px.
 * @param options.config The AVCDecoderConfigurationRecord the encoder
 *                       gives with its first frame.
 * @param options.scale Units of a second.
 * @return The file.
 */
export function mux(
	samples: Sample[],
	{ width, height, config, scale = 90000 }: { width: number; height: number; config: Uint8Array; scale?: number }
): Uint8Array< ArrayBuffer > {
	if ( ! samples.length ) {
		throw new Error( 'No frames.' );
	}
	const ftyp = box( 'ftyp', ascii( 'isom' ), u32( 0x200 ), ascii( 'isomiso2avc1mp41' ) );
	// How long `moov` is does not depend on where `mdat` begins.
	const probe = moov( samples, width, height, config, scale, 0 );
	const offset = ftyp.length + probe.length + 8;
	return concat( [
		ftyp,
		moov( samples, width, height, config, scale, offset ),
		box( 'mdat', ...samples.map( ( { data } ) => data ) ),
	] ) as Uint8Array< ArrayBuffer >;
}
