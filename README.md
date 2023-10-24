# use-prediction

It is like a Copilot for your input fields.

## Installation

```bash
npm install use-prediction
```

## Usage

```tsx
import { usePrediction } from "use-prediction"

const Example = () => {
  const prediction = usePrediction({ get: getOpenAICompletion })

  return (
    <div>
      <input ref={prediction.ref} />
    </div>
  )
}

function getOpenAICompletion(text: string, controller: AbortController) {
  return fetch("https://api.openai.com/v1/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_TOKEN}`,
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
    .then((res) => res.json())
    .then((data) => data.choices[0].text)
}
```
