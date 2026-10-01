// The transition by how far a slide is out of the view: 0 while it is in,
// 1 once it is out, at either end of the view.
const OUT = `
float out_( float from, float to ) {
	return clamp( ( max( -uQuad.x, uQuad.x + uQuad.z - uView.x ) / uQuad.z - from ) / ( to - from ), 0.0, 1.0 );
}`;

const FADE =
	'vec4 transition( vec2 uv ) { return mix( getFromColor( uv ), getToColor( uv ), progress ); }';

/**
 * A transition at the two ends of the view: a slide of a row that moves
 * out of the view goes as the transition takes a picture away, and one
 * that comes in comes as it brings one. Any transition, or several in
 * `choose()`; without one the slides fade.
 *
 *     canvas( { effects: [ edges( burn() ) ] } )
 *
 * `from` and `to` are where it begins and ends, in widths of the slide
 * past the end of the view: at 0 a slide that touches it, at 1 one that
 * has left it. A slide that rests inside is as it is.
 *
 * @param {import('../program.js').Effect} [transition] The transition.
 * @param {Object} [options]      Options.
 * @param {number} [options.from] Where it begins.
 * @param {number} [options.to]   Where it ends.
 * @return {import('../program.js').Effect} Effect.
 */
export const edges = ( transition = { transition: FADE }, { from = 0, to = 1 } = {} ) => ( {
	head: [ transition.head, OUT ].flat().filter( Boolean ),
	params: { ...transition.params, edgeFrom: from, edgeTo: to },
	transition: transition.transition.replace( /\bprogress\b/g, 'out_( edgeFrom, edgeTo )' ),
} );
