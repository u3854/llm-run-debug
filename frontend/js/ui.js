import { state } from './state.js';
import { syncMessagesFromUI, renderMessages } from './components.js';

// ==========================================================================
// DOM Elements
// ==========================================================================
export const DOM = {
    fetchForm: document.getElementById("fetch-run-form"),
    langsmithRunId: document.getElementById("langsmith-run-id"),
    btnFetch: document.getElementById("btn-fetch"),
    runsList: document.getElementById("runs-list"),
    btnRefreshList: document.getElementById("btn-refresh-list"),
    
    // Bulk Action Elements
    bulkActionBar: document.getElementById("bulk-action-bar"),
    chkSelectAll: document.getElementById("chk-select-all"),
    selectedCount: document.getElementById("selected-count"),
    bulkActionSelect: document.getElementById("bulk-action-select"),
    btnBulkApply: document.getElementById("btn-bulk-apply"),
    
    activeRunTitle: document.getElementById("active-run-title"),
    activeRunIdBadge: document.getElementById("active-run-id"),
    btnResetPlayground: document.getElementById("btn-reset-playground"),
    btnRunSimulation: document.getElementById("btn-run-simulation"),
    
    modelNameInput: document.getElementById("llm-model-name"),
    temperatureInput: document.getElementById("llm-temperature"),
    tempVal: document.getElementById("temp-val"),
    
    envContainer: document.getElementById("env-container"),
    btnAddEnv: document.getElementById("btn-add-env"),
    
    messagesContainer: document.getElementById("messages-container"),
    messageCountBadge: document.getElementById("message-count"),
    btnAddMessage: document.getElementById("btn-add-message"),
    
    toolsJsonEditor: document.getElementById("tools-json-editor"),
    toolsStatusBadge: document.getElementById("tools-status-badge"),
    toolsJsonError: document.getElementById("tools-json-error"),
    
    executionStatus: document.getElementById("execution-status"),
    metricLatency: document.getElementById("metric-latency"),
    metricTokensTotal: document.getElementById("metric-tokens-total"),
    metricTokensPrompt: document.getElementById("metric-tokens-prompt"),
    metricTokensCompletion: document.getElementById("metric-tokens-completion"),
    tokenBreakdownPanel: document.getElementById("token-breakdown-panel"),
    
    simulationOutput: document.getElementById("simulation-output-container"),
    toolCallsContainer: document.getElementById("tool-calls-container"),
    toolCallsCount: document.getElementById("tool-calls-count"),
    toastContainer: document.getElementById("toast-container"),
    
    // Modal Elements
    editorModal: document.getElementById("editor-modal"),
    modalOverlay: document.getElementById("modal-overlay"),
    modalTextarea: document.getElementById("modal-textarea"),
    modalMsgRole: document.getElementById("modal-msg-role"),
    modalCharCount: document.getElementById("modal-char-count"),
    btnSaveModal: document.getElementById("btn-save-modal"),
    btnCloseModal: document.getElementById("btn-close-modal"),
    
    // View Tab elements
    tabPlayground: document.getElementById("tab-playground"),
    tabDeltas: document.getElementById("tab-deltas"),
    playgroundView: document.getElementById("playground-view"),
    deltasView: document.getElementById("deltas-view"),
    
    // Delta Management Elements
    createDeltaForm: document.getElementById("create-delta-form"),
    deltaName: document.getElementById("delta-name"),
    deltaComponent: document.getElementById("delta-component"),
    deltaOperation: document.getElementById("delta-operation"),
    deltaRole: document.getElementById("delta-role"),
    deltaIndex: document.getElementById("delta-index"),
    deltaAnchor: document.getElementById("delta-anchor"),
    deltaValue: document.getElementById("delta-value"),
    deltaStrict: document.getElementById("delta-strict"),
    deltasList: document.getElementById("deltas-list"),
    btnRefreshDeltas: document.getElementById("btn-refresh-deltas"),
    deltaMessageOptions: document.getElementById("delta-message-options"),
    deltaAnchorGroup: document.getElementById("delta-anchor-group"),
    deltaValueLabel: document.getElementById("delta-value-label"),
    
    // Delta Replay Elements
    deltaEmptyState: document.getElementById("delta-empty-state"),
    deltaActivePanel: document.getElementById("delta-active-panel"),
    selectedDeltaName: document.getElementById("selected-delta-name"),
    selectedDeltaDetails: document.getElementById("selected-delta-details"),
    trialBatchSize: document.getElementById("trial-batch-size"),
    btnExecuteTrials: document.getElementById("btn-execute-trials"),
    deltaRunsChecklist: document.getElementById("delta-runs-checklist"),
    btnSelectAllReplay: document.getElementById("btn-select-all-replay"),
    
    // Aggregated Metrics
    metricTrialSuccess: document.getElementById("metric-trial-success"),
    metricTrialLatency: document.getElementById("metric-trial-latency"),
    metricTrialTokens: document.getElementById("metric-trial-tokens"),
    
    // Trials Logs
    trialsListTbody: document.getElementById("trials-list-tbody"),
    btnRefreshTrials: document.getElementById("btn-refresh-trials"),
    btnClearTrials: document.getElementById("btn-clear-trials"),
    
    // Comparison Modal Elements
    comparisonModal: document.getElementById("comparison-modal"),
    modalOverlayComparison: document.getElementById("modal-overlay-comparison"),
    modalComparisonTitle: document.getElementById("modal-comparison-title"),
    btnCloseComparison: document.getElementById("btn-close-comparison"),
    modalTabOutput: document.getElementById("modal-tab-output"),
    modalTabDiff: document.getElementById("modal-tab-diff"),
    modalContentOutput: document.getElementById("modal-content-output"),
    modalContentDiff: document.getElementById("modal-content-diff"),
    baselineOutputText: document.getElementById("baseline-output-text"),
    patchedOutputText: document.getElementById("patched-output-text"),
    trialStatsRow: document.getElementById("trial-stats-row"),
    diffParamsSummary: document.getElementById("diff-params-summary"),
    diffMessagesContainer: document.getElementById("diff-messages-container"),
    modalBatchSelectorRow: document.getElementById("modal-batch-selector-row"),
    modalBatchButtonsContainer: document.getElementById("modal-batch-buttons-container"),
    
    // Infer Delta Elements
    btnInferDelta: document.getElementById("btn-infer-delta"),
    inferDeltaModal: document.getElementById("infer-delta-modal"),
    modalOverlayInfer: document.getElementById("modal-overlay-infer"),
    btnCloseInfer: document.getElementById("btn-close-infer"),
    btnCancelInfer: document.getElementById("btn-cancel-infer"),
    btnSaveInferred: document.getElementById("btn-save-inferred"),
    inferDeltaName: document.getElementById("infer-delta-name"),
    inferredChangesList: document.getElementById("inferred-changes-list")
};

