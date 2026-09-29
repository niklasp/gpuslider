# shaderslide — plan

Working name; the folder, the package name and the `ss-` prefix are easy to rename.

A slider that draws its media on a WebGL canvas and owns its own motion, with no Swiper and no other dependency.
The question it answers: how far can a canvas slider go and still be small, fast and usable anywhere?

## Goals

- Everything Swiper is commonly used for: several slides per view, gaps, loop, snapping, free scrolling, drag, keyboard, wheel, autoplay, arrows and dots, RTL, responsive settings, auto height, slides sized by their media.
- What Swiper cannot do: shader transitions, distortion driven by the speed of the move, pointer-following effects, mesh bends.
- Images and videos.
- Small: budgets below, checked by a script.
- Idle costs nothing: no frame is drawn while nothing moves.
- Runs in any page, in an iframe, several times per page, and without WebGL.

## Non-goals

- Rendering text or arbitrary HTML into the canvas. WebGL cannot draw DOM.
- WebGL 1. A second backend before the first one is complete (see decision 7).
- Components for frameworks. The core is vanilla, and the page renders its slides with whatever renders the page. For React there is a hook of 0.1 KB (decision 14).

## Decisions

Each one with its reason. Rejected alternatives are named where they were tempting.

### 1. The canvas draws the media; the DOM keeps the structure

One canvas per slider draws the image or video of every visible slide.
The `<img>` and `<video>` elements stay in the page: they are the texture sources, they carry `srcset`, `loading`, `alt`, and they are the fallback.
A media element is hidden only once its texture is on the canvas.
Slide content (headings, buttons) is ordinary HTML above the canvas; it moves with its slide but effects do not distort it.

Why: a slider without DOM has no text, no links, no accessibility, nothing for search engines and nothing to show when WebGL fails.

### 2. Own motion engine

One number, `pos` (scroll offset in px, unbounded when looping), and its velocity.
Drag, wheel, keyboard, autoplay and the API only set a target or move `pos`; a critically damped spring brings `pos` to the target.
The spring is solved analytically per frame, so it does not depend on the frame rate and cannot explode.

Why: effects need a continuous position and velocity on every frame.
Rejected: CSS scroll-snap as the engine. It gives no velocity, and looping needs clones and scroll jumps.
Rejected: CSS transitions for the move (Swiper). They report only start and end.

### 3. The page lays out the slides; the engine measures

Slides are flex items. Their size comes from CSS (`--ss-per-view`, `--ss-gap`, or `auto` width from the media).
The engine reads each slide's offset and size once per resize and derives the snap points.

Why: responsive settings become plain CSS media queries on two custom properties, so the JS needs no breakpoint system. Slides of different widths work without extra code. The layout is identical before and after the script runs.

### 4. Three tiers, one markup

1. No script: the track is a native horizontal scroller with scroll-snap.
2. Script, no WebGL (unsupported, context limit reached, context lost, cross-origin media): the engine moves the DOM slides.
3. Script and WebGL: the same, plus the canvas draws the media.

The DOM positioner always runs, because slide content is DOM in every tier. The canvas is a layer on top of it, not a replacement.

### 5. Two layouts

- `row`: slides next to each other. Any number per view, fractions included.
- `stack`: slides on top of each other, one per view. `pos` runs through them, and the fraction is the progress of a transition between two slides. Without WebGL it is a crossfade.

### 6. One mesh per slide, plus an optional full-canvas pass

- Row and stack both draw each visible slide as a subdivided grid (one shared vertex buffer, one draw call per visible slide).
- Effects hook into three places: `vertex` (move the mesh: bends, curls), `uv` (move the lookup: warps, lenses), `color` (change the result: chroma split, tint, grain).
- Several effects compose: the `uv` hooks chain inside `media( uv )`, and `color` hooks call `media()` as often as they need.
- Stack transitions are a fourth hook, `transition`, with two textures and `progress`. The 20 transitions of Gutenslider Pro port through a shim (`getFromColor`, `getToColor`, `progress`).
- A post pass (slides into a framebuffer, then one full-canvas shader) is for effects that cross slide borders, such as a ripple under the pointer. Only allocated when an effect asks for it.

Uniforms every effect gets: `uProgress` (slide offset from its snap, in slides), `uVelocity` (smoothed, views per second), `uPointer` (smoothed, uv of the slide), `uPointerSpeed`, `uPointerIn`, `uTime`, `uSize`, `uView`, `uQuad`.

### 7. WebGL 2, written by hand

Superseded on 2026-09-29 by decision 16: WebGPU is the first layer, and this one is what draws where WebGPU is not. What is said here about three.js stands.

Why: mipmaps for textures of any size (no shimmer when a large photo is drawn small), `#version 300 es`. Support is universal in current browsers. Without it, tier 2.

Rejected: WebGPU as the first backend (checked 2026-09-28).
It is the newest graphics API of the web and nothing newer exists.
caniuse puts it at about 87% of visitors: Safari only from 26, Firefox only on some platforms, HTTPS only. MDN lists it as "limited availability".
Every planned effect runs in WebGL 2, so WebGPU would add no visible feature while costing reach, setup code and a rewrite of the shaders in WGSL.
Its two real gains here are one device shared by all sliders of a page (no context limit) and video frames without a copy.

Rejected: three.js. It is a 3D engine of 100+ KB gzipped, and this slider draws a few textured rectangles.

Kept open: the engine, layout and input know nothing about the renderer, and a layer is passed in by the caller. A WebGPU layer (`shaderslide/gpu`) can be added next to the WebGL one without touching the core.

### 8. Textures

- Images decode off the main thread with `createImageBitmap`, scaled to the size they are drawn at (capped), then uploaded with mipmaps.
- One texture per URL, shared by slides that repeat it.
- Videos upload on `requestVideoFrameCallback`, and only while their slide is visible.
- An upload that throws (cross-origin without CORS) marks the media as failed; the page keeps showing its own element.

### 9. Draw on demand

The frame loop runs only while something changes: a pointer is down, the spring has not settled, the smoothed velocity is not zero, a visible video plays, or an effect declares itself animated.
Off screen (IntersectionObserver) everything pauses and the WebGL context goes back to a pool.
Browsers allow about 16 contexts per page; sliders beyond the cap run as tier 2 until one frees up.

### 10. Accessibility

- Root: `role="region"`, `aria-roledescription="carousel"`.
- Slides: `role="group"`, `aria-roledescription="slide"`, "n of m" label. Slides out of view are `inert`.
- Keyboard: arrow keys, Home, End. Arrows and dots are real buttons.
- `prefers-reduced-motion`: moves are instant and velocity effects get zero.
- The canvas is `aria-hidden` and takes no pointer events.

### 11. API and packaging

```js
import { createSlider } from 'shaderslide';
import { gl, stretch, magnify } from 'shaderslide/gl';

const slider = createSlider( element, {
	perView: 3,
	gap: 16,
	loop: true,
	plugins: [ gl( { effects: [ stretch(), magnify() ] } ) ],
} );
slider.next();
slider.on( 'change', ( index ) => {} );
slider.destroy();
```

