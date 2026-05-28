---
name: oh-my-ppt-data-anim
description: Must be read before adding or modifying Oh My PPT slide animations. Defines exportable data-anim usage, trigger decisions, and how to replace unsupported scripted/anime.js animation.
---

# Oh My PPT Data Anim

Use declarative `data-anim` for normal slide animation. Prefer it over scripted animation because it runs in preview and exports deterministically to PPTX.

Read `references/data-anim.md` before adding or changing animations.

Core rules:

- Prefer no animation, `load`, `stagger`, `with`, or `after` before `click`.
- Use `click` only when the user asks for step-by-step, keyboard, presentation-control, or one-by-one reveal.
- Do not call raw `anime(...)` or `anime.timeline(...)`.
- Use `PPT.animate(...)` only for complex scripted animation that `data-anim` cannot express.
- Never create hidden initial states with CSS classes or inline styles; let the runtime handle initial states.
- In edit mode, do not add animation unless the user asks for it, the page already has animation, or you are fixing broken animation.
