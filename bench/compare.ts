/* eslint-disable no-console -- a command-line report */
/**
 * Compares typing with and without suggestions on the stand's bench page.
 *
 * A simulated user types each task's target text at a fixed rhythm against
 * the real model, accepts a suggestion only when it matches what they mean
 * to write, and pays a reading cost for every new suggestion they see.
 *
 *   npx vite --port 5180 &   # with LLM_* in .env.local
 *   npx tsx bench/compare.ts [--split=held-out|tune|all] [--conditions=tab,word]
 */
import { writeFile } from "node:fs/promises"

import { chromium, Page } from "@playwright/test"

import { Task, tasks } from "./tasks"

const BASE_URL = process.env.BENCH_URL ?? "http://localhost:5180"

// About 45 words per minute with pauses where people pause.
const KEY_MS = 220
const WORD_PAUSE_MS = 250
const COMMA_PAUSE_MS = 400
const SENTENCE_PAUSE_MS = 1200
// Reading a new suggestion to decide whether it fits.
const GLANCE_MS = 300

type Condition = "tab" | "word"

interface Result {
  task: string
  split: Task["split"]
  condition: Condition | "off"
  chars: number
  keystrokes: number
  ms: number
  shown: number
  accepted: number
  acceptedChars: number
  latencies: number[]
  /** Each new suggestion and the target position where it appeared. */
  suggestions: { at: number; text: string }[]
  correct: boolean
}

const pauseAfter = (char: string) => {
  if (".!?".includes(char)) {
    return SENTENCE_PAUSE_MS
  }

  if (",;:".includes(char)) {
    return COMMA_PAUSE_MS
  }

  return char === " " ? WORD_PAUSE_MS : 0
}

/** Time to type the whole target by hand: no page needed. */
const typeByHand = (task: Task): Result => {
  let ms = 0

  for (const char of task.target) {
    ms += KEY_MS + pauseAfter(char)
  }

  return {
    task: task.id,
    split: task.split,
    condition: "off",
    chars: task.target.length,
    keystrokes: task.target.length,
    ms,
    shown: 0,
    accepted: 0,
    acceptedChars: 0,
    latencies: [],
    suggestions: [],
    correct: true,
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The words at the start of `suggestion` that match `rest`, whole words only. */
const matchingWords = (suggestion: string, rest: string) => {
  const words = suggestion.match(/\s*\S+/g) ?? []
  let prefix = ""
  let count = 0

  for (const word of words) {
    if (!rest.startsWith(prefix + word)) {
      break
    }

    prefix += word
    count += 1
  }

  return { prefix, count }
}

const runTask = async (
  page: Page,
  task: Task,
  condition: Condition,
): Promise<Result> => {
  const query = new URLSearchParams({ bench: task.context })

  await page.goto(`${BASE_URL}/?${query}`)
  const field = page.getByTestId("bench")
  await field.click()

  const target = task.target
  const started = Date.now()
  // Modeled time: keys, pauses, and reading. The run is paced in real time so
  // the model's real latency decides when suggestions arrive.
  let ms = 0
  const suggestions: Result["suggestions"] = []
  let keystrokes = 0
  let shown = 0
  let accepted = 0
  let acceptedChars = 0
  let lastSeen = ""

  for (;;) {
    // The overlay is the ghost the user sees; React state follows a moment later.
    const { value, suggestion, focused } = await page.evaluate(() => {
      const field = document.querySelector<HTMLTextAreaElement>(
        "[data-testid=bench]",
      )!

      return {
        value: field.value,
        suggestion:
          document.querySelector("[data-use-prediction] span:nth-child(2)")
            ?.textContent ?? "",
        focused: document.activeElement === field,
      }
    })

    if (
      value.length >= target.length ||
      !target.startsWith(value) ||
      Date.now() - started > 5 * typeByHand(task).ms
    ) {
      break
    }

    if (!focused) {
      throw new Error(`${condition} ${task.id}: the field lost focus`)
    }

    const rest = target.slice(value.length)

    // A suggestion that only shortened as the user typed it is not new.
    if (suggestion && !lastSeen.endsWith(suggestion)) {
      shown += 1
      ms += GLANCE_MS
      suggestions.push({ at: value.length, text: suggestion })
      await sleep(GLANCE_MS)
    }

    lastSeen = suggestion

    if (suggestion && rest.startsWith(suggestion)) {
      await page.keyboard.press("Tab")
      keystrokes += 1
      ms += KEY_MS
      accepted += 1
      acceptedChars += suggestion.length
      lastSeen = ""
      continue
    }

    if (condition === "word" && suggestion) {
      const { prefix, count } = matchingWords(suggestion, rest)

      if (count > 0) {
        // One Ctrl+Right per word.
        await page.keyboard.insertText(prefix)
        keystrokes += count
        ms += count * KEY_MS
        accepted += 1
        acceptedChars += prefix.length
        continue
      }
    }

    const char = rest[0]
    await page.keyboard.type(char)
    keystrokes += 1
    ms += KEY_MS + pauseAfter(char)
    await sleep(KEY_MS - 30 + pauseAfter(char))
  }

  const value = await field.inputValue()
  const latencies = await page.evaluate(
    () => (window as unknown as { latencies: number[] }).latencies,
  )

  return {
    task: task.id,
    split: task.split,
    condition,
    chars: target.length,
    keystrokes,
    ms,
    shown,
    accepted,
    acceptedChars,
    latencies,
    suggestions,
    correct: value === target,
  }
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)

  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]
}

