// What a model writes when it means "no suggestion": `_empty_`, `<none>`, `(no suggestion)`.
const PLACEHOLDER = /^[_*<[(]+\s*(empty|none|no suggestion)\s*[_*>\])]+$/i
// A shorter repeat of the text after the cursor matches by chance too often.
const MIN_REPEAT_CHARS = 4

/**
 * Fixes the slips models make: a placeholder instead of no answer, a repeat
 * of the text after the cursor, and spacing at the joints with the text.
 */
export function cleanSuggestion(
	before: string,
	after: string,
	suggestion: string,
) {
	let result = suggestion.replace(/^<<<|>>>$/g, "")

	if (PLACEHOLDER.test(result.trim())) {
		return ""
	}

	result = cutRepeat(result, after)

	const spaceBefore = /\s$/.test(before) || before === ""

	if (spaceBefore) {
		result = result.trimStart()
	}

	// The suggestion fills the middle of the word that the caret is in.
	const caretInWord =
		/[\p{L}\p{N}]$/u.test(before) && /^[\p{L}\p{N}]/u.test(after)

	if (caretInWord) {
		return result
	}

	result = result.trimEnd()

	// Keep the suggestion apart from a word or an opening bracket after the caret.
	const needsSpace =
		/^[\p{L}\p{N}([]/u.test(after) && /[\p{L}\p{N},.;:!?)]$/u.test(result)

	if (needsSpace) {
		result += " "
	}

	return result
}

/**
 * Cuts the suggestion where it starts to repeat the text after the cursor:
 * that text stays in the field, so the repeat would show twice.
 */
const cutRepeat = (suggestion: string, after: string) => {
	const head = /^\S+(?:\s+\S+){0,2}/.exec(after.trimStart())?.[0]

	if (!head || head.length < MIN_REPEAT_CHARS) {
		return suggestion
	}

	const escaped = head.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")
	const repeat = new RegExp(`(?:^|\\s)${escaped}`).exec(suggestion)

	return repeat ? suggestion.slice(0, repeat.index) : suggestion
}
