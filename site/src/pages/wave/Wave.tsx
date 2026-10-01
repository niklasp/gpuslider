import { useEffect, useRef, useState, type CSSProperties } from 'react';
import 'gpuslider/style.css';
import 'gpuslider/loading.css';
import 'gpuslider/lightbox.css';
import './wave.css';
import { createSlider, type Slider } from 'gpuslider';
import { loading, marquee } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { bend, jelly, split, stretch, type Effect } from 'gpuslider/effects';
import { lightbox } from 'gpuslider/lightbox';
import { Bar, drawnBy, layer } from '../mount';

/**
 * Wave: bands of pictures that run against each other, in five stages,
 * each wilder than the one before. Every row of a band is a slider; the
 * canvas bends, tilts and turns what the rows are. After the experimental
 * carousels of Colin Demouge.
 *
 * The pictures are made by `bin/make-dream.mjs`: nothing of them is
 * downloaded.
 */

/** What each of the 24 pictures shows, by the kind of its scene. */
const KINDS = [
	'Blobs of chrome that melt into each other',
	'A sea of liquid metal under a pale sky',
	'Glass spheres over a holographic field',
	'A ring of chrome that twists',
	'Pills of chrome, scattered in the air',
	'Folds of holographic foil',
];
const PICTURES = 24;

const dream = ( n: number, sizes: string ) => {
	const name = `/media/dream/${ String( ( n % PICTURES ) + 1 ).padStart( 2, '0' ) }`;
	return {
		src: `${ name }-840.avif`,
		srcSet: `${ name }-420.avif 420w, ${ name }-840.avif 840w`,
		sizes,
		width: 840,
		height: 560,
		alt: KINDS[ n % KINDS.length ],
	};
};

/** A row: how high its slides are (in hundredths of the screen), and which way and how fast it runs. */
type Row = { h: number; speed: number };
/**
 * A band: rows on top of each other, placed as one: `y` from the middle of
 * the stage, in hundredths of the screen, and turned about the middle of
 * the stage by `angle`, in degrees. The canvas turns it, see `turn`: the
 * page measures the rows as they lie.
 */
type Band = { rows: Row[]; angle: number; y?: number; look?: CSSProperties };

type Stage = {
	id: string;
	title: string;
	line: string;
	bands: Band[];
	/**
	 * The effects of one row of the stage: of band `b`, and the length of
	 * a loop of the row, which the page measures.
	 */
	effects: ( row: Row, band: Band, b: number, period: number[] ) => Effect[];
	/** The rows are rings: see `ring`. */
	rings?: boolean;
};

// A band of three: small rows at its sides, a large one in the middle,
// all running one way.
const three = ( speed: number, angle: number, y = 0, scale = 1 ): Band => ( {
	rows: [
		{ h: 9 * scale, speed: speed * 0.8 },
		{ h: 20 * scale, speed },
		{ h: 9 * scale, speed: speed * 0.8 },
	],
	angle,
	y,
} );

// Between the rows of a band, in hundredths of the screen.
const GAP = 0.9;

/**
 * Where the middle of each row of a band is, from the middle of the band:
 * in the unit the rows are measured in (`--u`).
 */
const placesOf = ( band: Band ) => {
	const high = band.rows.reduce( ( sum, { h } ) => sum + h, 0 ) + GAP * ( band.rows.length - 1 );
	let at = -high / 2;
	return band.rows.map( ( { h } ) => {
		const middle = at + h / 2;
		at += h + GAP;
		return middle;
	} );
};

/**
 * The rows of a band turned about the middle of the view: a band that lies
 * across the stage at an angle. CSS cannot turn a slider whose canvas
 * measures where its slides are, so the canvas turns the mesh.
 */