const summarize = (results: Result[]) => {
  const rows = ["off", "tab", "word"].flatMap((condition) => {
    const group = results.filter((result) => result.condition === condition)

    if (group.length === 0) {
      return []
    }

    const sum = (key: "chars" | "keystrokes" | "ms" | "shown" | "accepted") =>
      group.reduce((total, result) => total + result[key], 0)
    const offMs = results
      .filter((result) => result.condition === "off")
      .filter((result) => group.some((other) => other.task === result.task))
      .reduce((total, result) => total + result.ms, 0)
    const shown = sum("shown")

    return [
      {
        condition,
        tasks: group.length,
        ksr: 1 - sum("keystrokes") / sum("chars"),
        timeSaved: 1 - sum("ms") / offMs,
        shown,
        accepted: sum("accepted"),
        wasted: shown === 0 ? 0 : 1 - sum("accepted") / shown,
        medianLatency: median(group.flatMap((result) => result.latencies)),
        allCorrect: group.every((result) => result.correct),
      },
    ]
  })

  const percent = (value: number) => `${(value * 100).toFixed(1)}%`

  return [
    "| condition | tasks | KSR | time saved | shown | accepted | wasted | median latency |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.condition} | ${row.tasks} | ${percent(row.ksr)} | ${percent(row.timeSaved)} | ${row.shown} | ${row.accepted} | ${percent(row.wasted)} | ${Math.round(row.medianLatency)} ms |${row.allCorrect ? "" : " ⚠ text mismatch"}`,
    ),
  ].join("\n")
}

const main = async () => {
  const args = new Map(
    process.argv
      .slice(2)
      .map((arg) => arg.replace(/^--/, "").split("=") as [string, string]),
  )
  const split = args.get("split") ?? "held-out"
  const conditions = (args.get("conditions") ?? "tab,word").split(
    ",",
  ) as Condition[]
  const selected = tasks.filter(
    (task) => split === "all" || task.split === split,
  )

  const browser = await chromium.launch()
  const results: Result[] = selected.map(typeByHand)

  // Conditions run side by side; each types its tasks one after another.
  await Promise.all(
    conditions.map(async (condition) => {
      const page = await browser.newPage()

      for (const task of selected) {
        const result = await runTask(page, task, condition)
        results.push(result)
        console.error(
          `${condition} ${task.id}: ${result.keystrokes}/${result.chars} keys, ${result.accepted}/${result.shown} accepted`,
        )
      }
    }),
  )

  await browser.close()

  const out = `bench/results-${split}.json`
  await writeFile(out, JSON.stringify(results, null, 2))
  console.log(summarize(results))
  console.log(`\nRaw results: ${out}`)
}

await main()
