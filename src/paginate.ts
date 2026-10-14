// 본문 HTML을 실제 지면 크기에 맞춰 여러 페이지로 나눕니다.
// 숨겨진 측정용 요소에 노드를 하나씩 채워 넣고, 넘치는 지점에서 요소·텍스트를 쪼개 다음 페이지로 넘깁니다.

export type PageBox = { width: number; height: number }

type PlaceResult =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'split'; rest: Node }
  | { kind: 'forced'; rest: Node | null }

const MAX_PAGES = 60
const VOID_TAGS = new Set(['BR', 'IMG', 'WBR'])

function isPageBreak(node: Node) {
  return node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'HR'
}

function hasVisibleContent(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').trim().length > 0
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  const el = node as Element
  if (el.tagName === 'IMG') return true
  return Array.from(el.childNodes).some(hasVisibleContent)
}

function splitText(node: Text, parent: Node, fits: () => boolean): PlaceResult {
  const text = node.data
  const probe = document.createTextNode('')
  parent.appendChild(probe)
  let low = 0
  let high = text.length
  // 들어가는 가장 긴 앞부분을 이진 탐색으로 찾습니다.
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    probe.data = text.slice(0, mid)
    if (fits()) low = mid
    else high = mid - 1
  }
  let cut = low
  if (cut < text.length) {
    // 단어 중간에서 잘리지 않도록 마지막 공백 위치로 물립니다(keep-all 줄바꿈과 맞춤).
    const space = text.slice(0, cut + 1).search(/\s(?=\S*$)/)
    if (space > 0) cut = space
  }
  const head = text.slice(0, cut).replace(/[ \t]+$/, '')
  if (!head.trim()) {
    probe.remove()
    return { kind: 'none' }
  }
  probe.data = head
  const restText = text.slice(cut).replace(/^[ \t\n\r]+/, '')
  if (!restText) return { kind: 'all' }
  return { kind: 'split', rest: document.createTextNode(restText) }
}

function place(node: Node, parent: Node, fits: () => boolean): PlaceResult {
  if (node.nodeType === Node.TEXT_NODE) {
    parent.appendChild(node)
    if (fits()) return { kind: 'all' }
    node.parentNode?.removeChild(node)
    return splitText(node as Text, parent, fits)
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return { kind: 'all' }
  if (isPageBreak(node)) return { kind: 'forced', rest: null }

  const el = node as Element
  if (VOID_TAGS.has(el.tagName)) {
    parent.appendChild(el)
    if (fits()) return { kind: 'all' }
    el.remove()
    return { kind: 'none' }
  }

  const clone = el.cloneNode(false) as Element
  parent.appendChild(clone)
  if (!fits()) {
    clone.remove()
    return { kind: 'none' }
  }
  const children = Array.from(el.childNodes)
  const restWith = (first: Node | null, from: number) => {
    const rest = el.cloneNode(false) as Element
    if (first) rest.appendChild(first)
    children.slice(from).forEach((child) => rest.appendChild(child))
    return rest
  }
  for (let i = 0; i < children.length; i += 1) {
    const result = place(children[i], clone, fits)
    if (result.kind === 'all') continue
    if (result.kind === 'forced') {
      const rest = restWith(result.rest, i + 1)
      return { kind: 'forced', rest: hasVisibleContent(rest) || rest.querySelector('hr') ? rest : null }
    }
    if (result.kind === 'none') {
      if (!hasVisibleContent(clone)) {
        clone.remove()
        // 아직 옮기지 않은 자식은 원래 요소에 남아 있으므로, 앞서 옮긴 자식을 되돌립니다.
        const moved = Array.from(clone.childNodes)
        const restored = el.cloneNode(false) as Element
        moved.forEach((child) => restored.appendChild(child))
        children.slice(i).forEach((child) => restored.appendChild(child))
        return { kind: 'split', rest: restored }
      }
      return { kind: 'split', rest: restWith(null, i) }
    }
    return { kind: 'split', rest: restWith(result.rest, i + 1) }
  }
  return { kind: 'all' }
}

// 새 페이지 맨 위에 빈 줄(<br>, 빈 문단)이 남지 않도록 정리합니다.
function trimLeading(queue: Node[]) {
  while (queue.length) {
    const first = queue[0]
    if (first.nodeType === Node.TEXT_NODE) {
      const trimmed = (first.textContent ?? '').replace(/^[ \t\n\r]+/, '')
      if (!trimmed) {
        queue.shift()
        continue
      }
      first.textContent = trimmed
      return
    }
    if (first.nodeType !== Node.ELEMENT_NODE) {
      queue.shift()
      continue
    }
    const el = first as Element
    if (el.tagName === 'BR') {
      queue.shift()
      continue
    }
    if (isPageBreak(el) || el.tagName === 'IMG') return
    if (!hasVisibleContent(el) && !el.querySelector('hr')) {
      queue.shift()
      continue
    }
    const inner = Array.from(el.childNodes)
    trimLeading(inner)
    el.replaceChildren(...inner)
    return
  }
}

export function paginate(
  html: string,
  measure: HTMLElement,
  first: PageBox,
  rest: PageBox,
  minLine: number,
): string[] {
  const source = document.createElement('div')
  source.innerHTML = html
  const queue: Node[] = Array.from(source.childNodes)
  const pages: string[] = []

  while (pages.length < MAX_PAGES) {
    const box = pages.length === 0 ? first : rest
    if (pages.length > 0) trimLeading(queue)
    if (!queue.length) break
    measure.replaceChildren()
    measure.style.width = `${box.width}px`
    const fits = () => measure.scrollHeight <= box.height + 1

    // 첫 장 공간이 한 줄도 안 되면(예: 이미지를 아주 크게 키운 경우) 본문은 다음 장부터 시작합니다.
    if (box.height < minLine) {
      if (pages.length === 0) {
        pages.push('')
        continue
      }
    }

    while (queue.length) {
      const node = queue.shift() as Node
      const result = place(node, measure, fits)
      if (result.kind === 'all') continue
      if (result.kind === 'forced') {
        if (result.rest) queue.unshift(result.rest)
        break
      }
      if (result.kind === 'split') {
        queue.unshift(result.rest)
        break
      }
      if (!hasVisibleContent(measure)) {
        // 빈 페이지에도 안 들어가는 요소는 잘리더라도 이 페이지에 둡니다(무한 반복 방지).
        measure.appendChild(node)
        break
      }
      queue.unshift(node)
      break
    }
    pages.push(measure.innerHTML)
    // 마지막 노드가 페이지 나누기였다면 빈 페이지를 하나 더 만들지 않습니다.
    if (!queue.some((node) => hasVisibleContent(node) || isPageBreak(node))) break
  }
  measure.replaceChildren()
  return pages.length ? pages : ['']
}
