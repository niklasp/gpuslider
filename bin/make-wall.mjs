/**
 * Generates the pictures of the wall of the site into `media/wall/`:
 * nothing is downloaded. What is written on them is in
 * `site/src/lib/wall.json`.
 *
 * Each picture is drawn by a shader in Chrome: ribbons of silk that twist
 * through a dark room, lit from the top left, glossy, so that the glass of
 * the wall has something to bend. The title is in the picture because the
 * glass bends what it shows, and what is written on the page would not
 * bend with it.
 *
 * `node bin/make-wall.mjs`, then `node bin/make-variants.mjs`.
 */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve( fileURLToPath( import.meta.url ), '../..' );
const site = resolve( root, 'site' );
const out = resolve( root, 'media/wall' );
mkdirSync( out, { recursive: true } );

const W = 840;
const H = 560;

const TITLES = JSON.parse(
	readFileSync( resolve( site, 'src/lib/wall.json' ), 'utf8' )
).map( ( { title, line } ) => [ title, line ] );

// The face of the site, in the picture. What is written keeps away from
// the edges, where the bevel of the glass bends it beyond reading.
const FONT = readFileSync(
	resolve(
		site,
		'node_modules/@fontsource-variable/funnel-display/files/funnel-display-latin-wght-normal.woff2'
	)
).toString( 'base64' );

