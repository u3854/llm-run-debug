import { state } from './state.js';
import { DOM, showToast, openModal, updateExecutionStatus } from './ui.js';
import { loadRunConfig, deleteRun } from './api.js';

// ==========================================================================
// Rendering and DOM Mutation Functions
// ==========================================================================

export function loadStateFromRunConfig(config) {
    state.activeRunId = config.run_id;
    state.modelName = config.model_name;
    state.temperature = config.temperature;
    state.maxTokens = config.max_tokens !== undefined && config.max_tokens !== null ? config.max_tokens : null;
    state.thinkingMode = config.thinking_mode || "default";
    state.thinkingEffort = config.thinking_effort || "";
    state.messages = config.messages;
    state.tools = config.tools;
    state.env_vars = config.env_vars || {};
    state.collapsedMessages = new Set();
    state.activeModalMsgIndex = null;

    // Update form elements
    DOM.activeRunTitle.textContent = config.run_id ? `Run Debugger` : `Playground Sandbox`;
    DOM.activeRunIdBadge.textContent = config.run_id || "unsaved_playground";
    if (config.run_id) {
        DOM.btnInferDelta.removeAttribute("disabled");
    } else {
        DOM.btnInferDelta.setAttribute("disabled", "true");
    }
    DOM.modelNameInput.value = config.model_name;
    
    // Populate advanced inputs
    DOM.maxTokensInput.value = config.max_tokens !== undefined && config.max_tokens !== null ? config.max_tokens : "";
    DOM.thinkingModeSelect.value = config.thinking_mode || "default";
    DOM.thinkingEffortInput.value = config.thinking_effort || "";

    if (config.temperature === null || config.temperature === undefined) {
        DOM.omitTempCheckbox.checked = true;
        DOM.temperatureInput.disabled = true;
        DOM.tempVal.textContent = "Omitted";
        state.temperature = null;
    } else {
        DOM.omitTempCheckbox.checked = false;
        DOM.temperatureInput.disabled = false;
        DOM.temperatureInput.value = config.temperature;
        DOM.tempVal.textContent = config.temperature.toFixed(1);
        state.temperature = config.temperature;
    }

    // Render Env Variables & Messages
    renderEnvVars();
    renderMessages();

    // Update Tools editor
    DOM.toolsJsonEditor.value = config.tools && config.tools.length ? JSON.stringify(config.tools, null, 2) : "";
    validateToolsJson(DOM.toolsJsonEditor.value);
    
    // Reset output panels
    updateExecutionStatus("IDLE", "status-idle");
    DOM.simulationOutput.innerHTML = `<div class="empty-state"><i class="fa-solid fa-terminal large-icon"></i><p>Run the simulation to inspect the assistant response.</p></div>`;
    DOM.simulationOutput.classList.add("empty-output");
    DOM.toolCallsContainer.innerHTML = '<div class="empty-state">No tool calls generated.</div>';
    DOM.toolCallsCount.textContent = "0 calls";
    DOM.metricLatency.textContent = "-";
    DOM.metricTokensTotal.textContent = "-";
    DOM.tokenBreakdownPanel.classList.add("hidden");
    DOM.backupPathLabel.textContent = "";
    DOM.backupPathLabel.style.display = "none";

    // Highlight active run in list
    document.querySelectorAll(".run-item").forEach(item => {
        if (item.dataset.runId === config.run_id) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });
}

export function resetPlayground() {
    loadStateFromRunConfig({
        run_id: null,
        model_name: "gpt-4o-mini",
        temperature: 0.0,
        max_tokens: null,
        thinking_mode: "default",
        thinking_effort: "",
        messages: [
            { role: "system", content: "You are a helpful AI assistant." },
            { role: "human", content: "Hello! What can you help me with?" }
        ],
        tools: [],
        env_vars: {
            "OPENAI_API_KEY": ""
        }
    });
}

