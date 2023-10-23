import { useCallback, useEffect, useRef } from 'react'

type Target = HTMLInputElement | HTMLTextAreaElement

export type PredictionFn = (
  value: string,
  controller: AbortController,
) => Promise<string>

export interface Params {
  /**
   * Predicts the next word based on the given value.
   */
  getPrediction: PredictionFn

  /**
   * Realtime prediction delay in milliseconds.
   * @default 500
   */
  debounce?: number

  /**
   * Color of the prediction text.
   * @default #98A5B4
   */
  color?: string

  /**
   * Additional styles for the mirror element.
   */
  style?: React.CSSProperties
}

export const usePrediction = (params: Params) => {
  const {
    debounce = 500,
    getPrediction,
    style = {},
    color = '#98A5B4',
  } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null)

  const mirrorRef = useRef<HTMLDivElement | null>(null)
  const predictionRef = useRef<string | null>(null)

  const styleRef = useRef<React.CSSProperties>(style)

  const updateMirror = useCallback(() => {
    const mirror = mirrorRef.current

    if (!mirror) {
      return
    }

    const el = ref.current as Target | null
    let prediction = predictionRef.current

    if (!prediction || !el) {
      mirror.innerHTML = ''
      return
    }

    let inputValue = el.value

    // replace ending spaces with non-breaking spaces
    inputValue = inputValue.replace(/(\s+)$/, (match) => {
      return match.replace(/\s/g, '&nbsp;')
    })

    // replace leading spaces with non-breaking spaces
    prediction = prediction.replace(/^(\s+)/, (match) => {
      return match.replace(/\s/g, '&nbsp;')
    })

    mirror.innerHTML = `<span style="opacity: 0">${inputValue}</span>${prediction}`

    const elStyles = window.getComputedStyle(el)

    const mirrorStyles = `
    display: inline-block;
    position: absolute;
    z-index: 1;
    top: ${el.offsetTop}px;
    left: ${el.offsetLeft}px;
    height: ${elStyles.height};
    width: ${elStyles.width};
    padding: ${elStyles.padding};
    margin: ${elStyles.margin};
    background: transparent;
    border: ${elStyles.border};
    border-color: transparent;
    pointer-events: none;

    font: ${elStyles.font};
    font-size: ${elStyles.fontSize};
    font-family: ${elStyles.fontFamily};
    font-weight: ${elStyles.fontWeight};
    font-style: ${elStyles.fontStyle};
    text-transform: ${elStyles.textTransform};
    text-indent: ${elStyles.textIndent};
    letter-spacing: ${elStyles.letterSpacing};
    word-spacing: ${elStyles.wordSpacing};
    line-height: ${elStyles.lineHeight};
    text-decoration: ${elStyles.textDecoration};
    text-align: ${elStyles.textAlign};
    direction: ${elStyles.direction};
    vertical-align: ${elStyles.verticalAlign};
    white-space: ${elStyles.whiteSpace};
    color: ${color};
  `
    mirror.style.cssText = mirrorStyles

    for (const key in styleRef.current) {
      const value = Reflect.get(styleRef.current, key)

      if (typeof value === 'string') {
        mirror.style.setProperty(key, value)
      }
    }
  }, [color])

  // attach mirror
  useEffect(() => {
    const host = window.document.createElement('div')
    const shadow = host.attachShadow({ mode: 'open' })

    const mirror = document.createElement('div')
    mirror.style.display = 'inline-block'

    mirrorRef.current = mirror
    shadow.append(mirror)

    updateMirror()

    document.body.append(host)

    return () => {
      host.remove()
    }
  }, [updateMirror])

  // listen to keyup events
  useEffect(() => {
    const el = ref.current as Target | null

    if (!el) {
      throw new Error('usePrediction: ref is not set')
    }

    predictionRef.current = null

    let tId: ReturnType<typeof setTimeout>
    let controller: AbortController = new AbortController()

    const observer = new ResizeObserver(() => {
      updateMirror()
    })

    observer.observe(el)

    const onInput = (event: Event) => {
      clearTimeout(tId)
      controller.abort()

      const value = (event.target as Target).value

      if (value.trim() === '') {
        return
      }

      controller = new AbortController()

      tId = setTimeout(async () => {
        try {
          const newPrediction = await getPrediction(value, controller)
          predictionRef.current = newPrediction
          updateMirror()
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return
          }

          throw error
        }
      }, debounce)
    }

    const cleanMirror = () => {
      predictionRef.current = null
      updateMirror()
    }

    const applyPrediction = (event: Event) => {
      const prediction = predictionRef.current
      const isTabPressed = event instanceof KeyboardEvent && event.key === 'Tab'

      if (!isTabPressed || !prediction) {
        return
      }

      event.preventDefault()

      const el = event.target as Target
      el.value += prediction

      cleanMirror()
    }

    el.addEventListener('input', onInput)
    el.addEventListener('keydown', cleanMirror)
    el.addEventListener('keydown', applyPrediction)
    el.addEventListener('blur', cleanMirror)

    return () => {
      el.removeEventListener('input', onInput)
      el.removeEventListener('keydown', cleanMirror)
      el.removeEventListener('blur', cleanMirror)

      clearTimeout(tId)
      controller.abort()
      observer.disconnect()
    }
  }, [debounce, getPrediction, updateMirror])

  return { ref }
}
