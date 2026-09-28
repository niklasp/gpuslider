/**
 * Not run: compiled, to see that the types say what the library does.
 * `npm run types`.
 */
import { createSlider, type Slider, type Plugin, type Create } from 'shaderslide';
import { gl, stretch, coverflow, liquid, type Effect } from 'shaderslide/gl';
import { lightbox } from 'shaderslide/lightbox';
import {
	progress,
	controls,
	keyboard,
	wheel,
	videos,
	autoplay,
	autoHeight,
	stack,
} from 'shaderslide/plugins';
import { createSlider as createFull } from 'shaderslide/full';

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
	controls( { next: '.next', prev: document.querySelector< HTMLElement >( '.prev' )! } ),
	keyboard(),
	wheel(),
	videos(),
	autoplay( 3500 ),
	autoplay( { delay: 3500, pause: '.pause' } ),
	autoHeight(),
	stack(),
	counter(),
];

const slider = createSlider( document.querySelector< HTMLElement >( '.ss' )!, {
	loop: true,
	perView: 'auto',
	align: 'center',
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
slider.plugins.autoplay.pause();

const full = createFull( document.body, {
	loop: true,
	autoplay: 3500,
	autoHeight: true,
	wheel: false,
	next: '.next',
	plugins: [ gl() ],
} );
full.next();

// @ts-expect-error: a change says a number.
slider.on( 'change', ( index: string ) => index );
// @ts-expect-error: autoplay is a plugin, not an option of the core.
createSlider( document.body, { autoplay: 3500 } );
// @ts-expect-error: a delay is a number.
autoplay( { delay: 'long' } );
// @ts-expect-error: no such mode.
createFull( document.body, { mode: 'pile' } );
// @ts-expect-error: angles are numbers.
coverflow( { angle: 'steep' } );

export { position, can };
