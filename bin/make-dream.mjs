/**
 * Generates the pictures of the Wave example into `media/dream/`: nothing
 * is downloaded. Chrome blobs, liquid metal, glass and holographic film in
 * a pale sky, each a fragment shader that Chromium renders once.
 *
 *     dream/01.jpg  (1600 × 1067)  →  dream/01-420.avif, dream/01-840.avif
 *
 * `node bin/make-dream.mjs`, or only some: `node bin/make-dream.mjs 3 7`
 */
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve( fileURLToPath( import.meta.url ), '../..' );
const out = resolve( root, 'media/dream' );
mkdirSync( out, { recursive: true } );

const W = 1600;
const H = 1067;

// Kind of scene, seed, and three colours: the sky above, the horizon, the
// ground. Pale, as the room of the example is.
const SKIES = [
	[ '#9ec9ff', '#ffc4e1', '#fff3ea' ],
	[ '#b9b3ff', '#ffd1dc', '#f7f4ff' ],
	[ '#8fd3ff', '#e9d7ff', '#fff0f6' ],
	[ '#c7e8ff', '#ffb8d0', '#fff6e8' ],
	[ '#a7b8ff', '#ffe0f0', '#eef6ff' ],
	[ '#ffc1e3', '#cfe6ff', '#ffffff' ],
];
const KINDS = [ 'blobs', 'liquid', 'glass', 'ring', 'pills', 'film' ];
const PICTURES = Array.from( { length: 24 }, ( _, n ) => ( {
	kind: KINDS[ n % KINDS.length ],
	seed: 1 + n * 7.31,
	sky: SKIES[ ( n * 5 + Math.floor( n / 6 ) ) % SKIES.length ],
} ) );

const SHADER = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform float uSeed;
uniform int uKind;
uniform vec3 uTop, uMid, uLow;
out vec4 color;

#define PI 3.14159265

float hash( float n ) { return fract( sin( n ) * 43758.5453 ); }
float h1( float k ) { return hash( uSeed * 13.7 + k * 7.13 ); }
float noise( vec3 x ) {
	vec3 p = floor( x ), f = fract( x );
	f = f * f * ( 3.0 - 2.0 * f );
	float n = p.x + p.y * 57.0 + 113.0 * p.z;
	return mix( mix( mix( hash( n ), hash( n + 1.0 ), f.x ), mix( hash( n + 57.0 ), hash( n + 58.0 ), f.x ), f.y ),
		mix( mix( hash( n + 113.0 ), hash( n + 114.0 ), f.x ), mix( hash( n + 170.0 ), hash( n + 171.0 ), f.x ), f.y ), f.z );
}
float fbm( vec3 p ) {
	float s = 0.0, a = 0.5;
	for ( int i = 0; i < 4; i++ ) { s += a * noise( p ); p *= 2.03; a *= 0.5; }
	return s;
}
vec3 film( float t ) {
	// Thin-film colours: what a soap bubble or oil shows.
	return 0.5 + 0.5 * cos( 6.2831 * ( t + vec3( 0.0, 0.33, 0.67 ) ) );
}

// The sky that everything mirrors: pale, with strips of studio light and
// a sun, so that chrome has something to show.
vec3 sky( vec3 d ) {
	float y = d.y;
	vec3 c = mix( uMid, uTop, smoothstep( 0.0, 0.7, y ) );
	// Below the horizon a dark floor: chrome is its dark parts as much as
	// its light ones.
	vec3 floor_ = mix( vec3( 0.16, 0.13, 0.26 ), uMid * 0.55, 0.45 + 0.3 * sin( d.x * 2.5 + uSeed ) );
	floor_ = mix( floor_, uLow * 0.8, smoothstep( -0.75, -1.0, y ) );
	c = mix( c, floor_, smoothstep( 0.03, -0.35, y ) );
	// A bright horizon.
	c += smoothstep( 0.05, 0.0, abs( y ) ) * 0.7 * uMid;
	// Strips of studio light.
	float strip = smoothstep( 0.05, 0.0, abs( y - 0.38 - 0.08 * sin( d.x * 2.0 + uSeed ) ) );
	strip += smoothstep( 0.035, 0.0, abs( d.x - 0.6 * sin( uSeed ) ) ) * smoothstep( 0.0, 0.3, y );
	strip += smoothstep( 0.03, 0.0, abs( d.x + 0.45 * cos( uSeed * 1.3 ) ) ) * smoothstep( 0.1, 0.5, y ) * 0.7;
	c += strip * 1.1;
	// A sun.
	vec3 sun = normalize( vec3( sin( uSeed * 1.7 ), 0.55, cos( uSeed * 1.7 ) ) );
	float s = max( dot( d, sun ), 0.0 );
	c += pow( s, 80.0 ) * 2.0 + pow( s, 8.0 ) * 0.3;
	return c;
}

