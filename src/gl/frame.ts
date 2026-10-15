/**
 * A transition drawn at a progress the caller gives, not at the one a
 * slider and its clock have: for what makes a film of the transitions
 * frame by frame, where a frame has to be the same every time it is
 * drawn (the Studio of the site).
 *
 *     const draw = frames( canvas, [ burn() ] );
 *     const a = draw.picture( bitmapA );
 *     const b = draw.picture( bitmapB );
 *     if ( draw.ready() ) {
 *         draw.draw( a, b, 0.5 );
 *     }
 *
 * The shader is the one the layer makes of the same effects (see
 * `program.js`), and a picture covers the canvas as `object-fit: cover`
 * does. The canvas is the quad: no slider, no layout, no pointer.
 *
 * Not in the entries of the package; the site takes it by its path.
 */
import { build, compose, ready, type Effect } from './program.js';
import { fit, type Style } from './fit.js';

// As the layer has it, for effects without a transition.
const FADE =
	'vec4 transition( vec2 uv ) { return mix( getFromColor( uv ), getToColor( uv ), progress ); }';

const COVER: Style = { fit: 'cover', at: [ { share: 0.5 }, { share: 0.5 } ], radius: 0, shape: 2 };

// Cells of the grid, for effects that bend it.
const MESH = 32;

/** A picture on the GPU, and its size. */
export interface Picture {
	texture: WebGLTexture;
	width: number;
	height: number;
}

/**
 * @param canvas Canvas to draw into; its size is the size drawn.
 * @param effects Effects, as for the layer: a transition, or `choose()`.
 * @param options Options.
 * @param options.preserve Keep the drawing readable after the task.
 * @return `ready()`, `picture()`, `forget()`, `draw()`, `destroy()`.
 */
