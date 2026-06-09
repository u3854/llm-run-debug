// ==========================================================================
// Main Orchestration & Entrypoint Module
// ==========================================================================

import { state } from './state.js';
import { DOM, saveModalContent, closeModal, closeComparisonModal, closeInferModal } from './ui.js';
import { fetchRunFromLangSmith, refreshRunsList, runSimulation, bulkDeleteRuns } from './api.js';
import { resetPlayground, addBlankEnvVar, addBlankMessage, validateToolsJson, toggleSelectAll, updateBulkActionBar } from './components.js';
import { refreshDeltasList, submitCreateDelta, updateDeltaFormOptions, openInferDeltaModal, saveInferredDelta } from './deltas.js';
import { executeBulkTrials, selectAllReplay, clearTrialsForDelta, refreshTrialsList } from './trials.js';
import { switchModalTab } from './diff.js';

const init = () => {
    setupEventListeners();
    refreshRunsList();
    resetPlayground();
    updateDeltaFormOptions();
    refreshDeltasList(); // Load existing deltas on startup
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

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

    // 11. View Tab Switching
    DOM.tabPlayground.addEventListener("click", () => {
        DOM.tabPlayground.classList.add("active");
        DOM.tabDeltas.classList.remove("active");
        DOM.playgroundView.classList.remove("hidden");
        DOM.deltasView.classList.add("hidden");
    });
    
    DOM.tabDeltas.addEventListener("click", () => {
        DOM.tabPlayground.classList.remove("active");
        DOM.tabDeltas.classList.add("active");
        DOM.playgroundView.classList.add("hidden");
        DOM.deltasView.classList.remove("hidden");
        refreshDeltasList();
    });

    // 12. Delta Form Options Visibility & Submission
    DOM.deltaComponent.addEventListener("change", updateDeltaFormOptions);
    DOM.deltaOperation.addEventListener("change", updateDeltaFormOptions);
    DOM.createDeltaForm.addEventListener("submit", submitCreateDelta);
    DOM.btnRefreshDeltas.addEventListener("click", refreshDeltasList);

    // 13. Replay Checklist and Execution
    DOM.btnSelectAllReplay.addEventListener("click", selectAllReplay);
    DOM.btnExecuteTrials.addEventListener("click", executeBulkTrials);
    DOM.btnRefreshTrials.addEventListener("click", refreshTrialsList);
    DOM.btnClearTrials.addEventListener("click", clearTrialsForDelta);

    // 14. Comparison Modal events
    DOM.btnCloseComparison.addEventListener("click", closeComparisonModal);
    DOM.modalOverlayComparison.addEventListener("click", closeComparisonModal);
    DOM.modalTabOutput.addEventListener("click", () => switchModalTab('output'));
    DOM.modalTabDiff.addEventListener("click", () => switchModalTab('diff'));

    // 15. Infer Delta from Playground actions
    DOM.btnInferDelta.addEventListener("click", openInferDeltaModal);
    DOM.btnCloseInfer.addEventListener("click", closeInferModal);
    DOM.btnCancelInfer.addEventListener("click", closeInferModal);
    DOM.modalOverlayInfer.addEventListener("click", closeInferModal);
    DOM.btnSaveInferred.addEventListener("click", saveInferredDelta);
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

