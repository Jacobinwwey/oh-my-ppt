import { BrowserWindow } from 'electron'
import log from 'electron-log/main.js'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { SESSION_ASSET_SCRIPT_SRCS } from '../../ipc/engine/page-assets'

export interface LottieGifCapture {
  mediaFile: string
  data: Uint8Array
  width: number
  height: number
  blockId: string
  /** Slide position in inches (from px conversion) */
  x: number
  y: number
  w: number
  h: number
}

interface LottieTraceElement {
  type: 'lottie'
  lottieSrc: string
  lottieLoop?: boolean
  lottieSpeed?: number
  blockId?: string
  /** Element position on slide (px) */
  rect?: { x: number; y: number; w: number; h: number }
}

// Optimization: small resolution, low fps, limited colors → compact GIF
const MAX_CAPTURE_SIZE = 150
const TARGET_FPS = 10
const MAX_DURATION_MS = 3000
const MAX_FRAMES = 30
const PALETTE_SIZE = 64

/**
 * Renders Lottie animations to optimized animated GIFs.
 *
 * Optimization strategy:
 * - Resolution capped at 150px (Lottie animations are typically decorative icons)
 * - 10fps (visually smooth for decorative animations, 3x fewer frames than 30fps)
 * - 64-color palette (sufficient for flat/vector Lottie art, halves palette vs 256)
 * - Duration capped at 3s (most Lottie loops are 1-3s)
 *
 * Result: ~40-120KB per animation vs 500KB-2MB for naive GIF.
 * Animated GIF is the only animated image format universally supported in PPTX
 * (PPT 2000+, LibreOffice, Google Slides). Animated WebP only works in PPT 365.
 */
