/**
 * Not run: compiled, to see that the types say what the library does.
 * `npm run types`.
 */
import { createSlider, type Slider, type Plugin, type Create } from 'shaderslide';
import { gl, stretch, coverflow, liquid, type Effect } from 'shaderslide/gl';
import { lightbox } from 'shaderslide/lightbox';
import { progress } from 'shaderslide/plugins';

const counter = ( { step = 1 } = {} ) => ( slider: Slider ) => {
	let frames = 0;
	return {
		name: 'counter',
		frame() {
			frames += step;
			slider.emit( 'counter:frame', frames );
		},
		get frames() {
			return frames;
		},
	} satisfies Plugin;
};

const wobble = ( { amount = 0.02 } = {} ): Effect => ( {
	params: { amount },
	animated: true,
	uv: 'uv.x += sin( uv.y * 20.0 + uTime * 3.0 ) * amount; return uv;',
} );

const made: Create[] = [
	gl( { effects: [ stretch(), coverflow( { angle: 40 } ), liquid(), wobble() ] } ),
	lightbox( { duration: 400, slider: { loop: true } } ),
	progress( { range: 2 } ),
	counter(),
];

const slider = createSlider( document.querySelector< HTMLElement >( '.ss' )!, {
	loop: true,
	perView: 'auto',
	align: 'center',
	next: '.next',
	prev: document.querySelector< HTMLElement >( '.prev' )!,
	plugins: made,
	on: {
		change: ( index ) => index.toFixed(),
		'counter:frame': () => {},
	},
} );

slider.on( 'change', ( index, it ) => {
	const n: number = index;
	const same: Slider = it;
	return [ n, same ];
} );
slider.on( 'edge', ( { start, end } ) => start && end );
slider.on( 'click', ( { index, event } ) => [ index.toFixed(), event.clientX ] );
slider.on( 'frame', ( view ) => view.places[ 0 ].p + view.velocity + view.layout.width );
slider.on( '*', ( name, detail ) => [ name.length, detail ] );
slider.on( 'lightbox:open', ( index ) => index );
const off: () => void = slider.once( 'settle', ( index ) => index.toFixed() );
off();

const position: number = slider.motion.pos + slider.progress + slider.index;
const can: boolean = slider.canNext && slider.canPrev && slider.resting;
slider.to( 2, { instant: true } );
slider.toSlide( 3 );
slider.set( { loop: false, duration: 300 } );
slider.use( counter( { step: 2 } ) );
slider.plugins.lightbox.open( 1 );
slider.wake();

// @ts-expect-error: a change says a number.
slider.on( 'change', ( index: string ) => index );
// @ts-expect-error: no such mode.
createSlider( document.body, { mode: 'pile' } );
// @ts-expect-error: angles are numbers.
coverflow( { angle: 'steep' } );

export { position, can };
