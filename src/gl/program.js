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
 *     params      numbers, or arrays of 2 to 4, that the bodies use by
 *                 their name
 *     head        GLSL the bodies need: helper functions
 *     animated    true when it moves without the slider moving
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
 *     uPointerIn  1 while the pointer is over the slider, eased
 *     uTime       seconds
 *     uSize       size of the quad, px
 *     uView       size of the view, px
 *
 * Effects are chained in the order given.
 */

const COMMON = `
const float PI = 3.14159265;
uniform float uProgress;
uniform float uVelocity;
uniform vec2 uPointer;
uniform float uPointerIn;
uniform float uTime;
uniform vec2 uSize;
uniform vec2 uView;
`;

const VERTEX = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
uniform vec4 uQuad;
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
`;

// A lookup outside of the image takes its edge, unless the image does not
// fill its element: then there is nothing. Where the element is not, there
// is nothing either.
const PICK = `
vec4 pick( sampler2D image, vec4 box, vec4 rect, float cut, vec2 uv ) {
	vec2 at = uv * box.xy + box.zw;
	vec2 inside = clamp( at, 0.0, 1.0 );
	vec2 edge = step( rect.xy, vUv ) * step( vUv, rect.zw );
	float there = edge.x * edge.y * ( 1.0 - cut * step( 0.0001, distance( at, inside ) ) );
	return texture( image, inside ) * there;
}
vec4 getFromColor( vec2 uv ) { return pick( uA, uBoxA, uRectA, uCut.x, uv ); }
vec4 getToColor( vec2 uv ) { return pick( uB, uBoxB, uRectB, uCut.y, uv ); }
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
	vec4 color = media( vUv );
	CALLS
	vec2 half_ = uSize * 0.5;
	vec2 d = abs( vUv * uSize - half_ ) - half_ + uRadius;
	float away = length( max( d, 0.0 ) ) + min( max( d.x, d.y ), 0.0 ) - uRadius;
	outColor = color * clamp( 0.5 - away, 0.0, 1.0 );
}`;

const TYPES = [ , 'float', 'vec2', 'vec3', 'vec4' ];

/**
 * @param {Object[]}    effects    Effects.
 * @param {string|null} transition The transition of a stack when no effect
 *                                 has one; null for a row.
 * @return {Object} `vertex` and `fragment` (sources), `params` (uniform name
 *                  to value), `mesh` (whether the quad needs to bend),
 *                  `pointer`, `animated`.
 */
export function compose( effects, transition ) {
	const heads = new Set();
	const params = {};
	const hooks = { vertex: '', uv: '', color: '' };
	const calls = { vertex: '', uv: '', color: '' };
	const signature = {
		vertex: [ 'vec3', 'vec3 p, vec2 uv', 'p = ', '( p, aPos );' ],
		uv: [ 'vec2', 'vec2 uv', 'uv = ', '( uv );' ],
		color: [ 'vec4', 'vec4 color, vec2 uv', 'color = ', '( color, vUv );' ],
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
			const type = TYPES[ [ value ].flat().length ];
			uniforms += `uniform ${ type } e${ k }_${ name };\n`;
			define += `#define ${ name } e${ k }_${ name }\n`;
			undefine += `#undef ${ name }\n`;
			params[ `e${ k }_${ name }` ] = [ value ].flat();
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
	const head = COMMON + uniforms + [ ...heads ].join( '\n' );

	const vertex =
		VERTEX +
		head +
		hooks.vertex +
		`void main() {
	vUv = aPos;
	vec3 p = vec3( ( aPos - 0.5 ) * uQuad.zw, 0.0 );
	${ calls.vertex }
	vec2 at = ( uQuad.xy + uQuad.zw * 0.5 + p.xy ) / uView * 2.0 - 1.0;
	gl_Position = vec4( at.x, -at.y, -p.z / uDepth * 0.5, 1.0 - p.z / uDepth );
}`;

	const fragment =
		FRAGMENT +
		head +
		PICK +
		base +
		hooks.uv +
		`vec4 media( vec2 uv ) {\n${ calls.uv }return base( uv );\n}\n` +
		hooks.color +
		MAIN.replace( 'CALLS', calls.color );

	return {
		vertex,
		fragment,
		params,
		mesh: !! hooks.vertex,
		pointer: /uPointer/.test( fragment + hooks.vertex ),
		animated: effects.some( ( effect ) => effect.animated ),
	};
}

/**
 * Compiles a program.
 *
 * @param {WebGL2RenderingContext} gl       Context.
 * @param {string}                 vertex   Source.
 * @param {string}                 fragment Source.
 * @return {WebGLProgram} Program.
 * @throws {Error} With the log of the compiler.
 */
export function build( gl, vertex, fragment ) {
	const program = gl.createProgram();
	const shaders = [
		[ gl.VERTEX_SHADER, vertex ],
		[ gl.FRAGMENT_SHADER, fragment ],
	].map( ( [ type, source ] ) => {
		const shader = gl.createShader( type );
		gl.shaderSource( shader, source );
		gl.compileShader( shader );
		gl.attachShader( program, shader );
		return shader;
	} );
	gl.bindAttribLocation( program, 0, 'aPos' );
	gl.linkProgram( program );
	if ( ! gl.getProgramParameter( program, gl.LINK_STATUS ) ) {
		const log =
			shaders.map( ( shader ) => gl.getShaderInfoLog( shader ) ).join( '' ) ||
			gl.getProgramInfoLog( program );
		gl.deleteProgram( program );
		throw new Error( log );
	}
	shaders.forEach( ( shader ) => gl.deleteShader( shader ) );
	return program;
}
