---
name: oh-my-ppt-chart
description: Must be read before adding or modifying Oh My PPT slide charts. Defines product-safe Chart.js usage, canvas layout constraints, axis label rules, and retry fixes.
---

# Oh My PPT Chart

Use this skill whenever you add, modify, or repair a chart in an Oh My PPT slide.

Read `references/chart.md` before writing chart HTML or JavaScript.

Core rules:

- Create charts with `PPT.createChart(canvasEl, config)`.
- Do not call `new Chart(ctx, config)` directly.
- Put each chart canvas inside a dedicated `.ppt-chart-frame` with a model-chosen explicit `h-[Npx]` height.
- Do not put `<canvas>` directly inside a text block, metric card body, or generic flex child without a stable chart frame.
- Pass the canvas element to `PPT.createChart(...)`, not `canvas.getContext('2d')`.
- Put category labels in `data.labels`.
- If a category-axis `ticks.callback` is necessary, return `this.getLabelForValue(value)`.
- Keep chart code local and deterministic; do not fetch remote data, load CDN assets, or depend on runtime network calls.
