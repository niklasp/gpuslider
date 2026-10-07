/**
 * Exact checks of the shaders: the `vertex` of an effect that lays out,
 * run by the GPU at chosen inputs, against what its `place` says in JS for
 * the same inputs. The GLSL is run by WebGL 2 with transform feedback, the
 * WGSL that it is translated into by WebGPU in a compute shader: both give
 * numbers, not pictures, and a difference says where it is.
 *
 * Nothing here needs a page: `tests/exact.html` runs it in a browser, and
 * the WGSL half can run wherever there is a device.
 */

// Where the quad is, by its progress: a row of slides 300 wide with a gap
// of 20, in a view of 800 by 400, the one at 0 in the middle.
const VIEW = [ 800, 400 ];
const SIZE = [ 300, 200 ];
export const CASES = [ -1.6, -1, -0.45, 0, 0.3, 1, 2.2 ].flatMap( ( progress ) =>
	[ 0, 0.8 ].map( ( velocity ) => ( {
		progress,
		velocity,
		size: SIZE,
		view: VIEW,
		quad: [
			VIEW[ 0 ] / 2 - SIZE[ 0 ] / 2 + progress * ( SIZE[ 0 ] + 20 ),
			VIEW[ 1 ] / 2 - SIZE[ 1 ] / 2,
			...SIZE,
		],
	} ) )
);

// Points of the quad, from the top left: five by five.
export const UVS = Array.from( { length: 25 }, ( _, i ) => [ ( i % 5 ) / 4, Math.floor( i / 5 ) / 4 ] );

const float = ( n ) => ( Number.isInteger( n ) ? `${ n }.0` : String( n ) );
const literal = ( values, f ) =>
	values.length === 1
		? float( values[ 0 ] )
		: `vec${ values.length }${ f }( ${ values.map( float ).join( ', ' ) } )`;

/**
 * What every body reads, and the parameters of the effect, as values.
 *
 * @param {Object} effect Effect.
 * @param {Object} about  One of `CASES`.
 * @param {string} f      '' for GLSL, 'f' for WGSL.
 * @return {Object} Name to what to write for it.
 */
function values( effect, about, f ) {
	const all = {
		uProgress: [ about.progress ],
		uVelocity: [ about.velocity ],
		uSize: about.size,
		uView: about.view,
		uQuad: about.quad,
		uTime: [ 0 ],
		uPointer: [ 0.5, 0.5 ],
		uPointerSpeed: [ 0, 0 ],
		uPointerIn: [ 0 ],
		uFx: [ 1 ],
	};
	for ( const [ name, value ] of Object.entries( effect.params || {} ) ) {
		all[ name ] = value.map ? value : [ value ];
	}
	return Object.fromEntries(
		Object.entries( all ).map( ( [ name, v ] ) => [ name, `( ${ literal( v, f ) } )` ] )
	);
}

const heads = ( effect ) => [ effect.head ].flat().filter( Boolean ).join( '\n' );

/**
 * @param {Object} effect Effect.
 * @param {Object} about  One of `CASES`.
 * @return {string} A vertex shader that writes `vOut`, what `vertex`
 *                  makes of the point `aUv`.
 */
export function glsl( effect, about ) {
	const defines = Object.entries( values( effect, about, '' ) )
		.map( ( [ name, value ] ) => `#define ${ name } ${ value }` )
		.join( '\n' );
	return `#version 300 es
precision highp float;
in vec2 aUv;
out vec3 vOut;
const float PI = 3.14159265;
${ defines }
${ heads( effect ) }
vec3 vertex0( vec3 p, vec2 uv ) {${ effect.vertex }
}
void main() {
	vOut = vertex0( vec3( ( aUv - 0.5 ) * uQuad.zw, 0.0 ), aUv );
	gl_Position = vec4( 0.0, 0.0, 0.0, 1.0 );
	gl_PointSize = 1.0;
}`;
}

/**
 * @param {Object}   effect Effect.
 * @param {Object}   about  One of `CASES`.
 * @param {Function} wgsl   `wgsl()` of `src/gpu/wgsl.js`.
 * @param {Function} rename `rename()` of the same.
 * @return {string} A compute shader: `outs[ i ]` is what `vertex` makes
 *                  of the point `uvs[ i ]`.
 */
export function wgslOf( effect, about, wgsl, rename ) {
	const said = rename(
		wgsl( `${ heads( effect ) }\nvec3 vertex0( vec3 p, vec2 uv ) {${ effect.vertex }\n}\n` ),
		values( effect, about, 'f' )
	);
	return `
const PI = 3.14159265;
@group( 0 ) @binding( 0 ) var<storage, read> uvs: array<vec2f>;
@group( 0 ) @binding( 1 ) var<storage, read_write> outs: array<vec4f>;
${ said }
@compute @workgroup_size( 1 ) fn main( @builtin( global_invocation_id ) id: vec3u ) {
	let uv = uvs[ id.x ];
	outs[ id.x ] = vec4f( vertex0( vec3f( ( uv - 0.5 ) * vec2f( ${ about.quad[ 2 ] }, ${ about.quad[ 3 ] } ), 0.0 ), uv ), 0.0 );
}`;
}

/**
 * @param {Object} effect Effect.
 * @param {Object} about  One of `CASES`.
 * @return {number[][]} What `place` makes of every point of `UVS`.
 */
export function expected( effect, about ) {
	return UVS.map( ( uv ) => {
		const p = [ ( uv[ 0 ] - 0.5 ) * about.quad[ 2 ], ( uv[ 1 ] - 0.5 ) * about.quad[ 3 ], 0 ];
		return effect.place( p, about, uv ) || p;
	} );
}

