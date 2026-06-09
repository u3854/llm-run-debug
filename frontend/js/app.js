// ==========================================================================
// Main Orchestration & Entrypoint Module
// ==========================================================================

import { state } from './state.js';
import { DOM, saveModalContent, closeModal } from './ui.js';
import { fetchRunFromLangSmith, refreshRunsList, runSimulation, bulkDeleteRuns } from './api.js';
import { resetPlayground, addBlankEnvVar, addBlankMessage, validateToolsJson, toggleSelectAll, updateBulkActionBar } from './components.js';

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    refreshRunsList();
    resetPlayground();
});

function setupEventListeners() {
    // 1. Fetch run from LangSmith
    DOM.fetchForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const runId = DOM.langsmithRunId.value.trim();
        if (runId) {
            await fetchRunFromLangSmith(runId);
        }
    });

    // 2. Refresh saved runs list
    DOM.btnRefreshList.addEventListener("click", refreshRunsList);

    // 3. Temperature Slider
    DOM.temperatureInput.addEventListener("input", (e) => {
        const value = parseFloat(e.target.value).toFixed(1);
        DOM.tempVal.textContent = value;
        state.temperature = parseFloat(value);
    });

    // 4. Model Name Input
    DOM.modelNameInput.addEventListener("input", (e) => {
        state.modelName = e.target.value.trim();
    });

    // 5. Tools JSON Editor Real-time Validation
    DOM.toolsJsonEditor.addEventListener("input", (e) => {
        validateToolsJson(e.target.value);
    });

    // 6. Environment keys
    DOM.btnAddEnv.addEventListener("click", addBlankEnvVar);

    // 7. Message actions
    DOM.btnAddMessage.addEventListener("click", addBlankMessage);
    DOM.btnResetPlayground.addEventListener("click", resetPlayground);
    
    // 8. Run Simulation
    DOM.btnRunSimulation.addEventListener("click", runSimulation);
    
    // 9. Modal actions
    DOM.btnSaveModal.addEventListener("click", saveModalContent);
    DOM.btnCloseModal.addEventListener("click", closeModal);
    DOM.modalOverlay.addEventListener("click", closeModal);
    DOM.modalTextarea.addEventListener("input", (e) => {
        DOM.modalCharCount.textContent = `${e.target.value.length} characters`;
    });

    // 10. Bulk actions
    DOM.chkSelectAll.addEventListener("change", (e) => {
        toggleSelectAll(e.target.checked);
    });
    DOM.bulkActionSelect.addEventListener("change", () => {
        updateBulkActionBar();
    });
    DOM.btnBulkApply.addEventListener("click", handleBulkActionApply);
}

async function handleBulkActionApply() {
    const action = DOM.bulkActionSelect.value;
    if (action === "delete") {
        const checkedBoxes = DOM.runsList.querySelectorAll(".run-checkbox:checked");
        const runIds = Array.from(checkedBoxes).map(chk => chk.dataset.runId);
        if (runIds.length > 0) {
            await bulkDeleteRuns(runIds);
        }
    }
}

