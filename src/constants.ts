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

export const DUMMY_CONTENT = [
  '로렘 입숨 돌로르 싯 아멧, 콘섹테투르 아디피싱 엘리트.',
  '세드 두 에이우스모드 템포르 인시디둔트',
  '우트 라보레 엣 돌로레 마그나 알리콰.',
  '',
  '우트 에님 아드 미님 베니암, 퀴스 노스트루드',
  '엑세르치타티온 울람코 라보리스 니시 우트.',
].join('<br>')

export const DEFAULT_DRAFT: Draft = {
  layout: 'cover',
  title: '로렘 입숨 돌로르',
  icon: '✦',
  kicker: 'SHORT NOTE',
  headerText: '01',
  footerLeft: 'a little note',
  footerRight: '01',
  autoPageNumber: true,
  globalFont: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif',
  content: DUMMY_CONTENT,
  backgroundKind: 'solid',
  backgroundColor: '#f3efe6',
  gradientFrom: '#eee7dc',
  gradientTo: '#d9e1dc',
  gradientAngle: 145,
  textColor: '#272621',
  backgroundBlur: 5,
  backgroundSaturation: 80,
  backgroundDim: 18,
  imageScale: 1,
  imageX: 50,
  imageY: 50,
  imageHeight: 690,
  imageFit: 'cover',
  bodyAlign: 'left',
  lineHeight: 1.9,
  bodySize: 30,
}

export const FONTS: FontOption[] = [
  { name: '차분한 명조', value: '"Noto Serif KR", "Nanum Myeongjo", Batang, serif' },
  { name: '단정한 바탕', value: '"Gowun Batang", "Iropke Batang", Batang, serif' },
  {
    name: '깔끔한 고딕',
    value: '"Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
  },
  {
    name: '부드러운 돋움',
    value: '"Gowun Dodum", "Nanum Gothic", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
  },
  { name: '손글씨 계열', value: '"Nanum Pen Script", "Nanum Brush Script", "Segoe Print", cursive' },
  { name: '클래식 바탕', value: 'Batang, "Times New Roman", serif' },
  { name: '궁서 계열', value: 'Gungsuh, "Noto Serif KR", serif' },
  { name: '타자기 계열', value: '"D2Coding", "Nanum Gothic Coding", ui-monospace, monospace' },
]

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
