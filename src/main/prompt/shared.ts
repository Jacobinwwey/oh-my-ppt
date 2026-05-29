import { loadStyleSkill } from '../utils/style-skills'
import { formatLayoutIntentPrompt } from '@shared/layout-intent'
import type { DesignContract, SessionDeckGenerationContext } from '../tools/types'
import {
  CHART_SKILL_NAME,
  DATA_ANIM_SKILL_NAME,
  formatSkillUsageRequirement,
} from '../skills/skill-contract'

export const PAGE_SEMANTIC_STRUCTURE = [
  '## 页面语义结构',
  '- 直接输出完整创意页面片段；系统会自动包裹 section[data-page-scaffold]、main[data-role="content"] 和标准 page frame。',
  '- 如果页面有明确标题，可以给第一个标题元素添加 data-role="title"；没有传统标题时不要为了校验硬造标题。',
  '- 主动添加 data-block-id 时保持页面内唯一（kebab-case：metric-1、summary、chart-main）；未添加时系统会自动补齐。',
  '',
  '版式决策（先定原型，再排版）：',
  '- 根据内容判断页面原型：封面/章节页、big number、key message、图文页、列表页、data exhibit、comparison、timeline/process、framework/matrix、引用页、问答页、executive summary、closing takeaway。',
  '- 每页聚焦一个主张或中心问题；版式服务于“听众先看到什么、再理解什么、最后记住什么”。',
  '- 标题是阅读路径的一部分，不是固定装饰头部；根据页面角色灵活放置——总结页/封面页可让标题占据视觉重心，数据页可让标题靠边或与关键数字组合，对比页让标题服务于对比关系。',
  '- 在同一套视觉语言下保持变化，不要机械重复同一标题位置和同一网格。',
  '',
  '内容密度自适应：',
  '- 根据内容密度、叙事意图和页面角色选择布局；允许创意构图。',
  '- 低密度：用大尺度标题、单个核心数字、强视觉符号、大留白、对角构图或非对称版式承载。少内容页用留白和视觉节奏作为设计表达。',
  '- 中密度：用主次分区、1 个主视觉 + 2-3 个辅助证据、左右叙事、时间线、阶梯、矩阵或对比结构。',
  '- 高密度：用规整的网格、表格、列表或多卡片；模块数量由真实信息量决定。',
  '- 等权卡片仅用于多个并列且同等重要的信息点；4 列卡片仅用于真实存在 4 个并列对象的对比页。',
  '- 不要为了显得丰富而添加无来源的精确 KPI、装饰说明、底部 meta 条或重复摘要；没有可靠来源时使用定性表达或清楚标注为示意。',
  '',
  '标题可读性底线：',
  '- 竖排仅限 2-6 个中文字符的短标签。',
  '- 标题包含英文、数字、年份、中英混排或长句时必须横排。',
  '- 完整标题优先保证可读性，不要为了装饰牺牲阅读。'
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
  '- 16:9 原始画布为 1600×900；预览缩放只用于适配窗口，不是布局兜底。生成时必须按 1600×900 原始画布完成排版。',
  '- 可用内容区约 1584×884（外层有 p-2），所有标题、正文、图表、注释和装饰都必须在这个区域内完成。',
  '- 用 Tailwind flex/grid 布局；禁止 w-[1600px]/h-[900px]/100vw/100vh/w-screen/h-screen 等画布锁定。',
  '- 禁止 vw/vh 字体单位和 text-[clamp(...)]；h1 统一 text-5xl，禁 text-6xl/7xl/8xl。',
  '- 禁止 iframe。禁止引用系统骨架类。',
  '- 整套页面复用同一背景体系/主色/字体；背景铺满画布，定义在最外层容器上。',
  '- 全局最小字号 16px，禁止 text-xs / text-sm / text-[12px] / text-[14px] 等小于 16px 的字号，正文最小 text-base。',
  '',
  '一屏适配：',
  '- 所有主要内容必须在 1600×900 画布内完整可见；不要依赖 overflow-hidden 裁切、滚动条、系统自动缩放或缩小字号兜底。',
  '- 写布局前先做高度预算：外边距/标题区/模块区/gap/注释合计不得超过可用高度。内容一多，先减少模块、合并要点、缩短文案或改成更紧凑的结构。',
  '- 如果页面信息超过一屏容量，优先保留主结论和最强证据；删除次要解释、重复摘要、装饰说明、底部 meta 和低价值卡片。',
  '- 避免在多个纵向层级同时使用 h-full、min-h-*、大 padding、大 gap 和多段长文本；这些组合最容易让内容超出画布。',
  '- 图表、表格、时间线、长列表必须和标题/注释共同预算高度；不能先放满图表再把说明挤到画布外。'
].join('\n')

export const LAYOUT_COLLISION_RULES = [
  '## 布局防重叠规则',
  '- 正文内容、信息卡片、标题、图表、列表必须由 grid/flex 的正常文档流分区承载；不要用 absolute/fixed + top/left/right/bottom/translate 手工摆放正文模块。',
  '- absolute/fixed 仅用于背景装饰、连接线、非文字 SVG、少量不承载正文的视觉点缀；带有 h1/h2/h3/p/li 或主要文本的元素不得使用 absolute/fixed。',
  '- 禁止用 -top-*、-left-*、-right-*、-bottom-*、translate-x-*、-translate-x-*、translate-y-*、-translate-y-* 把正文卡片推到容器外或叠在主视觉周围。',
  '- 需要环绕/五点/放射状/中心图+周边说明时，使用明确的 grid 模板（例如三列三行：左上/中上/右上/左下/右下/中心），中心图和说明卡片各占独立 grid cell；连接线可用 SVG 作为装饰层。',
  '- 每个主要内容区必须有稳定尺寸和间距：给 grid/flex 容器设置 gap，给长文本容器设置 min-w-0，避免文字或卡片把相邻区域挤压重叠。',
  '- 写入前检查整页高度：标题、主视觉、卡片、图表、脚注都必须在画布内；任何内容被裁掉、压到边界外或需要滚动都算失败。',
  '- 写入前做一次版面自检：标题、主视觉、每张卡片、底部元素都必须有独立空间，不能互相覆盖，不能依赖 hover/animation 后才可读。'
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
