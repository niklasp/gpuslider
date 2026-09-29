/**
 * Which slide is seen at a point: what `hit()` says is what the canvas
 * draws.
 */
import { test } from '@playwright/test';
import { open, settled, painted, unable, expect } from './helpers.js';

const LAID = [ 'coverflow', 'pile', 'fan', 'dome:{"amount":1.5}', 'bend' ];

const setup = ( effects, more = {} ) => ( {
	n: 7,
	o: { loop: true, align: 'center', ...more },
	css: '.gs { --gs-per-view: 3; padding-block: 40px; } .gs-y { height: 600px; padding: 0 40px; }',
	plugins: 'gl,hit',
	effects,
} );

/**
 * Points all over the slider: whether the canvas has drawn there, and
 * which slide is seen there.
 */
const compare = ( page ) =>
	page.evaluate( () => {
		const { slider } = window;
		const layer = slider.plugins.gl;
		const { canvas } = layer;
		const pixels = window.pixels( layer );
		const box = canvas.getBoundingClientRect();
		const ratio = canvas.width / box.width;
		const found = { points: 0, wrong: [], slides: new Set() };
		for ( let y = 6; y < box.height; y += 12 ) {
			for ( let x = 6; x < box.width; x += 12 ) {
				const at = slider.plugins.hit.at( box.left + x, box.top + y );
				const alpha =
					pixels[
						( Math.floor( y * ratio ) * canvas.width +
							Math.floor( x * ratio ) ) *
							4 +
							3
					];
				found.points++;
				found.slides.add( at );
				if ( at >= 0 !== alpha > 127 ) {
					found.wrong.push( [ x, y, at, alpha ] );
				}
			}
		}
		return { ...found, slides: [ ...found.slides ].sort() };
	} );

test.describe( 'what is seen at a point', () => {
	for ( const effects of LAID ) {
		test( `${ effects }: where a slide is said to be, the canvas has drawn`, async ( { page } ) => {
			await open( page, setup( effects ) );
			await painted( page );
			for ( const move of [ 0, 2 ] ) {
				await page.evaluate(
					( to ) => window.slider.to( to, { instant: true } ),
					move
				);
				await painted( page );
				const { points, wrong, slides } = await compare( page );
				expect( points ).toBeGreaterThan( 1000 );
				// The edges of what is drawn are soft, and a point may be on one.
				expect( wrong.length / points, JSON.stringify( wrong.slice( 0, 5 ) ) ).toBeLessThan(
					0.02
				);
				// Several slides are seen, and somewhere none is.
				expect( slides.length ).toBeGreaterThan( 2 );
			}
		} );
	}

	test( 'downwards too', async ( { page } ) => {
		await open( page, setup( 'coverflow', { axis: 'y' } ) );
		await painted( page );
		const { points, wrong, slides } = await compare( page );
		expect( wrong.length / points, JSON.stringify( wrong.slice( 0, 5 ) ) ).toBeLessThan( 0.02 );
		expect( slides.length ).toBeGreaterThan( 2 );
	} );

	test( 'a click on a cover at the edge is a click on that cover, not on the slide whose place it is', async ( { page } ) => {
		await open( page, setup( 'coverflow' ) );
		await painted( page );
		await page.evaluate( () => {
			window.clicked = [];
			window.slider.on( 'click', ( { index } ) => window.clicked.push( index ) );
		} );
		// 800 px, three slides: the one before the active one has the
		// left third of the page. What is seen at its left edge is the one
		// before that.
		const at = [ 105, 240 ];
		const under = await page.evaluate(
			( [ x, y ] ) =>
				Number( document.elementFromPoint( x, y ).closest( '.gs-slide' ).dataset.i ),
			at
		);
		expect( under ).toBe( 6 );
		await page.mouse.click( ...at );
		expect( await page.evaluate( () => window.clicked ) ).toEqual( [ 5 ] );
		// What is there to be used is where the page has it.
		await page.evaluate( () => {
			window.clicked = [];
			document
				.querySelectorAll( '.gs-content a' )
				.forEach( ( link ) =>
					link.addEventListener( 'click', ( event ) => event.preventDefault() )
				);
		} );
		await page.locator( '.gs-slide[data-i="6"] a' ).click();
		expect( await page.evaluate( () => window.clicked ) ).toEqual( [ 6 ] );
	} );

	test( 'while the page draws, the page says where a slide is', async ( { page } ) => {
		await unable( page );
		await open( page, setup( 'coverflow' ) );
		expect(
			await page.evaluate( () => [
				window.slider.plugins.hit.at( 105, 240 ) ?? null,
				window.slider.plugins.hit.where( 0 ),
			] )
		).toEqual( [ null, null ] );
		await page.evaluate( () => {
			window.clicked = [];
			window.slider.on( 'click', ( { index } ) => window.clicked.push( index ) );
		} );
		await page.mouse.click( 105, 240 );
		expect( await page.evaluate( () => window.clicked ) ).toEqual( [ 6 ] );
	} );

	test( 'the lightbox lets the image grow out of where it is drawn', async ( { page } ) => {
		await open( page, {
			...setup( 'coverflow' ),
			plugins: 'gl,hit,lightbox',
			open: 3000,
		} );
		await painted( page );
		const drawn = await page.evaluate( () => window.slider.plugins.hit.where( 6 ) );
		const onPage = await page
			.locator( '.gs-slide[data-i="6"] img' )
			.boundingBox();
		// Turned away, it is narrower than its place.
		expect( drawn.width ).toBeLessThan( onPage.width - 20 );
		await page.mouse.click( drawn.left + drawn.width / 2, 240 );
		await expect( page.locator( '.gs-lightbox' ) ).toBeVisible();
		expect(
			await page.evaluate( () => window.slider.plugins.lightbox.slider.index )
		).toBe( 6 );
		await settled( page );
	} );
} );

