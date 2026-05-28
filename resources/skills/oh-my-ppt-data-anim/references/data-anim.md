# Data Anim Reference

`data-anim` is Oh My PPT's exportable animation DSL. It is the default choice for simple entrance, emphasis, exit, and presentation rhythm animation.

## Supported Types

Use only these values for `data-anim`:

`fade`, `fade-up`, `fade-down`, `fade-left`, `fade-right`, `scale-in`, `slide-up`, `slide-left`, `fly-in`, `wipe`, `zoom-in`, `spin-in`, `grow-shrink`, `pulse`, `exit-fade`, `exit-fly`, `path`

## Attributes

- `data-anim`: required animation type from the supported list.
- `data-anim-trigger`: `load`, `click`, `with`, or `after`. Omit for `load`.
- `data-anim-from`: direction or origin for directional effects: `left`, `right`, `top`, `bottom`, `center`.
- `data-anim-delay`: milliseconds or `stagger(N)`.
- `data-anim-duration`: milliseconds. Prefer 300-1200.
- `data-anim-easing`: anime.js easing string. Prefer common values like `easeOutQuad`, `easeOutCubic`, `easeInOutQuad`.
- `data-anim-repeat`: number or `infinite`. Avoid `infinite` unless the user explicitly asks for looping emphasis.
- `data-anim-direction`: `normal`, `reverse`, or `alternate`.
- `data-anim-path`: SVG path selector or path string for `path`.

## Trigger Choice

Default to static or `load`. Animation should support the slide's reading order, not replace layout.

Use `stagger(N)` for repeated items that should appear in a gentle sequence:

```html
<div data-anim="fade-up" data-anim-delay="stagger(90)">Point 1</div>
<div data-anim="fade-up" data-anim-delay="stagger(90)">Point 2</div>
<div data-anim="fade-up" data-anim-delay="stagger(90)">Point 3</div>
```

Use `with` when a group should start together with the previous animated element:

```html
<h2 data-anim="fade-up">Market Signal</h2>
<p data-anim="fade" data-anim-trigger="with" data-anim-delay="120">Demand is shifting toward AI-native workflows.</p>
```

Use `after` when a short sequence should play automatically:

```html
<div data-anim="fade-up">1. Collect signals</div>
<div data-anim="fade-up" data-anim-trigger="after">2. Cluster patterns</div>
<div data-anim="fade-up" data-anim-trigger="after">3. Prioritize actions</div>
```

Use `click` only for explicit presentation control:

```html
<div data-anim="fade-up" data-anim-trigger="click">First reveal</div>
<div data-anim="fade-up" data-anim-trigger="click">Second reveal</div>
```

Do not infer `click` from "timeline", "process", "steps", or "flow" alone. Those layouts usually work better as static, `load`, `stagger`, `with`, or `after`.

## Directional Examples

```html
<div data-anim="fly-in" data-anim-from="left">Side metric</div>
<div data-anim="wipe" data-anim-from="right">Process bar</div>
<div data-anim="zoom-in">Hero number</div>
<div data-anim="pulse" data-anim-repeat="2" data-anim-direction="alternate">Key risk</div>
```

## Scripted Animation Escape Hatch

Use `PPT.animate(targets, params)` only when `data-anim` cannot express a complex timeline, custom callback, or synchronized choreography:

```js
PPT.animate(".card", {
  opacity: [0, 1],
  translateY: [20, 0],
  duration: 500,
  delay: PPT.stagger(100)
})
```

Create timelines with `PPT.createTimeline(targets, params)`. Use `PPT.stagger(ms)` for staggered scripted delays.

## Forbidden

- Do not call `anime(...)` or `anime.timeline(...)` directly.
- Do not write `PPT.animate({ targets: ".card", ... })`; targets must be the first argument.
- Do not use unsupported `data-anim` values from visual style names, such as `typewriter`, `glitch-in`, or `path-draw`.
- Do not create hidden initial state with `opacity-0`, `invisible`, `visibility:hidden`, `display:none`, inline `opacity:0`, or CSS that hides animated elements.
- Do not add infinite loops unless the user explicitly asks for looping emphasis or continuous decoration.
- Do not use animation to make otherwise unreadable layout depend on motion.
