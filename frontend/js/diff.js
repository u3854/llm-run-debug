import { DOM, openComparisonModal, closeComparisonModal } from './ui.js';

let activeTrial = null;
let activeRun = null;
let selectedExecIndex = 0;

export function openTrialComparison(trial, run) {
    activeTrial = trial;
    activeRun = run;
    selectedExecIndex = 0;

    DOM.modalComparisonTitle.innerHTML = `<i class="fa-solid fa-vial"></i> Trial Evaluation: <span class="font-mono" style="font-size: 13.px;">${trial.run_id}</span>`;
    
    // Switch to Output tab by default
    switchModalTab('output');
    
    // Render Output comparison
    renderOutputComparison();
    
    // Render Prompt diffs
    renderPromptDiff();

    openComparisonModal();
}

export function switchModalTab(tabName) {
    if (tabName === 'output') {
        DOM.modalTabOutput.classList.add("active");
        DOM.modalTabDiff.classList.remove("active");
        DOM.modalContentOutput.classList.add("active-content");
        DOM.modalContentOutput.style.display = "flex";
        DOM.modalContentDiff.classList.remove("active-content");
        DOM.modalContentDiff.style.display = "none";
    } else {
        DOM.modalTabOutput.classList.remove("active");
        DOM.modalTabDiff.classList.add("active");
        DOM.modalContentOutput.classList.remove("active-content");
        DOM.modalContentOutput.style.display = "none";
        DOM.modalContentDiff.classList.add("active-content");
        DOM.modalContentDiff.style.display = "flex";
    }
}

function renderOutputComparison() {
    const patchedOut = activeTrial.output_snapshot;
    if (!patchedOut) return;

    // Renders the baseline response text
    const baselineText = activeRun.baseline_output || "(No baseline response captured)";
    DOM.baselineOutputText.innerHTML = `<div>${escapeHtml(baselineText)}</div>`;

    // Handle batch execution select
    const executions = patchedOut.executions || [];
    if (executions.length > 1) {
        DOM.modalBatchSelectorRow.classList.remove("hidden");
        DOM.modalBatchButtonsContainer.innerHTML = "";
        
        executions.forEach((exec, index) => {
            const btn = document.createElement("button");
            btn.className = `btn-batch-exec ${index === selectedExecIndex ? 'active' : ''}`;
            btn.textContent = `Run ${index + 1}`;
            btn.addEventListener("click", () => {
                selectedExecIndex = index;
                // Highlight active button
                DOM.modalBatchButtonsContainer.querySelectorAll(".btn-batch-exec").forEach((b, i) => {
                    if (i === index) b.classList.add("active");
                    else b.classList.remove("active");
                });
                updateSelectedExecutionOutput(exec);
            });
            DOM.modalBatchButtonsContainer.appendChild(btn);
        });

        // Load the selected run output
        updateSelectedExecutionOutput(executions[selectedExecIndex]);
    } else {
        DOM.modalBatchSelectorRow.classList.add("hidden");
        updateSelectedExecutionOutput(patchedOut);
    }
}

