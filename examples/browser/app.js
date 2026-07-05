import { load } from "../../lib/mtgo-wasm.js";

const $ = (id) => document.getElementById(id);

let mtgo = null;
let client = null;

function setStatus(msg, isError = false) {
  const el = $("status");
  el.textContent = msg;
  el.style.background = isError ? "#fee" : "#efe";
}

function setOutput(obj) {
  $("output").textContent = JSON.stringify(obj, null, 2);
}

function buttons({ connect, invoke, disconnect }) {
  $("connectBtn").disabled = !connect;
  $("invokeBtn").disabled = !invoke;
  $("disconnectBtn").disabled = !disconnect;
}

buttons({ connect: true, invoke: false, disconnect: false });

// Pre-load the WASM module on page load so Connect is instant.
(async () => {
  try {
    setStatus("Loading WASM module…");
    mtgo = await load("../../mtgo-wasm.wasm", "../../lib/wasm_exec.js");
    setStatus("WASM module loaded. Enter credentials and click Connect.");
  } catch (err) {
    setStatus(`Failed to load WASM: ${err.message}`, true);
  }
})();

$("connectBtn").addEventListener("click", async () => {
  if (!mtgo) return setStatus("WASM not loaded yet", true);

  const apiID = parseInt($("apiID").value, 10);
  const apiHash = $("apiHash").value.trim();
  const botToken = $("botToken").value.trim();
  const sessionString = $("sessionString").value.trim();

  if (!apiID || !apiHash) {
    return setStatus("API ID and API Hash are required", true);
  }
  if (!botToken && !sessionString) {
    return setStatus("Provide a bot token or session string to authenticate", true);
  }

  try {
    setStatus("Connecting…");
    buttons({ connect: false, invoke: false, disconnect: false });

    client = mtgo.createClient({
      apiID,
      apiHash,
      botToken: botToken || undefined,
      sessionString: sessionString || undefined,
    });

    await client.connect();
    const me = client.me();
    setStatus(`Connected as ${me?.username || me?.id || "unknown"}`);
    buttons({ connect: false, invoke: true, disconnect: true });
  } catch (err) {
    setStatus(`Connect failed: ${err.message}`, true);
    buttons({ connect: true, invoke: false, disconnect: false });
  }
});

$("invokeBtn").addEventListener("click", async () => {
  if (!client) return;
  const method = $("method").value.trim();
  const paramsText = $("params").value.trim();

  try {
    setStatus(`Invoking ${method}…`);
    const params = paramsText ? JSON.parse(paramsText) : {};
    const result = await client.invoke(method, params);
    setOutput(result);
    setStatus(`OK: ${method}`);
  } catch (err) {
    setStatus(`Invoke failed: ${err.message}`, true);
    setOutput({ error: err.message });
  }
});

$("disconnectBtn").addEventListener("click", async () => {
  if (!client) return;
  try {
    setStatus("Disconnecting…");
    await client.disconnect();
    client = null;
    setStatus("Disconnected");
    buttons({ connect: true, invoke: false, disconnect: false });
  } catch (err) {
    setStatus(`Disconnect failed: ${err.message}`, true);
  }
});
