import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  CircleAlert,
  Home
} from 'lucide-react'
import { ipc } from '@renderer/lib/ipc'
import type { GenerateChunkEvent } from '@shared/generation.js'
import { Button } from '../components/ui/Button'
import { ScrollArea } from '../components/ui/ScrollArea'
import videoSrc from '../assets/images/video.mp4'
import dayjs from 'dayjs'
import { getEditorGate, type EditorGate } from '../lib/sessionMetadata'
import { useLang, type Lang } from '../i18n'
import { PreviewIframe } from '../components/preview/PreviewIframe'
import { cn } from '@renderer/lib/utils'

type LocationState = {
  initialPrompt?: string
  retry?: boolean
  rerunToken?: number
}

type GenerationPreviewPage = {
  id: string
  pageNumber: number
  title: string
  htmlPath?: string
  pageId?: string
  sourceUrl?: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
}

type SessionGeneratedPage = {
  id?: string
  pageNumber: number
  title: string
  htmlPath?: string
  pageId?: string
  sourceUrl?: string
  status?: string
  error?: string | null
}

const NEUTRAL_GENERATION_PROMPT =
  'Create a clear first draft that can be previewed directly. Determine the content language from the session topic, outline, detailed brief, and source documents; do not infer it from the application UI language or this instruction language.'

const extractFailedPages = (message: string | null): string[] => {
  if (!message) return []
  const matches = Array.from(message.matchAll(/\S+\([^)]+\)/g))
  return matches.map((match) => match[0]).slice(0, 12)
}

const isSessionFullyGenerated = (gate: EditorGate): boolean =>
  gate.generatedCount >= gate.totalCount && gate.failedCount === 0

const LOG_AUTO_SCROLL_THRESHOLD = 48

const isNearLogBottom = (el: HTMLDivElement): boolean =>
  el.scrollHeight - el.scrollTop - el.clientHeight <= LOG_AUTO_SCROLL_THRESHOLD

const compactWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

const eventDedupeKey = (value: string): string =>
  compactWhitespace(value)
    .replace(/\s*·\s*\d{1,3}%$/g, '')
    .replace(/\s+\d{1,3}%$/g, '')

const hasTechnicalDetail = (message: string): boolean => {
  const compact = compactWhitespace(message)
  if (compact.length > 160 || message.includes('\n')) return true
  return /Received tool input did not match expected schema|Error invoking tool|ZodError|expected schema|HTML 验证失败|HTML 落盘校验失败|页面编辑结果验证失败|ERR_FILE_NOT_FOUND|Failed to load URL|文件不存在|at\s+\S+.*:\d+:\d+|<html|<!doctype|data-ppt/i.test(
    compact
  ) || /HTML 末尾|未闭合标签|开闭标签数量不一致|内容可能被截断|<\/?[a-z][\w:-]*(\s|>|\/>)/i.test(compact)
}

const friendlyText = (lang: Lang, zh: string, en: string): string => (lang === 'en' ? en : zh)

const friendlyProgressDetail = (detail: string, lang: Lang): string => {
  const compact = compactWhitespace(detail)
  if (!compact) return ''
  const pageMatch = compact.match(/(\d+)\/(\d+)\s*(页|pages?)/i)
  if (pageMatch) {
    return friendlyText(
      lang,
      `已处理 ${pageMatch[1]}/${pageMatch[2]} 页`,
      `Processed ${pageMatch[1]}/${pageMatch[2]} pages`
    )
  }
  if (/没有检测到.*变化|without any detected page changes|no page changes/i.test(compact)) {
    return friendlyText(lang, '刚才没有写入变化，正在换一种方式重试。', 'No changes were written yet; trying another way.')
  }
  if (/HTML 末尾|未闭合标签|开闭标签数量不一致|内容可能被截断|<\/?[a-z][\w:-]*(\s|>|\/>)/i.test(compact)) {
    return friendlyText(
      lang,
      '页面结构检查未通过，正在尝试修复。',
      'The page structure needs a fix; trying to repair it.'
    )
  }
  if (/schema|工具调用参数|tool call/i.test(compact)) {
    return friendlyText(lang, '工具参数需要修正，正在自动重试。', 'Tool arguments need a quick fix; retrying automatically.')
  }
  if (/校验|验证|validat/i.test(compact)) {
    return friendlyText(lang, '页面结构需要修正，正在自动重试。', 'The page structure needs a fix; retrying automatically.')
  }
  if (/重试|retry/i.test(compact)) {
    return friendlyText(lang, '处理中遇到问题，正在自动重试。', 'Something needs another pass; retrying automatically.')
  }
  if (/准备完成|ready/i.test(compact)) {
    return friendlyText(lang, '准备完成，开始生成页面。', 'Ready. Starting page generation.')
  }
  const pageTitleMatch = compact.match(/^page-[\w-]+\s*·\s*(.+)$/i)
  if (pageTitleMatch?.[1]) {
    const title = pageTitleMatch[1].trim()
    return friendlyText(lang, `正在处理「${title}」`, `Processing "${title}"`)
  }
  return hasTechnicalDetail(compact) ? '' : compact
}

const isFailureProgress = (label: string | undefined, detail: string): boolean =>
  /失败|failed|fail|error|错误/i.test(`${label || ''} ${detail}`)

