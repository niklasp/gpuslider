/**
 * The two canvas layers, measured in the browser that opens this page.
 *
 *     ?layer=gpu      gpu or gl
 *     &n=6            number of sliders, all of them moving
 *     &effects=a,b    effects, by name
 *     &seconds=4      how long is measured
 *     &from=dist      what is built, not the source
 *     &wait=1         measures when `window.measure()` is called
 *
 * What is measured:
 *
 *     start   from making a slider until its canvas is there (`on`), until
 *             it has drawn its slides (`drawn`) and until the frame after
 *             (`shown`): of the first slider of the page, and of one made
 *             afterwards
 *     script  what saying what is to be drawn takes, of all sliders in
 *             one frame
 *     apart   the time from one frame to the next
 *
 * Not measured: what the GPU does with it. No page can see that.
 */
const query = new URLSearchParams( location.search );
const name = query.get( 'layer' ) === 'gl' ? 'gl' : 'gpu';
const n = Number( query.get( 'n' ) ) || 6;
const chosen = ( query.get( 'effects' ) || '' ).split( ',' ).filter( Boolean );
const seconds = Number( query.get( 'seconds' ) ) || 4;
const from = query.get( 'from' ) === 'dist' ? '../dist' : '../src';
const index = from === '../src' ? '/index' : '';

const { createSlider } = await import( `${ from }/index.js` );
const { marquee } = await import( `${ from }/plugins${ index }.js` );
const lib = await import( `${ from }/${ name }${ index }.js` );

const frame = () => new Promise( ( done ) => requestAnimationFrame( done ) );
const sorted = ( numbers ) => [ ...numbers ].sort( ( a, b ) => a - b );
const at = ( numbers, part ) =>
	sorted( numbers )[ Math.min( numbers.length - 1, Math.floor( numbers.length * part ) ) ];
const round = ( number ) => Math.round( number * 100 ) / 100;

// The ways to this page.
const ways = document.getElementById( 'ways' );
for ( const layer of [ 'gpu', 'gl' ] ) {
	for ( const count of [ 1, 6, 20 ] ) {
		const to = new URLSearchParams( query );
		to.set( 'layer', layer );
		to.set( 'n', count );
		const link = document.createElement( 'a' );
		link.href = `?${ to }`;
		link.textContent = `${ layer === 'gpu' ? 'WebGPU' : 'WebGL' } × ${ count }`;
		if ( layer === name && count === n ) {
			link.setAttribute( 'aria-current', 'page' );
		}
		ways.append( link );
	}
}

// Images that are loaded and read, so that no layer waits for them.
const sources = Array.from(
	{ length: 8 },
	( _, i ) => `../media/${ i + 1 }.jpg`
);
await Promise.all(
	sources.map( ( src ) => {
		const image = new Image();
		image.src = src;
		return image.decode();
	} )
);

const columns = Math.ceil( Math.sqrt( n * 1.4 ) );
const rows = Math.ceil( n / columns );
const room = document.getElementById( 'sliders' );
room.style.setProperty( '--columns', columns );
room.style.setProperty(
	'--height',
	`${ Math.floor( ( innerHeight - 150 ) / rows - 8 ) }px`
);

const costs = [];
let cost = 0;
let canvases = 0;

/**
 * @return {Promise<Object>} A slider that moves, and how long it took
 *                           until it was drawn, ms.
 */
