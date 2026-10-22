import { expect, type Page, type Route, test } from "@playwright/test"

interface Body {
	before: string
	after: string
}

// Slow enough to see the loading indicator before the answer arrives.
const SLOW_ANSWER_MS = 800
// Browsers round layout positions differently, below a pixel.
const CARET_TOLERANCE_PX = 1

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Answers /api/predict from a table; counts the requests that reach it. */
const mockPredictions = async (
	page: Page,
	suggest: (body: Body) => string,
	delay = 0,
) => {
	const requests: Body[] = []

	const answer = async (route: Route) => {
		const body = route.request().postDataJSON() as Body
		requests.push(body)

		if (delay) {
			await sleep(delay)
		}

		// The test may end or navigate during the delay; the route is gone then.
		await route.fulfill({ json: { suggestion: suggest(body) } }).catch(() => {})
	}

	await page.route("**/api/predict", answer)

	return requests
}

// The overlay also holds the loading indicator; a ghost is an overlay without it.
const ghost = (page: Page) =>
	page.locator("[data-use-prediction]:not(:has([data-use-prediction-loading]))")

test("accepting goes through onChange and undo restores React state", async ({
	page,
	browserName,
}) => {
	await mockPredictions(page, ({ before }) =>
		before.endsWith("Hi Anna,") ? " thanks for writing to us." : "",
	)
	await page.goto("/")
	const reply = page.getByTestId("reply")

	await reply.pressSequentially("Hi Anna,")
	await expect(ghost(page)).toHaveText("Hi Anna, thanks for writing to us.")
	await expect(page.getByTestId("reply-state")).toHaveText(
		"state: 8 chars, 8 onChange",
	)

	await reply.press("Tab")
	await expect(reply).toBeFocused()
	await expect(ghost(page)).toHaveCount(0)
	await expect(page.getByTestId("reply-value")).toHaveText(
		"Hi Anna, thanks for writing to us.",
	)
	await expect(page.getByTestId("reply-state")).toHaveText(
		"state: 34 chars, 9 onChange",
	)

	await reply.press("ControlOrMeta+z")
	// WebKit may merge the suggestion into the preceding typing run and undo both.
	const undone = browserName === "webkit" ? ["Hi Anna,", ""] : ["Hi Anna,"]

	await expect.poll(() => reply.inputValue()).not.toContain("thanks")
	expect(undone).toContain(await reply.inputValue())
	await expect(page.getByTestId("reply-value")).toHaveText(
		await reply.inputValue(),
	)
})

test("typing through the ghost shortens it without new requests", async ({
	page,
}) => {
	const requests = await mockPredictions(page, ({ before }) =>
		before === "Hello" ? " there, friend" : "",
	)
	await page.goto("/")
	const reply = page.getByTestId("reply")

	await reply.pressSequentially("Hello")
	await expect(ghost(page)).toHaveText("Hello there, friend")
	await reply.pressSequentially(" the")
	await expect(page.getByTestId("reply-status")).toHaveText("ready")
	await expect(ghost(page)).toHaveText("Hello there, friend")

	expect(requests).toHaveLength(1)
	await reply.press("Tab")
	await expect(reply).toHaveValue("Hello there, friend")
})

test("Tab moves focus when no suggestion is shown", async ({ page }) => {
	await mockPredictions(page, () => "")
	await page.goto("/")

	await page.getByTestId("subject").fill("Quarterly report")
	await page.getByTestId("subject").press("Tab")

	await expect(page.getByTestId("reply")).toBeFocused()
})

test("suggests in the middle of the text", async ({ page }) => {
	await mockPredictions(page, ({ after }) => (after === " world" ? " big" : ""))
	await page.goto("/")
	const reply = page.getByTestId("reply")

	await reply.fill("Hello world")
	for (const _ of " world") {
		await reply.press("ArrowLeft")
	}

	// Caret moves alone don't request; an edit does.
	await reply.pressSequentially("!")
	await reply.press("Backspace")

	await expect(ghost(page)).toHaveText("Hello big world")
	await reply.press("Tab")
	await expect(reply).toHaveValue("Hello big world")
	await expect(page.getByTestId("reply-value")).toHaveText("Hello big world")
})

