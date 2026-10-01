
// A component of the client: a page of Next.js that is rendered on the
// server may have a <Slider> in it, and its slides may be of the server.
'use client';

/**
 * The slider in React: React renders the slides, the slider moves them.
 *
 *     import { Slider, Slide } from 'gpuslider/react';
 *     import { controls } from 'gpuslider/plugins';
 *
 *     function Photos( { photos, loop } ) {
 *         return (
 *             <Slider loop={ loop } plugins={ [ controls() ] } aria-label="Photos">
 *                 { photos.map( ( photo ) => (
 *                     <Slide key={ photo.src }>
 *                         <img className="gs-media" { ...photo } />
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
 * No JSX here: it is built with nothing that knows JSX.
 */
import {
	createContext,
	createElement,
	useContext,
	useEffect,
	useRef,
	useState,
} from 'react';
import type { HTMLAttributes, ReactElement, ReactNode, RefObject } from 'react';
import { createSlider } from './index.js';
import type { Options, Slider } from './index.js';

/**
 * @param options Options of the slider, with its plugins.
 * @param remake The slider is made again when one of these changes, as the
 *               dependencies of an effect. It stays at its slide.
 * @return The ref for the element of the slider, and the slider once it is
 *         made.
 */
export function useSlider(
	options: Options = {},
	remake: unknown[] = []
	// Any element: the ref is the one of the element it is given to.
): [ RefObject< any >, Slider | null ] {
	const ref = useRef< HTMLElement >( null );
	const at = useRef( options.start || 0 );
	const [ slider, set ] = useState< Slider | null >( null );
	useEffect( () => {
		const made = createSlider( ref.current!, {
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
	'ease',
	'start',
	'drag',
];

const Around = createContext< Slider | null >( null );

/**
 * @return The slider of the
 *         `<Slider>` this component is in, once it is made. The component
 *         is rendered again when the slider goes to another snap, or has
 *         measured: what it reads of the slider is what is.
 */
export function useSliderContext(): Slider | null {
	const slider = useContext( Around );
	const [ , again ] = useState( {} );
	useEffect( () => {
		const off = [ 'change', 'measure' ].map( ( name ) =>
			slider?.on( name, () => again( {} ) )
		);
		return () => off.forEach( ( fn ) => fn?.() );
	}, [ slider ] );
	return slider;
}

const named = ( name: string, more?: string ) => ( more ? name + ' ' + more : name );

/**
 * What a `<Slider>` takes that is neither an option of the slider nor an
 * attribute of its element.
 */
export interface Own {
	/** Its element, `div` when nothing is said. */
	as?: string;
	/** What is in the slider beside its slides: arrows, a caption. */
	around?: ReactNode;
	/**
	 * The slider is made again when one of these changes: for other
	 * plugins. It stays at its slide.
	 */
	remake?: unknown[];
	/** The snap to be at: the slider goes there when this changes. */
	index?: number;
	/** The snap the slider goes to. */
	onChange?: ( index: number, slider: Slider ) => void;
	/** The snap it came to rest at. */
	onSettle?: ( index: number, slider: Slider ) => void;
	/** The slider when it is made, and null when it ends. */
	onSlider?: ( slider: Slider | null ) => void;
}

/** The props of a `<Slider>`. */
export type SliderProps = Omit< Options, 'on' > &
	Omit< HTMLAttributes< HTMLElement >, 'onChange' > &
	Own & { on?: Record< string, Function > };

/**
 * A slider: its element, its track, and the slides that are its children.
 *
 * Options of the slider are props, and a change of one changes the slider
 * that exists. Plugins are read when the slider is made; listeners are
 * the ones of the last render. Every other prop is an attribute of the
 * element.
 *
 * @param props
 *        Props.
 * @return Element.
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
}: SliderProps ): ReactElement {
	const options: Record< string, unknown > = {};
	const given: Record< string, unknown > = rest;
	OPTIONS.forEach( ( name ) => {
		if ( name in given ) {
			options[ name ] = given[ name ];
			delete given[ name ];
		}
	} );
	// The listeners of the last render.
	const heard = useRef< Record< string, any > >( {} );
	// The slider tells when it is there and when it ends, as it tells the
	// rest.
	heard.current = {
		on,
		change: onChange,
		settle: onSettle,
		ready: onSlider,
		destroy: () => onSlider?.( null ),
	};
	const [ ref, slider ] = useSlider(
		{
			...options,
			plugins,
			on: {
				'*': ( name: string, ...said: [ unknown, Slider ] ) => {
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
		if ( slider && ( index as number ) >= 0 && index !== slider.index ) {
			slider.to( index! );
		}
	}, [ slider, index ] );
	return createElement(
		Around.Provider,
		{ value: slider },
		createElement(
			as,
			{ ...given, ref, className: named( 'gs', className ) },
			createElement( 'div', { className: 'gs-track' }, children ),
			around
		)
	);
}

/**
 * A slide of a `<Slider>`. Its image or film has the class `gs-media`.
 *
 * @param props
 *        Props: `as` is its element, `div` when nothing is said.
 * @return Element.
 */
export const Slide = ( { as = 'div', className, ...rest }: HTMLAttributes< HTMLElement > & { as?: string } ): ReactElement =>
	createElement( as, { ...rest, className: named( 'gs-slide', className ) } );
