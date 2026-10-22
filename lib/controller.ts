import {
  Caret,
  Field,
  insertText,
  isFocused,
  readCaret,
  sameCaret,
} from "./field"
import { GhostText, Overlay } from "./overlay"

export interface PredictionRequest {
  /** The whole field value. */
  text: string
  /** The text before the caret. */
  before: string
  /** The text after the caret. */
  after: string
  /** Aborted when the request becomes stale. */
  signal: AbortSignal
}

/** Returns the text to insert at the caret, or an empty string for no suggestion. */
export type PredictionFn = (request: PredictionRequest) => Promise<string>

export interface PredictionOptions {
  get: PredictionFn

  /**
   * Delay after the last keystroke before `get` is called, in milliseconds.
   * @default 300
   */
  debounce?: number

  /**
   * Class name of the ghost text. Without it, the ghost is the field's text
   * color at reduced opacity.
   */
  className?: string

  /**
   * Called when `get` fails. The field goes on working without a suggestion.
   * @default console.error
   */
  onError?: (error: unknown) => void
}

export type PredictionStatus = "idle" | "loading" | "ready"

export interface PredictionState {
  status: PredictionStatus
  /** The visible suggestion, or an empty string. */
  suggestion: string
}

const IDLE: PredictionState = { status: "idle", suggestion: "" }
const LOADING: PredictionState = { status: "loading", suggestion: "" }

/**
 * Connects one field to a prediction source: requests suggestions while the
 * user types, shows them as ghost text, and inserts them on Tab.
 */
export class PredictionController {
  private field: Field | null = null
  private pendingDetach = false
  private state = IDLE
  private readonly listeners = new Set<() => void>()
  private readonly overlay =
    typeof document === "undefined" ? null : new Overlay()

  private ghost: GhostText | null = null
  // Every change of the field or the caret bumps the generation; a response
  // for an older generation is dropped.
  private generation = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private notifyTimer: ReturnType<typeof setTimeout> | undefined
  private request: AbortController | null = null
  // The caret the pending request or the ghost belongs to.
  private expected: Caret | null = null
  // The caret context of the request in flight.
  private loading: Caret | null = null
  private resizeObserver: ResizeObserver | null = null

  constructor(private readonly options: () => PredictionOptions) {}

