---
name: oh-my-ppt-chart
description: Must be read before adding or modifying Oh My PPT slide charts. Defines product-safe Chart.js usage, canvas layout constraints, axis label rules, and retry fixes.
---

# Oh My PPT Chart

Use this skill whenever you add, modify, or repair a chart in an Oh My PPT slide.

Read `references/chart.md` before writing chart HTML or JavaScript.

## How to create a chart

Every chart needs exactly two things: an HTML frame and a script block. Copy this pattern and adapt the config.

### 1. HTML — chart frame with explicit height

```html
<div class="ppt-chart-frame relative h-[CHOSEN_PX] w-full overflow-hidden">
  <canvas id="my-chart" class="h-full w-full"></canvas>
</div>
```

Choose `CHOSEN_PX` from the slide's vertical budget. The frame is the chart's only stable height source.

### 2. JavaScript — always use DOMContentLoaded + PPT.createChart

```html
<script>
document.addEventListener('DOMContentLoaded', function() {
  PPT.createChart(document.getElementById('my-chart'), {
    type: 'bar',
    data: {
      labels: ['A', 'B'],
      datasets: [{ data: [10, 20] }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
});
</script>
```

This is the only correct event and the only correct API. The runtime loads Chart.js before `DOMContentLoaded` fires, so the helper is always available inside this callback.

## Quick rules

- Use `PPT.createChart(canvasElement, config)` — pass the canvas DOM element, not a 2D context.
- Put category labels in `data.labels`. If a category-axis `ticks.callback` is needed, return `this.getLabelForValue(value)`.
- Choose the chart frame height from the slide layout: hero charts get more space, supporting charts get less.
- Keep chart code local and deterministic.
