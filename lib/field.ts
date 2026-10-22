export type Field = HTMLInputElement | HTMLTextAreaElement

// Other input types either have no caret API (email, number) or must never
// leave the page (password).
const TEXT_INPUT_TYPES = new Set(["text", "search", "tel", "url"])

const isField = (node: unknown): node is Field =>
	node instanceof HTMLTextAreaElement ||
	(node instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(node.type))

/** Focus check that also works inside a shadow root. */
export const isFocused = (field: Field) =>
	(field.getRootNode() as Document | ShadowRoot).activeElement === field

export interface Caret {
	before: string
	after: string
}

/** Returns the text around a collapsed caret, or null when a field can't take a suggestion now. */
export const readCaret = (field: Field): Caret | null => {
	if (!isField(field) || field.disabled || field.readOnly) {
		return null
	}

	const { selectionStart, selectionEnd, value } = field

	if (selectionStart === null || selectionStart !== selectionEnd) {
		return null
	}

	return {
		before: value.slice(0, selectionStart),
		after: value.slice(selectionStart),
	}
}

export const sameCaret = (a: Caret | null, b: Caret | null) =>
	a !== null && b !== null && a.before === b.before && a.after === b.after

/**
 * Inserts text at the caret the way typing does: through the browser's
 * editing command, so Undo works and React sees a native input event.
 */
export const insertText = (field: Field, text: string, at: number) => {
	if (!isFocused(field)) {
		field.focus()
	}

	field.setSelectionRange(at, at)

	// jsdom and some embedded browsers have no editing commands.
	const hasEditing = typeof document.execCommand === "function"

	if (hasEditing && document.execCommand("insertText", false, text)) {
		return
	}

	// Set the value through the prototype setter so React's value tracker
	// notices the change. This path can't be undone.
	const isTextarea = field instanceof HTMLTextAreaElement
	const prototype = isTextarea
		? HTMLTextAreaElement.prototype
		: HTMLInputElement.prototype
	const { value } = field
	const caretAfter = at + text.length

	Reflect.set(
		prototype,
		"value",
		value.slice(0, at) + text + value.slice(at),
		field,
	)
	field.setSelectionRange(caretAfter, caretAfter)
	field.dispatchEvent(
		new InputEvent("input", {
			bubbles: true,
			inputType: "insertText",
			data: text,
		}),
	)
}
