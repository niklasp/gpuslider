/**
 * Builds one shader from the effects that were chosen.
 *
 * An effect is an object of GLSL function bodies, each optional:
 *
 *     vertex      vec3 ( vec3 p, vec2 uv )       moves the mesh. `p` is in
 *                                                px from the centre of the
 *                                                quad, z towards the viewer
 *     uv          vec2 ( vec2 uv )               moves the lookup
 *     color       vec4 ( vec4 color, vec2 uv )   changes the result; may
 *                                                call `media( uv )`
 * and, for a stack,
 *
 *     transition  GLSL with a function `vec4 transition( vec2 uv )` that
 *                 mixes `getFromColor( uv )` and `getToColor( uv )` by
 *                 `progress`, 0 to 1. `resolution` and `time` are there
 *                 too: what is written for gl-transitions runs as it is
 *
 * and
 *
 *     params      numbers, or arrays of 1 to 4, that the bodies use by
 *                 their name. An array can be written into while the
 *                 effect runs: the next frame is drawn with what it has
 *     head        GLSL the bodies need: helper functions
 *     animated    true when it moves without the slider moving; 'pointer'
 *                 when it does so while the pointer is over the slider
 *     place       what `vertex` does, in JS: `( p, about, uv )` with `p`
 *                 as `[ x, y, z ]`, which it changes or gives back
 *                 another, and `about` with `progress`, `velocity`,
 *                 `size`, `view` and `quad` as the uniforms of their
 *                 names. For effects that lay the slides out: a click
 *                 finds the slide that is seen (see `hit.js`)
 *
 * `uv` runs over the quad from the top left, 0 to 1. The quad is the media
 * of a slide, or the whole view in a stack.
 *
 * What every body can read:
 *
 *     uProgress   where the slide is, in slides from its resting place
 *     uVelocity   how fast the slider moves to the right on the screen, in
 *                 views per second, smoothed
 *     uPointer    the pointer in the quad's uv, smoothed
 *     uPointerSpeed  how fast it moves, in sizes of the quad per second,
 *                 smoothed
 *     uPointerIn  1 while the pointer is over the slider, eased
 *     uTime       seconds
 *     uSize       size of the quad, px
 *     uView       size of the view, px
 *     uQuad       the quad in the view, px: left, top, width, height
 *     uRadius     how round the corners of the quad are, px; not in
 *                 `vertex`
 *
 * Effects are chained in the order given.
 *
 * Effects are written for slides that follow each other to the side. In a
 * slider that goes down they get everything turned by a quarter: `uv`, `p`
 * and the uniforms have the way of the slides as their x. So `stretch`
 * bows along the way, whatever the way is.
 */

/**
 * @typedef {Object} Effect
 * @property {Record<string, number | number[]>} [params]     Numbers, or
 *           arrays of 1 to 4, that the bodies use by their name. What is
 *           written into an array is drawn in the next frame.
 * @property {string}                            [vertex]     Moves the mesh.
 * @property {string}                            [uv]         Moves the lookup.
 * @property {string}                            [color]      Changes the
 *           result.
 * @property {string}                            [transition] For a stack:
 *           mixes two slides.
 * @property {string | string[]}                 [head]       GLSL the bodies
 *           need: helper functions.
 * @property {( p: number[], about: { progress: number, velocity: number, size: number[], view: number[], quad: number[] }, uv: number[] ) => number[] | void} [place]
 *           What `vertex` does, in JS: where a point of the mesh is drawn.
 * @property {boolean | 'pointer'}               [animated]   Moves without
 *           the slider moving: always, or while the pointer is over the
 *           slider.
 */

const COMMON = `
const float PI = 3.14159265;
uniform float uProgress;
uniform float uVelocity;
uniform vec2 uPointer;
uniform vec2 uPointerSpeed;
uniform float uPointerIn;
uniform float uTime;
uniform vec2 uSize;
uniform vec2 uView;
uniform vec4 uQuad;
`;

const VERTEX = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
uniform float uDepth;
`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uA;
uniform sampler2D uB;
uniform vec4 uBoxA;
uniform vec4 uBoxB;
uniform vec4 uRectA;
uniform vec4 uRectB;
uniform vec2 uCut;
uniform float uMix;
uniform float uRadius;
vec2 lods;
`;

