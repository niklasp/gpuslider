# gpu slider

A slider that draws its media on a canvas and owns its own motion: with WebGPU where the browser has it, with WebGL 2 where not.
No dependencies.

The plan, with every decision and its reason, is in [PLAN.md](PLAN.md).

## Run it

```sh
npm install
npm start          # http://localhost:4173/bench/: the two layers, measured
npm test           # Chromium, Firefox and WebKit
npm run test:gpu   # the same, drawn by WebGPU: Chromium and WebKit
npm run bench      # WebGPU and WebGL, measured against each other
npm run site       # the site with everything in it, http://localhost:5183/
npm run size       # gzipped sizes, fails over budget; builds dist/
npm run test:dist  # the tests, with what is built
npm run types      # type declarations from the JSDoc, and a file that uses them
npm run media      # generates the images and videos in media/ again
node bin/make-film.mjs <video>  # the film of the site: a loop of a video of Pexels
npm run media:wall # generates the pictures of the wall again
npm run shots      # takes the pictures of the examples again; the site has to run
npm run lighthouse # builds the site and asks Lighthouse about its pages
```

## The site

`npm run site`, http://localhost:5183/: a site of Vite and React. What is to be seen of the library is there, and nowhere else.

| | |
|---|---|
| `/` | What the library is: what it does, what it weighs, how fast it is, and where to go from there |
| `/docs/` | The docs, in eleven pages. What they say is this README, cut into pages when the site is built (`site/docs.ts`): it is said in one place. Most pages show what they say, with sliders to try it on |
| `/examples/` | The three pages below, with a picture each |
| `/examples/wall/` | A wall of glass without an end in any direction. Every row is a slider, the rows are the slides of a slider that goes down, the page takes the pointer and moves both. `dome`, `jelly`, `slab`, and a screen with a mark that is drawn while the pictures load |
| `/examples/reel/` | One picture or film at a time, as large as the screen, that turn into each other. The screen before it is made of the events of `loading()`: a number that runs, a curtain that goes up |
| `/examples/tape/` | Rows that run against each other on a page that scrolls. The scrolling pushes them, and what is pushed gives way. The loading screen is the one of the library |
| `/playground/` | Every layout, every effect and transition, the lightbox, the loading screen, buttons anywhere and the events, with controls for all of it. Under every slider: who draws it, and what a frame costs |
| `/phone/` | To be opened on a phone: what it has, what a finger is to try, and a measuring of both layers. What it finds is text to copy |

`?layer=gl` and `?layer=gpu` on the examples say who draws.

`npm run phone` builds the site and serves it to a phone in the same network, with https (WebGPU asks for it) and a certificate that nobody has signed: the phone warns once.

No number of the site is written by hand. The sizes are written by `npm run size`, the times by `npm run bench -- --write`, what Lighthouse says by `npm run lighthouse`, all into `site/src/lib/`.

`bench/` is a page without a build, for `npm run bench` and for the browser that opens it: `npm start`, http://localhost:4173/bench/.

## Use it

Three ways, from the least to write to the least to load.

### Without a script of your own

```html
<link rel="stylesheet" href="…/gpuslider/dist/style.css">
<script type="module" src="…/gpuslider/dist/auto.js"></script>

<div class="gs" aria-label="Photos"
	data-gs='{ "loop": true, "autoplay": 4000 }'
	data-gs-canvas="stretch waves">
	<div class="gs-track">
		<div class="gs-slide">
			<img class="gs-media" src="one.jpg" alt="…">
			<div class="gs-content">Anything: headings, links, buttons.</div>
		</div>
		<div class="gs-slide">
			<video class="gs-media" src="two.mp4" muted playsinline loop autoplay></video>
		</div>
	</div>
	<button data-gs-prev aria-label="Previous slide">‹</button>
	<button data-gs-next aria-label="Next slide">›</button>
	<button data-gs-pause aria-label="Pause autoplay"></button>
	<div data-gs-dots></div>
</div>
```

| Attribute | |
|---|---|
| `data-gs` | Makes the element a slider. Its value: the options of `gpuslider/full` as JSON, or nothing |
| `data-gs-canvas` | The canvas, with the effects that are named: `"stretch waves"`, or with their options `'{ "stretch": { "amount": 2 } }'`. Drawn by WebGPU where the browser has it, by WebGL 2 where not |
| `data-gs-gpu`, `data-gs-gl` | The same, by the one that is named or by the page |
| `data-gs-lightbox` | A lightbox, drawn by the canvas of the slider, which it gives the slider if it has none. Needs `dist/lightbox.css` |
| `data-gs-loading` | A screen while the media load, with the options of `loading()` as JSON, or nothing. Needs `dist/loading.css` |