export function renderRunsList(runs) {
    DOM.runsList.innerHTML = "";
    
    // Show or hide bulk action bar container depending on whether there are runs
    if (runs.length === 0) {
        DOM.runsList.innerHTML = `<div class="empty-state">No saved runs.</div>`;
        DOM.bulkActionBar.classList.add("hidden");
        return;
    }

    DOM.bulkActionBar.classList.remove("hidden");
    // Reset select all checkbox and bulk select value
    DOM.chkSelectAll.checked = false;
    DOM.chkSelectAll.indeterminate = false;
    DOM.bulkActionSelect.value = "";
    DOM.bulkActionSelect.disabled = true;
    DOM.btnBulkApply.disabled = true;
    DOM.selectedCount.textContent = "0 selected";

    runs.forEach(run => {
        const li = document.createElement("li");
        li.className = `run-item ${state.activeRunId === run.run_id ? 'active' : ''}`;
        li.dataset.runId = run.run_id;
        
        li.innerHTML = `
            <div class="run-item-checkbox-container">
                <input type="checkbox" class="run-checkbox" data-run-id="${run.run_id}" title="Select run">
            </div>
            <div class="run-item-main">
                <div class="run-item-header">
                    <span class="run-item-id" title="${run.run_id}">${run.run_id}</span>
                    <div class="run-item-actions">
                        <span class="badge badge-secondary">${run.message_count} msgs</span>
                        <button type="button" class="btn-icon text-error btn-delete-run" title="Delete Run">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                <div class="run-item-model">${run.model_name}</div>
                <div class="run-item-details">
                    <span><i class="fa-solid fa-toolbox"></i> ${run.tool_count} tools</span>
                    <span><i class="fa-solid fa-thermometer"></i> temp: ${(run.temperature !== null && run.temperature !== undefined) ? run.temperature.toFixed(1) : "omitted"}</span>
                </div>
            </div>
        `;
        
        li.addEventListener("click", (e) => {
            if (e.target.closest(".btn-delete-run") || e.target.closest(".run-checkbox")) {
                return;
            }
            loadRunConfig(run.run_id);
        });

        const deleteBtn = li.querySelector(".btn-delete-run");
        deleteBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await deleteRun(run.run_id);
        });

        const chk = li.querySelector(".run-checkbox");
        chk.addEventListener("click", (e) => {
            e.stopPropagation();
        });
        chk.addEventListener("change", () => {
            updateBulkActionBar();
        });
        
        DOM.runsList.appendChild(li);
    });
}

export function updateBulkActionBar() {
    const checkedBoxes = DOM.runsList.querySelectorAll(".run-checkbox:checked");
    const totalBoxes = DOM.runsList.querySelectorAll(".run-checkbox");
    
    // Update selected count
    DOM.selectedCount.textContent = `${checkedBoxes.length} selected`;
    
    // Update master select-all checkbox
    if (checkedBoxes.length === 0) {
        DOM.chkSelectAll.checked = false;
        DOM.chkSelectAll.indeterminate = false;
    } else if (checkedBoxes.length === totalBoxes.length) {
        DOM.chkSelectAll.checked = true;
        DOM.chkSelectAll.indeterminate = false;
    } else {
        DOM.chkSelectAll.checked = false;
        DOM.chkSelectAll.indeterminate = true;
    }
    
    // Enable/disable action select and apply button
    const hasSelection = checkedBoxes.length > 0;
    DOM.bulkActionSelect.disabled = !hasSelection;
    DOM.btnBulkApply.disabled = !hasSelection || !DOM.bulkActionSelect.value;
}

export function toggleSelectAll(checked) {
    const checkboxes = DOM.runsList.querySelectorAll(".run-checkbox");
    checkboxes.forEach(chk => {
        chk.checked = checked;
    });
    updateBulkActionBar();
}


