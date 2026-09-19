import fs from "node:fs";
import { renderFilesToScreenshot, closeRenderer } from "../src/renderer/renderer.js";
(async () => {
  const files = [
    { path: "App.tsx", content: `
import React from "react";
import { createRoot } from "react-dom/client";
function App() {
  return React.createElement("div", { style: { padding: 20, background: "#eef4ff", height: "100vh" } },
    React.createElement("h1", { style: { color: "#1a60d1" } }, "React render OK"),
    React.createElement("div", { style: { width: 200, height: 60, background: "#548ef5", marginTop: 16 } }, "card")
  );
}
createRoot(document.getElementById("root")!).render(React.createElement(App));
` },
  ];
  const r = await renderFilesToScreenshot(files, "App.tsx", { width: 640, height: 400 });
  fs.writeFileSync("output/local-ui/react-render.png", r.screenshot);
  console.log("consoleErrors:", r.consoleErrors);
  console.log("screenshot bytes:", r.screenshot.length);
  await closeRenderer();
})();
