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
- A framework wrapper. The core is vanilla; wrappers are a few lines and can come later.

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

Uniforms every effect gets: `uProgress` (slide offset from its snap, in slides), `uVelocity` (smoothed, viewport widths per second), `uPointer` (smoothed, canvas uv) and `uPointerActive`, `uTime`, `uResolution`, `uRect`.

### 7. WebGL 2, written by hand

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

| Part | Budget (gzip) | Measured on 2026-09-28 |
|---|---|---|
| Core: engine, layout, drag, DOM, events, plugins | 5 KB | 4.4 KB |
| A plugin | 1 KB | 0.3 to 0.8 KB |
| Full: the core and every plugin of `plugins/` | 7 KB | 6.7 KB |
| Canvas layer without effects | 6 KB | 5.9 KB |
| One effect or transition | 1 KB | 0.2 to 0.7 KB |
| Lightbox, on top of core, controls, keyboard and canvas | 2 KB | 1.6 KB |

For scale: Swiper's core is about 20 KB, plus 9 KB for arrows, dots, keyboard, autoplay and a11y (measured in the Gutenslider build).

The history of the core budget: 4 KB was a guess before any code existed. With autoplay, wheel, free scrolling and auto height it became 6 KB, with the public API 6.5 KB (the core measured 6.2 KB). Then the user decided: separate as much as possible. Everything that is not moving slides left the core (decision 13), which measures 4.4 KB with the whole public API in it.

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
- **A wrapper for React** is 60 lines in the site (`site/src/components/ShaderSlider.tsx`). A package of its own waits until somebody needs it.
- **Nothing is published** until the user says so. `npm run types && npm run size && npm test` runs before every publish (`prepublishOnly`). The name `shaderslide` was free on npm on 2026-09-28.

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

- **`shaderslide/full`** is the core with all of them, by the options they had before. One import for a page that wants a slider and not a construction kit. Swiper has the same as `swiper/bundle`.
- **A plugin can lay out.** The hook `layout( measured )` gets what the slider measured of its slides (`left`, `size`, `gap`, `width`) and may change it. The stack is this: every slide one view wide, one view from the next. The core has no mode. New layouts are plugins.
- **The canvas makes its shader with its canvas**, not when the plugin is made: by then every plugin of the slider is there, and the order of `plugins` does not matter.
- **Gone without a replacement:** the events `edge` (`canNext` and `canPrev` say it on every `change`) and `screen` (one `IntersectionObserver` on `slider.root` is the same), and the option `controls` (`data-ss-for` and the elements handed to `controls()` do it).
- **A drag does not begin on a `button`.** Before, it did not begin on the arrows and dots, which the core no longer knows. Swiper does the same.
- **Tree shaking** is what makes this pay: `package.json` says `sideEffects: [ "*.css" ]`, every export is a function without effects at import. `npm run size` bundles `import { gl } from 'shaderslide/gl'` and gets the canvas layer alone, none of the 26 effects and transitions next to it.

## Modules

| File | Does |
|---|---|
| `src/engine.js` | `pos`, velocity, spring, frame loop on demand |
| `src/layout.js` | Measures slides; snap points, bounds, loop wrap. Pure functions apart from `measure()` |
| `src/input.js` | Pointer drag with direction lock, click suppression |
| `src/dom.js` | Moves the slides; roles, `inert` |
| `src/index.js` | `createSlider()`: options, events, plugins |
| `src/full.js` | The core with every plugin of `plugins/`, by options |
| `src/plugins/*.js` | One plugin per file: `controls`, `keyboard`, `wheel`, `autoplay`, `videos`, `autoHeight`, `stack`, `progress` |
| `src/lightbox.js` | The lightbox: a slider in a `<dialog>`, the canvas draws the way there |
| `src/style.css` | Layout for all three tiers |
| `src/gl/layer.js` | The canvas layer: context pool, visibility, the draw |
| `src/gl/program.js` | Builds one shader from the chosen effects |
| `src/gl/textures.js` | Image and video textures |
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

## Open

- **Before 1.0:** the name, the licence (MIT is in `package.json` as a placeholder), and whether controls and autoplay become plugins (decision 12). After 1.0 these cost a major version.
- **Transforms on a slide.** The slider moves slides by `transform` and measures their boxes, so CSS that scales or turns a slide itself gets in its way. What is in the slide can be transformed freely. A plugin for DOM animations that owns the transform of the slide would lift this.
- **Post pass.** Slides into a framebuffer, then one shader over the whole canvas: pointer trails and ripples that cross slide borders. It should be a second, optional layer so that the canvas layer stays in its budget (it is at 5.8 of 6 KB).
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

## Risks

| Risk | Answer |
|---|---|
| Canvas and DOM content drift apart by a frame | Both are written in the same frame from the same `pos`; the canvas never reads layout while moving |
| Texture memory on phones | Upload at drawn size, cap the size, free textures of slides far from view |
| Shader compile stutter on the first move | Compile at creation, before the first interaction |
| Many sliders on one page | Context pool with a cap; the rest run as tier 2 |
| Headless browsers without a GPU | Tests run with software WebGL and assert pixels, not looks |
