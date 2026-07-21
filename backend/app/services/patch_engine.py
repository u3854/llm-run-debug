from typing import Optional
from backend.app.schemas.runs import RunConfig
from backend.app.schemas.deltas import DeltaCreate


class PatchError(Exception):
    """Base exception for all patch application failures."""
    pass

class AnchorNotFoundError(PatchError):
    """Raised when the text anchor is not found in the target component."""
    pass

class AmbiguousAnchorError(PatchError):
    """Raised when an anchor matches multiple times in strict mode, or a target component is ambiguous."""
    pass

class AlreadyAppliedError(PatchError):
    """Raised when the patch results in the exact same output (likely already applied)."""
    pass

class ComponentNotFoundError(PatchError):
    """Raised when the targeted message role, index, or component does not exist."""
    pass


class PatchEngine:
    """
    A deterministic engine that applies strict edits (deltas) to an LLM Run Snapshot.
    It ensures that changes are reproducible and aggressively throws conflicts if 
    there is any ambiguity.
    """

    def apply(self, run: RunConfig, delta: DeltaCreate) -> RunConfig:
        """
        Applies a Delta to a RunConfig and returns a NEW RunConfig (immutable operation).
        
        Args:
            run (RunConfig): The original immutable run snapshot.
            delta (DeltaCreate): The strict versioned patch to apply.
            
        Returns:
            RunConfig: A deep copy of the run with the delta applied.
            
        Raises:
            PatchError: If strict matching, anchors, or components fail validation.
        """
        # Always work on a deep copy. We never mutate the original run snapshot.
        patched = run.model_copy(deep=True)
        
        if delta.target_component == "message":
            self._patch_message(patched, delta)
        elif delta.target_component == "temperature":
            self._patch_temperature(patched, delta)
        elif delta.target_component == "model_name":
            patched.model_name = self._apply_string_operation(
                original=patched.model_name,
                operation=delta.operation,
                value=str(delta.value),
                anchor=delta.anchor,
                strict=delta.strict
            )
        elif delta.target_component == "tools":
            self._patch_tools(patched, delta)
        else:
            raise ComponentNotFoundError(f"Unknown target component: '{delta.target_component}'.")
            
        return patched

    def _patch_message(self, run: RunConfig, delta: DeltaCreate) -> None:
        """Locates and patches a specific conversation message based on role and index."""
        if not delta.target_role:
            raise PatchError("Targeting a 'message' requires a 'target_role' (e.g., 'system', 'human').")
            
        # Find all messages matching the target role
        matching_indices = [i for i, msg in enumerate(run.messages) if msg.role == delta.target_role]
        
        if not matching_indices:
            raise ComponentNotFoundError(f"No messages found with role '{delta.target_role}'.")
            
        # Resolve which specific message index to target
        if delta.target_index is None:
            if delta.strict and len(matching_indices) > 1:
                raise AmbiguousAnchorError(
                    f"Found {len(matching_indices)} messages for role '{delta.target_role}'. "
                    "Please specify 'target_index' (e.g., 0 for first, -1 for last) or disable strict mode."
                )
            target_msg_idx = matching_indices[0]
        else:
            try:
                target_msg_idx = matching_indices[delta.target_index]
            except IndexError:
                raise ComponentNotFoundError(
                    f"Message index {delta.target_index} out of bounds for role '{delta.target_role}'."
                )
                
        target_msg = run.messages[target_msg_idx]
        original = target_msg.content
        
        # If it's a full replacement and there is no anchor, handle direct assignment of lists/dicts
        if not isinstance(original, str) and delta.operation == "replace" and not delta.anchor:
            target_msg.content = delta.value
            return

        # If it's a list (multimodal content blocks), target the first text block for editing
        if isinstance(original, list):
            # Try to find the first block of type "text"
            text_block = None
            for block in original:
                if isinstance(block, dict) and block.get("type") == "text":
                    text_block = block
                    break

            if text_block is not None:
                orig_text = text_block.get("text", "")
                new_text = self._apply_string_operation(
                    original=orig_text,
                    operation=delta.operation,
                    value=str(delta.value),
                    anchor=delta.anchor,
                    strict=delta.strict
                )
                if new_text == orig_text:
                    raise AlreadyAppliedError("The delta operation resulted in no changes to the message text block.")
                text_block["text"] = new_text
            else:
                # If there's no text block, and it's append/prepend/replace, we insert a new text block
                if delta.operation == "append":
                    original.append({"type": "text", "text": str(delta.value)})
                elif delta.operation == "prepend":
                    original.insert(0, {"type": "text", "text": str(delta.value)})
                elif delta.operation == "replace" and not delta.anchor:
                    original.append({"type": "text", "text": str(delta.value)})
                else:
                    raise PatchError("Cannot apply string operations on multimodal message containing no text block.")
        else:
            # Standard string operation for simple string contents
            new_content = self._apply_string_operation(
                original=str(original),
                operation=delta.operation,
                value=str(delta.value),
                anchor=delta.anchor,
                strict=delta.strict
            )
            if new_content == original:
                raise AlreadyAppliedError("The delta operation resulted in no changes to the message.")
            target_msg.content = new_content

    def _patch_temperature(self, run: RunConfig, delta: DeltaCreate) -> None:
        """Patches the float temperature value. Only allows full replacement."""
        if delta.operation != "replace":
            raise PatchError("Non-string components like 'temperature' only support the 'replace' operation.")
        if delta.value is None or delta.value == "" or str(delta.value).lower() in ("null", "none"):
            run.temperature = None
        else:
            run.temperature = float(delta.value)

    def _patch_tools(self, run: RunConfig, delta: DeltaCreate) -> None:
        """Patches the JSON tools list. Only allows full replacement for now."""
        if delta.operation != "replace":
            raise PatchError("Complex JSON components like 'tools' currently only support the 'replace' operation.")
        run.tools = delta.value

    def _apply_string_operation(self, original: str, operation: str, value: str, anchor: Optional[str], strict: bool) -> str:
        """Executes a strict string modification payload against text."""
        # Validate anchor requirements
        requires_anchor = operation in ["insert_before", "insert_after"] or (operation == "replace" and anchor)
        
        if requires_anchor:
            if not anchor:
                raise PatchError(f"Operation '{operation}' requires an 'anchor' string to locate insertion point.")
            
            occurrences = original.count(anchor)
            if occurrences == 0:
                raise AnchorNotFoundError(f"Anchor text '{anchor}' was not found in the target.")
            if strict and occurrences > 1:
                raise AmbiguousAnchorError(
                    f"Anchor text '{anchor}' found {occurrences} times. Strict mode requires exactly 1 match to prevent ambiguity."
                )
                
        # Apply operation
        if operation == "replace":
            return original.replace(anchor, value, 1 if strict else -1) if anchor else value
        elif operation == "append":
            return original + value
        elif operation == "prepend":
            return value + original
        elif operation == "insert_before":
            return original.replace(anchor, value + anchor, 1 if strict else -1)
        elif operation == "insert_after":
            return original.replace(anchor, anchor + value, 1 if strict else -1)
        else:
            raise PatchError(f"Unsupported string operation: '{operation}'")