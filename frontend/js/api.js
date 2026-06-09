import { state, API_BASE } from './state.js';
import { DOM, showToast, setLoading, updateExecutionStatus } from './ui.js';
import { loadStateFromRunConfig, renderRunsList, syncMessagesFromUI, renderResponse, renderToolCalls } from './components.js';

export async function fetchRunFromLangSmith(runId) {
    setLoading(DOM.btnFetch, true);
    try {
        const response = await fetch(`${API_BASE}/runs/fetch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ run_id: runId })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to download run.");
        }

        const data = await response.json();
        loadStateFromRunConfig(data);
        showToast("Successfully downloaded run from LangSmith!", "success");
        DOM.langsmithRunId.value = "";
        await refreshRunsList();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        setLoading(DOM.btnFetch, false);
    }
}

export async function refreshRunsList() {
    try {
        const response = await fetch(`${API_BASE}/runs`);
        if (!response.ok) throw new Error("Failed to load runs.");
        const runs = await response.json();
        renderRunsList(runs);
    } catch (err) {
        showToast(err.message, "error");
    }
}

export async function loadRunConfig(runId) {
    try {
        const response = await fetch(`${API_BASE}/runs/${runId}`);
        if (!response.ok) throw new Error("Failed to load run details.");
        const data = await response.json();
        loadStateFromRunConfig(data);
        showToast(`Loaded run ${runId} successfully!`, "info");
    } catch (err) {
        showToast(err.message, "error");
    }
}

export async function deleteRun(runId) {
    try {
        const response = await fetch(`${API_BASE}/runs/${runId}`, {
            method: "DELETE"
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to delete run.");
        }
        showToast(`Deleted run ${runId} successfully!`, "success");
        
        // Dynamic import to avoid circular dependency issues at boot
        if (state.activeRunId === runId) {
            const { resetPlayground } = await import('./components.js');
            resetPlayground();
        }
        
        await refreshRunsList();
    } catch (err) {
        showToast(err.message, "error");
    }
}

export async function bulkDeleteRuns(runIds) {
    try {
        const response = await fetch(`${API_BASE}/runs/bulk-delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ run_ids: runIds })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to bulk delete runs.");
        }
        
        const result = await response.json();
        
        if (result.status === "partial") {
            showToast(`Partially deleted: ${result.deleted} runs succeeded.`, "error");
        } else {
            showToast(`Deleted ${result.deleted} runs successfully!`, "success");
        }

        // If the active run was deleted, reset playground
        if (runIds.includes(state.activeRunId)) {
            const { resetPlayground } = await import('./components.js');
            resetPlayground();
        }

        await refreshRunsList();
    } catch (err) {
        showToast(err.message, "error");
    }
}


export async function runSimulation() {
    // Collect updated messages from UI input fields
    syncMessagesFromUI();

    // Check if tools JSON is currently valid
    if (DOM.toolsJsonEditor.classList.contains("invalid")) {
        showToast("Cannot run: Tools contains invalid JSON syntax.", "error");
        return;
    }

    let parsedTools = [];
    if (DOM.toolsJsonEditor.value.trim()) {
        try {
            parsedTools = JSON.parse(DOM.toolsJsonEditor.value);
        } catch (e) {
            showToast("Tools JSON validation error.", "error");
            return;
        }
    }

    const payload = {
        run_id: state.activeRunId,
        model_name: state.modelName,
        temperature: state.temperature,
        messages: state.messages,
        tools: parsedTools,
        env_vars: state.env_vars // Inject customized env keys
    };

    setLoading(DOM.btnRunSimulation, true);
    updateExecutionStatus("RUNNING", "status-running");
    
    // Clear outputs
    DOM.simulationOutput.innerHTML = `<div class="empty-state"><span class="spinner"></span><p>Executing LLM invocation...</p></div>`;
    DOM.simulationOutput.classList.remove("empty-output");
    DOM.toolCallsContainer.innerHTML = '<div class="empty-state">No tool calls generated.</div>';
    DOM.toolCallsCount.textContent = "0 calls";
    DOM.metricLatency.textContent = "-";
    DOM.metricTokensTotal.textContent = "-";
    DOM.tokenBreakdownPanel.classList.add("hidden");

    try {
        const response = await fetch(`${API_BASE}/runs/test`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Server error running simulation.");
        }

        const result = await response.json();
        
        // Update outputs
        updateExecutionStatus("SUCCESS", "status-success");
        renderResponse(result.content);
        renderToolCalls(result.tool_calls);
        
        // Update metrics
        DOM.metricLatency.textContent = `${result.latency_ms.toFixed(0)} ms`;
        
        if (result.usage && result.usage.total_tokens !== undefined) {
            DOM.metricTokensTotal.textContent = result.usage.total_tokens;
            DOM.metricTokensPrompt.textContent = result.usage.prompt_tokens || "-";
            DOM.metricTokensCompletion.textContent = result.usage.completion_tokens || "-";
            DOM.tokenBreakdownPanel.classList.remove("hidden");
        } else {
            DOM.metricTokensTotal.textContent = "N/A";
        }
        
        showToast("Simulation ran successfully!", "success");
    } catch (err) {
        updateExecutionStatus("ERROR", "status-error");
        DOM.simulationOutput.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation text-error large-icon"></i><p class="text-error">${err.message}</p></div>`;
        showToast(err.message, "error");
    } finally {
        setLoading(DOM.btnRunSimulation, false);
    }
}
