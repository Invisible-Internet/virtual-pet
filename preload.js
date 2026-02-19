const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petAPI", {
  beginDrag: () => ipcRenderer.send("pet:beginDrag"),
  drag: () => ipcRenderer.send("pet:drag"),
  endDrag: () => ipcRenderer.send("pet:endDrag"),
  getConfig: () => ipcRenderer.invoke("pet:getConfig"),
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
});
