const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petAPI", {
  beginDrag: () => ipcRenderer.send("pet:beginDrag"),
  drag: () => ipcRenderer.send("pet:drag"),
  endDrag: () => ipcRenderer.send("pet:endDrag"),
  setIgnoreMouseEvents: (ignore, forward = true) =>
    ipcRenderer.send("pet:setIgnoreMouseEvents", { ignore, forward }),
  setVisibleBounds: (bounds) => ipcRenderer.send("pet:setVisibleBounds", bounds),
  getConfig: () => ipcRenderer.invoke("pet:getConfig"),
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
});
