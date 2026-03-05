const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("inventoryAPI", {
  getShellState: () => ipcRenderer.invoke("pet:getShellState"),
  getObservabilitySnapshot: () => ipcRenderer.invoke("pet:getObservabilitySnapshot"),
  getObservabilityDetail: (subjectId) =>
    ipcRenderer.invoke("pet:getObservabilityDetail", { subjectId }),
  runObservabilityAction: (actionId, subjectId) =>
    ipcRenderer.invoke("pet:runObservabilityAction", { actionId, subjectId }),
  getSetupBootstrapSnapshot: () => ipcRenderer.invoke("pet:getSetupBootstrapSnapshot"),
  previewSetupBootstrap: (input) => ipcRenderer.invoke("pet:previewSetupBootstrap", { input }),
  applySetupBootstrap: (input) => ipcRenderer.invoke("pet:applySetupBootstrap", { input }),
  getShellSettingsSnapshot: () => ipcRenderer.invoke("pet:getShellSettingsSnapshot"),
  applyShellSettingsPatch: (patch) => ipcRenderer.invoke("pet:applyShellSettingsPatch", { patch }),
  runShellAction: (actionId) => ipcRenderer.invoke("pet:runShellAction", { actionId }),
  setActiveTab: (tabId) => ipcRenderer.invoke("inventory:setActiveTab", { tabId }),
  beginPropPlacement: (propId) => ipcRenderer.invoke("inventory:beginPropPlacement", { propId }),
  updatePropPlacement: (propId) => ipcRenderer.invoke("inventory:updatePropPlacement", { propId }),
  endPropPlacement: (propId, commit = true) =>
    ipcRenderer.invoke("inventory:endPropPlacement", { propId, commit }),
  onShellState: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("pet:shell-state", listener);
    return () => {
      ipcRenderer.removeListener("pet:shell-state", listener);
    };
  },
});
