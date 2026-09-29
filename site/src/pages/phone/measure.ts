/**
 * What the page for phones finds out by itself: what the browser has, and
 * what a frame costs while a slider moves.
 */
import { createSlider, type Slider } from 'shaderslide';
import { canvas } from 'shaderslide/canvas';
import { stretch, waves } from 'shaderslide/effects';

export type Has = Record< string, string >;

/** What the browser says of itself and of what it draws with. */
export async function has(): Promise< Has > {
	const found: Has = {};
	const nav = navigator as Navigator & {
		deviceMemory?: number;
		connection?: { effectiveType?: string; saveData?: boolean };
		gpu?: { requestAdapter(): Promise< any > };
	};
	found.Browser = nav.userAgent;
	found.Screen = `${ screen.width } × ${ screen.height } px, ${ devicePixelRatio } device pixels for one`;
	found.Window = `${ innerWidth } × ${ innerHeight } px`;
	found[ 'Fingers at once' ] = String( nav.maxTouchPoints );
	found.Cores = String( nav.hardwareConcurrency || 'not said' );
	found.Memory = nav.deviceMemory ? `${ nav.deviceMemory } GB or more` : 'not said';
	found.Line = nav.connection
		? `${ nav.connection.effectiveType }${ nav.connection.saveData ? ', saves data' : '' }`
		: 'not said';
	found[ 'Less motion asked for' ] = matchMedia( '(prefers-reduced-motion: reduce)' )
		.matches
		? 'yes: the canvas draws no moves'
		: 'no';
	found[ 'Secure address' ] = isSecureContext
		? 'yes'
		: 'no: WebGPU is not there without https';

	let adapter;
	try {
		adapter = await nav.gpu?.requestAdapter();
	} catch {
		// As none.
	}
	found.WebGPU = adapter
		? [
				'yes',
				adapter.info?.vendor,
				adapter.info?.architecture,
				`textures up to ${ adapter.limits?.maxTextureDimension2D } px`,
		  ]
				.filter( Boolean )
				.join( ', ' )
		: 'no';

	const gl = document.createElement( 'canvas' ).getContext( 'webgl2' );
	if ( gl ) {
		const names = gl.getExtension( 'WEBGL_debug_renderer_info' );
		found[ 'WebGL 2' ] = [
			'yes',
			names && gl.getParameter( names.UNMASKED_RENDERER_WEBGL ),
			`textures up to ${ gl.getParameter( gl.MAX_TEXTURE_SIZE ) } px`,
		]
			.filter( Boolean )
			.join( ', ' );
		gl.getExtension( 'WEBGL_lose_context' )?.loseContext();
	} else {
		found[ 'WebGL 2' ] = 'no';
	}
	found[ 'Frames of a film' ] =
		'requestVideoFrameCallback' in HTMLVideoElement.prototype
			? 'told by the browser'
			: 'not told: the film is read on every frame';
	return found;
}

export type Run = {
	asked: string;
	by: string;
	first: number;
	frames: number;
	middle: number;
	most: number;
	worst: number;
	late: number;
	script: number;
	lost: number;
	pixels: string;
};

const sorted = ( numbers: number[] ) => [ ...numbers ].sort( ( a, b ) => a - b );
const at = ( numbers: number[], share: number ) =>
	sorted( numbers )[ Math.min( numbers.length - 1, Math.floor( numbers.length * share ) ) ] || 0;

/**
 * Makes a slider of an element, lets it move for a while and says what
 * its frames cost.
 */
export function run(
	element: HTMLElement,
	layer: 'gl' | 'gpu',
	time = 5000
): Promise< Run > {
	return new Promise( ( done ) => {
		const began = performance.now();
		let first = 0;
		let by = 'the page';
		let lost = 0;
		let script = 0;
		let timed = 0;
		const slider: Slider = createSlider( element, {
			loop: true,
			plugins: [ canvas( { effects: [ stretch(), waves() ], layer, eager: true } ) ],
			on: {
				'canvas:ready': ( name: string ) => {
					by = name === 'gpu' ? 'WebGPU' : 'WebGL';
					const made = slider.plugins[ name ];
					const { frame } = made;
					made.frame = ( ...all: unknown[] ) => {
						const from = performance.now();
						frame( ...all );
						script += performance.now() - from;
						timed++;
					};
				},
				'gl:off': () => lost++,
				'gpu:off': () => lost++,
			},
		} );

		// Until the canvas has drawn the first slide, 4 s at most.
		const wait = () => {
			if ( element.querySelector( '.ss-drawn' ) ) {
				first = performance.now() - began;
				move();
			} else if ( performance.now() - began > 4000 ) {
				by = 'the page';
				move();
			} else {
				requestAnimationFrame( wait );
			}
		};

		const move = () => {
			const apart: number[] = [];
			let before = 0;
			const from = performance.now();
			script = 0;
			timed = 0;
			lost = 0;
			const steps = setInterval( () => slider.next(), 700 );
			const frame = ( now: number ) => {
				if ( before ) {
					apart.push( now - before );
				}
				before = now;
				if ( now - from < time ) {
					requestAnimationFrame( frame );
					return;
				}
				clearInterval( steps );
				const made = slider.plugins.gpu || slider.plugins.gl;
				const pixels = made?.canvas
					? `${ made.canvas.width } × ${ made.canvas.height }`
					: 'none';
				// Before the slider ends: it gives its slides back then.
				const gone = lost;
				slider.destroy();
				done( {
					asked: layer === 'gpu' ? 'WebGPU' : 'WebGL',
					by,
					first,
					frames: apart.length,
					middle: at( apart, 0.5 ),
					most: at( apart, 0.95 ),
					worst: at( apart, 1 ),
					late: apart.filter( ( ms ) => ms > 25 ).length,
					script: timed ? script / timed : 0,
					lost: gone,
					pixels,
				} );
			};
			requestAnimationFrame( frame );
		};
		wait();
	} );
}

/**
 * Many sliders at once, each with a canvas: how many of them the canvas
 * draws, and how many are left to the page.
 */
export function many(
	elements: HTMLElement[],
	layer: 'gl' | 'gpu',
	time = 3000
): Promise< { asked: string; canvas: number; page: number; lost: number } > {
	return new Promise( ( done ) => {
		let lost = 0;
		const sliders = elements.map( ( element ) =>
			createSlider( element, {
				loop: true,
				plugins: [ canvas( { effects: [ stretch() ], layer, eager: true } ) ],
				on: { 'gl:off': () => lost++, 'gpu:off': () => lost++ },
			} )
		);
		setTimeout( () => {
			const drawn = elements.filter( ( element ) =>
				element.querySelector( '.ss-drawn' )
			).length;
			const gone = lost;
			sliders.forEach( ( slider ) => slider.destroy() );
			done( {
				asked: layer === 'gpu' ? 'WebGPU' : 'WebGL',
				canvas: drawn,
				page: elements.length - drawn,
				lost: gone,
			} );
		}, time );
	} );
}
