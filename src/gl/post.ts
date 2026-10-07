/**
 * The post pass of the WebGL layer, for the effects that have a `post`
 * hook: the slides are drawn into a framebuffer, and that is drawn on the
 * canvas through one shader over the whole of it. So what an effect does
 * there goes across the gaps and the borders of the slides: rings under
 * the pointer that spread over all of them.
 *
 * Loaded by the layer when an effect asks for it, and not before (see
 * `pass.js` for what a post hook is).
 */
import { passOf, follow } from './pass.js';
import { build, ready } from './program.js';
import { rename } from '../gpu/wgsl.js';
import type { Effect } from './program.js';
import type { Slider } from '../index.js';

const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
	vec2 p = vec2( ( gl_VertexID << 1 ) & 2, gl_VertexID & 2 );
	vUv = vec2( p.x, 1.0 - p.y );
	gl_Position = vec4( p * 2.0 - 1.0, 0.0, 1.0 );
}`;

/**
 * @param slider Slider.
 * @param layer The layer: its `canvas`.
 * @param effects The effects of the layer.
 * @return What the layer calls before it draws the slides: with
 *         the context, to draw them into the framebuffer.
 */
export function post( slider: Slider, layer: { canvas: HTMLCanvasElement | null }, effects: Effect[] ) {
	const { glsl, calls, names, params, slots } = passOf( effects );
	const numbers = new Float32Array( slots * 4 );
	const fill = follow( slider, () => layer.canvas, effects, numbers, params );
	const fragment =
		`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform vec4 V[${ slots }];
const float PI = 3.14159265;
vec4 scene( vec2 uv ) { return texture( uScene, vec2( uv.x, 1.0 - uv.y ) ); }
` +
		rename( glsl, names ) +
		`void main() {
	vec2 uv = vUv;
	vec4 color = scene( uv );
	${ calls }outColor = color;
}`;

	// Made for a context, and made again for another.
	let made: {
		g: WebGL2RenderingContext;
		program: WebGLProgram;
		empty: WebGLVertexArrayObject;
		buffer: WebGLFramebuffer;
		picture: WebGLTexture;
		depth: WebGLRenderbuffer;
		width: number;
		height: number;
		at: WebGLUniformLocation | null;
	} | null = null;
	// Whether the slides of this frame went into the framebuffer.
	let drawn = false;
	// The shader did not compile: the slides are drawn as they are.
	let failed = false;

	// After the layer has drawn: the framebuffer on the canvas.
	slider.on( 'frame', () => {
		if ( ! made || ! drawn ) {
			return;
		}
		drawn = false;
		const { g, program, empty, picture } = made;
		fill( performance.now() );
		// What the layer has set up once, and is given back.
		const was = [
			g.getParameter( g.CURRENT_PROGRAM ),
			g.getParameter( g.VERTEX_ARRAY_BINDING ),
			g.isEnabled( g.BLEND ),
			g.isEnabled( g.DEPTH_TEST ),
		];
		g.bindFramebuffer( g.FRAMEBUFFER, null );
		g.disable( g.SCISSOR_TEST );
		g.disable( g.BLEND );
		g.disable( g.DEPTH_TEST );
		g.useProgram( program );
		g.bindVertexArray( empty );
		g.activeTexture( g.TEXTURE0 );
		g.bindTexture( g.TEXTURE_2D, picture );
		g.uniform1i( g.getUniformLocation( program, 'uScene' ), 0 );
		g.uniform4fv( made.at ||= g.getUniformLocation( program, 'V' ), numbers );
		g.clear( g.COLOR_BUFFER_BIT );
		g.drawArrays( g.TRIANGLES, 0, 3 );
		g.useProgram( was[ 0 ] );
		g.bindVertexArray( was[ 1 ] );
		g[ was[ 2 ] ? 'enable' : 'disable' ]( g.BLEND );
		g[ was[ 3 ] ? 'enable' : 'disable' ]( g.DEPTH_TEST );
	} );

	return ( g: WebGL2RenderingContext ) => {
		drawn = false;
		if ( failed ) {
			return;
		}
		if ( made?.g !== g ) {
			const program = build( g, VERTEX, fragment );
			made = {
				g,
				program,
				empty: g.createVertexArray()!,
				buffer: g.createFramebuffer()!,
				picture: g.createTexture()!,
				depth: g.createRenderbuffer()!,
				width: 0,
				height: 0,
				at: null,
			};
			g.bindTexture( g.TEXTURE_2D, made.picture );
			g.texParameteri( g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR );
			g.texParameteri( g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE );
			g.texParameteri( g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE );
		}
		try {
			// Until the compiler is done, the slides go on the canvas.
			if ( ! ready( g, made.program ) ) {
				return;
			}
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.error( 'gpuslider:', error );
			failed = true;
			return;
		}
		const { buffer, picture, depth } = made;
		const width = g.drawingBufferWidth;
		const height = g.drawingBufferHeight;
		g.bindFramebuffer( g.FRAMEBUFFER, buffer );
		if ( width !== made.width || height !== made.height ) {
			made.width = width;
			made.height = height;
			g.bindTexture( g.TEXTURE_2D, picture );
			g.texImage2D( g.TEXTURE_2D, 0, g.RGBA, width, height, 0, g.RGBA, g.UNSIGNED_BYTE, null );
			g.framebufferTexture2D( g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, picture, 0 );
			g.bindRenderbuffer( g.RENDERBUFFER, depth );
			g.renderbufferStorage( g.RENDERBUFFER, g.DEPTH_COMPONENT24, width, height );
			g.framebufferRenderbuffer( g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, depth );
		}
		drawn = true;
	};
}