function updateSelectedExecutionOutput(exec) {
    const patchedText = exec.content || "(No response content returned)";
    DOM.patchedOutputText.innerHTML = `<div>${escapeHtml(patchedText)}</div>`;

    // Stats calculations
    let statsHtml = "";
    
    // Latency comparison
    if (activeRun.baseline_latency_ms !== null && exec.latency_ms !== undefined) {
        const baseL = activeRun.baseline_latency_ms;
        const patL = exec.latency_ms;
        const diff = patL - baseL;
        const pct = (diff / baseL) * 100;
        const sign = diff >= 0 ? "+" : "";
        const colorClass = diff > 0 ? "positive" : (diff < 0 ? "negative" : "neutral");
        const badgeClass = diff > 0 ? "badge-error" : (diff < 0 ? "badge-success" : "badge-secondary");
        
        statsHtml += `
            <div class="comparison-stat-item">
                <span class="comparison-stat-label">Latency</span>
                <span class="comparison-stat-val font-mono">${patL.toFixed(0)} ms</span>
                <span class="badge ${badgeClass} trial-metric-shift ${colorClass}" style="margin: 4px 0 0 0;">
                    ${sign}${pct.toFixed(0)}% (base: ${baseL.toFixed(0)}ms)
                </span>
            </div>
        `;
    } else {
        statsHtml += `
            <div class="comparison-stat-item">
                <span class="comparison-stat-label">Latency</span>
                <span class="comparison-stat-val">-</span>
            </div>
        `;
    }

    // Token comparison
    const baseTokens = activeRun.baseline_token_usage ? activeRun.baseline_token_usage.total_tokens : null;
    const patTokens = exec.usage ? exec.usage.total_tokens : null;
    if (baseTokens !== null && baseTokens !== undefined && patTokens !== null && patTokens !== undefined) {
        const diff = patTokens - baseTokens;
        const pct = baseTokens > 0 ? (diff / baseTokens) * 100 : 0;
        const sign = diff >= 0 ? "+" : "";
        const colorClass = diff > 0 ? "positive" : (diff < 0 ? "negative" : "neutral");
        const badgeClass = diff > 0 ? "badge-error" : (diff < 0 ? "badge-success" : "badge-secondary");
        
        statsHtml += `
            <div class="comparison-stat-item">
                <span class="comparison-stat-label">Token Count</span>
                <span class="comparison-stat-val font-mono">${patTokens}</span>
                <span class="badge ${badgeClass} trial-metric-shift ${colorClass}" style="margin: 4px 0 0 0;">
                    ${sign}${pct.toFixed(0)}% (base: ${baseTokens})
                </span>
            </div>
        `;
    } else {
        statsHtml += `
            <div class="comparison-stat-item">
                <span class="comparison-stat-label">Token Count</span>
                <span class="comparison-stat-val">-</span>
            </div>
        `;
    }

    DOM.trialStatsRow.innerHTML = statsHtml;
}

function renderPromptDiff() {
    const patchedConfig = activeTrial.patched_snapshot;
    if (!patchedConfig) return;

    // 1. Render Params diff table
    DOM.diffParamsSummary.innerHTML = "";
    const paramsHtml = renderParamsDiff(activeRun, patchedConfig);
    if (paramsHtml) {
        DOM.diffParamsSummary.innerHTML = `
            <h4 class="diff-section-title"><i class="fa-solid fa-sliders"></i> Configuration Differences</h4>
            ${paramsHtml}
        `;
        DOM.diffParamsSummary.style.display = "block";
    } else {
        DOM.diffParamsSummary.style.display = "none";
    }

    // 2. Render Messages Diff
    const baselineMsgs = activeRun.messages || [];
    const patchedMsgs = patchedConfig.messages || [];
    DOM.diffMessagesContainer.innerHTML = renderMessagesDiff(baselineMsgs, patchedMsgs);
}

