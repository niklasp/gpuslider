/**
 * The shaders of the effects that lay out give the numbers that their
 * `place` gives in JS, on both layers (see `exact.js`): the GLSL as it is,
 * and the WGSL it is translated into.
 */
import { test, expect } from '@playwright/test';

test( 'what the shaders of effects that lay out say is what place() says', async ( { page } ) => {
	const errors = [];
	page.on( 'pageerror', ( error ) => errors.push( error.message ) );
	await page.goto( `/tests/exact.html${ process.env.FROM ? `?from=${ process.env.FROM }` : '' }` );
	await page.waitForFunction( () => window.said, null, { timeout: 30000 } );
	expect( errors ).toEqual( [] );
	const said = await page.evaluate( () => window.said );
	expect( Object.keys( said ).length ).toBeGreaterThanOrEqual( 5 );
	for ( const [ name, { gl, gpu } ] of Object.entries( said ) ) {
		// Less than a hundredth of a pixel apart, where a layer is there.
		if ( gl !== null ) {
			expect( gl, `${ name } in WebGL` ).toBeLessThan( 0.01 );
		}
		if ( gpu !== null ) {
			expect( gpu, `${ name } in WebGPU` ).toBeLessThan( 0.01 );
		}
	}
} );