- Vanilla ES modules, no dependencies, plain JavaScript with JSDoc types. The type declarations are generated from the JSDoc (`npm run types`), so there is one source for both.
- The canvas is a plugin passed in by the caller, so a slider without effects never downloads WebGL code, and unused effects are not bundled.
- Built with esbuild. `npm run size` prints gzipped bytes and fails over budget.

| Part | Budget (gzip) | Measured on 2026-09-29 |
|---|---|---|
| Core: engine, layout, drag, DOM, events, plugins | 5 KB | 4.5 KB |
| A plugin | 1 KB | 0.3 to 0.9 KB (`loading`: 0.96) |
| Full: `createSlider` of `shaderslide/full`, with the plugins its options switch | 7 KB | 6.8 KB |
| `useSlider` for React, on top of the core | 0.5 KB | 0.1 KB |
| `<Slider>` and `<Slide>` for React, on top of the core | 1 KB | 0.6 KB |
| Canvas layer of WebGL 2 without effects | 6.75 KB | 6.5 KB (6672 of 6912 B) |
| Canvas layer of WebGPU without effects | 9 KB | 8.4 KB |
| `canvas()`, which chooses the layer | 0.5 KB | 0.3 KB |
| `hit()`, which says what is seen at a point | 1.25 KB | 1.1 KB |
| One effect or transition | 1 KB | 0.2 to 0.7 KB |
| Lightbox, on top of core, controls, keyboard and canvas | 2.25 KB | 2.1 KB |
| A page in React with arrows and dots | 6 KB | 5.6 KB |
| The same with the canvas and one effect | 12.5 KB | 11.9 KB |

Budgets that were changed by me on 2026-09-28 and 29, not by the user, and are the user's to take back:

- **Canvas layer, 6 to 6.5 KB.** It got the late start, the compile on another thread, the speed of the pointer and the turn for sliders that go down (decisions 14 and 15). What a page loads first became less by it, what it loads in all became 0.6 KB more.
- **Canvas layer, 6.5 to 6.75 KB, and `hit()`, 1 to 1.25 KB.** For the pointer in a slide as it is drawn (decision 22): 19 bytes in the layer, which had 3 left, and 0.15 KB in `hit()`. The same step of the layer is taken by the corners of the page's shape, which is work of the same day.
- **Lightbox, 2 to 2.25 KB.** For the image that grows out of a slide as it is drawn (decision 23), 0.4 KB.
- **A page in React, 5.5 to 6 KB, and with the canvas 12 to 12.5 KB.** The page that is measured is made of the components now (decision 24), which are 0.4 KB more than the hook; the rest is what the layer grew by (decision 22).
- **Full means what `createSlider` of `shaderslide/full` uses.** Before, it was every plugin of `plugins/`, which with the ticker and the thumbnails is 7.5 KB. A bundler leaves out what `createSlider` does not use, so the old number was the bundle of nobody. The file for pages without a bundler, `dist/full.js`, has all of them: 8.5 KB.

For scale: Swiper's core is about 20 KB, plus 9 KB for arrows, dots, keyboard, autoplay and a11y (measured in the Gutenslider build).

The history of the core budget: 4 KB was a guess before any code existed. With autoplay, wheel, free scrolling and auto height it became 6 KB, with the public API 6.5 KB (the core measured 6.2 KB). Then the user decided: separate as much as possible. Everything that is not moving slides left the core (decision 13), which measures 4.5 KB with the whole public API and both axes in it.

### 12. A public API that others build on

