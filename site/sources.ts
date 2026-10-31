import { cleanSuggestion } from "../examples/clean-suggestion"
import type { PredictionFn } from "../lib/use-prediction"

// Long enough for the loading indicator to show, short enough to feel fast.
const SCRIPTED_DELAY_MS = 450
// The start of a sentence that is too short matches a phrase by chance.
const MIN_SENTENCE_START = 2

/**
 * Answers from a fixed script, so the demo works in every browser without a
 * model: it completes the current sentence when a phrase of the script starts
 * with it, and suggests the next phrase after a finished one.
 */
export const scripted =
	(phrases: string[]): PredictionFn =>
	async ({ before, signal }) => {
		await wait(SCRIPTED_DELAY_MS, signal)

		const sentence = /[^.!?\n]*$/.exec(before)?.[0].trimStart() ?? ""

		if (sentence === "") {
			const finished = phrases.findIndex((phrase) =>
				before.trimEnd().endsWith(phrase),
			)
			const next = phrases[finished + 1]
			const separator = /\s$/.test(before) ? "" : " "

			return finished === -1 || !next ? "" : separator + next
		}

		if (sentence.length < MIN_SENTENCE_START) return ""

		const phrase = phrases.find((candidate) =>
			candidate.toLowerCase().startsWith(sentence.toLowerCase()),
		)

		return phrase ? phrase.slice(sentence.length) : ""
	}

const wait = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, ms)

		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer)
				reject(signal.reason)
			},
			{ once: true },
		)
	})

// The Prompt API: https://developer.mozilla.org/en-US/docs/Web/API/LanguageModel
type Availability = "unavailable" | "downloadable" | "downloading" | "available"

interface LanguageModelMessage {
	role: "system" | "user" | "assistant"
	content: string
	prefix?: boolean
}

export interface LanguageModelSession {
	prompt(
		input: LanguageModelMessage[],
		options: { signal: AbortSignal },
	): Promise<string>
	clone(options: { signal: AbortSignal }): Promise<LanguageModelSession>
	destroy(): void
}

interface LanguageModelOptions {
	expectedInputs: { type: "text"; languages: string[] }[]
	expectedOutputs: { type: "text"; languages: string[] }[]
	initialPrompts?: LanguageModelMessage[]
	monitor?: (monitor: EventTarget) => void
}

interface LanguageModelApi {
	availability(options: LanguageModelOptions): Promise<Availability>
	create(options: LanguageModelOptions): Promise<LanguageModelSession>
}

const languageModel = (globalThis as { LanguageModel?: LanguageModelApi })
	.LanguageModel

const ENGLISH = {
	expectedInputs: [{ type: "text" as const, languages: ["en"] }],
	expectedOutputs: [{ type: "text" as const, languages: ["en"] }],
}

const INSTRUCTIONS =
	"You continue the text that a person types into a form field. Write only the next few words of their sentence, in their tone. When their sentence is finished, write the next sentence on the same line. Never start a new line. Never invent names, numbers or dates."

/** "unavailable" also covers browsers without the Prompt API. */
export const builtInAvailability = async (): Promise<Availability> =>
	languageModel ? languageModel.availability(ENGLISH) : "unavailable"

// How often to ask whether the model finished its download.
const MODEL_POLL_MS = 1000

/**
 * Creates the session that each request clones. Call it from a click when the
 * model is not downloaded yet: the browser starts the download only after a
 * user activation.
 */
export const createBuiltInSession = async (
	onDownload: (progress: number) => void,
) => {
	if (!languageModel) {
		throw new Error("The browser has no Prompt API")
	}

	const session = await languageModel.create({
		...ENGLISH,
		initialPrompts: [{ role: "system", content: INSTRUCTIONS }],
		monitor(monitor) {
			monitor.addEventListener("downloadprogress", (event) => {
				onDownload((event as ProgressEvent).loaded)
			})
		},
	})

	// Chrome can resolve create() while the model still downloads; its
	// prompts then fail, so wait until the model reports that it can run.
	while ((await builtInAvailability()) !== "available") {
		await new Promise((resolve) => setTimeout(resolve, MODEL_POLL_MS))
	}

	return session
}

// A suggestion runs to the end of a clause, so a few words are enough.
const MAX_WORDS = 8

/**
 * Asks Chrome's built-in model on the device. The `prefix` message makes the
 * model continue the text instead of answering it.
 */
export const builtIn =
	(session: LanguageModelSession, context: string): PredictionFn =>
	async ({ before, after, signal }) => {
		// A fresh clone per request keeps earlier drafts out of the context.
		const request = await session.clone({ signal })

		try {
			const answer = await request.prompt(
				[
					{
						role: "user",
						content: `Field: ${context}\nText after the cursor: <<<${after}>>>\nContinue my text.`,
					},
					// With a trailing space the model answers "" or "\n" most of the time.
					{ role: "assistant", content: before.trimEnd(), prefix: true },
				],
				{ signal },
			)
			// After a finished sentence the model starts a new paragraph; keep it on the line.
			const sameLine = answer.replace(/^\s*\n\s*/, " ")
			// The user ended the word with a space; "We" + "'re" no longer fits.
			const continuesWord = /\s$/.test(before) && /^\S/.test(sameLine)

			if (continuesWord) return ""

			// An ellipsis means the model ran out of words.
			const [text] = sameLine.split(/\.\.\.|…/)
			const clause = /^[^.!?\n]*[.!?]?/.exec(text)?.[0] ?? ""
			const words = clause.split(/(?<=\S)(?=\s)/).slice(0, MAX_WORDS)

			return cleanSuggestion(before, after, words.join(""))
		} finally {
			request.destroy()
		}
	}
