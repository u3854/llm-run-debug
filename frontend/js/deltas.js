import { state, API_BASE } from './state.js';
import { DOM, showToast, setLoading } from './ui.js';
import { loadActiveDeltaView } from './trials.js';

export async function refreshDeltasList() {
    try {
        const response = await fetch(`${API_BASE}/deltas`);
        if (!response.ok) throw new Error("Failed to load deltas.");
        const deltas = await response.json();
        state.deltas = deltas;
        renderDeltasList(deltas);
    } catch (err) {
        showToast(err.message, "error");
    }
}

export function renderDeltasList(deltas) {
    DOM.deltasList.innerHTML = "";
    if (deltas.length === 0) {
        DOM.deltasList.innerHTML = `<div class="empty-state">No saved deltas. Create one above to start.</div>`;
        return;
    }

    deltas.forEach(delta => {
        const li = document.createElement("li");
        li.className = `delta-item ${state.activeDeltaId === delta.delta_id ? 'active' : ''}`;
        li.dataset.deltaId = delta.delta_id;

        // Preview formatting
        let valStr = "";
        if (typeof delta.value === 'string') {
            valStr = delta.value;
        } else {
            valStr = JSON.stringify(delta.value);
        }
        const valPreview = valStr.length > 40 ? valStr.substring(0, 40) + "..." : valStr;

        let metaText = `Component: ${delta.target_component} | Op: ${delta.operation}`;
        if (delta.target_component === "message" && delta.target_role) {
            metaText += ` (${delta.target_role})`;
        }

        li.innerHTML = `
            <div class="delta-item-content">
                <span class="delta-item-name" title="${delta.name}">${delta.name}</span>
                <span class="delta-item-meta">${metaText}</span>
                <span class="delta-item-value-preview" title="${valStr}">${valPreview}</span>
            </div>
            <button type="button" class="btn-icon text-error btn-delete-delta" title="Delete Delta">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;

        li.addEventListener("click", (e) => {
            if (e.target.closest(".btn-delete-delta")) {
                return;
            }
            selectDelta(delta.delta_id);
        });

        const deleteBtn = li.querySelector(".btn-delete-delta");
        deleteBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await deleteDelta(delta.delta_id);
        });

        DOM.deltasList.appendChild(li);
    });
}

export async function submitCreateDelta(e) {
    e.preventDefault();
    
    const name = DOM.deltaName.value.trim();
    const target_component = DOM.deltaComponent.value;
    const operation = DOM.deltaOperation.value;
    const target_role = target_component === "message" ? DOM.deltaRole.value : null;
    
    let target_index = null;
    if (target_component === "message" && DOM.deltaIndex.value.trim() !== "") {
        target_index = parseInt(DOM.deltaIndex.value);
    }
    
    const anchor = DOM.deltaAnchor.value.trim() || null;
    const rawVal = DOM.deltaValue.value;
    let value = rawVal;
    
    // Validate value types
    if (target_component === "temperature") {
        if (rawVal === "" || rawVal === null || rawVal === undefined || (typeof rawVal === "string" && (rawVal.trim().toLowerCase() === "none" || rawVal.trim().toLowerCase() === "null"))) {
            value = null;
        } else {
            const parsedTemp = parseFloat(rawVal);
            if (isNaN(parsedTemp) || parsedTemp < 0 || parsedTemp > 2) {
                showToast("Temperature must be a float between 0.0 and 2.0 or 'none'/'null' to omit.", "error");
                return;
            }
            value = parsedTemp;
        }
    } else if (target_component === "tools") {
        try {
            value = JSON.parse(rawVal);
            if (!Array.isArray(value)) {
                throw new Error("Tools must be a JSON array.");
            }
        } catch (err) {
            showToast(`Invalid Tools JSON: ${err.message}`, "error");
            return;
        }
    }

    const strict = DOM.deltaStrict.checked;
    
    const payload = {
        name,
        target_component,
        target_role,
        target_index,
        operation,
        anchor,
        value,
        strict
    };

    setLoading(DOM.createDeltaForm.querySelector("button[type='submit']"), true);
    try {
        const response = await fetch(`${API_BASE}/deltas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to create Delta.");
        }

        showToast("Delta created successfully!", "success");
        DOM.createDeltaForm.reset();
        
        // Trigger manual layout field updates to reset visibility states
        updateDeltaFormOptions();
        
        await refreshDeltasList();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        setLoading(DOM.createDeltaForm.querySelector("button[type='submit']"), false);
    }
}