The library is meant for npm. What people build on cannot change every month, so the shape is decided once, after a look at the two sliders most people know: [Embla](https://www.embla-carousel.com/docs/api) and [Swiper](https://swiperjs.com/swiper-api).

| Question | Embla | Swiper | Here | Why |
|---|---|---|---|---|
| Extensions | `plugins`, a list of functions called with options; `plugins()` returns them by name | `modules`, functions that get `{ swiper, extendParams, on, emit }` | `plugins: [ fn ]`, each `( slider ) => object`; `slider.plugins.name` | One word that both camps know. The object is the plugin: its hooks for the slider, its methods for the page |
| Events | `on( name, fn )`, `off`, `emit`; the listener gets the carousel and the name | `on`, `once`, `off`, `emit`, and an `on` option; the listener gets the swiper first | `on` (returns the remover), `once`, `off`, `emit`, `on` option, `*` for all | Listeners get **what the event says first, then the slider**: `( index ) => …` is what most listeners need, and the slider is there for the rest |
| Events of extensions | `autoplay:play` … | events of modules are events of the swiper | `plugin:event`, by `slider.emit()` | One bus, names that cannot clash |
| Buttons | not in the core: the page calls `scrollNext()` | `navigation: { nextEl, prevEl }`, selector or element | Attributes in the slider, `data-ss-for="id"` anywhere else, or `prev`/`next`/`dots`/`pause` as element or selector | Works without a line of script, and with one for those who have the element |
| Go to | `scrollTo( index )`, `canScrollNext()`, `scrollProgress()`, `slidesInView()` | `slideTo()`, `isEnd`, `progress` | `to( index )`, `toSlide( index )`, `canNext`, `canPrev`, `progress`, `visible()` | The same information under short names |
| Change of options | `reInit( options )` | `update()`, some params live | `set( options )`, `update()` | No second slider has to be made for another gap or loop. What a plugin was given stays as it is |
| Slides that come and go | `reInit()`, or the option that watches them | `appendSlide()` … or `update()` | The slider watches its track; frameworks render, nothing to call | React, Vue and the block editor add and remove elements on their own |
| Animations | the page reads `scrollProgress()` and styles | `effect: 'coverflow'` … and `creativeEffect` | On the canvas: effects (GLSL). On the page: the `progress` plugin writes `--ss-p`, `--ss-away`, `--ss-share` on every slide, CSS does the rest | Both are a plugin away, neither is in the core. `coverflow()` is the proof on the canvas, the covers of the site without the canvas the proof in CSS |

Decided with it:

- **`layers` became `plugins`.** A lightbox is no layer. Nothing was published, so the rename cost nothing.
- **What a plugin may touch is the public API.** The built-in plugins (`gl`, `lightbox`, `progress`) use nothing else. `slider.signal` ends with the slider, for listeners that need no removing; `grab()`, `drag()` and `release()` move the slider as a pointer does, for plugins that bring another input.
- **Listeners get `( detail, slider )`.** Left to me by the user on 2026-09-28, and kept.
- **Typed events.** `slider.on( 'change', ( index ) => … )` knows that `index` is a number. `tests/types/use.ts` is compiled by `npm run types` and fails when the declarations stop saying what the library does.
- **For React** there is `useSlider` in `shaderslide/react` (decision 14). The site uses it.
- **Nothing is published** until the user says so. `npm run types && npm run size && npm test && npm run test:dist` runs before every publish (`prepublishOnly`), and `dist/` and the types are built before every pack (`prepack`). The name `shaderslide` was free on npm on 2026-09-29, and is not reserved: until it is, the README names no CDN.

### 13. The core moves slides; everything else is a plugin

Decided by the user on 2026-09-28: "separate as much as possible".

| In the core | Why it stays |
|---|---|
| Engine, layout (loop, align, group, contain, free), drag | This is the slider |
| Events, `plugins`, `use()`, `set()` | What plugins stand on |
| Slides that come and go, sizes that change | A plugin cannot do it for the others |
| Roles, labels, `inert` for slides out of view | 0.2 KB. A slider that forgets an import must not be a worse page for somebody who cannot see it. `inert` also keeps the focus from scrolling the view away |

| Plugin | Size | Was |
|---|---|---|
| `controls( { prev, next, dots } )` | 0.8 KB | options `prev`, `next`, `dots`, `controls` |
| `keyboard()` | 0.4 KB | option `keyboard`. The slider can have the focus only with it |
| `wheel()` | 0.3 KB | option `wheel` |
| `autoplay( 3500 )` | 0.8 KB | option `autoplay`; `slider.play()`, `pause()`, `paused`; events `play`, `pause` |
| `videos()` | 0.4 KB | in the core, always |
| `autoHeight()` | 0.4 KB | option `autoHeight` |
| `stack()` | 0.4 KB | option `mode: 'stack'` |
| `progress()` | 0.3 KB | was a plugin already |
| `marquee( { speed, hover, scroll } )` | 0.9 KB | new (decision 15) |
| `thumbs( other )` | 0.5 KB | new (decision 15) |

- **`shaderslide/full`** is the core with all of them, by the options they had before. One import for a page that wants a slider and not a construction kit. Swiper has the same as `swiper/bundle`.
- **A plugin can lay out.** The hook `layout( measured )` gets what the slider measured of its slides (`left`, `size`, `gap`, `width`) and may change it. The stack is this: every slide one view wide, one view from the next. The core has no mode. New layouts are plugins.
- **The canvas makes its shader with its canvas**, not when the plugin is made: by then every plugin of the slider is there, and the order of `plugins` does not matter.
- **Gone without a replacement:** the events `edge` (`canNext` and `canPrev` say it on every `change`) and `screen` (one `IntersectionObserver` on `slider.root` is the same), and the option `controls` (`data-ss-for` and the elements handed to `controls()` do it).
- **A drag does not begin on a `button`.** Before, it did not begin on the arrows and dots, which the core no longer knows. Swiper does the same.
- **Tree shaking** is what makes this pay: `package.json` says `sideEffects: [ "*.css" ]`, every export is a function without effects at import. `npm run size` bundles `import { gl } from 'shaderslide/gl'` and gets the canvas layer alone, none of the 36 effects and transitions next to it.
- **Against advice:** the reviewer of the split advised to keep the stack in the core. It became a plugin, because the hook `layout()` made it 0.4 KB outside and 0.2 KB less inside.

### 14. Fast for the page it is in

Asked for by the user on 2026-09-28: as fast as possible, for everyone, with what Google recommends for pages today.

- **The canvas is made at the first sign of use**: a pointer over the slider, a touch, the focus, a move. Until then the page draws the slides, which look the same. A slider that moves by itself (`autoplay`, `marquee`) or whose effects show at rest gets its canvas when the page has time (`requestIdleCallback`). `eager: true` is as before. Why: a context, its shaders and the textures of a slider cost the main thread 50 to 200 ms, and most sliders of a page are never touched.
- **Shaders compile on another thread** where the browser has `KHR_parallel_shader_compile`. Nothing waits for them: the page draws until they are ready.
- **The list of sliders that wait for a context is gone.** With contexts made late, a slider without one gets one when it is next used.
- **`dist/` for pages without a bundler.** Modules that share what they have in common (`index`, `full`, `plugins`, `gl`, `lightbox`), and `auto.js`: one file of 7.1 KB (7.9 since decision 17) that makes a slider of every `[data-ss]` and loads the canvas and the lightbox only for sliders that ask for them, when the page has time. Its lightbox brings a second copy of the core (4.5 KB, loaded late, only with a lightbox): one request at the start was worth more.
- **The shaders of `dist/` are made small** (`bin/glsl.mjs`): comments and spaces go, 3 to 8 % of what has shaders. The first two tries broke every shader (`#version` not first; a `#define` on the line of its neighbour), and the tests found both, because `npm run test:dist` runs them with what is built.
- **`exports` of the package point at `src/`**, not at `dist/`. A bundler makes the script small itself and leaves out what is not used, and the source has the comments a debugger shows. The price: the shaders in a bundle are not made small, about 0.3 KB of the canvas layer.
- **React**: `useSlider( options, remake )` in `shaderslide/react`, 0.1 KB. React is an optional peer. A component would have to decide about the markup of the slides, which is the page's.
- **The lightbox has its own style sheet**, `lightbox.css`: `style.css` is 0.7 KB for pages without one.
- **No file for `<script>` without `type="module"`** yet. Every browser that runs the library knows modules.

The site is the proof. Lighthouse, the build of the site (`vite build`, served by `vite preview`); mobile is a slow phone on slow 4G. The numbers move by a point or two from run to run: mobile was 98 and 97 in two runs after. Before: 2026-09-28, 7 sliders. After: 2026-09-29, 14 sliders.

| | Before | After |
|---|---|---|
| Mobile: performance | 83 | 97 to 98 |
| Mobile: accessibility, best practices, SEO, agentic browsing | 93, 96, 83, 25 | 100, 100, 100, 100 |
| Mobile: FCP, LCP, TBT, CLS | not kept | 1.1 s, 2.4 to 2.6 s, 0 ms, 0.002 |
| Desktop: performance | 100 | 100 |
| Desktop: the other four | 93, 96, 83, 25 | 100, 100, 100, 100 |

Measured again on 2026-09-29 with the site that chooses its layer and says what a frame costs: mobile 97, desktop 100, the others 100.

What is left on its list: 63 KB of script that the first view does not use (React and the controls of the site), and images that could be 21 KB smaller.

One thing cost 20 points twice and is a rule for pages in React: **state that changes right after the page is there belongs below the page.** The site is rendered at build time, and its controls are a chunk that comes later. When a component above them is rendered again before they are there (the list of events; the slider that the thumbnails need), React throws their HTML away and renders them anew: a layout shift of 0.43. Both states are now in components of their own.

What did it, in the site: the page is rendered at build time and hydrated, the controls are a chunk of their own, the first image is in the HTML with `fetchpriority="high"` and all images are AVIF in four widths with `srcset` and `sizes`, the style sheet is inline, the script has `fetchpriority="low"`. In the library: the late canvas.

### 15. More layouts, more for the pointer

Asked for by the user on 2026-09-28, with the galleries of Codrops as the measure.

- **Downwards**: `axis: 'y'`. The layout has `span`, the extent along the way of the slides, and everything that was a width is that. Effects are written for a row: in a slider that goes down, the composer turns `uv`, `p` and the uniforms by a quarter, so `stretch` bows along the way whatever the way is. No effect had to be written twice.
- **Rows** are CSS: a grid that flows in columns. The slider measures columns as snaps. Nothing in the script.
- **Layouts that are effects**: `coverflow`, `pile`, `fan`. The slider moves as ever, the vertex shader says where a slide is drawn. They cost 0.3 KB each and no line in the core. They are cut at the edge of the slider, which has to have padding for them.
- **A ticker**: `marquee()`. `slider.shift( by, push )` moves the slider and its target by the same distance; as a push it counts as speed, which is how the pictures stretch while the page is scrolled and not while the ticker just runs. A ticker is at no slide: `index` and `change` stand still while it runs.
- **Thumbnails**: `thumbs( other )`. Two sliders, the slides of one are the buttons of the other.
- **Seven effects for the pointer**: `smear`, `shift` (both by the speed of the pointer, the new uniform `uPointerSpeed`), `tilt`, `waves`, `reveal`, `glass`, `pixels`. `animated: 'pointer'` is for effects that move while the pointer is over the slider and only then: `waves` costs frames while it is looked at, none after.
- **Not done:** effects that cross the borders of slides (a trail over the whole slider). They need the post pass (Open).

### 16. WebGPU first, WebGL beside it

Decided by the user on 2026-09-29: WebGPU is what the slider is built with, and the old layer stays, for a direct comparison of their speed. It stays for the visitors without WebGPU too.

- **Two layers of the same shape**: `gpu()` in `src/gpu/`, `gl()` in `src/gl/`. Same options, same hooks, same events (`gpu:on`, `gl:on`), and `layer.again` makes another of its kind, which is how the lightbox draws with what its slider draws with. The lightbox imports no layer any more; without a canvas it fades.
- **`canvas()` chooses** (`shaderslide/canvas`, 0.3 KB): it asks the browser for an adapter, not for `navigator.gpu`, because a browser may know WebGPU and have nothing to run it on (Firefox without a window, a machine whose GPU is on a blocklist). It loads one layer. `shaderslide/effects` has the effects without a layer. In `auto.js`: `data-ss-canvas`; `data-ss-gpu` and `data-ss-gl` name one.
- **Effects are written once**, in GLSL, and translated to WGSL when the shader is made (`src/gpu/wgsl.js`). Rejected: every effect twice (36 shaders to keep the same by hand, and twice the bytes for who bundles both); a compiler like Naga or Tint in the page (megabytes). The translation is 1.1 KB and knows the subset that the effects are written in, which the README names. Four effects were rewritten for it (`pile`, `tilt`, `shift`, `smear`). Every name gets a `_` at its end, because WGSL keeps words for itself that GLSL does not (`from`, `filter`).
- **One device for a window**, shared pipelines, meshes and textures. A texture is counted by who uses it and freed with the last of them.
- **The same picture.** `tests/gpu.spec.js` draws every effect and every transition with both and compares. For that both layers changed: the noise is a hash without a sine, which GPUs compute differently, and the size of an image that is looked up is chosen once per pixel from how large the image is drawn, not from how far apart the lookups of neighbours are. The second is a gain for both: at the cuts of `wind`, `signal` and `datamosh` the smallest size of the image showed as a line. Transitions with noise look a little different than before.
- **Tests**: all tests run with both layers (`npm run test:gpu`: Chromium with Metal, and WebKit), and with both of `dist/`. The Firefox of the tests gives no adapter: WebGPU in Firefox is not tested.

The comparison (`npm run bench`, `bench/`; the numbers are in the README). Same browser, same GPU, the layers in turns, each run in a browser that has drawn nothing before.

| | WebGL 2 | WebGPU | Why |
|---|---|---|---|
| First slider of a page | 63 to 80 ms | 60 to 75 ms | A context and a shader, or a device and a pipeline: the same work |
| A slider after it | 49 to 66 ms | 32 to 33 ms | The device is there, the pipeline too |
| Sliders on the canvas | 12 of a page | all | A page has about 16 contexts of WebGL, the layer takes 12 |
| Script in a frame, for a slider | 0.02 to 0.03 ms | 0.03 to 0.06 ms | WebGPU is told more for a frame: an encoder, a pass, its views, its groups |
| Late frames, 20 sliders moving | none | none | |
| Size | 6.5 KB | 8.4 KB | The translation, and mipmaps that WebGPU does not make by itself |
| Reach | all | about 87 % | |

Not measured: the time of the GPU; phones; a browser with a window (`--headed` does, and was not run here). Without a window Chromium draws every frame and shows it to nobody.

One thing was made faster by the measuring: the views of the textures that a bent slide is drawn into were made on every frame, and are kept now.

Budgets that I set, the user's to take back: the WebGPU layer 9 KB (8.4 measured), `canvas()` 0.5 KB (0.3).

Open, for WebGPU: videos without a copy (`importExternalTexture`, which needs a shader of its own kind); one encoder for all sliders of a frame, which would save script in a frame (how much is not measured); drawing in a worker.

### 17. Loading is a plugin, and its screen is the page's

Asked for by the user on 2026-09-29: media take time to load, the visitor can be shown a loading screen, and there are events for it that users can add their own to.

- **`loading()`** in `shaderslide/plugins`, 0.9 KB. It counts the media of the slider: an image when it is decoded (`decode()`, so the first frame does not wait for it), a video when its first picture is there. What fails counts too.
- **Events**: `loading:start`, `loading:progress`, `loading:done`, with the numbers. `slider.plugins.loading.ready` is a promise.
- **The screen is an element that is told a number**: `--ss-loaded`, the text of `[data-ss-loaded]`, the class `ss-loaded`. The one that is made when there is none is the smallest that says something, a number and a line, in a style sheet of its own (0.4 KB). A logo, an animation, a page that opens like a curtain: that is the page's, with the same three things.
- **It never waits for ever**: after `timeout` (10 s) it is done with what is there. `min` is for the other end: a screen that would be gone before it was seen.
- **It makes lazy images load.** That is against what the lazy loading is for, and what a loading screen means: the README says where it belongs.
- **One plugin for several sliders** counts them together. A wall of sliders has one screen.
- **`also`**: promises that count as media. Fonts, data, whatever the page waits for.
- **In `auto.js`**: `data-ss-loading`. The file is 7.9 KB with it (7.2 before), for every page that has the file: the canvas and the lightbox are loaded when they are asked for, a loading screen that comes late is none.
- **Not in `shaderslide/full`**: it has no option for it, and its budget no room. A plugin as the others.
- **Not waited for: the canvas.** Until it is there the page draws the slides, which look the same.

### 18. Demos that are made of the library

Asked for by the user on 2026-09-29: "crazy demos", similar to a wall of glass cards without an end that can be dragged (infinite-jelly-glass.shader.se), not a copy of it; with loading screens.

- **What a demo needs goes into the library**, as something everybody can use, or it stays in the demo as a page of script. In the library: the effects `dome`, `jelly`, `slab`, and parameters that can be written into. In the demo: the pointer that moves two ways, the springs that let the glass swing on.
- **Parameters of effects are live.** An array that is given as a parameter is not copied; both layers read it on every frame. It cost the WebGL layer 10 bytes (6654 of 6656). Rejected: a method of the layer to set them, which is more to learn and more bytes for the same.
- **The wall is sliders in a slider.** One axis is what a slider has; two are a slider of sliders, both `loop` and `free`, with `drag: false`, moved by the page with `grab()`, `drag()` and `release()`. The slider did not have to learn anything for it. Every row has its own canvas, so with WebGL there are as many rows as there are contexts to have (12), with WebGPU as many as one likes.
- **The dome is drawn in the plane**: a vertex moves towards the middle, nothing goes back in space. So what is drawn stays in its canvas, and rows that are canvases of their own make one dome when each is told where the middle of the wall is. The rows are higher than their place in the wall (`--room`) for what leaves its place.
- **The titles are in the pictures** (`bin/make-wall.mjs` renders them with Chromium, as `make-media.mjs` does). The glass bends what it shows, and text of the page would not bend with it. The `alt` of a picture says what is written on it.
- **The glass swings on** by `layer.change`, which tells every slide a speed of its own: two springs follow the speed of the wall, and every card is somewhere between them.
- **Three loading screens**: a mark that is drawn as the pictures come (wall: an element of the page with `--ss-loaded`), a number that runs and a curtain (reel: `screen: false`, the events), the one of the library (tape).
- **Not done**: the three effects in the controls of the site; a click on a card of the wall (a lightbox would have to know the dome); videos in the wall (their titles cannot be in the picture); phones were not tried.

### 19. What is to be seen is in the site

Decided by the user on 2026-09-29, after the demos had been built as plain pages under `demo/`: "i only want work on the vite site", and: remove the other.

- **`demo/` is gone.** Its three pages are pages of the site: `/wall/`, `/reel/`, `/tape/`, each an HTML file of its own with its own script (`site/src/pages/`), rendered at build time as the first page is. What they are made of is on the first page too: `jelly`, `slab` and `dome` among the effects, and a section for `loading()`.
- **In React the slider is made in an effect** and ended when the component goes. The wall is a function that is given its elements and gives back what ends it; the reel is `useSlider` and state that the events of `loading()` set; React never writes the classes of a slide, which are the slider's (the reel marks the slide that is shown by an attribute).
- **The media are in `media/`**, for the site (`site/public/media` points there) and for the tests. The titles that are written on the pictures of the wall are in `site/src/lib/wall.json`, which the page and `bin/make-wall.mjs` read.
- **The page without a script** that one test of the library needs is `tests/plain.html`.
- **The scripts that the pages share give way** as the script of a page does: the build of several pages has hints for them in every page, which on a slow phone took from the first picture (Lighthouse mobile 90 with them as they came, 96 with `fetchpriority="low"`).
- **A transition is for every slider that shows one slide at a time.** The user, the same day: "the transition on the stack still does not apply to sliders here. the first one e.g. always has liquid." What they saw on the first slider was `waves` under the pointer; the transition was for the slider named Stack, far down the page, and nothing said so. Now the sliders of the site with one slide per view are stacks while a transition is chosen and the canvas draws, and rows with "None: the slides move". A slider with several slides per view has no transition: there is no one picture that turns into another. A whole view that turns into the next would need the slides drawn into a picture first (the post pass, Open).
- **The first sign of use is a pointer that moves**, not one that comes (both layers). A pointer that is over the slider when it is made never comes, and a visitor who moved it there got no canvas until they left and came back. Found by a test of the site that chose a transition with the pointer where the slider was.
- **`bench/` stays a page without a build**: it measures the library, and what a build does to it is not what is to be measured.

### 20. The site is the landing page of the package

Asked for by the user on 2026-09-29: "thik of the localhost:5183 like a package landing page. it should display most important features and metrics. keep the stile. then we would have examples that show the wall of glass reel tape. but also other docs pages listing some great features of the app and more".

- **Four kinds of pages.** `/` says what the library is: a slider to drag, six numbers, twelve features that each lead to a page of the docs, the transitions to choose, a ticker, the ways to use it, what the parts weigh, the two layers measured, the examples. `/docs/` has eleven pages. `/examples/` has the wall, the reel and the tape, which moved to `/examples/wall/` and so on. `/playground/` is what the first page was: every slider, with controls.
- **The style stays**: dark, Geist, the components of shadcn, the sections with their small headings. What the pages share is `site/src/components/Frame.tsx`.
- **The docs are the README, cut into pages.** A plugin of Vite (`site/docs.ts`) reads `README.md` when the site is built or served, takes the parts that a page names by their headings, and makes HTML of them (`marked`, at build time: nothing of it is in a bundle). What is said about the library is said in one place, and a heading that the docs ask for and the README has not stops the build. Links in the README to its own headings lead to the page of the docs that has the heading. Code has four colours, from a rule of one line for each language. Considered: the docs written again as pages. They would say the same twice, and one of the two would be wrong before long.
- **A page of the docs shows what it says.** Nine of the eleven have sliders to try it on: the effects and transitions all to be switched on, the layer to be chosen, pictures that load again, a slider that `auto.js` has made of attributes. They are loaded after the text.
- **Every page of the docs is made of one HTML file**, `site/docs/index.html`. The server of `npm run dev` gives it for every address of the docs, the build writes it once for every page with the title and the description of the page.
- **No number of the site is written by hand.** `npm run size` writes `site/src/lib/sizes.json`, `npm run bench -- --write` writes `bench.json` with the machine and the day, `npm run lighthouse` writes `lighthouse.json`. The README had sizes in units of 1000 and of 1024 side by side (the core was 4.5 KB and the WebGL layer 6.5); now a KB is 1024 bytes everywhere, as in the budgets, and a test holds the README to what was measured.
- **The name is said in one place** of the site (`NAME` in `Frame.tsx`), and the site says that it is a working name and that the library is not on npm. No command to install it is shown.
- **A stack may be said in the HTML**: `class="ss ss-stack"`. Lighthouse found that the playground shifted when the script came (0.166): the first slider is a stack since decision 19, and until `stack()` ran its slides were in a row. With the class in the HTML the slides are on top of each other from the first paint, and the slides after the first are hidden until the script is there. `stack()` leaves the class when the slider ends if the page has said it. Between the script and its first frame the slides were all seen, the last on top: a test found it in one run of many. Now the first slide is the one that is seen until the plugin says which are, and the plugin says `visible` where it left it to the page. Without the script such a slider shows its first slide and is no scroller: that is why the page says it, and the plugin does not ask for it.
- **The font before the font is as wide as the font.** Lighthouse found the first page shifting on a phone (0.159): with Geist the three buttons under the heading no longer fit in a line. Measured with the text of a page of the docs: Geist is 1.022 (400) to 1.045 (500) times as wide as Arial, and 0.995 times at 600. So the fallback is Arial at 103.5 %, and Arial Bold at 99.5 % from 600 (`site/src/index.css`), and the buttons are narrower. Both shifts are under 0.002 now.
- **Tailwind has a class `table`**, which makes a block a table: the block around a table that scrolls is `.scrolls`.
- **The pictures of the examples** are taken by `npm run shots` from the site that runs, drawn by WebGPU.

### 21. A click is a click on what is seen

Reported by the user on 2026-09-29, with a picture of the covers in the playground: "when mouse is over the outermost slide here it should also zoom that but it zooms the slide 5. make sure zoom trigger even works when still sliding atm it only works when settled?" And of the lightbox: "when opening a zoom slide the slide gets the move left right animations shift applied. but that does not fit. either use another growing animation or just leave it". And of the wall: "the wobble used here is much too strong".

- **The page has a slide in one place, the canvas draws it in another**, when an effect lays the slides out. Of the covers three have a place in view, and five are seen: the two at the edges are drawn in the places of their neighbours, and a click there opened the neighbour.
- **`hit()` says which slide is seen at a point** (`src/hit.js`, 0.9 KB): it does in JS what the vertex shader does, for a mesh of 8 by 8 squares for every slide that the canvas draws, and takes the slide that is nearest to the eye, and of two that are as near the one that is drawn later, as the canvas does. The core asks the plugins that have `at( x, y )` when there is a click; `click` says what they say, and what the page says where they say nothing. `canvas()` loads `hit()` when an effect lays out, and a page without such an effect never loads it.
- **An effect that moves the mesh says so twice**: `vertex` in GLSL, `place` in JS. `coverflow`, `pile`, `fan`, `dome` and `bend` do. `jelly` and `tilt` do not: they move a slide by little, around its place. A test holds the two against each other for every one of them: at some 1500 points of the slider, where a slide is said to be the canvas has drawn, and where none is said to be it has not.
- **Considered: asking the canvas**, by drawing the slides with their number for a colour and reading the pixel under the pointer. It needs no second telling of where a slide is, and is right for every effect there will be. It is code in both layers, of which the one of WebGL has 3 bytes left of its budget, and in WebGPU a pixel is read after the click, not with it.
- **What is there to be used is where the page has it**: a click on a link or a button in a slide is a click on the slide it is in. The text of a slide is not moved by the canvas (Open: slide content is not distorted with the image).
- **The lightbox lets the image grow out of where it is drawn**: `hit().where( index )` is what is around the slide as the canvas draws it. For a cover that is turned away that is narrower than its place.
- **A click on a slider that moves is a click.** The slider took the pointer as soon as it came down on a slider that moved, and the browser gives the click to who has the pointer: it came to the slider, not to a slide, and nothing was said. Now a pointer that comes down on a slider that moves holds it, and is taken when it has moved 4 px. Let go before, it was a click, and the slider goes to the snap that is nearest.
- **The image of the lightbox grows, and no more.** `punch` is 0 where it was 0.4: the speed of the growing counted as speed for the effects, so an image with `stretch()` and `split()` bowed sideways while it opened. The option stays for who wants it.
- **The wall swings less**: `jelly` at 0.4 of what it is, and springs that swing past once and a little (hold 16 and 10, where they were 8 and 4.5).

### 22. The pointer is where it is seen

Noticed with decision 21, and asked for by the user on 2026-09-29: "Pointer effects on turned slides. Waves, lens and the others still follow the slide's place on the page, not where the canvas draws it."

- **An effect under the pointer had the pointer in the slide's place on the page.** On the covers the rings of `waves()` and the light of `spotlight()` were on the slide in whose place the pointer was, which is drawn elsewhere, and the cover at the edge that the pointer was on had none.
- **`hit().uv()` says where the pointer is in a quad as it is drawn**: of the mesh of 8 by 8 squares the triangle the pointer is in, and in it the point. Both layers ask it for every quad they draw, when the plugin is there; a slider without an effect that lays out has no `hit()` and the layers do what they did.
- **Past the edge of a slide the mesh goes on**: of a pointer that is not on the slide, the triangle that is nearest says where it is, as if it went on. So the light does not jump where a slide ends, and rings go on from one slide to the next as they do in a row.
- **Nothing of the page is read for it.** The layer says the quad, which it has from the last layout; `hit()` reads the page for a click only.
- **The speed of the pointer is not turned**: `uPointerSpeed` is in sizes of the slide as the page has it. On a cover that is turned away `smear()` and `shift()` pull a little more than the pointer moves.
- **A test holds it**: with `spotlight()` and each of the five effects that lay out, the middle of what is lit is within 8 px of the pointer, across and downwards, on both layers (`tests/hit.spec.js`). Without the change six of the eight fail.

### 23. The image grows out of the slide as it is drawn

Reported by the user on 2026-09-29: "the zoom is not canvas based right? i think it should be if possible. as image lag back now into some position".

- **It was drawn by the canvas, and not as the slider draws the slide.** The image grew out of a box around the slide (decision 21): for a cover that is turned away a flat picture of the width of the cover. On the way back it came to lie on top of its neighbours as that flat picture, and was the turned cover in the next frame.
- **`hit().where()` says the four corners of the slide as it is drawn**, each with where it is on the page and by how much its distance makes it smaller. The lightbox has an effect of its own that puts the mesh of the image between these corners, as on a plane that is seen from the side, and lets it go from there to where the image is flat. So a cover turns to the front while it grows, a card of the fan turns upright, and both go back the way they came.
- **Only for the slide that grows**: the effect is for slides that are at their place in the lightbox, not for the ones next to it.
- **A slide that is bent is near what is drawn, not the same.** Of a slide that `dome()` has bent the four corners say a plane. With the dome at 1.5 and three slides in view 4 of 100 points of the slide are not where they were; in the wall, where the slides are small, it is less. Considered: nine points and a curve through them, which is more to tell the shader for the one effect that bends.
- **What the slider cuts, the lightbox does not**: a slide that is half out of the slider is whole as soon as it grows.
- **On top of its neighbours**: the lightbox is on top of the page, so a cover that is behind another in the slider is in front of it while it grows. It is the part of a cover that another hides, a few px.
- **A test holds it** for the five effects that lay out, across and downwards, on both layers: when the lightbox has opened by nothing yet, its canvas has drawn the slide where the slider has, in its colours (`tests/hit.spec.js`).

### 24. In React the slider is a component

Asked for by the user on 2026-09-29: "are you sure how the component is called is the best way. look at react swiper. we would want a component. or good dx. rethink".

Before, React had a hook and the page wrote the markup with its classes (decision 11: "A component would have to decide about the markup of the slides, which is the page's"). What showed that this was not enough is the site itself: its own component around the hook has props that say when the slider is to be made again and when it is to measure, one that hands the slider out, and one that hears its events.

- **`<Slider>` and `<Slide>`** in `shaderslide/react`, 0.6 KB on the core. `<Slider>` is the element with the class `ss` and the track in it; its children are the slides. What is in a slide is the page's as before: the image has the class `ss-media`.
- **Options are props, and a change of one changes the slider that exists** (`slider.set()`): nothing is made again for `loop`. Swiper has its parameters as props as well; here a prop that changes takes no canvas away.
- **Plugins are read when the slider is made.** Written in the JSX they are new with every render, and a slider that is made again for that would be made again for ever. For other plugins there is `remake`, a list as the dependencies of an effect. Considered: plugins that say what they were made with, to be compared, as Embla's do: code in every plugin, for a case that is rare.
- **Listeners are the ones of the last render**: `onChange`, `onSettle`, and `on` for every event by its name. They are not what a slider is made again for either.
- **`index`** moves the slider when it changes: state of React can say where the slider is.
- **`useSliderContext()`** gives what is in a `<Slider>` the slider, and renders it again when the slider goes to another snap or has measured: `slider.canNext` in the JSX is what it is. Swiper's `useSwiper()` gives the instance and no more. The name is as `useForm()` and `useFormContext()` of React Hook Form: the one makes, the other finds.
- **`around`** is what is in the slider beside its slides. Swiper has four slots for it; here `controls()` makes arrows and dots by itself, and buttons can be anywhere on the page (decision 12), so one place is enough.
- **Not props: how many slides are in view, and the gap.** They are options of the core and so they are taken, but the way is CSS (decision 3): `--ss-per-view` in a class, which a media query can change.
- **No JSX in `src/`**: the library is used as it is written, so the components are written with `createElement`.
- **A class that React writes takes the classes of the slider away**, so the slider is made again when `className` changes.
- **Not done**: the site's own component is still the one around the hook. It is to be made of `<Slider>`, which is when its `made` and `measured` go; it was left because other work is in that file on this day. A `<Slide>` that knows whether it is the active one (Swiper's `useSwiperSlide()`): the slider says it with `visible` and `change`.
- **Tests**: the types of every prop are compiled (`tests/types/use.tsx`); the docs page for React has the components with state that moves the slider, a prop that changes it and arrows by the context, and a test that the slider is the same one after the prop changed (`site/tests/pages.spec.js`).