// A lookup outside of the image takes its edge, unless the image does not
// fill its element: then there is nothing. Where the element is not, there
// is nothing either.
//
// How large the image is drawn says which of its sizes is looked up, not
// how far apart the lookups of neighbouring pixels are: where an effect
// cuts the image into rows or blocks, they are far apart at every cut, and
// the smallest size of the image would show there. `sizeOf()` says which
// size of an image it takes to have a pixel of it for a pixel drawn.
const PICK = `
vec4 pick( sampler2D image, vec4 box, vec4 rect, float cut, float which, vec2 uv ) {
	vec2 at = uv * box.xy + box.zw;
	vec2 inside = clamp( at, 0.0, 1.0 );
	vec2 edge = step( rect.xy, vUv ) * step( vUv, rect.zw );
	float there = edge.x * edge.y * ( 1.0 - cut * step( 0.0001, distance( at, inside ) ) );
	return textureLod( image, inside, which ) * there;
}
float sizeOf( sampler2D image, vec4 box ) {
	vec2 pixels = box.xy * vec2( textureSize( image, 0 ) );
	return log2( max( length( dFdx( vUv ) * pixels ), length( dFdy( vUv ) * pixels ) ) );
}
vec4 getFromColor( vec2 uv ) { return pick( uA, uBoxA, uRectA, uCut.x, lods.x, uv ); }
vec4 getToColor( vec2 uv ) { return pick( uB, uBoxB, uRectB, uCut.y, lods.y, uv ); }
`;

// The names that transitions use, for them only.
const NAMES = [ 'progress uMix', 'resolution uSize', 'time uTime' ];
const named = ( source ) =>
	NAMES.map( ( name ) => `#define ${ name }\n` ).join( '' ) +
	source +
	NAMES.map( ( name ) => `\n#undef ${ name.split( ' ' )[ 0 ] }` ).join( '' ) +
	'\nvec4 base( vec2 uv ) { return transition( uv ); }\n';

// Rounded corners, and edges that are soft by a pixel.
const MAIN = `
void main() {
	lods = vec2( sizeOf( uA, uBoxA ), sizeOf( uB, uBoxB ) );
	vec2 uv = vUvTURNED;
	vec4 color = media( uv );
	CALLS
	vec2 half_ = uSize * 0.5;
	vec2 d = abs( uv * uSize - half_ ) - half_ + uRadius;
	float away = length( max( d, 0.0 ) ) + min( max( d.x, d.y ), 0.0 ) - uRadius;
	outColor = color * clamp( 0.5 - away, 0.0, 1.0 );
}`;

const TYPES = [ , 'float', 'vec2', 'vec3', 'vec4' ];

/**
 * @param {Effect[]}    effects    Effects.
 * @param {string|null} transition The transition of a stack when no effect
 *                                 has one; null for a row.
 * @param {boolean}     [y]        The slides follow each other downwards.
 * @return {Object} `vertex` and `fragment` (sources), `params` (uniform name
 *                  to value), `mesh` (whether the quad needs to bend),
 *                  `pointer`, `animated`, `hover` (animated while the
 *                  pointer is over the slider) and `placed` (whether a
 *                  slide at rest looks different from what the page draws).
 */
