"use client";

import { Toaster } from "react-hot-toast";

export function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#111827",
          color: "#e6edf3",
          border: "1px solid #30363d"
        }
      }}
    />
  );
}
