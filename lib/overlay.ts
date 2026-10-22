import type { Caret, Field } from "./field"

// Properties that affect where glyphs land; the overlay copies them so its text
// lines up with the field's own text.
const COPIED_PROPERTIES = [
	"font-family",
	"font-size",
	"font-style",
	"font-variant",
	"font-weight",
	"font-stretch",
	"font-feature-settings",
	"font-kerning",
	"line-height",
	"letter-spacing",
	"word-spacing",
	"text-transform",
	"text-indent",
	"text-align",
	"text-rendering",
	"direction",
	"tab-size",
	"white-space",
	"word-break",
	"overflow-wrap",
	"padding-top",
	"padding-right",
	"padding-bottom",
	"padding-left",
	"border-top-width",
	"border-right-width",
	"border-bottom-width",
	"border-left-width",
	"border-top-style",
	"border-right-style",
	"border-bottom-style",
	"border-left-style",
]

const TEXT_FILL = "-webkit-text-fill-color"
// Above any page content: the largest 32-bit z-index.
const TOP_Z_INDEX = "2147483647"
const GHOST_OPACITY = "0.45"
const FADE_IN_MS = 150
const SWEEP_MS = 1150

export interface GhostText {
	before: string
	text: string
	after: string
}

// A thin line under the text that starts at the caret and runs forward, with a
// highlight that sweeps along it, in the field's text color. It sits below the
// letters, so it never covers the text after the caret.
const LOADING_STYLE = [
	"position: absolute",
	"bottom: -0.3em",
	"inset-inline-start: 0",
	"width: 2em",
	"height: 0.12em",
	"border-radius: 0.06em",
	"background:" +
		" linear-gradient(90deg, transparent, color-mix(in srgb, currentcolor 35%, transparent), transparent) 50% 0 / 50% 100% no-repeat," +
		" color-mix(in srgb, currentcolor 12%, transparent)",
].join(";")

/**
 * Draws ghost text over a field. Text before and after the caret is copied so
 * the ghost lands at the caret; when the caret is in the middle of the text,
 * the field's own glyphs are hidden while the ghost is shown.
 *
 * While a request is in flight, the overlay draws a loading indicator at the
 * caret instead of the ghost.
 */
export class Overlay {
	private readonly root = document.createElement("div")
	private readonly line = document.createElement("div")
	private readonly beforeSpan = document.createElement("span")
	private readonly ghostSpan = document.createElement("span")
	private readonly afterSpan = document.createElement("span")
	// The indicator is anchored to an empty inline-block of zero size: its bottom
	// edge is the text baseline at the caret. It doesn't move any text, can't
	// wrap onto a line of its own, and still gets a line after a trailing line
	// break.
	private readonly loadingSpan = document.createElement("span")
	private readonly loadingBar = document.createElement("span")
	private animations: Animation[] = []
	private field: Field | null = null
	private savedTextFill: { value: string; priority: string } | null = null

	constructor() {
		this.root.setAttribute("aria-hidden", "true")
		this.root.dataset.usePrediction = ""
		this.line.append(this.beforeSpan, this.ghostSpan, this.afterSpan)
		this.root.append(this.line)
		this.loadingSpan.dataset.usePredictionLoading = ""
		this.loadingSpan.style.cssText =
			"position: relative; display: inline-block; width: 0; height: 0"
		this.loadingSpan.append(this.loadingBar)
	}

	show(field: Field, ghost: GhostText, className: string | undefined) {
		this.stopLoading()
		this.beforeSpan.textContent = ghost.before
		this.ghostSpan.textContent = ghost.text
		this.afterSpan.textContent = ghost.after

		if (className) {
			this.ghostSpan.className = className
			this.ghostSpan.style.removeProperty("opacity")
		} else {
			this.ghostSpan.removeAttribute("class")
			this.ghostSpan.style.opacity = GHOST_OPACITY
		}

		this.mount(field)
		this.setFieldTextHidden(ghost.after !== "")
		this.sync()
	}

	/**
	 * Draws the loading indicator at the caret; a class name replaces the
	 * built-in look. The text after the caret is copied, invisible, so a line
	 * wraps where the field wraps it.
	 */
	showLoading(field: Field, caret: Caret, className: string | undefined) {
		this.stopLoading()
		this.beforeSpan.textContent = caret.before
		this.ghostSpan.textContent = ""
		this.afterSpan.textContent = caret.after
		this.ghostSpan.after(this.loadingSpan)

		// Tells a custom indicator whether text follows the caret on its line.
		const textAfter = /^[^\n]*\S/.test(caret.after)
		this.loadingSpan.dataset.usePredictionLoading = textAfter ? "middle" : "end"

		if (className) {
			this.loadingBar.className = className
			this.loadingBar.style.cssText = "position: absolute"
		} else {
			this.loadingBar.removeAttribute("class")
			this.loadingBar.style.cssText = LOADING_STYLE
			this.animateLoading()
		}

		this.mount(field)
		this.setFieldTextHidden(false)
		this.sync()
	}

