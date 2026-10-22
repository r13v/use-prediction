import type { PredictionFn } from "../lib/use-prediction"

export const params = new URLSearchParams(window.location.search)
// ?predict=off renders the same fields without suggestions (the baseline for comparison).
export const predictionsOn = params.get("predict") !== "off"

/** Calls the example server (examples/server.ts); `context` tells the model what the field is for. */
export const predictFor =
	(context: string): PredictionFn =>
	async ({ before, after, signal }) => {
		const response = await fetch("/api/predict", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ before, after, context }),
			signal,
		})

		if (!response.ok) {
			throw new Error(`Prediction failed: ${response.status}`)
		}

		const data = (await response.json()) as { suggestion: string }

		return data.suggestion
	}
