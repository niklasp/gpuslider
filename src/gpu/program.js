/**
 * Builds one shader from the effects that were chosen, for WebGPU.
 *
 * The effects are the ones of the WebGL layer, as they are: what they say
 * in GLSL is said in WGSL here (see `wgsl.js`). What is around them is
 * written in WGSL. See `../gl/program.js` for what an effect is.
 */
import { wgsl, rename } from './wgsl.js';

// What every quad is told, by size: that way nothing has to be left empty
// between them.
const TOLD = [
	[ 'uQuad', 'uBoxA', 'uBoxB', 'uRectA', 'uRectB' ],
	[],
	[ 'uPointer', 'uPointerSpeed', 'uSize', 'uView', 'uCut' ],
	[
		'uProgress',
		'uVelocity',
		'uPointerIn',
		'uTime',
		'uMix',
		'uRadius',
		'uDepth',
	],
];
const KINDS = [ 'vec4f', 'vec3f', 'vec2f', 'f32' ];
// Numbers of each, and numbers it takes with what is left empty after it.
const SIZES = [ 4, 3, 2, 1 ];
const ROOM = [ 4, 4, 2, 1 ];

// The names that transitions use, for them only.
const NAMES = { progress: 'uMix', resolution: 'uSize', time: 'uTime' };

// A lookup outside of the image takes its edge, unless the image does not
// fill its element: then there is nothing. Where the element is not, there
// is nothing either. See `../gl/program.js` for the slope.
const PICK = `
fn pick( image: texture_2d<f32>, box: vec4f, rect: vec4f, cut: f32, which: f32, uv: vec2f ) -> vec4f {
	let at = uv * box.xy + box.zw;
	let inside = clamp( at, vec2f( 0.0 ), vec2f( 1.0 ) );
	let edge = step( rect.xy, vUv ) * step( vUv, rect.zw );
	let there = edge.x * edge.y * ( 1.0 - cut * step( 0.0001, distance( at, inside ) ) );
	return textureSampleLevel( image, samp, inside, which ) * there;
}
fn sizeOf( image: texture_2d<f32>, box: vec4f ) -> f32 {
	let pixels = box.xy * vec2f( textureDimensions( image ) );
	return log2( max( length( dpdx( vUv ) * pixels ), length( dpdy( vUv ) * pixels ) ) );
}
fn getFromColor( uv: vec2f ) -> vec4f { return pick( uA, u.uBoxA, u.uRectA, u.uCut.x, lods.x, uv ); }
fn getToColor( uv: vec2f ) -> vec4f { return pick( uB, u.uBoxB, u.uRectB, u.uCut.y, lods.y, uv ); }
`;

/**
 * @param {import('../gl/program.js').Effect[]} effects    Effects.
 * @param {string|null}                         transition The transition
 *        of a stack when no effect has one, in GLSL; null for a row.
 * @param {boolean}                             [y]        The slides follow
 *        each other downwards.
 * @return {Object} `code` (the shader), `at` (name of what a quad is told
 *                  to where it is among the numbers), `numbers` (how many
 *                  there are), `params` (name to value), and `mesh`,
 *                  `pointer`, `animated`, `hover`, `placed` as for WebGL.
 */