`auto.js` is one file of 8.2 KB. The canvas and the lightbox are loaded when a slider asks for them and the page has time; a page without them never loads them.

The element tells when its slider is made: `gs:ready`, with the slider as `detail`, goes up to the document. For elements that come later, `import { auto, sliders } from '…/auto.js'` and call `auto()`; `sliders.get( element )` is the slider.

### With all options

```js
import { createSlider } from 'gpuslider/full';
import { canvas } from 'gpuslider/canvas';
import { stretch, split } from 'gpuslider/effects';
import 'gpuslider/style.css';

const slider = createSlider( document.querySelector( '.gs' ), {
	loop: true,
	autoplay: 4000,
	plugins: [ canvas( { effects: [ stretch(), split() ] } ) ],
} );
```

`gpuslider/full` is the core with arrows, dots, keys, the wheel, videos, autoplay, auto height and the stack, switched by options: 7.0 KB.

### With what you name, and no more

```js
import { createSlider } from 'gpuslider';
import { controls, keyboard } from 'gpuslider/plugins';

createSlider( element, { loop: true, plugins: [ controls(), keyboard() ] } );
```

The core moves slides: it measures, drags, snaps, loops, and says what happens. It is 4.6 KB. Everything else is a plugin, and what is not imported is not in the bundle: every entry has named exports only and no side effects.

### In React

```jsx
import { Slider, Slide } from 'gpuslider/react';
import { controls } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { stretch } from 'gpuslider/effects';
import 'gpuslider/style.css';

function Photos( { photos, loop } ) {
	return (
		<Slider
			loop={ loop }
			plugins={ [ controls(), canvas( { effects: [ stretch() ] } ) ] }
			onChange={ ( index ) => console.log( index ) }
			aria-label="Photos"
		>
			{ photos.map( ( photo ) => (
				<Slide key={ photo.src }>
					<img className="gs-media" { ...photo } />
				</Slide>
			) ) }
		</Slider>
	);
}
```

`<Slider>` is the element of the slider with its track, `<Slide>` a slide. Slides that React adds or removes are seen by the slider.