### 25. In a stack the slide that is shown loads first

From the list of what is open, asked for by the user on 2026-09-29: "A stack loads all its media at once. This is why the playground scores 89 on a phone instead of 96, and it affects the reel too."

- **What was**: the slides of a stack are all in the place of the first, so images that wait for their place (`loading="lazy"`) did not wait, and Lighthouse took the film under the first picture of the playground for the largest paint of the page.
- **A slide that is kept from the page lets its images wait**: `content-visibility: hidden`. Tried in Chromium, Firefox and WebKit: an image with `loading="lazy"` in such a slide, or in one with `display: none`, is not asked for, and is asked for when the slide is given back; in a slide with `visibility: hidden`, which is what a stack had, it is asked for at once. Images without `loading="lazy"`, posters and films load wherever they are.
- **The style sheet keeps all slides but the first**, so before the script is there the first image is the only one that is asked for. **`stack()` gives back** the slides next to the one that is shown when its images are there, and the others when they are next. In a slider that goes round the last slide is next to the first.
- **A film loads for `autoplay`, whatever `preload` says.** `videos()` takes `autoplay` away to start the films itself; now it also takes back what the browser has begun, for a film that says `preload="none"` and has no picture yet. What the browser began before the script was there, it began: on a fast line a small film is there by then.
- **`loading()` is stronger**: it tells every image to load now, as before. The reel waits for all its media behind its screen, which is what it is for; nothing changed there.
- **Measured** with Lighthouse as a phone on a slow line, the playground: 94 where it was 89, the largest paint at 3.1 s where it was 3.8 s, and it is the first picture of the first slider now. The machine was busy with tests of another session at the time.
- **Tests**: what is asked for before the script, after it, after a step, and in a slider that goes round, in three browsers (`tests/core.spec.js`).

