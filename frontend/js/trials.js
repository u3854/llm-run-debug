import { state, API_BASE } from './state.js';
import { DOM, showToast, setLoading } from './ui.js';
import { openTrialComparison } from './diff.js';

export async function loadActiveDeltaView(deltaId) {
    const delta = state.deltas.find(d => d.delta_id === deltaId);
    if (!delta) return;

    // Toggle panels
    DOM.deltaEmptyState.classList.add("hidden");
    DOM.deltaActivePanel.classList.remove("hidden");

    // Render Delta Details
    DOM.selectedDeltaName.textContent = delta.name;
    let detailsStr = `Target: <span class="badge badge-secondary">${delta.target_component}</span>`;
    if (delta.target_role) {
        detailsStr += ` | Role: <span class="badge badge-secondary">${delta.target_role}</span>`;
    }
    if (delta.target_index !== null) {
        detailsStr += ` | Index: <span class="badge badge-secondary">${delta.target_index}</span>`;
    }
    detailsStr += ` | Operation: <span class="badge badge-primary">${delta.operation}</span>`;
    if (delta.anchor) {
        detailsStr += ` | Anchor: <span class="badge badge-secondary">"${delta.anchor}"</span>`;
    }
    detailsStr += ` | Strict: <span class="badge ${delta.strict ? 'badge-success' : 'badge-error'}">${delta.strict}</span>`;
    DOM.selectedDeltaDetails.innerHTML = detailsStr;

    // Load Runs checklist & trials
    await loadRunsChecklist();
    await refreshTrialsList();
}

export async function loadRunsChecklist() {
    try {
        const response = await fetch(`${API_BASE}/runs`);
        if (!response.ok) throw new Error("Failed to load runs.");
        const runs = await response.json();
        
        DOM.deltaRunsChecklist.innerHTML = "";
        if (runs.length === 0) {
            DOM.deltaRunsChecklist.innerHTML = `<div class="empty-state">No saved runs. Fetch runs from the sidebar first.</div>`;
            return;
        }

        runs.forEach(run => {
            const div = document.createElement("div");
            div.className = "runs-checklist-item";
            
            div.innerHTML = `
                <input type="checkbox" id="chk-replay-${run.run_id}" data-run-id="${run.run_id}" checked>
                <label for="chk-replay-${run.run_id}" class="runs-checklist-label">
                    <span><strong>${run.run_id}</strong></span>
                    <span class="runs-checklist-model">${run.model_name}</span>
                </label>
            `;
            DOM.deltaRunsChecklist.appendChild(div);
        });
    } catch (err) {
        showToast(err.message, "error");
    }
}

export function selectAllReplay() {
    const checkboxes = DOM.deltaRunsChecklist.querySelectorAll("input[type='checkbox']");
    const allChecked = Array.from(checkboxes).every(chk => chk.checked);
    checkboxes.forEach(chk => chk.checked = !allChecked);
}

