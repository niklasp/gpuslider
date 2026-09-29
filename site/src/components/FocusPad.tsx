import { useRef } from 'react';

type Props = {
	value: { x: number; y: number };
	onChange: ( value: { x: number; y: number } ) => void;
	image: string;
};

/**
 * Sets the focus point: the point of an image that stays in view when the
 * image is cut. Click or drag on the picture; arrow keys move it too.
 */
export function FocusPad( { value, onChange, image }: Props ) {
	const pad = useRef< HTMLDivElement >( null );

	const from = ( event: React.PointerEvent ) => {
		const box = pad.current!.getBoundingClientRect();
		const share = ( at: number, size: number ) =>
			Math.round( Math.min( 1, Math.max( 0, at / size ) ) * 100 );
		onChange( {
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
			onChange( {
				x: Math.min( 100, Math.max( 0, value.x + by[ 0 ] ) ),
				y: Math.min( 100, Math.max( 0, value.y + by[ 1 ] ) ),
			} );
		}
	};

	return (
		<div className="grid gap-2">
			<div
				ref={ pad }
				role="slider"
				tabIndex={ 0 }
				aria-label="Focus point"
				aria-valuetext={ `${ value.x }% from the left, ${ value.y }% from the top` }
				aria-valuenow={ value.x }
				data-testid="focus-pad"
				className="relative aspect-video w-56 cursor-crosshair touch-none overflow-hidden rounded-md bg-cover bg-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
				style={ { backgroundImage: `url(${ image })` } }
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
				<span
					className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/30 shadow-[0_0_0_1px_rgb(0_0_0/0.6)]"
					style={ { left: `${ value.x }%`, top: `${ value.y }%` } }
				/>
			</div>
			<p className="font-mono text-xs text-muted-foreground">
				--gs-focus: { value.x }% { value.y }%
			</p>
		</div>
	);
}