### 26. A page to take to a phone

From the list of what is open, asked for by the user on 2026-09-29: "A real phone. Touch feel, texture memory and video on iOS have only been reasoned about, never measured."

- **No phone was measured.** There is none at this machine; a small window in a browser on a desk has no finger, no memory of a phone and no Safari of iOS. What there is now is what it takes to measure one: a page and a command.
- **`/phone/`** says what the browser has (WebGPU and WebGL 2 with the largest texture, the pixels of the screen, memory and cores where they are said, whether the address is secure), has three sliders for the hand (a row that stretches, a stack with a film, covers that open) with twelve things to try and to say yes or no to, and measures by itself: a slider that moves for five seconds with each layer (the time to the first picture, how far the frames are apart in the middle, for 95 of 100 and at worst, how many were late, the script in a frame), then twelve sliders at once with each layer (how many the canvas draws, how many are left to the page, how often the canvas gave up). All of it is text at the end, to copy or to share.
- **`npm run phone`** builds the site and serves it in the network with https. WebGPU is there only where the address is secure; an address in the network is not, without. The certificate is made by `openssl` and signed by nobody.
- **Made of `<Slider>`** (decision 24), which it is the first page of the site to use beside the docs.
- **Open until a phone has said it**: what a finger feels like, whether the film plays in its slide on iOS and is drawn by the canvas, how many sliders a phone gives a canvas to.

