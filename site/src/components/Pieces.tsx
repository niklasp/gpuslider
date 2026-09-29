/**
 * Sliders with something around them, for more than one page of the
 * site: photos with thumbnails, pictures that load again, and the list
 * of what a slider said.
 */
import {
	useCallback,
	useEffect,
	useState,
	type RefObject,
} from 'react';
import { GpuSlider, Slide, Thumbs } from '@/components/GpuSlider';
import { BUTTON } from '@/components/Frame';
import { image, photo, useKind } from '@/lib/media';
import type { Slider } from 'gpuslider';
import { loading } from 'gpuslider/plugins';

export type Tell = RefObject< ( ( line: string ) => void ) | null >;

/**
 * What a slider said last. It keeps its lines to itself: the page around
 * it is not rendered again for every event of a slider.
 */
export function Events( { tell }: { tell: Tell } ) {
	const [ log, setLog ] = useState< string[] >( [] );
	useEffect( () => {
		tell.current = ( line ) =>
			setLog( ( now ) => [ line, ...now ].slice( 0, 8 ) );
		return () => {
			tell.current = null;
		};
	}, [ tell ] );
	return (
		<ol
			data-testid="events"
			aria-label="Events"
			className="sq-tile min-h-44 bg-card p-4 font-mono text-xs leading-5 text-muted-foreground"
		>
			{ log.map( ( line, i ) => (
				<li key={ log.length - i } className="first:text-foreground">
					{ line }
				</li>
			) ) }
		</ol>
	);
}

export type PhotosProps = Pick<
	Parameters< typeof GpuSlider >[ 0 ],
	'options' | 'style' | 'made' | 'measured' | 'plugins' | 'className'
>;

/**
 * A slider and its thumbnails. It keeps the slider to itself: the page
 * around it is not rendered again when the slider is made.
 */
export function Photos( props: PhotosProps ) {
	const [ photos, setPhotos ] = useState< Slider | null >( null );
	const images = [ 3, 5, 7, 1, 8, 2, 6, 4 ];
	return (
		<div className="grid max-w-4xl gap-3">
			<GpuSlider
				id="photos"
				label="Photos"
				onSlider={ setPhotos }
				{ ...props }
			>
				{ images.map( ( n ) => (
					<Slide
						key={ n }
						image={ n }
						alt={ `Colour field ${ n }` }
						className="photo"
						sizes="(min-width: 900px) 896px, 100vw"
					/>
				) ) }
			</GpuSlider>
			<Thumbs id="thumbs" label="Thumbnails of the photos" of={ photos }>
				{ images.map( ( n ) => (
					<Slide
						key={ n }
						image={ n }
						alt={ `Colour field ${ n }` }
						className="thumb"
						sizes="150px"
					/>
				) ) }
			</Thumbs>
		</div>
	);
}

/**
 * A slider that shows a screen while its pictures load, and says what
 * `loading()` tells. The pictures of the page are there already: they are
 * asked for again, under another address.
 */
export function Loads( props: PhotosProps ) {
	const [ again, setAgain ] = useState( 0 );
	const kind = useKind();
	const [ said, setSaid ] = useState< string[] >( [] );
	const heard = useCallback( ( name: string, detail: unknown ) => {
		if ( name.startsWith( 'loading:' ) ) {
			const { loaded, failed, total, time } = detail as Record<
				string,
				number
			>;
			setSaid( ( now ) =>
				[
					`${ name } · ${ loaded + failed } of ${ total }` +
						( time === undefined ? '' : ` · ${ time } ms` ),
					...now,
				].slice( 0, 8 )
			);
		}
	}, [] );
	return (
		<div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
			<GpuSlider
				id="loads"
				label="Pictures that load"
				className="cards"
				{ ...props }
				made={ `${ props.made } ${ again }` }
				heard={ heard }
				plugins={ () => [
					...props.plugins(),
					// Not with the page: its first view is not to wait.
					...( again ? [ loading( { min: 700 } ) ] : [] ),
				] }
			>
				{ [ 7, 2, 5, 4, 1, 6 ].map( ( n ) => (
					<div className="gs-slide card wide" key={ n }>
						<img
							className="gs-media"
							{ ...image( n, kind ) }
							srcSet={ undefined }
							src={ `${ image( n, kind ).src }${
								again ? `?again=${ again }` : ''
							}` }
							alt={ kind === 'photos' ? photo( n ).alt : `Colour field ${ n }` }
							draggable={ false }
							loading="lazy"
						/>
					</div>
				) ) }
			</GpuSlider>
			<div className="grid content-start gap-4">
				<div>
					<button
						type="button"
						className={ BUTTON }
						onClick={ () => {
							setSaid( [] );
							setAgain( again + 1 );
						} }
					>
						Load them again
					</button>
				</div>
				<ol
					data-testid="loaded"
					aria-label="What the loading said"
					className="sq-tile min-h-44 bg-card p-4 font-mono text-xs leading-5 text-muted-foreground"
				>
					{ said.map( ( line, i ) => (
						<li key={ said.length - i } className="first:text-foreground">
							{ line }
						</li>
					) ) }
				</ol>
			</div>
		</div>
	);
}
