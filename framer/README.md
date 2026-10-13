# gpu slider for Framer

Pictures that turn into each other by a shader: Liquid, Burn, Ripple or Glitch, drawn with WebGPU, or WebGL 2 where there is none. The free version, with a small link to gpuslider.com in the corner.

## Into a project

1. In Framer: **Assets** (left) → **Code** → **+** → **New code file**, named `GpuSlider`.
2. Replace what is in it with all of [`GpuSlider.tsx`](GpuSlider.tsx), and save (⌘S).
3. Drag **GpuSlider** from Assets → Code onto the canvas, and give it a size.
4. On the right: **Images** (empty: four pictures to try it with), **Transition**, **Autoplay** in seconds (0: only by drag, arrows and dots), Loop, Duration, Arrows, Dots, Fill or Fit, Radius, Background, and a Label for screen readers.
5. **Preview** (▶ at the top right) shows it moving. On the canvas of the editor it is the first picture, standing still: a canvas of WebGL for every copy on the canvas would be too many for the browser.

The library comes from jsDelivr at the version in `VERSION`: a published site keeps working with the same version until the file is changed.

What the Framer Marketplace shows of it, its pictures in `listing/`, and how it is put out and updated: [LISTING.md](LISTING.md).

## What it does where

- Drag, arrows, dots and the keys move it; Autoplay moves it by itself, and waits while the pointer is over it.
- Without autoplay the canvas is made at the first sign of use: the pointer over it, a touch, the focus. Until then, and in a browser that has neither WebGPU nor WebGL 2, the pictures fade.
- Pictures from Framer's own store and from gpuslider.com can be drawn by the canvas: both send CORS. A picture from a site that does not is shown as HTML, without the transition.

## If it does not work

Tell which of these it is:

- **The file shows an error at the `import("https://…")` lines**: Framer did not load the library from the URL.
- **The slider is 0 px high, or ignores its frame**: the sizing.
- **The pictures show, but fade without the transition** in Preview, after the pointer was over it: the canvas could not draw them (CORS), or the browser has no WebGL 2.
