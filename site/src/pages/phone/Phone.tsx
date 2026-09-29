import '@/index.css';
import 'shaderslide/style.css';
import 'shaderslide/lightbox.css';
import '@/site.css';
import '@/text.css';
import './phone.css';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Slider, Slide } from 'shaderslide/react';
import { controls, stack, videos } from 'shaderslide/plugins';
import { canvas } from 'shaderslide/canvas';
import { coverflow, liquid, stretch, split } from 'shaderslide/effects';
import { lightbox } from 'shaderslide/lightbox';
import { BUTTON, FIRST, Footer, Nav, Section, WIDTH } from '@/components/Frame';
import { image, video } from '@/lib/media';
import { has, many, run, type Has, type Run } from './measure';

/** What a finger is to try, and what is to be seen then. */
const TRY = [
	[ 'side', 'A drag to the side moves the slider, and the page stays where it is' ],
	[ 'down', 'A drag up or down that begins on a slider scrolls the page' ],
	[ 'flick', 'A flick goes on by itself and comes to rest on a slide' ],
	[ 'stretch', 'The pictures stretch while the slider moves, and are sharp when it rests' ],
	[ 'turns', 'In the second slider one picture turns into the next, and a slow drag stops half way' ],
	[ 'film', 'The film plays in its slide, and does not fill the screen by itself' ],
	[ 'filmdrawn', 'The film takes part in the transition as the pictures do' ],
	[ 'tap', 'A tap on a cover lets it grow to the screen, from where it is' ],
	[ 'edge', 'A tap on the cover at the edge opens that cover, not its neighbour' ],
	[ 'inside', 'In the lightbox a drag goes to the next picture, a tap beside the picture closes' ],
	[ 'away', 'After another app and back, the pictures are there' ],
	[ 'turned', 'With the phone turned on its side and back, the slides fit' ],
] as const;

const SAID = [ 'yes', 'no', 'not tried' ] as const;

const ms = ( number: number ) => number.toFixed( number < 10 ? 2 : 1 );

const Photo = ( { n, sizes }: { n: number; sizes: string } ) => (
	<img
		className="ss-media"
		{ ...image( n ) }
		sizes={ sizes }
		alt={ `Colour field ${ n }` }
		draggable={ false }
		loading="lazy"
	/>
);

/** Plain slides for a slider that is made by the measuring. */
const Plain = ( { id, small }: { id: string; small?: boolean } ) => (
	<div className={ `ss cards${ small ? ' small' : '' }` } data-measured={ id }>
		<div className="ss-track">
			{ [ 1, 2, 3, 4, 5, 6, 7, 8 ].map( ( n ) => (
				<div className="ss-slide card" key={ n }>
					<img
						className="ss-media"
						{ ...image( n ) }
						sizes={ small ? '25vw' : '80vw' }
						alt=""
						draggable={ false }
					/>
				</div>
			) ) }
		</div>
	</div>
);

/**
 * What a phone makes of the sliders: a page to be opened on one.
 */
