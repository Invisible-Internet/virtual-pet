const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zoneSelectorAPI", {
  getModel: () => ipcRenderer.invoke("zoneSelector:getModel"),
  commit: (rect) => ipcRenderer.invoke("zoneSelector:commit", { rect }),
  cancel: () => ipcRenderer.invoke("zoneSelector:cancel"),
  onModel: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("zone-selector:model", listener);
    return () => {
      ipcRenderer.removeListener("zone-selector:model", listener);
    };
  },
});
