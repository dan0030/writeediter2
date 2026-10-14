export type Layout = 'cover' | 'page' | 'image'
export type BodyAlign = 'left' | 'center' | 'right' | 'justify'
export type BackgroundKind = 'solid' | 'gradient' | 'image'
export type ImageFit = 'cover' | 'contain'

export type Draft = {
  layout: Layout
  title: string
  icon: string
  kicker: string
  headerText: string
  footerLeft: string
  footerRight: string
  autoPageNumber: boolean
  pageStart: number
  globalFont: string
  content: string
  backgroundKind: BackgroundKind
  backgroundColor: string
  gradientFrom: string
  gradientTo: string
  gradientAngle: number
  textColor: string
  backgroundBlur: number
  backgroundSaturation: number
  backgroundDim: number
  imageScale: number
  imageX: number
  imageY: number
  imageHeight: number
  imageFit: ImageFit
  bodyAlign: BodyAlign
  lineHeight: number
  bodySize: number
}

export type FontOption = {
  name: string
  value: string
  custom?: boolean
  source?: string
}

export const STORAGE_KEY = 'sentence-postcard-studio-v2'
export const PRESET_KEY = 'sentence-postcard-studio-color-presets'

export const PAGE_WIDTH = 1200
export const PAGE_HEIGHT = 1600

export const SAMPLE_CONTENT = [
  '끝나고 나서야 비로소 시작되는 것이 있다.',
  '',
  '인간이고 싶지 않았던 少女와',
  '차마 전능하지 못했던 神.',
  '',
  '지금 뻗은 손이 네 구원이 될 수 없다는 것도',
  '우리의 목적지가 낙원일지 지옥일지 알 수 없다는 것도',
  '전부 괜찮으니까.',
  '',
  '우리는 오늘도 來日을 약속하자.',
].join('<br>')

// 손글씨 계열 등에 `cursive`를 마지막 대체 글꼴로 두면 Windows에서 궁서체로 바뀌어 보이므로,
// 모든 글꼴을 웹폰트로 불러오고 대체 글꼴은 일반 serif/sans-serif로 둡니다.
export const FONTS: FontOption[] = [
  { name: '차분한 명조', value: '"Noto Serif KR", "Nanum Myeongjo", serif' },
  { name: '나눔 명조', value: '"Nanum Myeongjo", "Noto Serif KR", serif' },
  { name: '단정한 바탕', value: '"Gowun Batang", "Noto Serif KR", serif' },
  { name: '깔끔한 고딕', value: '"Pretendard Variable", Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
  { name: '본고딕', value: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
  { name: '부드러운 돋움', value: '"Gowun Dodum", "Noto Sans KR", sans-serif' },
  { name: '손글씨 계열', value: '"Nanum Pen Script", "Noto Sans KR", sans-serif' },
  { name: '동글한 손글씨', value: 'Gaegu, "Noto Sans KR", sans-serif' },
  { name: '붓글씨 계열', value: '"Nanum Brush Script", "Noto Sans KR", sans-serif' },
  { name: '클래식 바탕', value: 'Batang, "Nanum Myeongjo", "Noto Serif KR", serif' },
  { name: '궁서 계열', value: 'Gungsuh, GungSeo, "Song Myung", serif' },
  { name: '타자기 계열', value: '"Nanum Gothic Coding", D2Coding, ui-monospace, monospace' },
]

export const DEFAULT_DRAFT: Draft = {
  layout: 'cover',
  title: '輪廻',
  icon: '✦',
  kicker: '사라지는 것의 永遠',
  headerText: 'MNM',
  footerLeft: '循環을 끊을 열쇠는',
  footerRight: '03',
  autoPageNumber: true,
  pageStart: 3,
  globalFont: FONTS[0].value,
  content: SAMPLE_CONTENT,
  backgroundKind: 'solid',
  backgroundColor: '#f3efe6',
  gradientFrom: '#efeee3',
  gradientTo: '#dcdde2',
  gradientAngle: 160,
  textColor: '#272621',
  backgroundBlur: 5,
  backgroundSaturation: 80,
  backgroundDim: 18,
  imageScale: 1,
  imageX: 50,
  imageY: 50,
  imageHeight: 600,
  imageFit: 'cover',
  bodyAlign: 'left',
  lineHeight: 1.9,
  bodySize: 30,
}

export const INLINE_SIZES = [18, 20, 22, 26, 30, 34, 40, 48, 58, 72]
export const BODY_SIZES = [22, 24, 26, 28, 30, 32, 34, 36, 40]
export const LINE_HEIGHTS = [1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.6]

export const TEXT_SWATCHES = ['#272621', '#5d5f58', '#9a9890', '#ffffff', '#8a3b2e', '#b5652b', '#9a7b2f', '#3f5e45', '#2f4a6b', '#5b4a7a']
export const HIGHLIGHT_SWATCHES = ['#fff0a8', '#ffe1b8', '#ffd6cc', '#f7d4e6', '#e4dcf5', '#d6e4f5', '#d4ece4', '#e3edc9']

export type ColorPresets = { text: string[]; highlight: string[] }
export const MAX_PRESETS = 24

export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(raw)) return `#${raw.split('').map((c) => c + c).join('')}`
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`
  return null
}

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}