## Modules

| File | Does |
|---|---|
| `src/engine.js` | `pos`, velocity, spring, frame loop on demand |
| `src/layout.js` | Measures slides; snap points, bounds, loop wrap. Pure functions apart from `measure()` |
| `src/input.js` | Pointer drag with direction lock, click suppression |
| `src/dom.js` | Moves the slides; roles, `inert` |
| `src/index.js` | `createSlider()`: options, events, plugins |
| `src/full.js` | The core with the plugins that options switch |
| `src/auto.js` | Sliders from `data-ss`, without a script of one's own |
| `src/react.js` | `<Slider>`, `<Slide>`, `useSliderContext()`, `useSlider()` |
| `src/plugins/*.js` | One plugin per file: `controls`, `keyboard`, `wheel`, `autoplay`, `marquee`, `thumbs`, `videos`, `autoHeight`, `stack`, `progress`, `loading` |
| `src/loading.css` | The screen of `loading()`, for pages that have none of their own |
| `src/lightbox.js`, `src/lightbox.css` | The lightbox: a slider in a `<dialog>`, the canvas draws the way there |
| `src/style.css` | Layout for all three tiers |
| `bin/build.mjs`, `bin/glsl.mjs` | Sizes against budgets; `dist/`, with the shaders made small |
| `src/canvas.js` | `canvas()`: the layer that the browser can draw |
| `src/effects.js` | The effects and transitions, without a layer |
| `src/hit.js` | `hit()`: which slide is seen at a point, where effects lay the slides out |
| `src/gpu/layer.js` | The canvas layer of WebGPU: one device for a window, visibility, the draw |
| `src/gpu/program.js` | Builds one shader in WGSL from the chosen effects |
| `src/gpu/wgsl.js` | GLSL of the effects to WGSL |
| `src/gpu/textures.js` | Image and video textures, shared and counted; mipmaps |
| `src/gl/layer.js` | The canvas layer of WebGL 2: context pool, visibility, the draw |
| `src/gl/program.js` | Builds one shader from the chosen effects |
| `src/gl/textures.js` | Image and video textures |
| `bench/`, `bin/bench.mjs` | The two layers, measured against each other |
| `site/` | The site: everything that is to be seen. `site/src/pages/` has the first page, the docs, the examples and the playground |
| `site/docs.ts` | The README as pages of the docs, when the site is built |
| `site/src/lib/sizes.json`, `bench.json`, `lighthouse.json` | The numbers of the site, as they were measured |
| `bin/lighthouse.mjs`, `bin/make-shots.mjs` | What Lighthouse says of the pages; the pictures of the examples |
| `media/` | Generated pictures and films, for the site and the tests |
| `bin/make-wall.mjs` | The pictures of the wall |
| `src/gl/fit.js` | Where `object-fit` and `object-position` put the pixels |
| `src/gl/effects/*.js` | One effect per file |

