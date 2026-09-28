# shaderslide

A slider that draws its media on a WebGL canvas and owns its own motion.
No dependencies.

Working name. The plan, with every decision and its reason, is in [PLAN.md](PLAN.md).

## Run it

```sh
npm install
npm start          # http://localhost:4173/demo/
npm test           # Chromium, Firefox and WebKit
npm run site       # the site with controls, http://localhost:5183/
npm run size       # gzipped sizes, fails over budget; builds dist/
npm run test:dist  # the tests, with what is built
npm run types      # type declarations from the JSDoc, and a file that uses them
npm run media      # generates the demo images and videos again
```

## Use it

Three ways, from the least to write to the least to load.

### Without a script of your own

```html
<link rel="stylesheet" href="…/shaderslide/dist/style.css">
<script type="module" src="…/shaderslide/dist/auto.js"></script>

<div class="ss" aria-label="Photos"
	data-ss='{ "loop": true, "autoplay": 4000 }'
	data-ss-gl="stretch waves">
	<div class="ss-track">
		<div class="ss-slide">
			<img class="ss-media" src="one.jpg" alt="…">
			<div class="ss-content">Anything: headings, links, buttons.</div>
		</div>
		<div class="ss-slide">
			<video class="ss-media" src="two.mp4" muted playsinline loop autoplay></video>
		</div>
	</div>
	<button data-ss-prev aria-label="Previous slide">‹</button>
	<button data-ss-next aria-label="Next slide">›</button>
	<button data-ss-pause aria-label="Pause autoplay"></button>
	<div data-ss-dots></div>
</div>
```

| Attribute | |
|---|---|
| `data-ss` | Makes the element a slider. Its value: the options of `shaderslide/full` as JSON, or nothing |
| `data-ss-gl` | The canvas, with the effects that are named: `"stretch waves"`, or with their options `'{ "stretch": { "amount": 2 } }'` |
| `data-ss-lightbox` | A lightbox, with effects as above. Needs `dist/lightbox.css` |

`auto.js` is one file of 7.1 KB. The canvas and the lightbox are loaded when a slider asks for them and the page has time; a page without them never loads them.

The element tells when its slider is made: `ss:ready`, with the slider as `detail`, goes up to the document. For elements that come later, `import { auto, sliders } from '…/auto.js'` and call `auto()`; `sliders.get( element )` is the slider.

### With all options

```js
import { createSlider } from 'shaderslide/full';
import { gl, stretch, split } from 'shaderslide/gl';
import 'shaderslide/style.css';

const slider = createSlider( document.querySelector( '.ss' ), {
	loop: true,
	autoplay: 4000,
	plugins: [ gl( { effects: [ stretch(), split() ] } ) ],
} );
```

`shaderslide/full` is the core with arrows, dots, keys, the wheel, videos, autoplay, auto height and the stack, switched by options: 6.7 KB.

### With what you name, and no more

```js
import { createSlider } from 'shaderslide';
import { controls, keyboard } from 'shaderslide/plugins';

createSlider( element, { loop: true, plugins: [ controls(), keyboard() ] } );
```

The core moves slides: it measures, drags, snaps, loops, and says what happens. It is 4.5 KB. Everything else is a plugin, and what is not imported is not in the bundle: every entry has named exports only and no side effects.

### In React

```jsx
import { useSlider } from 'shaderslide/react';
import { controls } from 'shaderslide/plugins';
import { gl, stretch } from 'shaderslide/gl';

function Photos( { photos, loop } ) {
	const [ ref, slider ] = useSlider(
		{ loop, plugins: [ controls(), gl( { effects: [ stretch() ] } ) ] },
		[ loop ]
	);
	return (
		<div className="ss" ref={ ref } aria-label="Photos">
			<div className="ss-track">
				{ photos.map( ( photo ) => (
					<div className="ss-slide" key={ photo.src }>
						<img className="ss-media" { ...photo } />
					</div>
				) ) }
			</div>
			<button onClick={ () => slider?.next() }>Next</button>
		</div>
	);
}
```

The second argument is what the slider is made again for, as the dependencies of an effect; it stays at its slide. Slides that React adds or removes are seen by the slider. The hook adds 0.1 KB to the core. This page with arrows and dots is 5.2 KB in the bundle; with the canvas and `stretch` it is 11.6 KB.

### Three tiers

Without the script the slider is a native scroller with scroll-snap.
Without the `gl()` plugin, or without WebGL 2, the page draws the slides and everything else works the same.
With it the canvas draws the media, and the text stays HTML on top of it.

## Layout is CSS

The script measures what the page lays out, so responsive settings are media queries:

```css
.ss { --ss-per-view: 1.2; --ss-gap: 12px; }

@media (min-width: 960px) {
	.ss { --ss-per-view: 3; }
}
```

Give the slides a height, an `aspect-ratio`, or use `autoHeight()`.

### Downwards

```js
createSlider( element, { axis: 'y' } );
```

