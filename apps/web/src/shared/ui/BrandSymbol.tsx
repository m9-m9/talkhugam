type BrandSymbolProps = {
  alt?: string
  className?: string
  tone: 'coral' | 'inverse'
}

/** 배경 대비에 맞는 Talk후감 심볼 SVG 파일을 일관된 variant로 렌더링한다. */
export function BrandSymbol({ alt = 'Talk후감', className, tone }: BrandSymbolProps) {
  const src =
    tone === 'coral' ? '/brand/talkhugam-symbol.svg' : '/brand/talkhugam-symbol-inverse.svg'

  return <img alt={alt} className={className} src={src} />
}
