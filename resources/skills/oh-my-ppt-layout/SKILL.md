---
name: oh-my-ppt-layout
description: Must be read before creating, relaying out, or repairing Oh My PPT slide layouts. Defines slide archetypes, density decisions, canvas budgeting, collision avoidance, and title readability rules.
---

# Oh My PPT Layout

Use this skill whenever you create a new slide, rewrite a whole slide, choose a slide composition, repair overflow/collision, or handle a layout intent such as cover, data-focus, comparison, timeline, process, concept, summary, quote, or image-focus.

Read `references/layout.md` before making layout decisions.

## How to lay out a slide

### 1. Decide archetype, then write HTML

Before writing any HTML, decide in order:

1. **Slide role**: cover, section divider, big number, key message, text-image, list, data exhibit, comparison, timeline/process, framework/matrix, quote, Q&A, executive summary, closing takeaway.
2. **Reading path**: what the audience sees first, understands second, and remembers last.
3. **Density**: low, medium, or high.
4. **Module budget**: title area, main visual/data area, supporting evidence, annotation/footer if truly needed.
5. **Height budget**: outer margins + title + modules + gaps + chart/tables + notes must fit in 884px.

### 2. Use grid/flex flow for body content

- Lay out body content with grid/flex document flow.
- Use `absolute`/`fixed` only for background decoration, connectors, and non-text visual accents.
- Elements containing h1, h2, h3, p, li, or primary slide text must use grid/flex cells, not absolute positioning.

### 3. Minimum font size is 16px — no exceptions

Every piece of visible text on the slide must be at least 16px. Use `text-base` (16px) as the smallest class.

- Use `text-base` for body text, labels, annotations, footnotes, and source lines.
- Use `text-lg` or `text-xl` for subtitles, card titles, and metric labels.
- Use `text-2xl` to `text-5xl` for headings and hero numbers.
- `text-xs` (12px), `text-sm` (14px), `text-[12px]`, `text-[14px]`, `text-[13px]` — never use any of these. They are unreadable at presentation distance.

If text does not fit, shorten the text or reduce the number of modules. Never shrink below 16px.

### 4. Each slide focuses on one claim

If content exceeds one slide, reduce modules, merge points, shorten text, or prioritize the main conclusion and strongest evidence.

## When content feels thin — how to fill the whole page

Clean layout does not mean empty. When source content is short, turn one idea into a richer visual argument that occupies the full canvas. The page should feel intentionally composed, not like content was abandoned halfway.

### Strategies for sparse content

1. **Expand the argument structure**: a single claim can be supported with context, comparison, baseline, reason, implication, or a "so what" line.
2. **Add a visual anchor**: build a simple diagram, axis, progress bar, timeline strip, comparison bracket, or quadrant using divs/SVG. This occupies visual space and communicates structure.
3. **Use an evidence rail**: 2-4 small supporting cards, metric chips, or contextual anchors alongside the main message.
4. **Split into zones**: divide the page into 2-3 areas (claim + evidence, number + context, before + after, cause + effect) so the full canvas has purposeful content.
5. **Give the main idea more room**: scale up the hero text or number, add a short subtitle for scope/audience/time, and let whitespace frame it intentionally.

### Sparse-slide composition patterns

- **Big claim + evidence rail**: hero statement on one side, 3 supporting cards on the other. Use `grid grid-cols-[1fr_1fr]` or `grid grid-cols-[2fr_1fr]`.
- **Key number + context**: one large metric, a baseline/previous value, and a short interpretation block. Arrange vertically or left-right.
- **Before/after contrast**: two large zones with 2-3 concrete differences. Use `grid grid-cols-2`.
- **Cause → effect chain**: 3 steps with short text and a final implication. Use `grid grid-cols-3` or horizontal flex with arrow connectors.
- **Center concept + satellites**: one central idea with 3 surrounding explanation blocks in explicit grid cells. Use a 3x3 or custom grid.
- **Image/scene + annotations**: visual-dominant area with 2-4 labeled annotations. Use `grid grid-cols-[2fr_1fr]`.

