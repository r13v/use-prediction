import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { PredictionController, PredictionOptions } from "./controller"

export type {
  PredictionFn,
  PredictionOptions,
  PredictionRequest,
  PredictionStatus,
} from "./controller"

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * Shows AI suggestions as ghost text in an input or textarea.
 *
 * Pass `ref` to the native element. Tab accepts the suggestion, Escape hides it.
 */
export const usePrediction = (options: PredictionOptions) => {
  const optionsRef = useRef(options)

  useIsomorphicLayoutEffect(() => {
    optionsRef.current = options
  })

  const [controller] = useState(
    () => new PredictionController(() => optionsRef.current),
  )
  // A render can change a controlled value without an input event, for
  // example a form reset; a ghost for the old text must go.
  useIsomorphicLayoutEffect(() => {
    controller.checkCaret()
  })

  const { status, suggestion } = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )

  return {
    /** Ref callback for the `<input>` or `<textarea>` element. */
    ref: controller.ref,
    status,
    /** The visible suggestion, or an empty string. */
    suggestion,
    /** Inserts the visible suggestion, for example from a button on touch devices. */
    accept: controller.accept,
    dismiss: controller.dismiss,
  }
}
