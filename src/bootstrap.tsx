import React from "react";
import { createRoot } from "react-dom/client";
import { DecisionApp } from "./decision/DecisionApp";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><DecisionApp /></React.StrictMode>,
);
