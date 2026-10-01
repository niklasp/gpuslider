import { useEffect, useRef, useState } from 'react';
import '@fontsource-variable/funnel-display';
import 'gpuslider/style.css';
import 'gpuslider/lightbox.css';
import './reveal.css';
import { createSlider, type Slider } from 'gpuslider';
import { loading, stack } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { lightbox } from 'gpuslider/lightbox';
import { image, photo } from '@/lib/media';
import { Bar, drawnBy, layer, share, shared } from '../mount';
import { STYLE, VEIL, WAYS, turn, veil } from './veil';

// The work of a studio: a name, what it was, the year, and its picture.
const WORK = [
	{ n: 2, name: 'Laser Hymn', what: 'Tour visuals', year: 2026 },
	{ n: 1, name: 'Open Late', what: 'Identity', year: 2025 },
	{ n: 3, name: 'Say It Twice', what: 'Campaign', year: 2025 },
	{ n: 5, name: 'Weather Inside', what: 'Music video', year: 2024 },
	{ n: 4, name: 'Arcade Hours', what: 'Photography', year: 2024 },
	{ n: 6, name: 'Night Radio', what: 'Editorial', year: 2023 },
	{ n: 7, name: 'Slow Fire', what: 'Installation', year: 2023 },
	{ n: 8, name: 'Warm Stripe', what: 'Portraits', year: 2022 },
];

// Around the picture, room on the canvas for it to bend into as it is
// dragged: px, as `--room` in reveal.css.
const ROOM = 48;

/**
 * Reveal: an index of work, whose pictures open out of the pointer and
 * turn into each other from name to name, in eleven ways to choose from.
 * After the reveal effect of Colin Demouge on Codrops.
 */
