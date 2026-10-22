# use-prediction

use-prediction lets a person accept AI suggestions while they type into an existing form field, without a change to how the field works.

## Language

**Field**: The native `<input>` or `<textarea>` that the hook attaches to through its ref; its value stays owned by the page.
_Avoid_: Editor, control, component

**Prediction source**: The async `get` function of the consumer that receives the text around the caret and returns a suggestion.
_Avoid_: Provider, model, backend

**Suggestion**: The text that the prediction source proposes to insert at the caret; it becomes part of the field value only when the user accepts it.
_Avoid_: Completion, prediction

**Ghost text**: The faint drawing of a suggestion at the caret over the field; it is not part of the field value.
_Avoid_: Placeholder, hint

**Loading indicator**: The thin line under the text that starts at the caret while a request to the prediction source is in progress.
_Avoid_: Spinner, shimmer, skeleton

**Accept**: Insert the visible suggestion into the field as typing does: all of it with Tab, or the next word with Cmd/Ctrl+→.
_Avoid_: Apply, complete, commit

**Dismiss**: Hide the suggestion and stop the request without a change to the field value.
_Avoid_: Reject, cancel, clear
