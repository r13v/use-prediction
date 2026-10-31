import { useEffect, useRef, useState } from "react"

import { type PredictionFn, usePrediction } from "../lib/use-prediction"
import {
	builtIn,
	builtInAvailability,
	createBuiltInSession,
	type LanguageModelSession,
	scripted,
} from "./sources"

const BODY_CONTEXT = "Reply to a customer support ticket"
const BODY_PHRASES = [
	"Thanks for the detailed report!",
	"I reproduced the crash on the latest version and pushed a fix.",
	"It ships in the next release, and I will let you know when it is live.",
	"We are sorry for the trouble this caused your team.",
	"Could you send us the logs from the last run?",
]
const BODY_START = "Hi Anna,\n\n"
const SUBJECT_CONTEXT = "Email subject"
const SUBJECT_PHRASES = [
	"Quick question about the invoice for March",
	"Follow-up on our call yesterday",
	"Weekly status update for the design team",
]
const STARTERS = [
	{ text: "Thanks for", field: "body" },
	{ text: "Could you", field: "body" },
	{ text: "Quick", field: "subject" },
	{ text: "Follow", field: "subject" },
] as const

type Model =
	| { state: "checking" | "unavailable" | "failed" }
	| { state: "off"; downloaded: boolean }
	| { state: "downloading"; progress: number }
	| { state: "ready"; session: LanguageModelSession }

/** An email composer: scripted answers everywhere, Chrome's built-in model on request. */
export const Demo = () => {
	const [model, setModel] = useState<Model>({ state: "checking" })
	const [useModel, setUseModel] = useState(false)
	const [body, setBody] = useState(BODY_START)
	const [error, setError] = useState("")
	const fields = useRef<Record<"body" | "subject", HTMLElement | null>>({
		body: null,
		subject: null,
	})

	useEffect(() => {
		void builtInAvailability().then((availability) => {
			const model: Model =
				availability === "unavailable"
					? { state: "unavailable" }
					: { state: "off", downloaded: availability === "available" }

			setModel(model)
		})
	}, [])

	const startModel = async () => {
		setUseModel(true)
		setModel({ state: "downloading", progress: 0 })

		try {
			const session = await createBuiltInSession((progress) => {
				setModel({ state: "downloading", progress })
			})
			setModel({ state: "ready", session })
		} catch (error) {
			console.error(error)
			setModel({ state: "failed" })
			setUseModel(false)
		}
	}

	const sourceFor = (context: string, phrases: string[]): PredictionFn => {
		const modelOn = useModel && model.state === "ready"

		return modelOn ? builtIn(model.session, context) : scripted(phrases)
	}

	const onError = (failure: unknown) => {
		console.error(failure)
		setError(failure instanceof Error ? failure.message : String(failure))
	}

	const subject = usePrediction({
		get: sourceFor(SUBJECT_CONTEXT, SUBJECT_PHRASES),
		onError,
	})
	const message = usePrediction({
		get: sourceFor(BODY_CONTEXT, BODY_PHRASES),
		onError,
	})
	const active = [message, subject].find((prediction) => prediction.suggestion)
	const loading = [message, subject].some(
		(prediction) => prediction.status === "loading",
	)

	useEffect(() => {
		if (loading) setError("")
	}, [loading])

	/** Types the start of a phrase as the user would, so the hook sees an input event. */
	const typeStarter = (field: "body" | "subject", text: string) => {
		const element = fields.current[field] as HTMLInputElement | null

		if (!element) return

		element.focus()
		element.setSelectionRange(element.value.length, element.value.length)

		const separator = /(^|\s)$/.test(element.value) ? "" : " "
		document.execCommand("insertText", false, separator + text)
	}

	const chooseModel = () => {
		if (model.state === "ready") {
			setUseModel(true)
		} else {
			void startModel()
		}
	}

	const modelBlocked =
		model.state === "unavailable" ||
		model.state === "checking" ||
		model.state === "downloading"

	return (
		<section aria-label="Live demo" className="demo">
			<div className="window">
				<div className="window-bar">
					<span className="window-title">New message</span>
					<fieldset aria-label="Suggestions from" className="segmented">
						<button
							aria-pressed={!useModel}
							onClick={() => setUseModel(false)}
							type="button"
						>
							Scripted
						</button>
						<button
							aria-pressed={useModel}
							disabled={modelBlocked && !useModel}
							onClick={chooseModel}
							title={modelNote(model)}
							type="button"
						>
							Chrome AI
						</button>
					</fieldset>
				</div>

				<div className="row">
					<span className="row-label">To</span>
					<span className="recipient">anna@acme.dev</span>
				</div>
				<div className="row">
					<label className="row-label" htmlFor="demo-subject">
						Subject
					</label>
					<input
						autoComplete="off"
						id="demo-subject"
						ref={(node) => {
							fields.current.subject = node
							subject.ref(node)
						}}
						spellCheck={false}
					/>
				</div>
				<textarea
					aria-label="Message"
					onChange={(event) => setBody(event.target.value)}
					ref={(node) => {
						fields.current.body = node
						message.ref(node)
					}}
					rows={7}
					spellCheck={false}
					value={body}
				/>

				<div className="window-foot">
					<div className="starters">
						<span>Try</span>
						{STARTERS.map(({ text, field }) => (
							<button
								key={text}
								onClick={() => typeStarter(field, text)}
								type="button"
							>
								{text}…
							</button>
						))}
					</div>
					<div className="state" data-state={stateOf(error, active, loading)}>
						<span aria-hidden="true" className="dot" />
						<span className="state-label">
							{stateLabel(error, active, loading)}
						</span>
						{active && (
							<button
								className="accept"
								// Keep focus in the field, or blur would hide the suggestion first.
								onPointerDown={(event) => event.preventDefault()}
								onClick={active.accept}
								type="button"
							>
								Accept <kbd>Tab</kbd>
							</button>
						)}
					</div>
				</div>
			</div>

			<p className="demo-note">
				<span>{useModel ? modelNote(model) : SCRIPTED_NOTE}</span>
				<span className="keys">
					<kbd>Tab</kbd> accept · <kbd>⌘/Ctrl</kbd>
					<kbd>→</kbd> one word · <kbd>Esc</kbd> hide
				</span>
			</p>
		</section>
	)
}

const SCRIPTED_NOTE =
	"Scripted answers from a fixed list: no model, no network. Switch to Chrome AI for real suggestions."

const modelNote = (model: Model) => {
	switch (model.state) {
		case "checking":
			return "Checking for Chrome's built-in model…"
		case "unavailable":
			return "Chrome AI needs desktop Chrome 148+ with the on-device model."
		case "off":
			return model.downloaded
				? "Chrome's on-device model is ready to use."
				: "Chrome AI downloads the on-device model on first use."
		case "downloading":
			return `Downloading the on-device model… ${Math.round(model.progress * 100)}%`
		case "ready":
			return "Chrome's on-device model: nothing leaves your browser."
		case "failed":
			return "Chrome's model did not start. See the console for details."
	}
}

type Active = { suggestion: string } | undefined

const stateOf = (error: string, active: Active, loading: boolean) => {
	if (error) return "error"
	if (active) return "ready"
	if (loading) return "loading"

	return "idle"
}

const stateLabel = (error: string, active: Active, loading: boolean) => {
	if (error) return `Error: ${error}`
	if (active) return "Suggestion ready"
	if (loading) return "Thinking…"

	return "Type, or pick a phrase"
}