const turn = ( { angle = 0 } = {} ) => {
	const a = ( angle * Math.PI ) / 180;
	return {
		params: { angle: a },
		vertex: `
	vec2 g = uQuad.xy + uQuad.zw * 0.5 + p.xy - uView * 0.5;
	float c = cos( angle );
	float s = sin( angle );
	vec2 r = vec2( g.x * c - g.y * s, g.x * s + g.y * c );
	return vec3( p.x + r.x - g.x, p.y + r.y - g.y, p.z );`,
		// The same in JS: a click finds the slide that is seen.
		place( p: number[], { view, quad }: About ) {
			const gx = quad[ 0 ] + quad[ 2 ] / 2 + p[ 0 ] - view[ 0 ] / 2;
			const gy = quad[ 1 ] + quad[ 3 ] / 2 + p[ 1 ] - view[ 1 ] / 2;
			p[ 0 ] += gx * Math.cos( a ) - gy * Math.sin( a ) - gx;
			p[ 1 ] += gx * Math.sin( a ) + gy * Math.cos( a ) - gy;
		},
	};
};

/** What `place` is told of a slide, see `hit()`. */
type About = { view: number[]; quad: number[] };

/**
 * The rows rise and fall along one long wave: as `wave()`, and with a
 * `place`, so that a click finds what is seen. `height` in heights of the
 * view, `length` in widths.
 */
const arc = ( { height = 0.1, length = 1 } = {} ) => ( {
	params: { height, length },
	vertex: `
	float x = uQuad.x + uQuad.z * 0.5 + p.x - uView.x * 0.5;
	return vec3( p.x, p.y + height * uView.y * sin( x / ( length * uView.x ) * 2.0 * PI ), p.z );`,
	place( p: number[], { view, quad }: About ) {
		const x = quad[ 0 ] + quad[ 2 ] / 2 + p[ 0 ] - view[ 0 ] / 2;
		p[ 1 ] += height * view[ 1 ] * Math.sin( ( x / ( length * view[ 0 ] ) ) * 2 * Math.PI );
	},
} );

// How far the bands of the second stage rise and fall, in hundredths of
// the screen. Each row is told it in heights of itself, so that the rows
// of a band stay together on one curve.
const ARC = 11;

const STAGES: Stage[] = [
	{
		id: 'two',
		title: 'Two bands',
		line: 'Rows of three that run against each other. Click a picture, and it opens.',
		bands: [
			three( 70, -24, -22 ),
			three( -70, -24, 22 ),
		],
		effects: ( _, band ) => [
			stretch( { amount: 0.6 } ),
			split( { amount: 0.8 } ),
			turn( band ),
		],
	},
	{
		id: 'curves',
		title: 'Curves',
		line: 'Three bands bent into arcs by wave(). The rows are straight as ever; the canvas draws them on the curve.',
		bands: [
			three( 60, -6, -31, 0.6 ),
			three( -80, -6, 0, 0.75 ),
			three( 60, -6, 31, 0.6 ),
		],
		effects: ( _, band ) => [
			arc( { height: ARC / 100, length: 0.9 } ),
			stretch( { amount: 0.5 } ),
			turn( band ),
		],
	},
	{
		id: 'crossing',
		title: 'Crossing',
		line: 'Two bands that cross. Where they meet one runs over the other, and what moves fast goes soft: jelly().',
		bands: [
			three( 90, 22 ),
			three( -90, -22 ),
		],
		effects: ( _, band ) => [
			jelly( { amount: 0.8 } ),
			stretch( { amount: 0.7 } ),
			split(),
			turn( band ),
		],
	},
	{
		id: 'depth',
		title: 'Depth',
		line: 'Five bands, the far ones smaller, slower and paler, each bent back at its ends by bend().',
		bands: [
			{ rows: [ { h: 7, speed: -22 } ], angle: -8, y: -36, look: { opacity: 0.45, filter: 'blur(1.5px)' } },
			{ rows: [ { h: 10, speed: 34 } ], angle: -8, y: -22, look: { opacity: 0.7 } },
			{ rows: [ { h: 9, speed: -70 }, { h: 26, speed: -90 }, { h: 9, speed: -70 } ], angle: -8, y: 4 },
			{ rows: [ { h: 12, speed: 120 } ], angle: -8, y: 30, look: { opacity: 0.9 } },
			{ rows: [ { h: 6, speed: -18 } ], angle: -8, y: 42, look: { opacity: 0.4, filter: 'blur(2px)' } },
		],
		effects: ( row, band ) => [
			bend( { amount: 0.35 + row.h / 60, speed: 0.3 } ),
			stretch( { amount: 0.5 } ),
			turn( band ),
		],
	},
	{
		id: 'vortex',
		title: 'Vortex',
		line: 'Rings that turn against each other: every ring is a row, and an effect of the canvas puts its slides on a circle.',
		bands: [
			{ rows: [ { h: 14, speed: 70 } ], angle: 0 },
			{ rows: [ { h: 22, speed: -90 } ], angle: 0 },
			{ rows: [ { h: 28, speed: 110 } ], angle: 0 },
			{ rows: [ { h: 36, speed: -130 } ], angle: 0 },
		],
		effects: ( _, __, b, period ) => [
			ring( { k: b, of: 4, period } ),
			stretch( { amount: 0.8 } ),
			split( { amount: 1.6 } ),
		],
		rings: true,
	},
];

