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
    btnCloseModal: document.getElementById("btn-close-modal")
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
        renderMessages();
    }
    closeModal();
}

export function closeModal() {
    DOM.editorModal.classList.add("hidden");
    state.activeModalMsgIndex = null;
}
