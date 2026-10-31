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

import { cleanSuggestion } from "./clean-suggestion"

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

const DEFAULT_MODEL = "gpt-6-luna"
// Enough context for the current paragraph, with a bounded price per request.
const MAX_BEFORE_CHARS = 2000
const MAX_AFTER_CHARS = 500
// A suggestion runs to the end of a clause, so a few words are enough.
const MAX_SUGGESTION_TOKENS = 40

let client: OpenAI | undefined

const getClient = () => {
	client ??= new OpenAI({
		baseURL: withApiPath(process.env.LLM_BASE_URL),
		apiKey: process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY,
	})

	return client
}

const withApiPath = (url: string | undefined) => {
	if (!url) {
		return url
	}

	const bareOrigin = new URL(url).pathname === "/"

	return bareOrigin ? new URL("/v1", url).href : url
}

export async function predict(body: PredictionBody, signal?: AbortSignal) {
	const before = body.before.slice(-MAX_BEFORE_CHARS)
	const after = body.after.slice(0, MAX_AFTER_CHARS)
	const field = body.context ? `Field: ${body.context}` : ""

	const response = await getClient().responses.create(
		{
			model: process.env.LLM_MODEL ?? DEFAULT_MODEL,
			instructions: INSTRUCTIONS,
			input: [
				field,
				`Text before the cursor:\n<<<${before}>>>`,
				`Text after the cursor:\n<<<${after}>>>`,
			]
				.filter(Boolean)
				.join("\n\n"),
			max_output_tokens: MAX_SUGGESTION_TOKENS,
			reasoning: { effort: "none" },
			store: false,
		},
		{ signal },
	)

	return cleanSuggestion(before, after, response.output_text)
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