Do not fill space with: emoji, stickers, decorative meta rows, fabricated metrics, repeated summaries, or empty cards.

## Layout intent composition guide

Each intent describes a slide's narrative purpose. Use these as starting points — adapt freely based on the actual content.

### `cover` — opening or section divider

The title or core message is the visual focus.

- Large title at visual center or dominant position.
- Add a short subtitle for scope, date, or one-line thesis.
- Optional: accent line, small author/date label, background color block or gradient.
- Composition: centered hero, left-aligned hero with decorative band, or asymmetric with title on one side and visual accent on the other.

### `data-focus` — metrics, KPIs, charts, quantitative evidence

Numbers and data visuals dominate the page.

- 1-2 hero numbers with large scale, each supported by a label, unit, and brief context (baseline, change, period).
- If using charts: give them the largest area on the page. Budget chart height from the remaining space after title and labels.
- Optional: comparison bars, sparklines, or a small table as secondary evidence.
- Composition: metrics row + chart below; chart hero + sidebar numbers; or 2x2 metric grid with one chart.

### `comparison` — 2+ options, alternatives, before/after

Make differences easy to compare side by side.

- Split the canvas into 2-3 comparison zones with clear visual boundaries.
- Each zone should show the same dimensions (features, metrics, pros/cons) for fair comparison.
- Use consistent card structure but different accent colors or icons to distinguish sides.
- Composition: two equal columns; three-column feature matrix; before (left) → after (right) with arrow.

### `timeline` — phases, stages, roadmap, progression

Show progression through time or stages.

- Horizontal timeline strip with labeled nodes and brief descriptions below each.
- Or vertical timeline with alternating left-right cards.
- Each phase needs: label, time/step indicator, 1-2 sentences.
- Optional: progress indicator, connecting line, milestone markers.
- Composition: horizontal strip + description cards below; vertical staircase; or phase blocks in a grid.

### `concept` — ideas, frameworks, principles

Explain a concept with clear visual hierarchy.

- Central idea at the core, with supporting dimensions radiating outward.
- Or a structured breakdown: definition + key aspects + example.
- Use diagrams, matrices, or labeled zones to make abstract ideas concrete.
- Composition: center + satellites in grid; 3-column aspect breakdown; definition card + 3 supporting blocks.

### `process` — steps, flow, mechanism, cause-and-effect

Show how something works step by step.

- Numbered or arrow-connected steps flowing left-to-right or top-to-bottom.
- Each step: short title + 1-2 sentences explaining what happens.
- Optional: simple flow diagram using divs/SVG with arrows.
- Composition: horizontal step cards with arrows; vertical numbered list with descriptions; or input → process → output zones.

### `summary` — conclusion, takeaways, synthesis

Lead with the conclusion, then compact supporting evidence.

- Opening conclusion or key takeaway in large text at the top or center.
- 2-4 compact evidence blocks or metric summaries below.
- Optional: action items, next steps, or a brief "what this means" line.
- Composition: hero conclusion + evidence row; conclusion card + 3 supporting metrics; or numbered key takeaways.

### `quote` — single statement or judgment

The statement itself is the main visual anchor.

- Large quotation text occupying most of the page.
- Attribution below or beside the quote.
- Optional: a brief context line explaining why this matters.
- Composition: centered quote with generous whitespace; quote on one side + context on the other; or quote overlay on background accent.

### `image-focus` — products, scenes, visual material

Visual material dominates, text supports it.

- Image or visual element takes 60-70% of the page area.
- Text is compact: title, 1-2 description lines, maybe labels or annotations.
- Optional: caption, source, or annotation callouts pointing to parts of the image.
- Composition: image left + text right; full-bleed image with text overlay strip; or image center + annotation cards around edges.