```css
.ss { height: 70vh; --ss-per-view: 1.5; }
```

The slides follow each other downwards: drag up and down, arrow up and down, the wheel as it is. At its ends the wheel scrolls the page. The slider needs a height. Effects are written for a row and are turned with the slider.

### Rows

Nothing of the script: a grid that flows in columns. A column is a snap.

```css
.ss-track {
	display: grid;
	grid-auto-flow: column;
	grid-template-rows: repeat( 2, 1fr );
	grid-auto-columns: calc( ( 100% - 2 * var(--ss-gap) ) / 3 );
	gap: var(--ss-gap);
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
| `start` | `0` | First slide |
| `drag` | `true` | |
| `on` | | Listeners by the name of their event: `{ change: ( index ) => … }` |
| `plugins` | `[]` | See below |

Of `shaderslide/full`, and of `data-ss`, also:

| Option | Default | Is the plugin |
|---|---|---|
| `mode` | `'row'` | `'stack'`: `stack()` |
| `autoHeight` | `false` | `autoHeight()` |
| `autoplay` | `0` | ms per slide: `autoplay()` |
| `keyboard`, `wheel` | `true` | `keyboard()`, `wheel()` |
| `prev`, `next`, `pause`, `dots` | | Controls anywhere on the page: an element, several, or a selector |

## Plugins that come with it

From `shaderslide/plugins`. Each is 0.3 to 0.9 KB.

| Plugin | |
|---|---|
| `controls( { prev, next, dots } )` | Arrows, dots and `data-ss-to` buttons, in the slider or anywhere |
| `keyboard()` | Arrow keys, Home, End. Makes the slider focusable |
| `wheel()` | The wheel and two fingers on a trackpad, along the slider |
| `autoplay( 3500 )` | Goes on by itself. Waits for the pointer, the focus, the tab and the screen. `slider.plugins.autoplay.pause()`, `.play()`, `.paused` |
| `marquee( { speed, hover, scroll } )` | A ticker: runs evenly and without an end, slower under the pointer, faster while the page is scrolled. For `loop: true` |
| `thumbs( other )` | The slides are the buttons of another slider |
| `videos()` | Videos play while their slide is in view |
| `autoHeight()` | As high as the slides in view; the height follows the move |
| `stack()` | The slides on top of each other, for transitions |
| `progress()` | Tells the slides where they are, for animations in CSS |

And `gl()` from `shaderslide/gl`, `lightbox()` from `shaderslide/lightbox`.

```js
import { marquee, thumbs } from 'shaderslide/plugins';

