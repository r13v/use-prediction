import { PredictionFn, usePrediction } from "../lib/use-prediction"

let n = 0

const getLocal: PredictionFn = async (_, controller) => {
  n += 1

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(` ${n}`)
      n = 0
    }, 1000)

    controller.signal.addEventListener("abort", () => {
      clearTimeout(timeout)
      reject(controller.signal.reason ?? new Error("Aborted"))
    })
  })
}

const getOpenAI: PredictionFn = async (text, controller) => {
  if (!text) {
    return ""
  }

  const response = await fetch("https://api.openai.com/v1/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_TOKEN}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo-instruct",
      prompt: text,
      temperature: 0,
      max_tokens: 5,
      top_p: 1,
    }),
    signal: controller.signal,
  })

  if (!response.ok) {
    throw new Error(response.statusText)
  }

  const data = await response.json()
  const prediction = data.choices[0].text

  return prediction
}

export const Example = () => {
  const inputP = usePrediction({ get: getLocal, color: "orange" })

  const textAreaP = usePrediction({ get: getOpenAI, debounce: 1000 })

  return (
    <div>
      <h2>Input</h2>
      <input ref={inputP.ref} style={{ width: 300, padding: 20 }} type="text" />

      <h2>Textarea</h2>
      <textarea ref={textAreaP.ref} style={{ width: 300, padding: 20 }} />
    </div>
  )
}
