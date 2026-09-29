/**
 * The slider in React: React renders the slides, the slider moves them.
 *
 *     import { Slider, Slide } from 'shaderslide/react';
 *     import { controls } from 'shaderslide/plugins';
 *
 *     function Photos( { photos, loop } ) {
 *         return (
 *             <Slider loop={ loop } plugins={ [ controls() ] } aria-label="Photos">
 *                 { photos.map( ( photo ) => (
 *                     <Slide key={ photo.src }>
 *                         <img className="ss-media" { ...photo } />
 *                     </Slide>
 *                 ) ) }
 *             </Slider>
 *         );
 *     }
 *
 * What is in a `<Slider>` has the slider by `useSliderContext()`. With
 * markup of your own, `useSlider()` makes a slider of an element.
 *
 * Slides that React adds or removes are seen by the slider itself. What is
 * imported is what is in the bundle: this file, the core, and the plugins
 * and effects that are named.
 *
 * No JSX here: the library is not built before it is used.
 */
import {
	createContext,
	createElement,
	useContext,
	useEffect,
	useRef,
	useState,
} from 'react';
import { createSlider } from './index.js';

/**
 * @param {import('./index.js').Options} [options] Options of the slider,
 *                                                 with its plugins.
 * @param {unknown[]}                    [remake]  The slider is made again
 *                                                 when one of these
 *                                                 changes, as the
 *                                                 dependencies of an
 *                                                 effect. It stays at its
 *                                                 slide.
 * @return {[ import('react').RefObject<any>, import('./index.js').Slider | null ]}
 *         The ref for the element of the slider, and the slider once it is
 *         made.
 */
export function useSlider( options = {}, remake = [] ) {
	const ref = useRef( null );
	const at = useRef( options.start || 0 );
	const [ slider, set ] = useState(
		/** @type {import('./index.js').Slider | null} */ ( null )
	);
	useEffect( () => {
		const made = createSlider( ref.current, {
			...options,
			start: at.current,
		} );
		set( made );
		return () => {
			at.current = made.index;
			made.destroy();
			set( null );
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, remake );
	return [ ref, slider ];
}

// The options of the core that are props of `<Slider>`.
const OPTIONS = [
	'perView',
	'gap',
	'axis',
	'loop',
	'align',
	'group',
	'contain',
	'free',
	'duration',
	'start',
	'drag',
];

const Around = createContext(
	/** @type {import('./index.js').Slider | null} */ ( null )
);

/**
 * @return {import('./index.js').Slider | null} The slider of the
 *         `<Slider>` this component is in, once it is made. The component
 *         is rendered again when the slider goes to another snap, or has
 *         measured: what it reads of the slider is what is.
 */
export function useSliderContext() {
	const slider = useContext( Around );
	const [ , again ] = useState( 0 );
	useEffect( () => {
		const off = [ 'change', 'measure' ].map( ( name ) =>
			slider?.on( name, () => again( ( n ) => n + 1 ) )
		);
		return () => off.forEach( ( fn ) => fn?.() );
	}, [ slider ] );
	return slider;
}

const named = ( name, more ) => ( more ? name + ' ' + more : name );

/**
 * @typedef {Object} Own What a `<Slider>` takes that is neither an option
 *                       of the slider nor an attribute of its element.
 * @property {string}                          [as]       Its element, `div`
 *           when nothing is said.
 * @property {import('react').ReactNode}       [around]   What is in the
 *           slider beside its slides: arrows, a caption.
 * @property {unknown[]}                       [remake]   The slider is made
 *           again when one of these changes: for other plugins. It stays
 *           at its slide.
 * @property {number}                          [index]    The snap to be at:
 *           the slider goes there when this changes.
 * @property {(index: number, slider: import('./index.js').Slider) => void} [onChange]
 *           The snap the slider goes to.
 * @property {(index: number, slider: import('./index.js').Slider) => void} [onSettle]
 *           The snap it came to rest at.
 * @property {(slider: import('./index.js').Slider | null) => void} [onSlider]
 *           The slider when it is made, and null when it ends.
 */

/**
 * A slider: its element, its track, and the slides that are its children.
 *
 * Options of the slider are props, and a change of one changes the slider
 * that exists. Plugins are read when the slider is made; listeners are
 * the ones of the last render. Every other prop is an attribute of the
 * element.
 *
 * @param {Omit<import('./index.js').Options, 'on'> & Omit<import('react').HTMLAttributes<HTMLElement>, 'onChange'> & Own & { on?: Record<string, Function> }} props
 *        Props.
 * @return {import('react').ReactElement} Element.
 */
export function Slider( {
	as = 'div',
	className,
	children,
	around,
	plugins,
	remake = [],
	index,
	on,
	onChange,
	onSettle,
	onSlider,
	...rest
} ) {
	/** @type {Record<string, any>} */
	const options = {};
	/** @type {Record<string, any>} */
	const given = rest;
	OPTIONS.forEach( ( name ) => {
		if ( name in given ) {
			options[ name ] = given[ name ];
			delete given[ name ];
		}
	} );
	const heard = useRef( /** @type {Record<string, any>} */ ( {} ) );
	heard.current = { on, change: onChange, settle: onSettle };
	const [ ref, slider ] = useSlider(
		{
			...options,
			plugins,
			on: {
				'*': ( name, ...said ) => {
					heard.current.on?.[ name ]?.( ...said );
					heard.current[ name ]?.( ...said );
				},
			},
		},
		// A class that React writes takes the ones of the slider away.
		[ className, ...remake ]
	);
	const said = JSON.stringify( options );
	useEffect( () => {
		slider?.set( options );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ said ] );
	useEffect( () => {
		if ( slider && index >= 0 && index !== slider.index ) {
			slider.to( index );
		}
	}, [ slider, index ] );
	useEffect( () => {
		onSlider?.( slider );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ slider ] );
	return createElement(
		Around.Provider,
		{ value: slider },
		createElement(
			as,
			{ ...given, ref, className: named( 'ss', className ) },
			createElement( 'div', { className: 'ss-track' }, children ),
			around
		)
	);
}

/**
 * A slide of a `<Slider>`. Its image or film has the class `ss-media`.
 *
 * @param {import('react').HTMLAttributes<HTMLElement> & { as?: string }} props
 *        Props: `as` is its element, `div` when nothing is said.
 * @return {import('react').ReactElement} Element.
 */
export const Slide = ( { as = 'div', className, ...rest } ) =>
	createElement( as, { ...rest, className: named( 'ss-slide', className ) } );