// How many slides a row has: enough for a row that is longer than the
// field it lies in, whatever the screen.
const slidesOf = ( row: Row, stage: Stage ) =>
	stage.rings ? row.h : Math.ceil( 320 / ( 1.5 * row.h ) ) + 2;

// How each ring of the vortex is tilted, in radians.
const TILTS = [ 0, 0.55, -0.55, 0.12 ];

/**
 * Puts the slides of a row on a ring around the middle of the stage: the
 * way along the row is the way around, one turn a loop of the row
 * (`period`, which the page measures). Wide rings on a wide screen, tall
 * ones on a tall one; in front larger and lighter, behind smaller and
 * paler, rings seen a little from above. An effect, not a hook of the
 * canvas: it may make a slide larger, and a click finds what is seen.
 */
const ring = ( { k = 0, of = 1, period = [ 1 ] } ) => {
	const far = ( k + 1 ) / of;
	const tilt = TILTS[ k % TILTS.length ];
	const where = ( cx: number, vx: number, vy: number ) => {
		const P = period[ 0 ];
		const turn = ( ( cx - P * Math.floor( cx / P ) ) / P ) * Math.PI * 2 + k * 0.9;
		const front = ( Math.sin( turn ) + 1 ) / 2;
		const ex = Math.cos( turn ) * vx * 0.47 * ( 0.15 + 0.85 * far );
		const ey = Math.sin( turn ) * vy * ( vy > vx ? 0.4 : 0.3 ) * ( 0.15 + 0.85 * far );
		return {
			front,
			x: vx / 2 + ex * Math.cos( tilt ) - ey * Math.sin( tilt ),
			y: vy / 2 + ex * Math.sin( tilt ) + ey * Math.cos( tilt ),
			size: Math.sqrt( vx * vy ) * ( 0.05 + 0.06 * far ) * ( 0.55 + front * 0.75 ),
		};
	};
	return {
		params: { far, tilt, k, period },
		// The parameters are the bodies', not `head`'s: they come in.
		head: `
	vec4 ringAt( float cx, float P, float k, float far, float tilt ) {
		float turn = ( cx - P * floor( cx / P ) ) / P * 2.0 * PI + k * 0.9;
		float front = ( sin( turn ) + 1.0 ) * 0.5;
		float grow = 0.15 + 0.85 * far;
		float ex = cos( turn ) * uView.x * 0.47 * grow;
		float ey = sin( turn ) * uView.y * ( uView.y > uView.x ? 0.4 : 0.3 ) * grow;
		return vec4(
			uView.x * 0.5 + ex * cos( tilt ) - ey * sin( tilt ),
			uView.y * 0.5 + ex * sin( tilt ) + ey * cos( tilt ),
			sqrt( uView.x * uView.y ) * ( 0.05 + 0.06 * far ) * ( 0.55 + front * 0.75 ),
			front );
	}`,
		vertex: `
	vec2 c = uQuad.xy + uQuad.zw * 0.5;
	vec4 r = ringAt( c.x, period, k, far, tilt );
	float scale = r.z / uQuad.z;
	return vec3( r.x - c.x + p.x * scale, r.y - c.y + p.y * scale, p.z );`,
		color: `
	vec4 r = ringAt( uQuad.x + uQuad.z * 0.5, period, k, far, tilt );
	float dim = 0.72 + 0.28 * r.w;
	return vec4( color.rgb * dim, color.a );`,
		place( p: number[], { view, quad }: About ) {
			const cx = quad[ 0 ] + quad[ 2 ] / 2;
			const cy = quad[ 1 ] + quad[ 3 ] / 2;
			const r = where( cx, view[ 0 ], view[ 1 ] );
			const scale = r.size / quad[ 2 ];
			p[ 0 ] = r.x - cx + p[ 0 ] * scale;
			p[ 1 ] = r.y - cy + p[ 1 ] * scale;
		},
	};
};

