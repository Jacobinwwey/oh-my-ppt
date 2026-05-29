# Oh My PPT Layout Reference

This reference is the product source of truth for slide layout decisions in Oh My PPT.

## Canvas Model

Design for the original 16:9 canvas: 1600x900. Preview scaling only fits the window; it is not a layout fallback.

The usable content area is about 1584x884 because the runtime frame has outer padding. All titles, body text, charts, notes, and decorative elements must fit in that area.

Use Tailwind grid/flex layout. Do not lock the canvas with `w-[1600px]`, `h-[900px]`, `100vw`, `100vh`, `w-screen`, or `h-screen`.

Avoid viewport-based text such as `vw`, `vh`, or `text-[clamp(...)]`. Use `text-5xl` as the largest normal h1 scale. Do not use `text-6xl`, `text-7xl`, or `text-8xl`.

Minimum readable font size is 16px (`text-base`). This applies to all visible text: body, labels, annotations, footnotes, and source lines. Never use `text-xs` (12px), `text-sm` (14px), `text-[12px]`, `text-[13px]`, `text-[14px]`, or any value below 16px. If text does not fit, shorten the text or reduce modules — do not shrink the font.

Do not use iframe. Do not reference runtime frame class names (.ppt-page-root, .ppt-page-content, .ppt-page-fit-scope, data-ppt-guard-root).

All main content must be fully visible within the 1600x900 canvas. Do not rely on overflow-hidden clipping, scrollbars, runtime scaling, or smaller font sizes as fallbacks.

## Density Rules

Low-density slides:

- Use large title/message scale, one core number, one strong visual symbol, generous whitespace, diagonal composition, or asymmetric layout.
- Sparse content should feel intentional. Use whitespace and rhythm as design, not empty filler.

Medium-density slides:

- Use primary/secondary zones, one main visual plus 2-3 supporting evidence blocks, left-right narrative, timeline, step ladder, matrix, or comparison structure.
- Keep a clear hierarchy between the main message and supporting points.

High-density slides:

- Use disciplined grids, tables, compact lists, or multi-card structures.
- Module count should be justified by real information volume.
- Use equal-weight cards only when the items are truly parallel and equally important.
- Use 4-column cards only for a real four-object comparison.

If content is too large, keep the main conclusion and strongest evidence. Remove secondary explanations, repeated summaries, decorative meta rows, and low-value cards.

## Title Readability

Titles are part of the reading path, not a fixed header decoration.

- Cover and summary slides may put the title/message at the visual center.
- Data slides may place the title near a key number or beside the chart.
- Comparison slides should place the title where it clarifies the contrast.
- Within one deck, avoid repeating the same title position and card grid on consecutive pages.
- Vertical title text is only acceptable for short Chinese labels of 2-6 characters.
- Titles containing English, numbers, years, mixed Chinese-English text, or long phrases must be horizontal.
- Preserve the full title's readability. Do not sacrifice reading for decoration.

## Collision Avoidance

Body content, cards, titles, charts, and lists must be carried by normal grid/flex flow.

Use `absolute` or `fixed` only for:

- background decorations
- connector lines
- non-text SVG marks
- visual accents that do not carry body text

Elements containing `h1`, `h2`, `h3`, `p`, `li`, or primary slide text should not use `absolute` or `fixed`.

For radial, five-point, surround, or center-image layouts, use an explicit grid. For example, a three-column, three-row grid can allocate left-top, center-top, right-top, left-bottom, right-bottom, and center cells. Put the center visual and each explanation card in its own grid cell. Connector lines can be an SVG decoration layer.

Every major content area needs stable size and spacing:

- Put `gap-*` on grid/flex containers.
- Put `min-w-0` on long-text grid/flex children.
- Avoid several nested vertical levels all using `h-full`, `min-h-*`, large padding, large gaps, and long paragraphs.

## Height Budgeting

Before writing, estimate the vertical budget:

- outer margins/padding
- title and subtitle area
- module rows or chart area
- gaps between modules
- annotations or footnotes
- any decorative band that consumes actual space

Charts, tables, timelines, and long lists must share the same budget as titles and notes. Do not fill the canvas with a chart first and then squeeze explanations outside the page.

If a slide needs a chart, also follow the chart skill. The chart frame height must be budgeted as part of the slide height plan before writing HTML, and the direct `.ppt-chart-frame` parent must use a deliberate explicit height that fits alongside the title, notes, labels, and supporting modules.

Avoid combining h-full, min-h-*, large padding, large gaps, and multi-paragraph text across several nested vertical levels. This combination is the most common cause of content exceeding the canvas.

## Sparse-content visual fullness patterns

When source content is short, the goal is not to add fake facts. The goal is to make the page feel intentionally composed by turning one idea into a richer visual argument.

Use HTML structure to create visual fullness:

- Strong message area: one large title or thesis, plus a short subtitle that clarifies scope, time, audience, or implication.
- Evidence rail: a small number of compact supporting chips or mini cards with qualitative evidence, source labels, or contextual anchors.
- Reading path: a left-to-right, top-to-bottom, or center-plus-side structure that shows what to read first and what supports it.
- Anchor visual: a simple diagram, scale marker, axis, timeline strip, progress bar, quadrant, or comparison bracket built with divs/SVG.
- Interpretation note: one compact "so what" line, risk note, or implication callout.
- Grounding footer: only when useful, include source/date/scope in a quiet small block using at least 16px text.

Good sparse-slide patterns:

- Big claim + evidence rail: hero statement on one side, 3 supporting cards on the other.
- Key number + context: one metric, a baseline/previous value, and a short interpretation block.
- Before/after contrast: two large zones with 2-3 concrete differences.
- Cause/effect chain: 3 steps with short explanatory text and a final implication.
- Center concept + satellites: one central idea with 3 surrounding explanation blocks in explicit grid cells.
- Image/scene focus + annotation rail: visual-dominant area with 2-4 labeled annotations.

Element-level guidance:

- Use real modules, not loose text fragments. Prefer `header`, one main `section`, and a few direct child modules chosen for the content.
- A module can be a claim block, evidence card, contrast cell, annotation, timeline node, metric pair, quote block, or conclusion strip.
- Avoid making every module the same size. Give the main idea more area, then use smaller supporting elements.

## Content Integrity

Do not add unsourced precise KPI values, decorative explanations, footer meta bars, or repeated summaries just to make the slide look full.

When no reliable source exists, use qualitative framing or mark values as illustrative.

Do not use emoji or sticker decoration by default.

Keep each section to at most three columns unless the content truly requires a wider comparison grid.
