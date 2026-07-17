import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { LudoArena } from "../LudoArena";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LudoArena />
  </StrictMode>,
);