/** The stages by the address of their page: the first is /examples/wave/. */
export const WAVES = STAGES.map( ( { id, title }, i ) => ( {
	id,
	title,
	address: i ? `/examples/wave/${ id }/` : '/examples/wave/',
} ) );

/** The stage of an address, the first where there is none. */
export const waveOf = ( path: string ) =>
	STAGES.find( ( { id } ) => path.includes( `/wave/${ id }/` ) )?.id || STAGES[ 0 ].id;

export default function Wave( { stage: id = STAGES[ 0 ].id }: { stage?: string } ) {
	const s = Math.max( 0, STAGES.findIndex( ( one ) => one.id === id ) );
	const stage = STAGES[ s ];
	const section = useRef< HTMLElement >( null );
	const [ by, setBy ] = useState( '' );

	useEffect( () => {
		const root = section.current!;
		const sliders: Slider[] = [];
		const undo: ( () => void )[] = [];
		// While a picture is open in the lightbox, nothing runs.
		const hold = ( still: boolean ) =>
			sliders.forEach( ( one ) =>
				still ? one.plugins.marquee?.pause() : one.plugins.marquee?.play()
			);
		const rows = [ ...root.querySelectorAll< HTMLElement >( '.row' ) ];
		// The bands are shown when every row is drawn by the canvas: before
		// that the page has the rows as they lie, straight and over each
		// other. Without a canvas they are shown as they are, after a time.
		let drawn = 0;
		let ready: () => void = () => {};
		const canvases = new Promise< void >( ( done ) => {
			ready = done;
		} );
		const fallback = setTimeout( ready, 6000 );
		undo.push( () => clearTimeout( fallback ) );
		const together = loading( {
			screen: root.querySelector< HTMLElement >( '.gs-loading' )!,
			min: 500,
			also: [ canvases ],
		} );
		rows.forEach( ( row, n ) => {
			const [ b, r ] = row.dataset.at!.split( ' ' ).map( Number );
			const band = stage.bands[ b ];
			// How long a loop of the row is, for the rings.
			const period = [ row.clientWidth ];
			const slider = createSlider( row, {
				loop: true,
				free: true,
				plugins: [
					together,
					marquee( { speed: band.rows[ r ].speed, hover: 0.35 } ),
					canvas( {
						effects: stage.effects( band.rows[ r ], band, b, period ),
						layer: layer(),
						eager: true,
					} ),
					lightbox(),
				],
				on: {
					'canvas:ready': ( name: string ) => {
						setBy( drawnBy( name ) );
						if ( ++drawn === rows.length ) {
							ready();
						}
					},
					'loading:done': () => root.classList.add( 'shown' ),
					'lightbox:open': () => hold( true ),
					'lightbox:close': () => hold( false ),
				},
			} );
			if ( stage.rings ) {
				const measure = () => {
					const [ one, two ] = slider.slides as HTMLElement[];
					period[ 0 ] = ( two.offsetLeft - one.offsetLeft ) * slider.slides.length;
					slider.wake();
				};
				const seen = new ResizeObserver( measure );
				seen.observe( row );
				undo.push( () => seen.disconnect() );
			}
			sliders[ n ] = slider;
		} );
		// The rows lie over each other, as large as the stage, and take no
		// pointer: the stage gives a click to the row whose picture is seen
		// there, the one drawn on top first, and shows that it can be opened.
		const seenAt = ( event: MouseEvent ) => {
			if ( ( event.target as HTMLElement ).closest( 'a, .said, nav' ) ) {
				return null;
			}
			for ( const one of [ ...sliders ].reverse() ) {
				const index = one.plugins.hit?.at( event.clientX, event.clientY );
				if ( index !== undefined && index >= 0 ) {
					return { one, index };
				}
			}
			return null;
		};
		const click = ( event: MouseEvent ) => {
			const found = seenAt( event );
			found?.one.plugins.lightbox.open( found.index );
		};
		let asked = 0;
		const move = ( event: PointerEvent ) => {
			// Once a frame is enough.
			cancelAnimationFrame( asked );
			asked = requestAnimationFrame( () =>
				root.classList.toggle( 'over', !! seenAt( event ) )
			);
		};
		root.addEventListener( 'click', click );
		root.addEventListener( 'pointermove', move );
		undo.push( () => {
			root.removeEventListener( 'click', click );
			root.removeEventListener( 'pointermove', move );
			cancelAnimationFrame( asked );
		} );
		Object.assign( window, { sliders } );
		return () => {
			undo.forEach( ( off ) => off() );
			sliders.forEach( ( slider ) => slider.destroy() );
		};
	}, [ stage ] );

	let count = s * 40;
	return (
		<>
			<header>
				<Bar code="wave">Wave{ by && ` · drawn by ${ by }` }</Bar>
			</header>
			<nav className="waves" aria-label="Stages">
				{ WAVES.map( ( one ) => (
					<a
						key={ one.id }
						href={ one.address }
						aria-current={ one.id === stage.id ? 'page' : undefined }
					>
						{ one.title }
					</a>
				) ) }
			</nav>
			<main
				ref={ section }
				id={ stage.id }
				className={ `stage${ stage.rings ? ' rings' : '' }` }
				aria-labelledby={ `${ stage.id }-title` }
			>
				<div className="gs-loading" role="progressbar" aria-label="Loading the pictures">
					<span data-gs-loaded>0</span>
				</div>
				{ stage.bands.map( ( band, b ) => {
					const places = placesOf( band );
					return band.rows.map( ( row, r ) => {
						const n = slidesOf( row, stage );
						const first = count;
						count += n;
						return (
							<div
								key={ `${ b }-${ r }` }
								className="gs row"
								data-at={ `${ b } ${ r }` }
								style={ {
									filter: band.look?.filter,
									'--o': band.look?.opacity ?? 1,
									'--h': `calc(${ row.h } * var(--u))`,
									'--y': `calc(${ band.y || 0 }svh + ${ places[ r ] } * var(--u))`,
									'--n': n,
								} as CSSProperties }
								aria-label={ `Row ${ r + 1 } of band ${ b + 1 }` }
							>
								<div className="gs-track">
									{ Array.from( { length: n }, ( _, i ) => (
										<div className="gs-slide" key={ i }>
											<img
												className="gs-media"
												{ ...dream(
													( first + i * 7 ) % PICTURES,
													row.h > 12 ? 'clamp(240px, 30svh, 420px)' : '210px'
												) }
												draggable={ false }
											/>
										</div>
									) ) }
								</div>
							</div>
						);
					} );
				} ) }
				<div className="said">
					<span className="step">{ s + 1 } / { STAGES.length }</span>
					<h1 id={ `${ stage.id }-title` }>{ stage.title }</h1>
					<p>{ stage.line }</p>
					<p className="after">
						Pictures made by code. After the{ ' ' }
						<a href="https://tympanus.net/Tutorials/R3FExperimentalCarousels/">
							experimental carousels
						</a>{ ' ' }
						of Colin Demouge.
					</p>
				</div>
			</main>
		</>
	);
}