function make() {
	const root = document.createElement( 'div' );
	root.className = 'gs';
	root.setAttribute( 'aria-label', 'Measured' );
	root.innerHTML =
		'<div class="gs-track">' +
		sources
			.slice( 0, 5 )
			.map(
				( src ) =>
					`<div class="gs-slide"><img class="gs-media" src="${ src }" alt=""></div>`
			)
			.join( '' ) +
		'</div>';
	room.append( root );
	return new Promise( ( done ) => {
		const times = {};
		const began = performance.now();
		const watch = new MutationObserver( async () => {
			if ( root.querySelector( '.gs-drawn' ) ) {
				watch.disconnect();
				clearTimeout( late );
				canvases++;
				times.drawn = performance.now() - began;
				await frame();
				times.shown = performance.now() - began;
				done( { slider, times } );
			}
		} );
		// A page has a few canvases of WebGL and no more: the sliders
		// beyond them are drawn by the page.
		const late = setTimeout( () => {
			watch.disconnect();
			done( { slider, times } );
		}, 3000 );
		watch.observe( root, {
			subtree: true,
			attributes: true,
			attributeFilter: [ 'class' ],
		} );
		const slider = createSlider( root, {
			loop: true,
			plugins: [
				marquee( { speed: 120 } ),
				lib[ name ]( {
					effects: chosen.map( ( effect ) => lib[ effect ]() ),
					eager: true,
				} ),
			],
			on: {
				[ `${ name }:on` ]: () => {
					times.on = performance.now() - began;
				},
			},
		} );
		const layer = slider.plugins[ name ];
		const draw = layer.frame;
		layer.frame = ( ...all ) => {
			const before = performance.now();
			draw( ...all );
			cost += performance.now() - before;
		};
	} );
}

const first = await make();
const second = n > 1 ? await make() : null;
const others = await Promise.all(
	Array.from( { length: Math.max( 0, n - 2 ) }, make )
);
// Until the last of them that has a canvas was drawn.
const rest = Math.max( 0, ...others.map( ( { times } ) => times.shown || 0 ) );

/**
 * @return {Promise<Object>} Script and time between the frames of
 *                           `seconds`, ms.
 */
window.measure = async () => {
	const apart = [];
	costs.length = 0;
	let before = await frame();
	cost = 0;
	const until = before + seconds * 1000;
	while ( before < until ) {
		const now = await frame();
		apart.push( now - before );
		costs.push( cost );
		cost = 0;
		before = now;
	}
	const usual = at( apart, 0.5 );
	return {
		frames: apart.length,
		apart: round( usual ),
		apart95: round( at( apart, 0.95 ) ),
		apartMost: round( at( apart, 1 ) ),
		late: apart.filter( ( time ) => time > usual * 1.5 ).length,
		// The mean: there are browsers that tell the time in whole ms.
		script: round( costs.reduce( ( sum, time ) => sum + time, 0 ) / costs.length ),
		script95: round( at( costs, 0.95 ) ),
	};
};

window.result = {
	layer: name,
	n,
	effects: chosen,
	first: first.times,
	second: second?.times,
	rest: round( rest ),
	canvases,
};

const said = document.getElementById( 'said' );
const tell = ( run ) => {
	const lines = [
		[ 'Drawn by', name === 'gpu' ? 'WebGPU' : 'WebGL' ],
		[ 'Sliders, all moving', n ],
		[ 'Of them drawn by the canvas', canvases ],
		[ 'Effects', chosen.join( ', ' ) || 'none' ],
		[ 'First slider: until drawn', `${ round( first.times.drawn ) } ms` ],
		second && [ 'A second one: until drawn', `${ round( second.times.drawn ) } ms` ],
		n > 2 && [ `The other ${ n - 2 }, together`, `${ round( rest ) } ms` ],
		run && [ 'Script in a frame', `${ run.script } ms (19 of 20 frames under ${ run.script95 })` ],
		run && [ 'From frame to frame', `${ run.apart } ms (19 of 20 under ${ run.apart95 }, longest ${ run.apartMost })` ],
		run && [ 'Frames that came late', `${ run.late } of ${ run.frames }` ],
	].filter( Boolean );
	said.innerHTML =
		'<table>' +
		lines
			.map( ( [ what, value ] ) => `<tr><th>${ what }</th><td>${ value }</td></tr>` )
			.join( '' ) +
		'</table>' +
		( run ? '' : '<p>Measuring …</p>' );
};
tell();
if ( ! query.get( 'wait' ) ) {
	// When the sliders have found their pace.
	await new Promise( ( done ) => setTimeout( done, 1000 ) );
	window.result.run = await window.measure();
	tell( window.result.run );
}
window.ready = true;