/**
 * Where the light of `spotlight` is on the canvas while the pointer is at
 * a point: the middle of what is lit, and how much that is.
 */
const lit = async ( page, [ x, y ] ) => {
	await page.mouse.move( 2, 698 );
	await page.waitForFunction( () => window.slider.resting );
	await page.evaluate( () => {
		window.was = window.pixels( window.slider.plugins.gl );
	} );
	// A pointer that moves, not one that comes.
	await page.mouse.move( x - 3, y );
	await page.mouse.move( x, y );
	// The pointer of the canvas follows softly: until it is there, and a
	// frame more for the picture of it.
	await page.waitForFunction( () => ! window.slider.plugins.gl.busy() );
	await page.evaluate(
		() =>
			new Promise( ( done ) =>
				requestAnimationFrame( () => requestAnimationFrame( done ) )
			)
	);
	return page.evaluate( () => {
		const { was } = window;
		const { canvas } = window.slider.plugins.gl;
		const pixels = window.pixels( window.slider.plugins.gl );
		const box = canvas.getBoundingClientRect();
		const ratio = canvas.width / box.width;
		let sum = [ 0, 0 ];
		let count = 0;
		for ( let i = 0; i < pixels.length; i += 4 ) {
			const dark = was[ i ] + was[ i + 1 ] + was[ i + 2 ];
			const now = pixels[ i ] + pixels[ i + 1 ] + pixels[ i + 2 ];
			// What was bright enough to say, and is as bright as it was.
			if ( was[ i + 3 ] > 250 && dark > 150 && now > dark * 0.9 ) {
				const at = i / 4;
				sum = [
					sum[ 0 ] + ( at % canvas.width ),
					sum[ 1 ] + Math.floor( at / canvas.width ),
				];
				count++;
			}
		}
		return {
			x: Math.round( box.left + sum[ 0 ] / count / ratio ),
			y: Math.round( box.top + sum[ 1 ] / count / ratio ),
			count: Math.round( count / ratio / ratio ),
		};
	} );
};

const LIGHT = 'spotlight:{"size":0.1,"dim":0.9}';

/**
 * Points in the middle of slides as they are drawn, with the same slide
 * seen all around them.
 */
const middles = ( page ) =>
	page.evaluate( () => {
		const { hit } = window.slider.plugins;
		return window.slider.slides
			.map( ( _, i ) => {
				const where = hit.where( i );
				if ( ! where ) {
					return null;
				}
				const x = Math.round( where.left + where.width / 2 );
				const y = Math.round( where.top + where.height / 2 );
				const around = [ -1, 0, 1 ].flatMap( ( dx ) =>
					[ -1, 0, 1 ].map( ( dy ) => hit.at( x + dx * 30, y + dy * 30 ) )
				);
				const box = window.slider.root.getBoundingClientRect();
				return around.every( ( seen ) => seen === i ) &&
					x > box.left + 30 &&
					x < box.right - 30 &&
					y > box.top + 30 &&
					y < box.bottom - 30
					? [ x, y ]
					: null;
			} )
			.filter( Boolean );
	} );

