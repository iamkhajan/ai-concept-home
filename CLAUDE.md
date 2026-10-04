# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Hearth — Connected Kitchen": a scroll-driven 3D storytelling page (Three.js + Vite, plain ES modules, no framework, no TypeScript). It walks through a smart-oven scenario (voice request → remote preheat → cooking → voice check-in → ready notification) in a procedurally built kitchen scene, with an HTML phone mockup and speech bubbles overlaid on the canvas.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built `dist/`

There are no tests, linter, or formatter configured.

## Architecture

**State is recomputed from scratch every frame.** `src/story.js` is the core. `STEPS` is an array of `{ cam: [position, target], run(s, t, once) }`. Each frame, `Story.update()` creates a fresh `baseState()` and calls the active step's `run()` with the time elapsed in that step. `run()` mutates the state (person spot/pose, oven door/temp/display, tray location, phone screen data, speech bubble text, story clock, etc.) purely as a function of `t`. This is what keeps scrolling back and forth consistent — never store progress anywhere except as a function of `t`.
- One-shot side effects (visual "signal" pulses between phone/oven/speaker) go through `once(key, cond, fn)`, which fires `fn(fx)` the first time `cond` is true; the fired set resets on step change or restart (`r` key).
- `once` also returns whether it has fired, so it can latch a condition (see step 6's `placed`).

**Step ↔ DOM coupling.** Each `<section class="step" data-step="N">` in `index.html` corresponds to `STEPS[N]`. `main.js` uses an `IntersectionObserver` (center 10% band) to call `story.setStep(N)` and builds the nav dots from the sections. Adding/removing a step means changing both `index.html` and `STEPS`.

**`src/main.js`** owns the renderer, lights, camera, and the `tick()` loop. It consumes the state object and pushes it into each subsystem: `person.update`, `oven.update`, tray placement (`counter | hands | insert | oven | island`, mapped via `TRAY_SPOTS`/`OVEN`), `effects.update`, camera easing toward the step's `cam` keyframe (pulled back on portrait aspect, plus pointer parallax), bubble projection, and `phoneUI.update`.

**Scene modules** (all geometry is procedural boxes/primitives with canvas-generated textures; no external model/texture assets):
- `kitchen.js` — room, cabinets, island, smart speaker; exports shared materials `MAT` and returns handles like `speaker`/`speakerRing`.
- `oven.js` — wall oven tower; `OVEN` holds world-space anchor points (display, rack, insert start, steam origin). The oven display is a 2D canvas drawn into a `CanvasTexture`. `buildTray()` creates the steak tray with a `userData.setDoneness()` hook.
- `person.js` — "Alex"; walks to `SPOTS` positions, poses (`idle | phone | carry`), exposes `arrived`, `trayAnchor`, `phone`, `headWorld()`.
- `effects.js` — signal pulses between world points and oven steam.

**`src/phone.js`** — the phone overlay is DOM, not 3D. `SCREENS` maps screen names (`assistant`, `recipe`, `preheat`, `cooking`, `ready`) to HTML templates; dynamic values are written into `[data-bind=...]`, `[data-ring]`, `[data-press]`, `[data-toast]`, `[data-voice]` etc. `PhoneUI.set()` caches values so the DOM is touched only on change. Adding a phone field means: add it to `baseState().phone`, set it in a step's `run()`, add the hook in the template, and bind it in `PhoneUI.update()`.

**Time.** Story clock is minutes since midnight (`START` = 6:05 PM); `COOK_TIME` is in seconds. `timelapse` toggles the HUD "time-lapse" chip.

**Config.** `src/config.js` `APP_URL` is a placeholder; it's applied to every `[data-app-link]` element.

`dist/` is build output.