export function compose( effects, transition, y ) {
	const turned = y ? '.yx' : '';
	const heads = new Set();
	const params = {};
	const hooks = { vertex: '', uv: '', color: '' };
	const calls = { vertex: '', uv: '', color: '' };
	const signature = {
		vertex: [ 'vec3', 'vec3 p, vec2 uv', 'p = ', '( p, a );' ],
		uv: [ 'vec2', 'vec2 uv', 'uv = ', '( uv );' ],
		color: [ 'vec4', 'vec4 color, vec2 uv', 'color = ', '( color, uv );' ],
	};
	let uniforms = '';
	let base =
		transition === null
			? 'vec4 base( vec2 uv ) { return getFromColor( uv ); }\n'
			: named( transition );
	effects.forEach( ( effect, k ) => {
		[ effect.head ].flat().forEach( ( head ) => head && heads.add( head ) );
		// The bodies use their parameters by name; each effect has its own.
		let define = '';
		let undefine = '';
		for ( const [ name, value ] of Object.entries( effect.params || {} ) ) {
			// An array stays the one it is: who made it may write into it.
			const all = value.map ? value : [ value ];
			uniforms += `uniform ${ TYPES[ all.length ] } e${ k }_${ name };\n`;
			define += `#define ${ name } e${ k }_${ name }\n`;
			undefine += `#undef ${ name }\n`;
			params[ `e${ k }_${ name }` ] = all;
		}
		if ( effect.transition && transition !== null ) {
			base = named( define + effect.transition + '\n' + undefine );
		}
		for ( const hook in hooks ) {
			if ( effect[ hook ] ) {
				const [ type, args, before, after ] = signature[ hook ];
				hooks[ hook ] +=
					`${ define }${ type } ${ hook }${ k }( ${ args } ) {` +
					`${ effect[ hook ] }\n}\n${ undefine }`;
				calls[ hook ] += `${ before }${ hook }${ k }${ after }\n`;
			}
		}
	} );
	const head = COMMON + uniforms + [ ...heads ].join( '\n' ) + '\n';

	const vertex =
		VERTEX +
		head +
		hooks.vertex +
		`void main() {
	vUv = aPos;
	vec2 a = aPos${ turned };
	vec3 p = vec3( ( a - 0.5 ) * uQuad.zw, 0.0 );
	${ calls.vertex }
	vec2 at = ( ( uQuad.xy + uQuad.zw * 0.5 + p.xy ) / uView * 2.0 - 1.0 )${ turned };
	gl_Position = vec4( at.x, -at.y, -p.z / uDepth * 0.5, 1.0 - p.z / uDepth );
}`;

	const fragment =
		FRAGMENT +
		head +
		PICK +
		base +
		hooks.uv +
		`vec4 media( vec2 uv ) {\n${ calls.uv }return base( uv${ turned } );\n}\n` +
		hooks.color +
		MAIN.replace( 'CALLS', calls.color ).replace( 'TURNED', turned );

	const written =
		[ ...heads ].join( '' ) + base + hooks.uv + hooks.color + hooks.vertex;
	return {
		vertex,
		fragment,
		params,
		mesh: !! hooks.vertex,
		// Whether something the effects wrote reads the pointer.
		pointer: /uPointer/.test( written ),
		animated: effects.some( ( effect ) => effect.animated === true ),
		hover: effects.some( ( effect ) => effect.animated === 'pointer' ),
		placed: /uProgress|uView|uQuad/.test( written ),
	};
}

/**
 * Hands a program to the compiler. Nothing here waits for it: where the
 * browser compiles on another thread, the page goes on meanwhile.
 *
 * @param {WebGL2RenderingContext} gl       Context.
 * @param {string}                 vertex   Source.
 * @param {string}                 fragment Source.
 * @return {WebGLProgram} Program, not yet ready (see `ready()`).
 */
export function build( gl, vertex, fragment ) {
	const program = gl.createProgram();
	[ vertex, fragment ].forEach( ( source, i ) => {
		const shader = gl.createShader(
			i ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER
		);
		gl.shaderSource( shader, source );
		gl.compileShader( shader );
		gl.attachShader( program, shader );
	} );
	gl.bindAttribLocation( program, 0, 'aPos' );
	gl.linkProgram( program );
	return program;
}

/**
 * @param {WebGL2RenderingContext} gl      Context.
 * @param {WebGLProgram}           program Program.
 * @return {boolean} Whether the compiler is done with it.
 * @throws {Error} With the log of the compiler, when it failed.
 */
export function ready( gl, program ) {
	const parallel = gl.getExtension( 'KHR_parallel_shader_compile' );
	if (
		parallel &&
		! gl.getProgramParameter( program, parallel.COMPLETION_STATUS_KHR )
	) {
		return false;
	}
	if ( ! gl.getProgramParameter( program, gl.LINK_STATUS ) ) {
		throw new Error(
			gl
				.getAttachedShaders( program )
				.map( ( shader ) => gl.getShaderInfoLog( shader ) )
				.join( '' ) || gl.getProgramInfoLog( program )
		);
	}
	return true;
}
