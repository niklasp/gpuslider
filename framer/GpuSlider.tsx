/**
 * gpu slider for Framer: pictures that turn into each other by a shader,
 * drawn with WebGPU, or WebGL 2 where there is none. The free version:
 * four transitions, and a small link to gpuslider.com.
 *
 * Paste this file into a code file of a Framer project (Assets → Code).
 * The library comes from jsDelivr, at the version below; the canvas runs
 * in Preview and on the published site, and the editor shows the first
 * picture.
 *
 * https://gpuslider.com/docs/ · MIT
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 500
 */
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

const VERSION = "1.2.2"
const CDN = `https://cdn.jsdelivr.net/npm/gpuslider@${VERSION}/dist/`

const TRANSITIONS = ["liquid", "burn", "ripple", "glitch"] as const
const TITLES = ["Liquid", "Burn", "Ripple", "Glitch"]
type Transition = (typeof TRANSITIONS)[number] | "fade"

type Image = { src: string; srcSet?: string; alt?: string }

// What it shows until it is given pictures of its own.
const DEMO: Image[] = [
    ["p1", "The silhouette of a man with a guitar in front of laser rays"],
    ["p2", "A man kneeling by a boombox in front of neon signs"],
    ["p3", "A woman in sunglasses between neon letters"],
    ["p4", "A couple in an arcade, looking at the camera"],
].map(([name, alt]) => ({
    src: `https://gpuslider.com/media/${name}-1600.avif`,
    srcSet: [720, 960, 1600]
        .map((w) => `https://gpuslider.com/media/${name}-${w}.avif ${w}w`)
        .join(", "),
    alt,
}))

// style.css of the version above, and what Framer needs beside it: the
// slider is as large as its frame.
const CSS = `.gs{--gs-per-view: 1;--gs-gap: 0px;position:relative;min-width:0;overflow:hidden}.gs-track{position:relative;display:flex;gap:var(--gs-gap);overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scrollbar-width:none}.gs-slide{position:relative;flex:0 0 calc((100% - (var(--gs-per-view) - 1) * var(--gs-gap)) / var(--gs-per-view));min-width:0;scroll-snap-align:start}.gs-media{display:block;width:100%;height:100%;object-fit:cover;object-position:var(--gs-focus, 50% 50%)}.gs-content{position:absolute;inset:0;z-index:1}.gs-on{touch-action:pan-y;cursor:grab}.gs-on>.gs-track{overflow:visible;scroll-snap-type:none;will-change:transform}.gs-on.gs-dragging{cursor:grabbing;user-select:none;-webkit-user-select:none}.gs-on:focus-visible{outline:2px solid Highlight;outline-offset:2px}.gs-stack>.gs-track{display:grid;gap:0;will-change:auto}.gs-stack .gs-slide{grid-area:1 / 1;box-sizing:border-box;width:100%;min-height:0}.gs-stack:not(.gs-on)>.gs-track{overflow:hidden}.gs-stack .gs-slide:not(:first-child){visibility:hidden;content-visibility:hidden}.gs-stack .gs-media{opacity:var(--gs-cover, 1)}.gs-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.gs .gs-media.gs-drawn{opacity:0}
.gsf,.gsf>.gs-track,.gsf .gs-slide{height:100%}
.gsf-arrow,.gsf-dots .gs-dot{all:unset;box-sizing:border-box;cursor:pointer;-webkit-tap-highlight-color:transparent}
.gsf-arrow{position:absolute;top:50%;z-index:2;display:grid;place-items:center;width:44px;height:44px;border-radius:999px;background:rgba(0,0,0,.4);color:#fff;transform:translateY(-50%);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);transition:background .2s}
.gsf-arrow:hover{background:rgba(0,0,0,.65)}.gsf-arrow:focus-visible{outline:2px solid #fff;outline-offset:2px}.gsf-arrow svg{display:block;width:20px;height:20px}.gsf-prev{left:16px}.gsf-next{right:16px}
.gsf-dots{position:absolute;left:0;right:0;bottom:12px;z-index:2;display:flex;justify-content:center}
.gsf-dots .gs-dot{display:grid;place-items:center;width:16px;height:24px;transition:width .3s}
.gsf-dots .gs-dot::before{content:"";width:8px;height:8px;border-radius:999px;background:rgba(255,255,255,.4);transition:background .2s,width .3s}
.gsf-dots .gs-dot[aria-current]{width:30px}.gsf-dots .gs-dot[aria-current]::before{width:22px;background:#fff}
.gsf-badge{position:absolute;top:10px;right:10px;z-index:3;padding:3px 8px;border-radius:6px;background:rgba(0,0,0,.45);color:rgba(255,255,255,.85);font:11px/1.4 system-ui,sans-serif;text-decoration:none;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.gsf-badge:hover{color:#fff}
.gsf-picker{position:absolute;top:10px;left:10px;z-index:3;display:flex;gap:2px;max-width:calc(100% - 180px);padding:3px;overflow-x:auto;border-radius:999px;background:rgba(0,0,0,.3);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);scrollbar-width:none;backdrop-filter:blur(20px) saturate(1.5);-webkit-backdrop-filter:blur(20px) saturate(1.5)}
.gsf-picker button{all:unset;box-sizing:border-box;flex:none;height:30px;padding:0 12px;border-radius:999px;color:rgba(255,255,255,.7);font:500 13px/30px system-ui,sans-serif;cursor:pointer;transition:background .3s,color .3s}
.gsf-picker button:hover{color:#fff}.gsf-picker button[aria-current]{background:#fff;color:#000}.gsf-picker button:focus-visible{outline:2px solid #fff;outline-offset:1px}
@media (max-width:480px){.gsf-picker{max-width:calc(100% - 20px)}.gsf-picker+.gsf-badge{display:none}}`