test("the ghost follows textarea and page scroll", async ({ page }) => {
	await mockPredictions(page, () => " and so on")
	await page.setViewportSize({ width: 800, height: 400 })
	await page.goto("/")
	const reply = page.getByTestId("reply")

	// content-box: the overlay must still match the field's outer size.
	await reply.evaluate((node) => {
		node.style.boxSizing = "content-box"
		node.style.width = "300px"
	})
	// More lines than the field shows, so that it scrolls.
	const lines = Array.from({ length: 30 }, (_, index) => `line ${index}`)
	await reply.fill(lines.join("\n"))
	await reply.pressSequentially(".")
	await expect(ghost(page)).toBeVisible()

	const offsets = async () =>
		page.evaluate(() => {
			const field = document.querySelector("[data-testid=reply]") as Element
			const overlay = document.querySelector("[data-use-prediction]") as Element
			const a = field.getBoundingClientRect()
			const b = overlay.getBoundingClientRect()

			return {
				top: Math.round(b.top - a.top),
				left: Math.round(b.left - a.left),
				width: Math.round(b.width - a.width),
				height: Math.round(b.height - a.height),
				scroll: overlay.scrollTop - field.scrollTop,
				fieldScroll: field.scrollTop,
			}
		})

	expect(await offsets()).toMatchObject({
		top: 0,
		left: 0,
		width: 0,
		height: 0,
		scroll: 0,
	})
	expect((await offsets()).fieldScroll).toBeGreaterThan(0)

	await page.mouse.wheel(0, 60)
	await expect.poll(offsets).toMatchObject({ top: 0, left: 0, scroll: 0 })
})

test("works as a form-please control", async ({ page }) => {
	await mockPredictions(page, ({ before }) =>
		before.endsWith("We will build") ? " a community repair café." : "",
	)
	await page.goto("/")

	await page.getByLabel("Project title").fill("Repair café")
	const summary = page.getByLabel("Project summary")
	await summary.pressSequentially("We will build")
	await expect(ghost(page)).toBeVisible()
	await summary.press("Tab")
	await page.getByRole("button", { name: "Submit" }).click()

	await expect(page.getByTestId("submitted")).toHaveText(
		JSON.stringify({
			title: "Repair café",
			summary: "We will build a community repair café.",
		}),
	)
})

test("Escape in a modal dialog hides the ghost before it closes the dialog", async ({
	page,
}) => {
	await mockPredictions(page, () => " with the design team")
	await page.goto("/")
	await page.getByRole("button", { name: "Open dialog" }).click()
	const note = page.getByTestId("note")

	await note.pressSequentially("Sync")
	await expect(ghost(page)).toBeVisible()
	expect(
		await ghost(page).evaluate((node) => node.parentElement?.tagName),
	).toBe("DIALOG")

	await note.press("Escape")
	await expect(ghost(page)).toHaveCount(0)
	await expect(page.locator("dialog")).toBeVisible()

	await note.press("Escape")
	await expect(page.locator("dialog")).toBeHidden()
})

test("Ctrl/Cmd+Right accepts one word at a time", async ({ page }) => {
	const requests = await mockPredictions(page, ({ before }) =>
		before === "Thanks" ? " for the quick reply" : "",
	)
	await page.goto("/")
	const reply = page.getByTestId("reply")

	await reply.pressSequentially("Thanks")
	await expect(ghost(page)).toHaveText("Thanks for the quick reply")
	await reply.press("ControlOrMeta+ArrowRight")
	await reply.press("ControlOrMeta+ArrowRight")

	await expect(reply).toHaveValue("Thanks for the")
	await expect(page.getByTestId("reply-value")).toHaveText("Thanks for the")
	await expect(ghost(page)).toHaveText("Thanks for the quick reply")
	expect(requests).toHaveLength(1)
})

test("a loading indicator stands at the caret until the answer comes", async ({
	page,
}) => {
	await mockPredictions(page, () => " for Q3", SLOW_ANSWER_MS)
	await page.goto("/")
	const subject = page.getByTestId("subject")
	const indicator = page.locator("[data-use-prediction-loading] > span")

	await subject.pressSequentially("Quarterly report")
	await expect(indicator).toBeVisible()

	// The indicator starts where the typed text ends.
	const caretX = await page.evaluate(() => {
		const before = document.querySelector("[data-use-prediction] span") as Node
		const range = document.createRange()
		range.selectNodeContents(before)

		return range.getBoundingClientRect().right
	})
	const box = await indicator.boundingBox()

	if (!box) {
		throw new Error("The loading indicator has no box")
	}

	expect(Math.abs(box.x - caretX)).toBeLessThan(CARET_TOLERANCE_PX)

	await expect(ghost(page)).toHaveText("Quarterly report for Q3")
	await expect(indicator).toHaveCount(0)
})

test("loadingClassName replaces the built-in indicator", async ({ page }) => {
	await mockPredictions(page, () => " soon", SLOW_ANSWER_MS)
	await page.goto("/")

	await page.getByTestId("reply").pressSequentially("See you")
	await expect(
		page.locator("[data-use-prediction-loading] > span.loading"),
	).toBeVisible()
})