const friendlyProgressLabel = (label: string | undefined, detail: string, lang: Lang): string => {
  const compactLabel = compactWhitespace(label || '')
  if (isFailureProgress(label, detail)) {
    return friendlyText(lang, '检查页面', 'Checking pages')
  }
  return compactLabel
}

const friendlyFailureProgressDetail = (lang: Lang): string =>
  friendlyText(
    lang,
    '页面结构检查未通过，正在尝试修复。',
    'The page structure needs a fix; trying to repair it.'
  )

const friendlyFailureMessage = (message: string | null | undefined, lang: Lang): string => {
  const compact = compactWhitespace(message || '')
  if (!compact) {
    return friendlyText(lang, '生成没有完成，请重试。', 'Generation did not finish. Please retry.')
  }
  if (/API Key|api key|provider|模型|model|timeout|timed out|ECONN|network|fetch failed/i.test(compact)) {
    return friendlyText(
      lang,
      '模型服务暂时不可用，请检查设置后重试。',
      'The model service is not available. Check settings and retry.'
    )
  }
  if (/文件不存在|ERR_FILE_NOT_FOUND|Failed to load URL|ENOENT/i.test(compact)) {
    return friendlyText(
      lang,
      '页面文件暂时不可用，请返回会话后重试。',
      'The page files are not available. Return to the session and retry.'
    )
  }
  if (/schema|tool call|工具调用参数/i.test(compact)) {
    return friendlyText(
      lang,
      '生成工具调用失败，请重试一次。',
      'The generation tool call failed. Please retry.'
    )
  }
  if (/校验|验证|validat|HTML/i.test(compact)) {
    return friendlyText(
      lang,
      '页面结果没有通过检查，请重试一次。',
      'The page result did not pass checks. Please retry.'
    )
  }
  return hasTechnicalDetail(compact)
    ? friendlyText(lang, '生成没有完成，请重试。', 'Generation did not finish. Please retry.')
    : compact
}

const progressLine = (args: {
  label?: string
  detail?: string
}): string => {
  const label = compactWhitespace(args.label || '')
  const detail = compactWhitespace(args.detail || '')
  const parts = [label, detail].filter(Boolean)
  return parts.join(' · ')
}

const buildPagePlaceholders = (
  totalPages: number,
  lang: Lang,
  existing: GenerationPreviewPage[] = []
): GenerationPreviewPage[] => {
  const count = Math.max(1, Math.floor(totalPages || 1))
  const byNumber = new Map(existing.map((page) => [page.pageNumber, page]))
  return Array.from({ length: count }, (_, index) => {
    const pageNumber = index + 1
    const existingPage = byNumber.get(pageNumber)
    if (existingPage) return existingPage
    return {
      id: `placeholder-${pageNumber}`,
      pageNumber,
      title: friendlyText(lang, `第 ${pageNumber} 页`, `Page ${pageNumber}`),
      status: 'pending'
    }
  })
}

const mergePreviewPage = (
  pages: GenerationPreviewPage[],
  incoming: GenerationPreviewPage,
  totalPages: number,
  lang: Lang
): GenerationPreviewPage[] => {
  const placeholders = buildPagePlaceholders(totalPages, lang, pages)
  const index = placeholders.findIndex((page) => page.pageNumber === incoming.pageNumber)
  const nextPage = {
    ...incoming,
    id: incoming.id || incoming.pageId || `page-${incoming.pageNumber}`,
    pageId: incoming.pageId || `page-${incoming.pageNumber}`,
    status: incoming.status
  }
  if (index >= 0) {
    placeholders[index] = {
      ...placeholders[index],
      ...nextPage
    }
  } else {
    placeholders.push(nextPage)
  }
  return placeholders.sort((a, b) => a.pageNumber - b.pageNumber)
}

const buildPreviewPagesFromGeneratedPages = (
  pageCount: number,
  pages: SessionGeneratedPage[],
  lang: Lang
): GenerationPreviewPage[] => {
  const maxPageNumber = pages.reduce((max, page) => Math.max(max, page.pageNumber || 0), 0)
  const totalPages = Math.max(1, pageCount, maxPageNumber, pages.length)
  return buildPagePlaceholders(
    totalPages,
    lang,
    pages.map((page) => ({
      id: page.id || page.pageId || `page-${page.pageNumber}`,
      pageNumber: page.pageNumber,
      title: page.title,
      htmlPath: page.htmlPath,
      pageId: page.pageId || `page-${page.pageNumber}`,
      sourceUrl: page.sourceUrl,
      status:
        page.status === 'failed'
          ? 'failed'
          : page.status === 'completed' || page.htmlPath || page.sourceUrl
            ? 'completed'
            : 'pending'
    }))
  )
}

const updatePreviewPageStatus = (
  pages: GenerationPreviewPage[],
  incoming: {
    id?: string
    pageNumber: number
    title: string
    pageId?: string
    htmlPath?: string
    sourceUrl?: string
    status: GenerationPreviewPage['status']
  },
  totalPages: number,
  lang: Lang
): GenerationPreviewPage[] => {
  const placeholders = buildPagePlaceholders(totalPages, lang, pages)
  return placeholders
    .map((page) => {
      if (page.pageNumber !== incoming.pageNumber) return page
      const nextStatus =
        page.status === 'completed' && incoming.status === 'generating'
          ? page.status
          : incoming.status
      return {
        ...page,
        id: incoming.id || page.id,
        pageId: incoming.pageId || page.pageId,
        htmlPath: incoming.htmlPath || page.htmlPath,
        sourceUrl: incoming.sourceUrl || page.sourceUrl,
        title: incoming.title || page.title,
        status: nextStatus
      }
    })
    .sort((a, b) => a.pageNumber - b.pageNumber)
}

