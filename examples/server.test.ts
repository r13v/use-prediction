// @vitest-environment node
import { describe, expect, it } from "vitest"

import { cleanSuggestion } from "./server"

describe("cleanSuggestion", () => {
	it.each([["_empty_"], [" <empty>"], ["(none)"], ["[no suggestion]"]])(
		"drops the placeholder %j that a model writes instead of nothing",
		(answer) => {
			expect(cleanSuggestion("Hello", "", answer)).toBe("")
		},
	)

	it("keeps a real word that looks like a placeholder", () => {
		expect(cleanSuggestion("The tank is", "", " empty")).toBe(" empty")
	})

	it.each([
		[
			"the repeat of the text after the cursor",
			"help address this need through it.",
			"help ",
		],
		[
			"the repeat and the words after it",
			"help locals address this need. More",
			"help locals ",
		],
		["a suggestion that only repeats it", "address this need through it.", ""],
	])("cuts %s", (_, answer, expected) => {
		expect(
			cleanSuggestion("designed to ", "address this need through it.", answer),
		).toBe(expected)
	})

	it.each([
		[
			"a word after the cursor",
			"to ",
			"address",
			"the needs and to",
			"the needs and to ",
		],
		["an opening bracket after the cursor", "Cost: ", "(net)", "5", "5 "],
		["no text after the cursor", "Hello", "", " world  ", " world"],
		[
			"a space after the cursor",
			"Thanks for",
			" Anna",
			" the help ",
			" the help",
		],
		[
			"punctuation after the cursor",
			"Thanks for",
			", Anna",
			" the help ",
			" the help",
		],
		["a line break after the cursor", "Thanks", "\nBest", " a lot ", " a lot"],
	])(
		"fits the end of the suggestion to %s",
		(_, before, after, answer, expected) => {
			expect(cleanSuggestion(before, after, answer)).toBe(expected)
		},
	)

	it("drops the leading space after a space before the cursor", () => {
		expect(cleanSuggestion("Hello ", "", " world")).toBe("world")
	})

	it("leaves a suggestion inside a word as it is", () => {
		expect(cleanSuggestion("addr", "ss", "e")).toBe("e")
	})
})