export async function deleteDelta(deltaId) {
    try {
        const response = await fetch(`${API_BASE}/deltas/${deltaId}`, {
            method: "DELETE"
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to delete delta.");
        }
        showToast("Delta and trials deleted successfully!", "success");
        if (state.activeDeltaId === deltaId) {
            state.activeDeltaId = null;
            DOM.deltaActivePanel.classList.add("hidden");
            DOM.deltaEmptyState.classList.remove("hidden");
        }
        await refreshDeltasList();
    } catch (err) {
        showToast(err.message, "error");
    }
}

export function selectDelta(deltaId) {
    state.activeDeltaId = deltaId;
    
    // Toggle active classes in UI list
    document.querySelectorAll(".delta-item").forEach(item => {
        if (item.dataset.deltaId === deltaId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    loadActiveDeltaView(deltaId);
}

export function updateDeltaFormOptions() {
    const component = DOM.deltaComponent.value;
    
    // Show/hide message options
    if (component === "message") {
        DOM.deltaMessageOptions.style.display = "grid";
        
        // Show all operations
        DOM.deltaOperation.innerHTML = `
            <option value="replace">Replace</option>
            <option value="append">Append</option>
            <option value="prepend">Prepend</option>
            <option value="insert_before">Insert Before</option>
            <option value="insert_after">Insert After</option>
        `;
    } else {
        DOM.deltaMessageOptions.style.display = "none";
        
        // Non-string components only allow replace
        DOM.deltaOperation.innerHTML = `
            <option value="replace" selected>Replace</option>
        `;
    }

    const operation = DOM.deltaOperation.value;
    
    // Show anchor field for specific operations
    const requiresAnchor = operation === "insert_before" || operation === "insert_after" || (operation === "replace" && component === "message");
    if (requiresAnchor) {
        DOM.deltaAnchorGroup.style.display = "flex";
    } else {
        DOM.deltaAnchorGroup.style.display = "none";
    }

    // Set textarea labels/placeholders depending on component
    if (component === "temperature") {
        DOM.deltaValueLabel.textContent = "Value (Float, e.g. 0.7)";
        DOM.deltaValue.placeholder = "e.g., 0.7";
    } else if (component === "tools") {
        DOM.deltaValueLabel.textContent = "Value (JSON array of tools)";
        DOM.deltaValue.placeholder = "[\n  {\n    \"type\": \"function\",\n    ...\n  }\n]";
    } else if (component === "model_name") {
        DOM.deltaValueLabel.textContent = "Value (Model name string)";
        DOM.deltaValue.placeholder = "e.g., gpt-4o";
    } else {
        DOM.deltaValueLabel.textContent = "Value";
        DOM.deltaValue.placeholder = "Text value to insert or replace with...";
    }
}

export async function openInferDeltaModal() {
    if (!state.activeRunId) {
        showToast("No active run selected. Please load a run first.", "error");
        return;
    }

    try {
        // Collect current playground edits
        const { syncMessagesFromUI } = await import('./components.js');
        syncMessagesFromUI();

        // Fetch baseline configuration
        const response = await fetch(`${API_BASE}/runs/${state.activeRunId}`);
        if (!response.ok) throw new Error("Failed to load baseline configuration.");
        const baseline = await response.json();

        // Calculate candidate deltas
        const candidates = [];

        // 1. Model Name
        if (state.modelName !== baseline.model_name) {
            candidates.push({
                description: `Model Name: "${baseline.model_name}" &rarr; "${state.modelName}"`,
                payload: {
                    target_component: "model_name",
                    operation: "replace",
                    value: state.modelName,
                    strict: true
                }
            });
        }

        // 2. Temperature
        const tempChanged = (state.temperature !== baseline.temperature);
        if (tempChanged) {
            const baselineStr = (baseline.temperature !== null && baseline.temperature !== undefined) ? baseline.temperature.toFixed(1) : "Omitted";
            const currentStr = (state.temperature !== null && state.temperature !== undefined) ? state.temperature.toFixed(1) : "Omitted";
            candidates.push({
                description: `Temperature: ${baselineStr} &rarr; ${currentStr}`,
                payload: {
                    target_component: "temperature",
                    operation: "replace",
                    value: state.temperature !== null && state.temperature !== undefined ? parseFloat(state.temperature) : null,
                    strict: true
                }
            });
        }

        // 3. Tools
        const toolsStrPlayground = DOM.toolsJsonEditor.value.trim();
        const toolsStrBaseline = JSON.stringify(baseline.tools || [], null, 2).trim();
        if (toolsStrPlayground !== toolsStrBaseline) {
            let parsedTools = [];
            if (toolsStrPlayground) {
                try {
                    parsedTools = JSON.parse(toolsStrPlayground);
                } catch (e) {
                    showToast("Tools JSON is currently invalid. Fix it in the playground first.", "error");
                    return;
                }
            }
            candidates.push({
                description: `Replace bound tools JSON schema`,
                payload: {
                    target_component: "tools",
                    operation: "replace",
                    value: parsedTools,
                    strict: true
                }
            });
        }

        // 4. Messages
        const oldMsgs = baseline.messages || [];
        const newMsgs = state.messages || [];
        const minLen = Math.min(oldMsgs.length, newMsgs.length);

        for (let i = 0; i < minLen; i++) {
            const oldMsg = oldMsgs[i];
            const newMsg = newMsgs[i];
            if (oldMsg.content !== newMsg.content) {
                const role = oldMsg.role;
                const roleIndices = oldMsgs.map((m, idx) => m.role === role ? idx : -1).filter(idx => idx !== -1);
                const target_index = roleIndices.indexOf(i);
                
                let operation = "replace";
                let value = newMsg.content;
                let desc = `Replace ${role} message [index ${target_index}]`;
                
                if (newMsg.content.startsWith(oldMsg.content)) {
                    operation = "append";
                    value = newMsg.content.substring(oldMsg.content.length);
                    desc = `Append to ${role} message [index ${target_index}]: "${value.length > 30 ? value.substring(0, 30) + '...' : value}"`;
                } else if (newMsg.content.endsWith(oldMsg.content)) {
                    operation = "prepend";
                    value = newMsg.content.substring(0, newMsg.content.length - oldMsg.content.length);
                    desc = `Prepend to ${role} message [index ${target_index}]: "${value.length > 30 ? value.substring(0, 30) + '...' : value}"`;
                }
                
                candidates.push({
                    description: desc,
                    payload: {
                        target_component: "message",
                        target_role: role,
                        target_index: target_index,
                        operation: operation,
                        value: value,
                        strict: true
                    }
                });
            }
        }

        // Render candidates in list
        DOM.inferredChangesList.innerHTML = "";
        if (candidates.length === 0) {
            DOM.inferredChangesList.innerHTML = `<div class="text-light" style="padding: 10px; text-align:center; font-size:12px;">No changes detected between the playground and the baseline run configuration.</div>`;
            DOM.btnSaveInferred.setAttribute("disabled", "true");
        } else {
            DOM.btnSaveInferred.removeAttribute("disabled");
            
            candidates.forEach((cand, idx) => {
                const div = document.createElement("div");
                div.className = "inferred-change-item";
                
                const payloadStr = encodeURIComponent(JSON.stringify(cand.payload));
                
                div.innerHTML = `
                    <input type="radio" id="rad-inferred-${idx}" name="inferred-change-radio" data-payload="${payloadStr}" ${idx === 0 ? 'checked' : ''}>
                    <label for="rad-inferred-${idx}" class="inferred-change-label">
                        ${cand.description}
                    </label>
                    <span class="inferred-change-badge">${cand.payload.target_component}</span>
                `;
                
                div.addEventListener("click", () => {
                    div.querySelector("input").checked = true;
                });
                
                DOM.inferredChangesList.appendChild(div);
            });
        }

        DOM.inferDeltaName.value = "";
        const { openInferModal } = await import('./ui.js');
        openInferModal();
    } catch (err) {
        showToast(err.message, "error");
    }
}

export async function saveInferredDelta() {
    const selectedRadio = DOM.inferredChangesList.querySelector("input[name='inferred-change-radio']:checked");
    if (!selectedRadio) {
        showToast("Please select a change to save.", "error");
        return;
    }

    const name = DOM.inferDeltaName.value.trim();
    if (!name) {
        showToast("Please enter a name for the Delta.", "error");
        DOM.inferDeltaName.focus();
        return;
    }

    const payload = JSON.parse(decodeURIComponent(selectedRadio.dataset.payload));
    payload.name = name;

    setLoading(DOM.btnSaveInferred, true);
    try {
        const response = await fetch(`${API_BASE}/deltas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to save inferred Delta.");
        }

        showToast("Delta saved successfully!", "success");
        const { closeInferModal } = await import('./ui.js');
        closeInferModal();
        
        await refreshDeltasList();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        setLoading(DOM.btnSaveInferred, false);
    }
}
