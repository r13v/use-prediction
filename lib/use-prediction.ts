import { CSSProperties, useCallback, useEffect, useRef } from "react"

type Target = HTMLInputElement | HTMLTextAreaElement

export type PredictionFn = (
  value: string,
  controller: AbortController,
) => Promise<string>

export interface Params {
  /**
   * Predicts the next word based on the given value.
   */
  get: PredictionFn

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
  style?: CSSProperties
}

const isTabKey = (event: Event) => {
  return event instanceof KeyboardEvent && event.key === "Tab"
}

export const usePrediction = (params: Params) => {
  const {
    debounce = 500,
    get: getPrediction,
    style = {},
    color = "#98A5B4",
  } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null)

  const mirrorRef = useRef<HTMLDivElement | null>(null)
  const predictionRef = useRef<string | null>(null)

  const styleRef = useRef<CSSProperties>(style)

  const updateMirror = useCallback(() => {
    const mirror = mirrorRef.current

    if (!mirror) {
      return
    }

    const el = ref.current as Target | null
    let prediction = predictionRef.current

    if (!prediction || !el) {
      mirror.innerHTML = ""
      return
    }

    let inputValue = el.value

    // replace spaces between original text and predicted text with non-breaking spaces
    inputValue = inputValue.replace(/(\s+)$/, (match) => {
      return match.replace(/\s/g, "&nbsp;")
    })

    prediction = prediction.replace(/^(\s+)/, (match) => {
      return match.replace(/\s/g, "&nbsp;")
    })

    mirror.innerHTML = `<span style="opacity: 0">${inputValue}</span>${prediction}`

    const elStyles = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()

    const mirrorStyles = `
    display: inline-block;
    position: absolute;
    z-index: 999999;
    top: ${rect.top + window.scrollY}px;
    left: ${rect.left + window.scrollX}px;
    height: ${elStyles.height};
    width: ${elStyles.width};
    padding: ${elStyles.padding};
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

      if (typeof value === "string" || value === null) {
        mirror.style.setProperty(key, value)
      }
    }
  }, [color])

  useEffect(() => {
    const host = window.document.createElement("div")
    const shadow = host.attachShadow({ mode: "open" })

    const mirror = document.createElement("div")
    mirror.style.display = "inline-block"

    mirrorRef.current = mirror
    shadow.append(mirror)

    updateMirror()

    document.body.append(host)

    return () => {
      host.remove()
    }
  }, [updateMirror])

  useEffect(() => {
    const el = ref.current as Target | null

    if (!el) {
      throw new Error("usePrediction: ref is not set")
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

      const { value } = event.target as Target

      if (value.trim() === "") {
        return
      }

      controller = new AbortController()

      tId = setTimeout(async () => {
        try {
          const newPrediction = await getPrediction(value, controller)
          predictionRef.current = newPrediction
          updateMirror()
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            return
          }

          throw error
        }
      }, debounce)
    }

    const onBlur = () => {
      predictionRef.current = null
      updateMirror()
    }

    const onKeydown = (event: Event) => {
      const prediction = predictionRef.current

      if (!prediction || !isTabKey(event)) {
        predictionRef.current = null
        updateMirror()
        return
      }

      event.preventDefault()
      event.stopPropagation()

      el.value += prediction

      predictionRef.current = null
      updateMirror()
    }

    el.addEventListener("input", onInput)
    el.addEventListener("keydown", onKeydown, { passive: false })
    el.addEventListener("blur", onBlur)

    return () => {
      el.removeEventListener("input", onInput)
      el.removeEventListener("keydown", onKeydown)
      el.removeEventListener("blur", onBlur)

      clearTimeout(tId)
      controller.abort()
      observer.disconnect()
    }
  }, [debounce, getPrediction, updateMirror])

  return { ref }
}