export function frames(
	canvas: HTMLCanvasElement | OffscreenCanvas,
	effects: Effect[],
	{ preserve = false }: { preserve?: boolean } = {}
) {
	const shader = compose( effects, FADE );
	const g = canvas.getContext( 'webgl2', {
		antialias: shader.mesh,
		depth: shader.mesh,
		preserveDrawingBuffer: preserve,
	} ) as WebGL2RenderingContext | null;
	if ( ! g ) {
		throw new Error( 'WebGL 2 is not there.' );
	}
	const program = build( g, shader.vertex, shader.fragment );
	const at: Record< string, WebGLUniformLocation | null > = {};
	const numbers = [ new Float32Array( 13 ), new Float32Array( 13 ) ];
	let indices = 0;
	let begun = false;

	const begin = () => {
		begun = true;
		g.useProgram( program );
		const n = shader.mesh ? MESH : 1;
		const points: number[] = [];
		const order: number[] = [];
		for ( let y = 0; y <= n; y++ ) {
			for ( let x = 0; x <= n; x++ ) {
				points.push( x / n, y / n );
				if ( x < n && y < n ) {
					const i = y * ( n + 1 ) + x;
					order.push( i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2 );
				}
			}
		}
		g.bindVertexArray( g.createVertexArray() );
		g.bindBuffer( g.ARRAY_BUFFER, g.createBuffer() );
		g.bufferData( g.ARRAY_BUFFER, new Float32Array( points ), g.STATIC_DRAW );
		g.enableVertexAttribArray( 0 );
		g.vertexAttribPointer( 0, 2, g.FLOAT, false, 0, 0 );
		g.bindBuffer( g.ELEMENT_ARRAY_BUFFER, g.createBuffer() );
		g.bufferData( g.ELEMENT_ARRAY_BUFFER, new Uint16Array( order ), g.STATIC_DRAW );
		indices = order.length;
		const count = g.getProgramParameter( program, g.ACTIVE_UNIFORMS );
		for ( let i = 0; i < count; i++ ) {
			const { name } = g.getActiveUniform( program, i )!;
			at[ name ] = g.getUniformLocation( program, name );
		}
		g.uniform1i( at.uA, 0 );
		g.uniform1i( at.uB, 1 );
		g.uniform1f( at.uDepth, 1200 );
		g.enable( g.BLEND );
		g.blendFunc( g.ONE, g.ONE_MINUS_SRC_ALPHA );
		g[ shader.mesh ? 'enable' : 'disable' ]( g.DEPTH_TEST );
		g.depthFunc( g.LEQUAL );
		g.clearColor( 0, 0, 0, 0 );
	};

	return {
		/** The context, for who reads what was drawn. */
		gl: g,

		/**
		 * @return Whether the compiler is done, and the frames can be drawn.
		 * @throws {Error} With the log of the compiler, when it failed.
		 */
		ready(): boolean {
			if ( ! begun && ready( g, program ) ) {
				begin();
			}
			return begun;
		},

		/**
		 * Uploads a picture, with mipmaps.
		 *
		 * @param source The picture: best as large as it is drawn.
		 * @return The picture on the GPU.
		 */
		picture( source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas | HTMLImageElement ): Picture {
			const texture = g.createTexture()!;
			g.bindTexture( g.TEXTURE_2D, texture );
			g.texParameteri( g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE );
			g.texParameteri( g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE );
			g.texParameteri( g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR );
			g.pixelStorei( g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true );
			g.texImage2D( g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, source );
			g.generateMipmap( g.TEXTURE_2D );
			return {
				texture,
				width: ( source as HTMLImageElement ).naturalWidth || source.width,
				height: ( source as HTMLImageElement ).naturalHeight || source.height,
			};
		},

		/** @param picture Lets go of it. */
		forget( picture: Picture ) {
			g.deleteTexture( picture.texture );
		},

		/**
		 * Draws one frame: `from` turning into `to`.
		 *
		 * @param from The picture before.
		 * @param to The picture after.
		 * @param progress 0 is `from`, 1 is `to`.
		 * @param time Seconds, for what the effects read as time.
		 */
		draw( from: Picture, to: Picture, progress: number, time = 0 ) {
			if ( ! begun ) {
				return;
			}
			const { width: w, height: h } = canvas;
			g.viewport( 0, 0, w, h );
			g.clear( g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT );
			g.uniform2f( at.uView, w, h );
			g.uniform4f( at.uFrame, 0, 0, w, h );
			g.uniform4f( at.uQuad, 0, 0, w, h );
			g.uniform2f( at.uSize, w, h );
			g.uniform1f( at.uTime, time );
			g.uniform1f( at.uPointerIn, 0 );
			g.uniform2f( at.uPointer, 0.5, 0.5 );
			g.uniform2f( at.uPointerSpeed, 0, 0 );
			g.uniform1f( at.uVelocity, 0 );
			g.uniform1f( at.uFx, 1 );
			g.uniform1f( at.uDim, 1 );
			g.uniform1f( at.uRadius, 0 );
			g.uniform1f( at.uShape, 2 );
			g.uniform1f( at.uProgress, progress );
			g.uniform1f( at.uMix, progress );
			for ( const name in shader.params ) {
				const value = shader.params[ name ];
				( g as unknown as Record< string, Function > )[ `uniform${ value.length }fv` ]( at[ name ], value );
			}
			[ from, to ].forEach( ( picture, unit ) => {
				const [ box, rect ] = unit ? [ at.uBoxB, at.uRectB ] : [ at.uBoxA, at.uRectA ];
				const a = numbers[ unit ];
				fit( picture.width, picture.height, { x: 0, y: 0, w, h }, w, h, COVER, a );
				g.uniform4f( box, a[ 0 ], a[ 1 ], a[ 2 ], a[ 3 ] );
				g.uniform4f( rect, a[ 4 ], a[ 5 ], a[ 6 ], a[ 7 ] );
				g.activeTexture( g.TEXTURE0 + unit );
				g.bindTexture( g.TEXTURE_2D, picture.texture );
			} );
			g.uniform2f( at.uCut, numbers[ 0 ][ 8 ], numbers[ 1 ][ 8 ] );
			g.drawElements( g.TRIANGLES, indices, g.UNSIGNED_SHORT, 0 );
		},

		/**
		 * Lets go of the shader; the pictures are let go of by `forget()`.
		 *
		 * @param lose Lets go of the context too: for a canvas that is not
		 *             drawn into again. A canvas keeps its one context, so
		 *             one that is lost stays lost.
		 */
		destroy( lose = false ) {
			g.deleteProgram( program );
			begun = false;
			if ( lose ) {
				g.getExtension( 'WEBGL_lose_context' )?.loseContext();
			}
		},
	};
}