test.describe( 'the lightbox and slides that are laid out', () => {
	for ( const effects of [ ...LAID, 'coverflow downwards' ] ) {
		test( `${ effects }: the image grows out of the slide as it is drawn`, async ( { page } ) => {
			const [ name, down ] = effects.split( ' ' );
			await open( page, {
				...setup( name, down ? { axis: 'y' } : {} ),
				plugins: 'gl,hit,lightbox',
				// So slowly that it has not grown when it is looked at.
				open: 3000000,
			} );
			await painted( page );
			await page.evaluate( () => {
				window.first = window.pixels( window.slider.plugins.gl );
				window.slider.plugins.lightbox.open( 6 );
			} );
			await page.waitForFunction( () => {
				const { lightbox } = window.slider.plugins;
				return (
					lightbox.progress > 0 &&
					lightbox.slider.root.querySelector( '.gs-drawn' )
				);
			} );
			const found = await page.evaluate( () => {
				const { hit, lightbox, gl } = window.slider.plugins;
				const layer = lightbox.slider.plugins.gl;
				const pixels = window.pixels( layer );
				const of = ( canvas, all, x, y ) => {
					const box = canvas.getBoundingClientRect();
					const ratio = canvas.width / box.width;
					const at =
						( Math.floor( ( y - box.top ) * ratio ) * canvas.width +
							Math.floor( ( x - box.left ) * ratio ) ) *
						4;
					return [ ...all.slice( at, at + 4 ) ];
				};
				const where = hit.where( 6 );
				const said = { seen: 0, missing: 0, more: 0, apart: 0 };
				for ( let y = where.top - 20; y < where.top + where.height + 20; y += 5 ) {
					for ( let x = where.left - 20; x < where.left + where.width + 20; x += 5 ) {
						// Where the canvas of the slider is: the lightbox
						// draws the slide past it too.
						const box = gl.canvas.getBoundingClientRect();
						if (
							x < box.left + 4 ||
							y < box.top + 4 ||
							x > box.right - 4 ||
							y > box.bottom - 4
						) {
							continue;
						}
						const grown = of( layer.canvas, pixels, x, y );
						// Well inside of what is seen of the slide: its
						// edges are soft.
						const inside = [ -3, 3 ].every(
							( d ) => hit.at( x + d, y ) === 6 && hit.at( x, y + d ) === 6
						);
						if ( inside ) {
							const was = of( gl.canvas, window.first, x, y );
							said.seen++;
							said.missing += grown[ 3 ] < 250 ? 1 : 0;
							said.apart +=
								Math.abs( grown[ 0 ] - was[ 0 ] ) +
								Math.abs( grown[ 1 ] - was[ 1 ] ) +
								Math.abs( grown[ 2 ] - was[ 2 ] );
						} else if (
							grown[ 3 ] > 127 &&
							[ -6, 6 ].every(
								( d ) => hit.at( x + d, y ) < 0 && hit.at( x, y + d ) < 0
							)
						) {
							// Drawn where no slide is seen at all.
							said.more++;
						}
					}
				}
				return { ...said, progress: lightbox.progress };
			} );
			const about = JSON.stringify( found );
			expect( found.progress, about ).toBeLessThan( 0.001 );
			expect( found.seen, about ).toBeGreaterThan( 300 );
			// It grows out of the four corners of the slide. A slide that
			// the dome has bent is more than its corners: there it is near
			// what is drawn, not the same.
			const bent = name.startsWith( 'dome' );
			expect( found.missing / found.seen, about ).toBeLessThan(
				bent ? 0.06 : 0.01
			);
			expect( found.more / found.seen, about ).toBeLessThan( 0.01 );
			// Of 3 times 255, for a point: the image is the one of the
			// slide, in the size for the whole screen.
			expect( found.apart / found.seen, about ).toBeLessThan( bent ? 60 : 30 );
		} );
	}
} );

test.describe( 'effects that follow the pointer', () => {
	test( 'the light is on the cover that is seen under the pointer, not on the one whose place it is', async ( { page } ) => {
		await open( page, setup( `coverflow;${ LIGHT }` ) );
		await painted( page );
		// As the click above: the page has slide 6 here, seen is slide 5.
		const { x, y, count } = await lit( page, [ 105, 240 ] );
		expect( Math.abs( x - 105 ) ).toBeLessThan( 6 );
		expect( Math.abs( y - 240 ) ).toBeLessThan( 6 );
		expect( count ).toBeGreaterThan( 100 );
		expect( count ).toBeLessThan( 2000 );
	} );

	for ( const effects of [ ...LAID, 'coverflow downwards' ] ) {
		test( `${ effects }: the light is where the pointer is`, async ( { page } ) => {
			const [ name, down ] = effects.split( ' ' );
			await open(
				page,
				setup( `${ name };${ LIGHT }`, down ? { axis: 'y' } : {} )
			);
			await painted( page );
			const points = await middles( page );
			expect( points.length ).toBeGreaterThan( 0 );
			for ( const point of points ) {
				const { x, y, count } = await lit( page, point );
				const about = JSON.stringify( { point, x, y, count } );
				expect( Math.abs( x - point[ 0 ] ), about ).toBeLessThan( 8 );
				expect( Math.abs( y - point[ 1 ] ), about ).toBeLessThan( 8 );
				expect( count, about ).toBeGreaterThan( 100 );
				// As large as the slide is high.
				expect( count, about ).toBeLessThan( 6000 );
			}
		} );
	}

	test( 'without effects that lay out, nothing is asked', async ( { page } ) => {
		await open( page, { ...setup( LIGHT ), plugins: 'gl' } );
		await painted( page );
		const { x, y } = await lit( page, [ 500, 240 ] );
		expect( Math.abs( x - 500 ) ).toBeLessThan( 6 );
		expect( Math.abs( y - 240 ) ).toBeLessThan( 6 );
	} );
} );
