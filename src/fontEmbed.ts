// PNG로 저장할 때 웹폰트가 빠지면 시스템 기본 글꼴(예: 궁서)로 바뀌어 나옵니다.
// 저장할 페이지에서 실제로 쓰인 글꼴·글자만 골라 폰트 파일을 data URL로 넣은 @font-face CSS를 만듭니다.

type Face = { family: string; ranges: [number, number][] | null; body: string; urls: string[] }

const cssCache = new Map<string, Promise<string>>()
const fileCache = new Map<string, Promise<string>>()

function fetchCss(url: string) {
  let pending = cssCache.get(url)
  if (!pending) {
    pending = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`css ${res.status}`)
      return res.text()
    })
    pending.catch(() => cssCache.delete(url))
    cssCache.set(url, pending)
  }
  return pending
}

function fetchAsDataUrl(url: string) {
  let pending = fileCache.get(url)
  if (!pending) {
    pending = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`font ${res.status}`)
        return res.blob()
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          }),
      )
    pending.catch(() => fileCache.delete(url))
    fileCache.set(url, pending)
  }
  return pending
}

function parseRanges(value: string): [number, number][] {
  return value
    .split(',')
    .map((part) => part.trim().replace(/^u\+/i, ''))
    .filter(Boolean)
    .map((part) => {
      if (part.includes('?')) {
        return [parseInt(part.replace(/\?/g, '0'), 16), parseInt(part.replace(/\?/g, 'f'), 16)] as [number, number]
      }
      const [start, end] = part.split('-')
      const a = parseInt(start, 16)
      return [a, end ? parseInt(end, 16) : a] as [number, number]
    })
}

function parseFaces(css: string, baseUrl: string): Face[] {
  const faces: Face[] = []
  for (const match of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = match[1]
    const family = body.match(/font-family:\s*['"]?([^;'"]+)['"]?/)?.[1]?.trim()
    if (!family) continue
    const range = body.match(/unicode-range:\s*([^;]+)/)?.[1]
    const urls = Array.from(body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g), (m) => new URL(m[1], baseUrl).href)
    faces.push({ family: family.toLowerCase(), ranges: range ? parseRanges(range) : null, body, urls })
  }
  return faces
}

function usedFamilies(nodes: HTMLElement[]) {
  const families = new Set<string>()
  nodes.forEach((node) => {
    ;[node, ...Array.from(node.querySelectorAll<HTMLElement>('*'))].forEach((el) => {
      getComputedStyle(el)
        .fontFamily.split(',')
        .forEach((name) => families.add(name.trim().replace(/^['"]|['"]$/g, '').toLowerCase()))
    })
    // <font face="…">로 지정된 글꼴도 포함합니다.
    node.querySelectorAll('font[face]').forEach((el) => {
      ;(el.getAttribute('face') ?? '').split(',').forEach((name) => families.add(name.trim().replace(/^['"]|['"]$/g, '').toLowerCase()))
    })
  })
  return families
}

function usedCodepoints(nodes: HTMLElement[]) {
  const points = new Set<number>()
  nodes.forEach((node) => {
    const text = node.textContent ?? ''
    for (const source of [text, text.toUpperCase(), text.toLowerCase()]) {
      for (const char of source) points.add(char.codePointAt(0) as number)
    }
  })
  return Array.from(points)
}

export async function buildFontEmbedCSS(nodes: HTMLElement[]): Promise<string> {
  const sheets = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][data-webfont]'), (link) => link.href)
  if (!sheets.length) return ''
  const families = usedFamilies(nodes)
  const points = usedCodepoints(nodes)
  const blocks = await Promise.all(
    sheets.map(async (href) => {
      try {
        const faces = parseFaces(await fetchCss(href), href).filter(
          (face) =>
            families.has(face.family) &&
            (!face.ranges || points.some((cp) => face.ranges!.some(([a, b]) => cp >= a && cp <= b))),
        )
        const rendered = await Promise.all(
          faces.map(async (face) => {
            const dataUrls = new Map(await Promise.all(face.urls.map(async (url) => [url, await fetchAsDataUrl(url)] as const)))
            // 상대 경로를 포함한 모든 url(...)을 미리 받아 둔 data URL로 바꿉니다.
            const body = face.body.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, (whole, raw: string) => {
              const dataUrl = dataUrls.get(new URL(raw, href).href)
              return dataUrl ? `url("${dataUrl}")` : whole
            })
            return `@font-face{${body}}`
          }),
        )
        return rendered.join('\n')
      } catch {
        return ''
      }
    }),
  )
  return blocks.join('\n')
}
