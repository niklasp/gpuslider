/**
 * Waits for the media of a slider, shows a screen meanwhile, and says how
 * far it is.
 *
 *     createSlider( element, { plugins: [ loading() ] } );
 *
 * The screen is the element that is given, or the one with the class
 * `ss-loading` in the slider, or one that is made: a number and a line,
 * styled by `loading.css`. It is told how far the loading is:
 *
 *     --ss-loaded         0 to 1, on the screen
 *     [data-ss-loaded]    elements in it whose text is the number, 0 to 100
 *     .ss-loaded          the class of the screen when all is there
 *
 * The slider has the class `ss-is-loading` meanwhile. With `screen: false`
 * there is none, and what is shown is up to who listens:
 *
 *     loading:start       { total }
 *     loading:progress    { loaded, failed, total, progress, media }
 *     loading:done        { loaded, failed, total, progress, time, late }
 *
 * Media that fail count as the others: `failed` says how many. `late`
 * says that the time was over before everything was there.
 *
 * Images that wait for their place to come near (`loading="lazy"`) are
 * told to load now, and videos to load their first picture: a slider
 * that waits for them would wait for ever.
 *
 * Several sliders count together when they are given the same plugin:
 *
 *     const together = loading( { screen: element } );
 *     createSlider( one, { plugins: [ together ] } );
 *     createSlider( two, { plugins: [ together ] } );
 */

/**
 * @param {Object}                  [options]         Options.
 * @param {Element | false}         [options.screen]  The screen; false for
 *                                                    none.
 * @param {number}                  [options.min]     The least time the
 *                                                    screen is shown, ms.
 * @param {number}                  [options.timeout] The time after which
 *                                                    it is done with what
 *                                                    is there, ms. 0: no
 *                                                    such time.
 * @param {Array<Promise<unknown>>} [options.also]    What else is waited
 *                                                    for, and counted:
 *                                                    fonts, data. The
 *                                                    plugin is for a
 *                                                    slider that is made
 *                                                    now: what is kept
 *                                                    before there is one
 *                                                    is told to nobody.
 */
export function loading( {
	screen,
	min = 0,
	timeout = 10000,
	also = [],
} = {} ) {
	const sliders = new Set();
	const screens = new Set();
	const seen = new WeakSet();
	const state = { loaded: 0, failed: 0, total: 0, progress: 0 };
	let began = 0;
	let done = false;
	// The window of the sliders.
	let page;
	let finish;
	const ready = new Promise( ( resolve ) => {
		finish = resolve;
	} );

	const tell = ( name, detail ) =>
		sliders.forEach( ( slider ) =>
			slider.emit( `loading:${ name }`, { ...state, ...detail } )
		);

	const show = () =>
		screens.forEach( ( element ) => {
			const percent = Math.round( state.progress * 100 );
			element.style.setProperty( '--ss-loaded', state.progress );
			element.setAttribute( 'aria-valuenow', percent );
			element.classList.toggle( 'ss-loaded', done );
			element
				.querySelectorAll( '[data-ss-loaded]' )
				.forEach( ( number ) => {
					number.textContent = percent;
				} );
		} );

	const end = ( late ) => {
		if ( done ) {
			return;
		}
		done = true;
		const time = Date.now() - began;
		( page || globalThis ).setTimeout(
			() => {
				sliders.forEach( ( { root } ) =>
					root.classList.remove( 'ss-is-loading' )
				);
				show();
				tell( 'done', { time, late } );
				finish( state );
			},
			Math.max( 0, min - time )
		);
	};

	const wait = ( thing, media ) => {
		state.total++;
		const count = ( failed ) => {
			if ( done ) {
				return;
			}
			state[ failed ? 'failed' : 'loaded' ]++;
			state.progress = ( state.loaded + state.failed ) / state.total;
			show();
			tell( 'progress', { media } );
			if ( state.progress === 1 ) {
				end( false );
			}
		};
		thing.then(
			() => count( false ),
			() => count( true )
		);
	};

	const follow = ( { root } ) =>
		root.querySelectorAll( '.ss-media' ).forEach( ( media ) => {
			if ( seen.has( media ) || done ) {
				return;
			}
			seen.add( media );
			if ( media.tagName === 'VIDEO' ) {
				media.preload = 'auto';
				wait(
					new Promise( ( resolve, reject ) => {
						if ( media.readyState > 1 ) {
							resolve();
						}
						media.addEventListener( 'loadeddata', resolve );
						media.addEventListener( 'error', reject );
					} ),
					media
				);
			} else if ( media.decode ) {
				media.loading = 'eager';
				wait( media.decode(), media );
			}
		} );

	also.forEach( ( thing ) => wait( thing ) );

	// The plugin, for the `plugins` of a slider.
	return ( /** @type {import('../index.js').Slider} */ slider ) => {
		const { root, win } = slider;
		if ( ! done ) {
			root.classList.add( 'ss-is-loading' );
		}
		if ( ! sliders.size ) {
			page = win;
			began = Date.now();
			if ( timeout ) {
				win.setTimeout( () => end( true ), timeout );
			}
			// Who listens does so when the slider is made.
			win.queueMicrotask( () => {
				tell( 'start' );
				if ( ! state.total ) {
					state.progress = 1;
					end( false );
				}
			} );
		}
		sliders.add( slider );

		let made;
		if ( screen !== false ) {
			let element = screen || root.querySelector( '.ss-loading' );
			if ( ! element ) {
				element = made = root.ownerDocument.createElement( 'div' );
				made.className = 'ss-loading';
				made.innerHTML = '<span><span data-ss-loaded></span> %</span>';
				root.append( made );
			}
			if ( ! element.role ) {
				element.role = 'progressbar';
				element.ariaLabel ||= 'Loading';
			}
			screens.add( element );
		}
		follow( slider );
		show();

		return {
			name: 'loading',
			slides: () => follow( slider ),

			/** What is there, what failed and what is waited for. */
			state,
			/** Whether the loading is over. */
			get done() {
				return done;
			},
			/** Is kept when the loading is over. */
			ready,

			destroy() {
				sliders.delete( slider );
				root.classList.remove( 'ss-is-loading' );
				made?.remove();
				screens.delete( made );
			},
		};
	};
}
