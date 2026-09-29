import { useState, type CSSProperties } from 'react';
import { Slider, Slide, useSliderContext } from 'shaderslide/react';
import { keyboard } from 'shaderslide/plugins';
import { canvas } from 'shaderslide/canvas';
import { stretch } from 'shaderslide/effects';
import { BUTTON } from '@/components/Frame';
import { image } from '@/lib/media';

const PHOTOS = [ 2, 4, 6, 8, 1, 3 ];

/** An arrow that has the slider from the `<Slider>` it is in. */
function Arrow( { to }: { to: 'prev' | 'next' } ) {
	const slider = useSliderContext();
	return (
		<button
			type="button"
			className="arrow"
			data-ss-prev={ to === 'prev' ? '' : undefined }
			data-ss-next={ to === 'next' ? '' : undefined }
			aria-label={ to === 'prev' ? 'Previous slide' : 'Next slide' }
			disabled={ ! ( to === 'prev' ? slider?.canPrev : slider?.canNext ) }
			onClick={ () => slider?.[ to ]() }
		>
			{ to === 'prev' ? '‹' : '›' }
		</button>
	);
}

/** The components: options are props, and state of React moves the slider. */
export default function InReact() {
	const [ loop, setLoop ] = useState( false );
	const [ at, setAt ] = useState( 0 );
	return (
		<>
			<Slider
				id="react"
				className="cards"
				style={ { '--ss-per-view': 3, '--ss-gap': '16px' } as CSSProperties }
				aria-label="Photos"
				loop={ loop }
				index={ at }
				onChange={ setAt }
				onSlider={ ( slider ) => {
					const names = window as unknown as {
						sliders: Record< string, unknown >;
					};
					names.sliders = { ...names.sliders, react: slider };
				} }
				plugins={ [ keyboard(), canvas( { effects: [ stretch() ] } ) ] }
				around={
					<>
						<Arrow to="prev" />
						<Arrow to="next" />
					</>
				}
			>
				{ PHOTOS.map( ( n ) => (
					<Slide key={ n } className="card wide">
						<img
							className="ss-media"
							{ ...image( n ) }
							sizes="(max-width: 640px) 77vw, 30vw"
							alt={ `Colour field ${ n }` }
							loading="lazy"
							draggable={ false }
						/>
					</Slide>
				) ) }
			</Slider>
			<div className="flex flex-wrap items-center gap-2" data-testid="react">
				<button
					type="button"
					className={ BUTTON }
					aria-pressed={ loop }
					onClick={ () => setLoop( ! loop ) }
				>
					loop
				</button>
				{ [ 0, 2, 4 ].map( ( to ) => (
					<button
						key={ to }
						type="button"
						className={ BUTTON }
						aria-current={ at === to ? 'true' : undefined }
						onClick={ () => setAt( to ) }
					>
						To { to + 1 }
					</button>
				) ) }
				<output className="font-mono text-xs text-muted-foreground">
					{ at + 1 } of { PHOTOS.length }
				</output>
			</div>
			<p className="note">
				<code>&lt;Slider&gt;</code> and <code>&lt;Slide&gt;</code>. The arrows
				are components in it that have the slider by{ ' ' }
				<code>useSliderContext()</code>; <code>loop</code> is a prop that
				changes the slider that exists; the buttons set state of React, and{ ' ' }
				<code>index</code> moves the slider there.
			</p>
		</>
	);
}
