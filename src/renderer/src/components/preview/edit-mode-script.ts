export const EDIT_MODE_CONSOLE_PREFIX = '__PPT_EDIT_MODE__:'

export interface EditSelectionPayload {
  selector: string
  label: string
  elementTag: string
  elementText: string
  isText: boolean
  text: string
  style: {
    color?: string
    fontSize?: string
    fontWeight?: string
    lineHeight?: string
    textAlign?: string
    backgroundColor?: string
  }
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface EditModeMovePayload {
  selector: string
  label: string
  elementTag: string
  x: number
  y: number
  deltaX: number
  deltaY: number
  width?: number
  height?: number
  scale?: number
  childUpdates?: Array<{
    path: number[]
    width?: number
    height?: number
  }>
}

export function buildEditModeInjectScript(): string {
  return `
(() => {
  const STATE_KEY = "__pptEditModeState";
  const STYLE_ID = "ppt-edit-mode-style";
  const OVERLAY_ID = "ppt-edit-mode-resize-overlay";
  const HOVER_CLASS = "ppt-edit-mode-hover";
  const SELECTED_CLASS = "ppt-edit-mode-selected";
  const HANDLE_CLASS = "ppt-edit-mode-resize-handle";
  const LOG_PREFIX = "${EDIT_MODE_CONSOLE_PREFIX}";
  const SCAFFOLD_BLOCK_IDS = new Set(["content"]);
  const TEXT_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "span", "strong", "em", "b", "i", "small", "label", "button", "td", "th", "blockquote", "figcaption"]);
  const BLOCKED_TEXT_TAGS = new Set(["script", "style", "svg", "canvas", "img", "video", "audio", "input", "textarea", "select", "option"]);

  const normalizeText = (value) => String(value || "").replace(/\\\\s+/g, " ").trim();

  const hasOnlyEditableTextChildren = (element) => {
    return Array.from(element.children || []).every((child) => {
      const tag = child.tagName ? child.tagName.toLowerCase() : "";
      return tag === "br";
    });
  };

  const isEditableTextElement = (element) => {
    if (!(element instanceof Element)) return false;
    const tag = element.tagName ? element.tagName.toLowerCase() : "";
    if (!tag || BLOCKED_TEXT_TAGS.has(tag)) return false;
    if (element.closest("svg, canvas, script, style")) return false;
    if (!hasOnlyEditableTextChildren(element)) return false;
    if (!TEXT_TAGS.has(tag) && !element.getAttribute("data-role") && !element.getAttribute("data-block-id")) return false;
    const text = normalizeText(element.textContent);
    if (!text || text.length > 500) return false;
    return true;
  };

  const existing = window[STATE_KEY];
  if (existing && existing.active) return;

  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => "\\\\" + ch);
  };

  const attrEscape = (value) => String(value).replace(/"/g, '\\\\"');

  const isUniqueSelector = (selector) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (_error) {
      return false;
    }
  };

  const getPageScopeSelector = () => {
    const pageId = document.body ? document.body.getAttribute("data-page-id") : "";
    if (pageId) return 'body[data-page-id="' + attrEscape(pageId) + '"]';
    return "body";
  };

  const getClassList = (el) =>
    Array.from(el.classList || [])
      .filter((item) => item && !item.startsWith("ppt-edit-mode-") && !item.includes(":"))
      .slice(0, 3);

  const buildSegment = (el) => {
    const tag = el.tagName.toLowerCase();
    const id = el.getAttribute("id");
    if (id) return "#" + cssEscape(id);
    const role = el.getAttribute("data-role");
    if (role) return tag + '[data-role="' + attrEscape(role) + '"]';
    const blockId = el.getAttribute("data-block-id");
    if (blockId) return tag + '[data-block-id="' + attrEscape(blockId) + '"]';
    const classes = getClassList(el);
    if (classes.length > 0) {
      return tag + "." + classes.map((item) => cssEscape(item)).join(".");
    }
    return tag;
  };

  const buildScopedSelector = (scope, el) => {
    const levels = [];
    let cursor = el;
    while (
      cursor &&
      cursor instanceof Element &&
      cursor !== document.body &&
      cursor !== document.documentElement &&
      levels.length < 3
    ) {
      levels.unshift(buildSegment(cursor));
      cursor = cursor.parentElement;
    }

    const candidates = [];
    if (levels.length >= 1) {
      candidates.push(scope + " " + levels[levels.length - 1]);
    }
    if (levels.length >= 2) {
      candidates.push(scope + " " + levels[levels.length - 2] + " > " + levels[levels.length - 1]);
    }
    if (levels.length >= 3) {
      candidates.push(scope + " " + levels[levels.length - 3] + " > " + levels[levels.length - 2] + " > " + levels[levels.length - 1]);
    }

    for (const candidate of candidates) {
      if (isUniqueSelector(candidate)) return candidate;
    }

    return candidates[candidates.length - 1] || (scope + " " + buildSegment(el));
  };

  const buildStableSelector = (el) => {
    if (!(el instanceof Element)) return null;
    const scope = getPageScopeSelector();
    const blockId = el.getAttribute("data-block-id");
    if (blockId) return scope + ' [data-block-id="' + attrEscape(blockId) + '"]';

    const role = el.getAttribute("data-role");
    if (role) {
      const owner = el.closest("[data-block-id]");
      const ownerBlockId = owner ? owner.getAttribute("data-block-id") : "";
      if (ownerBlockId) {
        const roleSelector =
          scope +
          ' [data-block-id="' +
          attrEscape(ownerBlockId) +
          '"] [data-role="' +
          attrEscape(role) +
          '"]';
        if (isUniqueSelector(roleSelector)) return roleSelector;
      }
    }

    const idValue = el.getAttribute("id");
    if (idValue) {
      const selector = scope + " #" + cssEscape(idValue);
      if (isUniqueSelector(selector)) return selector;
      return selector;
    }

    const root = el.closest("[data-ppt-guard-root='1'], .ppt-page-root");
    if (root) {
      const rootSelector = root.getAttribute("data-ppt-guard-root") === "1"
        ? '[data-ppt-guard-root="1"]'
        : ".ppt-page-root";
      const segments = [];
      let current = el;
      while (current && current !== root) {
        const parent = current.parentElement;
        if (!parent) break;
        const index = Array.prototype.indexOf.call(parent.children, current);
        if (index < 0) break;
        const tag = current.tagName ? current.tagName.toLowerCase() : "*";
        segments.unshift(tag + ":nth-child(" + (index + 1) + ")");
        current = parent;
      }
      if (current === root && segments.length > 0) {
        const selector = scope + " " + rootSelector + " " + segments.join(" > ");
        if (isUniqueSelector(selector)) return selector;
      }
    }

    return buildScopedSelector(scope, el);
  };

  const isInsidePageRoot = (element) => {
    return element && (element.closest(".ppt-page-root") !== null || element.closest("[data-ppt-guard-root='1']") !== null);
  };

  const getPageRoot = (element) => {
    return element && element.closest(".ppt-page-root, [data-ppt-guard-root='1']");
  };

  const isScaffoldBlock = (element) => {
    if (!(element instanceof Element)) return false;
    const blockId = element.getAttribute("data-block-id");
    const role = element.getAttribute("data-role");
    return (
      SCAFFOLD_BLOCK_IDS.has(String(blockId || "")) ||
      role === "content" ||
      element.classList.contains("ppt-page-root") ||
      element.classList.contains("ppt-page-fit-scope") ||
      element.classList.contains("ppt-page-content") ||
      element.getAttribute("data-ppt-guard-root") === "1" ||
      element.tagName === "BODY" ||
      element.tagName === "HTML"
    );
  };

  const getContentRoot = (element) => {
    return element && element.closest('[data-block-id="content"], [data-role="content"]');
  };

  const isUsableElementTarget = (element) => {
    if (!(element instanceof Element)) return false;
    if (isScaffoldBlock(element)) return false;
    if (!isInsidePageRoot(element)) return false;
    if (["SCRIPT", "STYLE", "LINK", "META", "TITLE"].includes(element.tagName)) return false;
    const contentRoot = getContentRoot(element);
    const boundaryRoot = contentRoot || getPageRoot(element);
    if (!boundaryRoot || element === boundaryRoot) return false;
    const rect = element.getBoundingClientRect();
    return rect.width >= 2 && rect.height >= 2;
  };

  const isPointInRect = (rect, clientX, clientY) => {
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  };

  const getElementDepth = (element) => {
    let depth = 0;
    let current = element;
    while (current && current.parentElement) {
      depth += 1;
      current = current.parentElement;
    }
    return depth;
  };

  const getPointTarget = (origin, clientX, clientY) => {
    const hitElement = document.elementFromPoint(clientX, clientY);
    const root = getPageRoot(origin) || getPageRoot(hitElement) || document.querySelector(".ppt-page-root, [data-ppt-guard-root='1']");
    if (!root) return null;
    const seen = new Set();
    const candidates = [];
    const addCandidate = (element) => {
      if (!(element instanceof Element)) return;
      if (seen.has(element)) return;
      seen.add(element);
      if (!root.contains(element)) return;
      if (!isUsableElementTarget(element)) return;
      const selector = buildStableSelector(element);
      if (!selector) return;
      const rect = element.getBoundingClientRect();
      if (!isPointInRect(rect, clientX, clientY)) return;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      candidates.push({
        element,
        area: Math.max(1, rect.width * rect.height),
        distance: Math.hypot(centerX - clientX, centerY - clientY),
        depth: getElementDepth(element),
      });
    };

    if (typeof document.elementsFromPoint === "function") {
      document.elementsFromPoint(clientX, clientY).forEach(addCandidate);
    }
    root.querySelectorAll("*").forEach(addCandidate);

    candidates.sort((a, b) => a.area - b.area || b.depth - a.depth || a.distance - b.distance);
    return candidates[0]?.element || null;
  };

  const pickCanvasTarget = (origin) => {
    const canvas = origin.closest("canvas");
    if (!canvas || !isInsidePageRoot(canvas)) return null;
    let candidate = canvas.parentElement && !isScaffoldBlock(canvas.parentElement) ? canvas.parentElement : canvas;
    while (candidate && candidate.parentElement && !buildStableSelector(candidate)) {
      if (isScaffoldBlock(candidate.parentElement)) break;
      candidate = candidate.parentElement;
    }
    return buildStableSelector(candidate) ? candidate : null;
  };

  const pickLooseContentTarget = (origin) => {
    const contentRoot = getContentRoot(origin) || getPageRoot(origin);
    if (!contentRoot) return null;
    let candidate = origin;
    while (candidate && candidate !== contentRoot) {
      if (isUsableElementTarget(candidate) && buildStableSelector(candidate)) return candidate;
      candidate = candidate.parentElement;
    }
    return null;
  };

  const pickTarget = (origin, clientX, clientY) => {
    if (!(origin instanceof Element)) return null;
    const chartTarget = pickCanvasTarget(origin);
    if (chartTarget) return chartTarget;
    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
      const pointTarget = getPointTarget(origin, clientX, clientY);
      if (pointTarget) return pointTarget;
    }
    const looseTarget = pickLooseContentTarget(origin);
    if (looseTarget) return looseTarget;
    const blocks = Array.from(origin.closest(".ppt-page-root, [data-ppt-guard-root='1']")?.querySelectorAll("[data-block-id]") || []);
    const target = origin.closest("[data-block-id]");
    if (target && blocks.includes(target) && isInsidePageRoot(target) && !isScaffoldBlock(target)) {
      return target;
    }
    return null;
  };

  const parsePx = (value) => {
    const match = String(value || "").trim().match(/^(-?\\d+(?:\\.\\d+)?)px$/);
    return match ? Number(match[1]) : 0;
  };

  const ensureDragTranslate = (target) => {
    const computed = getComputedStyle(target);
    if (computed.display === "inline") {
      target.style.display = "inline-block";
    }
    target.style.translate = "var(--ppt-drag-x, 0px) var(--ppt-drag-y, 0px)";
    target.style.willChange = "transform";
  };

  const roundPx = (value) => Number(Math.max(1, value).toFixed(1));

  const buildElementPath = (root, element) => {
    const path = [];
    let current = element;
    while (current && current !== root) {
      const parent = current.parentElement;
      if (!parent) return [];
      const index = Array.prototype.indexOf.call(parent.children, current);
      if (index < 0) return [];
      path.unshift(index);
      current = parent;
    }
    return current === root ? path : [];
  };

  const collectResizableChildren = (target) => {
    const items = [];
    const seen = new Set();
    target.querySelectorAll("canvas").forEach((canvas) => {
      const parent = canvas.parentElement;
      const element = parent && parent !== target ? parent : canvas;
      if (!element || seen.has(element)) return;
      seen.add(element);
      const rect = element.getBoundingClientRect();
      const path = buildElementPath(target, element);
      if (!path.length && element !== target) return;
      items.push({
        element,
        path,
        baseWidth: Math.max(1, rect.width),
        baseHeight: Math.max(1, rect.height),
      });
    });
    return items;
  };

  const resizeNestedCharts = (target) => {
    if (window.PPT && typeof window.PPT.resizeCharts === "function") {
      try { window.PPT.resizeCharts(target); } catch (_error) {}
    }
  };

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = \`
      .\${HOVER_CLASS} {
        outline: 2px dashed rgba(93,107,77,0.78) !important;
        outline-offset: 3px !important;
        cursor: move !important;
      }
      .\${HOVER_CLASS} * {
        cursor: move !important;
      }
      .\${SELECTED_CLASS} {
        outline: 2px solid #5d6b4d !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 4px rgba(93,107,77,0.14) !important;
        cursor: move !important;
        user-select: none !important;
      }
      .\${SELECTED_CLASS} * {
        cursor: move !important;
      }
      #\${OVERLAY_ID} {
        position: fixed !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        border: 1px solid rgba(93,107,77,0.92) !important;
        box-shadow: 0 0 0 3px rgba(93,107,77,0.12) !important;
        box-sizing: border-box !important;
      }
      #\${OVERLAY_ID} .\${HANDLE_CLASS} {
        position: absolute !important;
        width: 16px !important;
        height: 16px !important;
        border: 2px solid #ffffff !important;
        border-radius: 999px !important;
        background: #5d6b4d !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.18) !important;
        pointer-events: auto !important;
        box-sizing: border-box !important;
      }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="n"] {
        left: calc(50% - 8px) !important;
        top: -9px !important;
        cursor: ns-resize !important;
      }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="s"] {
        left: calc(50% - 8px) !important;
        bottom: -9px !important;
        cursor: ns-resize !important;
      }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="w"] {
        left: -9px !important;
        top: calc(50% - 8px) !important;
        cursor: ew-resize !important;
      }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="e"] {
        right: -9px !important;
        top: calc(50% - 8px) !important;
        cursor: ew-resize !important;
      }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="nw"] {
        left: -9px !important;
        top: -9px !important;
        cursor: nwse-resize !important;
      }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="ne"] {
        right: -9px !important;
        top: -9px !important;
        cursor: nesw-resize !important;
      }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="sw"] {
        left: -9px !important;
        bottom: -9px !important;
        cursor: nesw-resize !important;
      }
      #\${OVERLAY_ID} .\${HANDLE_CLASS}[data-dir="se"] {
        right: -9px !important;
        bottom: -9px !important;
        cursor: nwse-resize !important;
      }
      html,
      body,
      body * {
        cursor: move !important;
        -webkit-user-select: none !important;
        user-select: none !important;
      }
    \`;
    document.head.appendChild(style);
  };

  // --- State ---
  let hoverElement = null;
  let selectedElement = null;
  let dragState = null;
  let resizeState = null;
  let pendingAnchorState = null;
  let dragPendingState = null;
  let pendingClientX = 0;
  let pendingClientY = 0;
  let frameId = 0;
  let overlayElement = null;
  let overlayResizeObserver = null;

  // Double-click detection
  const DBLCLICK_MS = 400;
  let lastClickTime = 0;
  let lastClickTarget = null;
  let lastClickSelector = null;

  // Anchor resolution — host resolves selector and calls this
  window.__pptResolveEditModeAnchor = function(result) {
    if (!pendingAnchorState) return;
    const stableSelector = (result && result.selector) || pendingAnchorState.tempSelector;
    if (pendingAnchorState.mode === 'drag') {
      dragState = {
        target: pendingAnchorState.target,
        selector: stableSelector,
        elementTag: pendingAnchorState.elementTag,
        startClientX: pendingAnchorState.startClientX,
        startClientY: pendingAnchorState.startClientY,
        baseX: pendingAnchorState.baseX,
        baseY: pendingAnchorState.baseY,
      };
      setSelected(pendingAnchorState.target);
    } else if (pendingAnchorState.mode === 'resize') {
      resizeState = {
        target: pendingAnchorState.target,
        selector: stableSelector,
        elementTag: pendingAnchorState.elementTag,
        dir: pendingAnchorState.dir,
        startClientX: pendingAnchorState.startClientX,
        startClientY: pendingAnchorState.startClientY,
        baseX: pendingAnchorState.baseX,
        baseY: pendingAnchorState.baseY,
        baseWidth: pendingAnchorState.baseWidth,
        baseHeight: pendingAnchorState.baseHeight,
        childItems: pendingAnchorState.childItems,
      };
    }
    pendingAnchorState = null;
  };

  const cursorHost = document.body || document.documentElement;
  const rootHost = document.documentElement;
  const previousCursor = cursorHost && cursorHost.style ? cursorHost.style.cursor : "";
  const previousRootCursor = rootHost && rootHost.style ? rootHost.style.cursor : "";
  if (rootHost && rootHost.style) {
    rootHost.style.cursor = "move";
  }
  if (cursorHost && cursorHost.style) {
    cursorHost.style.cursor = "move";
  }
  ensureStyle();

  // --- Visual helpers ---
  const setHover = (target) => {
    if (hoverElement === target) return;
    if (hoverElement && hoverElement !== selectedElement) hoverElement.classList.remove(HOVER_CLASS);
    hoverElement = target;
    if (hoverElement && hoverElement !== selectedElement) hoverElement.classList.add(HOVER_CLASS);
  };

  const ensureOverlay = () => {
    if (overlayElement && overlayElement.isConnected) return overlayElement;
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    ["n", "s", "w", "e", "nw", "ne", "sw", "se"].forEach((dir) => {
      const handle = document.createElement("div");
      handle.className = HANDLE_CLASS;
      handle.setAttribute("data-dir", dir);
      overlay.appendChild(handle);
    });
    document.body.appendChild(overlay);
    overlayElement = overlay;
    return overlayElement;
  };

  const updateOverlay = () => {
    if (!selectedElement) {
      if (overlayElement) overlayElement.remove();
      overlayElement = null;
      return;
    }
    const overlay = ensureOverlay();
    const rect = selectedElement.getBoundingClientRect();
    overlay.style.left = rect.left.toFixed(1) + "px";
    overlay.style.top = rect.top.toFixed(1) + "px";
    overlay.style.width = Math.max(1, rect.width).toFixed(1) + "px";
    overlay.style.height = Math.max(1, rect.height).toFixed(1) + "px";
  };

  const setSelected = (target) => {
    if (selectedElement === target) return;
    if (selectedElement) selectedElement.classList.remove(SELECTED_CLASS);
    if (overlayResizeObserver) {
      overlayResizeObserver.disconnect();
      overlayResizeObserver = null;
    }
    selectedElement = target;
    if (selectedElement) {
      selectedElement.classList.remove(HOVER_CLASS);
      selectedElement.classList.add(SELECTED_CLASS);
      updateOverlay();
      overlayResizeObserver = new ResizeObserver(() => updateOverlay());
      overlayResizeObserver.observe(selectedElement);
    } else {
      updateOverlay();
    }
  };

  const clearVisualState = () => {
    if (hoverElement) hoverElement.classList.remove(HOVER_CLASS);
    if (selectedElement) selectedElement.classList.remove(SELECTED_CLASS);
    hoverElement = null;
    selectedElement = null;
    if (overlayResizeObserver) {
      overlayResizeObserver.disconnect();
      overlayResizeObserver = null;
    }
    if (overlayElement) overlayElement.remove();
    overlayElement = null;
  };

  // --- Emit helpers ---
  const emitSelected = (target, selector) => {
    const elementTag = target.tagName ? target.tagName.toLowerCase() : "";
    const isText = isEditableTextElement(target);
    const rawText = isText ? normalizeText(target.textContent) : "";
    const elementText = rawText.length > 80 ? rawText.slice(0, 80) + "\\u2026" : rawText;
    const computed = isText ? window.getComputedStyle(target) : null;
    const rect = target.getBoundingClientRect();

    console.log(LOG_PREFIX + JSON.stringify({
      type: "selected",
      selector,
      label: selector,
      elementTag,
      elementText,
      isText,
      text: rawText,
      style: computed ? {
        color: computed.color || "",
        fontSize: computed.fontSize || "",
        fontWeight: computed.fontWeight || "",
        lineHeight: computed.lineHeight || "",
        textAlign: computed.textAlign || "",
        backgroundColor: computed.backgroundColor || ""
      } : {},
      bounds: {
        x: Math.round(rect.left * 10) / 10,
        y: Math.round(rect.top * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10
      }
    }));
  };

  // --- Drag/Resize frame callbacks ---
  const applyPendingDrag = () => {
    frameId = 0;
    if (!dragState) return;
    const nextX = dragState.baseX + pendingClientX - dragState.startClientX;
    const nextY = dragState.baseY + pendingClientY - dragState.startClientY;
    dragState.target.style.setProperty("--ppt-drag-x", nextX.toFixed(1) + "px");
    dragState.target.style.setProperty("--ppt-drag-y", nextY.toFixed(1) + "px");
    ensureDragTranslate(dragState.target);
    updateOverlay();
  };

  const applyPendingResize = () => {
    frameId = 0;
    if (!resizeState) return;
    const dx = pendingClientX - resizeState.startClientX;
    const dy = pendingClientY - resizeState.startClientY;
    const dir = resizeState.dir;
    const affectsWidth = dir.includes("w") || dir.includes("e");
    const affectsHeight = dir.includes("n") || dir.includes("s");
    const signedDx = dir.includes("w") ? -dx : (dir.includes("e") ? dx : 0);
    const signedDy = dir.includes("n") ? -dy : (dir.includes("s") ? dy : 0);
    let nextWidth = affectsWidth ? roundPx(resizeState.baseWidth + signedDx) : resizeState.baseWidth;
    let nextHeight = affectsHeight ? roundPx(resizeState.baseHeight + signedDy) : resizeState.baseHeight;
    if (affectsWidth && affectsHeight) {
      const scaleFromX = (resizeState.baseWidth + signedDx) / resizeState.baseWidth;
      const scaleFromY = (resizeState.baseHeight + signedDy) / resizeState.baseHeight;
      const rawScale = Math.abs(signedDx) >= Math.abs(signedDy) ? scaleFromX : scaleFromY;
      const nextScale = Math.max(0.15, Math.min(5, Number.isFinite(rawScale) ? rawScale : 1));
      nextWidth = roundPx(resizeState.baseWidth * nextScale);
      nextHeight = roundPx(resizeState.baseHeight * nextScale);
    }
    const nextX = resizeState.baseX + (dir.includes("w") ? resizeState.baseWidth - nextWidth : 0);
    const nextY = resizeState.baseY + (dir.includes("n") ? resizeState.baseHeight - nextHeight : 0);
    const scaleX = nextWidth / resizeState.baseWidth;
    const scaleY = nextHeight / resizeState.baseHeight;
    resizeState.target.style.width = nextWidth.toFixed(1) + "px";
    resizeState.target.style.height = nextHeight.toFixed(1) + "px";
    resizeState.childItems.forEach((item) => {
      if (affectsWidth) item.element.style.width = roundPx(item.baseWidth * scaleX).toFixed(1) + "px";
      if (affectsHeight) item.element.style.height = roundPx(item.baseHeight * scaleY).toFixed(1) + "px";
    });
    resizeState.target.style.setProperty("--ppt-drag-x", nextX.toFixed(1) + "px");
    resizeState.target.style.setProperty("--ppt-drag-y", nextY.toFixed(1) + "px");
    ensureDragTranslate(resizeState.target);
    resizeNestedCharts(resizeState.target);
    updateOverlay();
  };

  // --- Pointer event handlers ---
  const onPointerMove = (event) => {
    if (pendingAnchorState) {
      pendingClientX = event.clientX;
      pendingClientY = event.clientY;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Deferred drag: only activate when pointer moves beyond threshold
    if (dragPendingState) {
      const dx = event.clientX - dragPendingState.startClientX;
      const dy = event.clientY - dragPendingState.startClientY;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      // Threshold exceeded — convert to real drag
      const s = dragPendingState;
      dragPendingState = null;
      ensureDragTranslate(s.target);
      if (rootHost && rootHost.style) rootHost.style.cursor = "move";
      if (cursorHost && cursorHost.style) cursorHost.style.cursor = "move";
      pendingClientX = event.clientX;
      pendingClientY = event.clientY;
      if (s.selector.indexOf('[data-block-id=') !== -1) {
        setSelected(s.target);
        dragState = {
          target: s.target,
          selector: s.selector,
          elementTag: s.elementTag,
          startClientX: s.startClientX,
          startClientY: s.startClientY,
          baseX: s.baseX,
          baseY: s.baseY,
        };
      } else {
        pendingAnchorState = {
          mode: 'drag',
          target: s.target,
          tempSelector: s.selector,
          elementTag: s.elementTag,
          startClientX: s.startClientX,
          startClientY: s.startClientY,
          baseX: s.baseX,
          baseY: s.baseY,
        };
        console.log(LOG_PREFIX + JSON.stringify({ type: "pre-anchor", selector: s.selector, elementTag: s.elementTag }));
      }
      try {
        s.target.setPointerCapture?.(event.pointerId);
      } catch (_error) {}
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (resizeState) {
      pendingClientX = event.clientX;
      pendingClientY = event.clientY;
      if (!frameId) {
        frameId = requestAnimationFrame(applyPendingResize);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (dragState) {
      pendingClientX = event.clientX;
      pendingClientY = event.clientY;
      if (!frameId) {
        frameId = requestAnimationFrame(applyPendingDrag);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = pickTarget(event.target, event.clientX, event.clientY);
    setHover(target);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    const handle = event.target instanceof Element ? event.target.closest("." + HANDLE_CLASS) : null;
    if (handle && selectedElement) {
      const selector = buildStableSelector(selectedElement);
      if (!selector) return;
      const computed = getComputedStyle(selectedElement);
      const rect = selectedElement.getBoundingClientRect();
      const baseX = parsePx(selectedElement.style.getPropertyValue("--ppt-drag-x") || computed.getPropertyValue("--ppt-drag-x"));
      const baseY = parsePx(selectedElement.style.getPropertyValue("--ppt-drag-y") || computed.getPropertyValue("--ppt-drag-y"));
      ensureDragTranslate(selectedElement);
      pendingClientX = event.clientX;
      pendingClientY = event.clientY;
      const elementTag = selectedElement.tagName ? selectedElement.tagName.toLowerCase() : "";
      if (selector.indexOf('[data-block-id=') !== -1) {
        resizeState = {
          target: selectedElement,
          selector,
          elementTag,
          dir: handle.getAttribute("data-dir") || "se",
          startClientX: event.clientX,
          startClientY: event.clientY,
          baseX,
          baseY,
          baseWidth: Math.max(1, rect.width),
          baseHeight: Math.max(1, rect.height),
          childItems: collectResizableChildren(selectedElement),
        };
      } else {
        pendingAnchorState = {
          mode: 'resize',
          target: selectedElement,
          tempSelector: selector,
          elementTag,
          dir: handle.getAttribute("data-dir") || "se",
          startClientX: event.clientX,
          startClientY: event.clientY,
          baseX,
          baseY,
          baseWidth: Math.max(1, rect.width),
          baseHeight: Math.max(1, rect.height),
          childItems: collectResizableChildren(selectedElement),
        };
        console.log(LOG_PREFIX + JSON.stringify({ type: "pre-anchor", selector, elementTag }));
      }
      try {
        handle.setPointerCapture?.(event.pointerId);
      } catch (_error) {}
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = pickTarget(event.target, event.clientX, event.clientY);
    if (!target) return;

    const selector = buildStableSelector(target);
    if (!selector) return;

    // All elements: deferred drag. Record start position.
    // < 3px on pointerup = click (emit selected). >= 3px on pointermove = drag.
    const computed = getComputedStyle(target);
    const baseX = parsePx(target.style.getPropertyValue("--ppt-drag-x") || computed.getPropertyValue("--ppt-drag-x"));
    const baseY = parsePx(target.style.getPropertyValue("--ppt-drag-y") || computed.getPropertyValue("--ppt-drag-y"));
    const elementTag = target.tagName ? target.tagName.toLowerCase() : "";
    dragPendingState = {
      target,
      selector,
      elementTag,
      startClientX: event.clientX,
      startClientY: event.clientY,
      baseX,
      baseY,
    };
    event.preventDefault();
    event.stopPropagation();
  };

  const onPointerUp = (event) => {
    // Click (< 3px movement): select visually, double-click opens editing panel
    if (dragPendingState) {
      const s = dragPendingState;
      dragPendingState = null;
      const now = Date.now();
      // Always select on click (show overlay + handles for resize)
      setSelected(s.target);
      if (
        s.target === lastClickTarget &&
        s.selector === lastClickSelector &&
        now - lastClickTime < DBLCLICK_MS
      ) {
        // Double-click: also emit to host (opens editing panel)
        emitSelected(s.target, s.selector);
        lastClickTime = 0;
        lastClickTarget = null;
        lastClickSelector = null;
      } else {
        // Single click: visual select only, record for double-click detection
        lastClickTime = now;
        lastClickTarget = s.target;
        lastClickSelector = s.selector;
      }
      return;
    }

    if (pendingAnchorState) {
      try {
        event.target?.releasePointerCapture?.(event.pointerId);
      } catch (_error) {}
      pendingAnchorState = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (resizeState) {
      if (frameId) {
        cancelAnimationFrame(frameId);
        applyPendingResize();
      }
      const target = resizeState.target;
      const nextX = parsePx(target.style.getPropertyValue("--ppt-drag-x"));
      const nextY = parsePx(target.style.getPropertyValue("--ppt-drag-y"));
      const nextWidth = parsePx(target.style.width) || resizeState.baseWidth;
      const nextHeight = parsePx(target.style.height) || resizeState.baseHeight;
      const deltaX = nextX - resizeState.baseX;
      const deltaY = nextY - resizeState.baseY;
      const scale = nextWidth / resizeState.baseWidth;
      const affectsWidth = resizeState.dir.includes("w") || resizeState.dir.includes("e");
      const affectsHeight = resizeState.dir.includes("n") || resizeState.dir.includes("s");
      const childUpdates = resizeState.childItems.map((item) => ({
        path: item.path,
        width: affectsWidth ? parsePx(item.element.style.width) || undefined : undefined,
        height: affectsHeight ? parsePx(item.element.style.height) || undefined : undefined,
      })).filter((item) => item.width !== undefined || item.height !== undefined);
      try {
        event.target?.releasePointerCapture?.(event.pointerId);
      } catch (_error) {}
      target.style.willChange = "";
      resizeNestedCharts(target);
      updateOverlay();
      if (
        Math.abs(deltaX) >= 0.5 ||
        Math.abs(deltaY) >= 0.5 ||
        Math.abs(nextWidth - resizeState.baseWidth) >= 0.5 ||
        Math.abs(nextHeight - resizeState.baseHeight) >= 0.5
      ) {
        console.log(LOG_PREFIX + JSON.stringify({
          type: "moved",
          selector: resizeState.selector,
          label: resizeState.selector,
          elementTag: resizeState.elementTag,
          x: Number(nextX.toFixed(1)),
          y: Number(nextY.toFixed(1)),
          deltaX: Number(deltaX.toFixed(1)),
          deltaY: Number(deltaY.toFixed(1)),
          width: Number(nextWidth.toFixed(1)),
          height: Number(nextHeight.toFixed(1)),
          scale: Number(scale.toFixed(3)),
          childUpdates,
        }));
      }
      resizeState = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!dragState) return;
    if (frameId) {
      cancelAnimationFrame(frameId);
      applyPendingDrag();
    }
    const target = dragState.target;
    const nextX = parsePx(target.style.getPropertyValue("--ppt-drag-x"));
    const nextY = parsePx(target.style.getPropertyValue("--ppt-drag-y"));
    const deltaX = nextX - dragState.baseX;
    const deltaY = nextY - dragState.baseY;
    try {
      target.releasePointerCapture?.(event.pointerId);
    } catch (_error) {}
    target.style.willChange = "";
    updateOverlay();
    if (rootHost && rootHost.style) rootHost.style.cursor = "move";
    if (cursorHost && cursorHost.style) cursorHost.style.cursor = "move";

    if (Math.abs(deltaX) >= 0.5 || Math.abs(deltaY) >= 0.5) {
      console.log(LOG_PREFIX + JSON.stringify({
        type: "moved",
        selector: dragState.selector,
        label: dragState.selector,
        elementTag: dragState.elementTag,
        x: Number(nextX.toFixed(1)),
        y: Number(nextY.toFixed(1)),
        deltaX: Number(deltaX.toFixed(1)),
        deltaY: Number(deltaY.toFixed(1)),
      }));
    }
    dragState = null;
    event.preventDefault();
    event.stopPropagation();
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      console.log(LOG_PREFIX + JSON.stringify({ type: "exit" }));
      event.preventDefault();
      event.stopPropagation();
    }
  };

  // --- Live update API (called by host via executeJavaScript) ---
  window.__pptEditModeLiveUpdate = (selector, patch) => {
    try {
      const el = document.querySelector(selector);
      if (!el) return;
      if (typeof patch.text === "string") {
        el.textContent = patch.text;
      }
      if (patch.style) {
        if (patch.style.color) el.style.setProperty("color", patch.style.color, "important");
        if (patch.style.fontSize) el.style.setProperty("font-size", patch.style.fontSize, "important");
        if (patch.style.fontWeight) el.style.setProperty("font-weight", patch.style.fontWeight, "important");
      }
    } catch (_error) {}
  };

  window.__pptEditModeClearSelection = () => {
    if (selectedElement) {
      selectedElement.classList.remove(SELECTED_CLASS);
      selectedElement = null;
    }
    if (overlayResizeObserver) {
      overlayResizeObserver.disconnect();
      overlayResizeObserver = null;
    }
    if (overlayElement) {
      overlayElement.remove();
      overlayElement = null;
    }
  };

  // --- Cleanup ---
  const cleanup = () => {
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("pointercancel", onPointerUp, true);
    document.removeEventListener("keydown", onKeyDown, true);
    clearVisualState();
    if (overlayResizeObserver) {
      overlayResizeObserver.disconnect();
      overlayResizeObserver = null;
    }
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
    if (overlayElement) overlayElement.remove();
    overlayElement = null;
    resizeState = null;
    pendingAnchorState = null;
    dragPendingState = null;
    delete window.__pptResolveEditModeAnchor;
    delete window.__pptEditModeLiveUpdate;
    delete window.__pptEditModeClearSelection;
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    if (cursorHost && cursorHost.style) {
      cursorHost.style.cursor = previousCursor || "";
    }
    if (rootHost && rootHost.style) {
      rootHost.style.cursor = previousRootCursor || "";
    }
    delete window[STATE_KEY];
  };

  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("pointercancel", onPointerUp, true);
  document.addEventListener("keydown", onKeyDown, true);

  window[STATE_KEY] = { active: true, cleanup };
})();
`
}

export function buildEditModeCleanupScript(): string {
  return `
(() => {
  const STATE_KEY = "__pptEditModeState";
  const state = window[STATE_KEY];
  if (state && typeof state.cleanup === "function") {
    state.cleanup();
  } else {
    delete window[STATE_KEY];
  }
})();
`
}