// ==========================================================================
// UX Utilities & Controls
// ==========================================================================

export function setLoading(element, isLoading) {
    if (!element) return;
    const btnText = element.querySelector(".btn-text");
    const spinner = element.querySelector(".spinner");
    
    if (isLoading) {
        element.disabled = true;
        if (btnText) btnText.classList.add("hidden");
        if (spinner) spinner.classList.remove("hidden");
    } else {
        element.disabled = false;
        if (btnText) btnText.classList.remove("hidden");
        if (spinner) spinner.classList.add("hidden");
    }
}

export function updateExecutionStatus(text, statusClass) {
    DOM.executionStatus.textContent = text;
    DOM.executionStatus.className = `metric-value ${statusClass}`;
}

export function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    else if (type === "error") icon = "fa-triangle-exclamation";
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    // Fade out and remove toast
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s ease reverse forwards";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================================================
// Fullscreen Message Modal Editor
// ==========================================================================

export function openModal(index) {
    // Capture current edits from input boxes
    syncMessagesFromUI();
    
    state.activeModalMsgIndex = index;
    const msg = state.messages[index];
    
    DOM.modalTextarea.value = msg.content || "";
    DOM.modalMsgRole.textContent = msg.role.toUpperCase();
    DOM.modalCharCount.textContent = `${(msg.content || "").length} characters`;
    DOM.editorModal.classList.remove("hidden");
    DOM.modalTextarea.focus();
}

export function saveModalContent() {
    if (state.activeModalMsgIndex !== null) {
        state.messages[state.activeModalMsgIndex].content = DOM.modalTextarea.value;
        const msg = state.messages[state.activeModalMsgIndex];
        renderMessages();

        // If it's a system prompt and we have a loaded run config, automatically trigger delta inference
        if (msg && msg.role === "system" && state.activeRunId) {
            setTimeout(async () => {
                const { openInferDeltaModal } = await import('./deltas.js');
                openInferDeltaModal();
            }, 150);
        }
    }
    closeModal();
}

export function closeModal() {
    DOM.editorModal.classList.add("hidden");
    state.activeModalMsgIndex = null;
}

export function openComparisonModal() {
    DOM.comparisonModal.classList.remove("hidden");
}

export function closeComparisonModal() {
    DOM.comparisonModal.classList.add("hidden");
}

export function openInferModal() {
    DOM.inferDeltaModal.classList.remove("hidden");
}

export function closeInferModal() {
    DOM.inferDeltaModal.classList.add("hidden");
}
