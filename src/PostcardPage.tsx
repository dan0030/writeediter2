import type { CSSProperties } from 'react'
import { pad2, type Draft } from './constants'

export type PageKind = 'first' | 'cont'

type Props = {
  draft: Draft
  kind: PageKind
  html: string
  pageNumber: number
  contentImage: string
  probe?: boolean
}

export function textSizeFor(draft: Draft) {
  return draft.layout === 'image' ? draft.bodySize - 4 : draft.bodySize
}

export function contentStyle(draft: Draft): CSSProperties {
  return {
    color: draft.textColor,
    textAlign: draft.bodyAlign,
    lineHeight: draft.lineHeight,
    fontFamily: draft.globalFont,
  }
}

// 한 장의 엽서 지면. probe 모드에서는 본문을 비워 두고 본문이 차지할 수 있는 공간만 측정합니다.
export function PageContent({ draft, kind, html, pageNumber, contentImage, probe = false }: Props) {
  const icon = draft.icon || '✦'
  const title = draft.title || '제목 없는 문장'
  const textStyle: CSSProperties = { fontSize: `${textSizeFor(draft)}px` }
  const body = (className: string) => (
    <div
      className={`postcard-text ${className}`}
      style={textStyle}
      data-probe={probe ? 'text' : undefined}
      dangerouslySetInnerHTML={{ __html: probe ? '' : html }}
    />
  )
  const footer = (
    <div className="postcard-footer">
      <span>{draft.footerLeft}</span>
      <span>{draft.autoPageNumber ? pad2(draft.pageStart + pageNumber - 1) : draft.footerRight}</span>
    </div>
  )
  const style = contentStyle(draft)

  if (kind === 'cont') {
    return (
      <div className="postcard-content cont-content" style={style}>
        <div className="page-header">
          <span>{icon}</span>
          <i />
          <small>{draft.headerText}</small>
        </div>
        {draft.title ? <p className="postcard-kicker cont-kicker">{draft.title}</p> : <div className="cont-gap" />}
        {body('cont-text')}
        {footer}
      </div>
    )
  }

  if (draft.layout === 'cover') {
    return (
      <div className="postcard-content cover-content" style={style}>
        <div className="cover-icon">
          <span>{icon}</span>
          <i />
          <small>{draft.headerText}</small>
        </div>
        <div className="cover-spacer" />
        <div className="cover-copy">
          <p className="postcard-kicker">{draft.kicker}</p>
          <h2>{title}</h2>
          {body('cover-text')}
        </div>
        {footer}
      </div>
    )
  }

  if (draft.layout === 'page') {
    return (
      <div className="postcard-content page-content" style={style}>
        <div className="page-header">
          <span>{icon}</span>
          <i />
          <small>{draft.headerText}</small>
        </div>
        <div className="page-title">
          <p className="postcard-kicker">{draft.kicker}</p>
          <h2>{title}</h2>
        </div>
        {body('page-text')}
        {footer}
      </div>
    )
  }

  const imageStyle: CSSProperties = {
    objectPosition: `${draft.imageX}% ${draft.imageY}%`,
    objectFit: draft.imageFit,
    transform: `scale(${draft.imageScale})`,
  }
  return (
    <div className="postcard-content image-content" style={style}>
      <div className="image-window" style={{ height: `${draft.imageHeight}px` }}>
        {contentImage && !probe ? (
          <img src={contentImage} alt="" style={imageStyle} />
        ) : (
          <div className="image-placeholder">
            <span>{icon}</span>
            <p>IMAGE</p>
          </div>
        )}
        {draft.headerText ? <small>{draft.headerText}</small> : null}
      </div>
      <div className="image-copy">
        <p className="postcard-kicker">{draft.kicker}</p>
        <h2>{title}</h2>
        {body('image-text')}
      </div>
      {footer}
    </div>
  )
}