export function renderEnvVars() {
    DOM.envContainer.innerHTML = "";
    const keys = Object.keys(state.env_vars);
    
    if (keys.length === 0) {
        DOM.envContainer.innerHTML = `<div class="text-light" style="font-size:11px; padding: 4px 0; text-align:center;">No custom keys added. Click '+' to inject.</div>`;
        return;
    }
    
    keys.forEach(key => {
        const value = state.env_vars[key] || "";
        const row = document.createElement("div");
        row.className = "env-row";
        
        row.innerHTML = `
            <input type="text" class="env-key-input env-key" placeholder="Variable Key" value="${key}" title="Key name">
            <div class="env-value-wrapper">
                <input type="password" class="env-val-input env-value" placeholder="Value..." value="${value}" title="Value">
                <button type="button" class="env-btn-toggle" title="Toggle visibility"><i class="fa-solid fa-eye-slash"></i></button>
            </div>
            <button type="button" class="btn-icon text-error btn-delete-env" title="Delete Key"><i class="fa-solid fa-trash-can"></i></button>
        `;
        
        const keyInput = row.querySelector(".env-key");
        const valInput = row.querySelector(".env-value");
        const toggleBtn = row.querySelector(".env-btn-toggle");
        const deleteBtn = row.querySelector(".btn-delete-env");
        
        // Handle changing the key
        keyInput.addEventListener("change", (e) => {
            const newKey = e.target.value.trim();
            if (!newKey) {
                renderEnvVars();
                return;
            }
            if (newKey !== key) {
                const val = state.env_vars[key];
                delete state.env_vars[key];
                state.env_vars[newKey] = val;
                key = newKey;
            }
        });
        
        // Handle changing the value
        valInput.addEventListener("input", (e) => {
            state.env_vars[key] = e.target.value;
        });
        
        // Visibility toggle
        toggleBtn.addEventListener("click", () => {
            const icon = toggleBtn.querySelector("i");
            if (valInput.type === "password") {
                valInput.type = "text";
                icon.className = "fa-solid fa-eye";
            } else {
                valInput.type = "password";
                icon.className = "fa-solid fa-eye-slash";
            }
        });
        
        // Delete button
        deleteBtn.addEventListener("click", () => {
            delete state.env_vars[key];
            renderEnvVars();
        });
        
        DOM.envContainer.appendChild(row);
    });
}

export function addBlankEnvVar() {
    let baseName = "CUSTOM_API_KEY";
    let suffix = 1;
    while (state.env_vars.hasOwnProperty(`${baseName}_${suffix}`)) {
        suffix++;
    }
    state.env_vars[`${baseName}_${suffix}`] = "";
    renderEnvVars();
}

// Helpers for Multimodal/Structured Message Content
function getMessageTextPreview(content) {
    if (!content) return "(empty message)";
    if (typeof content === "string") {
        return content.length > 50 ? content.substring(0, 50) + "..." : content;
    }
    if (Array.isArray(content)) {
        const textBlock = content.find(block => block && block.type === "text");
        let textFound = textBlock && textBlock.text ? textBlock.text : "";
        const hasImage = content.some(block => block && (block.type === "image_url" || block.image_url));
        const imageText = hasImage ? " 🖼️ [Image]" : "";
        if (textFound) {
            return (textFound.length > 40 ? textFound.substring(0, 40) + "..." : textFound) + imageText;
        }
        return `[Multimodal: ${content.length} blocks]${imageText}`;
    }
    return "[Structured Content]";
}