| Prop of `<Slider>` | |
|---|---|
| `loop`, `align`, `axis`, `free`, `duration` and the other [options](#options) of the core | A change of one changes the slider that exists |
| `plugins` | Read when the slider is made. Written in the JSX they cost nothing: they are not what it is made again for |
| `remake` | A list, as the dependencies of an effect: the slider is made again when one of them changes, and stays at its slide. For other plugins or effects |
| `index` | The snap to be at. The slider goes there when it changes |
| `onChange`, `onSettle` | `( index, slider )` |
| `on` | Listeners for every other [event](#events), by its name: `{ 'lightbox:open': … }` |
| `onSlider` | Is given the slider when it is made, and `null` when it ends |
| `around` | What is in the slider beside its slides: arrows of your own, a caption |
| `as` | Its element, `div` when nothing is said. `<Slide>` has it too |
| `className`, `style`, `id`, `aria-label` and every other attribute | Of its element. `className="gs-stack"` for a [stack](#plugins-that-come-with-it) |

How many slides are in view and how far they are apart is CSS here as everywhere, see [Layout is CSS](#layout-is-css): `--gs-per-view` and `--gs-gap` in a class or in `style`.

A component in a `<Slider>` has the slider by `useSliderContext()`, and is rendered again when the slider goes to another snap:

```jsx
import { useSliderContext } from 'gpuslider/react';

function Next() {
	const slider = useSliderContext();
	return (
		<button disabled={ ! slider?.canNext } onClick={ () => slider.next() }>
			On
		</button>
	);
}

<Slider around={ <Next /> }>…</Slider>
```

With markup of your own there is the hook the components are made of:

```jsx
import { useSlider } from 'gpuslider/react';

const [ ref, slider ] = useSlider( { loop, plugins: [ controls() ] }, [ loop ] );

<div className="gs" ref={ ref }>
	<div className="gs-track">…</div>
</div>
```

Its second argument is what the slider is made again for.

The components add 0.6 KB to the core, the hook alone 0.1 KB. The page above without the canvas is 5.7 KB in the bundle, arrows and dots in it; with the canvas and `stretch` it is 12.5 KB.

### Three tiers

Without the script the slider is a native scroller with scroll-snap.
Without the canvas, or in a browser that has neither WebGPU nor WebGL 2, the page draws the slides and everything else works the same.
With it the canvas draws the media, and the text stays HTML on top of it.

## Layout is CSS

The script measures what the page lays out, so responsive settings are media queries:

```css
.gs { --gs-per-view: 1.2; --gs-gap: 12px; }

@media (min-width: 960px) {
	.gs { --gs-per-view: 3; }
}
```

Give the slides a height, an `aspect-ratio`, or use `autoHeight()`.

### Downwards

```js
createSlider( element, { axis: 'y' } );
```

```css
.gs { height: 70vh; --gs-per-view: 1.5; }
```

The slides follow each other downwards: drag up and down, arrow up and down, the wheel as it is. At its ends the wheel scrolls the page. The slider needs a height. Effects are written for a row and are turned with the slider.

### Rows

Nothing of the script: a grid that flows in columns. A column is a snap.

```css
.gs-track {
	display: grid;
	grid-auto-flow: column;
	grid-template-rows: repeat( 2, 1fr );
	grid-auto-columns: calc( ( 100% - 2 * var(--gs-gap) ) / 3 );
	gap: var(--gs-gap);
}
```

## Options

Of the core:

| Option | Default | |
|---|---|---|
| `perView` | from CSS | Slides per view, fractions allowed; `'auto'` takes each slide's own width |
| `gap` | from CSS | px |
| `axis` | `'x'` | `'y'`: downwards |
| `loop` | `false` | Needs more slides than fit in the view, plus one |
| `align` | `'start'` | `'center'`, `'end'` |
| `group` | `1` | Slides per step |
| `contain` | `true` | No empty space at the ends |
| `free` | `false` | Rest anywhere, glide on after a drag |
| `duration` | `600` | ms of a move |
| `ease` | | curve of a move to a slide, `u => …` from 0 to 1 in `duration`, instead of the spring; a drag let go keeps the spring |
| `start` | `0` | First slide |
| `drag` | `true` | |
| `on` | | Listeners by the name of their event: `{ change: ( index ) => … }` |
| `plugins` | `[]` | See [Plugins that come with it](#plugins-that-come-with-it) |

Of `gpuslider/full`, and of `data-gs`, also:

| Option | Default | Is the plugin |
|---|---|---|
| `mode` | `'row'` | `'stack'`: `stack()` |
| `autoHeight` | `false` | `autoHeight()` |
| `autoplay` | `0` | ms per slide: `autoplay()` |
| `keyboard`, `wheel` | `true` | `keyboard()`, `wheel()` |
| `prev`, `next`, `pause`, `dots` | | Controls anywhere on the page: an element, several, or a selector |

## Plugins that come with it

From `gpuslider/plugins`. Each is 0.3 to 1 KB.

| Plugin | |
|---|---|
| `controls( { prev, next, dots } )` | Arrows, dots and `data-gs-to` buttons, in the slider or anywhere |
| `keyboard()` | Arrow keys, Home, End. Makes the slider focusable |
| `wheel()` | The wheel and two fingers on a trackpad, along the slider |
| `autoplay( 3500 )` | Goes on by itself. Waits for the pointer, the focus, the tab and the screen; `{ delay, hover: false }` does not wait for the pointer, `{ delay, left }` gives the first slide less time, for a slider made again that goes on where it was. `slider.plugins.autoplay.pause()`, `.play()`, `.paused` |
| `marquee( { speed, hover, scroll } )` | A ticker: runs evenly and without an end, slower under the pointer, faster while the page is scrolled. For `loop: true` |
| `thumbs( other )` | The slides are the buttons of another slider |
| `videos()` | Videos play while their slide is in view. One that says `preload="none"` is loaded when its slide comes into view, not before |
| `autoHeight()` | As high as the slides in view; the height follows the move |
| `stack()` | The slides on top of each other, for transitions. The images of the slide that is shown come first: with `loading="lazy"` the ones next to it wait for them, the others until they are next |
| `progress()` | Tells the slides where they are, for animations in CSS |
| `loading( { screen, min, timeout, also } )` | A screen while the media load, and events that say how far they are |

And `canvas()` from `gpuslider/canvas`, `lightbox()` from `gpuslider/lightbox`.

```js
import { marquee, thumbs } from 'gpuslider/plugins';

// A ticker whose pictures stretch while the page is scrolled.
createSlider( one, {
	loop: true,
	free: true,
	plugins: [ marquee( { speed: 50, hover: 0.2, scroll: 0.4 } ), canvas( { effects: [ stretch() ] } ) ],
} );

// Photos with thumbnails.
const photos = createSlider( two, { plugins: [ controls() ] } );
createSlider( three, { plugins: [ thumbs( photos ) ] } );
```

## API

| | |
|---|---|
| `next()`, `prev()` | |
| `to( index, { instant } )` | To a snap |
| `toSlide( index, { instant } )` | To the snap of a slide, when a snap has several |
| `index`, `previous`, `count()` | Snaps |
| `canNext`, `canPrev` | Whether there is a snap to go to |
| `progress` | 0 to 1 through the slides |
| `visible()` | Indexes of the slides in view |
| `resting` | Nothing moves, nothing is drawn |
| `set( options )` | Changes options of the slider that exists |
| `update()` | Measures again, after a change the slider cannot see |
| `use( plugin )` | Adds a plugin later |
| `plugins` | The plugins by their name: `slider.plugins.lightbox.open( 2 )` |
| `on( name, fn )`, `once( name, fn )` | Both return a function that removes the listener |
| `off( name, fn )`, `emit( name, detail )` | |
| `grab()`, `drag( position )`, `release( velocity )` | Move it as a pointer does |
| `shift( by, push )` | Moves it and where it is going by the same distance; as a push it counts as speed |
| `wake()` | Asks for a frame |
| `root`, `track`, `slides`, `options`, `layout()`, `motion`, `view`, `win`, `signal` | For plugins. `signal` ends with the slider: what listens with it needs no removing |
| `destroy()` | Gives the page back as it was |

Slides that are added to the track or removed from it are seen by the slider: render them with whatever renders your page.

## Events

Listeners get what the event says, then the slider.

```js
slider.on( 'change', ( index, slider ) => {} );
slider.on( '*', ( name, detail, slider ) => {} );
```

| Event | Says |
|---|---|
| `ready` | The slider. After the listeners that are added right after `createSlider()` |
| `change` | Index of the snap the slider goes to |
| `settle` | Index of the snap it came to rest at. Also after the slider was measured, when it has not moved |
| `visible` | Indexes of the slides in view, when they change |
| `dragstart`, `dragend` | The motion; the velocity it was let go with |
| `click` | `{ index, event }`. Not the click that ends a drag. A click on a slider that moves holds it, and is a click on the slide under it. The slide is the one that is seen: see [Effects](#effects) |
| `measure` | The layout, after every measuring |
| `slides` | The slides, after some were added or removed |
| `frame` | The view, on every frame of a move |
| `destroy` | The slider |
| `autoplay:play`, `autoplay:pause` | |
| `autoplay:run`, `autoplay:wait` | `{ delay, left }` when the time of a slide begins to run, `left` of `delay`; nothing when it stops before its end |
| `marquee:play`, `marquee:pause` | |
| `canvas:ready` | `canvas()` has chosen its layer: `'gpu'` or `'gl'` |
| `gpu:on`, `gpu:off`, `gl:on`, `gl:off` | The canvas took over, or gave the slides back to the page |
| `loading:start`, `loading:progress`, `loading:done` | `loading()`: how many media there are, how many of them are there, and that all are |
| `lightbox:open`, `lightbox:close` | Index of the slide |

Whether the slider is at an end: `canNext` and `canPrev`, at `change`.

## Buttons anywhere

In the slider, attributes are all it takes (see [Without a script of your own](#without-a-script-of-your-own)). Anywhere else, name the slider:

```html
<div class="gs" id="photos">…</div>

<nav data-gs-for="photos">
	<button data-gs-prev>Back</button>
	<button data-gs-next>On</button>
	<button data-gs-to="0">First</button>
	<div data-gs-dots></div>
</nav>
```

or hand them over:

```js
createSlider( element, {
	plugins: [ controls( { next: '.my-next', prev: document.querySelector( '.my-prev' ) } ) ],
} );
```

Arrows at an end are `disabled`, the dot and the `data-gs-to` of the active snap have `aria-current`. Buttons that are added later work too.

## Plugins

A plugin is a function that gets the slider and returns an object. Every member is optional.

```js
const counter = ( { every = 1 } = {} ) => ( slider ) => {
	let changes = 0;
	const off = slider.on( 'change', () => {
		if ( ++changes % every === 0 ) {
			slider.emit( 'counter:count', changes );
		}
	} );
	return {
		name: 'counter',            // slider.plugins.counter
		layout( measured ) {},      // may change what was measured, before it is used
		measure( view ) {},         // after every layout
		slides() {},                // slides were added or removed
		frame( view, dt, now ) {},  // every frame while something moves
		busy: () => false,          // true asks for another frame
		destroy: off,
		get changes() {             // and whatever else it has to offer
			return changes;
		},
	};
};

const slider = createSlider( element, { plugins: [ counter( { every: 2 } ) ] } );
slider.on( 'counter:count', ( changes ) => {} );
```

`view.places[ i ]` says where slide `i` is: `x` in px, `p` in slides from its resting place, `share` of it in view, `visible`.

### Animations

On the canvas an animation is an [effect](#effects): `coverflow()` turns the slides beside the active one.

On the page it is CSS. The `progress` plugin writes `--gs-p` (-1 is one slide before the active one), `--gs-away` (the same without the sign) and `--gs-share` on every slide, on every frame of a move:

```js
import { progress } from 'gpuslider/plugins';

createSlider( element, { align: 'center', plugins: [ progress() ] } );
```

```css
.gs-slide { perspective: 1200px; }
.gs-slide > * {
	rotate: y calc( var(--gs-p) * -45deg );
	scale: calc( 1 - var(--gs-away) * 0.2 );
}
```

Transform what is in the slide, not the slide: that one the slider moves and measures.

## Lightbox

```js
import { lightbox } from 'gpuslider/lightbox';
import 'gpuslider/lightbox.css';

createSlider( element, { plugins: [ canvas(), lightbox() ] } );
```

A click on a slide lets its image grow to the screen, Escape lets it go back. In the lightbox it can be dragged, and the arrows and the keys go to the next. `data-gs-full="large.jpg"` on the image names a larger file; `slider.plugins.lightbox.open( index )` and `.close()` do it from a script.

One canvas draws all of it: the one of the slider, which goes over the page while the lightbox is open. The image grows out of its slide as the slider draws it, with the effects of the slider, which fade on the way, and in the lightbox the images are drawn whole, from the file the browser picks for the screen. `punch: 0.4` lets the speed of the growing count as speed for the effects, so that an image with `stretch()` bows while it opens. Without a canvas the lightbox fades in.

## Loading

```js
import { loading } from 'gpuslider/plugins';
import 'gpuslider/loading.css';

createSlider( element, { plugins: [ loading() ] } );
```

The slider waits for its images and for the first picture of its videos, and shows a screen meanwhile: a number and a line. `loading.css` is its look, with `--gs-loading-back` and `--gs-loading-color` for its colours.

A screen of your own is an element with the class `gs-loading` in the slider, or any element of the page, given as `screen`. It is told how far the loading is, and what it makes of it is its own:

```html
<div class="gs-loading">
	<img src="logo.svg" alt="">
	<span data-gs-loaded></span> %
</div>
```

| | |
|---|---|
| `--gs-loaded` | On the screen: 0 to 1 |
| `[data-gs-loaded]` | Elements in the screen whose text is the number, 0 to 100 |
| `.gs-loaded` | The class of the screen when all is there. `loading.css` lets it fade |
| `.gs-is-loading` | The class of the slider meanwhile |

Or no screen, `screen: false`, and the events:

```js
createSlider( element, {
	plugins: [ loading( { screen: false } ) ],
	on: {
		'loading:start': ( { total } ) => {},
		'loading:progress': ( { loaded, failed, total, progress, media } ) => {},
		'loading:done': ( { loaded, failed, total, time, late } ) => {},
	},
} );
```

`slider.plugins.loading` has `state` (the same numbers), `done`, and `ready`: a promise that is kept when the loading is over.

| Option | Default | |
|---|---|---|
| `screen` | | An element, or `false` for none |
| `min` | `0` | The least time the screen is shown, ms: no screen that is gone before it was seen |
| `timeout` | `10000` | After this time it is done with what is there, and `late` is true. `0`: it waits for ever |
| `also` | `[]` | Promises that are waited for and counted as the media: `document.fonts.ready`, data |

Media that fail count as the others, and `failed` says how many: a picture that is missing does not keep the screen. Images with `loading="lazy"` are told to load at once, and videos to load their first picture, because a slider that waits for them would wait for ever; so `loading()` is for sliders at the top of a page, or for pages that are a slider.

Several sliders count together, with one screen, when they are given the same plugin:

```js
const together = loading( { screen: document.querySelector( '.intro' ) } );
createSlider( one, { plugins: [ together ] } );
createSlider( two, { plugins: [ together ] } );
```

A screen that is in the HTML is there before the script is. Without the script it would stay: `<noscript><style>.gs-loading { display: none }</style></noscript>`.

## Focus point

```css
.gs { --gs-focus: 30% 70%; }
```

What `object-position` is for an image: the point that stays in view when the image is cut. The canvas takes it from the page.

## The canvas

```js
import { canvas } from 'gpuslider/canvas';
import { stretch } from 'gpuslider/effects';

canvas( { effects: [ stretch() ], eager: false, density: 2, maxSize: 2048, perspective: 1200 } )
```

`canvas()` draws with WebGPU where the browser has it and with WebGL 2 where not. It is 0.3 KB, and loads the layer it takes when the page has time: no page loads the layer it does not draw with. Both layers draw the same picture from the same effects; the tests hold them against each other, effect by effect. `canvas:ready` says which one it is, and the layer is `slider.plugins.gpu` or `slider.plugins.gl`.

`canvas( { layer: 'gl' } )` and `layer: 'gpu'` say which. Who wants the layer in the bundle, and no request for it later, names it:

```js
import { gpu, stretch } from 'gpuslider/gpu';   // WebGPU, or the page draws
import { gl, stretch } from 'gpuslider/gl';     // WebGL 2, or the page draws
```

The canvas is made at the first sign of use: a pointer over the slider, a touch, the focus, a move. Until then the page draws the slides, which look the same, and the page has loaded without a context and without a shader. A slider that moves by itself (autoplay, a ticker), or whose effects show at rest, gets its canvas when the page has time. `eager: true` makes it with the slider.

Shaders are compiled on another thread where the browser can, and no frame is drawn while nothing moves.

### WebGPU and WebGL, measured

`npm run bench` makes the same sliders with each layer, in the same browser with the same GPU, and measures. On a Mac with an Apple M5, 2 device pixels per pixel, 2026-09-29, in Chromium 153 (Metal) and WebKit 26.6, both without a window, sliders with `stretch` and `waves`. The first two lines are the middle of five runs, the others are one run each:

| | WebGL 2 | WebGPU |
|---|---|---|
| The first slider of a page: drawn after | 82 ms in Chromium, 84 ms in WebKit | 64 ms, 80 ms |
| A slider after it | 50 ms, 51 ms | 33 ms, 33 ms |
| Four more, made together | 169 ms, 100 ms | 33 ms, 33 ms |
| Sliders of one page that the canvas draws | 12 | all: 20 of 20 |
| Script in a frame while 6 sliders move | 0.15 ms, 0.17 ms | 0.33 ms, 0.27 ms |
| Frames that came late while 20 sliders moved for 4 s | 0 of 241 | 0 of 241 |
| Work of the page and of the GPU process, 6 sliders (Chromium) | 10 % and 18 % of a core | 11 % and 18 % |
| The layer in the bundle | 7.0 KB | 9.0 KB |
| Browsers | all | Chrome, Edge, Safari from 26, Firefox on some systems: about 87 % of visitors |

What it says: WebGPU has one device for all sliders of a page, and a shader is made once for all of them. So the second slider is there in two frames, a page has as many sliders on the canvas as it likes, and nothing is taken away from one slider to give it to another. While the sliders move there is no difference to see: both draw every frame. WebGPU needs about twice the script for a frame, which for six sliders is 0.3 ms of the 16.7 that a frame has.

What it does not say: what the GPU does with a frame, which no page can measure; and how it is on a phone. `npm run bench -- --headed` measures with windows, `--write` writes the numbers for the site, `bench/` in a browser of your own shows the same numbers for that browser.

## Effects

Any number, in the order given.

| Effect | Does | Moves with |
|---|---|---|
| `stretch( { amount } )` | The middle of the image hangs back | Speed |
| `split( { amount } )` | The colours come apart | Speed |
| `parallax( { amount, zoom } )` | The image is slower than its slide; closer all round, so it keeps its shape | Position |
| `bend( { amount, speed } )` | The row is an arc; bends the mesh | Position and speed |
| `magnify( { size, strength } )` | A lens | Pointer |
| `cells( { size, zoom, reach } )` | Squares in the wake of the pointer, each its part closer; as far as the pointer is fast | Speed of the pointer |
| `spotlight( { size, dim } )` | The rest is dimmed | Pointer |
| `reveal( { size } )` | The images lose their colours, except around the pointer | Pointer |
| `glass( { size, lines, amount } )` | Fluted glass around the pointer | Pointer |
| `pixels( { size, cells } )` | Coarse pixels around the pointer | Pointer |
| `tilt( { angle } )` | The slide leans to the pointer; turns the mesh | Pointer |
| `waves( { size, amount, speed } )` | Rings run away from the pointer, while it is over the slider | Pointer and time |
| `smear( { size, amount } )` | The pointer drags the image along | Speed of the pointer |
| `shift( { size, amount } )` | The colours come apart along the way of the pointer | Speed of the pointer |
| `jelly( { amount, across } )` | The slides are soft: what moves them pulls them out of shape; bends the mesh | Speed |
| `slab( { edge, bend, spread, shine } )` | The slides are thick glass: the edge bends the image and takes its colours apart, one side has the light on it | Speed, a little |

Effects that lay out: the slider moves as ever, the effect says where a slide is drawn. For one slide per view or `align: 'center'`; give the slider padding for what leaves its place.

| Effect | Does |
|---|---|
| `coverflow( { angle, depth, range } )` | The slides beside the active one turn away |
| `pile( { offset, turn } )` | A pile of cards; the one on top leaves to the side |
| `fan( { angle, radius } )` | A hand of cards, or a wheel |
| `wave( { height, length, slope } )` | The row runs along a wave, across the view on a slope |
| `unweave( { amount, threads } )` | Near the edges of the view the slides come apart into threads |
| `dome( { amount, centre, size } )` | The slides as on a dome: what is far from the middle is smaller and nearer to it |

The page has such a slide in one place, and the canvas draws it in another. A click is a click on the slide that is seen: on the cover at the edge, not on the slide in whose place it is drawn. And the lightbox lets the image grow out of the slide as it is drawn: a cover that is turned away turns to the front while it grows, and turns back on its way home. `canvas()` sees to that with `hit()`, which it loads when an effect lays out; with a layer by its name it is a plugin to add:

```js
import { gl, hit, coverflow } from 'gpuslider/gl';

const effects = [ coverflow() ];
createSlider( element, { align: 'center', plugins: [ gl( { effects } ), hit( { effects } ) ] } );
```

Effects under the pointer (`waves()`, `spotlight()`, `magnify()` and the others) have the pointer where it is on the slide as it is drawn.

`slider.plugins.hit.at( x, y )` is the slide that is seen at a point of the page, `.where( index )` is what is around a slide as it is drawn. What is there to be used in a slide (links, buttons) is where the page has it.

Transitions, for `stack()`, one at a time:
`liquid`, `ripple`, `glitch`, `burn`, `pixelate`, `swirl`, `lens`, `fluted`, `warp`, `zoom`, `mosaic`, `blocks`, `fold`, `signal`, `push`, `chroma`, `kaleido`, `displace`, `datamosh`, `wind`, `distance`. Without one the stack fades.

```js
createSlider( element, {
	plugins: [ stack(), canvas( { effects: [ split(), burn() ] } ) ],
} );
```

A stack in the first view of a page says so in its HTML: `class="gs gs-stack"`. Then the slides are on top of each other before the script is there, and nothing of the page gives way when it comes. Without the script such a slider shows its first slide, and is no scroller: the slides after the first cannot be reached then. It is for a stack that starts at its first slide.

### Your own

An effect is an object of GLSL function bodies. It is written once and runs on both layers: for WebGPU it is translated to WGSL when the shader is made.

```js
const wobble = ( { amount = 0.02 } = {} ) => ( {
	params: { amount },
	animated: true,
	uv: `
	uv.x += sin( uv.y * 20.0 + uTime * 3.0 ) * amount;
	return uv;`,
} );
```

| Hook | Signature | |
|---|---|---|
| `vertex` | `vec3 ( vec3 p, vec2 uv )` | Moves the mesh. `p` in px from the centre of the slide, z towards the viewer |
| `uv` | `vec2 ( vec2 uv )` | Moves the lookup |
| `color` | `vec4 ( vec4 color, vec2 uv )` | Changes the result; may call `media( uv )` |
| `transition` | GLSL with `vec4 transition( vec2 uv )` | Stack only. `getFromColor`, `getToColor`, `progress`: what is written for gl-transitions runs as it is |

A parameter is a number, or an array of 1 to 4. An array stays the array it was given: what the page writes into it is drawn in the next frame, which `slider.wake()` asks for. That is how a page tells an effect what only the page knows: where it is scrolled to, how loud the music is, where the middle of a wall of sliders is.

```js
const level = [ 0 ];
const loud = () => ( {
	params: { level },
	uv: `return ( uv - 0.5 ) * ( 1.0 - 0.1 * level ) + 0.5;`,
} );
// Later, as often as it changes.
level[ 0 ] = 0.8;
slider.wake();
```

An effect that lays the slides out says in JS too where it moves a point to, so that a click finds the slide that is seen: `place( p, about )` does what `vertex` does, with `p` as `[ x, y, z ]` and `about` with `progress`, `velocity`, `size`, `view` and `quad` as the uniforms of their names. Without it a click is a click on the slide whose place on the page it is.

`head` is GLSL the bodies need, `animated: true` says that it moves without the slider moving, `animated: 'pointer'` that it does while the pointer is over the slider.

Uniforms: `uProgress`, `uVelocity`, `uPointer`, `uPointerSpeed`, `uPointerIn`, `uTime`, `uSize`, `uView`, `uQuad`, and in `color` and `uv` also `uRadius`. See `src/gl/program.js`.

What the translation knows is the GLSL that all effects here are written in. For an effect that is to run on WebGPU too:

- Functions, `if`, `for`, `a ? b : c`, and the functions GLSL comes with. No `out` and `inout` parameters, no structs, no arrays, no `#define`.
- What `max`, `min`, `clamp` and `smoothstep` are given is of one kind: `max( v, vec2( 0.0 ) )`, not `max( v, 0.0 )`.
- One component is assigned at a time, or the whole vector: `p = vec3( q, p.z )`, not `p.xy = q`.

A shader that WebGPU does not take is said in the console, as `gpuslider: …`, and the page draws that slider.

## Size

Gzipped, in the bundle of who imports it, from `npm run size`. A KB is 1024 bytes, as in the budgets that the build holds every part to:

| Part | Size |
|---|---|
| Core | 4.6 KB |
| A plugin | 0.3 to 1 KB |
| `gpuslider/full`: the core with all its options | 7.0 KB |
| `<Slider>` and `<Slide>` for React, or the hook alone | 0.6 KB, 0.1 KB |
| `canvas()`, which chooses the layer | 0.3 KB |
| `hit()`, which says what slide is seen at a point | 1.0 KB |
| Canvas layer of WebGPU | 9.1 KB |
| Canvas layer of WebGL 2 | 7.1 KB |
| An effect | 0.2 to 0.7 KB |
| A transition | 0.2 to 0.7 KB |
| Lightbox | 2.0 KB |
| `style.css`, `lightbox.css` | 0.7 KB, 0.8 KB |
| `loading.css` | 0.4 KB |

A visitor loads one of the two layers. `dist/` has the same for pages without a bundler, as modules that share what they have in common, with the shaders made small. `npm run test:dist` runs the tests with them.

## Not yet

- Published on npm, so no CDN has it yet: `…/gpuslider/dist/` in the examples is wherever you put `dist/`.
- A file for `<script>` without `type="module"`.
- A ticker has no slide it is at: no `change`, no dots.
- Effects that lay out are cut at the edge of the slider.
- Effects that cross the borders of slides (a ripple that follows the pointer over the whole slider): needs a second pass.
- Slide content is HTML and is not distorted with the image.
- Cross-origin media needs CORS headers and `crossorigin` on the element; without them the page draws that slide.
- Pointer effects are not switched off by `prefers-reduced-motion`; moves and speed effects are.
- Tried on real phones: not yet. The tests run desktop engines.
- WebGPU in Firefox is not tested: the Firefox of the tests has no GPU to give. There `canvas()` takes WebGL.
- Videos on WebGPU are copied into a texture on every frame, as on WebGL. WebGPU can draw them without a copy, which is not used yet.
