import { useRef, useState } from 'react';
import { focusOf, image, useKind } from '@/lib/media';

type Point = { x: number; y: number };

type Props = {
	/** The focus points of the pictures, by their numbers. */
	value: Record< number, Point >;
	onChange: ( value: Record< number, Point > ) => void;
};

/** The pictures that have a focus point to set. */
const PICTURES = [ 1, 2, 3, 4, 5, 6, 7, 8 ];

/**
 * Sets the focus point of a picture: the point of it that stays in view
 * when it is cut, on every slide that shows it. Pick the picture, then
 * click or drag on it; arrow keys move the point too.
 */
export function FocusPad( { value, onChange }: Props ) {
	const pad = useRef< HTMLDivElement >( null );
	const kind = useKind();
	const [ n, setN ] = useState( 1 );
	const point = value[ n ] ?? focusOf( n, kind );
	const small = ( of: number ) => image( of, kind ).src.replace( '-960.', '-480.' );
	const set = ( to: Point ) => onChange( { ...value, [ n ]: to } );

	const from = ( event: React.PointerEvent ) => {
		const box = pad.current!.getBoundingClientRect();
		const share = ( at: number, size: number ) =>
			Math.round( Math.min( 1, Math.max( 0, at / size ) ) * 100 );
		set( {
			x: share( event.clientX - box.left, box.width ),
			y: share( event.clientY - box.top, box.height ),
		} );
	};

	const key = ( event: React.KeyboardEvent ) => {
		const step = event.shiftKey ? 10 : 2;
		const by = {
			ArrowLeft: [ -step, 0 ],
			ArrowRight: [ step, 0 ],
			ArrowUp: [ 0, -step ],
			ArrowDown: [ 0, step ],
		}[ event.key ];
		if ( by ) {
			event.preventDefault();
			set( {
				x: Math.min( 100, Math.max( 0, point.x + by[ 0 ] ) ),
				y: Math.min( 100, Math.max( 0, point.y + by[ 1 ] ) ),
			} );
		}
	};

	return (
		<div className="grid w-56 gap-2">
			<div role="group" aria-label="Picture" className="grid grid-cols-8 gap-1">
				{ PICTURES.map( ( one ) => (
					<button
						key={ one }
						type="button"
						aria-label={ `Picture ${ one }` }
						aria-pressed={ one === n }
						onClick={ () => setN( one ) }
						className="aspect-square cursor-pointer overflow-hidden sq-knob bg-cover bg-center opacity-50 ring-white transition hover:opacity-80 aria-pressed:opacity-100 aria-pressed:ring-2"
						style={ { backgroundImage: `url(${ small( one ) })` } }
					/>
				) ) }
			</div>
			{ /* The whole picture, not cut, and the pad as large as it: the point
				is on what there is. */ }
			<div
				ref={ pad }
				role="slider"
				tabIndex={ 0 }
				aria-label={ `Focus point of picture ${ n }` }
				aria-valuetext={ `${ point.x }% from the left, ${ point.y }% from the top` }
				aria-valuenow={ point.x }
				data-testid="focus-pad"
				className="relative w-fit cursor-crosshair touch-none justify-self-center overflow-hidden sq-knob outline-none focus-visible:ring-2 focus-visible:ring-ring"
				onPointerDown={ ( event ) => {
					event.currentTarget.setPointerCapture( event.pointerId );
					from( event );
				} }
				onPointerMove={ ( event ) => {
					if ( event.buttons ) {
						from( event );
					}
				} }
				onKeyDown={ key }
			>
				<img src={ small( n ) } alt="" draggable={ false } className="block max-h-56 max-w-full" />
				<span
					className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/30 shadow-[0_0_0_1px_rgb(0_0_0/0.6)]"
					style={ { left: `${ point.x }%`, top: `${ point.y }%` } }
				/>
			</div>
			<p className="font-mono text-xs text-muted-foreground">
				--gs-focus: { point.x }% { point.y }%
			</p>
		</div>
	);
}