function renderMediaPreviews(content) {
    if (!Array.isArray(content)) return "";
    const images = content.filter(block => block && (block.type === "image_url" || block.image_url));
    if (images.length === 0) return "";
    
    return `
        <div class="message-media-previews" style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
            ${images.map(img => {
                const url = img.image_url ? (typeof img.image_url === 'string' ? img.image_url : img.image_url.url) : "";
                if (!url) return "";
                return `
                    <div class="media-preview-item" style="position: relative; border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; overflow: hidden; max-width: 200px; background: var(--bg-surface-secondary, #f8f9fa); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <img src="${url}" alt="Preview" style="max-width: 100%; height: auto; display: block; max-height: 120px; object-fit: contain; margin: 0 auto;" />
                        <div style="background: rgba(0,0,0,0.6); color: white; font-size: 9px; padding: 2px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center;" title="${url}">
                            ${url.split('/').pop()}
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

export function updateContentText(originalContent, newText) {
    if (typeof originalContent === "string") {
        return newText;
    }
    if (Array.isArray(originalContent)) {
        const newContent = [...originalContent];
        const textIdx = newContent.findIndex(block => block && block.type === "text");
        if (textIdx !== -1) {
            newContent[textIdx] = { ...newContent[textIdx], text: newText };
        } else {
            newContent.push({ type: "text", text: newText });
        }
        return newContent;
    }
    return newText;
}

export function renderMessages() {
    DOM.messagesContainer.innerHTML = "";
    DOM.messageCountBadge.textContent = `${state.messages.length} messages`;

    if (state.messages.length === 0) {
        DOM.messagesContainer.innerHTML = `<div class="empty-state">No messages. Add a message to start.</div>`;
        return;
    }

    state.messages.forEach((msg, index) => {
        const card = document.createElement("div");
        card.className = `message-card ${state.collapsedMessages.has(index) ? 'collapsed' : ''}`;
        card.dataset.index = index;

        // Message Role Color Classes
        let roleColorClass = "human";
        if (msg.role === "system") roleColorClass = "system";
        else if (msg.role === "ai" || msg.role === "assistant") roleColorClass = "ai";
        else if (msg.role === "tool") roleColorClass = "tool";

        const previewText = getMessageTextPreview(msg.content);
        let displayVal = "";
        if (typeof msg.content === "string") {
            displayVal = msg.content;
        } else if (Array.isArray(msg.content)) {
            const textBlock = msg.content.find(block => block && block.type === "text");
            displayVal = textBlock && textBlock.text ? textBlock.text : "";
        }

        card.innerHTML = `
            <div class="message-card-header">
                <button class="btn-icon btn-collapse-msg" data-index="${index}" title="Collapse/Expand message">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>

                <div class="role-badge-select">
                    <span class="role-dot ${roleColorClass}"></span>
                    <select class="role-select" data-index="${index}">
                        <option value="system" ${msg.role === "system" ? "selected" : ""}>System</option>
                        <option value="human" ${msg.role === "human" || msg.role === "user" ? "selected" : ""}>Human</option>
                        <option value="ai" ${msg.role === "ai" || msg.role === "assistant" ? "selected" : ""}>AI / Assistant</option>
                        <option value="tool" ${msg.role === "tool" ? "selected" : ""}>Tool Response</option>
                    </select>
                </div>
                
                <div class="message-meta-inputs">
                    <input type="text" placeholder="Name (opt)" class="meta-name" value="${msg.name || ''}" data-index="${index}" title="Sender name identifier">
                    ${msg.role === 'tool' ? `
                        <input type="text" placeholder="Tool Call ID" class="meta-tool-id" value="${msg.tool_call_id || ''}" data-index="${index}" title="Matching ID for this tool call">
                    ` : ''}
                    <span class="collapsed-preview text-light" style="font-size: 11px; margin-left: 10px; display: none;">${previewText}</span>
                </div>

                <div style="display:flex; gap: 4px;">
                    ${(msg.role === 'system' && state.activeRunId) ? `
                        <button class="btn-icon text-indigo btn-save-delta-from-msg" data-index="${index}" title="Infer & Save Delta from playground changes">
                            <i class="fa-solid fa-magic"></i>
                        </button>
                    ` : ''}
                    <button class="btn-icon btn-expand-msg" data-index="${index}" title="Open Large Message Editor">
                        <i class="fa-solid fa-expand"></i>
                    </button>
                    <button class="btn-icon text-error btn-delete-msg" data-index="${index}" title="Delete Message">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            <div class="message-card-body">
                <textarea class="message-textarea" placeholder="Type message prompt content here..." data-index="${index}">${displayVal}</textarea>
                ${renderMediaPreviews(msg.content)}
            </div>
            
            ${(msg.role === 'ai' || msg.role === 'assistant') && msg.tool_calls && msg.tool_calls.length ? `
                <details class="message-expandable-panel">
                    <summary>Emitted Tool Calls (${msg.tool_calls.length})</summary>
                    <div class="message-expandable-content">
                        <textarea class="code-editor" style="height: 100px; font-size:11px;" data-tool-call-index="${index}" title="Edit tool call outputs">${JSON.stringify(msg.tool_calls, null, 2)}</textarea>
                    </div>
                </details>
            ` : ''}
        `;

        // Bind events to elements in this specific card
        card.querySelector(".role-select").addEventListener("change", handleRoleChange);
        card.querySelector(".message-textarea").addEventListener("input", handleContentInput);
        card.querySelector(".meta-name").addEventListener("input", handleNameInput);
        card.querySelector(".btn-delete-msg").addEventListener("click", handleDeleteMessage);

        const saveDeltaBtn = card.querySelector(".btn-save-delta-from-msg");
        if (saveDeltaBtn) {
            saveDeltaBtn.addEventListener("click", async () => {
                const { openInferDeltaModal } = await import('./deltas.js');
                openInferDeltaModal();
            });
        }

        const header = card.querySelector(".message-card-header");
        header.addEventListener("click", (e) => {
            // Prevent collapsing when clicking on interactive fields
            if (e.target.closest("select") || e.target.closest("input") || e.target.closest(".btn-expand-msg") || e.target.closest(".btn-delete-msg")) {
                return;
            }

            const idx = parseInt(card.dataset.index);
            const collapsedPreview = card.querySelector(".collapsed-preview");
            const textarea = card.querySelector(".message-textarea");
            
            syncMessagesFromUI(); // Capture current state before rendering
            
            if (state.collapsedMessages.has(idx)) {
                state.collapsedMessages.delete(idx);
                card.classList.remove("collapsed");
                collapsedPreview.style.display = "none";
            } else {
                state.collapsedMessages.add(idx);
                card.classList.add("collapsed");
                // Update preview text with latest value
                collapsedPreview.textContent = getMessageTextPreview(state.messages[idx].content);
                collapsedPreview.style.display = "inline";
            }
        });

        const expandBtn = card.querySelector(".btn-expand-msg");
        expandBtn.addEventListener("click", () => {
            const idx = parseInt(expandBtn.dataset.index);
            openModal(idx);
        });

        const toolIdInput = card.querySelector(".meta-tool-id");
        if (toolIdInput) {
            toolIdInput.addEventListener("input", handleToolIdInput);
        }

        const toolCallsEditor = card.querySelector("details textarea");
        if (toolCallsEditor) {
            toolCallsEditor.addEventListener("input", handleToolCallsJsonInput);
        }

        // Maintain display settings for collapsed elements
        if (state.collapsedMessages.has(index)) {
            card.querySelector(".collapsed-preview").style.display = "inline";
        }

        DOM.messagesContainer.appendChild(card);
    });
}

export function renderResponse(content) {
    if (!content) {
        DOM.simulationOutput.innerHTML = `<div class="empty-state">Assistant generated an empty response (likely triggered a tool call).</div>`;
        return;
    }
    
    const escapeHtml = (text) => {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    if (typeof content === "string") {
        const escaped = escapeHtml(content);
        DOM.simulationOutput.innerHTML = `<div style="white-space: pre-wrap;">${escaped}</div>`;
    } else if (Array.isArray(content)) {
        let html = "";
        content.forEach(block => {
            if (!block) return;
            if (block.type === "thinking" || block.thinking) {
                const thinkingText = block.thinking || block.text || "";
                html += `
                    <div class="thinking-block" style="background: rgba(99, 102, 241, 0.05); border-left: 3px solid var(--color-primary, #6366f1); padding: 10px 14px; margin-bottom: 12px; border-radius: 0 8px 8px 0; font-family: monospace; font-size: 12px; color: var(--text-secondary, #64748b); white-space: pre-wrap;">
                        <div style="font-weight: bold; margin-bottom: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-primary, #6366f1);"><i class="fa-solid fa-brain"></i> Thinking Process</div>
                        ${escapeHtml(thinkingText)}
                    </div>
                `;
            } else if (block.type === "text" || block.text) {
                const textVal = block.text || "";
                html += `<div style="white-space: pre-wrap; margin-bottom: 12px;">${escapeHtml(textVal)}</div>`;
            } else {
                html += `<div class="unknown-block" style="font-size: 11px; color: var(--text-light, #94a3b8); margin-bottom: 12px;">[Block type: ${block.type || 'unknown'}]</div>`;
            }
        });
        DOM.simulationOutput.innerHTML = html || `<div class="empty-state">No readable content blocks.</div>`;
    } else {
        DOM.simulationOutput.innerHTML = `<pre style="font-size: 11px; overflow-x: auto; background: var(--bg-surface-secondary, #f8f9fa); padding: 10px; border-radius: 6px;">${escapeHtml(JSON.stringify(content, null, 2))}</pre>`;
    }
}

export function renderToolCalls(toolCalls) {
    DOM.toolCallsContainer.innerHTML = "";
    if (!toolCalls || toolCalls.length === 0) {
        DOM.toolCallsContainer.innerHTML = `<div class="empty-state">No tool calls generated.</div>`;
        DOM.toolCallsCount.textContent = "0 calls";
        return;
    }

    DOM.toolCallsCount.textContent = `${toolCalls.length} calls`;

    toolCalls.forEach(call => {
        const div = document.createElement("div");
        div.className = "tool-call-block";
        
        div.innerHTML = `
            <div class="tool-call-title">
                <span><i class="fa-solid fa-terminal"></i> ${call.name}</span>
                <span class="tool-call-id">id: ${call.id || 'N/A'}</span>
            </div>
            <div class="tool-call-args">${JSON.stringify(call.args || {}, null, 2)}</div>
        `;
        DOM.toolCallsContainer.appendChild(div);
    });
}

// ==========================================================================
// Handlers & Event Callback Helpers
// ==========================================================================

function handleRoleChange(e) {
    const index = parseInt(e.target.dataset.index);
    const newRole = e.target.value;
    
    syncMessagesFromUI();
    state.messages[index].role = newRole;
    
    // Set matching attributes depending on role selection
    if (newRole === "tool" && !state.messages[index].tool_call_id) {
        state.messages[index].tool_call_id = "";
    }
    if (newRole === "ai" && !state.messages[index].tool_calls) {
        state.messages[index].tool_calls = [];
    }

    renderMessages();
}

function handleContentInput(e) {
    const index = parseInt(e.target.dataset.index);
    state.messages[index].content = updateContentText(state.messages[index].content, e.target.value);
}

function handleNameInput(e) {
    const index = parseInt(e.target.dataset.index);
    state.messages[index].name = e.target.value.trim() || null;
}

function handleToolIdInput(e) {
    const index = parseInt(e.target.dataset.index);
    state.messages[index].tool_call_id = e.target.value.trim();
}

function handleToolCallsJsonInput(e) {
    const index = parseInt(e.target.dataset.toolCallIndex);
    try {
        const parsed = JSON.parse(e.target.value);
        state.messages[index].tool_calls = parsed;
        e.target.style.borderColor = "var(--border-color)";
    } catch (err) {
        e.target.style.borderColor = "var(--color-danger)";
    }
}

function handleDeleteMessage(e) {
    const btn = e.currentTarget;
    const index = parseInt(btn.dataset.index);
    state.messages.splice(index, 1);
    renderMessages();
}

export function addBlankMessage() {
    syncMessagesFromUI();
    state.messages.push({
        role: "human",
        content: "",
        name: null
    });
    renderMessages();
    
    // Scroll to bottom of message panel
    setTimeout(() => {
        const body = DOM.messagesContainer.parentElement;
        body.scrollTop = body.scrollHeight;
    }, 50);
}

export function syncMessagesFromUI() {
    const cards = DOM.messagesContainer.querySelectorAll(".message-card");
    cards.forEach((card, idx) => {
        const textarea = card.querySelector(".message-textarea");
        const nameInput = card.querySelector(".meta-name");
        const toolIdInput = card.querySelector(".meta-tool-id");

        if (textarea && state.messages[idx]) {
            state.messages[idx].content = updateContentText(state.messages[idx].content, textarea.value);
        }
        if (nameInput && state.messages[idx]) {
            state.messages[idx].name = nameInput.value.trim() || null;
        }
        if (toolIdInput && state.messages[idx]) {
            state.messages[idx].tool_call_id = toolIdInput.value.trim() || "";
        }
    });
}

export function validateToolsJson(val) {
    const cleanVal = val.trim();
    if (!cleanVal) {
        DOM.toolsStatusBadge.textContent = "Empty";
        DOM.toolsStatusBadge.className = "badge badge-secondary";
        DOM.toolsJsonError.classList.add("hidden");
        DOM.toolsJsonEditor.classList.remove("invalid");
        return;
    }

    try {
        const parsed = JSON.parse(cleanVal);
        if (!Array.isArray(parsed)) {
            throw new Error("Tools must be a JSON Array.");
        }
        DOM.toolsStatusBadge.textContent = "Valid JSON Array";
        DOM.toolsStatusBadge.className = "badge badge-success";
        DOM.toolsJsonError.classList.add("hidden");
        DOM.toolsJsonEditor.classList.remove("invalid");
    } catch (err) {
        DOM.toolsStatusBadge.textContent = "Invalid Format";
        DOM.toolsStatusBadge.className = "badge badge-error";
        DOM.toolsJsonError.textContent = err.message;
        DOM.toolsJsonError.classList.remove("hidden");
        DOM.toolsJsonEditor.classList.add("invalid");
    }
}
