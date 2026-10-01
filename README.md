# gpu slider

**An image and video carousel drawn on the GPU.** WebGPU where the browser has it, WebGL 2 where it doesn't, and a plain HTML slider underneath that works everywhere. A core under 5 KB, no dependencies, everything else a plugin.

[Website](https://gpuslider.com) · [Docs](https://gpuslider.com/docs/) · [Examples](https://gpuslider.com/examples/) · [Playground](https://gpuslider.com/playground/) · Try it on StackBlitz: [JavaScript](https://stackblitz.com/github/niklasp/gpuslider/tree/main/examples/starter?file=main.js), [React](https://stackblitz.com/github/niklasp/gpuslider/tree/main/examples/react-starter?file=src/App.jsx)

[![gpu slider](https://gpuslider.com/og/home.jpg)](https://gpuslider.com)

## Why

- **Shader effects on real content.** Images and videos that stretch with the speed, colours that split, lenses, waves and ASCII art under the pointer, slides of jelly or thick glass. More than twenty effects, and as many transitions: liquid, burn, glitch, glyphs, weave, lightning and more. Your own effect is a few lines of GLSL; it runs on WebGPU and WebGL alike.
- **Its own motion.** A spring solved exactly on every frame. Drag, swipe, wheel and keys; it snaps, loops, rests anywhere, goes sideways or down.
- **Fast by default.** Nothing is drawn while nothing moves. The canvas loads only when a slider needs it, and only the layer the browser can use.
- **Never broken.** WebGPU, else WebGL 2, else the page moves the slides itself (a transition becomes a crossfade). Without JavaScript it is a native row that scrolls and snaps.
- **Small.** The core is under 5 KB gzipped. Arrows, dots, autoplay, a lightbox, thumbnails, a ticker, a loading screen: each is a plugin, and what you don't import isn't in your bundle.
- **A lightbox** where the image grows out of its slide, drawn by the same canvas, effects and all.
- **React and SSR.** `<Slider>` and `<Slide>`, ready for Next.js server rendering with no hydration mismatch and no layout shift. Vue and plain HTML work too.
- **Accessible.** Real HTML slides, keyboard support, `aria` for arrows and dots. With reduced motion asked for, moves are instant and speed effects stay still.

## Install

```sh
npm install gpuslider
```

Written in TypeScript; the types come with it.

Or without a build, from a CDN:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gpuslider@1/dist/style.css">
<script type="module" src="https://cdn.jsdelivr.net/npm/gpuslider@1/dist/auto.js"></script>
```

## Quick start

### HTML only

With the two lines above, attributes are all it takes:

```html
<div class="gs" aria-label="Photos" data-gs='{ "loop": true }' data-gs-canvas="stretch waves">
	<div class="gs-track">
		<div class="gs-slide"><img class="gs-media" src="one.jpg" alt="…"></div>
		<div class="gs-slide"><img class="gs-media" src="two.jpg" alt="…"></div>
		<div class="gs-slide"><video class="gs-media" src="three.mp4" muted playsinline loop></video></div>
	</div>
	<button data-gs-prev aria-label="Previous slide">‹</button>
	<button data-gs-next aria-label="Next slide">›</button>
	<div data-gs-dots></div>
</div>
```

### JavaScript

```js
import { createSlider } from 'gpuslider';
import { controls, keyboard } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { stretch, split } from 'gpuslider/effects';
import 'gpuslider/style.css';

createSlider( document.querySelector( '.gs' ), {
	loop: true,
	plugins: [ controls(), keyboard(), canvas( { effects: [ stretch(), split() ] } ) ],
} );
```

### React

```jsx
import { Slider, Slide } from 'gpuslider/react';
import { controls, stack } from 'gpuslider/plugins';
import { canvas } from 'gpuslider/canvas';
import { liquid } from 'gpuslider/effects';
import 'gpuslider/style.css';

export function Photos( { photos } ) {
	return (
		<Slider
			className="gs-stack"
			loop
			plugins={ [ controls(), stack(), canvas( { effects: [ liquid() ] } ) ] }
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

Layout is CSS: `--gs-per-view` and `--gs-gap` say how many slides are in view and how far apart, `gs-stack` with `stack()` puts them on top of each other for transitions, `panes()` keeps several in view while each place turns into its next with a transition, or all of them at once with `sweep()`, and the effect `edges()` has a moving row's slides come and go by a transition.

## Browsers

Every current browser. WebGPU in Chrome, Edge and Safari 26; WebGL 2 in the others, including Firefox where it has no WebGPU. Both layers draw the same picture, and the tests hold them to it in Chromium, Firefox and WebKit.

## Documentation

Everything is on [gpuslider.com/docs](https://gpuslider.com/docs/): options, plugins, events, the API, the lightbox, effects and how to write your own, layout, loading screens and server rendering.

The same docs come with the package in one file, `node_modules/gpuslider/DOCS.md`, for reading offline and for coding agents. The site has them as [`llms-full.txt`](https://gpuslider.com/llms-full.txt) too. Agents that take skills can have one: `npx skills add niklasp/gpuslider --skill gpuslider`, or in Claude Code `/plugin marketplace add niklasp/gpuslider`.

## Plugins by others

Written a plugin or an effect? Publish it to npm with the keyword `gpuslider-plugin`. It is found automatically, gets a short review, and is then listed on [gpuslider.com/docs/community](https://gpuslider.com/docs/community/). No pull request needed. [How to publish one](https://gpuslider.com/docs/community/#publish-a-plugin).

## Contributing

Issues and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) says how to set it up and run the tests.

If gpuslider is useful to you, a [star on GitHub](https://github.com/niklasp/gpuslider) helps others find it.

## License

[MIT](LICENSE) © Niklas Jurij Plessing
