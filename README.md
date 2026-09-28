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
npm run size       # gzipped sizes, fails over budget
npm run types      # type declarations from the JSDoc, and a file that uses them
npm run media      # generates the demo images and videos again
```

## Use it

```html
<link rel="stylesheet" href="shaderslide/style.css">

<div class="ss" aria-label="Photos">
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

```js
import { createSlider } from 'shaderslide';
import { gl, stretch, split } from 'shaderslide/gl';

const slider = createSlider( document.querySelector( '.ss' ), {
	loop: true,
	plugins: [ gl( { effects: [ stretch(), split() ] } ) ],
} );
```

Without the script the slider is a native scroller with scroll-snap.
Without the `gl()` plugin, or without WebGL 2, the page draws the slides and everything else works the same.

## Layout is CSS

The script measures what the page lays out, so responsive settings are media queries:

```css
.ss { --ss-per-view: 1.2; --ss-gap: 12px; }

@media (min-width: 960px) {
	.ss { --ss-per-view: 3; }
}
```

Give the slides a height, an `aspect-ratio`, or use `autoHeight`.

## Options

| Option | Default | |
|---|---|---|
| `mode` | `'row'` | `'stack'` puts the slides on top of each other, for transitions |
| `perView` | from CSS | Slides per view, fractions allowed; `'auto'` takes each slide's own width |
| `gap` | from CSS | px |
| `loop` | `false` | Needs more slides than fit in the view, plus one |
| `align` | `'start'` | `'center'`, `'end'` |
| `group` | `1` | Slides per step |
| `contain` | `true` | No empty space at the ends |
| `free` | `false` | Rest anywhere, glide on after a drag |
| `autoHeight` | `false` | As high as the slides in view; the height follows the move |
| `autoplay` | `0` | ms per slide. Waits for the pointer, the focus, the tab and the screen |
| `duration` | `600` | ms of a move |
| `start` | `0` | First slide |
| `drag`, `keyboard`, `wheel` | `true` | |
| `controls` | the slider | Element that holds the arrows and dots |
| `prev`, `next`, `pause`, `dots` | | Controls anywhere on the page: an element, several, or a selector |
| `on` | | Listeners by the name of their event: `{ change: ( index ) => … }` |
| `plugins` | `[]` | `gl( … )`, `lightbox( … )`, `progress()`, your own |

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
| `play()`, `pause()`, `paused` | Autoplay |
| `set( options )` | Changes options of the slider that exists |
| `update()` | Measures again, after a change the slider cannot see |
| `use( plugin )` | Adds a plugin later |
| `plugins` | The plugins by their name: `slider.plugins.lightbox.open( 2 )` |
| `on( name, fn )`, `once( name, fn )` | Both return a function that removes the listener |
| `off( name, fn )`, `emit( name, detail )` | |
| `grab()`, `drag( position )`, `release( velocity )` | Move it as a pointer does |
| `root`, `track`, `slides`, `options`, `layout()`, `motion`, `view`, `signal` | For plugins |
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
| `edge` | `{ start, end }`, when the slider comes to an end or leaves it |
| `dragstart`, `dragend` | The motion; the velocity it was let go with |
| `click` | `{ index, event }`. Not the click that ends a drag |
| `play`, `pause` | Autoplay |
| `screen` | Whether the slider is on the screen |
| `measure` | The layout, after every measuring |
| `slides` | The slides, after some were added or removed |
| `frame` | The view, on every frame of a move |
| `destroy` | The slider |
| `gl:on`, `gl:off` | The canvas took over, or gave the slides back to the page |
| `lightbox:open`, `lightbox:close` | Index of the slide |

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
createSlider( element, { next: '.my-next', prev: document.querySelector( '.my-prev' ) } );
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
	rotate: y calc( var(--ss-p) * 45deg );
	scale: calc( 1 - var(--ss-away) * 0.2 );
}
```

Transform what is in the slide, not the slide: that one the slider moves and measures.

## Lightbox

```js
import { lightbox } from 'shaderslide/lightbox';

createSlider( element, { plugins: [ gl(), lightbox( { effects: [ stretch() ] } ) ] } );
```

A click on a slide lets its image grow to the screen, Escape lets it go back. `data-ss-full="large.jpg"` on the image names a larger file; `slider.plugins.lightbox.open( index )` and `.close()` do it from a script.

## Focus point

```css
.ss { --ss-focus: 30% 70%; }
```

What `object-position` is for an image: the point that stays in view when the image is cut. The canvas takes it from the page.

## Effects

Any number, in the order given.

| Effect | Does | Moves with |
|---|---|---|
| `stretch( { amount } )` | The middle of the image hangs back | Speed |
| `split( { amount } )` | The colours come apart | Speed |
| `magnify( { size, strength } )` | A lens | Pointer |
| `spotlight( { size, dim } )` | The rest is dimmed | Pointer |
| `bend( { amount, speed } )` | The row is an arc; bends the mesh | Position and speed |
| `coverflow( { angle, depth, range } )` | The slides beside the active one turn away; turns the mesh | Position |

Transitions, for `mode: 'stack'`, one at a time:
`liquid`, `ripple`, `glitch`, `burn`, `pixelate`, `swirl`, `lens`, `fluted`, `warp`, `zoom`, `mosaic`, `blocks`, `fold`, `signal`, `push`, `chroma`, `kaleido`, `displace`, `datamosh`, `wind`.

```js
createSlider( element, {
	mode: 'stack',
	plugins: [ gl( { effects: [ split(), burn() ] } ) ],
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

Uniforms: `uProgress`, `uVelocity`, `uPointer`, `uPointerIn`, `uTime`, `uSize`, `uView`. See `src/gl/program.js`.

## Size

Gzipped, from `npm run size`:

| Part | Size |
|---|---|
| Core | 6.1 KB |
| Canvas layer | 5.9 KB |
| An effect | 0.2 KB |
| A transition | 0.2 to 0.7 KB |
| Lightbox | 1.6 KB |
| `progress` | 0.3 KB |

## Not yet

- Published on npm.
- Effects that cross the borders of slides (a ripple that follows the pointer over the whole slider): needs a second pass.
- Slide content is HTML and is not distorted with the image.
- Cross-origin media needs CORS headers and `crossorigin` on the element; without them the page draws that slide.
- Pointer effects are not switched off by `prefers-reduced-motion`; moves and speed effects are.
- Tried on real phones: not yet. The tests run desktop engines.