export async function renderLottieAnimationsToGif(
  lottieElements: LottieTraceElement[],
  options?: { lottieAssetDir?: string }
): Promise<LottieGifCapture[]> {
  if (!lottieElements.length) return []

  const results: LottieGifCapture[] = []

  const win = new BrowserWindow({
    show: false,
    width: MAX_CAPTURE_SIZE,
    height: MAX_CAPTURE_SIZE,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: true,
    },
  })

  try {
    for (let i = 0; i < lottieElements.length; i++) {
      const el = lottieElements[i]
      const blockId = el.blockId || `lottie-${i}`
      const mediaFile = `lottie${i + 1}.gif`

      try {
        const gifData = await renderSingleLottieToGif(win, el, options)
        const slideW = 1600, slideH = 900
        const rect = el.rect || { x: 0, y: 0, w: slideW, h: slideH }
        results.push({
          mediaFile, data: gifData, width: MAX_CAPTURE_SIZE, height: MAX_CAPTURE_SIZE, blockId,
          x: (rect.x / slideW) * 13.333,
          y: (rect.y / slideH) * 7.5,
          w: (rect.w / slideW) * 13.333,
          h: (rect.h / slideH) * 7.5,
        })
        log.info('[lottie-to-gif] rendered', { blockId, mediaFile, sizeKB: Math.round(gifData.length / 1024) })
      } catch (err) {
        log.warn('[lottie-to-gif] failed', {
          blockId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  } finally {
    win.destroy()
  }

  return results
}

async function renderSingleLottieToGif(
  win: BrowserWindow,
  el: LottieTraceElement,
  options?: { lottieAssetDir?: string }
): Promise<Uint8Array> {
  let lottieSrc = el.lottieSrc
  if (lottieSrc && !lottieSrc.startsWith('http') && !lottieSrc.startsWith('data:')) {
    const base = options?.lottieAssetDir
    if (base) {
      lottieSrc = `file://${base.replace(/\/$/, '')}/${lottieSrc.replace(/^\.\//, '')}`
    }
  }

  const speed = el.lottieSpeed && el.lottieSpeed > 0 ? el.lottieSpeed : 1
  const html = buildLottieRenderHtml(lottieSrc, speed)
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`

  await win.loadURL(dataUrl)

  // Wait for Lottie data to load (max 3s)
  await waitForLottieReady(win, 3000)

  // Get animation metadata
  const frameInfo = await win.webContents.executeJavaScript(`
    (function() {
      var a = window.__lottieAnim;
      if (!a) return { totalFrames: 20, frameRate: 30 };
      return { totalFrames: a.totalFrames, frameRate: a.frameRate || 30 };
    })()
  `)

  const totalFrames = Math.min(frameInfo.totalFrames || 20, 60)
  const durationMs = Math.min(
    (totalFrames / (frameInfo.frameRate || 30)) * 1000,
    MAX_DURATION_MS
  )
  const frameCount = Math.min(Math.ceil((durationMs / 1000) * TARGET_FPS), MAX_FRAMES)
  const frameDelayCs = Math.round(100 / TARGET_FPS)

  // Capture frames
  const frames: Uint8Array[] = []
  for (let f = 0; f < frameCount; f++) {
    const targetFrame = Math.floor((f / frameCount) * totalFrames)

    await win.webContents.executeJavaScript(`
      (function() {
        var a = window.__lottieAnim;
        if (a) a.goToAndStop(${targetFrame}, true);
      })()
    `)
    await new Promise((r) => setTimeout(r, 20))

    const image = await win.webContents.capturePage()
    const size = image.getSize()
    const bitmap = image.toBitmap()
    frames.push(bgraToRgba(bitmap, size.width, size.height))
  }

  return encodeGif(frames, MAX_CAPTURE_SIZE, MAX_CAPTURE_SIZE, frameDelayCs)
}

async function waitForLottieReady(win: BrowserWindow, timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const ready = await win.webContents.executeJavaScript(
      `window.__lottieReady`
    )
    if (ready === true) return
    if (ready === 'failed') throw new Error('Lottie data failed to load')
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('Lottie load timeout')
}

function buildLottieRenderHtml(lottieSrc: string, speed: number): string {
  return `<!DOCTYPE html>
<html><head>
<script src="${SESSION_ASSET_SCRIPT_SRCS.lottie}"></script>
<style>
  * { margin: 0; padding: 0; }
  body { width: ${MAX_CAPTURE_SIZE}px; height: ${MAX_CAPTURE_SIZE}px; overflow: hidden; background: transparent; }
  #c { width: ${MAX_CAPTURE_SIZE}px; height: ${MAX_CAPTURE_SIZE}px; }
</style>
</head><body>
<div id="c"></div>
<script>
  var a = lottie.loadAnimation({
    container: document.getElementById('c'),
    renderer: 'svg',
    loop: false,
    autoplay: false,
    path: '${lottieSrc.replace(/'/g, "\\'")}',
  });
  a.setSpeed(${speed});
  window.__lottieAnim = a;
  window.__lottieReady = false;
  a.addEventListener('data_ready', function() { window.__lottieReady = true; });
  a.addEventListener('data_failed', function() { window.__lottieReady = 'failed'; });
</script>
</body></html>`
}

function encodeGif(frames: Uint8Array[], width: number, height: number, delayCs: number): Uint8Array {
  const gif = GIFEncoder()
  for (const frame of frames) {
    const palette = quantize(frame, PALETTE_SIZE)
    if (!palette) continue
    const index = applyPalette(frame, palette)
    gif.writeFrame(index, width, height, { palette, delay: delayCs })
  }
  gif.finish()
  return gif.bytes()
}

function bgraToRgba(bitmap: Buffer, width: number, height: number): Uint8Array {
  const size = width * height * 4
  const rgba = new Uint8Array(size)
  for (let i = 0; i < size; i += 4) {
    rgba[i] = bitmap[i + 2]
    rgba[i + 1] = bitmap[i + 1]
    rgba[i + 2] = bitmap[i]
    rgba[i + 3] = bitmap[i + 3]
  }
  return rgba
}
