import { loadStyleSkill } from '../utils/style-skills'
import { formatLayoutIntentPrompt } from '@shared/layout-intent'
import type { DesignContract, SessionDeckGenerationContext } from '../tools/types'
import {
  CHART_SKILL_NAME,
  DATA_ANIM_SKILL_NAME,
  LAYOUT_SKILL_NAME,
  formatSkillUsageRequirement,
} from '../skills/skill-contract'

export const PAGE_SEMANTIC_STRUCTURE = [
  '## 页面语义结构',
  `- The layout source of truth is the skill ${LAYOUT_SKILL_NAME}. Before creating a slide, choosing a composition, or repairing overflow/collision: ${formatSkillUsageRequirement(LAYOUT_SKILL_NAME)}`,
  '- If the task is a tiny text/style edit that does not affect layout, do not read the full layout reference.',
  '- 直接输出完整创意页面片段；系统会自动包裹 section[data-page-scaffold]、main[data-role="content"] 和标准 page frame。',
  '- 如果页面有明确标题，可以给第一个标题元素添加 data-role="title"；没有传统标题时不要为了校验硬造标题。',
  '- 主动添加 data-block-id 时保持页面内唯一（kebab-case：metric-1、summary、chart-main）；未添加时系统会自动补齐。'
].join('\n')

export const CONTENT_LANGUAGE_RULES = [
  '## Content language',
  '- The language of these instructions is not the output language. Do not imitate the prompt language.',
  '- If the user explicitly requests a language, use that language.',
  "- Otherwise, use the dominant language of the user's latest request and provided source materials.",
  '- If source materials are primarily English, write slide titles, body text, outlines, and user-facing summaries in English. Do not translate them into Chinese.',
  '- If source materials are primarily Chinese, write slide titles, body text, outlines, and user-facing summaries in Chinese.',
  '- For mixed-language materials, prefer the latest user instruction language.',
  '- Preserve proper nouns, brand names, technical terms, quoted source text, and metrics when appropriate.'
].join('\n')

export const STABLE_HTML_FRAGMENT_PROTOCOL = [
  '## Stable HTML fragment protocol',
  '- Submit only the creative body fragment. The tool will add section[data-page-scaffold], main[data-role="content"], data-block-id attributes, and the runtime page frame.',
  '- Do not include <!doctype>, <html>, <head>, <body>, section[data-page-scaffold], main[data-role="content"], .ppt-page-root, .ppt-page-content, .ppt-page-fit-scope, or data-ppt-guard-root.',
  '- Use one outer <div> as the fragment root.',
  '- Prefer a shallow grid/flex structure with direct module children.',
  '- Avoid nested cards and wrapper chains. Aim for 3 levels of nesting and avoid exceeding 4.',
  '- If the page needs many ideas, reduce the number of modules before adding more containers.',
  '- Decorative blocks should stay flat: a single absolute-positioned div, a few sibling decorative divs, or one SVG are all acceptable; avoid nested wrapper chains inside decoration.',
  '- Before calling the write tool, check that every opened div/span/ul/li/p/table-related tag is closed and the fragment ends with a complete closing tag.'
].join('\n')

export const CANVAS_CONSTRAINTS = [
  '## 画布约束',
  `- Layout budgeting, density, and collision rules are in the skill ${LAYOUT_SKILL_NAME}. ${formatSkillUsageRequirement(LAYOUT_SKILL_NAME)}`,
  '- 16:9 原始画布为 1600×900；可用内容区约 1584×884。所有内容必须在这个区域内。',
  '- 用 Tailwind flex/grid 布局。禁止 w-[1600px]/h-[900px]/100vw/100vh/w-screen/h-screen。',
  '- 禁止 vw/vh 字体单位和 text-[clamp(...)]；h1 统一 text-5xl，禁 text-6xl/7xl/8xl。',
  '- 全局最小字号 16px（text-base）。所有可见文本——正文、标签、注释、脚注、来源——都不得小于 16px。text-xs/text-sm/text-[12px]/text-[13px]/text-[14px] 一律不用。放不下就缩短文案或减少模块，不要缩小字号。',
  '- 整套页面复用同一背景体系/主色/字体；背景铺满画布，定义在最外层容器上。',
  '- 禁止 iframe。禁止引用系统骨架类。'
].join('\n')

export const LAYOUT_COLLISION_RULES = [
  '## 布局防重叠规则',
  `- Full collision avoidance guide is in the skill ${LAYOUT_SKILL_NAME}. ${formatSkillUsageRequirement(LAYOUT_SKILL_NAME)}`,
  '- 正文内容用 grid/flex 正常文档流承载。absolute/fixed 仅用于背景装饰、连接线、非文字 SVG。',
  '- 需要环绕/放射/中心图布局时，用明确 grid 模板，每个模块占独立 cell。'
].join('\n')

