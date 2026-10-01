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
 *     uShape      the exponent of the corners: 2 round, 4 a squircle;
 *                 not in `vertex`
 *
 * What the effects do is weighed by uFx, 1 but for a quad whose effects
 * fade (see `change` of the layer).
 *
 * Effects are chained in the order given.
 *
 * Effects are written for slides that follow each other to the side. In a
 * slider that goes down they get everything turned by a quarter: `uv`, `p`
 * and the uniforms have the way of the slides as their x. So `stretch`
 * bows along the way, whatever the way is.
 */

/** What `place` of an effect gets: the uniforms of these names. */
export interface About {
	progress: number;
	velocity: number;
	size: number[];
	view: number[];
	quad: number[];
}

export interface Effect {
	/**
	 * Numbers, or arrays of 1 to 4, that the bodies use by their name. What
	 * is written into an array is drawn in the next frame.
	 */
	params?: Record< string, number | number[] >;
	/** Moves the mesh. */
	vertex?: string;
	/** Moves the lookup. */
	uv?: string;
	/** Changes the result. */
	color?: string;
	/** For a stack: mixes two slides. */
	transition?: string;
	/** GLSL the bodies need: helper functions. */
	head?: string | string[];
	/** What `vertex` does, in JS: where a point of the mesh is drawn. */
	place?: ( p: number[], about: About, uv: number[] ) => number[] | void;
	/**
	 * Moves without the slider moving: always, or while the pointer is over
	 * the slider.
	 */
	animated?: boolean | 'pointer';
}

type Hook = 'vertex' | 'uv' | 'color';

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
uniform float uFx;
`;

const VERTEX = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
uniform float uDepth;
uniform vec4 uFrame;
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
uniform float uShape;
uniform float uDim;
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
const named = ( source: string ) =>
	NAMES.map( ( name ) => `#define ${ name }\n` ).join( '' ) +
	source +
	NAMES.map( ( name ) => `\n#undef ${ name.split( ' ' )[ 0 ] }` ).join( '' ) +
	'\nvec4 base( vec2 uv ) { return transition( uv ); }\n';

// Rounded corners, and edges that are soft by a pixel. A corner is a
// superellipse of the exponent uShape: round at 2, a squircle at 4.
const MAIN = `
void main() {
	lods = vec2( sizeOf( uA, uBoxA ), sizeOf( uB, uBoxB ) );
	vec2 uv = vUvTURNED;
	vec4 color = media( uv );
	vec4 was = color;
	CALLS
	color = mix( was, color, uFx );
	vec2 half_ = uSize * 0.5;
	float r = max( uRadius, 1e-3 );
	vec2 d = abs( uv * uSize - half_ ) - half_ + r;
	vec2 e = pow( max( d, 0.0 ) / r, vec2( uShape ) );
	float away = pow( e.x + e.y, 1.0 / uShape ) * r + min( max( d.x, d.y ), 0.0 ) - r;
	outColor = color * clamp( 0.5 - away, 0.0, 1.0 );
	outColor.rgb *= uDim;
}`;

const TYPES = [ , 'float', 'vec2', 'vec3', 'vec4' ];

/**
 * @param effects Effects.
 * @param transition The transition of a stack when no effect
 *                   has one; null for a row.
 * @param y The slides follow each other downwards.
 * @return `vertex` and `fragment` (sources), `params` (uniform name
 *         to value), `mesh` (whether the quad needs to bend),
 *         `pointer`, `animated`, `hover` (animated while the
 *         pointer is over the slider) and `placed` (whether a
 *         slide at rest looks different from what the page draws).
 */
export function compose( effects: Effect[], transition: string | null, y?: boolean ) {
	const turned = y ? '.yx' : '';
	const heads = new Set< string >();
	const params: Record< string, number[] > = {};
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
			const all = ( value as number[] ).map ? ( value as number[] ) : [ value as number ];
			uniforms += `uniform ${ TYPES[ all.length ] } e${ k }_${ name };\n`;
			define += `#define ${ name } e${ k }_${ name }\n`;
			undefine += `#undef ${ name }\n`;
			params[ `e${ k }_${ name }` ] = all;
		}
		if ( effect.transition ) {
			base = named( define + effect.transition + '\n' + undefine );
		}
		let hook: Hook;
		for ( hook in hooks ) {
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
	vec3 was = p;
	${ calls.vertex }
	p = mix( was, p, uFx );
	vec2 at = ( ( uFrame.xy + uQuad.xy + uQuad.zw * 0.5 + p.xy ) / uFrame.zw * 2.0 - 1.0 )${ turned };
	gl_Position = vec4( at.x, -at.y, -p.z / uDepth * 0.5, 1.0 - p.z / uDepth );
}`;

	const fragment =
		FRAGMENT +
		head +
		PICK +
		base +
		hooks.uv +
		`vec4 media( vec2 uv ) {\nvec2 was = uv;\n${ calls.uv }return base( mix( was, uv, uFx )${ turned } );\n}\n` +
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
 * @param gl Context.
 * @param vertex Source.
 * @param fragment Source.
 * @return Program, not yet ready (see `ready()`).
 */
export function build( gl: WebGL2RenderingContext, vertex: string, fragment: string ): WebGLProgram {
	const program = gl.createProgram()!;
	[ vertex, fragment ].forEach( ( source, i ) => {
		const shader = gl.createShader(
			i ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER
		)!;
		gl.shaderSource( shader, source );
		gl.compileShader( shader );
		gl.attachShader( program, shader );
	} );
	gl.bindAttribLocation( program, 0, 'aPos' );
	gl.linkProgram( program );
	return program;
}

/**
 * @param gl Context.
 * @param program Program.
 * @return Whether the compiler is done with it.
 * @throws {Error} With the log of the compiler, when it failed.
 */
export function ready( gl: WebGL2RenderingContext, program: WebGLProgram ): boolean {
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
				.getAttachedShaders( program )!
				.map( ( shader ) => gl.getShaderInfoLog( shader ) )
				.join( '' ) || gl.getProgramInfoLog( program )!
		);
	}
	return true;
}
