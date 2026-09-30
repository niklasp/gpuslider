# Working on gpu slider

The library is in `src/`, its tests in `tests/`, the site (gpuslider.com) in `site/`. What was decided, and why, is in [PLAN.md](PLAN.md): read the decisions that touch what you change before you change it.

## Set up

Node 22 or later.

```sh
npm install
npx playwright install     # the browsers of the tests
npm run site               # the site, http://localhost:5183/
```

The README says what every script does, under "Run it".

## Before a change goes in

- **Tests.** Run the ones of what you changed: `npx playwright test tests/lightbox.spec.js`, or `--project=site site/tests/pages.spec.js` for the site. `npm test` runs all of them in Chromium, Firefox and WebKit; `npm run test:gpu` the same drawn by WebGPU.
- **Sizes.** `npm run size` fails when a part is over its budget. A budget is changed on purpose only, with the reason in PLAN.md. A change that makes something smaller is always welcome.
- **Types.** `npm run types` makes the declarations from the JSDoc and compiles a file that uses them. A new option or method has its JSDoc.
- **Both layers.** An effect, or a change to what the canvas draws, is in `src/gl/` and in `src/gpu/`, and the tests hold them against each other.
- **The README.** It is the docs: the site cuts it into its pages when it is built. A change that people see is in the README, and a size in it is the one that was measured (a test checks).
- **The numbers of the site** are never written by hand: `npm run size`, `npm run bench -- --write` and `npm run lighthouse` write them into `site/src/lib/`.

## How the code is written

- Plain JavaScript modules with JSDoc in the library, no build to run it; TypeScript and React only on the site.
- Tabs, and spaces inside parentheses and brackets: `fn( a, [ b ] )`. There is no formatter; write like the code around it.
- Names and comments say what a thing is or does, in plain words. A comment says why, when the code cannot.
- No dependencies in the library.

## Commits

One change a commit, with a message that says what it does for someone who uses it, in sentences:

```
The arrows of the lightbox come from the arrows of the slider

As the lightbox opens, its arrows move from where the slider's are to
the sides of the screen, and back as it closes.
```

## Pictures and films

The photos are from Pexels, and each is named where it is used (`site/src/lib/media.ts`). A new one goes into `media/` as a JPEG 1600 px wide; `node bin/make-variants.mjs <name>` makes its AVIF widths.

## The site

It is built with `npm run build --prefix site` into `site/dist/`, and served by Cloudflare as static files at https://gpuslider.com (`site/wrangler.jsonc`). To put it online: `npm run build --prefix site`, then `npx wrangler deploy` in `site/`. What the browser may keep is in `site/public/_headers`. `SITE_URL` sets another address for the links, the sitemap and the previews.