/**
 * @param {number[][]} a Points.
 * @param {number[][]} b Points.
 * @return {number} How far the furthest are apart, px.
 */
export const apart = ( a, b ) =>
	Math.max( ...a.map( ( p, i ) => Math.max( ...p.map( ( n, k ) => Math.abs( n - b[ i ][ k ] ) ) ) ) );

/**
 * Runs the WGSL of every case on a device.
 *
 * @param {GPUDevice} device Device.
 * @param {Object}    effect Effect.
 * @param {Function}  wgsl   `wgsl()`.
 * @param {Function}  rename `rename()`.
 * @return {Promise<number[][][]>} Per case, the points.
 */
export async function runWgsl( device, effect, wgsl, rename ) {
	const out = [];
	const input = new Float32Array( UVS.flat() );
	for ( const about of CASES ) {
		const module = device.createShaderModule( { code: wgslOf( effect, about, wgsl, rename ) } );
		const pipeline = await device.createComputePipelineAsync( {
			layout: 'auto',
			compute: { module, entryPoint: 'main' },
		} );
		// 128: STORAGE, 8: COPY_DST, 4: COPY_SRC, 1: MAP_READ.
		const uvs = device.createBuffer( { size: input.byteLength, usage: 128 | 8 } );
		const outs = device.createBuffer( { size: UVS.length * 16, usage: 128 | 4 } );
		const read = device.createBuffer( { size: UVS.length * 16, usage: 8 | 1 } );
		device.queue.writeBuffer( uvs, 0, input );
		const encoder = device.createCommandEncoder();
		const pass = encoder.beginComputePass();
		pass.setPipeline( pipeline );
		pass.setBindGroup(
			0,
			device.createBindGroup( {
				layout: pipeline.getBindGroupLayout( 0 ),
				entries: [
					{ binding: 0, resource: { buffer: uvs } },
					{ binding: 1, resource: { buffer: outs } },
				],
			} )
		);
		pass.dispatchWorkgroups( UVS.length );
		pass.end();
		encoder.copyBufferToBuffer( outs, 0, read, 0, UVS.length * 16 );
		device.queue.submit( [ encoder.finish() ] );
		await read.mapAsync( 1 );
		const numbers = new Float32Array( read.getMappedRange().slice( 0 ) );
		read.unmap();
		[ uvs, outs, read ].forEach( ( buffer ) => buffer.destroy() );
		out.push( UVS.map( ( _, i ) => [ ...numbers.subarray( i * 4, i * 4 + 3 ) ] ) );
	}
	return out;
}

/**
 * Runs the GLSL of every case in a context.
 *
 * @param {WebGL2RenderingContext} gl     Context.
 * @param {Object}                 effect Effect.
 * @return {number[][][]} Per case, the points.
 */
export function runGlsl( gl, effect ) {
	const out = [];
	const input = gl.createBuffer();
	gl.bindBuffer( gl.ARRAY_BUFFER, input );
	gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( UVS.flat() ), gl.STATIC_DRAW );
	const result = gl.createBuffer();
	gl.bindBuffer( gl.TRANSFORM_FEEDBACK_BUFFER, result );
	gl.bufferData( gl.TRANSFORM_FEEDBACK_BUFFER, UVS.length * 12, gl.STATIC_READ );
	gl.bindBuffer( gl.TRANSFORM_FEEDBACK_BUFFER, null );
	gl.enable( gl.RASTERIZER_DISCARD );
	for ( const about of CASES ) {
		const program = gl.createProgram();
		[ [ gl.VERTEX_SHADER, glsl( effect, about ) ], [ gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\nout vec4 o;\nvoid main() { o = vec4( 0.0 ); }' ] ].forEach( ( [ kind, source ] ) => {
			const shader = gl.createShader( kind );
			gl.shaderSource( shader, source );
			gl.compileShader( shader );
			if ( ! gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) {
				throw new Error( gl.getShaderInfoLog( shader ) );
			}
			gl.attachShader( program, shader );
		} );
		gl.bindAttribLocation( program, 0, 'aUv' );
		gl.transformFeedbackVaryings( program, [ 'vOut' ], gl.INTERLEAVED_ATTRIBS );
		gl.linkProgram( program );
		if ( ! gl.getProgramParameter( program, gl.LINK_STATUS ) ) {
			throw new Error( gl.getProgramInfoLog( program ) );
		}
		gl.useProgram( program );
		gl.bindBuffer( gl.ARRAY_BUFFER, input );
		gl.enableVertexAttribArray( 0 );
		gl.vertexAttribPointer( 0, 2, gl.FLOAT, false, 0, 0 );
		gl.bindBufferBase( gl.TRANSFORM_FEEDBACK_BUFFER, 0, result );
		gl.beginTransformFeedback( gl.POINTS );
		gl.drawArrays( gl.POINTS, 0, UVS.length );
		gl.endTransformFeedback();
		gl.bindBufferBase( gl.TRANSFORM_FEEDBACK_BUFFER, 0, null );
		const numbers = new Float32Array( UVS.length * 3 );
		gl.bindBuffer( gl.COPY_READ_BUFFER, result );
		gl.getBufferSubData( gl.COPY_READ_BUFFER, 0, numbers );
		// A buffer that is bound elsewhere is not written to by the next draw.
		gl.bindBuffer( gl.COPY_READ_BUFFER, null );
		out.push( UVS.map( ( _, i ) => [ ...numbers.subarray( i * 3, i * 3 + 3 ) ] ) );
		gl.deleteProgram( program );
	}
	return out;
}