## Phases

Each phase ends with something that runs and with tests.

| # | Phase | Result | State on 2026-09-28 |
|---|---|---|---|
| 0 | Skeleton | Repo, this plan, static server, size script, generated demo media, no-script demo | Done |
| 1 | Engine and DOM | Drag, snap, loop, keyboard, arrows, dots, several per view, stack crossfade. A complete slider without WebGL | Done |
| 2 | Canvas layer | Media drawn on the canvas in row and stack, fallbacks, context loss, off-screen pause | Done |
| 3 | Effects | Hook system and the proving set: velocity warp, pointer lens, mesh bend, stack transitions | Done: 5 effects, 20 transitions |
| 4 | Features | Video, auto height, autoplay, wheel, RTL, free scrolling | Done |
| 5 | Breadth | Post pass, real phones, size audit, README | README done; the rest is open |
| 6 | Lightbox and site | A click lets the image grow to the screen; a site with controls for everything | Done |
| 7 | Public API | Events, plugins by name, buttons anywhere, slides that come and go, types | Done; not published |
| 8 | The split | A core that moves slides, ten plugins, `shaderslide/full` | Done |
| 9 | Fast | The late canvas, the site at 96 to 100 in Lighthouse, `dist/` and `auto.js`, `useSlider` | Done |
| 10 | Layouts and the pointer | Downwards, rows, pile, fan, ticker, thumbnails, seven pointer effects | Done: 16 effects, 20 transitions |
| 11 | WebGPU | A second layer that draws what the first draws, `canvas()` to choose, the comparison | Done on 2026-09-29 |
| 12 | Loading | `loading()`: a screen, events, several sliders together | Done on 2026-09-29 |
| 13 | Demos | A wall of glass, a reel, tape; `dome`, `jelly`, `slab`; live parameters | Done on 2026-09-29: 19 effects, 20 transitions |