export async function executeBulkTrials() {
    if (!state.activeDeltaId) return;

    const checkedBoxes = DOM.deltaRunsChecklist.querySelectorAll("input[type='checkbox']:checked");
    if (checkedBoxes.length === 0) {
        showToast("Please select at least one run to replay against.", "error");
        return;
    }

    const runIds = Array.from(checkedBoxes).map(chk => chk.dataset.runId);
    const batchSize = parseInt(DOM.trialBatchSize.value);

    setLoading(DOM.btnExecuteTrials, true);
    try {
        const response = await fetch(`${API_BASE}/trials/bulk-execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                delta_id: state.activeDeltaId,
                run_ids: runIds,
                batch_size: batchSize
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Bulk trials execution failed.");
        }

        showToast("Bulk trials execution completed!", "success");
        await refreshTrialsList();
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        setLoading(DOM.btnExecuteTrials, false);
    }
}

export async function refreshTrialsList() {
    if (!state.activeDeltaId) return;

    try {
        // Fetch all trials
        const trialsResponse = await fetch(`${API_BASE}/trials`);
        if (!trialsResponse.ok) throw new Error("Failed to list trials.");
        const allTrials = await trialsResponse.json();

        // Filter trials by current active delta
        const filteredTrials = allTrials.filter(t => t.delta_id === state.activeDeltaId);
        state.trials = filteredTrials;

        // Fetch runs to obtain baseline metrics
        const runsResponse = await fetch(`${API_BASE}/runs`);
        const runs = runsResponse.ok ? await runsResponse.json() : [];
        const runsMap = new Map(runs.map(r => [r.run_id, r]));

        // Calculate and render Aggregated Metrics
        calculateAggregatedMetrics(filteredTrials, runsMap);

        // Render Table Rows
        renderTrialsTable(filteredTrials, runsMap);
    } catch (err) {
        showToast(err.message, "error");
    }
}

function calculateAggregatedMetrics(trials, runsMap) {
    if (trials.length === 0) {
        DOM.metricTrialSuccess.textContent = "-";
        DOM.metricTrialLatency.textContent = "-";
        DOM.metricTrialTokens.textContent = "-";
        return;
    }

    const appliedTrials = trials.filter(t => t.status === "applied");
    
    // Success rate
    DOM.metricTrialSuccess.textContent = `${appliedTrials.length} / ${trials.length} (${Math.round((appliedTrials.length / trials.length) * 100)}%)`;

    // Latency and Token differences
    let sumBaselineLatency = 0;
    let sumPatchedLatency = 0;
    let sumBaselineTokens = 0;
    let sumPatchedTokens = 0;
    
    let latencyCount = 0;
    let tokensCount = 0;

    appliedTrials.forEach(trial => {
        const run = runsMap.get(trial.run_id);
        const patchedOut = trial.output_snapshot;
        
        if (run && patchedOut) {
            // Latency comparison
            if (run.baseline_latency_ms !== null && patchedOut.latency_ms !== undefined) {
                sumBaselineLatency += run.baseline_latency_ms;
                sumPatchedLatency += patchedOut.latency_ms;
                latencyCount++;
            }
            // Tokens comparison
            const baseTokens = run.baseline_token_usage ? run.baseline_token_usage.total_tokens : null;
            const patchedTokens = patchedOut.usage ? patchedOut.usage.total_tokens : null;
            if (baseTokens !== null && baseTokens !== undefined && patchedTokens !== null && patchedTokens !== undefined) {
                sumBaselineTokens += baseTokens;
                sumPatchedTokens += patchedTokens;
                tokensCount++;
            }
        }
    });

    // Latency aggregation
    if (latencyCount > 0 && sumBaselineLatency > 0) {
        const diff = sumPatchedLatency - sumBaselineLatency;
        const avgDiff = diff / latencyCount;
        const pctDiff = (diff / sumBaselineLatency) * 100;
        
        DOM.metricTrialLatency.textContent = `${avgDiff >= 0 ? '+' : ''}${avgDiff.toFixed(0)} ms (${avgDiff >= 0 ? '+' : ''}${pctDiff.toFixed(1)}%)`;
        DOM.metricTrialLatency.className = `metric-value ${avgDiff > 0 ? 'text-error' : 'text-green'}`;
    } else {
        DOM.metricTrialLatency.textContent = "N/A";
        DOM.metricTrialLatency.className = "metric-value status-idle";
    }

    // Token usage aggregation
    if (tokensCount > 0 && sumBaselineTokens > 0) {
        const diff = sumPatchedTokens - sumBaselineTokens;
        const avgDiff = diff / tokensCount;
        const pctDiff = (diff / sumBaselineTokens) * 100;
        
        DOM.metricTrialTokens.textContent = `${avgDiff >= 0 ? '+' : ''}${avgDiff.toFixed(0)} tkn (${avgDiff >= 0 ? '+' : ''}${pctDiff.toFixed(1)}%)`;
        DOM.metricTrialTokens.className = `metric-value ${avgDiff > 0 ? 'text-error' : 'text-green'}`;
    } else {
        DOM.metricTrialTokens.textContent = "N/A";
        DOM.metricTrialTokens.className = "metric-value status-idle";
    }
}

function renderTrialsTable(trials, runsMap) {
    DOM.trialsListTbody.innerHTML = "";
    if (trials.length === 0) {
        DOM.trialsListTbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-light); padding: 20px;">
                    No trial results found. Click "Run Bulk Trials" to execute deltas.
                </td>
            </tr>
        `;
        return;
    }

    trials.forEach(trial => {
        const tr = document.createElement("tr");
        const run = runsMap.get(trial.run_id);
        
        // Status Badge
        let statusBadge = "";
        if (trial.status === "applied") {
            statusBadge = `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Applied</span>`;
        } else if (trial.status === "skipped") {
            statusBadge = `<span class="badge badge-secondary" title="${trial.reason || 'Skipped'}"><i class="fa-solid fa-ban"></i> Skipped</span>`;
        } else {
            statusBadge = `<span class="badge badge-error" title="${trial.reason || 'Failed'}"><i class="fa-solid fa-triangle-exclamation"></i> Failed</span>`;
        }

        // Latency Diff cell
        let latencyCell = "-";
        if (trial.status === "applied" && run && run.baseline_latency_ms !== null && trial.output_snapshot && trial.output_snapshot.latency_ms !== undefined) {
            const baseL = run.baseline_latency_ms;
            const patL = trial.output_snapshot.latency_ms;
            const diff = patL - baseL;
            const pct = (diff / baseL) * 100;
            const sign = diff >= 0 ? "+" : "";
            const colorClass = diff > 0 ? "positive" : (diff < 0 ? "negative" : "neutral");
            latencyCell = `
                <span class="font-mono">${patL.toFixed(0)} ms</span>
                <span class="trial-metric-shift ${colorClass}">(${sign}${pct.toFixed(0)}%)</span>
            `;
        }

        // Token Diff cell
        let tokenCell = "-";
        if (trial.status === "applied" && run && run.baseline_token_usage && run.baseline_token_usage.total_tokens !== undefined && trial.output_snapshot && trial.output_snapshot.usage && trial.output_snapshot.usage.total_tokens !== undefined) {
            const baseT = run.baseline_token_usage.total_tokens;
            const patT = trial.output_snapshot.usage.total_tokens;
            const diff = patT - baseT;
            const pct = baseT > 0 ? (diff / baseT) * 100 : 0;
            const sign = diff >= 0 ? "+" : "";
            const colorClass = diff > 0 ? "positive" : (diff < 0 ? "negative" : "neutral");
            tokenCell = `
                <span class="font-mono">${patT}</span>
                <span class="trial-metric-shift ${colorClass}">(${sign}${pct.toFixed(0)}%)</span>
            `;
        }

        tr.innerHTML = `
            <td class="font-mono" title="${trial.run_id}">${trial.run_id}</td>
            <td>${statusBadge}</td>
            <td>${latencyCell}</td>
            <td>${tokenCell}</td>
            <td>
                <div class="flex-row gap-4">
                    <button class="btn-primary btn-small btn-inspect-trial" ${trial.status !== 'applied' ? 'disabled' : ''} title="Inspect Diff and side-by-side output">
                        <i class="fa-solid fa-magnifying-glass"></i> Inspect
                    </button>
                    <button class="btn-icon text-error btn-delete-trial" title="Delete trial log">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;

        // Bind buttons
        const inspectBtn = tr.querySelector(".btn-inspect-trial");
        inspectBtn.addEventListener("click", () => {
            openTrialComparison(trial, run);
        });

        const deleteBtn = tr.querySelector(".btn-delete-trial");
        deleteBtn.addEventListener("click", async () => {
            await deleteTrial(trial.trial_id);
        });

        DOM.trialsListTbody.appendChild(tr);
    });
}

export async function deleteTrial(trialId) {
    try {
        const response = await fetch(`${API_BASE}/trials/${trialId}`, {
            method: "DELETE"
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to delete trial.");
        }
        showToast("Trial deleted successfully!", "success");
        await refreshTrialsList();
    } catch (err) {
        showToast(err.message, "error");
    }
}

export async function clearTrialsForDelta() {
    if (!state.activeDeltaId) return;

    if (confirm("Are you sure you want to clear ALL trial execution logs for this Delta?")) {
        try {
            const response = await fetch(`${API_BASE}/trials/clear/${state.activeDeltaId}`, {
                method: "DELETE"
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Failed to clear trials.");
            }
            showToast("All trials for this Delta cleared successfully!", "success");
            await refreshTrialsList();
        } catch (err) {
            showToast(err.message, "error");
        }
    }
}