  /** A stable ref callback. Detaching is deferred so a ref that React re-creates each render keeps the field attached. */
  readonly ref = (node: Field | null) => {
    if (node === null) {
      if (this.field && !this.pendingDetach) {
        this.pendingDetach = true
        queueMicrotask(() => {
          if (this.pendingDetach) {
            this.detach()
          }
        })
      }

      return
    }

    this.pendingDetach = false

    if (node === this.field) {
      return
    }

    this.detach()

    if (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement
    ) {
      this.attach(node)
    }
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  readonly getSnapshot = () => this.state

  /** Inserts the visible suggestion at the caret. Returns false when there is nothing to accept. */
  readonly accept = () => {
    const field = this.field
    const ghost = this.ghost

    if (!field || !ghost) {
      return false
    }

    if (!sameCaret(readCaret(field), ghost)) {
      this.reset()
      return false
    }

    this.reset()
    insertText(field, ghost.text, ghost.before.length)

    return true
  }

  /** Inserts the next word of the suggestion; the rest stays visible. */
  private acceptWord() {
    const field = this.field
    const ghost = this.ghost
    const word = ghost?.text.match(/^\s*\S+/)?.[0]

    if (!field || !ghost || !word || !sameCaret(readCaret(field), ghost)) {
      return false
    }

    // The input event that follows shortens the ghost, as typing does.
    insertText(field, word, ghost.before.length)

    return true
  }

  /** Hides the suggestion and cancels a pending request. */
  readonly dismiss = () => {
    this.reset()
  }

  private attach(field: Field) {
    this.field = field

    field.addEventListener("input", this.onInput)
    field.addEventListener("keydown", this.onKeyDown)
    field.addEventListener("blur", this.dismiss)
    field.addEventListener("compositionstart", this.dismiss)
    field.addEventListener("compositionend", this.onCompositionEnd)
    field.addEventListener("scroll", this.onLayout)
    // Capture: selectionchange fires at the field in some browsers and at the document in others.
    document.addEventListener("selectionchange", this.checkCaret, true)
    window.addEventListener("scroll", this.onLayout, true)
    window.addEventListener("resize", this.onLayout)

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.onLayout)
      this.resizeObserver.observe(field)
    }
  }

  private detach() {
    const field = this.field
    this.pendingDetach = false

    if (!field) {
      return
    }

    this.reset()
    this.field = null

    field.removeEventListener("input", this.onInput)
    field.removeEventListener("keydown", this.onKeyDown)
    field.removeEventListener("blur", this.dismiss)
    field.removeEventListener("compositionstart", this.dismiss)
    field.removeEventListener("compositionend", this.onCompositionEnd)
    field.removeEventListener("scroll", this.onLayout)
    document.removeEventListener("selectionchange", this.checkCaret, true)
    window.removeEventListener("scroll", this.onLayout, true)
    window.removeEventListener("resize", this.onLayout)

    this.resizeObserver?.disconnect()
    this.resizeObserver = null
  }

  private readonly onInput = (event: Event) => {
    const field = this.field

    if (!field || (event as InputEvent).isComposing) {
      return
    }

    const caret = readCaret(field)

    this.expected = caret

    if (caret && this.ghost && this.continuesGhost(caret)) {
      return
    }

    if (caret && this.loading && typedSince(this.loading, caret) !== null) {
      // Typing on at the caret: the answer in flight may still fit.
      return
    }

    this.reset()

    if (caret) {
      this.schedule(field, caret)
    }
  }

  private readonly onKeyDown = (keyboardEvent: Event) => {
    const event = keyboardEvent as KeyboardEvent

    if (event.isComposing || event.keyCode === 229) {
      return
    }

    const modified =
      event.shiftKey || event.altKey || event.ctrlKey || event.metaKey

    if (event.key === "Tab" && !modified && this.ghost) {
      if (this.accept()) {
        event.preventDefault()
      }
    } else if (
      event.key === "ArrowRight" &&
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      !event.shiftKey &&
      this.ghost
    ) {
      if (this.acceptWord()) {
        event.preventDefault()
      }
    } else if (event.key === "Escape") {
      // A visible ghost takes the key, so Escape doesn't also close a dialog.
      if (this.ghost) {
        event.preventDefault()
        event.stopPropagation()
      }

      this.reset()
    }
  }

  private readonly onCompositionEnd = () => {
    const field = this.field
    const caret = field && readCaret(field)

    if (field && caret) {
      this.schedule(field, caret)
    }
  }

  /**
   * Drops the pending request and the ghost when the caret or the value
   * changed without typing: a click, an arrow key, or a value set by code.
   */
  readonly checkCaret = () => {
    const field = this.field

    if (this.expected && field && !sameCaret(readCaret(field), this.expected)) {
      this.reset()
    }
  }

  private readonly onLayout = () => {
    if (this.ghost) {
      this.overlay?.sync()
    }
  }

  /**
   * Typing the first characters of the ghost shortens it instead of starting
   * a new request. Anything else, such as a deletion or an edit after the
   * caret, ends the ghost.
   */
  private continuesGhost(caret: Caret) {
    const ghost = this.ghost!
    const typed = typedSince(ghost, caret)

    if (
      !typed ||
      typed.length >= ghost.text.length ||
      !ghost.text.startsWith(typed)
    ) {
      return false
    }

    this.show({
      before: caret.before,
      text: ghost.text.slice(typed.length),
      after: caret.after,
    })

    return true
  }

  private schedule(field: Field, caret: Caret) {
    if (caret.before.trim() === "") {
      return
    }

    const generation = this.generation
    const { debounce = 300 } = this.options()
    this.expected = caret

    this.timer = setTimeout(() => {
      void this.load(field, caret, generation)
    }, debounce)
  }

  private async load(field: Field, caret: Caret, generation: number) {
    const request = new AbortController()
    this.request = request
    this.loading = caret
    this.setState(LOADING)

    let text: string

    try {
      text = await this.options().get({
        text: caret.before + caret.after,
        before: caret.before,
        after: caret.after,
        signal: request.signal,
      })
    } catch (error) {
      if (generation === this.generation) {
        this.request = null
        this.loading = null
        this.setState(IDLE)
      }

      if (!request.signal.aborted) {
        const { onError = reportFailure } = this.options()
        onError(error)
      }

      return
    }

    if (generation !== this.generation) {
      return
    }

    this.request = null
    this.loading = null

    const now =
      this.field === field && isFocused(field) ? readCaret(field) : null
    // Characters typed while the request was in flight.
    const typed = now && typedSince(caret, now)
    const suggestion =
      now && typed !== null && text.startsWith(typed)
        ? fit(field, text.slice(typed.length))
        : ""

    if (suggestion) {
      this.show({ ...now!, text: suggestion })
    } else {
      this.setState(IDLE)

      if (now && typed) {
        // The user typed past this answer; ask about the current text.
        this.schedule(field, now)
      }
    }
  }

  private show(ghost: GhostText) {
    this.ghost = ghost
    this.expected = ghost
    this.overlay?.show(this.field!, ghost, this.options().className)
    this.setState({ status: "ready", suggestion: ghost.text })
  }

  /** Drops the ghost, the pending timer, and the request in flight. */
  private reset() {
    this.generation += 1
    clearTimeout(this.timer)
    this.request?.abort()
    this.request = null
    this.loading = null
    this.expected = null

    if (this.ghost) {
      this.ghost = null
      this.overlay?.hide()
    }

    this.setState(IDLE)
  }

  private setState(state: PredictionState) {
    if (state === this.state) {
      return
    }

    this.state = state

    // Notify after the current event. Our input listener runs before React's;
    // a React render inside it would write the old value back into a
    // controlled field and swallow the keystroke.
    this.notifyTimer ??= setTimeout(() => {
      this.notifyTimer = undefined

      for (const listener of this.listeners) {
        listener()
      }
    })
  }
}

const reportFailure = (error: unknown) => {
  console.error("usePrediction: get failed", error)
}

/** The text typed at the caret since `from`, or null after any other edit. */
const typedSince = (from: Caret, to: Caret) =>
  to.after === from.after && to.before.startsWith(from.before)
    ? to.before.slice(from.before.length)
    : null

/** Keeps a suggestion within what the field can hold. */
const fit = (field: Field, text: string) => {
  let result = text.replace(/\r\n?/g, "\n")

  if (field instanceof HTMLInputElement) {
    result = result.split("\n", 1)[0]
  }

  if (field.maxLength >= 0) {
    result = result.slice(0, Math.max(0, field.maxLength - field.value.length))
  }

  return result
}