function useStyles() {
    useEffect(() => {
        // Written again if it is there: a style of an earlier edit is
        // replaced, not kept.
        let style = document.getElementById("gpuslider-framer")
        if (!style) {
            style = document.createElement("style")
            style.id = "gpuslider-framer"
            document.head.append(style)
        }
        style.textContent = CSS
    }, [])
}

// What it is until it is set otherwise: here, and in the controls
// (`defaultValue`), as Framer reads them; not `defaultProps`, which React
// leaves to classes.
const DEFAULTS = {
    transition: "liquid" as Transition,
    autoplay: 4,
    loop: true,
    duration: 1200,
    arrows: true,
    dots: true,
    fit: "cover" as "cover" | "contain",
    radius: 0,
    background: "#0a0a0a",
    label: "Pictures",
    picker: false,
}

interface Props {
    images?: Image[]
    transition?: Transition
    autoplay?: number
    loop?: boolean
    duration?: number
    arrows?: boolean
    dots?: boolean
    fit?: "cover" | "contain"
    radius?: number
    background?: string
    label?: string
    picker?: boolean
    style?: CSSProperties
}

// Lucide's chevrons, as on gpuslider.com: ‹ and › sit where each font
// puts them.
function Chevron({ d }: { d: string }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

export default function GpuSlider(props: Props) {
    const {
        transition = DEFAULTS.transition,
        autoplay = DEFAULTS.autoplay,
        loop = DEFAULTS.loop,
        duration = DEFAULTS.duration,
        arrows = DEFAULTS.arrows,
        dots = DEFAULTS.dots,
        fit = DEFAULTS.fit,
        radius = DEFAULTS.radius,
        background = DEFAULTS.background,
        label = DEFAULTS.label,
        picker = DEFAULTS.picker,
        style,
    } = props
    const images = props.images?.length ? props.images : DEMO
    const root = useRef<HTMLDivElement>(null)
    const turn = useRef<{ pick: (i: number) => void } | null>(null)
    const made = useRef<{ next(): void } | null>(null)
    // On the canvas of the editor and in thumbnails: the first picture,
    // and no canvas of WebGL for every copy of it.
    const still =
        RenderTarget.current() === RenderTarget.canvas ||
        RenderTarget.current() === RenderTarget.thumbnail
    useStyles()

    const given = TRANSITIONS.indexOf(transition as (typeof TRANSITIONS)[number])
    // What the picker chose, until the transition is set again.
    const [picked, setPicked] = useState<number | null>(null)
    useEffect(() => setPicked(null), [given])
    const order = picked ?? given

    useEffect(() => {
        const element = root.current
        if (still || !element) return
        let slider: { destroy(): void; next(): void } | undefined
        let gone = false
        Promise.all([
            import("https://cdn.jsdelivr.net/npm/gpuslider@1.2.2/dist/full.js"),
            import("https://cdn.jsdelivr.net/npm/gpuslider@1.2.2/dist/canvas.js"),
            import("https://cdn.jsdelivr.net/npm/gpuslider@1.2.2/dist/effects.js"),
        ]).then(([full, gpu, effects]) => {
            if (gone) return
            const chosen = effects.choose(
                TRANSITIONS.map((name) => effects[name]()),
                Math.max(0, order)
            )
            turn.current = chosen
            slider = full.createSlider(element, {
                mode: "stack",
                loop,
                duration,
                autoplay: autoplay > 0 ? autoplay * 1000 : 0,
                plugins: [
                    gpu.canvas({
                        effects: order < 0 ? [] : [chosen],
                        // The canvas comes at the first sign of use; a
                        // slider that plays by itself needs it before.
                        eager: autoplay > 0,
                    }),
                ],
            })
            made.current = slider!
        })
        return () => {
            gone = true
            turn.current = null
            made.current = null
            slider?.destroy()
        }
        // The transition is picked without a new slider, below; a change
        // between one and none makes it again.
    }, [still, images.map((one) => one.src).join(" "), loop, duration, autoplay, order < 0])

    useEffect(() => {
        if (order >= 0) turn.current?.pick(order)
    }, [order])

    return (
        <div
            ref={root}
            className="gs gs-stack gsf"
            aria-label={label}
            style={{
                ...style,
                width: "100%",
                height: "100%",
                borderRadius: radius,
                background,
            }}
        >
            <div className="gs-track">
                {images.map((one, i) => (
                    <div className="gs-slide" key={`${one.src} ${i}`}>
                        <img
                            className="gs-media"
                            src={one.src}
                            srcSet={one.srcSet}
                            sizes="100vw"
                            alt={one.alt || ""}
                            // Framer's and gpuslider.com's pictures may be
                            // drawn by the canvas: both send CORS.
                            crossOrigin="anonymous"
                            draggable={false}
                            style={{ objectFit: fit }}
                        />
                    </div>
                ))}
            </div>
            {arrows && images.length > 1 && (
                <>
                    <button
                        type="button"
                        className="gsf-arrow gsf-prev"
                        data-gs-prev=""
                        aria-label="Previous picture"
                    >
                        <Chevron d="m15 18-6-6 6-6" />
                    </button>
                    <button
                        type="button"
                        className="gsf-arrow gsf-next"
                        data-gs-next=""
                        aria-label="Next picture"
                    >
                        <Chevron d="m9 18 6-6-6-6" />
                    </button>
                </>
            )}
            {dots && images.length > 1 && (
                <div className="gsf-dots" data-gs-dots="" />
            )}
            {picker && (
                <div className="gsf-picker" role="group" aria-label="Transition">
                    {TRANSITIONS.map((name, i) => (
                        <button
                            type="button"
                            key={name}
                            aria-current={order === i ? "true" : undefined}
                            onClick={() => {
                                // Chosen for the next move, and moved, so
                                // that it is seen.
                                turn.current?.pick(i)
                                setPicked(i)
                                if (order >= 0) made.current?.next()
                            }}
                        >
                            {TITLES[i]}
                        </button>
                    ))}
                </div>
            )}
            <a
                className="gsf-badge"
                href="https://gpuslider.com/?ref=framer"
                target="_blank"
                rel="noopener"
            >
                Made with gpu slider
            </a>
        </div>
    )
}

GpuSlider.displayName = "gpu slider"

addPropertyControls(GpuSlider, {
    images: {
        type: ControlType.Array,
        title: "Images",
        control: { type: ControlType.ResponsiveImage },
        description: "Empty: four pictures to try it with.",
    },
    transition: {
        type: ControlType.Enum,
        title: "Transition",
        defaultValue: DEFAULTS.transition,
        options: [...TRANSITIONS, "fade"],
        optionTitles: ["Liquid", "Burn", "Ripple", "Glitch", "Fade"],
    },
    autoplay: {
        type: ControlType.Number,
        title: "Autoplay",
        defaultValue: DEFAULTS.autoplay,
        min: 0,
        max: 20,
        step: 0.5,
        unit: "s",
        description: "0: only by drag, arrows and dots.",
    },
    loop: {
        type: ControlType.Boolean,
        title: "Loop",
        defaultValue: DEFAULTS.loop,
    },
    duration: {
        type: ControlType.Number,
        title: "Duration",
        defaultValue: DEFAULTS.duration,
        min: 300,
        max: 3000,
        step: 100,
        unit: "ms",
    },
    arrows: {
        type: ControlType.Boolean,
        title: "Arrows",
        defaultValue: DEFAULTS.arrows,
    },
    dots: {
        type: ControlType.Boolean,
        title: "Dots",
        defaultValue: DEFAULTS.dots,
    },
    fit: {
        type: ControlType.Enum,
        title: "Fit",
        defaultValue: DEFAULTS.fit,
        options: ["cover", "contain"],
        optionTitles: ["Fill", "Fit"],
        displaySegmentedControl: true,
    },
    radius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: DEFAULTS.radius,
        min: 0,
        max: 80,
        unit: "px",
    },
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: DEFAULTS.background,
    },
    picker: {
        type: ControlType.Boolean,
        title: "Picker",
        defaultValue: DEFAULTS.picker,
        description: "Buttons on it to try the transitions.",
    },
    label: {
        type: ControlType.String,
        title: "Label",
        defaultValue: DEFAULTS.label,
        description: "What a screen reader says the slider is.",
    },
})
