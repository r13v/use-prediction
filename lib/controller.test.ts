import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PredictionController, PredictionOptions } from "./controller"

const deferred = () => {
  let resolve!: (value: string) => void
  const promise = new Promise<string>((done) => {
    resolve = done
  })

  return { promise, resolve }
}

const type = (field: HTMLInputElement | HTMLTextAreaElement, text: string) => {
  const caret = field.selectionStart ?? field.value.length
  field.value = field.value.slice(0, caret) + text + field.value.slice(caret)
  field.setSelectionRange(caret + text.length, caret + text.length)
  field.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text,
    }),
  )
}

const press = (field: Element, key: string) => {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  })
  field.dispatchEvent(event)

  return event
}

const ghost = () => document.querySelector("[data-use-prediction]")

const setup = (
  options: Partial<PredictionOptions> = {},
  field: HTMLInputElement | HTMLTextAreaElement = document.createElement(
    "textarea",
  ),
) => {
  const get = vi.fn<PredictionOptions["get"]>(async () => " world")
  const controller = new PredictionController(() => ({ get, ...options }))
  document.body.append(field)
  controller.ref(field)
  field.focus()

  return { controller, field, get }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ""
})

describe("PredictionController", () => {
  it("requests after the debounce with the text around the caret", async () => {
    const { controller, field, get } = setup()

    type(field, "hello")
    await vi.advanceTimersByTimeAsync(299)
    expect(get).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({ text: "hello", before: "hello", after: "" }),
    )
    expect(controller.getSnapshot()).toEqual({
      status: "ready",
      suggestion: " world",
    })
    expect(ghost()?.textContent).toBe("hello world")
  })

  it("renders model output as text, not markup", async () => {
    const { field } = setup({
      get: async () => '<img src=x onerror="alert(1)">',
    })

    type(field, "<b>hi</b>")
    await vi.advanceTimersByTimeAsync(300)

    expect(ghost()?.querySelector("img, b")).toBeNull()
    expect(ghost()?.textContent).toBe('<b>hi</b><img src=x onerror="alert(1)">')
  })

  it("drops a response after an edit other than typing at the caret", async () => {
    const response = deferred()
    const { controller, field, get } = setup()
    get.mockImplementationOnce(() => response.promise)

    type(field, "hel")
    await vi.advanceTimersByTimeAsync(300)
    const { signal } = get.mock.calls[0][0]
    field.value = "he"
    field.dispatchEvent(
      new InputEvent("input", { inputType: "deleteContentBackward" }),
    )
    response.resolve("lo")
    await vi.advanceTimersByTimeAsync(0)

    expect(signal.aborted).toBe(true)
    expect(ghost()).toBeNull()
    expect(controller.getSnapshot().status).toBe("idle")
  })

  it.each(["during the debounce", "while loading"])(
    "drops the request when the caret moves %s",
    async (phase) => {
      const response = deferred()
      const { field, get } = setup()
      get.mockImplementationOnce(() => response.promise)

      type(field, "hello")
      await vi.advanceTimersByTimeAsync(phase === "while loading" ? 300 : 100)
      field.setSelectionRange(0, 0)
      document.dispatchEvent(new Event("selectionchange"))
      field.setSelectionRange(5, 5)
      document.dispatchEvent(new Event("selectionchange"))
      response.resolve(" world")
      await vi.advanceTimersByTimeAsync(300)

      expect(ghost()).toBeNull()

      if (phase === "while loading") {
        expect(get.mock.calls[0][0].signal.aborted).toBe(true)
      } else {
        expect(get).not.toHaveBeenCalled()
      }
    },
  )

  it("reports a failed request and keeps working", async () => {
    const onError = vi.fn()
    const { controller, field, get } = setup({ onError })
    get.mockRejectedValueOnce(new Error("HTTP 502"))

    type(field, "hello")
    await vi.advanceTimersByTimeAsync(300)

    expect(onError).toHaveBeenCalledWith(new Error("HTTP 502"))
    expect(controller.getSnapshot().status).toBe("idle")

    type(field, "!")
    await vi.advanceTimersByTimeAsync(300)
    expect(controller.getSnapshot().suggestion).toBe(" world")
  })

  it("keeps a request in flight while the user types its first characters", async () => {
    const response = deferred()
    const { controller, field, get } = setup()
    get.mockImplementationOnce(() => response.promise)

    type(field, "hel")
    await vi.advanceTimersByTimeAsync(300)
    type(field, "l")
    response.resolve("lo there")
    await vi.advanceTimersByTimeAsync(1)

    expect(get).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().suggestion).toBe("o there")
    expect(ghost()?.textContent).toBe("hello there")
  })

  it("asks again when the user typed past an answer that no longer fits", async () => {
    const response = deferred()
    const { field, get } = setup()
    get.mockImplementationOnce(() => response.promise)

    type(field, "hel")
    await vi.advanceTimersByTimeAsync(300)
    type(field, "p")
    response.resolve("lo")
    await vi.advanceTimersByTimeAsync(300)

    expect(ghost()?.textContent).toBe("help world")
    expect(get).toHaveBeenLastCalledWith(
      expect.objectContaining({ before: "help" }),
    )
  })

  it.each(["Escape", "blur"])("drops a response after %s", async (action) => {
    const response = deferred()
    const { field, get } = setup()
    get.mockImplementationOnce(() => response.promise)

    type(field, "hello")
    await vi.advanceTimersByTimeAsync(300)

    if (action === "blur") {
      field.blur()
    } else {
      press(field, "Escape")
    }

    response.resolve(" world")
    await vi.advanceTimersByTimeAsync(0)

    expect(ghost()).toBeNull()
  })

  it("shortens the ghost while the user types it", async () => {
    const { controller, field, get } = setup()

    type(field, "hello")
    await vi.advanceTimersByTimeAsync(300)
    type(field, " wo")
    await vi.advanceTimersByTimeAsync(1000)

    expect(get).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().suggestion).toBe("rld")
    expect(ghost()?.textContent).toBe("hello world")
  })

  it("requests again when typing departs from the ghost", async () => {
    const { controller, field, get } = setup()

    type(field, "hello")
    await vi.advanceTimersByTimeAsync(300)
    type(field, "!")

    expect(controller.getSnapshot().suggestion).toBe("")
    await vi.advanceTimersByTimeAsync(300)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it("inserts the ghost on Tab and fires one input event", async () => {
    const { field } = setup()
    const onInput = vi.fn()

    type(field, "hello")
    await vi.advanceTimersByTimeAsync(300)
    field.addEventListener("input", onInput)
    const tab = press(field, "Tab")

    expect(tab.defaultPrevented).toBe(true)
    expect(field.value).toBe("hello world")
    expect(field.selectionStart).toBe(11)
    expect(onInput).toHaveBeenCalledTimes(1)
    expect(ghost()).toBeNull()
  })

  it("inserts the next word on Ctrl+Right and keeps the rest", async () => {
    const { controller, field, get } = setup()
    get.mockResolvedValue(" big wide world")

    type(field, "hello")
    await vi.advanceTimersByTimeAsync(300)
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      ctrlKey: true,
      cancelable: true,
    })
    field.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(field.value).toBe("hello big")
    expect(controller.getSnapshot().suggestion).toBe(" wide world")
    expect(get).toHaveBeenCalledTimes(1)
  })

  it("leaves Tab and Shift+Tab alone when nothing is shown", async () => {
    const { field } = setup()

    expect(press(field, "Tab").defaultPrevented).toBe(false)

    type(field, "hello")
    await vi.advanceTimersByTimeAsync(300)
    const shiftTab = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      cancelable: true,
    })
    field.dispatchEvent(shiftTab)

    expect(shiftTab.defaultPrevented).toBe(false)
  })

  it("hides the ghost on Escape without letting the key through", async () => {
    const { field } = setup()

    type(field, "hello")
    await vi.advanceTimersByTimeAsync(300)

    expect(press(field, "Escape").defaultPrevented).toBe(true)
    expect(ghost()).toBeNull()
    expect(field.value).toBe("hello")
  })

  it("hides the field text behind a mid-text ghost and restores its inline style", async () => {
    const field = document.createElement("textarea")
    field.style.setProperty("-webkit-text-fill-color", "red")
    const { controller } = setup({ get: async () => " big" }, field)

    field.value = "a world"
    field.setSelectionRange(1, 1)
    type(field, "")
    await vi.advanceTimersByTimeAsync(300)

    expect(ghost()?.textContent).toBe("a big world")
    expect(field.style.getPropertyValue("-webkit-text-fill-color")).toBe(
      "transparent",
    )

    controller.dismiss()
    expect(field.style.getPropertyValue("-webkit-text-fill-color")).toBe("red")
  })

  it("keeps an input suggestion to one line and within maxLength", async () => {
    const input = document.createElement("input")
    input.maxLength = 8
    const { controller } = setup({ get: async () => " there\nfriend" }, input)

    type(input, "hi")
    await vi.advanceTimersByTimeAsync(300)

    expect(controller.getSnapshot().suggestion).toBe(" there")

    type(input, "!!")
    await vi.advanceTimersByTimeAsync(300)
    expect(controller.getSnapshot().suggestion).toBe(" the")
  })

  it.each(["password", "email", "number"])(
    "ignores %s inputs",
    async (inputType) => {
      const input = document.createElement("input")
      input.type = inputType
      const { get } = setup({}, input)

      input.value = "secret"
      input.dispatchEvent(new InputEvent("input", { bubbles: true }))
      await vi.advanceTimersByTimeAsync(300)

      expect(get).not.toHaveBeenCalled()
    },
  )

  it("does not request during IME composition", async () => {
    const { field, get } = setup()

    field.value = "ni"
    field.setSelectionRange(2, 2)
    field.dispatchEvent(new CompositionEvent("compositionstart"))
    field.dispatchEvent(new InputEvent("input", { isComposing: true }))
    await vi.advanceTimersByTimeAsync(300)
    expect(get).not.toHaveBeenCalled()

    field.dispatchEvent(new CompositionEvent("compositionend"))
    await vi.advanceTimersByTimeAsync(300)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it("stops listening after the field detaches", async () => {
    const { controller, field, get } = setup()

    type(field, "hello")
    controller.ref(null)
    await vi.advanceTimersByTimeAsync(300)
    type(field, "!")
    await vi.advanceTimersByTimeAsync(300)

    expect(get).not.toHaveBeenCalled()
  })
})
