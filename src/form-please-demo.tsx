import { type ControlProps, createFormKit, defineControl } from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useState } from "react"
import { z } from "zod"

import { usePrediction } from "../lib/use-prediction"
import { predictFor, predictionsOn } from "./predict"

interface PredictedTextareaProps {
	/** What the field is for; sent to the model. */
	readonly context: string
	readonly rows?: number
}

/** A form-please control: the native textarea plus one hook and a merged ref. */
const PredictedTextarea = ({
	value,
	setValue,
	blur,
	input,
	meta,
	props,
	disabled,
	readOnly,
	required,
}: ControlProps<string | undefined, PredictedTextareaProps>) => {
	const prediction = usePrediction({ get: predictFor(props.context) })

	return (
		<textarea
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			disabled={disabled}
			id={input.id}
			name={input.name}
			onBlur={blur}
			onChange={(event) => setValue(event.currentTarget.value)}
			readOnly={readOnly}
			ref={(node) => {
				if (predictionsOn) {
					prediction.ref(node)
				}

				input.ref(node)
			}}
			required={required}
			rows={props.rows}
			value={value ?? ""}
		/>
	)
}

const kit = createFormKit({
	controls: {
		...createNativeControls(),
		predictedTextarea: defineControl<
			string | undefined,
			PredictedTextareaProps
		>({ component: PredictedTextarea }),
	},
	slots: createDefaultSlots(),
})

const proposalSchema = z.object({
	title: z.string().min(1, "Enter a title"),
	summary: z.string().min(20, "Write at least 20 characters"),
})

const proposalForm = kit.defineForm(proposalSchema, (ui) => [
	ui.field("title", { control: "text", label: "Project title" }),
	ui.field("summary", {
		control: "predictedTextarea",
		label: "Project summary",
		props: { context: "Grant application: project summary", rows: 4 },
	}),
])

export const FormPleaseDemo = () => {
	const [submitted, setSubmitted] = useState<unknown>(null)
	const form = kit.useForm(proposalForm, {
		defaultValues: { title: "", summary: "" },
		onSubmit({ value }) {
			setSubmitted(value)
		},
	})

	return (
		<section>
			<h2>form-please + React Hook Form</h2>
			<kit.AutoForm form={form}>
				<kit.Submit>Submit</kit.Submit>
			</kit.AutoForm>
			{submitted !== null && (
				<pre data-testid="submitted">{JSON.stringify(submitted)}</pre>
			)}
		</section>
	)
}
