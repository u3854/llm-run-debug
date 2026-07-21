// ==========================================================================
// Application State & Constants
// ==========================================================================

export const state = {
    activeRunId: null,
    modelName: "gpt-4o-mini",
    temperature: 0.0,
    maxTokens: null,
    thinkingMode: "default",
    thinkingEffort: "",
    messages: [],
    tools: [],
    env_vars: {},                // Holds key-value environment pairs
    collapsedMessages: new Set(), // Set of collapsed message card indexes
    activeModalMsgIndex: null,     // Index of message active in the modal
    activeDeltaId: null,          // ID of selected Delta
    deltas: [],                   // Saved Deltas list
    trials: []                    // Recent Trials executed
};

export const API_BASE = "/api";
