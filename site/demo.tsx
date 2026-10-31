import { useEffect, useState } from "react"

import { type PredictionFn, usePrediction } from "../lib/use-prediction"
import {
	builtIn,
	builtInAvailability,
	createBuiltInSession,
	type LanguageModelSession,
	scripted,
} from "./sources"

const REPLY_CONTEXT = "Reply to a customer support ticket"
const REPLY_PHRASES = [
	"Thanks for the detailed report!",
	"I reproduced the crash on the latest version and pushed a fix.",
	"It ships in the next release, and I will let you know when it is live.",
	"We are sorry for the trouble this caused your team.",
	"Could you send us the logs from the last run?",
]
const SUBJECT_CONTEXT = "Email subject"
const SUBJECT_PHRASES = [
	"Quick question about the invoice for March",
	"Follow-up on our call yesterday",
	"Weekly status update for the design team",
]

type Model =
	| { state: "checking" | "unavailable" | "failed" }
	| { state: "off"; downloaded: boolean }
	| { state: "downloading"; progress: number }
	| { state: "ready"; session: LanguageModelSession }

/** Scripted answers everywhere; Chrome's built-in model when the visitor turns it on. */
export const Demo = () => {
	const [model, setModel] = useState<Model>({ state: "checking" })
	const [useModel, setUseModel] = useState(false)

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

	return (
		<section aria-label="Live demo" className="demo">
			<div className="source" role="radiogroup" aria-label="Suggestions from">
				<span>Suggestions from</span>
				<label>
					<input
						checked={!useModel}
						name="source"
						onChange={() => setUseModel(false)}
						type="radio"
					/>
					Scripted answers
				</label>
				<label>
					<input
						checked={useModel}
						disabled={
							model.state === "unavailable" || model.state === "checking"
						}
						name="source"
						onChange={() => {
							if (model.state === "ready") {
								setUseModel(true)
							} else {
								void startModel()
							}
						}}
						type="radio"
					/>
					Chrome built-in model
				</label>
				<small>{modelNote(model)}</small>
			</div>

			<ReplyField get={sourceFor(REPLY_CONTEXT, REPLY_PHRASES)} />
			<SubjectField get={sourceFor(SUBJECT_CONTEXT, SUBJECT_PHRASES)} />

			<p className="keys">
				<kbd>Tab</kbd> accepts · <kbd>⌘/Ctrl</kbd> + <kbd>→</kbd> accepts a word
				· <kbd>Esc</kbd> hides
			</p>
		</section>
	)
}

const modelNote = (model: Model) => {
	switch (model.state) {
		case "checking":
			return ""
		case "unavailable":
			return "Needs desktop Chrome 148+ with the on-device model."
		case "off":
			return model.downloaded
				? "Runs on your device."
				: "Runs on your device; the first use downloads the model."
		case "downloading":
			return `Loading the model: ${Math.round(model.progress * 100)}%`
		case "ready":
			return "Runs on your device. Nothing leaves the browser."
		case "failed":
			return "The model did not start; see the console."
	}
}

const ReplyField = ({ get }: { get: PredictionFn }) => {
	const [value, setValue] = useState("Hi Anna,\n\n")
	const prediction = usePrediction({ get })

	return (
		<div className="field">
			<label htmlFor="demo-reply">
				Reply to a customer <span>try “Thanks for” or “Could you”</span>
			</label>
			<textarea
				id="demo-reply"
				onChange={(event) => setValue(event.target.value)}
				ref={prediction.ref}
				rows={5}
				value={value}
			/>
			<div className="status">
				<span>{prediction.status}</span>
				{prediction.suggestion && (
					<button
						// Keep focus in the field, or blur would hide the suggestion first.
						onPointerDown={(event) => event.preventDefault()}
						onClick={prediction.accept}
						type="button"
					>
						Accept <kbd>Tab</kbd>
					</button>
				)}
			</div>
		</div>
	)
}

const SubjectField = ({ get }: { get: PredictionFn }) => {
	const prediction = usePrediction({ get })

	return (
		<div className="field">
			<label htmlFor="demo-subject">
				Email subject <span>try “Quick” or “Follow”</span>
			</label>
			<input id="demo-subject" ref={prediction.ref} />
		</div>
	)
}