	/** Keeps a shown loading indicator at the caret while the user types on. */
	moveLoading(caret: Caret) {
		if (this.loadingSpan.isConnected) {
			this.beforeSpan.textContent = caret.before
			this.afterSpan.textContent = caret.after
			this.sync()
		}
	}

	/** Follows the field's position and scroll offsets. */
	sync() {
		const field = this.field

		if (!field) {
			return
		}

		const rect = field.getBoundingClientRect()
		const style = this.root.style

		style.top = `${rect.top}px`
		style.left = `${rect.left}px`
		style.width = `${rect.width}px`
		style.height = `${rect.height}px`

		this.root.scrollTop = field.scrollTop
		this.root.scrollLeft = field.scrollLeft
	}

	hide() {
		this.stopLoading()
		this.setFieldTextHidden(false)
		this.root.remove()
		this.field = null
	}

	private mount(field: Field) {
		this.field = field

		const container =
			field.closest<HTMLElement>("dialog[open], [popover]") ?? document.body

		if (this.root.parentElement !== container) {
			container.append(this.root)
		}

		this.copyStyles(field)
	}

	// The Web Animations API needs no stylesheet, so the page's CSP and CSS stay untouched.
	private animateLoading() {
		const bar = this.loadingBar
		const canAnimate =
			typeof bar.animate === "function" &&
			!window.matchMedia("(prefers-reduced-motion: reduce)").matches

		if (!canAnimate) {
			return
		}

		const fadeIn = bar.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: FADE_IN_MS,
			easing: "ease-out",
		})
		const sweep = bar.animate(
			[{ backgroundPosition: "-100% 0" }, { backgroundPosition: "200% 0" }],
			{ duration: SWEEP_MS, easing: "ease-in-out", iterations: Infinity },
		)

		this.animations = [fadeIn, sweep]
	}

	private stopLoading() {
		for (const animation of this.animations) {
			animation.cancel()
		}

		this.animations = []
		this.loadingSpan.remove()
	}

	private copyStyles(field: Field) {
		const computed = window.getComputedStyle(field)
		const style = this.root.style
		const isInput = field instanceof HTMLInputElement

		style.cssText = ""

		for (const property of COPIED_PROPERTIES) {
			style.setProperty(property, computed.getPropertyValue(property))
		}

		// Scrollbars shrink the text area of a textarea; padding takes their place.
		const borderX =
			Number.parseFloat(computed.borderLeftWidth) +
			Number.parseFloat(computed.borderRightWidth)
		const borderY =
			Number.parseFloat(computed.borderTopWidth) +
			Number.parseFloat(computed.borderBottomWidth)
		const scrollbarX = field.offsetWidth - field.clientWidth - borderX
		const scrollbarY = field.offsetHeight - field.clientHeight - borderY

		if (scrollbarX > 0) {
			style.paddingRight = `${Number.parseFloat(computed.paddingRight) + scrollbarX}px`
		}

		if (scrollbarY > 0) {
			style.paddingBottom = `${Number.parseFloat(computed.paddingBottom) + scrollbarY}px`
		}

		// The size comes from the field's border box, whatever its box-sizing.
		style.boxSizing = "border-box"
		style.position = "fixed"
		style.zIndex = TOP_Z_INDEX
		style.margin = "0"
		style.overflow = "hidden"
		style.pointerEvents = "none"
		style.borderColor = "transparent"
		style.background = "transparent"
		style.color = computed.color
		// UI kits may set a text fill on the page; it would override a ghost color.
		style.setProperty(TEXT_FILL, "currentcolor")

		if (isInput) {
			// An input centers its single line vertically and never wraps.
			style.display = "flex"
			style.alignItems = "center"
			style.whiteSpace = "pre"
			this.line.style.cssText = "flex: none; white-space: pre;"
		} else {
			style.display = "block"
			this.line.style.cssText = ""
		}
	}

	private setFieldTextHidden(hidden: boolean) {
		const field = this.field

		if (!field) {
			return
		}

		const textColor = hidden ? "" : "transparent"

		this.beforeSpan.style.color = textColor
		this.beforeSpan.style.setProperty(TEXT_FILL, textColor)
		this.afterSpan.style.color = textColor
		this.afterSpan.style.setProperty(TEXT_FILL, textColor)

		if (hidden && !this.savedTextFill) {
			this.savedTextFill = {
				value: field.style.getPropertyValue(TEXT_FILL),
				priority: field.style.getPropertyPriority(TEXT_FILL),
			}
			field.style.setProperty(TEXT_FILL, "transparent", "important")
		} else if (!hidden && this.savedTextFill) {
			const { value, priority } = this.savedTextFill
			this.savedTextFill = null

			if (value) {
				field.style.setProperty(TEXT_FILL, value, priority)
			} else {
				field.style.removeProperty(TEXT_FILL)
			}
		}
	}
}
