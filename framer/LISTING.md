# gpu slider on the Framer Marketplace

What the listing says, the pictures it shows, and what is done by hand to put it out. Checked against Framer's pages on 2026-10-13.

## What Framer asks

- **Where:** Framer Community → Marketplace → "Create Listing" → Component. The fields: the component's URL, name, byline, description, a preview URL, images, categories, and a price if it is paid ([How to publish a component](https://www.framer.com/help/articles/how-to-submit-a-component-to-the-marketplace/), updated 2026-09-15).
- **No review:** a component is out the moment it is submitted. Framer says so in the FAQ of the same page: no approval, no waiting. So everything below is checked before, not after.
- **Updates:** a change to the code file does not change the listing. On the listing: ⋯ next to the profile card → New Version → Publish. Right after that the menu has no New Version, and Delete moves to where it was: read before clicking. Name, text, pictures, preview URL and price can be changed at any time.
- **Images:** the listings on the Marketplace use 1600 × 1200 (4:3) PNGs. That was measured on three of them (Simple Gallery, Image Compare, Film Negative); the help pages give no size. Ours are JPEGs of that size, 130 to 190 KB, not 2 MB PNGs in the repo.
- **Live preview:** shown at 4:3 on the listing; the component in the middle of the page.
- **Best practices** ([Component best practices](https://www.framer.com/help/articles/component-best-practices/)): optional, not checked by anyone. Among them: one instance of the component in the preview; no branding, ads or unrelated content in it; no unnecessary text in the thumbnails; no deprecated APIs; a sensible default size; descriptions on complex controls; works on phone, tablet and desktop.
- **Paid:** Framer does not take the payment. A paid listing has a price and a link to a checkout of your own (Lemon Squeezy, Stripe, Gumroad, Contra) that goes straight to paying, shows the same price and a refund policy; after paying, the buyer gets the component URL from you. The pricing of a listing can be changed later ([Accept payments in the Community](https://www.framer.com/help/articles/accept-payments-in-the-community/)).
- **The form** (2026-10-13): Name at most 20 characters, Byline at most 34, one Category, Free or Paid; then Description, Media, Post.
- **Review:** none. Posted on 2026-10-13, it was live at once: https://www.framer.com/marketplace/components/shader-image-slider/ (by @eedee, component URL `https://framer.com/m/GpuSlider-Ols8Ho.js@rFC5ohZfjzu0ZssPyN6r`, project "gpuslider").
- **Name and search** (2026-10-13): the search of the Marketplace reads the name and the byline more than the description. As "gpu slider" it was first for "gpu slider", 39th for "shader", and not in the first 28 for "image slider" or "webgl"; so it is called "Shader Image Slider". The address follows the name, and the old one says "Component unavailable", without a redirect: link to it only after the name is settled.
- **Media:** a component takes one picture, the cover. It may move: an animated WebP (`0-cover.webp`, 1200 × 900, 8.8 s, 3.1 MB). The component goes through Liquid, Burn, Glitch and Lightning by its picker, 1.6 s each (Ripple is left out: with four pictures, four moves come back to the first) and ends where it began, so the loop has no seam; drawn in a browser without a window by a clock of its own (`performance.now` and `requestAnimationFrame` moved 50 ms a frame), then `img2webp -loop 0 -mixed -q 55 -m 6 -d 50`. The still JPEGs are for elsewhere.
- **Code review:** an automatic one on posting. It passed, and proposed `useIsStaticRenderer()` (done) and the library bundled into the file instead of from jsDelivr (not done: publishing, Framer copies it to its own server already).
- **Posting** asks once to accept the affiliate terms.

## Where it may rub

- **A link back.** The best practices ask a preview without branding, and the code is MIT on GitHub, so a badge would not hold anyone; it is gone (2026-10-13). What links back is where others put it too (DNA Carousel, Liquid Carousel, CrumpledPaper Reveal): the description of the last control in the panel, which only who builds with it sees, and the last line of the listing (nofollow there). A Pro version is to be bought for what it does more, not for a badge it takes away.
- **The library from jsDelivr.** The component imports `gpuslider@1.2.2` from cdn.jsdelivr.net. Publishing, Framer copies those files to its own server (framerusercontent.com) and serves them from there: a published site does not ask jsDelivr. Framer runs that (tried in a project on 2026-10-13); its npm FAQ calls imports of packages experimental, and most of them fail because they expect a bundler. This one is a plain ES module and needs nothing. The version is fixed, so a published site does not change under anyone.
- **`defaultProps`** was the deprecated API: React ignores it on functions from 19 on. The defaults are now in the controls (`defaultValue`) and in the code.
- **A Slideshow of Framer's own** exists. The best practices ask not to remake what Framer has: what this one adds is the shader, so the text leads with that.
- **"Liquid Carousel"** (Armand Luxey, free) is in Carousels already. The name and the byline say gpu and shader, not liquid.

## The listing

**Component URL:** in the project that holds the component, Assets → Code → right-click `GpuSlider` → Copy URL.

**Name** (20 at most): Shader Image Slider

**Byline** (34 at most): WebGL slider with shader effects

**Category** (one; the Tags box on the listing shows only it, a second is not possible): Effects, since 2026-10-15. Its neighbours are shaders (Liquid Image, Fluid Image, Pro Liquid Shader); Carousels has plain sliders, and "slider" in the name finds it by search anyway.

**Price:** free

**Preview URL:** the published preview page (see below), `https://gpuslider.framer.website`.

**Description** (as on the Marketplace):

> An image slider and carousel with WebGL shader transitions: one picture melts, burns, ripples, glitches or is struck by lightning into the next. Drawn on the GPU with WebGPU, or WebGL 2 where there is none. Use it as a hero, a gallery or a portfolio slideshow: drag or swipe it, use the arrows, dots or keys, or let it autoplay.
>
> Features
> - Five shader transitions: Liquid, Burn, Ripple, Glitch, Lightning, and a plain Fade
> - Optional picker: buttons that let visitors switch the transition
> - Your own images from Framer's picker; empty, it shows four to try it with
> - Autoplay that pauses on hover; loop, duration, arrows and dots
> - Fill or Fit, corner radius, background, an accessible label for screen readers
> - Responsive: fills its frame at any size and breakpoint, with drag and swipe on mobile
> - Falls back to a fade in browsers without WebGL 2
> - No badge, no watermark, no link on your site
>
> Built on gpu slider, with 24 transitions for your own code: [gpuslider.com](https://gpuslider.com/docs/framer/)

**Images**, in this order, from `framer/listing/`:

1. `1-cover-burn.jpg`: the cover, Burn half way
2. `2-liquid.jpg`: Liquid
3. `3-glitch.jpg`: Glitch

Each is the component itself (its arrows, dots and link), caught in the middle of a transition with the four pictures it shows by default, and nothing else. They were drawn by the published 1.2.1 in a browser without a window.

**Community post** (optional, on submitting):

> gpu slider for Framer, free: images that turn into each other by a shader, Liquid, Burn, Ripple, Glitch. WebGPU, with WebGL 2 where there is none.

## By hand, in order

1. **A project of its own** in Framer, named "gpu slider". The listing takes the component from the project it lives in, so this project stays, and its code file is the one that is updated later. Not the project with the turned slider in it.
2. **The code file:** Assets → Code → + → New code file `GpuSlider`, all of `GpuSlider.tsx` in it, ⌘S.
3. **The preview page,** on Home in the same project:
   - The page background `#0b0a0f`, Desktop breakpoint.
   - One Stack, 100% wide and 100vh high, its content centered.
   - gpu slider in it, 80% wide, 600 px high, Radius 24, Autoplay 3, Picker on. One instance, nothing else on the page.
   - Look at it in Preview at the size of a phone too (the device menu at the top).
4. **Publish the project** (the blue Publish at the top right) to a free `….framer.website` address, for example `gpuslider`. That address is the Preview URL. Open it once in a private window: it moves, and the link opens gpuslider.com.
5. **Copy the component URL:** Assets → Code → right-click GpuSlider → Copy URL.
6. **Your creator profile** in the Framer Community, if there is none yet: name, picture, a link to gpuslider.com.
7. **Create the listing:** Community → Marketplace → Create Listing → Component, and fill it from "The listing" above, with the four images.
8. **Read it all once more, then Submit:** it is out at once.
9. **Afterwards:** install it from the listing in an empty project, as a stranger would, and press Preview.

## Later: a new version

When the library has a new version (1.2.2 for turned sliders): `VERSION` and the three `import()` lines in `GpuSlider.tsx`, then the code file in the "gpu slider" project, then on the listing ⋯ → New Version → Publish.
