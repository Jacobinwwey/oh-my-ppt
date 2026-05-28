# Chart Reference

Oh My PPT loads Chart.js and exposes the product helper `PPT.createChart(canvasEl, config)`. Use the helper so preview, validation, and export workflows see charts consistently.

## Required Structure

Always give the canvas a direct parent chart frame with an explicit pixel height that you choose for the actual slide layout:

```html
<div class="ppt-chart-frame relative h-[CHOSEN_PX] w-full">
  <canvas class="h-full w-full"></canvas>
</div>
```

Do not rely on `h-full`, `flex-1`, `min-h-*`, or a surrounding card to determine chart height. The direct parent must carry the stable height.

`CHOSEN_PX` is a placeholder. Replace it with a real pixel value such as `360px` or any other value you judge from the slide. The model must decide the height from the slide composition, content density, available vertical space, label length, legend placement, and the chart's narrative importance.

- Hero or primary charts should occupy most of the main content area.
- Charts paired with explanation text should leave enough room for both the chart and the surrounding reading path.
- Small supporting charts can be shorter, but must still be readable at presentation distance.
- Dense labels, legends, or many categories need more height, not smaller text.

Never copy a fixed height mechanically. The requirement is that you choose an explicit `h-[Npx]` height, not a specific number.

Avoid Tailwind scale shortcuts like `h-64`, `h-72`, or `h-80` for chart frames. Use `h-[Npx]` so the chosen height is deliberate and visible in the HTML.

## Required JavaScript

```js
const chart = PPT.createChart(canvasEl, {
  type: "bar",
  data: {
    labels: ["A", "B"],
    datasets: [{ data: [10, 20] }]
  },
  options: {}
})
```

Use `canvasEl` or a selected canvas element as the first argument. Do not pass `canvas.getContext('2d')`, do not pass a 2D context variable, and do not call `new Chart(...)`.

## Category Axis Labels

Put category labels in `data.labels`:

```js
data: {
  labels: ["Q1", "Q2", "Q3"],
  datasets: [{ data: [12, 18, 26] }]
}
```

Avoid custom `ticks.callback` on category axes. If a callback is truly necessary, use a normal function and return the label:

```js
ticks: {
  callback: function(value) {
    return this.getLabelForValue(value)
  }
}
```

Do not return `value` directly on category axes, because it renders indexes like `0`, `1`, `2`.

## Layout Rules

- Reserve enough visual space for legends, long labels, and axis ticks.
- Prefer fewer categories over tiny unreadable labels.
- Use chart containers as dedicated visual modules, not as decoration nested deep inside cards.
- Use responsive Chart.js options only when they work with the explicit-height frame.
- Avoid absolute positioning for chart canvases unless the chart frame itself has stable dimensions.

## Forbidden

- `new Chart(ctx, config)`
- `PPT.createChart(canvas.getContext('2d'), config)` or any 2D context argument
- `<canvas class="h-full w-full">` without an explicit-height direct parent
- `.ppt-chart-frame` using `h-full`, `flex-1`, `min-h-*`, or scale shortcuts like `h-64` instead of a deliberate `h-[Npx]`
- `canvas` directly in a text/card body without `.ppt-chart-frame`
- Remote data fetches, CDN plugins, or runtime network dependency
- Category-axis callbacks that return raw numeric `value`
