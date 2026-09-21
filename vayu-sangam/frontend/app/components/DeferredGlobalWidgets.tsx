"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";

type Widget = ComponentType;

export default function DeferredGlobalWidgets() {
  const [ChatbotWidget, setChatbotWidget] = useState<Widget | null>(null);
  const [WelcomeTutorial, setWelcomeTutorial] = useState<Widget | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadWidgets = () => {
      Promise.all([
        import("./ChatbotWidget"),
        import("./WelcomeTutorial"),
      ]).then(([chat, tutorial]) => {
        if (cancelled) return;
        setChatbotWidget(() => chat.default);
        setWelcomeTutorial(() => tutorial.default);
      }).catch(() => {
        // The core page remains usable when an optional widget chunk fails.
      });
    };

    const idle = window.requestIdleCallback;
    if (idle) {
      const handle = idle(loadWidgets, { timeout: 1800 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(handle);
      };
    }

    const handle = window.setTimeout(loadWidgets, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, []);

  return (
    <>
      {WelcomeTutorial ? <WelcomeTutorial /> : null}
      {ChatbotWidget ? <ChatbotWidget /> : null}
    </>
  );
}