function renderParamsDiff(oldConfig, newConfig) {
    let rows = "";
    
    if (oldConfig.model_name !== newConfig.model_name) {
        rows += `
            <tr>
                <td><strong>Model Name</strong></td>
                <td class="diff-removed-val">${escapeHtml(oldConfig.model_name)}</td>
                <td class="diff-added-val">${escapeHtml(newConfig.model_name)}</td>
            </tr>
        `;
    }
    if (oldConfig.temperature !== newConfig.temperature) {
        const oldTempText = (oldConfig.temperature !== null && oldConfig.temperature !== undefined) ? oldConfig.temperature.toFixed(1) : "Omitted";
        const newTempText = (newConfig.temperature !== null && newConfig.temperature !== undefined) ? newConfig.temperature.toFixed(1) : "Omitted";
        rows += `
            <tr>
                <td><strong>Temperature</strong></td>
                <td class="diff-removed-val">${oldTempText}</td>
                <td class="diff-added-val">${newTempText}</td>
            </tr>
        `;
    }

    const oldToolsStr = JSON.stringify(oldConfig.tools || [], null, 2);
    const newToolsStr = JSON.stringify(newConfig.tools || [], null, 2);
    if (oldToolsStr !== newToolsStr) {
        rows += `
            <tr>
                <td><strong>Bound Tools</strong></td>
                <td colspan="2">
                    <details>
                        <summary class="pointer text-indigo">View Tools schema difference</summary>
                        <div style="margin-top: 8px;">
                            ${renderTextDiff(oldToolsStr, newToolsStr)}
                        </div>
                    </details>
                </td>
            </tr>
        `;
    }

    if (!rows) return "";

    return `
        <table class="diff-params-table">
            <thead>
                <tr>
                    <th>Parameter</th>
                    <th>Baseline</th>
                    <th>Patched</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

function renderMessagesDiff(oldMsgs, newMsgs) {
    let html = "";
    const maxLength = Math.max(oldMsgs.length, newMsgs.length);
    
    for (let i = 0; i < maxLength; i++) {
        const oldMsg = oldMsgs[i];
        const newMsg = newMsgs[i];
        
        if (oldMsg && newMsg) {
            const roleChanged = oldMsg.role !== newMsg.role;
            const nameChanged = oldMsg.name !== newMsg.name;
            const contentChanged = oldMsg.content !== newMsg.content;
            
            if (!roleChanged && !nameChanged && !contentChanged) {
                // Unchanged message
                html += `
                    <div class="diff-message-card">
                        <div class="diff-message-header">
                            <span class="role-badge ${oldMsg.role}">${oldMsg.role}</span>
                            ${oldMsg.name ? `<span class="msg-name">name: ${escapeHtml(oldMsg.name)}</span>` : ""}
                        </div>
                        <div class="diff-message-body">${escapeHtml(oldMsg.content)}</div>
                    </div>
                `;
            } else {
                // Modified message
                html += `
                    <div class="diff-message-card modified">
                        <div class="diff-message-header">
                            <span class="role-badge ${oldMsg.role}">${oldMsg.role}</span>
                            ${roleChanged ? `&rarr; <span class="role-badge ${newMsg.role}">${newMsg.role}</span>` : ""}
                            ${oldMsg.name !== newMsg.name ? `<span class="msg-name">name: ${escapeHtml(oldMsg.name || "")} &rarr; ${escapeHtml(newMsg.name || "")}</span>` : (oldMsg.name ? `<span class="msg-name">name: ${escapeHtml(oldMsg.name)}</span>` : "")}
                        </div>
                        <div class="diff-message-body">
                            ${renderTextDiff(oldMsg.content, newMsg.content)}
                        </div>
                    </div>
                `;
            }
        } else if (oldMsg) {
            // Deleted message
            html += `
                <div class="diff-message-card deleted">
                    <div class="diff-message-header">
                        <span class="role-badge ${oldMsg.role}">${oldMsg.role}</span>
                        ${oldMsg.name ? `<span class="msg-name">name: ${escapeHtml(oldMsg.name)}</span>` : ""}
                        <span class="badge badge-error" style="margin-left:auto;">Deleted</span>
                    </div>
                    <div class="diff-message-body">${escapeHtml(oldMsg.content)}</div>
                </div>
            `;
        } else if (newMsg) {
            // Added message
            html += `
                <div class="diff-message-card added">
                    <div class="diff-message-header">
                        <span class="role-badge ${newMsg.role}">${newMsg.role}</span>
                        ${newMsg.name ? `<span class="msg-name">name: ${escapeHtml(newMsg.name)}</span>` : ""}
                        <span class="badge badge-success" style="margin-left:auto;">Added</span>
                    </div>
                    <div class="diff-message-body">${escapeHtml(newMsg.content)}</div>
                </div>
            `;
        }
    }
    return html;
}

function renderTextDiff(oldText, newText) {
    const oldStr = typeof oldText === "string" ? oldText : (oldText ? JSON.stringify(oldText, null, 2) : "");
    const newStr = typeof newText === "string" ? newText : (newText ? JSON.stringify(newText, null, 2) : "");

    if (oldStr === newStr) {
        return `<div class="diff-unchanged">${escapeHtml(oldStr)}</div>`;
    }
    
    // Check if jsdiff is loaded
    if (typeof window.Diff === 'undefined') {
        return `<div style="color:var(--text-muted)">jsdiff library failed to load. Raw content:<br><pre>${escapeHtml(newStr)}</pre></div>`;
    }

    const diff = window.Diff.diffWords(oldStr, newStr);
    let html = "";
    
    diff.forEach(part => {
        const value = escapeHtml(part.value);
        if (part.added) {
            html += `<span class="diff-added">${value}</span>`;
        } else if (part.removed) {
            html += `<span class="diff-removed">${value}</span>`;
        } else {
            html += `<span>${value}</span>`;
        }
    });
    
    return `<div class="diff-container">${html}</div>`;
}

function escapeHtml(text) {
    if (!text) return "";
    if (typeof text !== "string") {
        text = JSON.stringify(text, null, 2);
    }
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
