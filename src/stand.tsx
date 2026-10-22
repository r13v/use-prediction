import { useMemo, useRef, useState, version } from "react"

import { usePrediction } from "../lib/use-prediction"
import { FormPleaseDemo } from "./form-please-demo"
import { params, predictFor, predictionsOn } from "./predict"

export const Stand = () => {
	const benchContext = params.get("bench")

	if (benchContext !== null) {
		return <BenchField context={benchContext} />
	}

	return (
		<main>
			<header>
				<h1>use-prediction</h1>
				<p>
					React {version} · suggestions {predictionsOn ? "on" : "off"} · Tab
					accepts, Esc hides
				</p>
			</header>
			<SubjectField />
			<ControlledField />
			<FormPleaseDemo />
			<DialogField />
		</main>
	)
}

const SubjectField = () => {
	const prediction = usePrediction({ get: predictFor("Email subject") })

	return (
		<section>
			<h2>Uncontrolled input</h2>
			<input
				aria-label="Subject"
				data-testid="subject"
				maxLength={80}
				placeholder="Email subject"
				ref={predictionsOn ? prediction.ref : undefined}
			/>
		</section>
	)
}

/** A controlled textarea with a UI-kit style hint built from the hook state. */
const ControlledField = () => {
	const [value, setValue] = useState("")
	const [changes, setChanges] = useState(0)
	const prediction = usePrediction({
		get: predictFor("Reply to a customer support ticket"),
		className: "ghost",
		loadingClassName: "loading",
	})

	return (
		<section>
			<h2>Controlled textarea</h2>
			<textarea
				aria-label="Reply"
				data-testid="reply"
				onChange={(event) => {
					setValue(event.target.value)
					setChanges((count) => count + 1)
				}}
				placeholder="Reply to the customer"
				ref={predictionsOn ? prediction.ref : undefined}
				rows={5}
				value={value}
			/>
			<div className="hint">
				<span data-testid="reply-status">{prediction.status}</span>
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
			<output data-testid="reply-state">
				state: {value.length} chars, {changes} onChange
			</output>
			<pre data-testid="reply-value">{value}</pre>
		</section>
	)
}

const DialogField = () => {
	const dialog = useRef<HTMLDialogElement>(null)
	const prediction = usePrediction({ get: predictFor("Meeting note") })

	return (
		<section>
			<h2>Inside a modal dialog</h2>
			<button onClick={() => dialog.current?.showModal()} type="button">
				Open dialog
			</button>
			<dialog ref={dialog}>
				<input
					aria-label="Note"
					data-testid="note"
					ref={predictionsOn ? prediction.ref : undefined}
				/>
				<form method="dialog">
					<button type="submit">Close</button>
				</form>
			</dialog>
		</section>
	)
}

/** The single field the comparison script types into. */
const BenchField = ({ context }: { context: string }) => {
	const [value, setValue] = useState("")
	const get = useMemo(() => {
		const predict = predictFor(context)
		const latencies: number[] = []
		Object.assign(window, { latencies })

		return async (request: Parameters<typeof predict>[0]) => {
			const started = performance.now()
			const suggestion = await predict(request)
			latencies.push(performance.now() - started)

			return suggestion
		}
	}, [context])
	const prediction = usePrediction({ get })

	return (
		<main>
			<label>
				{context}
				<textarea
					data-testid="bench"
					onChange={(event) => setValue(event.target.value)}
					ref={predictionsOn ? prediction.ref : undefined}
					rows={8}
					value={value}
				/>
			</label>
			<span data-testid="bench-status">{prediction.status}</span>
			<span data-testid="bench-suggestion">{prediction.suggestion}</span>
		</main>
	)
}