// A ticker whose pictures stretch while the page is scrolled.
createSlider( one, {
	loop: true,
	free: true,
	plugins: [ marquee( { speed: 50, hover: 0.2, scroll: 0.4 } ), gl( { effects: [ stretch() ] } ) ],
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
| `settle` | Index of the snap it came to rest at |
| `visible` | Indexes of the slides in view, when they change |
| `dragstart`, `dragend` | The motion; the velocity it was let go with |
| `click` | `{ index, event }`. Not the click that ends a drag |
| `measure` | The layout, after every measuring |
| `slides` | The slides, after some were added or removed |
| `frame` | The view, on every frame of a move |
| `destroy` | The slider |
| `autoplay:play`, `autoplay:pause` | |
| `marquee:play`, `marquee:pause` | |
| `gl:on`, `gl:off` | The canvas took over, or gave the slides back to the page |
| `lightbox:open`, `lightbox:close` | Index of the slide |

Whether the slider is at an end: `canNext` and `canPrev`, at `change`.

## Buttons anywhere

In the slider, attributes are all it takes (see above). Anywhere else, name the slider:

```html
<div class="ss" id="photos">…</div>

<nav data-ss-for="photos">
	<button data-ss-prev>Back</button>
	<button data-ss-next>On</button>
	<button data-ss-to="0">First</button>
	<div data-ss-dots></div>
</nav>
```

or hand them over:

```js
createSlider( element, {
	plugins: [ controls( { next: '.my-next', prev: document.querySelector( '.my-prev' ) } ) ],
} );
```

Arrows at an end are `disabled`, the dot and the `data-ss-to` of the active snap have `aria-current`. Buttons that are added later work too.

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

On the canvas an animation is an effect (below): `coverflow()` turns the slides beside the active one.

On the page it is CSS. The `progress` plugin writes `--ss-p` (-1 is one slide before the active one), `--ss-away` (the same without the sign) and `--ss-share` on every slide, on every frame of a move:

```js
import { progress } from 'shaderslide/plugins';

createSlider( element, { align: 'center', plugins: [ progress() ] } );
```

```css
.ss-slide { perspective: 1200px; }
.ss-slide > * {
	rotate: y calc( var(--ss-p) * -45deg );
	scale: calc( 1 - var(--ss-away) * 0.2 );
}
```

Transform what is in the slide, not the slide: that one the slider moves and measures.

## Lightbox

```js
import { lightbox } from 'shaderslide/lightbox';
import 'shaderslide/lightbox.css';

createSlider( element, { plugins: [ gl(), lightbox( { effects: [ stretch() ] } ) ] } );
```

A click on a slide lets its image grow to the screen, Escape lets it go back. `data-ss-full="large.jpg"` on the image names a larger file; `slider.plugins.lightbox.open( index )` and `.close()` do it from a script.

## Focus point

```css
.ss { --ss-focus: 30% 70%; }
```

What `object-position` is for an image: the point that stays in view when the image is cut. The canvas takes it from the page.

## The canvas

```js
gl( { effects: [ stretch() ], eager: false, density: 2, maxSize: 2048, perspective: 1200 } )
```

The canvas is made at the first sign of use: a pointer over the slider, a touch, the focus, a move. Until then the page draws the slides, which look the same, and the page has loaded without a context and without a shader. A slider that moves by itself (autoplay, a ticker), or whose effects show at rest, gets its canvas when the page has time. `eager: true` makes it with the slider.

Shaders are compiled on another thread where the browser can, and no frame is drawn while nothing moves.

## Effects

Any number, in the order given.

| Effect | Does | Moves with |
|---|---|---|
| `stretch( { amount } )` | The middle of the image hangs back | Speed |
| `split( { amount } )` | The colours come apart | Speed |
| `parallax( { amount } )` | The image is slower than its slide | Position |
| `bend( { amount, speed } )` | The row is an arc; bends the mesh | Position and speed |
| `magnify( { size, strength } )` | A lens | Pointer |
| `spotlight( { size, dim } )` | The rest is dimmed | Pointer |
| `reveal( { size } )` | The images lose their colours, except around the pointer | Pointer |
| `glass( { size, lines, amount } )` | Fluted glass around the pointer | Pointer |
| `pixels( { size, cells } )` | Coarse pixels around the pointer | Pointer |
| `tilt( { angle } )` | The slide leans to the pointer; turns the mesh | Pointer |
| `waves( { size, amount, speed } )` | Rings run away from the pointer, while it is over the slider | Pointer and time |
| `smear( { size, amount } )` | The pointer drags the image along | Speed of the pointer |
| `shift( { size, amount } )` | The colours come apart along the way of the pointer | Speed of the pointer |

Effects that lay out: the slider moves as ever, the effect says where a slide is drawn. For one slide per view or `align: 'center'`; give the slider padding for what leaves its place.

| Effect | Does |
|---|---|
| `coverflow( { angle, depth, range } )` | The slides beside the active one turn away |
| `pile( { offset, turn } )` | A pile of cards; the one on top leaves to the side |
| `fan( { angle, radius } )` | A hand of cards, or a wheel |

Transitions, for `stack()`, one at a time:
`liquid`, `ripple`, `glitch`, `burn`, `pixelate`, `swirl`, `lens`, `fluted`, `warp`, `zoom`, `mosaic`, `blocks`, `fold`, `signal`, `push`, `chroma`, `kaleido`, `displace`, `datamosh`, `wind`. Without one the stack fades.

```js
createSlider( element, {
	plugins: [ stack(), gl( { effects: [ split(), burn() ] } ) ],
} );
```

### Your own

An effect is an object of GLSL function bodies.

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

`head` is GLSL the bodies need, `animated: true` says that it moves without the slider moving, `animated: 'pointer'` that it does while the pointer is over the slider.

Uniforms: `uProgress`, `uVelocity`, `uPointer`, `uPointerSpeed`, `uPointerIn`, `uTime`, `uSize`, `uView`, `uQuad`. See `src/gl/program.js`.

## Size

Gzipped, in the bundle of who imports it, from `npm run size`:

| Part | Size |
|---|---|
| Core | 4.5 KB |
| A plugin | 0.3 to 0.9 KB |
| `shaderslide/full`: the core with all its options | 6.7 KB |
| `useSlider` for React | 0.1 KB |
| Canvas layer | 6.5 KB |
| An effect | 0.2 to 0.4 KB |
| A transition | 0.2 to 0.7 KB |
| Lightbox | 1.6 KB |
| `style.css`, `lightbox.css` | 0.7 KB each |

`dist/` has the same for pages without a bundler, as modules that share what they have in common, with the shaders made small. `npm run test:dist` runs the tests with them.

## Not yet

- Published on npm, so no CDN has it yet: `…/shaderslide/dist/` above is wherever you put `dist/`.
- A file for `<script>` without `type="module"`.
- A ticker has no slide it is at: no `change`, no dots.
- Effects that lay out are cut at the edge of the slider.
- Effects that cross the borders of slides (a ripple that follows the pointer over the whole slider): needs a second pass.
- Slide content is HTML and is not distorted with the image.
- Cross-origin media needs CORS headers and `crossorigin` on the element; without them the page draws that slide.
- Pointer effects are not switched off by `prefers-reduced-motion`; moves and speed effects are.
- Tried on real phones: not yet. The tests run desktop engines.
