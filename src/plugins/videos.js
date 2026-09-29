/**
 * Videos play while their slide is in view and the slider on the screen,
 * and only then.
 *
 * Videos that start by themselves (`autoplay`) would do so wherever they
 * are: the plugin starts them instead. A video the visitor has stopped
 * stays stopped.
 *
 * And they would load wherever they are. One that says `preload="none"`
 * is loaded when its slide comes into view, and not before: what the
 * browser has begun for `autoplay` is taken back.
 */
import { onScreen } from './screen.js';

export function videos() {
	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		let seen = true;
		let found = [];
		let playing = [];
		let self = [];
		// Videos to start again when their slide comes back.
		const resume = new WeakSet();

		const give = () =>
			self.forEach( ( video ) => {
				video.autoplay = true;
			} );
		const read = () => {
			give();
			found = slider.slides.map( ( slide ) => [
				...slide.querySelectorAll( 'video' ),
			] );
			playing = [];
			self = found.flat().filter( ( video ) => video.autoplay );
			self.forEach( ( video ) => {
				video.autoplay = false;
				video.pause();
				resume.add( video );
				if ( video.preload === 'none' && video.readyState < 2 ) {
					video.load();
				}
			} );
		};
		read();

		const unwatch = onScreen( slider, ( on ) => {
			seen = on;
			slider.wake();
		} );

		return {
			name: 'videos',
			slides: read,

			frame( { places } ) {
				found.forEach( ( here, i ) => {
					const on = seen && places[ i ].visible;
					if ( ! here.length || on === playing[ i ] ) {
						return;
					}
					playing[ i ] = on;
					here.forEach( ( video ) => {
						if ( ! on ) {
							if ( ! video.paused ) {
								resume.add( video );
								video.pause();
							}
						} else if ( resume.has( video ) ) {
							resume.delete( video );
							// Refused without a gesture, unless it is muted.
							video.play()?.catch( () => {} );
						}
					} );
				} );
			},

			destroy() {
				unwatch();
				give();
			},
		};
	};
}
