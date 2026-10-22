import { act, type ReactNode, StrictMode, useState, version } from "react"
// Imported straight from react-dom, so the test runs on whichever React
// version the alias in vite.config.ts selects.
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { type PredictionFn, usePrediction } from "./use-prediction"

// The default debounce of the hook.
const DEBOUNCE_MS = 300

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null

const render = (node: ReactNode) => {
	const container = document.createElement("div")
	document.body.append(container)

	const created = createRoot(container)
	root = created
	act(() => created.render(<StrictMode>{node}</StrictMode>))

	return { unmount: () => act(() => created.unmount()) }
}

const byTestId = <T extends HTMLElement = HTMLElement>(id: string) => {
	const element = document.querySelector<T>(`[data-testid="${id}"]`)

	if (!element) {
		throw new Error(`No element with data-testid="${id}"`)
	}

	return element
}

/** Sets the value the way typing does, so React's onChange runs. */
const typeValue = (field: HTMLTextAreaElement, value: string) => {
	Reflect.set(HTMLTextAreaElement.prototype, "value", value, field)
	field.setSelectionRange(value.length, value.length)
	act(() => {
		field.dispatchEvent(new InputEvent("input", { bubbles: true }))
	})
}

const click = (element: HTMLElement) => act(() => element.click())

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	const mounted = root

	if (mounted) {
		act(() => mounted.unmount())
		root = null
	}

	document.body.innerHTML = ""
	vi.useRealTimers()
})

const ControlledField = ({ get }: { get: PredictionFn }) => {
	const [value, setValue] = useState("")
	const [renders, setRenders] = useState(0)
	const prediction = usePrediction({ get })

	return (
		<>
			<textarea
				data-testid="field"
				onChange={(event) => setValue(event.target.value)}
				// A new ref callback on every render, as in a merged-ref integration.
				ref={(node) => {
					prediction.ref(node)
				}}
				value={value}
			/>
			<output data-testid="state">{value}</output>
			<output data-testid="suggestion">{prediction.suggestion}</output>
			<button
				data-testid="rerender"
				type="button"
				onClick={() => setRenders((count) => count + 1)}
			>
				{renders}
			</button>
		</>
	)
}

it(`syncs an accepted suggestion with controlled state on React ${version}`, async () => {
	const get = vi.fn<PredictionFn>(async () => " world")

	render(<ControlledField get={get} />)

	const field = byTestId<HTMLTextAreaElement>("field")
	field.focus()

	// Re-renders replace the ref callback; listeners must not pile up.
	click(byTestId("rerender"))
	click(byTestId("rerender"))
	await act(() => vi.advanceTimersByTimeAsync(0))

	typeValue(field, "hello")
	await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 1))

	expect(get).toHaveBeenCalledTimes(1)
	expect(byTestId("suggestion").textContent).toBe(" world")

	act(() => {
		field.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Tab",
				bubbles: true,
				cancelable: true,
			}),
		)
	})

	// The controlled onChange ran on the inserted text.
	expect(byTestId("state").textContent).toBe("hello world")
	expect(field.value).toBe("hello world")
	await act(() => vi.advanceTimersByTimeAsync(0))
	expect(byTestId("suggestion").textContent).toBe("")
})

it("drops the ghost when a render replaces the controlled value", async () => {
	let setValue!: (value: string) => void
	const Field = () => {
		const [value, set] = useState("hello world")
		const prediction = usePrediction({ get: async () => " big" })
		setValue = set

		return (
			<textarea
				data-testid="field"
				onChange={(event) => set(event.target.value)}
				ref={prediction.ref}
				value={value}
			/>
		)
	}

	render(<Field />)
	const field = byTestId<HTMLTextAreaElement>("field")
	field.focus()
	field.setSelectionRange(5, 5)
	act(() => {
		field.dispatchEvent(new InputEvent("input", { bubbles: true }))
	})
	await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 1))
	expect(document.querySelector("[data-use-prediction]")?.textContent).toBe(
		"hello big world",
	)

	act(() => setValue("HELLO WORLD"))

	expect(document.querySelector("[data-use-prediction]")).toBeNull()
	expect(field.style.getPropertyValue("-webkit-text-fill-color")).toBe("")
})

it("cleans up the overlay on unmount", async () => {
	const { unmount } = render(<ControlledField get={async () => " world"} />)
	const field = byTestId<HTMLTextAreaElement>("field")
	field.focus()
	typeValue(field, "hello")
	await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS))
	expect(document.querySelector("[data-use-prediction]")).not.toBeNull()

	unmount()
	root = null
	await act(() => vi.advanceTimersByTimeAsync(0))

	expect(document.querySelector("[data-use-prediction]")).toBeNull()
})
