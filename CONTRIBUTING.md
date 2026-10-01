# Working on gpu slider

The library is in `src/`, its tests in `tests/`, the site (gpuslider.com) in `site/`. What was decided, and why, is in [PLAN.md](PLAN.md): read the decisions that touch what you change before you change it.

## Set up

Node 22 or later.

```sh
npm install
npx playwright install     # the browsers of the tests
npm run site               # the site, http://localhost:5183/
```

What every script does is under [The scripts](#the-scripts).

## The scripts

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

## The site, in detail

`npm run site`, http://localhost:5183/: a site of Vite and React. What is to be seen of the library is there, and nowhere else.

| | |
|---|---|
| `/` | What the library is: what it does, what it weighs, how fast it is, and where to go from there |
| `/docs/` | The docs, in eleven pages. What they say is `DOCS.md`, cut into pages when the site is built (`site/docs.ts`): it is said in one place. Most pages show what they say, with sliders to try it on |
| `/examples/` | The three pages below, with a picture each |
| `/examples/reel/` | One picture or film at a time, as large as the screen, that turn into each other. The screen before it is made of the events of `loading()`: a number that runs, a curtain that goes up |
| `/examples/tape/` | Rows that run against each other on a page that scrolls. The scrolling pushes them, and what is pushed gives way. The loading screen is the one of the library |
| `/playground/` | Every layout, every effect and transition, the lightbox, the loading screen, buttons anywhere and the events, with controls for all of it. Under every slider: who draws it, and what a frame costs |
| `/phone/` | To be opened on a phone: what it has, what a finger is to try, and a measuring of both layers. What it finds is text to copy |

`?layer=gl` and `?layer=gpu` on the examples say who draws.

`npm run phone` builds the site and serves it to a phone in the same network, with https (WebGPU asks for it) and a certificate that nobody has signed: the phone warns once.

No number of the site is written by hand. The sizes are written by `npm run size`, the times by `npm run bench -- --write`, what Lighthouse says by `npm run lighthouse`, all into `site/src/lib/`.

`bench/` is a page without a build, for `npm run bench` and for the browser that opens it: `npm start`, http://localhost:4173/bench/.

## Before a change goes in

- **Tests.** Run the ones of what you changed: `npx playwright test tests/lightbox.spec.js`, or `--project=site site/tests/pages.spec.js` for the site. `npm test` runs all of them in Chromium, Firefox and WebKit; `npm run test:gpu` the same drawn by WebGPU.
- **Sizes.** `npm run size` fails when a part is over its budget. A budget is changed on purpose only, with the reason in PLAN.md. A change that makes something smaller is always welcome.
- **Types.** `npm run types` makes the declarations from the JSDoc and compiles a file that uses them. A new option or method has its JSDoc.
- **Both layers.** An effect, or a change to what the canvas draws, is in `src/gl/` and in `src/gpu/`, and the tests hold them against each other.
- **The docs.** `DOCS.md` is the docs: the site cuts it into its pages when it is built, and it is in the package. A change that people see is in it, and a size in it is the one that was measured (a test checks). `README.md` is what npm and GitHub show: what the library is and how to start, not every detail.
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

## Community plugins

The page of community plugins lists the packages named in `site/community.json`, and nothing else. Every day `.github/workflows/community.yml` runs `bin/community.mjs`, which opens an issue with the label `plugin review` for every package on npm with the keyword `gpuslider-plugin` or `gpuslider-effect` that is not listed and has no issue yet. `node bin/community.mjs --dry` says what it would open.

To review: what the package does on install (`scripts`), what it loads, and whether it does what it says. Yes: add its name to `approved` and close the issue with that commit. No: close the issue; it is not opened again. A package that turns bad later is taken off the list the same way.

## Putting out a version

In a terminal of your own, on `main` with everything committed:

```sh
npm run release          # a fix: 1.0.2 → 1.0.3
npm run release:minor    # something new: 1.0.2 → 1.1.0
npm run release:major    # something that breaks: 1.0.2 → 2.0.0
```

It runs the tests (a test that fails is run again once, alone), raises the version, builds `dist/` and the types, commits and tags, publishes to npm (the browser asks for your passkey), pushes, and puts the site online. `-- --no-tests` leaves the tests out, `-- --no-site` the site. If npm did not publish, `npm run release -- --publish-only` goes on from there. What each step does is in `bin/release.mjs`.

## Putting the site online

It is built with `npm run build --prefix site` into `site/dist/`, and served by Cloudflare as static files at https://gpuslider.com (`site/wrangler.jsonc`). To put it online: `npm run build --prefix site`, then `npx wrangler deploy` in `site/`. What the browser may keep is in `site/public/_headers`. `SITE_URL` sets another address for the links, the sitemap and the previews.
