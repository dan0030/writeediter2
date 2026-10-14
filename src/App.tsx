import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react'
import {
  Archive,
  Bold,
  BookOpen,
  Check,
  Download,
  Eraser,
  Eye,
  FileText,
  Highlighter,
  Image as ImageIcon,
  ImagePlus,
  Italic,
  LayoutTemplate,
  LoaderCircle,
  Palette,
  PenLine,
  Redo2,
  RotateCcw,
  SeparatorHorizontal,
  Share2,
  Strikethrough,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Type,
  Undo2,
  X,
} from 'lucide-react'
import {
  BODY_SIZES,
  DEFAULT_DRAFT,
  FONTS,
  HIGHLIGHT_SWATCHES,
  INLINE_SIZES,
  LINE_HEIGHTS,
  MAX_PRESETS,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PRESET_KEY,
  STORAGE_KEY,
  TEXT_SWATCHES,
  pad2,
  type BodyAlign,
  type ColorPresets,
  type Draft,
  type FontOption,
  type Layout,
} from './constants'
import { ColorField, ColorPanel, FieldLabel, RangeField, UploadButton } from './fields'
import { PageContent, contentStyle, textSizeFor } from './PostcardPage'
import { paginate } from './paginate'
import { idbGet, idbSet, readLocal, writeLocal } from './storage'

type Tab = 'writing' | 'background' | 'layout'
type Snapshot = {
  draft: Draft
  backgroundImage: string
  contentImage: string
  selectedFont: string
  selectedFontSize: string
  formatColor: string
  highlightColor: string
}
type StoredFont = { name: string; value: string; source: string }

const LAYOUTS: { id: Layout; label: string; description: string; icon: ReactElement }[] = [
  { id: 'cover', label: '첫 장', description: '여백을 넉넉히 둔 표지형', icon: <BookOpen size={19} /> },
  { id: 'page', label: '한 페이지', description: '본문에 집중하는 지면형', icon: <FileText size={19} /> },
  { id: 'image', label: '사진과 글', description: '이미지와 문장을 함께', icon: <ImageIcon size={19} /> },
]

const ALIGNS: [BodyAlign, ReactElement, string][] = [
  ['left', <TextAlignStart size={17} key="left" />, '왼쪽'],
  ['center', <TextAlignCenter size={17} key="center" />, '가운데'],
  ['right', <TextAlignEnd size={17} key="right" />, '오른쪽'],
  ['justify', <TextAlignJustify size={17} key="justify" />, '양쪽'],
]

const HISTORY_LIMIT = 150
const COALESCE_MS = 900

