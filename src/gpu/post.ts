/**
 * The post pass of the WebGPU layer, for the effects that have a `post`
 * hook: the slides are drawn into a texture, and that is drawn on the
 * canvas through one shader over the whole of it. What it does is what
 * the pass of WebGL does (see `../gl/post.js`), said in WGSL.
 *
 * Loaded by the layer when an effect asks for it, and not before.
 */
import { passOf, follow } from '../gl/pass.js';
import { wgsl, rename } from './wgsl.js';
import type { Effect } from '../gl/program.js';
import type { Slider } from '../index.js';

/**
 * @param slider Slider.
 * @param layer The layer: its `canvas`.
 * @param effects The effects of the layer.
 * @return `into( device, format, screen )`, before the slides are
 *         drawn: the texture to draw them into, or null while
 *         there is none; and `draw( encoder )`, after: puts it on
 *         the screen.
 */
export function post( slider: Slider, layer: { canvas: HTMLCanvasElement | null }, effects: Effect[] ) {
	const { glsl, calls, names, params, slots } = passOf( effects );
	const numbers = new Float32Array( slots * 4 );
	const fill = follow( slider, () => layer.canvas, effects, numbers, params );
	const code = `
const PI = 3.14159265;
struct Told { V: array< vec4f, ${ slots } > }
struct Point {
	@builtin( position ) at: vec4f,
	@location( 0 ) uv: vec2f,
}
@group( 0 ) @binding( 0 ) var<uniform> u: Told;
@group( 0 ) @binding( 1 ) var samp: sampler;
@group( 0 ) @binding( 2 ) var uScene: texture_2d<f32>;
@vertex fn vertex( @builtin( vertex_index ) i: u32 ) -> Point {
	let p = vec2f( f32( ( i << 1 ) & 2 ), f32( i & 2 ) );
	return Point( vec4f( p * 2.0 - 1.0, 0.0, 1.0 ), vec2f( p.x, 1.0 - p.y ) );
}
fn scene( uv: vec2f ) -> vec4f { return textureSampleLevel( uScene, samp, uv, 0.0 ); }
${ rename(
		wgsl( glsl ),
		Object.fromEntries(
			Object.entries( names ).map( ( [ name, at ] ) => [ name, `u.${ at }` ] )
		)
	) }
@fragment fn fragment( point: Point ) -> @location( 0 ) vec4f {
	let uv = point.uv;
	var color = scene( uv );
	${ calls }return color;
}`;

	// Made for a device, and made again for another.
	let made: {
		device: GPUDevice;
		pipeline?: GPURenderPipeline;
		buffer: GPUBuffer;
		sampler: GPUSampler;
		picture?: GPUTexture;
		view?: GPUTextureView;
		group?: GPUBindGroup;
	} | null = null;
	let failed = false;
	// Where the picture goes in this frame.
	let screen: GPUTextureView | null = null;

	return {
		into( device: GPUDevice, format: GPUTextureFormat, to: GPUTextureView ): GPUTextureView | null {
			screen = null;
			const canvas = layer.canvas;
			if ( failed || ! canvas ) {
				return null;
			}
			if ( made?.device !== device ) {
				const now = {
					device,
					// 64: UNIFORM, 8: COPY_DST.
					buffer: device.createBuffer( { size: numbers.byteLength, usage: 72 } ),
					sampler: device.createSampler( { magFilter: 'linear', minFilter: 'linear' } ),
				} as NonNullable< typeof made >;
				made = now;
				const module = device.createShaderModule( { code } );
				device
					.createRenderPipelineAsync( {
						layout: 'auto',
						vertex: { module },
						fragment: { module, targets: [ { format } ] },
					} )
					.then( ( pipeline ) => {
						now.pipeline = pipeline;
						slider.wake();
					} )
					.catch( ( error ) => {
						// eslint-disable-next-line no-console
						console.error( 'gpuslider:', error );
						failed = true;
					} );
			}
			// Until the compiler is done, the slides go on the screen.
			if ( ! made.pipeline ) {
				return null;
			}
			const { width, height } = canvas;
			if ( made.picture?.width !== width || made.picture?.height !== height ) {
				made.picture?.destroy();
				made.picture = device.createTexture( {
					size: [ width, height ],
					format,
					// 4: TEXTURE_BINDING, 16: RENDER_ATTACHMENT.
					usage: 20,
				} );
				made.view = made.picture.createView();
				made.group = device.createBindGroup( {
					layout: made.pipeline.getBindGroupLayout( 0 ),
					entries: [
						{ binding: 0, resource: { buffer: made.buffer } },
						{ binding: 1, resource: made.sampler },
						{ binding: 2, resource: made.view },
					],
				} );
			}
			screen = to;
			return made.view!;
		},

		draw( encoder: GPUCommandEncoder ) {
			if ( ! made?.pipeline || ! screen ) {
				return;
			}
			fill( performance.now() );
			made.device.queue.writeBuffer( made.buffer, 0, numbers );
			const pass = encoder.beginRenderPass( {
				colorAttachments: [
					{
						view: screen,
						clearValue: [ 0, 0, 0, 0 ],
						loadOp: 'clear',
						storeOp: 'store',
					},
				],
			} );
			pass.setPipeline( made.pipeline );
			pass.setBindGroup( 0, made.group! );
			pass.draw( 3 );
			pass.end();
			screen = null;
		},
	};
}
