/**
 * What the post pass of both layers has in common: the effects that have
 * a `post` hook made into functions, where each number they read is among
 * the numbers the pass is told, and the pointer over the canvas.
 *
 * A post hook is the body of `vec4 ( vec4 color, vec2 uv )`: `uv` runs
 * over the whole canvas from the top left, `color` is what the slides
 * drew there, and `scene( uv )` is what they drew anywhere. What it reads:
 *
 *     uPointer       the pointer in the canvas, px, smoothed
 *     uPointerSpeed  how fast it moves, px per second, smoothed
 *     uPointerIn     1 while the pointer is over the slider, eased
 *     uView          size of the canvas, px
 *     uTime          seconds
 *     uVelocity      how fast the slider moves, views per second
 */
import type { Effect } from './program.js';
import type { Slider } from '../index.js';

// How fast the pointer of the pass follows the real one, per second: as
// that of the slides.
const FOLLOW = 8;

/** Where the numbers of the pass are: four to a slot. */
const NAMES: Record< string, string > = {
	uPointer: 'V[0].xy',
	uPointerSpeed: 'V[0].zw',
	uView: 'V[1].xy',
	uPointerIn: 'V[1].z',
	uTime: 'V[1].w',
	uVelocity: 'V[2].x',
};
const SWIZZLE = [ , 'x', 'xy', 'xyz', 'xyzw' ];

/**
 * @param effects Effects; those without `post` are left out.
 * @return `glsl` (functions `post0` and on, with what they need),
 *         `calls` (that call them on `color`), `names` (what each
 *         number they read is: `V[ slot ].x`), `params` (the arrays of
 *         the parameters, by slot from 3 on), and `slots`.
 */
export function passOf( effects: Effect[] ) {
	const names = { ...NAMES };
	const params: number[][] = [];
	const heads = new Set< string >();
	let glsl = '';
	let calls = '';
	effects.forEach( ( effect, k ) => {
		if ( ! effect.post ) {
			return;
		}
		[ effect.head ].flat().forEach( ( head ) => head && heads.add( head ) );
		// The bodies use their parameters by name; each effect has its own.
		let body = effect.post;
		for ( const [ name, value ] of Object.entries( effect.params || {} ) ) {
			// An array stays the one it is: who made it may write into it.
			const all = ( value as number[] ).map ? ( value as number[] ) : [ value as number ];
			const own = `p${ k }_${ name }`;
			names[ own ] = `V[${ 3 + params.length }].${ SWIZZLE[ all.length ] }`;
			params.push( all );
			body = body.replace( new RegExp( `(?<![.\\w])${ name }\\b`, 'g' ), own );
		}
		glsl += `vec4 post${ k }( vec4 color, vec2 uv ) {${ body }\n}\n`;
		calls += `color = post${ k }( color, uv );\n`;
	} );
	return {
		glsl: [ ...heads ].join( '\n' ) + '\n' + glsl,
		calls,
		names,
		params,
		slots: 3 + params.length,
	};
}

/**
 * Follows the pointer over the canvas, and has frames drawn while it moves
 * or an effect of the pass is animated.
 *
 * @param slider Slider.
 * @param canvas The canvas of the layer, while it draws.
 * @param effects The effects of the pass.
 * @param numbers What the pass is told: filled on every
 *                `fill( now )`, slots 0 to 2 and the parameters.
 * @param params The arrays of the parameters, by slot from 3 on.
 * @return `fill( now )`, after which `numbers` are those of now.
 */
export function follow( slider: Slider, canvas: () => HTMLCanvasElement | null, effects: Effect[], numbers: Float32Array, params: number[][] ) {
	const pointer = { x: 0, y: 0, in: 0, tx: 0, ty: 0, tin: 0, vx: 0, vy: 0, moving: false };
	const listening = { passive: true, signal: slider.signal };
	let last = 0;
	const animated = effects.some( ( effect ) => effect.post && effect.animated === true );
	const hover = effects.some( ( effect ) => effect.post && effect.animated === 'pointer' );

	slider.root.addEventListener(
		'pointermove',
		( event ) => {
			const box = canvas()?.getBoundingClientRect();
			if ( box ) {
				pointer.tx = event.clientX - box.left;
				pointer.ty = event.clientY - box.top;
				// Nothing moves under the pointer for who asks for less motion.
				pointer.tin = +! slider.view.still;
				// It comes in where it is, not from where it left.
				if ( pointer.in < 0.01 ) {
					pointer.x = pointer.tx;
					pointer.y = pointer.ty;
				}
				pointer.moving = true;
				slider.wake();
			}
		},
		listening
	);
	slider.root.addEventListener(
		'pointerleave',
		() => {
			pointer.tin = 0;
			pointer.moving = true;
			slider.wake();
		},
		listening
	);
	slider.use( () => ( {
		name: 'post',
		busy: () =>
			!! canvas() &&
			( pointer.moving || animated || ( hover && pointer.tin > 0 ) ),
	} ) );

	return ( now: number ) => {
		const dt = Math.min( 0.1, ( now - ( last || now - 16 ) ) / 1000 ) || 0.016;
		last = now;
		const ease = 1 - Math.exp( -FOLLOW * dt );
		const { x, y } = pointer;
		pointer.x += ( pointer.tx - pointer.x ) * ease;
		pointer.y += ( pointer.ty - pointer.y ) * ease;
		pointer.in += ( pointer.tin - pointer.in ) * ease;
		pointer.vx = ( pointer.x - x ) / dt;
		pointer.vy = ( pointer.y - y ) / dt;
		pointer.moving =
			Math.abs( pointer.tx - pointer.x ) > 0.1 ||
			Math.abs( pointer.ty - pointer.y ) > 0.1 ||
			Math.abs( pointer.tin - pointer.in ) > 0.002;
		if ( ! pointer.moving ) {
			pointer.in = pointer.tin;
			pointer.vx = 0;
			pointer.vy = 0;
		}
		const view = canvas();
		numbers.set( [
			pointer.x,
			pointer.y,
			pointer.vx,
			pointer.vy,
			view?.clientWidth || 1,
			view?.clientHeight || 1,
			pointer.in,
			now / 1000,
			slider.view.velocity,
		] );
		params.forEach( ( all, i ) => numbers.set( all, ( 3 + i ) * 4 ) );
	};
}
