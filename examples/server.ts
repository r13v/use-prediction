/**
 * Prediction endpoint for usePrediction, built on the OpenAI SDK.
 *
 * POST { before, after, context? } -> { suggestion }
 *
 * The API key stays on the server. Any OpenAI-compatible API works:
 *   LLM_BASE_URL  (default: https://api.openai.com/v1; a bare origin gets /v1)
 *   LLM_API_KEY   (default: OPENAI_API_KEY)
 *   LLM_MODEL     (default: gpt-6-luna)
 */
import type { IncomingMessage, ServerResponse } from "node:http"

import OpenAI from "openai"

const INSTRUCTIONS = `You suggest the next words while a person types into a form field.
Reply with only the text to insert at the cursor, with no quotes or explanations.
- Continue the person's own sentence in their language and tone; never repeat text that is already there.
- Suggest the most predictable words only, up to the end of the current clause (usually 2-8 words).
- Never invent specifics the person has not written: names, numbers, dates, prices, or outcomes. Stop before them.
- If the cursor is inside a word, complete that word first.
- Start with a space when the suggestion starts a new word.
- End with a space when the text after the cursor starts a new word.
- The text after the cursor stays in the field after your suggestion. Never repeat it: write only the words that go between, so they run into that text.
- When you have no confident suggestion, reply with nothing at all: zero characters, no placeholder.`

export interface PredictionBody {
	before: string
	after: string
	/** What the field is for, such as its label; it helps the model. */
	context?: string
}

let client: OpenAI | undefined

const getClient = () => {
	client ??= new OpenAI({
		baseURL: withApiPath(process.env.LLM_BASE_URL),
		apiKey: process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY,
	})

	return client
}

const withApiPath = (url: string | undefined) =>
	url && new URL(url).pathname === "/" ? new URL("/v1", url).href : url

export async function predict(body: PredictionBody, signal?: AbortSignal) {
	const before = body.before.slice(-2000)
	const after = body.after.slice(0, 500)

	const response = await getClient().responses.create(
		{
			model: process.env.LLM_MODEL ?? "gpt-6-luna",
			instructions: INSTRUCTIONS,
			input: [
				body.context ? `Field: ${body.context}` : "",
				`Text before the cursor:\n<<<${before}>>>`,
				`Text after the cursor:\n<<<${after}>>>`,
			]
				.filter(Boolean)
				.join("\n\n"),
			max_output_tokens: 40,
			reasoning: { effort: "none" },
			store: false,
		},
		{ signal },
	)

	return cleanSuggestion(before, after, response.output_text)
}

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

	if (
		/^[_*<[(]+\s*(empty|none|no suggestion)\s*[_*>\])]+$/i.test(result.trim())
	) {
		return ""
	}

	result = cutRepeat(result, after)

	if (/\s$/.test(before) || before === "") {
		result = result.trimStart()
	}

	// A caret inside a word: the suggestion fills the middle of that word.
	if (/[\p{L}\p{N}]$/u.test(before) && /^[\p{L}\p{N}]/u.test(after)) {
		return result
	}

	result = result.trimEnd()

	// Keep the suggestion apart from a word or an opening bracket after the caret.
	if (/^[\p{L}\p{N}([]/u.test(after) && /[\p{L}\p{N},.;:!?)]$/u.test(result)) {
		result += " "
	}

	return result
}

/**
 * Cuts the suggestion where it starts to repeat the text after the cursor:
 * that text stays in the field, so the repeat would show twice.
 */
const cutRepeat = (suggestion: string, after: string) => {
	// The first words after the cursor; a shorter match is too likely by chance.
	const head = /^\S+(?:\s+\S+){0,2}/.exec(after.trimStart())?.[0]

	if (!head || head.length < 4) {
		return suggestion
	}

	const escaped = head.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")
	const repeat = new RegExp(`(?:^|\\s)${escaped}`).exec(suggestion)

	return repeat ? suggestion.slice(0, repeat.index) : suggestion
}

/** Node `http` handler; also works as Connect or Express middleware. */
export async function handlePrediction(
	req: IncomingMessage,
	res: ServerResponse,
) {
	if (req.method !== "POST") {
		res.writeHead(405).end()
		return
	}

	const controller = new AbortController()

	// The browser aborts stale requests; stop paying for them too.
	res.on("close", () => {
		if (!res.writableEnded) {
			controller.abort()
		}
	})

	try {
		let raw = ""

		for await (const chunk of req) {
			raw += chunk
		}

		const body = JSON.parse(raw) as Partial<PredictionBody>

		if (typeof body.before !== "string" || typeof body.after !== "string") {
			res.writeHead(400).end()
			return
		}

		const suggestion = await predict(
			{
				before: body.before,
				after: body.after,
				context: typeof body.context === "string" ? body.context : undefined,
			},
			controller.signal,
		)

		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(JSON.stringify({ suggestion }))
	} catch (error) {
		if (controller.signal.aborted) {
			return
		}

		console.error("prediction failed", error)
		res.writeHead(502).end()
	}
}
