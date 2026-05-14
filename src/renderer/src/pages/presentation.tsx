import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ipc } from '@renderer/lib/ipc'

interface PresentPage {
  pageId: string
  pageNumber: number
  htmlPath: string
}

export function PresentationPage(): React.JSX.Element {
  const [pages, setPages] = useState<PresentPage[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState('scale(1)')

  // Parse params from hash URL
  const params = useMemo(() => {
    const hash = window.location.hash
    const queryStart = hash.indexOf('?')
    if (queryStart < 0) return { sessionId: '', startIndex: 0 }
    const search = new URLSearchParams(hash.slice(queryStart + 1))
    return {
      sessionId: search.get('sessionId') || '',
      startIndex: Number(search.get('startIndex') || 0)
    }
  }, [])

  // Load session pages
  useEffect(() => {
    if (!params.sessionId) return
    ipc
      .getSession(params.sessionId)
      .then((result) => {
        const list = (result.generatedPages || [])
          .sort((a, b) => a.pageNumber - b.pageNumber)
          .map((p) => ({
            pageId: p.pageId || `page-${p.pageNumber}`,
            pageNumber: p.pageNumber,
            htmlPath: p.htmlPath || ''
          }))
          .filter((p) => p.htmlPath)
        setPages(list)
        setCurrentIndex(Math.min(params.startIndex, list.length - 1))
      })
      .catch(() => {})
  }, [params.sessionId, params.startIndex])

  const totalPages = pages.length
  const currentPage = pages[currentIndex]

  // Resolve page HTML path (index.html → <pageId>.html)
  const resolveHtmlPath = (htmlPath: string, pageId: string): string | undefined => {
    const isIndex = /[\\/](?:index|deck)\.html?$/i.test(htmlPath)
    if (!isIndex) return htmlPath
    if (!pageId) return undefined
    return htmlPath.replace(/(?:index|deck)\.html?$/i, `${pageId}.html`)
  }

  const encodePathSegments = (filePath: string): string =>
    filePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')

  const toFileUrl = (absolutePath: string): string => {
    const normalized = absolutePath.replace(/\\/g, '/')
    const fileUrl = /^[a-zA-Z]:\//.test(normalized)
      ? `file:///${normalized.slice(0, 2)}${encodePathSegments(normalized.slice(2))}`
      : normalized.startsWith('/')
        ? `file://${encodePathSegments(normalized)}`
        : `file:///${encodePathSegments(normalized)}`
    const url = new URL(fileUrl)
    url.searchParams.set('fit', 'off')
    return url.toString()
  }

  const webviewSrc = useMemo(() => {
    if (!currentPage) return undefined
    const resolved = resolveHtmlPath(currentPage.htmlPath, currentPage.pageId)
    if (!resolved) return undefined
    return toFileUrl(resolved)
  }, [currentPage])

  // Scale webview to fill container (cover mode — no black borders)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateScale = (): void => {
      const { width, height } = el.getBoundingClientRect()
      const scale = Math.min(width / 1600, height / 900)
      const s = Number.isFinite(scale) && scale > 0 ? scale : 1
      const offsetX = (width - 1600 * s) / 2
      const offsetY = (height - 900 * s) / 2
      setTransform(`translate(${offsetX}px, ${offsetY}px) scale(${s})`)
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Close window via IPC (works on Windows)
  const closeWindow = useCallback(() => {
    window.electron?.ipcRenderer.send('presentation:close')
  }, [])

  // Keyboard navigation
  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalPages - 1))
  }, [totalPages])

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        closeWindow()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev, closeWindow])

  // Click/touch navigation: left half = prev, right half = next
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { clientX } = e
      const { width } = e.currentTarget.getBoundingClientRect()
      if (clientX < width / 2) {
        goPrev()
      } else {
        goNext()
      }
    },
    [goPrev, goNext]
  )

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-screen cursor-none overflow-hidden bg-black"
      onClick={handleClick}
    >
      {webviewSrc && (
        <webview
          src={webviewSrc}
          className="absolute left-0 top-0 h-[900px] w-[1600px] origin-top-left"
          style={{ transform }}
        />
      )}
    </div>
  )
}
