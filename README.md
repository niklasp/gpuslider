# shaderslide

A slider that draws its media on a WebGL canvas and owns its own motion.
No dependencies.

Working name. The plan, with every decision and its reason, is in [PLAN.md](PLAN.md).

## Run it

```sh
npm install
npm start          # http://localhost:4173/demo/
npm test           # Chromium, Firefox and WebKit
npm run size       # gzipped sizes, fails over budget
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
	layers: [ gl( { effects: [ stretch(), split() ] } ) ],
} );
```

Without the script the slider is a native scroller with scroll-snap.
Without `layers`, or without WebGL 2, the page draws the slides and everything else works the same.

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
| `layers` | `[]` | `gl( … )` |

## API

| | |
|---|---|
| `slider.next()`, `prev()`, `to( index, { instant } )` | |
| `slider.index`, `count()`, `resting`, `paused` | |
| `slider.play()`, `pause()` | Autoplay |
| `slider.update()` | Measure again, after a change the slider cannot see |
| `slider.on( 'change' \| 'settle' \| 'frame', fn )` | Returns a function that removes the listener |
| `slider.destroy()` | Gives the page back as it was |

## Effects

Any number, in the order given.

| Effect | Does | Moves with |
|---|---|---|
| `stretch( { amount } )` | The middle of the image hangs back | Speed |
| `split( { amount } )` | The colours come apart | Speed |
| `magnify( { size, strength } )` | A lens | Pointer |
| `spotlight( { size, dim } )` | The rest is dimmed | Pointer |
| `bend( { amount, speed } )` | The row is an arc; bends the mesh | Position and speed |

Transitions, for `mode: 'stack'`, one at a time:
`liquid`, `ripple`, `glitch`, `burn`, `pixelate`, `swirl`, `lens`, `fluted`, `warp`, `zoom`, `mosaic`, `blocks`, `fold`, `signal`, `push`, `chroma`, `kaleido`, `displace`, `datamosh`, `wind`.

```js
createSlider( element, {
	mode: 'stack',
	layers: [ gl( { effects: [ split(), burn() ] } ) ],
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
| Core | 5.3 KB |
| Canvas layer | 5.8 KB |
| An effect | 0.2 KB |
| A transition | 0.2 to 0.7 KB |

## Not yet

- Effects that cross the borders of slides (a ripple that follows the pointer over the whole slider): needs a second pass.
- Slide content is HTML and is not distorted with the image.
- Cross-origin media needs CORS headers and `crossorigin` on the element; without them the page draws that slide.
- Pointer effects are not switched off by `prefers-reduced-motion`; moves and speed effects are.
- Tried on real phones: not yet. The tests run desktop engines.
