const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petAPI", {
  beginDrag: () => ipcRenderer.send("pet:beginDrag"),
  drag: () => ipcRenderer.send("pet:drag"),
  endDrag: () => ipcRenderer.send("pet:endDrag"),
  setIgnoreMouseEvents: (ignore, forward = true) =>
    ipcRenderer.send("pet:setIgnoreMouseEvents", { ignore, forward }),
  setVisibleBounds: (bounds) => ipcRenderer.send("pet:setVisibleBounds", bounds),
  getConfig: () => ipcRenderer.invoke("pet:getConfig"),
  getCapabilitySnapshot: () => ipcRenderer.invoke("pet:getCapabilitySnapshot"),
  getContractTrace: () => ipcRenderer.invoke("pet:getContractTrace"),
  runUserCommand: (command) => ipcRenderer.invoke("pet:runUserCommand", { command }),
  getExtensions: () => ipcRenderer.invoke("pet:getExtensions"),
  setExtensionEnabled: (extensionId, enabled) =>
    ipcRenderer.invoke("pet:setExtensionEnabled", { extensionId, enabled }),
  interactWithExtensionProp: (extensionId, propId, interactionType = "click") =>
    ipcRenderer.invoke("pet:interactWithExtensionProp", {
      extensionId,
      propId,
      interactionType,
    }),
  getAnimationManifest: (characterId) =>
    ipcRenderer.invoke("pet:getAnimationManifest", characterId),
  onMotion: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("pet:motion", listener);

    return () => {
      ipcRenderer.removeListener("pet:motion", listener);
    };
  },
  onDiagnostics: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("pet:diagnostics", listener);

    return () => {
      ipcRenderer.removeListener("pet:diagnostics", listener);
    };
  },
  onCursor: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("pet:cursor", listener);

    return () => {
      ipcRenderer.removeListener("pet:cursor", listener);
    };
  },
  onCapabilities: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("pet:capabilities", listener);

    return () => {
      ipcRenderer.removeListener("pet:capabilities", listener);
    };
  },
  onExtensions: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("pet:extensions", listener);

    return () => {
      ipcRenderer.removeListener("pet:extensions", listener);
    };
  },
  onExtensionEvent: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("pet:extension-event", listener);

    return () => {
      ipcRenderer.removeListener("pet:extension-event", listener);
    };
  },
  onContractTrace: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("pet:contract-trace", listener);

    return () => {
      ipcRenderer.removeListener("pet:contract-trace", listener);
    };
  },
  onContractSuggestion: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("pet:contract-suggestion", listener);

    return () => {
      ipcRenderer.removeListener("pet:contract-suggestion", listener);
    };
  },
});