export default function Phone() {
	const [ found, setFound ] = useState< Has >( {} );
	const [ said, setSaid ] = useState< Record< string, string > >( {} );
	const [ notes, setNotes ] = useState( '' );
	const [ runs, setRuns ] = useState< Run[] >( [] );
	const [ crowd, setCrowd ] = useState< Awaited< ReturnType< typeof many > >[] >( [] );
	const [ doing, setDoing ] = useState( '' );
	const [ copied, setCopied ] = useState( false );
	const bench = useRef< HTMLDivElement >( null );

	useEffect( () => {
		has().then( setFound );
		try {
			setSaid( JSON.parse( localStorage.getItem( 'phone:said' ) || '{}' ) );
			setNotes( localStorage.getItem( 'phone:notes' ) || '' );
		} catch {
			// A browser that keeps nothing.
		}
	}, [] );

	const keep = ( name: string, value: string ) => {
		const next = { ...said, [ name ]: value };
		setSaid( next );
		try {
			localStorage.setItem( 'phone:said', JSON.stringify( next ) );
		} catch {
			// As above.
		}
	};

	const measure = async () => {
		const root = bench.current!;
		const made: Run[] = [];
		const crowded = [];
		setRuns( [] );
		setCrowd( [] );
		root.scrollIntoView( { block: 'center' } );
		for ( const layer of [ 'gl', 'gpu' ] as const ) {
			setDoing( `One slider, ${ layer === 'gpu' ? 'WebGPU' : 'WebGL' }` );
			made.push(
				await run(
					root.querySelector< HTMLElement >( '[data-measured="one"]' )!,
					layer
				)
			);
			setRuns( [ ...made ] );
		}
		for ( const layer of [ 'gl', 'gpu' ] as const ) {
			setDoing( `Twelve sliders, ${ layer === 'gpu' ? 'WebGPU' : 'WebGL' }` );
			crowded.push(
				await many(
					[
						...root.querySelectorAll< HTMLElement >(
							'[data-measured^="many"]'
						),
					],
					layer
				)
			);
			setCrowd( [ ...crowded ] );
		}
		setDoing( '' );
	};

	const report = useMemo(
		() =>
			[
				`shaderslide on a phone, ${ new Date().toISOString().slice( 0, 16 ) }`,
				'',
				'WHAT IT HAS',
				...Object.entries( found ).map( ( [ name, value ] ) => `${ name }: ${ value }` ),
				'',
				'BY HAND',
				...TRY.map(
					( [ name, text ] ) => `[${ said[ name ] || 'not tried' }] ${ text }`
				),
				...( notes ? [ '', 'NOTES', notes ] : [] ),
				'',
				'MEASURED',
				...( runs.length
					? runs.map(
							( one ) =>
								`${ one.asked } asked, ${ one.by } drew: first picture of the canvas after ${
									one.first ? ms( one.first ) + ' ms' : 'never'
								}; ${ one.frames } frames, ${ ms( one.middle ) } ms apart in the middle, ${ ms(
									one.most
								) } ms for 95 of 100, ${ ms( one.worst ) } ms at worst, ${
									one.late
								} later than 25 ms; ${ ms( one.script ) } ms of script in a frame; canvas of ${
									one.pixels
								} px; the canvas gave up ${ one.lost } times`
					  )
					: [ 'not measured' ] ),
				...crowd.map(
					( one ) =>
						`Twelve sliders, ${ one.asked } asked: ${ one.canvas } on the canvas, ${ one.page } left to the page, the canvas gave up ${ one.lost } times`
				),
			].join( '\n' ),
		[ found, said, notes, runs, crowd ]
	);

	return (
		<>
			<Nav at="home" />
			<main
				className={ `${ WIDTH } grid grid-cols-[minmax(0,1fr)] gap-14 pb-32` }
				data-testid="phone"
			>
				<div className="pt-12">
					<h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
						On a phone
					</h1>
					<p className="mt-4 max-w-2xl text-lg text-muted-foreground">
						What a phone makes of the sliders has been thought about, and
						not measured. Open this page on one, try what is listed, let
						it measure, and send what it says at the end.
					</p>
				</div>

				<Section
					title="What it has"
					note="What the browser says of itself, and of what it draws with."
				>
					<div className="scrolls">
						<table data-testid="has">
							<tbody>
								{ Object.entries( found ).map( ( [ name, value ] ) => (
									<tr key={ name }>
										<th scope="row">{ name }</th>
										<td>{ value }</td>
									</tr>
								) ) }
							</tbody>
						</table>
					</div>
				</Section>

				<Section
					title="By hand"
					note="Three sliders: a row whose pictures stretch, a stack with a film whose slides turn into each other, and covers that open."
				>
					<Slider
						id="row"
						className="cards"
						style={ { '--ss-per-view': 1.3, '--ss-gap': '12px' } as CSSProperties }
						aria-label="A row"
						loop
						plugins={ [ controls(), canvas( { effects: [ stretch(), split() ] } ) ] }
					>
						{ [ 1, 2, 3, 4, 5, 6 ].map( ( n ) => (
							<Slide key={ n } className="card wide">
								<Photo n={ n } sizes="80vw" />
							</Slide>
						) ) }
					</Slider>
					<Slider
						id="turning"
						className="ss-stack"
						aria-label="A stack with a film"
						loop
						plugins={ [
							stack(),
							controls(),
							videos(),
							canvas( { effects: [ liquid() ] } ),
						] }
					>
						<Slide className="hero">
							<Photo n={ 2 } sizes="100vw" />
						</Slide>
						<Slide className="hero">
							<video
								className="ss-media"
								{ ...video( 'a' ) }
								aria-label="Someone walking into a tunnel of coloured lights"
								preload="none"
								muted
								playsInline
								loop
								autoPlay
							/>
						</Slide>
						<Slide className="hero">
							<Photo n={ 4 } sizes="100vw" />
						</Slide>
					</Slider>
					<Slider
						id="opening"
						className="covers"
						aria-label="Covers that open"
						loop
						align="center"
						plugins={ [
							controls(),
							canvas( { effects: [ coverflow( { angle: 45, depth: 0.35 } ) ] } ),
							lightbox(),
						] }
					>
						{ [ 5, 6, 7, 8, 1, 3 ].map( ( n ) => (
							<Slide key={ n } className="cover">
								<Photo n={ n } sizes="60vw" />
							</Slide>
						) ) }
					</Slider>
					<ul className="grid gap-3" data-testid="try">
						{ TRY.map( ( [ name, text ] ) => (
							<li
								key={ name }
								className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
							>
								<span className="text-sm" id={ `try-${ name }` }>
									{ text }
								</span>
								<span
									className="flex gap-1"
									role="group"
									aria-labelledby={ `try-${ name }` }
								>
									{ SAID.map( ( value ) => (
										<button
											key={ value }
											type="button"
											className={ BUTTON }
											aria-pressed={ ( said[ name ] || 'not tried' ) === value }
											aria-current={
												( said[ name ] || 'not tried' ) === value
													? 'true'
													: undefined
											}
											onClick={ () => keep( name, value ) }
										>
											{ value }
										</button>
									) ) }
								</span>
							</li>
						) ) }
					</ul>
					<label className="grid gap-1 text-sm">
						What else there is to say
						<textarea
							id="notes"
							className="min-h-24 rounded-md border bg-background p-3 text-sm dark:border-input dark:bg-input/30"
							value={ notes }
							onChange={ ( event ) => {
								setNotes( event.target.value );
								try {
									localStorage.setItem( 'phone:notes', event.target.value );
								} catch {
									// As above.
								}
							} }
						/>
					</label>
				</Section>

				<Section
					title="Measured"
					note="A slider that moves for five seconds with each layer, then twelve sliders at once. It takes half a minute: leave the phone alone meanwhile."
				>
					<div>
						<button
							type="button"
							className={ FIRST }
							disabled={ !! doing }
							onClick={ measure }
						>
							{ doing || 'Measure' }
						</button>
					</div>
					<div ref={ bench } className="grid gap-3" aria-hidden="true">
						<Plain id="one" />
						<div className="grid grid-cols-4 gap-2">
							{ Array.from( { length: 12 }, ( _, i ) => (
								<Plain key={ i } id={ `many-${ i }` } small />
							) ) }
						</div>
					</div>
					{ runs.length > 0 && (
						<div className="scrolls">
							<table data-testid="runs">
								<thead>
									<tr>
										<th scope="col">Asked</th>
										<th scope="col">Drawn by</th>
										<th scope="col">First picture</th>
										<th scope="col">Frames apart</th>
										<th scope="col">95 of 100</th>
										<th scope="col">Worst</th>
										<th scope="col">Late</th>
										<th scope="col">Script</th>
									</tr>
								</thead>
								<tbody>
									{ runs.map( ( one ) => (
										<tr key={ one.asked }>
											<th scope="row">{ one.asked }</th>
											<td>{ one.by }</td>
											<td>{ one.first ? `${ ms( one.first ) } ms` : 'none' }</td>
											<td>{ ms( one.middle ) } ms</td>
											<td>{ ms( one.most ) } ms</td>
											<td>{ ms( one.worst ) } ms</td>
											<td>
												{ one.late } of { one.frames }
											</td>
											<td>{ ms( one.script ) } ms</td>
										</tr>
									) ) }
								</tbody>
							</table>
						</div>
					) }
					{ crowd.map( ( one ) => (
						<p key={ one.asked } className="text-sm text-muted-foreground">
							Twelve sliders with { one.asked }: { one.canvas } on the canvas,{ ' ' }
							{ one.page } left to the page.
						</p>
					) ) }
				</Section>

				<Section
					title="What it says"
					note="All of the above as text. Copy it, or share it, and send it."
				>
					<textarea
						id="report"
						data-testid="report"
						readOnly
						className="min-h-72 rounded-md border bg-background p-3 font-mono text-xs dark:border-input dark:bg-input/30"
						value={ report }
					/>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className={ FIRST }
							onClick={ async () => {
								try {
									await navigator.clipboard.writeText( report );
									setCopied( true );
								} catch {
									( document.getElementById(
										'report'
									) as HTMLTextAreaElement ).select();
								}
							} }
						>
							{ copied ? 'Copied' : 'Copy' }
						</button>
						{ typeof navigator !== 'undefined' && 'share' in navigator && (
							<button
								type="button"
								className={ BUTTON + ' h-10' }
								onClick={ () =>
									navigator
										.share( { title: 'shaderslide on a phone', text: report } )
										.catch( () => {} )
								}
							>
								Share
							</button>
						) }
					</div>
				</Section>
			</main>
			<Footer />
		</>
	);
}
