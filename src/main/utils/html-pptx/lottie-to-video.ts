import { BrowserWindow } from 'electron'
import log from 'electron-log/main.js'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { SESSION_ASSET_SCRIPT_SRCS } from '../../ipc/engine/page-assets'
import { spawn } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { deflateSync } from 'zlib'

export interface LottieVideoCapture {
  videoFile: string
  videoData: Uint8Array
  gifFile: string
  gifData: Uint8Array
  width: number
  height: number
  blockId: string
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
  rect?: { x: number; y: number; w: number; h: number }
}

const CAPTURE_SIZE = 400
const TARGET_FPS = 25
const MAX_DURATION_MS = 5000
const MAX_FRAMES = 125
const PALETTE_SIZE = 256

export async function renderLottieAnimations(
  lottieElements: LottieTraceElement[],
  options?: { lottieAssetDir?: string }
): Promise<LottieVideoCapture[]> {
  if (!lottieElements.length) return []
  const results: LottieVideoCapture[] = []

  const win = new BrowserWindow({
    show: false,
    width: CAPTURE_SIZE, height: CAPTURE_SIZE,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true, sandbox: false,
      nodeIntegration: false, backgroundThrottling: false, offscreen: true,
    },
  })

  try {
    for (let i = 0; i < lottieElements.length; i++) {
      const el = lottieElements[i]
      const blockId = el.blockId || `lottie-${i}`
      try {
        const { videoData, gifData } = await renderSingle(win, el, options)
        const slideW = 1600, slideH = 900
        const rect = el.rect || { x: 0, y: 0, w: slideW, h: slideH }
        results.push({
          videoFile: `lottie${i + 1}.webm`, videoData,
          gifFile: `lottie${i + 1}.gif`, gifData,
          width: CAPTURE_SIZE, height: CAPTURE_SIZE, blockId,
          x: (rect.x / slideW) * 13.333, y: (rect.y / slideH) * 7.5,
          w: (rect.w / slideW) * 13.333, h: (rect.h / slideH) * 7.5,
        })
        log.info('[lottie-to-video] rendered', {
          blockId, webmKB: Math.round(videoData.length / 1024), gifKB: Math.round(gifData.length / 1024),
        })
      } catch (err) {
        log.warn('[lottie-to-video] failed', { blockId, error: err instanceof Error ? err.message : String(err) })
      }
    }
  } finally {
    win.destroy()
  }
  return results
}