// The background of the picture: the sky as seen, softened, with a sheen
// and soft bands that glass bends.
vec3 back( vec2 uv, vec3 d ) {
	vec3 c = mix( uLow, uMid, smoothstep( -0.6, 0.4, uv.y ) );
	c = mix( c, uTop, smoothstep( 0.2, 1.0, uv.y + 0.3 * uv.x * sin( uSeed ) ) );
	c += film( uv.x * 0.4 + uv.y * 0.3 + uSeed ) * 0.07;
	float band = sin( ( uv.x * cos( uSeed ) + uv.y * sin( uSeed ) ) * 14.0 + fbm( vec3( uv * 1.5, uSeed ) ) * 4.0 );
	c += smoothstep( 0.55, 1.0, band ) * 0.05;
	return c;
}

float smin( float a, float b, float k ) {
	float h = clamp( 0.5 + 0.5 * ( b - a ) / k, 0.0, 1.0 );
	return mix( b, a, h ) - k * h * ( 1.0 - h );
}
mat2 rot( float a ) { float c = cos( a ), s = sin( a ); return mat2( c, -s, s, c ); }

float sdTorus( vec3 p, vec2 t ) { vec2 q = vec2( length( p.xz ) - t.x, p.y ); return length( q ) - t.y; }
float sdCapsule( vec3 p, vec3 a, vec3 b, float r ) {
	vec3 pa = p - a, ba = b - a;
	float h = clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 );
	return length( pa - ba * h ) - r;
}

float map( vec3 p ) {
	if ( uKind == 0 ) {
		// Blobs of chrome, melting into each other.
		float d = 1e9;
		for ( int i = 0; i < 6; i++ ) {
			float k = float( i );
			vec3 c = vec3( ( h1( k ) - 0.5 ) * 3.2, ( h1( k + 9.0 ) - 0.5 ) * 1.6, ( h1( k + 19.0 ) - 0.5 ) * 1.5 );
			float r = 0.35 + 0.5 * h1( k + 29.0 );
			d = smin( d, length( p - c ) - r, 0.55 );
		}
		return d + 0.04 * sin( 6.0 * p.x + uSeed ) * sin( 5.0 * p.y );
	}
	if ( uKind == 1 ) {
		// A sea of liquid metal.
		float h = 0.35 * sin( p.x * 1.3 + uSeed ) * sin( p.z * 1.1 - uSeed * 0.7 )
			+ 0.25 * fbm( vec3( p.xz * 0.9, uSeed ) ) + 0.12 * sin( length( p.xz - vec2( 0.5, 2.0 ) ) * 5.0 );
		return ( p.y + 0.9 - h ) * 0.6;
	}
	if ( uKind == 3 ) {
		// A ring that twists.
		vec3 q = p;
		q.yz *= rot( 0.9 + h1( 1.0 ) * 0.8 );
		q.xy *= rot( h1( 2.0 ) * 1.4 - 0.7 );
		float a = atan( q.z, q.x );
		float wob = 0.12 * sin( a * ( 3.0 + floor( h1( 3.0 ) * 3.0 ) ) + uSeed );
		return sdTorus( q, vec2( 1.25, 0.32 + wob ) ) * 0.8;
	}
	if ( uKind == 4 ) {
		// Pills of chrome, scattered.
		float d = 1e9;
		for ( int i = 0; i < 5; i++ ) {
			float k = float( i );
			vec3 c = vec3( ( h1( k ) - 0.5 ) * 3.6, ( h1( k + 4.0 ) - 0.5 ) * 1.8, ( h1( k + 8.0 ) - 0.5 ) * 1.2 );
			vec3 dir = normalize( vec3( h1( k + 12.0 ) - 0.5, h1( k + 15.0 ) - 0.5, h1( k + 18.0 ) - 0.5 ) );
			d = min( d, sdCapsule( p, c - dir * 0.45, c + dir * 0.45, 0.22 + 0.12 * h1( k + 21.0 ) ) );
		}
		return d;
	}
	return 1e9;
}

vec3 normal( vec3 p ) {
	vec2 e = vec2( 0.0015, 0.0 );
	return normalize( vec3( map( p + e.xyy ) - map( p - e.xyy ), map( p + e.yxy ) - map( p - e.yxy ), map( p + e.yyx ) - map( p - e.yyx ) ) );
}

// Glass spheres, by their sums: where the ray goes in, and out.
vec2 sphere( vec3 ro, vec3 rd, vec4 s ) {
	vec3 oc = ro - s.xyz;
	float b = dot( oc, rd ), c = dot( oc, oc ) - s.w * s.w, h = b * b - c;
	if ( h < 0.0 ) return vec2( -1.0 );
	h = sqrt( h );
	return vec2( -b - h, -b + h );
}

