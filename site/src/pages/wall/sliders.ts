/**
 * A wall of glass: every row is a slider without an end, and the rows are
 * the slides of a slider that goes down without an end. Neither takes the
 * pointer: the page does, and moves them together.
 *
 * What is of the library: the sliders, their canvas, the effects `dome`,
 * `jelly` and `slab`, and `loading()`. What is of this page: the pointer
 * that moves two ways at once, and the springs that let the glass swing
 * on when the wall has stopped.
 */
import { createSlider, type Slider } from 'gpuslider';
import { loading, marquee } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { dome, jelly, slab } from 'gpuslider/effects';
import { drawnBy, layer } from '../mount';

type Quad = { speed: number };

// A number that follows from another, between 0 and 1.
const chance = ( n: number ) => {
	const x = Math.sin( n * 127.1 ) * 43758.5453;
	return x - Math.floor( x );
};

// How fast a slider moves, in views per second, to the right or down.
const moving = ( slider: Slider ) => -slider.view.velocity;

/*
 * The springs. A spring follows the speed of the wall and swings past it:
 * when the wall stops, the glass does not. Two for each way, a tight one
 * and a loose one, and what swings is somewhere between them.
 *
 * They swing past once, and a little: with less hold the glass went to
 * and fro for seconds, which the user found "much too strong".
 */
const spring = ( pull: number, hold: number ) => ( {
	pull,
	hold,
	at: 0,
	speed: 0,
} );
const follow = ( one: ReturnType< typeof spring >, to: number, dt: number ) => {
	one.speed += ( ( to - one.at ) * one.pull - one.speed * one.hold ) * dt;
	one.at += one.speed * dt;
	return Math.abs( to - one.at ) + Math.abs( one.speed ) * 0.1;
};

// How soft the glass is: 1 is jelly as it comes.
const GIVE = 0.4;

// A pointer that rested this long before it let go has no speed left, ms.
const RECENT = 100;

/**
 * @param root  The wall.
 * @param intro The screen while the pictures load.
 * @param said  Where it says who draws.
 * @return Ends it.
 */