export default function Reveal() {
	const panel = useRef< HTMLDivElement >( null );
	const list = useRef< HTMLOListElement >( null );
	const [ by, setBy ] = useState( '' );
	const [ active, setActive ] = useState( -1 );
	const [ state, setState ] = useState( 'Loading the pictures' );
	const [ way, setWay ] = useState( 0 );
	const slider = useRef< Slider | null >( null );

	// The way the pictures come: read by the effects on every frame.
	const ways = useRef< HTMLDivElement >( null );
	const choose = ( to: number ) => {
		STYLE[ 0 ] = to;
		setWay( to );
		share( 'way', WAYS[ to ] );
		slider.current?.wake();
		// On a phone the dock is a strip: bring the chosen one into it.
		const strip = ways.current;
		const pill = strip?.children[ to ] as HTMLElement | undefined;
		if ( strip && pill && strip.scrollWidth > strip.clientWidth ) {
			strip.scrollTo( {
				left: pill.offsetLeft - ( strip.clientWidth - pill.offsetWidth ) / 2,
				behavior: 'smooth',
			} );
		}
	};

	useEffect( () => {
		const root = panel.current!;
		const rows = [
			...list.current!.querySelectorAll< HTMLButtonElement >( '.row' ),
		];
		// A mouse points at the names; a finger scrolls them, and the name
		// in the middle of the screen is the one shown.
		const pointing = matchMedia( '(hover: hover) and (pointer: fine)' ).matches;
		const calm = matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
		root.classList.toggle( 'held', ! pointing );

		let drawn = false;
		let ready = false;
		let shown = -1;
		let want = 0;
		let open = 0;
		let frozen = false;
		// Where the pointer is, and where the picture is: its middle, px.
		const at = { x: innerWidth * 0.6, y: innerHeight * 0.5 };
		const pos = { ...at };
		let scrolled = scrollY;
		let pace = 0;

		const made: Slider = createSlider( root, {
			loop: true,
			duration: 1100,
			plugins: [
				stack(),
				loading( { screen: false } ),
				canvas( {
					effects: [ turn(), veil() ],
					layer: layer(),
				} ),
				lightbox(),
			],
			on: {
				'canvas:ready': ( name: string ) => setBy( drawnBy( name ) ),
				'gpu:on': () => ( drawn = true ),
				'gl:on': () => ( drawn = true ),
				'gpu:off': () => ( drawn = false ),
				'gl:off': () => ( drawn = false ),
				'loading:progress': ( { progress }: { progress: number } ) =>
					setState( `Loading the pictures · ${ Math.round( progress * 100 ) } %` ),
				'loading:done': () => {
					ready = true;
					setState(
						pointing
							? 'Point at a name; click it to open the picture.'
							: 'Scroll the names; tap one to open its picture.'
					);
				},
				'lightbox:open': () => ( frozen = true ),
				'lightbox:close': () => ( frozen = false ),
			},
		} );
		slider.current = made;
		Object.assign( window, { slider: made } );
		// A link can carry the way: ?way=smoke. The build renders the first.
		const start = shared( 'way', WAYS );
		if ( start ) {
			choose( WAYS.indexOf( start ) );
		}

		// From one name to the next the picture draws in a little and opens
		// again: down for DOWN seconds, up for UP. Over several names in a
		// row it stays drawn in, and does not close.
		const DIP = 0.38;
		const DOWN = 0.18;
		const UP = 0.24;
		let since = 1;
		const dip = () =>
			since < DOWN
				? DIP * Math.sin( ( since / DOWN ) * Math.PI * 0.5 )
				: DIP * Math.max( 0, 1 - ( since - DOWN ) / UP ) ** 2;

		const show = ( i: number ) => {
			if ( i === shown ) {
				return;
			}
			if ( i >= 0 && shown >= 0 && open > 0.2 ) {
				// Already on its way up: down again from where it is.
				const now = dip();
				since = since < DOWN ? since : ( Math.asin( Math.min( 1, now / DIP ) ) / ( Math.PI * 0.5 ) ) * DOWN;
			}
			shown = i;
			setActive( i );
			if ( i >= 0 && made.index !== i ) {
				made.to( i );
			}
		};

		const off = new AbortController();
		const { signal } = off;

		if ( pointing ) {
			list.current!.addEventListener(
				'pointermove',
				( event ) => {
					at.x = event.clientX;
					at.y = event.clientY;
					want = 1;
				},
				{ signal }
			);
			list.current!.addEventListener(
				'pointerleave',
				() => {
					want = 0;
					show( -1 );
				},
				{ signal }
			);
			rows.forEach( ( row, i ) => {
				row.addEventListener( 'pointerenter', () => show( i ), { signal } );
			} );
		}
		// A name reached by the keyboard is shown as one pointed at: the
		// picture at the right of it.
		rows.forEach( ( row, i ) => {
			row.addEventListener(
				'focus',
				() => {
					if ( ! row.matches( ':focus-visible' ) ) {
						return;
					}
					const r = row.getBoundingClientRect();
					at.x = r.left + r.width * 0.72;
					at.y = r.top + r.height / 2;
					want = 1;
					show( i );
				},
				{ signal }
			);
			row.addEventListener(
				'blur',
				() => {
					if ( pointing && ! list.current!.matches( ':hover' ) ) {
						want = 0;
						show( -1 );
					}
				},
				{ signal }
			);
			row.addEventListener(
				'click',
				() => {
					show( i );
					made.plugins.lightbox?.open( i );
				},
				{ signal }
			);
		} );

		// Without a pointer, the name nearest the middle of the screen.
		const middle = () => {
			let best = -1;
			let near = Infinity;
			const half = innerHeight / 2;
			rows.forEach( ( row, i ) => {
				const r = row.getBoundingClientRect();
				const d = Math.abs( r.top + r.height / 2 - half );
				if ( d < near ) {
					near = d;
					best = i;
				}
			} );
			const box = list.current!.getBoundingClientRect();
			want = box.top < half && box.bottom > half ? 1 : 0;
			show( want ? best : -1 );
		};

		let last = performance.now();
		let frame = requestAnimationFrame( function run( now ) {
			frame = requestAnimationFrame( run );
			const dt = Math.min( ( now - last ) / 1000, 0.05 );
			last = now;
			if ( frozen ) {
				return;
			}
			if ( ! pointing ) {
				middle();
				pace += ( ( scrollY - scrolled ) / Math.max( dt, 0.001 ) - pace ) * ( 1 - Math.exp( -10 * dt ) );
				scrolled = scrollY;
			}

			const box = root.getBoundingClientRect();
			const w = box.width - ROOM * 2;
			const h = box.height - ROOM * 2;

			// The picture follows the pointer, a little late.
			let dx = 0;
			let dy = 0;
			if ( pointing ) {
				const k = calm ? 1 : 1 - Math.exp( -9 * dt );
				const was = { ...pos };
				pos.x += ( at.x - pos.x ) * k;
				pos.y += ( at.y - pos.y ) * k;
				root.style.transform = `translate3d(${ pos.x - box.width / 2 }px, ${ pos.y - box.height / 2 }px, 0)`;
				dx = at.x - pos.x;
				dy = at.y - pos.y;
				if ( was.x === pos.x && was.y === pos.y ) {
					dx = dy = 0;
				}
			} else {
				dy = -pace * 0.03;
			}
			const most = ROOM * 0.9;
			const len = Math.hypot( dx, dy );
			const cut = calm ? 0 : len > most ? most / len : 1;

			// It opens slowly, from the pointer, and closes faster.
			const goal = ready && shown >= 0 ? want : 0;
			const step = goal > open ? dt * 0.95 : dt * 2.2;
			const before = open;
			open = Math.max( 0, Math.min( 1, open + Math.sign( goal - open ) * Math.min( step, Math.abs( goal - open ) ) ) );

			const cx = pointing ? ( at.x - box.left ) / box.width : 0.5;
			const cy = pointing ? ( at.y - box.top ) / box.height : 0.5;
			const moved =
				before !== open ||
				since < DOWN + UP ||
				Math.abs( VEIL.drift[ 0 ] - dx * cut ) > 0.05 ||
				Math.abs( VEIL.drift[ 1 ] - dy * cut ) > 0.05;
			since += dt;
			const breath = calm ? 0 : dip();
			VEIL.open[ 0 ] = open * ( 1 - breath );
			VEIL.centre[ 0 ] = Math.min( 1.2, Math.max( -0.2, cx ) );
			VEIL.centre[ 1 ] = Math.min( 1.2, Math.max( -0.2, cy ) );
			VEIL.drift[ 0 ] = dx * cut;
			VEIL.drift[ 1 ] = dy * cut;
			VEIL.pad[ 0 ] = ROOM / box.width;
			VEIL.pad[ 1 ] = ROOM / box.height;
			// While a picture is shown its edge lives.
			if ( open > 0 ) {
				VEIL.clock[ 0 ] += dt;
			}
			if ( drawn ) {
				root.style.clipPath = '';
				if ( moved || open > 0 ) {
					made.wake();
				}
			} else {
				// Without a canvas the page shows the picture through a
				// circle that opens.
				const x = VEIL.centre[ 0 ] * box.width;
				const y = VEIL.centre[ 1 ] * box.height;
				root.style.clipPath = `circle(${ open * Math.hypot( w, h ) * 1.1 }px at ${ x }px ${ y }px)`;
			}
		} );

		return () => {
			cancelAnimationFrame( frame );
			off.abort();
			made.destroy();
		};
	}, [] );

	return (
		<>
			<header>
				<Bar code="reveal">Reveal{ by && ` · drawn by ${ by }` }</Bar>
			</header>
			<main>
				<div className="lede">
					<h1>Selected work, 2022 to 2026</h1>
					<p className="state" aria-live="polite">
						{ state }
					</p>
				</div>
				<ol
					ref={ list }
					className="index"
					data-active={ active >= 0 ? '' : undefined }
				>
					{ WORK.map( ( one, i ) => (
						<li key={ one.name } data-on={ i === active ? '' : undefined }>
							<button type="button" className="row">
								<span className="no">{ String( i + 1 ).padStart( 2, '0' ) }</span>
								<span className="name">{ one.name }</span>
								<span className="what">
									{ one.what }, { one.year }
								</span>
							</button>
						</li>
					) ) }
				</ol>
				<div
					ref={ panel }
					className="gs gs-stack peek"
					aria-label="Pictures of the work"
				>
					<div className="gs-track">
						{ WORK.map( ( one ) => (
							<div className="gs-slide" key={ one.name }>
								<img
									className="gs-media"
									{ ...image( one.n, 'photos' ) }
									sizes="(max-width: 700px) 80vw, 34vw"
									alt={ photo( one.n ).alt }
									draggable={ false }
								/>
							</div>
						) ) }
					</div>
				</div>
				<div ref={ ways } className="ways" role="group" aria-label="How the pictures come">
					{ WAYS.map( ( one, i ) => (
						<button
							key={ one }
							type="button"
							aria-pressed={ i === way }
							onClick={ () => choose( i ) }
						>
							{ one }
						</button>
					) ) }
				</div>
			</main>
			<footer>
				<p>
					Each picture opens out of the pointer, and turns into the next
					as you move to another name, in the way chosen in the dock. The names
					are a slider of their own pictures: a stack with a transition of
					its own and an effect that the page tells, every frame, where the
					pointer is.
				</p>
				<p>
					After{ ' ' }
					<a href="https://tympanus.net/codrops/2024/12/02/how-to-code-a-shader-based-reveal-effect-with-react-three-fiber-glsl/">
						the reveal effect
					</a>{ ' ' }
					of Colin Demouge on Codrops. Photos from Pexels.
				</p>
			</footer>
		</>
	);
}
