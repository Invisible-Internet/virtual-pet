const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("propWindowAPI", {
  getModel: () => ipcRenderer.invoke("prop:getModel"),
  beginDrag: (propId) => ipcRenderer.invoke("prop:beginDrag", { propId }),
  drag: (propId) => ipcRenderer.invoke("prop:drag", { propId }),
  endDrag: (propId) => ipcRenderer.invoke("prop:endDrag", { propId }),
  returnToInventory: (propId) => ipcRenderer.invoke("prop:returnToInventory", { propId }),
  onModel: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("prop:model", listener);
    return () => {
      ipcRenderer.removeListener("prop:model", listener);
    };
  },
});
