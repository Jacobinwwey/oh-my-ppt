# Chart Reference

Oh My PPT loads Chart.js and exposes `PPT.createChart(canvasEl, config)`. Use the helper so preview, validation, and export workflows see charts consistently.

## Complete working example

Copy this pattern for every chart. Adapt the type, data, and options.

```html
<div class="ppt-chart-frame relative h-[320px] w-full overflow-hidden">
  <canvas id="chart-sales" class="h-full w-full"></canvas>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  PPT.createChart(document.getElementById('chart-sales'), {
    type: 'bar',
    data: {
      labels: ['Q1', 'Q2', 'Q3'],
      datasets: [{
        label: 'Revenue',
        data: [12, 18, 26]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
});
</script>
```

## Chart frame height

The `.ppt-chart-frame` direct parent must carry an explicit `h-[Npx]` height. Choose the value from the slide layout:

- Hero or primary charts: taller, occupying most of the main content area.
- Charts paired with text: leave room for both chart and reading path.
- Small supporting charts: shorter, but still readable at presentation distance.
- Dense labels, legends, or many categories: more height, not smaller text.

Use `h-[Npx]` (e.g. `h-[360px]`, `h-[240px]`). Do not use `h-full`, `flex-1`, `min-h-*`, or Tailwind scale shortcuts like `h-64` for the chart frame height.

## Chart script rules

- Always wrap in `document.addEventListener('DOMContentLoaded', function() { ... })`. This is the only event the runtime guarantees. The runtime never fires `ppt-ready`, `ppt-rendered`, `ppt-page-ready`, or any similar event.
- Always call `PPT.createChart(canvasElement, config)`. Pass the canvas DOM element as the first argument.
- Always call `PPT.createChart` — never `new Chart(...)`.

## Category axis labels

Put category labels in `data.labels`:

```js
data: {
  labels: ['Q1', 'Q2', 'Q3'],
  datasets: [{ data: [12, 18, 26] }]
}
```

If a `ticks.callback` is truly needed on a category axis, use a normal function and return the label:

```js
ticks: {
  callback: function(value) {
    return this.getLabelForValue(value);
  }
}
```

## Layout

- Reserve space for legends, long labels, and axis ticks.
- Prefer fewer categories over tiny unreadable labels.
- Use chart containers as dedicated visual modules, not as decoration nested inside cards.
- Use `responsive: true` and `maintainAspectRatio: false` in chart options — they work with the explicit-height frame.