async function renderSingle(win: BrowserWindow, el: LottieTraceElement, options?: { lottieAssetDir?: string }) {
  let lottieSrc = el.lottieSrc
  if (lottieSrc && !lottieSrc.startsWith('http') && !lottieSrc.startsWith('data:')) {
    const base = options?.lottieAssetDir
    if (base) lottieSrc = `file://${base.replace(/\/$/, '')}/${lottieSrc.replace(/^\.\//, '')}`
  }
  const speed = el.lottieSpeed && el.lottieSpeed > 0 ? el.lottieSpeed : 1
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildHtml(lottieSrc, speed))}`)
  await waitForReady(win, 3000)

  const info = await win.webContents.executeJavaScript(
    `(function(){ var a=window.__lottieAnim; return a ? {tf:a.totalFrames,fr:a.frameRate||30} : {tf:25,fr:30}; })()`
  )
  const totalFrames = Math.min(info.tf || 25, 60)
  const durMs = Math.min((totalFrames / (info.fr || 30)) * 1000, MAX_DURATION_MS)
  const frameCount = Math.min(Math.ceil((durMs / 1000) * TARGET_FPS), MAX_FRAMES)
  const delayCs = Math.round(100 / TARGET_FPS)

  const frames: Uint8Array[] = []
  const gif = GIFEncoder()
  for (let f = 0; f < frameCount; f++) {
    await win.webContents.executeJavaScript(`(function(){var a=window.__lottieAnim;if(a)a.goToAndStop(${Math.floor(f/frameCount*totalFrames)},true)})()`)
    await new Promise(r => setTimeout(r, 20))
    const img = await win.webContents.capturePage()
    const sz = img.getSize()
    const rgba = bgraToRgba(img.toBitmap(), sz.width, sz.height)
    frames.push(rgba)
    const pal = quantize(rgba, PALETTE_SIZE)
    if (pal) gif.writeFrame(applyPalette(rgba, pal), CAPTURE_SIZE, CAPTURE_SIZE, { palette: pal, delay: delayCs })
  }
  gif.finish()

  const videoData = await encodeWebm(frames, CAPTURE_SIZE, CAPTURE_SIZE, TARGET_FPS)
  return { videoData, gifData: gif.bytes() }
}

function encodeWebm(frames: Uint8Array[], w: number, h: number, fps: number): Promise<Uint8Array> {
  const tmp = mkdtempSync(join(tmpdir(), 'lottie-'))
  const paths: string[] = []
  for (let i = 0; i < frames.length; i++) {
    const p = join(tmp, `f${String(i).padStart(4, '0')}.png`)
    writeFileSync(p, rgbaToPng(frames[i], w, h))
    paths.push(p)
  }
  const outPath = join(tmp, 'out.webm')

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', '-framerate', String(fps), '-i', join(tmp, 'f%04d.png'),
      '-c:v', 'libvpx-vp9', '-lossless', '0', '-crf', '30', '-b:v', '0', '-auto-alt-ref', '1', outPath])
    proc.on('close', code => {
      try {
        const data = code === 0 ? new Uint8Array(readFileSync(outPath)) : new Uint8Array(0)
        for (const p of paths) try { unlinkSync(p) } catch {}
        try { unlinkSync(outPath) } catch {}
        try { rmdirSync(tmp) } catch {}
        if (code !== 0) log.warn('[lottie-to-video] ffmpeg failed, WebM skipped')
        resolve(data)
      } catch (e) { reject(e) }
    })
  })
}

async function waitForReady(win: BrowserWindow, ms: number) {
  const t = Date.now()
  while (Date.now() - t < ms) {
    const r = await win.webContents.executeJavaScript(`window.__lottieReady`)
    if (r === true) return
    if (r === 'failed') throw new Error('Lottie data failed')
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('Lottie load timeout')
}

function buildHtml(src: string, speed: number) {
  return `<!DOCTYPE html><html><head>
<script src="${SESSION_ASSET_SCRIPT_SRCS.lottie}"></script>
<style>*{margin:0;padding:0}body{width:${CAPTURE_SIZE}px;height:${CAPTURE_SIZE}px;overflow:hidden;background:transparent}#c{width:${CAPTURE_SIZE}px;height:${CAPTURE_SIZE}px}</style>
</head><body><div id="c"></div>
<script>var a=lottie.loadAnimation({container:document.getElementById('c'),renderer:'svg',loop:false,autoplay:false,path:'${src.replace(/'/g,"\\'")}'});a.setSpeed(${speed});window.__lottieAnim=a;window.__lottieReady=false;a.addEventListener('data_ready',function(){window.__lottieReady=true});a.addEventListener('data_failed',function(){window.__lottieReady='failed'});</script>
</body></html>`
}

function bgraToRgba(bmp: Buffer, w: number, h: number): Uint8Array {
  const s = w * h * 4, r = new Uint8Array(s)
  for (let i = 0; i < s; i += 4) { r[i]=bmp[i+2]; r[i+1]=bmp[i+1]; r[i+2]=bmp[i]; r[i+3]=bmp[i+3] }
  return r
}

function rgbaToPng(rgba: Uint8Array, w: number, h: number): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) { raw[y*(1+w*4)]=0; raw.set(rgba.subarray(y*w*4, (y+1)*w*4), y*(1+w*4)+1) }
  const sig = Buffer.from([137,80,78,71,13,10,26,10])
  const ihdrD = Buffer.alloc(13); ihdrD.writeUInt32BE(w,0); ihdrD.writeUInt32BE(h,4); ihdrD[8]=8; ihdrD[9]=6
  return Buffer.concat([sig, pngChunk('IHDR',ihdrD), pngChunk('IDAT',deflateSync(raw)), pngChunk('IEND',Buffer.alloc(0))])
}

function pngChunk(type: string, data: Buffer): Buffer {
  const t = Buffer.from(type), len = Buffer.alloc(4); len.writeUInt32BE(data.length,0)
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t,data]))>>>0,0)
  return Buffer.concat([len,t,data,c])
}

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) { crc ^= buf[i]; for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0) }
  return (crc ^ 0xFFFFFFFF) >>> 0
}