export function compose( effects, transition, y ) {
	const turned = y ? '.yx' : '';
	const heads = new Set();
	const params = {};
	const told = TOLD.map( ( names ) => [ ...names ] );
	const hooks = { vertex: '', uv: '', color: '' };
	const calls = { vertex: '', uv: '', color: '' };
	const signature = {
		vertex: [ 'vec3', 'vec3 p, vec2 uv', 'p = ', '( p, a );' ],
		uv: [ 'vec2', 'vec2 uv', 'uv = ', '( uv );' ],
		color: [ 'vec4', 'vec4 color, vec2 uv', 'color = ', '( color, uv );' ],
	};
	const named = ( source ) =>
		rename( source, NAMES ) +
		'\nvec4 base( vec2 uv ) { return transition( uv ); }\n';
	let base =
		transition === null
			? 'vec4 base( vec2 uv ) { return getFromColor( uv ); }\n'
			: named( transition );

	effects.forEach( ( effect, k ) => {
		[ effect.head ].flat().forEach( ( head ) => head && heads.add( head ) );
		// The bodies use their parameters by name; each effect has its own.
		const own = {};
		for ( const [ name, value ] of Object.entries( effect.params || {} ) ) {
			// An array stays the one it is: who made it may write into it.
			const all = value.map ? value : [ value ];
			own[ name ] = `e${ k }_${ name }`;
			told[ 4 - all.length ].push( own[ name ] );
			params[ own[ name ] ] = all;
		}
		if ( effect.transition && transition !== null ) {
			base = named( rename( effect.transition, own ) );
		}
		for ( const hook in hooks ) {
			if ( effect[ hook ] ) {
				const [ type, args, before, after ] = signature[ hook ];
				hooks[ hook ] +=
					`${ type } ${ hook }${ k }( ${ args } ) {` +
					`${ rename( effect[ hook ], own ) }\n}\n`;
				calls[ hook ] += `${ before }${ hook }${ k }${ after }\n`;
			}
		}
	} );

	// Where everything is among the numbers a quad is told.
	const at = {};
	let numbers = 0;
	let fields = '';
	told.forEach( ( names, kind ) =>
		names.forEach( ( name ) => {
			const room = ROOM[ kind ];
			numbers = Math.ceil( numbers / room ) * room;
			at[ name ] = numbers;
			numbers += SIZES[ kind ];
			fields += `${ name }: ${ KINDS[ kind ] },\n`;
		} )
	);
	numbers = Math.ceil( numbers / 4 ) * 4;

	const written =
		[ ...heads ].join( '\n' ) + '\n' + base + hooks.uv + hooks.color + hooks.vertex;
	const said = rename(
		wgsl(
			written +
				`vec4 media( vec2 uv ) {\n${ calls.uv }return base( uv${ turned } );\n}\n`
		),
		Object.fromEntries( Object.keys( at ).map( ( name ) => [ name, `u.${ name }` ] ) )
	);

	const code = `
const PI = 3.14159265;
struct Told {
${ fields }}
struct Point {
	@builtin( position ) at: vec4f,
	@location( 0 ) uv: vec2f,
}
@group( 0 ) @binding( 0 ) var<uniform> u: Told;
@group( 1 ) @binding( 0 ) var samp: sampler;
@group( 1 ) @binding( 1 ) var uA: texture_2d<f32>;
@group( 1 ) @binding( 2 ) var uB: texture_2d<f32>;
var<private> vUv: vec2f;
var<private> lods: vec2f;
${ PICK }
${ said }
@vertex fn vertex( @location( 0 ) aPos: vec2f ) -> Point {
	let a = aPos${ turned };
	var p = vec3f( ( a - 0.5 ) * u.uQuad.zw, 0.0 );
	${ calls.vertex }
	let at = ( ( u.uQuad.xy + u.uQuad.zw * 0.5 + p.xy ) / u.uView * 2.0 - 1.0 )${ turned };
	// The depth runs from 0 here, where it runs from -1 in WebGL.
	let w = 1.0 - p.z / u.uDepth;
	return Point( vec4f( at.x, -at.y, ( w - p.z / u.uDepth * 0.5 ) * 0.5, w ), aPos );
}
// Rounded corners, and edges that are soft by a pixel.
@fragment fn fragment( point: Point ) -> @location( 0 ) vec4f {
	vUv = point.uv;
	lods = vec2f( sizeOf( uA, u.uBoxA ), sizeOf( uB, u.uBoxB ) );
	var uv = vUv${ turned };
	var color = media( uv );
	${ calls.color }
	let half_ = u.uSize * 0.5;
	let d = abs( uv * u.uSize - half_ ) - half_ + u.uRadius;
	let away = length( max( d, vec2f( 0.0 ) ) ) + min( max( d.x, d.y ), 0.0 ) - u.uRadius;
	return color * clamp( 0.5 - away, 0.0, 1.0 );
}`;

	return {
		code,
		at,
		numbers,
		params,
		mesh: !! hooks.vertex,
		// Whether something the effects wrote reads the pointer.
		pointer: /uPointer/.test( written ),
		animated: effects.some( ( effect ) => effect.animated === true ),
		hover: effects.some( ( effect ) => effect.animated === 'pointer' ),
		placed: /uProgress|uView|uQuad/.test( written ),
	};
}