vec3 chrome( vec3 p, vec3 rd, vec3 n, float tint ) {
	vec3 r = reflect( rd, n );
	float fres = pow( 1.0 - max( dot( -rd, n ), 0.0 ), 3.0 );
	vec3 c = sky( r );
	// A film of colour over the chrome, more at grazing angles.
	vec3 oil = film( dot( n, -rd ) * 1.3 + uSeed * 0.37 + p.y * 0.2 );
	c = mix( c, c * ( 0.55 + oil * 0.9 ), tint * ( 0.3 + 0.7 * fres ) );
	return c + fres * 0.25;
}

vec3 render( vec2 frag ) {
	vec2 uv = ( frag - 0.5 * uSize ) / uSize.y;
	vec3 ro = vec3( 0.0, 0.0, 4.2 );
	float aim = 0.0;
	if ( uKind == 1 ) { ro = vec3( 0.0, 0.6, 4.0 ); aim = -0.28; }
	vec3 rd = normalize( vec3( uv * ( uKind == 1 ? 0.9 : 1.05 ), -1.5 ) );
	rd.yz *= rot( aim );
	vec3 bg = back( uv, rd );

	if ( uKind == 2 || uKind == 5 ) {
		// Glass: spheres over a holographic field. 5 is a film, without
		// spheres in front: the field alone, as foil.
		vec3 c = bg;
		vec3 holo = film( uv.x * 0.6 - uv.y * 0.4 + fbm( vec3( uv * 2.0, uSeed ) ) * 0.8 + uSeed );
		c = mix( c, c * 0.7 + holo * 0.45, uKind == 5 ? 0.55 : 0.25 );
		if ( uKind == 5 ) {
			// Folds of holographic satin: a height field lit as chrome.
			vec2 q = uv * rot( uSeed );
			float hh = 0.0;
			vec2 e = vec2( 0.002, 0.0 );
			vec3 hs;
			for ( int k = 0; k < 3; k++ ) {
				vec2 a = q + ( k == 1 ? e.xy : k == 2 ? e.yx : vec2( 0.0 ) );
				float f = noise( vec3( a * 0.9, uSeed * 0.3 ) );
				hs[ k ] = 0.16 * sin( ( a.x + f * 1.2 ) * 4.5 ) + 0.05 * sin( a.y * 5.0 + f * 3.0 );
			}
			vec3 n = normalize( vec3( -( hs.y - hs.x ) / e.x, -( hs.z - hs.x ) / e.x, 1.0 ) * vec3( 0.14, 0.14, 1.0 ) );
			vec3 v = vec3( 0.0, 0.0, -1.0 );
			vec3 r = reflect( v, n );
			vec3 lit = sky( normalize( vec3( r.x, r.y * 0.8 + 0.25, r.z ) ) );
			vec3 oil = film( dot( n, -v ) * 2.2 + hs.x * 3.0 + uSeed );
			return mix( back( uv, v ), mix( lit, lit * ( 0.6 + oil * 0.6 ), 0.6 ), 0.75 );
		}
		float best = 1e9;
		vec3 got = c;
		for ( int i = 0; i < 3; i++ ) {
			float k = float( i );
			vec4 s = vec4( ( h1( k ) - 0.5 ) * 3.0, ( h1( k + 5.0 ) - 0.5 ) * 1.3, ( h1( k + 9.0 ) - 0.5 ) * 1.5, 0.45 + 0.55 * h1( k + 13.0 ) );
			vec2 t = sphere( ro, rd, s );
			if ( t.x > 0.0 && t.x < best ) {
				best = t.x;
				vec3 p = ro + rd * t.x;
				vec3 n = normalize( p - s.xyz );
				float fres = pow( 1.0 - max( dot( -rd, n ), 0.0 ), 2.5 );
				// What is seen through it, bent, each colour a little
				// otherwise: the field behind, magnified and turned.
				vec3 through;
				for ( int ch = 0; ch < 3; ch++ ) {
					vec3 q = refract( rd, n, 1.0 / ( 1.45 + 0.03 * float( ch ) ) );
					vec2 at = uv - q.xy * 1.6 * s.w;
					vec3 f = mix( back( at, q ), film( at.x * 0.6 - at.y * 0.4 + fbm( vec3( at * 2.0, uSeed ) ) * 0.8 + uSeed ), 0.35 );
					through[ ch ] = f[ ch ];
				}
				got = through * 1.05 + sky( reflect( rd, n ) ) * fres * 0.9;
				// The bright rim, and a highlight.
				got += pow( fres, 3.0 ) * 0.5;
			}
		}
		return got;
	}

	// Marched: chrome.
	float t = 0.0;
	bool hit = false;
	for ( int i = 0; i < 160; i++ ) {
		vec3 p = ro + rd * t;
		float d = map( p );
		if ( d < 0.0008 * t ) { hit = true; break; }
		t += d;
		if ( t > 30.0 ) break;
	}
	if ( ! hit ) {
		if ( uKind == 1 ) return bg;
		// A soft shadow of the shapes on a wall behind them.
		float wall = ( -2.2 - ro.z ) / rd.z;
		vec3 w = ro + rd * wall + vec3( 0.35, -0.3, 0.0 );
		float near = map( w );
		return bg * mix( 0.72, 1.0, smoothstep( 0.0, 1.4, near ) );
	}
	vec3 p = ro + rd * t;
	vec3 n = normal( p );
	vec3 c = chrome( p, rd, n, uKind == 3 ? 0.9 : uKind == 1 ? 0.55 : 0.7 );
	if ( uKind == 1 ) {
		// The sea fades into the sky.
		c = mix( c, bg, smoothstep( 6.0, 16.0, t ) );
	}
	return c;
}