export const FRONTEND_CAPABILITIES = [
  '## Runtime capability contract',
  'Available in every /<pageId>.html:',
  '- Tailwind CSS, anime.js, Chart.js, ppt-runtime.js, and KaTeX are already loaded from local assets.',
  '- Do not add CDN links, remote scripts, duplicate runtime tags, or iframe content.',
  '',
  'Fonts:',
  '- Use var(--ppt-title-font) for titles and var(--ppt-body-font) for body text.',
  '- Do not declare @font-face or import external font/icon libraries.',
  '',
  'Charts:',
  `- The mandatory chart source of truth is the DeepAgents skill ${CHART_SKILL_NAME}.`,
  `- Before adding or modifying charts: ${formatSkillUsageRequirement(CHART_SKILL_NAME)}`,
  '- If the task does not add or modify charts, do not read the full chart reference just to satisfy this contract.',
  '- Do not call new Chart(ctx, config); chart creation must go through the product runtime helper described by the chart skill.',
  '- Wrap all PPT.createChart calls inside document.addEventListener("DOMContentLoaded", function() { ... }). The runtime only guarantees Chart.js is ready at DOMContentLoaded.',
  '',
  'Animations:',
  `- The mandatory animation source of truth is the DeepAgents skill ${DATA_ANIM_SKILL_NAME}.`,
  `- Before adding or modifying animation: ${formatSkillUsageRequirement(DATA_ANIM_SKILL_NAME)}`,
  '- If the task does not add or modify animation, do not read the full animation reference just to satisfy this contract.',
  '- Do not call raw anime(...) or anime.timeline(...). Do not create animation initial hidden states with CSS classes or inline styles.',
  '',
  'Validation constraints:',
  '- Keep runtime initial state visible: no opacity-0, invisible, visibility:hidden, display:none, or CSS opacity:0 for animated elements.',
  '- Put animation initial values inside PPT.animate parameters when scripted animation is truly needed.',
  '- Use \\( \\) or $$ $$ for math; do not use single-dollar inline math.'
].join('\n')

export const CONTENT_WRITING_RULES = [
  '## 内容写入规则',
  '- 只输出页面片段（不是完整 HTML）。工具自动包裹 page frame、补 data-block-id。',
  '- 禁止 <!doctype>/<html>/<head>/<body>/<meta>/<title>/<link>/<script src=...>。',
  '- 禁止系统骨架标识：.ppt-page-root / .ppt-page-fit-scope / .ppt-page-content / data-ppt-guard-root（class、CSS、script、注释里都不能出现）。',
  '- 所有标签必须成对闭合；items-center/justify-* 的父节点必须有 flex 或 grid。',
  '- ⚠️ 标签闭合是最常见的失败原因。写入前必须自检：每个 <div>/<section> 都有对应的 </div></section>，末尾无未闭合标签。',
  '- 控制嵌套层级：目标 3 层左右，避免超过 4 层。嵌套越深越容易漏闭合标签。',
  '- 片段最外层优先只用一个 <div> 根节点；不要主动输出 section[data-page-scaffold] 或 main[data-role="content"]，工具会自动包裹。',
  '- 精简 HTML 结构：用 Tailwind 类替代多层 wrapper div。能用 1 个 div 解决的不要用 3 个。',
  '- 装饰块保持扁平：单个绝对定位 div、少量并列装饰 div、或单个 SVG 都可以；避免装饰块内部继续套多层 wrapper。',
  '- 默认禁止 emoji/贴纸装饰；单区最多 3 列；留白优先，不要塞满。'
].join('\n')

export function resolveStylePrompt(styleId: string | null | undefined): {
  presetLabel: string
  presetId: string
  stylePrompt: string
} {
  const { preset, prompt } = loadStyleSkill(styleId)
  return {
    presetLabel: preset.label,
    presetId: preset.id,
    stylePrompt: prompt
  }
}

export function buildOutlinePageList(context: SessionDeckGenerationContext): string {
  return context.outlineItems
    .map((item, i) => {
      const layoutIntent = item.layoutIntent
        ? `\n   ${formatLayoutIntentPrompt(item.layoutIntent).replace(/\n/g, '\n   ')}`
        : ''
      return `${i + 1}. ${item.title}\n   Content points: ${item.contentOutline}${layoutIntent}`
    })
    .join('\n')
}

export function formatDesignContract(contract?: DesignContract): string {
  if (!contract) return 'Not provided. Keep pages visually consistent according to the style rules.'
  const lines = [
    '- Treat this as a flexible visual contract, not a fixed template. Preserve coherence while varying composition, density, and emphasis per slide.',
    `- Visual theme: ${contract.theme}`,
    `- Canvas background: ${contract.background}`,
    `- Palette: ${contract.palette.join(', ')}`,
    `- Title style: ${contract.titleStyle}`,
    `- Layout motif: ${contract.layoutMotif}`,
    '- Use the layout motif as the deck-level layout language. Keep pages varied within this motif instead of repeating one template.',
    `- Chart style: ${contract.chartStyle}`,
    `- Shape language: ${contract.shapeLanguage}`
  ]
  lines.push(
    `- Title font: ${contract.titleFont} (use var(--ppt-title-font) for titles)`,
    `- Body font: ${contract.bodyFont} (use var(--ppt-body-font) for body)`
  )
  return lines.join('\n')
}