## Open

- **Before 1.0:** the name and the licence (MIT is in `package.json` as a placeholder). The user on 2026-09-28: later. After 1.0 these cost a major version.
- **A ticker with dots.** `marquee()` moves the slider past its slides without being at one. Telling `change` while it runs would make dots and thumbnails follow.
- **Effects that lay out are cut** at the edge of the slider: the canvas is as large as the slider. A canvas that is larger than its slider by what an effect asks for would lift this.
- **Drawing in a worker** (`OffscreenCanvas`): the next step for pages with many sliders. It changes how textures get to the canvas. One device for all sliders of a page is there with WebGPU (decision 16).
- **The guard of the `ResizeObserver`** (an entry of the slider alone with the width it had is skipped) is there for every slider since the split, not only for auto height. No test has shown a resize that it swallows.
- **Canvas tests in WebKit that fail now and then.** "At rest the slides are as the page draws them" failed for two effects in one run of all browsers with `dist/` (the picture was compared before the canvas showed), and in no other run, nor in 276 runs of WebKit alone. It did so again on 2026-09-29 after decision 20, with `dist/`: for one effect in a run of all browsers, and for another in 1 of 42 runs of WebKit alone. Whether a visitor can see a frame without a picture there is not known. The test of the slider that goes down failed the same way more often, and waits for the picture now. It still fails in WebKit when other tests run beside it, with the same difference every time (8.89): on 2026-09-29 in 10 of 16 runs at `8851367` (before `canvas()` and the parameters that can be written into), in 4 of 16 after, in none of 8 when it runs alone; sixteen runs do not say that it got better. A slide that came into view while the slider is held stays without its picture then. With WebGPU it did not fail.
- **The wheel and the swipe back.** `overscroll-behavior-x: contain` on the slider could make the listener passive. It needs a hand on a trackpad.
- **Transforms on a slide.** The slider moves slides by `transform` and measures their boxes, so CSS that scales or turns a slide itself gets in its way. What is in the slide can be transformed freely. A plugin for DOM animations that owns the transform of the slide would lift this.
- **Post pass.** Slides into a framebuffer, then one shader over the whole canvas: pointer trails and ripples that cross slide borders. It should be a second, optional layer so that the canvas layer stays in its budget (it is at 6.5 of 6.5 KB).
- **Real phones.** Texture memory, touch feel and video on iOS are only reasoned about so far, not measured.
- **Textures of slides far from view** are kept until the slider leaves the screen. A slider with very many large images should free them earlier.
- **Too few slides to loop.** The slider then does not loop. Drawing a slide twice on the canvas would work; the HTML content of a slide cannot be in two places.
- **Pointer effects and `prefers-reduced-motion`.** Moves and speed effects are off for visitors who ask for less motion; effects under the pointer are not.
- **A WebGPU layer**, as an experiment (decision 7).
- **The first moment below the fold.** The slider takes itself to be on the screen until the browser says otherwise, so a video or autoplay far down the page may start for a frame. Starting as "off screen" is the fix; it needs a look at the first frame of videos.
- **Wheel listener.** It is not passive, because it has to stop the browser's swipe back. Scrolling down over a slider therefore waits for the handler. Swiper does the same.

## Tests (Playwright)

- A drag changes the slide; a short drag snaps back; a flick advances.
- A vertical drag scrolls the page and does not move the slider.
- A click after a drag does not follow the link under the pointer.
- Keyboard, arrows and dots. Loop wraps in both directions.
- After settling, no animation frame is requested.
- With WebGL disabled the slider works and logs no error.
- With WebGL, the canvas has the slide's pixels and the media element is hidden.
- Context loss falls back to the DOM media.
- Bundle sizes stay in budget.
- Every event is heard, in its order, with what it says (`tests/api.spec.js`).
- Buttons outside of the slider drive it and no other slider.
- A slide that is added is drawn, labelled and reachable.
- The type declarations compile against a file that uses the whole API.
- The canvas waits for the first sign of use.
- Downwards: drag, keys, wheel, and the canvas draws what the page draws.
- The ticker runs, stands still when it has to, and asks for no frame then.
- `auto.js` makes the sliders of a page, and loads the canvas for those that ask.
- All of it again with `dist/` (`npm run test:dist`).
- All of it again drawn by WebGPU (`npm run test:gpu`), and every effect and transition drawn by both layers and compared.
- `canvas()` takes the layer the browser can draw, or the one it is told.
- The pages of the site that are made of the library: their loading screens, the wall moved both ways by a drag, the wheel and the keys; in the playground the loading section and the three effects (`site/tests/demos.spec.js`).
- The first page: its numbers are the ones that were measured, every feature and every link leads to a page that is there, its sliders are drawn by the canvas; the examples; every page of the docs, its links, and the sliders that show what it says; five pages on a screen as wide as a phone (`site/tests/pages.spec.js`).
- A stack that is said in the HTML is one before the script, and nothing moves when it comes.
- What `hit()` says is what the canvas has drawn, for every effect that lays out; a click on a cover at the edge is a click on that cover; the light of `spotlight()` is where the pointer is on slides that are turned; the lightbox starts with the slide as it is drawn (`tests/hit.spec.js`).
- A click on a slider that moves holds it, and is a click on the slide under it.
- A parameter that is written into is drawn in the next frame.
- `loading()`: the screen and its numbers while media are held back, what fails, the time that is over, two sliders with one screen (`tests/loading.spec.js`).

## Risks

| Risk | Answer |
|---|---|
| Canvas and DOM content drift apart by a frame | Both are written in the same frame from the same `pos`; the canvas never reads layout while moving |
| Texture memory on phones | Upload at drawn size, cap the size, free textures of slides far from view |
| Shader compile stutter on the first move | The canvas is made when the pointer comes, not when it presses, and compiles on another thread; the page draws until it is ready |
| Many sliders on one page | WebGPU: one device for all. WebGL: context pool with a cap; the rest run as tier 2 |
| An effect of somebody that the translation to WGSL does not know | The error is logged, the page draws that slider; the README says what it knows |
| Headless browsers without a GPU | Tests run with software WebGL and assert pixels, not looks |