export function wall( root: HTMLElement, intro: HTMLElement, said: HTMLElement ) {
	const win = root.ownerDocument.defaultView!;
	const calm = win.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	const ended = new AbortController();
	const { signal } = ended;
	const swing = {
		x: [ spring( 130, 16 ), spring( 60, 10 ) ],
		y: [ spring( 130, 16 ), spring( 60, 10 ) ],
	};

	const outer = createSlider( root, {
		axis: 'y',
		loop: true,
		free: true,
		drag: false,
		align: 'center',
		start: 3,
		plugins: [
			// It finds the pictures of all rows.
			loading( { screen: intro, min: 900 } ),
		],
	} );

	// The glass is as thick as its pictures are large.
	const edge =
		( outer.slides[ 0 ].querySelector( '.gs-slide' ) as HTMLElement )
			.offsetWidth * 0.085;

	const rows = outer.slides.map( ( slide: HTMLElement, i: number ) => {
		// What the effects of this row are told on every frame.
		const centre = [ 0, 0 ];
		const size = [ 0 ];
		const across = [ 0 ];
		const slider: Slider = createSlider(
			slide.firstElementChild as HTMLElement,
			{
				loop: true,
				free: true,
				drag: false,
				plugins: [
					marquee( { speed: 10 + 9 * chance( i + 1 ), hover: 1 } ),
					canvas( {
						effects: [
							dome( { amount: 0.6, centre, size } ),
							jelly( { amount: GIVE, across } ),
							slab( { edge, bend: 1.3 } ),
						],
						eager: true,
						// The rows are larger than what is seen of them:
						// on a large screen that is many pixels.
						density: win.innerWidth < 800 ? 2 : 1.5,
						layer: layer(),
					} ),
				],
				on: {
					'canvas:ready': ( name: string ) => {
						said.textContent = `Drag the wall · drawn by ${ drawnBy(
							name
						) }`;
						// Every card swings its own way.
						slider.plugins[ name ].change = (
							card: number,
							quad: Quad
						) => {
							const weight = chance( i * 31 + card + 7 );
							quad.speed =
								swing.x[ 0 ].at * weight +
								swing.x[ 1 ].at * ( 1 - weight ) -
								moving( slider );
						};
					},
				},
			}
		);
		// Every second row begins half a picture further on.
		slider.shift( ( ( i % 2 ) * slider.layout().size[ 0 ] ) / 2 );
		return { slider, centre, size, across, weight: chance( i + 40 ) };
	} );
	const all: Slider[] = [ outer, ...rows.map( ( { slider } ) => slider ) ];

	// The pointer, from the middle of the wall, -1 to 1.
	const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

	let before = 0;
	let asked = 0;
	function tick( now: number ) {
		asked = 0;
		const dt = Math.min( 0.05, ( now - before ) / 1000 || 0.016 );
		before = now;

		const { span, size } = outer.layout();
		const wide = rows[ 0 ].slider.layout().span;
		const vx = calm ? 0 : moving( rows[ 0 ].slider );
		// In views of a row, as the speed along it.
		const vy = calm ? 0 : ( moving( outer ) * span ) / wide;
		let left = 0;
		for ( const one of swing.x ) {
			left += follow( one, vx, dt );
		}
		for ( const one of swing.y ) {
			left += follow( one, vy, dt );
		}
		pointer.x += ( pointer.tx - pointer.x ) * Math.min( 1, dt * 4 );
		pointer.y += ( pointer.ty - pointer.y ) * Math.min( 1, dt * 4 );
		left +=
			Math.abs( pointer.tx - pointer.x ) +
			Math.abs( pointer.ty - pointer.y );

		outer.view.places.forEach( ( place: { x: number }, i: number ) => {
			const row = rows[ i ];
			// The middle of the dome is the middle of the wall, and goes
			// a little with the pointer.
			row.size[ 0 ] = Math.max( wide, span );
			row.centre[ 0 ] = pointer.x * wide * 0.12;
			row.centre[ 1 ] =
				span / 2 - ( place.x + size[ i ] / 2 ) + pointer.y * span * 0.12;
			row.across[ 0 ] =
				swing.y[ 0 ].at * row.weight +
				swing.y[ 1 ].at * ( 1 - row.weight );
			row.slider.wake();
		} );
		if ( left > 0.002 || ! outer.resting ) {
			ask();
		}
	}
	const ask = () => {
		asked ||= win.requestAnimationFrame( tick );
	};
	outer.on( 'frame', ask );
	rows[ 0 ].slider.on( 'frame', ask );
	outer.on( 'measure', ask );
	ask();

	/*
	 * The pointer moves the wall both ways.
	 */
	let held: {
		id: number;
		x: number;
		y: number;
		from: number[];
		samples: number[][];
	} | null = null;

	root.addEventListener(
		'pointerdown',
		( event ) => {
			if ( held || ! event.isPrimary || event.button > 0 ) {
				return;
			}
			held = {
				id: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				from: all.map( ( slider ) => slider.motion.pos ),
				samples: [],
			};
			root.setPointerCapture( event.pointerId );
			root.classList.add( 'gs-dragging' );
			all.forEach( ( slider ) => slider.grab() );
		},
		{ signal }
	);

	root.addEventListener(
		'pointermove',
		( event ) => {
			const box = root.getBoundingClientRect();
			pointer.tx = ( ( event.clientX - box.x ) / box.width ) * 2 - 1;
			pointer.ty = ( ( event.clientY - box.y ) / box.height ) * 2 - 1;
			ask();
			if ( ! held || event.pointerId !== held.id ) {
				return;
			}
			const { from, samples } = held;
			const dx = event.clientX - held.x;
			const dy = event.clientY - held.y;
			all.forEach( ( slider, i ) =>
				slider.drag( from[ i ] - ( i ? dx : dy ) )
			);
			samples.push( [ event.timeStamp, dx, dy ] );
			while (
				samples.length > 2 &&
				event.timeStamp - samples[ 0 ][ 0 ] > RECENT
			) {
				samples.shift();
			}
		},
		{ signal }
	);

	const up = ( event: PointerEvent ) => {
		if ( ! held || event.pointerId !== held.id ) {
			return;
		}
		const { samples, from } = held;
		held = null;
		root.classList.remove( 'gs-dragging' );
		let vx = 0;
		let vy = 0;
		const last = samples.at( -1 );
		if ( last && samples.length > 1 && event.timeStamp - last[ 0 ] < RECENT ) {
			const time = ( last[ 0 ] - samples[ 0 ][ 0 ] ) / 1000;
			if ( time > 0 ) {
				vx = ( last[ 1 ] - samples[ 0 ][ 1 ] ) / time;
				vy = ( last[ 2 ] - samples[ 0 ][ 2 ] ) / time;
			}
		}
		all.forEach( ( slider, i ) =>
			slider.release( i ? -vx : -vy, from[ i ] )
		);
	};
	root.addEventListener( 'pointerup', up, { signal } );
	root.addEventListener( 'pointercancel', up, { signal } );

	/*
	 * The wheel and two fingers on a trackpad, both ways too.
	 */
	let rolling = 0;
	let rolled = { from: [ 0 ], x: 0, y: 0 };
	root.addEventListener(
		'wheel',
		( event ) => {
			event.preventDefault();
			if ( held ) {
				return;
			}
			if ( ! rolling ) {
				rolled = {
					from: all.map( ( slider ) => slider.motion.pos ),
					x: 0,
					y: 0,
				};
				all.forEach( ( slider ) => slider.grab() );
			}
			// In lines or pages: about as far as in pixels.
			const times = event.deltaMode ? 40 : 1;
			rolled.x += event.deltaX * times;
			rolled.y += event.deltaY * times;
			all.forEach( ( slider, i ) =>
				slider.drag( rolled.from[ i ] + ( i ? rolled.x : rolled.y ) )
			);
			win.clearTimeout( rolling );
			rolling = win.setTimeout( () => {
				rolling = 0;
				all.forEach( ( slider, i ) =>
					slider.release( 0, rolled.from[ i ] )
				);
			}, 90 );
		},
		{ passive: false, signal }
	);

	/*
	 * The arrow keys give the wall a push.
	 */
	root.tabIndex = 0;
	root.addEventListener(
		'keydown',
		( event ) => {
			const way = (
				{
					ArrowLeft: [ -1, 0 ],
					ArrowRight: [ 1, 0 ],
					ArrowUp: [ 0, -1 ],
					ArrowDown: [ 0, 1 ],
				} as Record< string, number[] >
			 )[ event.key ];
			if ( ! way || held ) {
				return;
			}
			event.preventDefault();
			const far = rows[ 0 ].slider.layout().size[ 0 ] * 2.2;
			all.forEach( ( slider, i ) => {
				const push = ( i ? way[ 0 ] : way[ 1 ] ) * far;
				if ( push ) {
					slider.grab();
					slider.release( push );
				}
			} );
		},
		{ signal }
	);

	// For who looks at it from outside: the tests.
	Object.assign( win, { wall: { wall: outer, rows } } );

	return () => {
		ended.abort();
		win.cancelAnimationFrame( asked );
		win.clearTimeout( rolling );
		// The rows first: they are in the slides of the wall.
		[ ...all ].reverse().forEach( ( slider ) => slider.destroy() );
		intro.classList.remove( 'gs-loaded' );
	};
}