function GenerationThumbnail({
  page,
  previewVersion
}: {
  page: GenerationPreviewPage
  previewVersion: number
}): React.JSX.Element {
  const hasPreview = page.status === 'completed' && (page.htmlPath || page.sourceUrl)
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-[#fffaf1]/78 p-2 shadow-[0_16px_34px_rgba(70,82,58,0.12)] transition-all duration-500',
        page.status === 'completed' && 'border-[#b8d3a6] translate-y-0 opacity-100',
        page.status === 'generating' && 'border-[#8fb873] bg-[#f6fbef]/88 shadow-[0_18px_40px_rgba(95,132,72,0.22)]',
        page.status === 'failed' && 'border-[#d7b5ae] bg-[#fbf1ee]/92',
        page.status === 'pending' && 'border-[#dfd4bf]/72 opacity-72'
      )}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg border border-[#e4d9c3]/70 bg-[#efe6d6]">
        {hasPreview ? (
          <PreviewIframe
            key={`generating-thumb-${page.id}-${previewVersion}`}
            src={page.sourceUrl}
            htmlPath={page.htmlPath}
            pageId={page.pageId}
            title={`generating-page-${page.pageNumber}`}
            inspectable={false}
            thumbnail
          />
        ) : (
          <div
            className={cn(
              'flex h-full w-full flex-col justify-between p-3',
              page.status === 'generating'
                ? 'bg-[linear-gradient(135deg,#eef6e7_0%,#fff8ec_100%)]'
                : page.status === 'failed'
                  ? 'bg-[#f7e7e2]'
                  : 'bg-[linear-gradient(135deg,#f5efe4_0%,#e9decb_100%)]'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="h-2 w-16 rounded-full bg-white/72" />
              <span className="h-5 w-5 rounded-md border border-white/80 bg-white/58" />
            </div>
            <div className="space-y-2">
              <span className="block h-3 w-3/4 rounded-full bg-white/78" />
              <span className="block h-2 w-11/12 rounded-full bg-white/56" />
              <span className="block h-2 w-7/12 rounded-full bg-white/56" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="h-7 rounded-md bg-white/54" />
              <span className="h-7 rounded-md bg-white/42" />
              <span className="h-7 rounded-md bg-white/54" />
            </div>
          </div>
        )}
        {page.status === 'generating' && (
          <div className="absolute inset-0 border-2 border-[#83ad67]/70">
            <div className="absolute right-2 top-2 rounded-full bg-[#fffaf1]/90 p-1 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5f8a43]" />
            </div>
          </div>
        )}
        {page.status === 'failed' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#fbf1ee]/76">
            <CircleAlert className="h-6 w-6 text-[#a45f58]" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="shrink-0 rounded-md bg-[#5d6b4d]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#4f613f]">
          P{page.pageNumber}
        </span>
        <span
          className="min-w-0 truncate text-xs font-medium text-[#4d5b40]"
          title={page.title}
        >
          {page.title}
        </span>
      </div>
    </div>
  )
}

export function SessionGeneratingPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { lang, t } = useLang()
  const state = (location.state as LocationState | null) || null
  const startedSessionRef = useRef<string | null>(null)
  const activeRunIdRef = useRef<string | null>(null)
  const terminalStatusRef = useRef<'completed' | 'failed' | null>(null)
  const eventsContainerRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const shouldAutoScrollRef = useRef(true)
  const currentStageRef = useRef<string>('preflight')
  const lastProgressLogRef = useRef<{ stage: string; progress: number; time: number } | null>(null)

  const [status, setStatus] = useState<'running' | 'completed' | 'failed'>('running')
  const [progress, setProgress] = useState(0)
  const [events, setEvents] = useState<Array<{ text: string; time?: string }>>([
    { text: t('generating.created'), time: new Date().toISOString() }
  ])
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [editorGate, setEditorGate] = useState<EditorGate>(() => getEditorGate(null))
  const [currentStage, setCurrentStage] = useState<string>('preflight')
  const [completedPageCount, setCompletedPageCount] = useState<number>(0)
  const [previewPages, setPreviewPages] = useState<GenerationPreviewPage[]>(() =>
    buildPagePlaceholders(1, lang)
  )
  const [previewVersion, setPreviewVersion] = useState(0)

  const appendEvent = (line: string, timestamp?: string): void => {
    const el = eventsContainerRef.current
    shouldAutoScrollRef.current = !el || stickToBottomRef.current || isNearLogBottom(el)
    setEvents((prev) => {
      const normalized = line.replace(/\s+/g, ' ').trim()
      if (!normalized) return prev
      const normalizedKey = eventDedupeKey(normalized)
      const normalizedPrev = prev.map((item) => eventDedupeKey(item.text))
      const previousKey = normalizedPrev[normalizedPrev.length - 1]
      if (previousKey === normalizedKey || previousKey?.startsWith(`${normalizedKey} · `)) {
        return prev
      }
      if (previousKey && normalizedKey.startsWith(`${previousKey} · `)) {
        const next = [...prev.slice(0, -1), { text: line, time: timestamp }]
        return next.length > 300 ? next.slice(next.length - 300) : next
      }
      const recent = normalizedPrev.slice(-4)
      if (
        recent.some(
          (item) =>
            item === normalizedKey ||
            item.startsWith(`${normalizedKey} · `) ||
            normalizedKey.startsWith(`${item} · `)
        )
      ) {
        return prev
      }
      const next = [...prev, { text: line, time: timestamp }]
      return next.length > 300 ? next.slice(next.length - 300) : next
    })
  }

  const scrollLogToBottom = (): void => {
    const el = eventsContainerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    window.requestAnimationFrame(() => {
      const next = eventsContainerRef.current
      if (!next) return
      next.scrollTop = next.scrollHeight
      stickToBottomRef.current = true
    })
  }

  useLayoutEffect(() => {
    if (!shouldAutoScrollRef.current) return
    scrollLogToBottom()
  }, [events, status])

  useEffect(() => {
    if (!id) {
      navigate('/sessions', { replace: true })
      return
    }
    let active = true

    const initialPrompt = state?.initialPrompt?.trim() || NEUTRAL_GENERATION_PROMPT
    const explicitRerun = typeof state?.rerunToken === 'number'
    if (state?.retry || explicitRerun) {
      startedSessionRef.current = null
      activeRunIdRef.current = null
      terminalStatusRef.current = null
      currentStageRef.current = 'preflight'
      lastProgressLogRef.current = null
      shouldAutoScrollRef.current = true
      stickToBottomRef.current = true
      window.setTimeout(() => {
        setStatus('running')
        setProgress(0)
        setError(null)
        setCurrentStage('preflight')
        setCompletedPageCount(0)
        setEvents([{ text: t('generating.created'), time: new Date().toISOString() }])
      }, 0)
    }

    const applyChunk = (event: GenerateChunkEvent, options?: { replay?: boolean }): void => {
      if (import.meta.env.DEV) {
        console.debug('[generate:chunk] received', event)
      }
      if (event.payload.sessionId && event.payload.sessionId !== id) return
      const incomingRunId = event.payload.runId
      if (activeRunIdRef.current && incomingRunId && incomingRunId !== activeRunIdRef.current)
        return
      if (!options?.replay && !activeRunIdRef.current && incomingRunId) {
        activeRunIdRef.current = incomingRunId
      }
      const applyProgress = (
        next: number | undefined,
        options?: { allowTerminal?: boolean }
      ): void => {
        const hardMax = options?.allowTerminal ? 100 : 90
        const value = Math.max(0, Math.min(hardMax, Math.round(next ?? 0)))
        setProgress((prev) => Math.max(prev, value))
      }
      const applyTotalPages = (next: number | undefined): void => {
        if (!Number.isFinite(next)) return
        const pages = Math.max(1, Math.floor(next as number))
        setTotalPages((prev) => Math.max(prev, pages))
        setPreviewPages((prev) => buildPagePlaceholders(Math.max(prev.length, pages), lang, prev))
      }
      if (event.type === 'stage_started' || event.type === 'stage_progress') {
        applyProgress(event.payload.progress)
        applyTotalPages(event.payload.totalPages)
        const prevStage = currentStageRef.current
        const stageChanged = event.payload.stage && event.payload.stage !== prevStage
        if (event.payload.stage) {
          currentStageRef.current = event.payload.stage
          setCurrentStage(event.payload.stage)
        }
        const now = Date.now()
        const previousLog = lastProgressLogRef.current
        const progressValue = Math.round(event.payload.progress ?? 0)
        const shouldLogProgress =
          stageChanged ||
          event.type === 'stage_started' ||
          !previousLog ||
          progressValue - previousLog.progress >= 6 ||
          now - previousLog.time >= 8000
        if (shouldLogProgress) {
          lastProgressLogRef.current = {
            stage: event.payload.stage || currentStageRef.current,
            progress: progressValue,
            time: now
          }
          appendEvent(
            progressLine({
              label: event.payload.label
            }),
            event.payload.timestamp
          )
        }
        return
      }

      if (event.type === 'llm_status') {
        applyProgress(event.payload.progress)
        applyTotalPages(event.payload.totalPages)

        // Track stage changes (compare before updating)
        const prevStage = currentStageRef.current
        const stageChanged = event.payload.stage && event.payload.stage !== prevStage
        if (event.payload.stage) {
          currentStageRef.current = event.payload.stage
          setCurrentStage(event.payload.stage)
        }

        // Parse page completion count from detail
        const detail = event.payload.detail || ''
        const failureProgress = isFailureProgress(event.payload.label, detail)
        const friendlyDetail = failureProgress
          ? friendlyFailureProgressDetail(lang)
          : friendlyProgressDetail(detail, lang)
        const pageMatch = detail.match(/(\d+)\/(\d+)\s*(页|pages?)/)
        if (pageMatch) {
          setCompletedPageCount(parseInt(pageMatch[1], 10))
        }

        // Filter: only append meaningful events to log
        const hasPageCompletion = Boolean(pageMatch)
        const now = Date.now()
        const previousLog = lastProgressLogRef.current
        const progressValue = Math.round(event.payload.progress ?? 0)
        const progressMoved =
          !previousLog ||
          progressValue - previousLog.progress >= 6 ||
          (event.payload.stage || currentStageRef.current) !== previousLog.stage
        const progressTimedOut = !previousLog || now - previousLog.time >= 8000
        const isValidationOrError =
          Boolean(friendlyDetail) ||
          detail.includes('校验') || detail.includes('validat') ||
          detail.includes('失败') || detail.includes('fail') ||
          detail.includes('重试') || detail.includes('retry') ||
          detail.includes('准备完成') || detail.includes('ready')
        const isRetryLabel =
          event.payload.label?.includes('重试') || event.payload.label?.includes('retry')
        const friendlyLabel = friendlyProgressLabel(event.payload.label, detail, lang)

        if (
          stageChanged ||
          hasPageCompletion ||
          isValidationOrError ||
          isRetryLabel ||
          progressMoved ||
          progressTimedOut
        ) {
          lastProgressLogRef.current = {
            stage: event.payload.stage || currentStageRef.current,
            progress: progressValue,
            time: now
          }
          appendEvent(
            progressLine({
              label: friendlyLabel,
              detail: friendlyDetail
            }),
            event.payload.timestamp
          )
        }
        return
      }

      if (event.type === 'page_generated' || event.type === 'page_updated') {
        applyProgress(event.payload.progress)
        applyTotalPages(Math.max(event.payload.totalPages ?? 0, event.payload.pageNumber))
        setPreviewVersion((prev) => prev + 1)
        setPreviewPages((prev) =>
          mergePreviewPage(
            prev,
            {
              id: event.payload.id || event.payload.pageId || `page-${event.payload.pageNumber}`,
              pageNumber: event.payload.pageNumber,
              title: event.payload.title,
              htmlPath: event.payload.htmlPath,
              pageId: event.payload.pageId || `page-${event.payload.pageNumber}`,
              sourceUrl: event.payload.sourceUrl,
              status: 'completed'
            },
            Math.max(prev.length, event.payload.totalPages || event.payload.pageNumber),
            lang
          )
        )
        appendEvent(
          `${event.payload.label} · ${t('generating.pageDetail', { pageNumber: event.payload.pageNumber, title: event.payload.title })}`,
          event.payload.timestamp
        )
        return
      }

      if (event.type === 'assistant_message') {
        return
      }

      if (event.type === 'page_started' || event.type === 'page_failed') {
        applyProgress(event.payload.progress)
        applyTotalPages(Math.max(event.payload.totalPages ?? 0, event.payload.pageNumber))
        setPreviewPages((prev) =>
          updatePreviewPageStatus(
            prev,
            {
              id: event.payload.id || event.payload.pageId || `page-${event.payload.pageNumber}`,
              pageNumber: event.payload.pageNumber,
              title: event.payload.title,
              htmlPath: event.payload.htmlPath,
              pageId: event.payload.pageId || `page-${event.payload.pageNumber}`,
              status: event.type === 'page_started' ? 'generating' : 'failed'
            },
            Math.max(prev.length, event.payload.totalPages || event.payload.pageNumber),
            lang
          )
        )
        if (event.type === 'page_failed') {
          appendEvent(
            progressLine({
              label: friendlyText(lang, '页面生成失败', 'Page generation failed'),
              detail: event.payload.title
            }),
            event.payload.timestamp
          )
        }
        return
      }

      if (event.type === 'run_completed') {
        if (!active) return
        terminalStatusRef.current = 'completed'
        setStatus('completed')
        applyProgress(100, { allowTerminal: true })
        applyTotalPages(event.payload.totalPages)
        appendEvent(t('generating.completed'), event.payload.timestamp)
        if (options?.replay) return
        window.setTimeout(() => {
          if (!active) return
          navigate(`/sessions/${id}`)
        }, 850)
        return
      }

      if (event.type === 'run_error') {
        if (options?.replay && state?.retry) return
        if (!active) return
        terminalStatusRef.current = 'failed'
        setStatus('failed')
        setError(friendlyFailureMessage(event.payload.message, lang))
        appendEvent(t('generating.failedRetryOrBack'), event.payload.timestamp)
        void ipc
          .getSession(id)
          .then(({ session, generatedPages }) => {
            if (!active) return
            const snapshot = session as {
              status?: string
              page_count?: number | null
              metadata?: string | null
            } | null
            setEditorGate(
              getEditorGate(snapshot)
            )
            setPreviewPages(
              buildPreviewPagesFromGeneratedPages(
                typeof snapshot?.page_count === 'number' ? snapshot.page_count : 0,
                generatedPages,
                lang
              )
            )
          })
          .catch(() => {})
      }
    }

    const unsubscribe = ipc.onGenerateChunk((event) => applyChunk(event))

    const startRun = (): void => {
      const runKey = `${id}:${state?.retry ? 'retry' : 'generate'}:${state?.rerunToken ?? 'initial'}`
      if (startedSessionRef.current === runKey) return
      startedSessionRef.current = runKey
      setStatus('running')
      setError(null)
      terminalStatusRef.current = null
      if (import.meta.env.DEV) {
        console.info('[generate:start] request', {
          sessionId: id,
          retry: Boolean(state?.retry),
          hasInitialPrompt: Boolean(initialPrompt)
        })
      }
      const request = state?.retry
        ? ipc.retryFailedPages({
            sessionId: id,
            userMessage: state.initialPrompt?.trim() || undefined
          })
        : ipc.startGenerate({
            sessionId: id,
            userMessage: initialPrompt,
            type: 'deck'
          })
      void request
        .then((result) => {
          if (result?.runId) {
            activeRunIdRef.current = result.runId
          }
          if (result?.alreadyRunning) {
            appendEvent(t('generating.stillRunning'), new Date().toISOString())
            return
          }
          if (import.meta.env.DEV) {
            console.info('[generate:start] promise resolved', { sessionId: id })
          }
          if (!active || terminalStatusRef.current) return
          appendEvent(t('generating.started'), new Date().toISOString())
        })
        .catch((e) => {
          if (import.meta.env.DEV) {
            console.error('[generate:start] promise rejected', {
              sessionId: id,
              message: e instanceof Error ? e.message : String(e)
            })
          }
          if (!active) return
          const rawMessage = e instanceof Error ? e.message : t('generating.failed')
          const message = friendlyFailureMessage(rawMessage, lang)
          appendEvent(t('generating.failedRetryOrBack'), new Date().toISOString())
          setStatus('failed')
          setError(message)
          void ipc
            .getSession(id)
            .then(({ session, generatedPages }) => {
              if (!active) return
              const snapshot = session as {
                status?: string
                page_count?: number | null
                metadata?: string | null
              } | null
              setEditorGate(
                getEditorGate(snapshot)
              )
              setPreviewPages(
                buildPreviewPagesFromGeneratedPages(
                  typeof snapshot?.page_count === 'number' ? snapshot.page_count : 0,
                  generatedPages,
                  lang
                )
              )
            })
            .catch(() => {})
        })
    }

    void Promise.all([ipc.getSession(id), ipc.getGenerateState(id).catch(() => null)])
      .then(([sessionResult, runState]) => {
        if (!active) return
        const { session, generatedPages } = sessionResult
        const snapshot = (session || {}) as {
          status?: string
          title?: string | null
          page_count?: number | null
          metadata?: string | null
        }
        const currentStatus = snapshot.status || 'active'
        const snapshotGate = getEditorGate(snapshot)
        setEditorGate(snapshotGate)
        if (typeof snapshot.page_count === 'number' && snapshot.page_count > 0) {
          setTotalPages(Math.floor(snapshot.page_count))
        }
        setPreviewPages(
          buildPreviewPagesFromGeneratedPages(
            typeof snapshot.page_count === 'number' ? snapshot.page_count : 0,
            generatedPages,
            lang
          )
        )

        const hasManualStartIntent = Boolean(
          state?.retry ||
          explicitRerun ||
          (state?.initialPrompt && state.initialPrompt.trim().length > 0)
        )

        if (runState) {
          const shouldHydrateFromSnapshot = !hasManualStartIntent || runState.hasActiveRun

          if (runState.hasActiveRun && runState.runId) {
            activeRunIdRef.current = runState.runId
          }
          if (
            shouldHydrateFromSnapshot &&
            typeof runState.totalPages === 'number' &&
            runState.totalPages > 0
          ) {
            setTotalPages((prev) => Math.max(prev, Math.floor(runState.totalPages)))
          }
          if (
            shouldHydrateFromSnapshot &&
            typeof runState.progress === 'number' &&
            runState.progress > 0
          ) {
            const safeProgress =
              runState.status === 'completed'
                ? Math.min(100, Math.floor(runState.progress))
                : Math.min(90, Math.floor(runState.progress))
            setProgress((prev) => Math.max(prev, safeProgress))
          }
          if (shouldHydrateFromSnapshot && runState.status === 'failed' && runState.error) {
            setError(friendlyFailureMessage(runState.error, lang))
          }
          if (
            shouldHydrateFromSnapshot &&
            Array.isArray(runState.events) &&
            runState.events.length > 0
          ) {
            for (const event of runState.events) {
              applyChunk(event, { replay: true })
            }
          }
          if (runState.status === 'completed' && !state?.retry && !explicitRerun) {
            navigate(`/sessions/${id}`, { replace: true })
            return
          }
          if (runState.status === 'failed' && !state?.retry && !explicitRerun) {
            setStatus('failed')
            setError(
              runState.error
                ? friendlyFailureMessage(runState.error, lang)
                : t('generating.previousFailed')
            )
            appendEvent(t('generating.keptFailed'), new Date().toISOString())
            return
          }
          if (runState.hasActiveRun) {
            setStatus('running')
            appendEvent(t('generating.resumed'), new Date().toISOString())
            return
          }
        }

        const fullyGenerated = isSessionFullyGenerated(snapshotGate)

        if (fullyGenerated && !state?.retry && !explicitRerun) {
          navigate(`/sessions/${id}`, { replace: true })
          return
        }
        if (currentStatus === 'completed' && !state?.retry && !explicitRerun) {
          navigate(`/sessions/${id}`, { replace: true })
          return
        }
        if (!fullyGenerated && !hasManualStartIntent) {
          setStatus('failed')
          if (snapshotGate.generatedCount > 0) {
            setError(
              t('generating.incompleteSome', {
                generated: snapshotGate.generatedCount,
                total: snapshotGate.totalCount
              })
            )
            appendEvent(t('generating.continueRemainingEvent'), new Date().toISOString())
          } else {
            setError(t('generating.incompleteNone', { total: snapshotGate.totalCount }))
            appendEvent(t('generating.noValidPagesEvent'), new Date().toISOString())
          }
          return
        }
        if (
          currentStatus === 'failed' &&
          !state?.retry &&
          !explicitRerun &&
          !hasManualStartIntent
        ) {
          setStatus('failed')
          setError(t('generating.previousFailed'))
          appendEvent(t('generating.keptFailed'), new Date().toISOString())
          return
        }
        startRun()
      })
      .catch(() => {
        startRun()
      })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [id, navigate, location.key, state?.initialPrompt, state?.retry, state?.rerunToken, lang, t])

  const displayProgress = Math.max(0, Math.min(100, Math.round(progress)))
  const failedPages = extractFailedPages(error)
  const fullyGenerated = isSessionFullyGenerated(editorGate)
  const hasGeneratedPages = editorGate.generatedCount > 0
  const canEnterEditor = getEditorGate(
    { page_count: editorGate.totalCount, generatedCount: editorGate.generatedCount },
    0.68
  ).canEdit
  const completedPreviewCount = previewPages.filter((page) => page.status === 'completed').length
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#edf3e8]">
      <style>{`
        @keyframes gen-shimmer-move { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
        @keyframes gen-page-rise { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <video
          src={videoSrc}
          controls={false}
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover object-bottom opacity-74"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(237,243,232,0.94)_0%,rgba(237,243,232,0.82)_32%,rgba(237,243,232,0.48)_64%,rgba(237,243,232,0.2)_100%)]" />
      </div>

      <div className="app-drag-region app-titlebar relative z-20 flex items-center bg-[#f7f0e2]/90 backdrop-blur-sm" />

      <div className="app-no-drag relative z-10 flex min-h-0 flex-1 flex-col gap-4 px-5 pb-5 pt-4 lg:flex-row">
        <aside className="flex min-h-0 w-full shrink-0 flex-col gap-3 lg:w-[250px]">
          <section className="rounded-lg border border-[#d8ccb5]/78 bg-[#fff9ef]/88 p-3 text-[#435138] shadow-[0_14px_30px_rgba(78,91,63,0.12)]">
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#d8ccb5]/80 bg-[#fffaf1] text-[#5d6b4d] transition-colors hover:bg-[#f4ecd9] hover:text-[#34402c]"
                aria-label={t('generating.backHome')}
                title={t('generating.backHome')}
              >
                <Home className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7d8b63]">
                  {status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  {status === 'failed' && <CircleAlert className="h-3.5 w-3.5 text-[#a45f58]" />}
                  {status === 'failed' ? t('generating.interrupted') : t('generating.eyebrow')}
                </div>
                <h1 className="mt-1.5 text-sm font-semibold leading-5 text-[#2f3b28]">
                  {t('generating.title')}
                </h1>
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-[#617350]">
                <span className="font-medium">
                  {friendlyText(lang, '已生成', 'Generated')} {completedPreviewCount}/{Math.max(totalPages, previewPages.length)}
                </span>
                <span className="font-semibold">{displayProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-[#d8ccb5]/80 bg-[#fffaf1] shadow-[inset_0_1px_2px_rgba(74,58,40,0.12)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#9ecf8a_0%,#6f9f59_52%,#4f7b3f_100%)] bg-[length:200%_100%] transition-[width] duration-500"
                  style={{
                    width: `${Math.max(2, displayProgress)}%`,
                    animation: 'gen-shimmer-move 2.8s linear infinite'
                  }}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {(() => {
                const stages = ['preflight', 'planning', 'rendering', 'validation'] as const
                const stageLabels: Record<string, string> = {
                  preflight: t('generating.stages.preflight'),
                  planning: t('generating.stages.planning'),
                  rendering: t('generating.stages.rendering'),
                  validation: t('generating.stages.validation')
                }
                const activeIndex = stages.indexOf(currentStage as typeof stages[number])
                return stages.map((stage, index) => {
                  const isActive = index === activeIndex
                  const isDone = index < activeIndex || status === 'completed'
                  return (
                    <span
                      key={stage}
                      className={cn(
                        'inline-flex h-6 min-w-0 items-center gap-1 rounded-md border px-1.5 text-[10px] font-medium',
                        isDone && 'border-[#b8d3a6] bg-[#edf6e8] text-[#4f7b3f]',
                        isActive && 'border-[#9fc48b] bg-[#e4f0dc] text-[#365528]',
                        !isDone && !isActive && 'border-[#ded3bf] bg-[#fffaf1]/70 text-[#9a927e]'
                      )}
                    >
                      {isDone && <CheckCircle2 className="h-3 w-3" />}
                      {isActive && status === 'running' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#4f7b3f]" />
                      )}
                      <span className="min-w-0 truncate">
                        {stage === 'rendering' && completedPageCount > 0
                          ? `${stageLabels[stage]} ${completedPageCount}/${totalPages}`
                          : stageLabels[stage]}
                      </span>
                    </span>
                  )
                })
              })()}
            </div>

            <div className="mt-3 grid gap-1.5">
              {canEnterEditor && (
                <Button size="sm" className="w-full" onClick={() => navigate(`/sessions/${id}`)}>
                  {t('generating.enterEditor')}
                </Button>
              )}
              {status === 'running' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (!id) return
                    void ipc.cancelGenerate(id)
                  }}
                >
                  {t('generating.cancelGeneration')}
                </Button>
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-[#d8ccb5]/72 bg-[#fff9ef]/82 p-2.5 shadow-[0_14px_30px_rgba(78,91,63,0.1)]">
            <div className="mb-2 flex items-center">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#495a3b]">
                <Sparkles className="h-4 w-4 text-[#6f8159]" />
                {friendlyText(lang, '成长日志', 'Growth log')}
              </div>
            </div>

            <ScrollArea
              className="min-h-0 flex-1 rounded-lg border border-[#e4d9c3]/55 bg-[#fffaf1]/38"
              viewportRef={eventsContainerRef}
              onViewportScroll={(e) => {
                const el = e.currentTarget
                stickToBottomRef.current = isNearLogBottom(el)
                if (stickToBottomRef.current) {
                  shouldAutoScrollRef.current = true
                }
              }}
              viewportClassName="px-2 py-2"
            >
              <div className="space-y-2">
                {events.map((event, index) => (
                  <div
                    key={`${event.text}-${index}`}
                    className="rounded-lg border border-[#e4d9c3]/70 bg-white/46 px-2.5 py-1.5 text-xs leading-5 text-[#5a674c] shadow-[0_6px_14px_rgba(93,107,77,0.06)]"
                  >
                    {event.time && (
                      <div className="mb-0.5 text-[10px] leading-4 text-[#a09882]">
                        {dayjs(event.time).format('HH:mm:ss')}
                      </div>
                    )}
                    <div className="break-words">{event.text}</div>
                  </div>
                ))}
                {status === 'running' && (
                  <div className="flex items-center gap-2 rounded-lg border border-[#e4d9c3]/70 bg-white/46 px-2.5 py-1.5 text-xs text-[#a09882] shadow-[0_6px_14px_rgba(93,107,77,0.06)]">
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                    <span className="min-w-0 truncate">{t('generating.growing')}</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </section>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7d8b63]">
                {friendlyText(lang, '页面正在创意生成中', 'Pages taking shape')}
              </p>
              <h2 className="mt-1 organic-serif text-[34px] font-semibold leading-tight text-[#2f3b28]">
                {friendlyText(lang, '生成预览板', 'Generation storyboard')}
              </h2>
            </div>
            <div className="rounded-lg border border-[#d8ccb5]/72 bg-[#fff9ef]/74 px-3 py-2 text-xs text-[#617350] shadow-sm">
              {friendlyText(lang, '完成', 'Done')} {completedPreviewCount}
              <span className="mx-1 text-[#a09882]">/</span>
              {Math.max(totalPages, previewPages.length)}
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1" viewportClassName={cn('pr-2', status === 'failed' ? 'pb-28' : 'pb-2')}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
              {previewPages.map((page, index) => (
                <div
                  key={page.id}
                  style={{
                    animation: `gen-page-rise 420ms ease ${Math.min(index * 55, 440)}ms both`
                  }}
                >
                  <GenerationThumbnail page={page} previewVersion={previewVersion} />
                </div>
              ))}
            </div>
          </ScrollArea>
        </main>
      </div>

      {status === 'failed' && (
        <div className="app-no-drag absolute inset-x-5 bottom-5 z-30 rounded-xl border border-[#d7b5ae] bg-[#fbf1ee]/94 px-4 py-3 text-sm text-[#93564f] shadow-[0_18px_42px_rgba(120,73,65,0.18)] backdrop-blur-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="font-medium">{error || t('generating.failedRetry')}</div>
              {failedPages.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {failedPages.map((page) => (
                    <span
                      key={page}
                      className="rounded-md border border-[#d7b5ae]/70 bg-[#fff8f4]/75 px-2 py-1 text-xs text-[#8e5a53]"
                    >
                      {page}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {canEnterEditor && (
                <Button size="sm" onClick={() => navigate(`/sessions/${id}`)}>
                  {t('generating.enterEditor')}
                </Button>
              )}
              {!fullyGenerated && hasGeneratedPages && (
                <Button
                  size="sm"
                  onClick={() =>
                    navigate(`/sessions/${id}/generating`, {
                      replace: true,
                      state: {
                        retry: true,
                        rerunToken: Date.now()
                      }
                    })
                  }
                >
                  {t('generating.continueRemaining')}
                </Button>
              )}
              {!hasGeneratedPages && (
                <Button
                  size="sm"
                  onClick={() =>
                    navigate(`/sessions/${id}/generating`, {
                      replace: true,
                      state: {
                        initialPrompt: state?.initialPrompt,
                        retry: false,
                        rerunToken: Date.now()
                      }
                    })
                  }
                >
                  {t('generating.regenerate')}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => navigate('/sessions', { replace: true })}>
                {t('generating.backToSessions')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