// The room, the light in it, the two colours of the silk and its sheen.
const PALETTES = [
	'04090d,0b3440,ff5a1f,0e7c86,ffb46b',
	'07040f,24104a,7a2cff,ff4fa0,4fd6ff',
	'020c10,06343b,0bbfae,f0603a,a0fff0',
	'0d0503,3a1205,ff7a18,b3122e,ffd27a',
	'03060d,0f1f52,2f6bff,9b3cff,7ee8ff',
	'0a0309,330a2e,ff3d7f,ff9a3c,ffd1f0',
	'02080a,0a2a2a,14a38b,203aa8,8affd8',
	'08030a,2a0b2f,c21f6a,ff8c42,f7b2ff',
].map( ( one ) =>
	one.split( ',' ).map( ( hex ) => [ 0, 2, 4 ].map( ( i ) => parseInt( hex.slice( i, i + 2 ), 16 ) / 255 ) )
);

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform float seed; uniform vec3 bg, deep, a, b, accent; uniform vec2 res;
float h1( float n ){ return fract( sin( n * 127.1 + seed * 311.7 ) * 43758.5453 ); }
float noise( vec2 p ){ return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
void main(){
	float asp = res.x / res.y;
	vec2 q = vec2( uv.x * asp, uv.y );
	// Background: deep, lit from one corner.
	vec3 col = mix( bg, deep, smoothstep( 1.4, 0.0, length( q - vec2( asp * ( 0.2 + 0.6 * h1( 1.0 ) ), 0.9 ) ) ) );
	col *= 0.9;
	vec3 L = normalize( vec3( -0.5, 0.7, 0.8 ) );
	vec3 V = vec3( 0, 0, 1 );
	float tilt = ( h1( 2.0 ) - 0.5 ) * 1.6;
	for ( int k = 0; k < 4; k++ ) {
		float fk = float( k );
		float s1 = h1( 10.0 + fk ), s2 = h1( 20.0 + fk ), s3 = h1( 30.0 + fk ), s4 = h1( 40.0 + fk );
		// Along the ribbon: x turned by the tilt.
		vec2 r = mat2( cos( tilt ), -sin( tilt ), sin( tilt ), cos( tilt ) ) * ( q - vec2( asp * 0.5, 0.5 ) );
		float x = r.x;
		float yc = ( fk - 1.5 ) * 0.22 + ( s1 - 0.5 ) * 0.3
			+ 0.22 * sin( x * ( 2.0 + 2.5 * s2 ) + s3 * 6.28 )
			+ 0.08 * sin( x * ( 5.0 + 4.0 * s4 ) + s1 * 6.28 );
		float dyc = 0.22 * ( 2.0 + 2.5 * s2 ) * cos( x * ( 2.0 + 2.5 * s2 ) + s3 * 6.28 )
			+ 0.08 * ( 5.0 + 4.0 * s4 ) * cos( x * ( 5.0 + 4.0 * s4 ) + s1 * 6.28 );
		float th = x * ( 0.8 + 1.6 * s3 ) + s4 * 6.28;
		float w = ( 0.11 + 0.13 * s2 ) * ( 0.7 + 0.3 * sin( x * 3.0 + s1 * 9.0 ) );
		float ww = w * ( 0.45 + 0.55 * abs( cos( th ) ) );
		float d = ( r.y - yc ) / sqrt( 1.0 + dyc * dyc );
		float s = d / ww;
		// The shadow it casts on what is behind.
		col *= 1.0 - 0.55 * smoothstep( 2.2, 0.6, abs( ( r.y + 0.035 - yc ) / ww ) );
		if ( abs( s ) > 1.0 ) continue;
		// The surface: a twisted band of silk, soft folds across it.
		float folds = 2.0 + floor( 3.0 * s1 );
		float fold = sin( s * 3.14159 * folds + x * ( 3.0 + 6.0 * s2 ) + s3 * 6.0 );
		vec3 N = normalize( vec3(
			-dyc * 0.35 + fold * 0.25,
			sin( 2.0 * th ) * 0.45 + s * 0.8 + fold * 0.55,
			abs( cos( th ) ) * 0.8 + 0.45 ) );
		float diff = max( dot( N, L ), 0.0 );
		float spec = pow( max( dot( reflect( -L, N ), V ), 0.0 ), 60.0 );
		float soft = pow( max( dot( reflect( -L, N ), V ), 0.0 ), 8.0 );
		float sheen = pow( 1.0 - abs( N.z ), 2.5 );
		float m = smoothstep( -1.0, 1.0, sin( x * 1.8 + fk * 2.1 + s4 * 6.0 ) );
		vec3 base = mix( a, b, m );
		vec3 rib = base * ( 0.06 + 1.25 * diff * diff )
			+ mix( base, vec3( 1.0 ), 0.5 ) * soft * 0.35
			+ vec3( 1.0, 0.97, 0.92 ) * spec * 1.1
			+ accent * sheen * 0.6;
		float edge = smoothstep( 1.0, 0.94, abs( s ) );
		col = mix( col, rib, edge );
	}
	// Grain and vignette.
	col *= 1.0 - 0.35 * pow( length( uv - 0.5 ) * 1.3, 2.0 );
	col += ( noise( gl_FragCoord.xy + seed ) - 0.5 ) * 0.035;
	o = vec4( pow( col, vec3( 0.9 ) ), 1.0 );
}`;

const page = ( i ) => {
	const [ title, line ] = TITLES[ i ];
	return `<!doctype html>
<style>
	@font-face { font-family: Display; src: url(data:font/woff2;base64,${ FONT }); font-weight: 100 900; }
	html, body { margin: 0; }
	body { width: ${ W }px; height: ${ H }px; overflow: hidden; position: relative; background: #000; color: #fff; }
	canvas { position: absolute; inset: 0; }
	.shade { position: absolute; inset: 0; background: linear-gradient( 10deg, #000b 0, #0000 48% ); }
	h1 { position: absolute; left: 118px; bottom: 140px; margin: 0; font: 600 68px/0.95 Display; letter-spacing: -0.04em; text-shadow: 0 4px 40px #0008; }
	p { position: absolute; left: 121px; bottom: 104px; margin: 0; font: 400 21px/1.2 Display; letter-spacing: 0.005em; opacity: 0.8; }
</style>
<canvas width="${ W }" height="${ H }"></canvas>
<div class="shade"></div>
<h1>${ title }</h1>
<p>${ line }</p>`;
};

// Draws the silk of picture `i` on the canvas of the page.
function draw( { fragment, seed, colors } ) {
	const canvas = document.querySelector( 'canvas' );
	const gl = canvas.getContext( 'webgl2', { preserveDrawingBuffer: true, antialias: true } );
	const shader = ( type, source ) => {
		const one = gl.createShader( type );
		gl.shaderSource( one, source );
		gl.compileShader( one );
		if ( ! gl.getShaderParameter( one, gl.COMPILE_STATUS ) ) {
			throw new Error( gl.getShaderInfoLog( one ) );
		}
		return one;
	};
	const program = gl.createProgram();
	gl.attachShader( program, shader( gl.VERTEX_SHADER, `#version 300 es
		in vec2 p; out vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4( p, 0, 1 ); }` ) );
	gl.attachShader( program, shader( gl.FRAGMENT_SHADER, fragment ) );
	gl.linkProgram( program );
	gl.useProgram( program );
	gl.bindBuffer( gl.ARRAY_BUFFER, gl.createBuffer() );
	gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ -1, -1, 3, -1, -1, 3 ] ), gl.STATIC_DRAW );
	gl.enableVertexAttribArray( 0 );
	gl.vertexAttribPointer( 0, 2, gl.FLOAT, false, 0, 0 );
	const at = ( name ) => gl.getUniformLocation( program, name );
	gl.uniform1f( at( 'seed' ), seed );
	gl.uniform2f( at( 'res' ), canvas.width, canvas.height );
	[ 'bg', 'deep', 'a', 'b', 'accent' ].forEach( ( name, i ) => gl.uniform3fv( at( name ), colors[ i ] ) );
	gl.drawArrays( gl.TRIANGLES, 0, 3 );
}

const browser = await chromium.launch( { channel: 'chrome', args: [ '--use-angle=metal', '--enable-gpu' ] } );
const tab = await browser.newPage( { viewport: { width: W, height: H } } );
for ( let i = 0; i < TITLES.length; i++ ) {
	await tab.setContent( page( i ) );
	await tab.evaluate( draw, {
		fragment: FRAGMENT,
		seed: i + 1,
		colors: PALETTES[ ( i * 3 ) % PALETTES.length ],
	} );
	await tab.evaluate( () => document.fonts.ready );
	await tab.screenshot( {
		path: resolve( out, `${ String( i + 1 ).padStart( 2, '0' ) }.jpg` ),
		type: 'jpeg',
		quality: 85,
	} );
}
await browser.close();
