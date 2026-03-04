const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("inventoryAPI", {
  getShellState: () => ipcRenderer.invoke("pet:getShellState"),
  getObservabilitySnapshot: () => ipcRenderer.invoke("pet:getObservabilitySnapshot"),
  getSetupBootstrapSnapshot: () => ipcRenderer.invoke("pet:getSetupBootstrapSnapshot"),
  previewSetupBootstrap: (input) => ipcRenderer.invoke("pet:previewSetupBootstrap", { input }),
  applySetupBootstrap: (input) => ipcRenderer.invoke("pet:applySetupBootstrap", { input }),
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