void main() {
	vec3 c = vec3( 0.0 );
	// Four samples a pixel, for edges without steps.
	for ( int i = 0; i < 4; i++ ) {
		vec2 o = vec2( float( i % 2 ), float( i / 2 ) ) * 0.5 - 0.25;
		c += render( gl_FragCoord.xy + o );
	}
	c /= 4.0;
	// Soft, and a grain as of film.
	c = c / ( 1.0 + 0.12 * c );
	c += ( hash( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) + uSeed ) - 0.5 ) * 0.025;
	color = vec4( pow( clamp( c, 0.0, 1.0 ), vec3( 0.95 ) ), 1.0 );
}
`;

const hex = ( c ) => [ 1, 3, 5 ].map( ( i ) => parseInt( c.slice( i, i + 2 ), 16 ) / 255 );

const only = process.argv.slice( 2 ).map( Number );
const browser = await chromium.launch( {
	channel: 'chrome',
	args: [ '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist' ],
} );
const page = await browser.newPage( { viewport: { width: W, height: H } } );
await page.setContent(
	`<body style="margin:0"><canvas width="${ W }" height="${ H }"></canvas></body>`
);
await page.evaluate( ( shader ) => {
	const gl = document.querySelector( 'canvas' ).getContext( 'webgl2', { preserveDrawingBuffer: true } );
	const make = ( type, text ) => {
		const s = gl.createShader( type );
		gl.shaderSource( s, text );
		gl.compileShader( s );
		if ( ! gl.getShaderParameter( s, gl.COMPILE_STATUS ) ) {
			throw new Error( gl.getShaderInfoLog( s ) );
		}
		return s;
	};
	const program = gl.createProgram();
	gl.attachShader( program, make( gl.VERTEX_SHADER, `#version 300 es
		void main() { vec2 p = vec2( gl_VertexID & 1, gl_VertexID >> 1 ) * 4.0 - 1.0; gl_Position = vec4( p, 0, 1 ); }` ) );
	gl.attachShader( program, make( gl.FRAGMENT_SHADER, shader ) );
	gl.linkProgram( program );
	gl.useProgram( program );
	window.draw = ( { kind, seed, sky } ) => {
		const at = ( name ) => gl.getUniformLocation( program, name );
		gl.uniform2f( at( 'uSize' ), gl.canvas.width, gl.canvas.height );
		gl.uniform1f( at( 'uSeed' ), seed );
		gl.uniform1i( at( 'uKind' ), kind );
		[ 'uTop', 'uMid', 'uLow' ].forEach( ( name, i ) => gl.uniform3f( at( name ), ...sky[ i ] ) );
		gl.drawArrays( gl.TRIANGLES, 0, 3 );
		gl.finish();
	};
}, SHADER );

const kb = ( file ) => `${ Math.round( statSync( file ).size / 1024 ) } KB`;
for ( const [ n, { kind, seed, sky } ] of PICTURES.entries() ) {
	if ( only.length && ! only.includes( n + 1 ) ) {
		continue;
	}
	await page.evaluate( ( given ) => window.draw( given ), {
		kind: KINDS.indexOf( kind ),
		seed,
		sky: sky.map( hex ),
	} );
	const png = await page.locator( 'canvas' ).screenshot();
	const name = resolve( out, String( n + 1 ).padStart( 2, '0' ) );
	await sharp( png ).jpeg( { quality: 86, mozjpeg: true } ).toFile( `${ name }.jpg` );
	for ( const w of [ 420, 840 ] ) {
		await sharp( png ).resize( { width: w } ).avif( { quality: 55, effort: 6 } ).toFile( `${ name }-${ w }.avif` );
	}
	// eslint-disable-next-line no-console
	console.log( `${ name }.jpg (${ kb( `${ name }.jpg` ) }), ${ kind }, 840: ${ kb( `${ name }-840.avif` ) }` );
}
await browser.close();