const keepSelection = (e: ReactMouseEvent) => e.preventDefault()

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function downloadHref(href: string, filename: string) {
  const a = document.createElement('a')
  a.download = filename
  a.href = href
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

function loadDraft(): Draft {
  const saved = readLocal<Partial<Draft>>(STORAGE_KEY)
  if (!saved) return DEFAULT_DRAFT
  const merged = { ...DEFAULT_DRAFT, ...saved }
  if (!['left', 'center', 'right', 'justify'].includes(merged.bodyAlign)) merged.bodyAlign = 'left'
  if (!['cover', 'page', 'image'].includes(merged.layout)) merged.layout = 'cover'
  return merged
}

function loadPresets(): ColorPresets {
  const saved = readLocal<Partial<ColorPresets>>(PRESET_KEY)
  return {
    text: Array.isArray(saved?.text) ? saved.text.slice(0, MAX_PRESETS) : [],
    highlight: Array.isArray(saved?.highlight) ? saved.highlight.slice(0, MAX_PRESETS) : [],
  }
}

export default function App() {
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [tab, setTab] = useState<Tab>('writing')
  const [backgroundImage, setBackgroundImage] = useState('')
  const [contentImage, setContentImage] = useState('')
  const [customFonts, setCustomFonts] = useState<FontOption[]>([])
  const [selectedFont, setSelectedFont] = useState(FONTS[0].value)
  const [selectedFontSize, setSelectedFontSize] = useState('30')
  const [formatColor, setFormatColor] = useState('#272621')
  const [highlightColor, setHighlightColor] = useState('#fff0a8')
  const [editorVersion, setEditorVersion] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const [toast, setToast] = useState('')
  const [pages, setPages] = useState<string[]>(() => [draft.content])
  const [scale, setScale] = useState(0.45)
  const [colorPanel, setColorPanel] = useState<null | 'text' | 'highlight'>(null)
  const [presets, setPresets] = useState<ColorPresets>(loadPresets)
  const [formatState, setFormatState] = useState({ bold: false, italic: false, strike: false })
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [exportMenu, setExportMenu] = useState(false)
  const [fontsVersion, setFontsVersion] = useState(0)
  const [assetsReady, setAssetsReady] = useState(false)
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 })

  const editorRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const probeFirstRef = useRef<HTMLDivElement | null>(null)
  const probeRestRef = useRef<HTMLDivElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)
  const savedRange = useRef<Range | null>(null)
  const draftRef = useRef<Draft>(draft)
  const backgroundRef = useRef('')
  const contentImageRef = useRef('')
  const fontRef = useRef(FONTS[0].value)
  const fontSizeRef = useRef('30')
  const formatColorRef = useRef('#272621')
  const highlightRef = useRef('#fff0a8')
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const lastPush = useRef<{ key: string | null; time: number }>({ key: null, time: 0 })
  const contentRef = useRef(draft.content)

  const fontOptions = useMemo(() => [...FONTS, ...customFonts], [customFonts])
  const canShareFiles = useMemo(() => {
    try {
      const file = new File([new Uint8Array(1)], 'test.png', { type: 'image/png' })
      return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] })
    } catch {
      return false
    }
  }, [])

  const notify = useCallback((message: string) => setToast(message), [])

  // ── 불러오기 ─────────────────────────────────────────
  // 글과 설정은 localStorage에서 바로 읽고, 이미지·폰트는 IndexedDB에서 비동기로 불러옵니다.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [bg, img, fonts] = await Promise.all([
          idbGet<string>('backgroundImage'),
          idbGet<string>('contentImage'),
          idbGet<StoredFont[]>('customFonts'),
        ])
        if (!active) return
        if (bg) {
          backgroundRef.current = bg
          setBackgroundImage(bg)
        }
        if (img) {
          contentImageRef.current = img
          setContentImage(img)
        }
        if (fonts?.length) {
          const restored: FontOption[] = []
          for (const font of fonts) {
            try {
              const face = new FontFace(font.value.replaceAll('"', ''), `url(${font.source})`)
              await face.load()
              document.fonts.add(face)
              restored.push({ ...font, custom: true })
            } catch {
              /* 손상된 폰트는 건너뜁니다 */
            }
          }
          if (active) setCustomFonts(restored)
        }
      } catch {
        /* IndexedDB를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 이번 편집에서만 유지됩니다 */
      } finally {
        if (active) setAssetsReady(true)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // ── 자동 저장 ─────────────────────────────────────────
  useEffect(() => {
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      if (writeLocal(STORAGE_KEY, draft)) setSaveState('saved')
      else notify('브라우저 자동 저장 공간이 부족해요.')
    }, 450)
    return () => window.clearTimeout(timer)
  }, [draft, notify])

  useEffect(() => {
    if (!assetsReady) return
    idbSet('backgroundImage', backgroundImage).catch(() => undefined)
  }, [assetsReady, backgroundImage])

  useEffect(() => {
    if (!assetsReady) return
    idbSet('contentImage', contentImage).catch(() => undefined)
  }, [assetsReady, contentImage])

  useEffect(() => {
    if (!assetsReady) return
    const stored: StoredFont[] = customFonts.map((f) => ({ name: f.name, value: f.value, source: f.source ?? '' }))
    idbSet('customFonts', stored).catch(() => notify('폰트를 브라우저에 보관하지 못했어요. 이번 편집에서만 사용돼요.'))
  }, [assetsReady, customFonts, notify])

  useEffect(() => {
    writeLocal(PRESET_KEY, presets)
  }, [presets])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  // 웹폰트가 늦게 로드되면 줄바꿈 위치가 바뀌므로 페이지를 다시 나눕니다.
  useEffect(() => {
    const bump = () => setFontsVersion((v) => v + 1)
    document.fonts?.ready.then(bump).catch(() => undefined)
    document.fonts?.addEventListener?.('loadingdone', bump)
    return () => document.fonts?.removeEventListener?.('loadingdone', bump)
  }, [])

  // ── 미리보기 배율 ─────────────────────────────────────
  const observeFrame = useCallback((el: HTMLDivElement | null) => {
    frameRef.current = el
  }, [])
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const update = () => {
      if (el.clientWidth > 0) setScale(el.clientWidth / PAGE_WIDTH)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [mobileView])

  // ── 페이지 나누기 ─────────────────────────────────────
  useLayoutEffect(() => {
    const measure = measureRef.current
    const firstText = probeFirstRef.current?.querySelector<HTMLElement>('[data-probe="text"]')
    const restText = probeRestRef.current?.querySelector<HTMLElement>('[data-probe="text"]')
    if (!measure || !firstText || !restText) return
    const first = { width: firstText.clientWidth, height: firstText.clientHeight }
    const rest = { width: restText.clientWidth, height: restText.clientHeight }
    const minLine = textSizeFor(draft) * draft.lineHeight
    const next = paginate(draft.content, measure, first, rest, minLine)
    setPages((prev) => (prev.length === next.length && prev.every((p, i) => p === next[i]) ? prev : next))
  }, [draft, fontsVersion, customFonts])

  // ── 실행 취소 / 다시 실행 ─────────────────────────────
  const snapshot = useCallback(
    (): Snapshot => ({
      draft: { ...draftRef.current },
      backgroundImage: backgroundRef.current,
      contentImage: contentImageRef.current,
      selectedFont: fontRef.current,
      selectedFontSize: fontSizeRef.current,
      formatColor: formatColorRef.current,
      highlightColor: highlightRef.current,
    }),
    [],
  )

  const syncHistorySize = () => setHistorySize({ undo: undoStack.current.length, redo: redoStack.current.length })

  const pushHistory = useCallback(
    (key: string | null = null) => {
      const now = Date.now()
      // 같은 항목을 연달아 바꾸는 동안(타이핑, 슬라이더 드래그)은 하나의 변화로 묶습니다.
      if (key && lastPush.current.key === key && now - lastPush.current.time < COALESCE_MS) {
        lastPush.current.time = now
        return
      }
      lastPush.current = { key, time: now }
      undoStack.current.push(snapshot())
      if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift()
      redoStack.current = []
      syncHistorySize()
    },
    [snapshot],
  )

  const update = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) => {
      if (draftRef.current[key] === value) return
      pushHistory(key)
      const next = { ...draftRef.current, [key]: value }
      draftRef.current = next
      setDraft(next)
    },
    [pushHistory],
  )

  const restore = useCallback((s: Snapshot) => {
    draftRef.current = s.draft
    backgroundRef.current = s.backgroundImage
    contentImageRef.current = s.contentImage
    fontRef.current = s.selectedFont
    fontSizeRef.current = s.selectedFontSize
    formatColorRef.current = s.formatColor
    highlightRef.current = s.highlightColor
    contentRef.current = s.draft.content
    savedRange.current = null
    lastPush.current = { key: null, time: 0 }
    setDraft(s.draft)
    setBackgroundImage(s.backgroundImage)
    setContentImage(s.contentImage)
    setSelectedFont(s.selectedFont)
    setSelectedFontSize(s.selectedFontSize)
    setFormatColor(s.formatColor)
    setHighlightColor(s.highlightColor)
    setEditorVersion((v) => v + 1)
  }, [])

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) {
      notify('되돌릴 이전 변화가 없어요.')
      return
    }
    redoStack.current.push(snapshot())
    restore(prev)
    syncHistorySize()
  }, [notify, restore, snapshot])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) {
      notify('다시 적용할 변화가 없어요.')
      return
    }
    undoStack.current.push(snapshot())
    restore(next)
    syncHistorySize()
  }, [notify, restore, snapshot])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [redo, undo])

  // ── 본문 편집기 ───────────────────────────────────────
  const editorCallbackRef = useCallback((el: HTMLDivElement | null) => {
    editorRef.current = el
    if (el) el.innerHTML = contentRef.current
  }, [])

  // 모바일에서도 선택 영역을 잃지 않도록 selectionchange로 계속 기억해 둡니다.
  useEffect(() => {
    const onSelection = () => {
      const editor = editorRef.current
      const selection = window.getSelection()
      if (!editor || !selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      if (!editor.contains(range.commonAncestorContainer)) return
      savedRange.current = range.cloneRange()
      try {
        setFormatState({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          strike: document.queryCommandState('strikeThrough'),
        })
      } catch {
        /* 일부 브라우저는 queryCommandState를 지원하지 않습니다 */
      }
    }
    document.addEventListener('selectionchange', onSelection)
    return () => document.removeEventListener('selectionchange', onSelection)
  }, [])

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection) return
    const range = savedRange.current
    selection.removeAllRanges()
    if (range && editor.contains(range.startContainer) && editor.contains(range.endContainer)) {
      selection.addRange(range)
    } else {
      const end = document.createRange()
      end.selectNodeContents(editor)
      end.collapse(false)
      selection.addRange(end)
    }
  }, [])

  const commitEditor = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const html = editor.innerHTML === '<br>' ? '' : editor.innerHTML
    contentRef.current = html
    update('content', html)
  }, [update])

  const exec = useCallback(
    (command: string, value?: string) => {
      const editor = editorRef.current
      if (!editor) return
      editor.focus({ preventScroll: true })
      restoreSelection()
      document.execCommand(command, false, value)
      commitEditor()
    },
    [commitEditor, restoreSelection],
  )

  const selectionIsCollapsed = () => {
    const range = savedRange.current
    return !range || range.collapsed || !editorRef.current?.contains(range.startContainer)
  }

  const applyFontSize = (size: string) => {
    fontSizeRef.current = size
    setSelectedFontSize(size)
    const editor = editorRef.current
    if (!editor) return
    if (selectionIsCollapsed()) {
      notify('크기를 바꿀 글자를 먼저 드래그해 주세요.')
      return
    }
    editor.focus({ preventScroll: true })
    restoreSelection()
    document.execCommand('fontSize', false, '7')
    const spans: HTMLSpanElement[] = []
    editor.querySelectorAll('font[size="7"]').forEach((font) => {
      const span = document.createElement('span')
      span.style.fontSize = `${size}px`
      span.innerHTML = font.innerHTML
      // 안쪽에 남아 있던 이전 글자 크기가 새 크기를 덮어쓰지 않도록 지웁니다.
      span.querySelectorAll<HTMLElement>('[style]').forEach((child) => child.style.removeProperty('font-size'))
      span.querySelectorAll('font[size]').forEach((child) => child.removeAttribute('size'))
      font.replaceWith(span)
      spans.push(span)
    })
    if (spans.length) {
      const range = document.createRange()
      range.setStartBefore(spans[0])
      range.setEndAfter(spans[spans.length - 1])
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      savedRange.current = range.cloneRange()
    }
    commitEditor()
  }

  const applyColor = (kind: 'text' | 'highlight', color: string) => {
    if (kind === 'text') {
      formatColorRef.current = color
      setFormatColor(color)
      exec('foreColor', color)
    } else {
      if (color !== 'transparent') {
        highlightRef.current = color
        setHighlightColor(color)
      }
      exec('hiliteColor', color)
    }
  }

  const savePreset = (kind: 'text' | 'highlight', color: string) => {
    const list = presets[kind]
    if (list.includes(color)) {
      notify('이미 저장된 색이에요.')
      return
    }
    if (list.length >= MAX_PRESETS) {
      notify(`프리셋은 ${MAX_PRESETS}개까지 저장할 수 있어요.`)
      return
    }
    setPresets({ ...presets, [kind]: [...list, color] })
    notify(`${color.toUpperCase()}을(를) 프리셋에 저장했어요.`)
  }

  const removePreset = (kind: 'text' | 'highlight', color: string) => {
    setPresets({ ...presets, [kind]: presets[kind].filter((c) => c !== color) })
  }

  const insertPageBreak = () => {
    exec('insertHTML', '<hr><br>')
    notify('여기서부터 다음 페이지로 넘어가요.')
  }

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    commitEditor()
  }

  // 다른 곳의 HTML이나 파일이 그대로 끌어다 놓이지 않도록 일반 텍스트로만 받습니다.
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.dataTransfer.getData('text/plain')
    if (!text) return
    const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
    const range = doc.caretRangeFromPoint?.(e.clientX, e.clientY)
    if (range) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
    document.execCommand('insertText', false, text)
    commitEditor()
  }

  const onEditorKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      insertPageBreak()
    }
  }

  // ── 파일 불러오기 ─────────────────────────────────────
  const readImage = (e: ChangeEvent<HTMLInputElement>, apply: (dataUrl: string) => void) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 12 * 1024 * 1024) {
      notify('이미지는 12MB 이하로 올려주세요.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      apply(String(reader.result ?? ''))
      notify('이미지를 불러왔어요.')
    }
    reader.onerror = () => notify('이미지를 읽지 못했어요.')
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const setBackground = (dataUrl: string) => {
    pushHistory()
    backgroundRef.current = dataUrl
    setBackgroundImage(dataUrl)
  }

  const setPhoto = (dataUrl: string) => {
    pushHistory()
    contentImageRef.current = dataUrl
    setContentImage(dataUrl)
  }

  const readFont = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      notify('폰트 파일은 8MB 이하로 올려주세요.')
      e.target.value = ''
      return
    }
    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣 -]/g, '').trim() || '사용자 폰트'
      const family = `Custom-${name.replace(/\s+/g, '-')}-${Date.now()}`
      const face = new FontFace(family, `url(${source})`)
      await face.load()
      document.fonts.add(face)
      const option: FontOption = { name, value: `"${family}"`, custom: true, source }
      setCustomFonts((list) => [...list, option])
      fontRef.current = option.value
      setSelectedFont(option.value)
      notify(`‘${name}’ 폰트를 추가했어요.`)
    } catch {
      notify('이 폰트 파일을 불러오지 못했어요.')
    } finally {
      e.target.value = ''
    }
  }

  const removeFont = (font: FontOption) => {
    setCustomFonts((list) => list.filter((f) => f.value !== font.value))
    if (draftRef.current.globalFont === font.value) update('globalFont', FONTS[0].value)
    if (fontRef.current === font.value) {
      fontRef.current = FONTS[0].value
      setSelectedFont(FONTS[0].value)
    }
    notify(`‘${font.name}’ 폰트를 목록에서 뺐어요.`)
  }

  const reset = () => {
    if (!window.confirm('현재 글과 설정을 지우고 처음 상태로 돌아갈까요?')) return
    pushHistory()
    draftRef.current = DEFAULT_DRAFT
    backgroundRef.current = ''
    contentImageRef.current = ''
    fontRef.current = FONTS[0].value
    fontSizeRef.current = '30'
    contentRef.current = DEFAULT_DRAFT.content
    savedRange.current = null
    setDraft(DEFAULT_DRAFT)
    setBackgroundImage('')
    setContentImage('')
    setSelectedFont(FONTS[0].value)
    setSelectedFontSize('30')
    setEditorVersion((v) => v + 1)
    setColorPanel(null)
    notify('새 엽서를 준비했어요.')
  }

  // ── 저장 ─────────────────────────────────────────────
  const fileBase = () => draft.title.trim().replace(/[\\/:*?"<>|]+/g, '-') || '문장-엽서'
  const fileName = (index: number) => (pages.length > 1 ? `${fileBase()}-${pad2(index + 1)}.png` : `${fileBase()}.png`)

  const renderPages = async (indices: number[]) => {
    await document.fonts.ready
    const { toPng } = await import('html-to-image')
    const fontEmbedCSS = customFonts
      .filter((f) => f.custom && f.source)
      .map((f) => `@font-face{font-family:${f.value};src:url("${f.source}");font-style:normal;font-weight:100 900;}`)
      .join('\n')
    const results: { name: string; dataUrl: string }[] = []
    for (const index of indices) {
      const node = pageRefs.current[index]
      if (!node) continue
      const dataUrl = await toPng(node, {
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        canvasWidth: PAGE_WIDTH * 2,
        canvasHeight: PAGE_HEIGHT * 2,
        pixelRatio: 1,
        cacheBust: true,
        fontEmbedCSS,
        backgroundColor: draft.backgroundColor,
        style: { transform: 'none', transformOrigin: 'top left' },
      })
      results.push({ name: fileName(index), dataUrl })
    }
    return results
  }

  const runExport = async (mode: 'png' | 'zip' | 'share', indices = pages.map((_, i) => i)) => {
    if (exporting) return
    setExportMenu(false)
    setExporting(true)
    try {
      const images = await renderPages(indices)
      if (!images.length) throw new Error('empty')
      if (mode === 'png') {
        for (const [i, image] of images.entries()) {
          if (i > 0) await wait(350)
          downloadHref(image.dataUrl, image.name)
        }
        notify(images.length > 1 ? `${images.length}장의 PNG를 저장했어요.` : '2400 × 3200px PNG로 저장했어요.')
      } else if (mode === 'zip') {
        const { zipSync } = await import('fflate')
        const entries: Record<string, Uint8Array> = {}
        images.forEach((image) => {
          entries[image.name] = dataUrlToBytes(image.dataUrl)
        })
        const zipped = zipSync(entries, { level: 0 })
        const url = URL.createObjectURL(new Blob([zipped as BlobPart], { type: 'application/zip' }))
        downloadHref(url, `${fileBase()}.zip`)
        window.setTimeout(() => URL.revokeObjectURL(url), 4000)
        notify(`${images.length}장을 ZIP 파일 하나로 저장했어요.`)
      } else {
        const files = images.map((image) => new File([dataUrlToBytes(image.dataUrl) as BlobPart], image.name, { type: 'image/png' }))
        try {
          await navigator.share({ files, title: draft.title || '문장 엽서' })
        } catch (error) {
          if ((error as Error).name !== 'AbortError') throw error
        }
      }
    } catch {
      notify('이미지 저장에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setExporting(false)
    }
  }

  const onExportClick = () => {
    if (exporting) return
    if (pages.length === 1 && !canShareFiles) runExport('png')
    else setExportMenu((open) => !open)
  }

  // ── 표시 ─────────────────────────────────────────────
  const backgroundStyle = useMemo(
    () =>
      draft.backgroundKind === 'gradient'
        ? { background: `linear-gradient(${draft.gradientAngle}deg, ${draft.gradientFrom}, ${draft.gradientTo})` }
        : { background: draft.backgroundColor },
    [draft.backgroundColor, draft.backgroundKind, draft.gradientAngle, draft.gradientFrom, draft.gradientTo],
  )
  const showBgImage = draft.backgroundKind === 'image' && !!backgroundImage
  const layoutInfo = LAYOUTS.find((l) => l.id === draft.layout)
  const pageCount = pages.length

  const fontSelect = (value: string, onChange: (v: string) => void, label: string, className?: string) => (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {fontOptions.map((f) => (
        <option key={f.value} value={f.value}>
          {f.custom ? `내 폰트 · ${f.name}` : f.name}
        </option>
      ))}
    </select>
  )

  const formatButton = (title: string, icon: ReactElement, onClick: () => void, active = false) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={active ? 'active' : ''}
      onMouseDown={keepSelection}
      onClick={onClick}
    >
      {icon}
    </button>
  )

  const backgroundLayers = showBgImage ? (
    <>
      <img
        className="background-image"
        src={backgroundImage}
        alt=""
        style={{ filter: `blur(${draft.backgroundBlur}px) saturate(${draft.backgroundSaturation}%)` }}
      />
      <div className="background-dim" style={{ background: `rgba(0, 0, 0, ${draft.backgroundDim / 100})` }} />
    </>
  ) : null

  return (
    <main className={`app-shell view-${mobileView}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">문</span>
          <div>
            <p>문장 엽서</p>
            <span>SENTENCE POSTCARD STUDIO</span>
          </div>
        </div>
        <div className="top-actions">
          <span className={`save-state ${saveState}`}>
            {saveState === 'saved' ? <Check size={14} /> : null}
            {saveState === 'saved' ? '자동 저장됨' : '저장 중'}
          </span>
          <div className="history-buttons">
            <button type="button" className="ghost-button" onClick={undo} disabled={!historySize.undo} title="되돌리기 (Ctrl+Z)" aria-label="되돌리기">
              <Undo2 size={16} />
            </button>
            <button type="button" className="ghost-button" onClick={redo} disabled={!historySize.redo} title="다시 실행 (Ctrl+Shift+Z)" aria-label="다시 실행">
              <Redo2 size={16} />
            </button>
          </div>
          <button className="reset-button" type="button" onClick={reset} title="처음부터">
            <RotateCcw size={16} />
            <span>처음부터</span>
          </button>
          <button className="export-button" type="button" onClick={onExportClick} disabled={exporting}>
            {exporting ? <LoaderCircle className="spinner" size={18} /> : <Download size={18} />}
            {exporting ? '이미지 만드는 중' : pageCount > 1 ? `PNG 저장 · ${pageCount}장` : 'PNG 저장'}
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="editor-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">POSTCARD EDITOR</span>
              <h1>
                한 장에 담을 문장을
                <br />
                천천히 다듬어 보세요.
              </h1>
            </div>
            <span className="resolution-badge">2400 × 3200 px</span>
          </div>

          <div className="layout-picker" aria-label="레이아웃 선택">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={draft.layout === l.id ? 'active' : ''}
                onClick={() => {
                  if (editorRef.current) contentRef.current = editorRef.current.innerHTML
                  update('layout', l.id)
                  if (l.id === 'image') setTab('layout')
                }}
              >
                <span>{l.icon}</span>
                <strong>{l.label}</strong>
                <small>{l.description}</small>
              </button>
            ))}
          </div>

          <nav className="panel-tabs" aria-label="편집 항목">
            <button type="button" className={tab === 'writing' ? 'active' : ''} onClick={() => setTab('writing')}>
              <Type size={17} />글 편집
            </button>
            <button type="button" className={tab === 'background' ? 'active' : ''} onClick={() => setTab('background')}>
              <Palette size={17} />배경
            </button>
            <button type="button" className={tab === 'layout' ? 'active' : ''} onClick={() => setTab('layout')}>
              <LayoutTemplate size={17} />지면
            </button>
          </nav>

          <div className="panel-body">
            {tab === 'writing' ? (
              <div className="control-section">
                <div className="two-column">
                  <label>
                    <FieldLabel>제목</FieldLabel>
                    <input className="text-input" value={draft.title} onChange={(e) => update('title', e.target.value)} placeholder="엽서 제목" />
                  </label>
                  <label>
                    <FieldLabel>제목 위 문구</FieldLabel>
                    <input className="text-input" value={draft.kicker} onChange={(e) => update('kicker', e.target.value)} placeholder="SHORT NOTE" />
                  </label>
                </div>

                <div>
                  <FieldLabel hint="제목·본문·머리글·꼬리글에 기본 적용돼요">전체 지면 글꼴</FieldLabel>
                  {fontSelect(draft.globalFont, (v) => update('globalFont', v), '전체 지면 글꼴', 'wide-select')}
                </div>

                <div className="copy-fields">
                  <label>
                    <FieldLabel>머리글 문구</FieldLabel>
                    <input className="text-input" value={draft.headerText} onChange={(e) => update('headerText', e.target.value)} placeholder="01" />
                  </label>
                  <label>
                    <FieldLabel>꼬리글 왼쪽</FieldLabel>
                    <input className="text-input" value={draft.footerLeft} onChange={(e) => update('footerLeft', e.target.value)} placeholder="작가명 또는 짧은 문구" />
                  </label>
                  <label>
                    <FieldLabel>꼬리글 오른쪽</FieldLabel>
                    <input
                      className="text-input"
                      value={draft.autoPageNumber ? '쪽 번호 자동' : draft.footerRight}
                      disabled={draft.autoPageNumber}
                      onChange={(e) => update('footerRight', e.target.value)}
                      placeholder="01"
                    />
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={draft.autoPageNumber} onChange={(e) => update('autoPageNumber', e.target.checked)} />
                    <span>꼬리글 오른쪽에 쪽 번호(01, 02…)를 자동으로 넣기</span>
                  </label>
                </div>

                <div>
                  <FieldLabel hint="선택한 글자에만 적용돼요">본문 서식</FieldLabel>
                  <div className="format-toolbar">
                    {fontSelect(
                      selectedFont,
                      (v) => {
                        fontRef.current = v
                        setSelectedFont(v)
                        exec('fontName', v.replaceAll('"', ''))
                      },
                      '글꼴',
                    )}
                    <select value={selectedFontSize} onChange={(e) => applyFontSize(e.target.value)} aria-label="글자 크기">
                      {INLINE_SIZES.map((s) => (
                        <option key={s} value={String(s)}>
                          {s}px
                        </option>
                      ))}
                    </select>
                    <div className="format-actions">
                      {formatButton('굵게', <Bold size={17} />, () => exec('bold'), formatState.bold)}
                      {formatButton('기울임', <Italic size={17} />, () => exec('italic'), formatState.italic)}
                      {formatButton('취소선', <Strikethrough size={17} />, () => exec('strikeThrough'), formatState.strike)}
                      <button
                        type="button"
                        className={`format-color${colorPanel === 'text' ? ' active' : ''}`}
                        title="글자 색"
                        aria-label="글자 색"
                        aria-expanded={colorPanel === 'text'}
                        onMouseDown={keepSelection}
                        onClick={() => setColorPanel((p) => (p === 'text' ? null : 'text'))}
                      >
                        <Type size={16} />
                        <i style={{ background: formatColor }} />
                      </button>
                      <button
                        type="button"
                        className={`format-color${colorPanel === 'highlight' ? ' active' : ''}`}
                        title="형광펜"
                        aria-label="형광펜"
                        aria-expanded={colorPanel === 'highlight'}
                        onMouseDown={keepSelection}
                        onClick={() => setColorPanel((p) => (p === 'highlight' ? null : 'highlight'))}
                      >
                        <Highlighter size={16} />
                        <i style={{ background: highlightColor }} />
                      </button>
                      {formatButton('서식 지우기', <Eraser size={17} />, () => exec('removeFormat'))}
                      {formatButton('페이지 나누기 (Ctrl+Enter)', <SeparatorHorizontal size={17} />, insertPageBreak)}
                    </div>
                  </div>
                  {colorPanel ? (
                    <ColorPanel
                      kind={colorPanel}
                      value={colorPanel === 'text' ? formatColor : highlightColor}
                      swatches={colorPanel === 'text' ? TEXT_SWATCHES : HIGHLIGHT_SWATCHES}
                      presets={presets[colorPanel]}
                      onApply={(c) => applyColor(colorPanel, c)}
                      onSavePreset={(c) => savePreset(colorPanel, c)}
                      onRemovePreset={(c) => removePreset(colorPanel, c)}
                      onClose={() => setColorPanel(null)}
                    />
                  ) : null}
                </div>

                <div>
                  <FieldLabel hint={pageCount > 1 ? `지금 ${pageCount}페이지 · 넘치면 다음 장으로 이어져요` : '먼저 글자를 드래그한 뒤 서식을 선택하세요'}>본문</FieldLabel>
                  <div
                    key={editorVersion}
                    ref={editorCallbackRef}
                    className={`rich-editor${draft.layout === 'page' ? ' page-editor' : ''}`}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={commitEditor}
                    onPaste={onPaste}
                    onDrop={onDrop}
                    onKeyDown={onEditorKeyDown}
                    style={{
                      fontFamily: draft.globalFont,
                      color: draft.textColor,
                      lineHeight: draft.lineHeight,
                      textAlign: draft.bodyAlign,
                    }}
                    role="textbox"
                    aria-multiline="true"
                    aria-label="엽서 본문"
                  />
                </div>

                <div className="inline-controls">
                  <div className="align-control">
                    <FieldLabel>본문 정렬</FieldLabel>
                    <div className="segmented icon-segmented">
                      {ALIGNS.map(([value, icon, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={draft.bodyAlign === value ? 'active' : ''}
                          onClick={() => update('bodyAlign', value)}
                          title={`${label} 정렬`}
                          aria-label={`${label} 정렬`}
                          aria-pressed={draft.bodyAlign === value}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="line-height-control">
                    <FieldLabel>줄 간격</FieldLabel>
                    <select value={draft.lineHeight} onChange={(e) => update('lineHeight', Number(e.target.value))}>
                      {LINE_HEIGHTS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="line-height-control">
                    <FieldLabel>본문 크기</FieldLabel>
                    <select value={draft.bodySize} onChange={(e) => update('bodySize', Number(e.target.value))}>
                      {BODY_SIZES.map((v) => (
                        <option key={v} value={v}>
                          {v}px
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="font-upload-row">
                  <div>
                    <strong>내 폰트 추가</strong>
                    <p>TTF, OTF, WOFF · 이 브라우저에 보관돼요</p>
                    {customFonts.length ? (
                      <div className="font-chips">
                        {customFonts.map((f) => (
                          <span key={f.value} className="font-chip" style={{ fontFamily: f.value }}>
                            {f.name}
                            <button type="button" aria-label={`${f.name} 폰트 삭제`} onClick={() => removeFont(f)}>
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <UploadButton label="폰트 선택" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" onChange={readFont} compact />
                </div>
              </div>
            ) : null}

            {tab === 'background' ? (
              <div className="control-section">
                <div>
                  <FieldLabel>배경 방식</FieldLabel>
                  <div className="background-tabs segmented">
                    {(
                      [
                        ['solid', '단색'],
                        ['gradient', '그라데이션'],
                        ['image', '이미지'],
                      ] as const
                    ).map(([value, label]) => (
                      <button key={value} type="button" className={draft.backgroundKind === value ? 'active' : ''} onClick={() => update('backgroundKind', value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {draft.backgroundKind === 'solid' ? (
                  <ColorField label="배경 색" value={draft.backgroundColor} onChange={(v) => update('backgroundColor', v)} />
                ) : null}
                {draft.backgroundKind === 'gradient' ? (
                  <>
                    <div className="two-column">
                      <ColorField label="시작 색" value={draft.gradientFrom} onChange={(v) => update('gradientFrom', v)} />
                      <ColorField label="끝 색" value={draft.gradientTo} onChange={(v) => update('gradientTo', v)} />
                    </div>
                    <RangeField label="그라데이션 각도" value={draft.gradientAngle} min={0} max={360} suffix="°" onChange={(v) => update('gradientAngle', v)} />
                  </>
                ) : null}
                {draft.backgroundKind === 'image' ? (
                  <>
                    <div className="image-upload-card">
                      {backgroundImage ? (
                        <img src={backgroundImage} alt="" />
                      ) : (
                        <span>
                          <ImagePlus size={28} />
                          배경 이미지를 올려주세요
                        </span>
                      )}
                      <UploadButton label={backgroundImage ? '이미지 바꾸기' : '이미지 선택'} accept="image/*" onChange={(e) => readImage(e, setBackground)} compact />
                    </div>
                    <RangeField label="블러" value={draft.backgroundBlur} min={0} max={24} suffix="px" onChange={(v) => update('backgroundBlur', v)} />
                    <RangeField label="채도" value={draft.backgroundSaturation} min={0} max={180} suffix="%" onChange={(v) => update('backgroundSaturation', v)} />
                    <RangeField label="어둡게" value={draft.backgroundDim} min={0} max={70} suffix="%" onChange={(v) => update('backgroundDim', v)} />
                  </>
                ) : null}
                <div className="divider" />
                <ColorField label="기본 글자 색" value={draft.textColor} onChange={(v) => update('textColor', v)} />
                <p className="quiet-note">본문에서 따로 지정한 글자 색은 그대로 유지됩니다. 컬러코드를 직접 입력할 수도 있어요.</p>
              </div>
            ) : null}

            {tab === 'layout' ? (
              <div className="control-section">
                <label>
                  <FieldLabel hint="모든 페이지 상단에 표시돼요">상단 아이콘</FieldLabel>
                  <input className="text-input icon-input" value={draft.icon} maxLength={8} onChange={(e) => update('icon', e.target.value)} placeholder="✦" />
                </label>
                <div className="layout-note">
                  <span>{layoutInfo?.icon}</span>
                  <div>
                    <strong>{layoutInfo?.label}</strong>
                    <p>
                      {draft.layout === 'cover'
                        ? '큰 여백 뒤에 글이 놓여, 책의 첫 장처럼 차분하게 보입니다.'
                        : draft.layout === 'page'
                          ? '한 페이지를 가득 쓰는 구성으로 긴 조각글에 잘 어울립니다.'
                          : '사진과 글을 한 장 안에서 함께 보여주는 구성입니다.'}{' '}
                      글이 넘치면 같은 분위기의 다음 페이지가 자동으로 이어집니다.
                    </p>
                  </div>
                </div>
                {draft.layout === 'image' ? (
                  <>
                    <div className="image-upload-card content-image-upload">
                      {contentImage ? (
                        <img
                          src={contentImage}
                          alt=""
                          style={{
                            objectPosition: `${draft.imageX}% ${draft.imageY}%`,
                            objectFit: draft.imageFit,
                            transform: `scale(${draft.imageScale})`,
                          }}
                        />
                      ) : (
                        <span>
                          <ImagePlus size={28} />
                          글과 함께 넣을 이미지
                        </span>
                      )}
                      <UploadButton label={contentImage ? '이미지 바꾸기' : '이미지 선택'} accept="image/*" onChange={(e) => readImage(e, setPhoto)} compact />
                    </div>
                    <RangeField label="이미지 높이" value={draft.imageHeight} min={200} max={1100} step={10} suffix="px" onChange={(v) => update('imageHeight', v)} />
                    <div>
                      <FieldLabel>이미지 맞춤</FieldLabel>
                      <div className="segmented">
                        {(
                          [
                            ['cover', '꽉 채우기'],
                            ['contain', '전체 보이기'],
                          ] as const
                        ).map(([value, label]) => (
                          <button key={value} type="button" className={draft.imageFit === value ? 'active' : ''} onClick={() => update('imageFit', value)}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <RangeField label="이미지 확대" value={draft.imageScale} min={1} max={2} step={0.05} onChange={(v) => update('imageScale', v)} />
                    <RangeField label="가로 위치" value={draft.imageX} min={0} max={100} suffix="%" onChange={(v) => update('imageX', v)} />
                    <RangeField label="세로 위치" value={draft.imageY} min={0} max={100} suffix="%" onChange={(v) => update('imageY', v)} />
                    {contentImage ? (
                      <button type="button" className="text-button" onClick={() => setPhoto('')}>
                        이미지 빼기
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className="empty-image-tip">
                    <ImagePlus size={20} />
                    이미지를 넣으려면 위에서 ‘사진과 글’ 레이아웃을 선택하세요.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </aside>

        <section className="preview-section">
          <div className="preview-heading">
            <div>
              <span className="eyebrow">LIVE PREVIEW</span>
              <h2>완성될 이미지</h2>
            </div>
            <div className="preview-meta">
              <span>3 : 4</span>
              <span>세로형 엽서</span>
              <span className={pageCount > 1 ? 'strong' : ''}>{pageCount}쪽</span>
            </div>
          </div>
          <div className="preview-stage">
            <div className="preview-pages">
              {pages.map((html, index) => (
                <figure className="preview-page" key={index}>
                  <div className="postcard-frame" ref={index === 0 ? observeFrame : undefined}>
                    <div
                      ref={(el) => {
                        pageRefs.current[index] = el
                      }}
                      className={`postcard layout-${draft.layout}${index > 0 ? ' is-continued' : ''}`}
                      style={{ ...backgroundStyle, transform: `scale(${scale})` }}
                    >
                      {backgroundLayers}
                      <div className="paper-texture" />
                      <PageContent draft={draft} kind={index === 0 ? 'first' : 'cont'} html={html} pageNumber={index + 1} contentImage={contentImage} />
                    </div>
                  </div>
                  {pageCount > 1 ? (
                    <figcaption>
                      <span>
                        {pad2(index + 1)} / {pad2(pageCount)}
                      </span>
                      <button type="button" onClick={() => runExport('png', [index])} disabled={exporting}>
                        <Download size={13} />이 페이지만 저장
                      </button>
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </div>
          <div className="preview-tip">
            <span>i</span>
            {pageCount > 1
              ? `글이 길어 ${pageCount}페이지로 이어졌어요. 페이지마다 2400 × 3200px 이미지로 저장됩니다.`
              : '미리보기보다 두 배 큰 2400 × 3200px 이미지로 저장됩니다.'}
          </div>
        </section>
      </section>

      {/* 페이지 나누기용 측정 영역: 화면에는 보이지 않습니다. */}
      <div className="measure-host" aria-hidden="true">
        <div ref={probeFirstRef} className={`postcard probe layout-${draft.layout}`}>
          <PageContent draft={draft} kind="first" html="" pageNumber={1} contentImage="" probe />
        </div>
        <div ref={probeRestRef} className={`postcard probe layout-${draft.layout} is-continued`}>
          <PageContent draft={draft} kind="cont" html="" pageNumber={2} contentImage="" probe />
        </div>
        <div className="postcard probe">
          <div className="postcard-content" style={contentStyle(draft)}>
            <div ref={measureRef} className="postcard-text measure-text" style={{ fontSize: `${textSizeFor(draft)}px` }} />
          </div>
        </div>
      </div>

      <nav className="mobile-bar" aria-label="화면 전환">
        <button type="button" className={mobileView === 'edit' ? 'active' : ''} onClick={() => setMobileView('edit')}>
          <PenLine size={18} />
          편집
        </button>
        <button
          type="button"
          className={mobileView === 'preview' ? 'active' : ''}
          onClick={() => {
            setMobileView('preview')
            window.scrollTo({ top: 0 })
          }}
        >
          <Eye size={18} />
          미리보기{pageCount > 1 ? <em>{pageCount}</em> : null}
        </button>
        <button type="button" className="mobile-export" onClick={onExportClick} disabled={exporting}>
          {exporting ? <LoaderCircle className="spinner" size={18} /> : <Download size={18} />}
          저장
        </button>
      </nav>

      {exportMenu ? (
        <>
          <div className="menu-backdrop" onClick={() => setExportMenu(false)} />
          <div className="export-menu" role="menu">
            <p>
              {pageCount}장 · 2400 × 3200px
              <button type="button" className="icon-button" aria-label="닫기" onClick={() => setExportMenu(false)}>
                <X size={15} />
              </button>
            </p>
            <button type="button" role="menuitem" onClick={() => runExport('png')}>
              <Download size={17} />
              <span>
                <strong>{pageCount > 1 ? '모든 페이지 PNG로 저장' : 'PNG로 저장'}</strong>
                <small>{pageCount > 1 ? '페이지마다 파일이 하나씩 내려받아져요' : '고해상도 이미지 한 장'}</small>
              </span>
            </button>
            {pageCount > 1 ? (
              <button type="button" role="menuitem" onClick={() => runExport('zip')}>
                <Archive size={17} />
                <span>
                  <strong>ZIP 파일 하나로 저장</strong>
                  <small>모든 페이지를 묶어서 한 번에</small>
                </span>
              </button>
            ) : null}
            {canShareFiles ? (
              <button type="button" role="menuitem" onClick={() => runExport('share')}>
                <Share2 size={17} />
                <span>
                  <strong>공유하기 · 사진 앱에 저장</strong>
                  <small>휴대폰 공유 시트로 보내요</small>
                </span>
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </main>
  )
}
