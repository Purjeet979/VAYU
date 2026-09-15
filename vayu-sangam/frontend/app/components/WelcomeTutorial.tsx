"use client";

import React, { useState, useEffect, useCallback } from "react";

interface TutorialAvatarProps {
  isTalking?: boolean;
  pointing?: boolean;
}

// Mini Avatar for tutorial - with pointing gesture
const TutorialAvatar: React.FC<TutorialAvatarProps> = ({ isTalking = false, pointing = false }) => (
  <svg
    width="120"
    height="240"
    viewBox="0 0 100 200"
    xmlns="http://www.w3.org/2000/svg"
    className="avatar-glow-tutorial"
  >
    <defs>
      <linearGradient id="tHairBaseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2c3038" />
        <stop offset="40%" stopColor="#1c1e24" />
        <stop offset="100%" stopColor="#111215" />
      </linearGradient>
      <linearGradient id="tHairSwoopGrad" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#353b47" />
        <stop offset="50%" stopColor="#22252e" />
        <stop offset="100%" stopColor="#131418" />
      </linearGradient>
    </defs>

    {/* LEGS / PANTS */}
    <path d="M 42 145 L 39 185 L 45 185 L 49 145 Z" fill="#f1f5f9" />
    <path d="M 58 145 L 61 185 L 55 185 L 51 145 Z" fill="#f1f5f9" />
    <path d="M 33 185 L 46 185 L 46 190 C 46 192, 33 192, 33 190 Z" fill="#452710" />
    <path d="M 54 185 L 67 185 L 67 190 C 67 192, 54 192, 54 190 Z" fill="#452710" />

    {/* Left Arm - relaxed with gentle swing */}
    <g className="left-arm-t">
      <path d="M 30 85 C 18 100, 22 125, 28 138" fill="none" stroke="#facc15" strokeWidth="11" strokeLinecap="round" />
      <circle cx="27" cy="141" r="4.5" fill="#d49a75" />
    </g>

    {/* Right Arm - either presenting/gesturing or relaxed */}
    {pointing ? (
      <g className="right-arm-point">
        {/* Arm extended outward in a presenting gesture */}
        <path d="M 70 85 C 88 78, 95 70, 92 58" fill="none" stroke="#facc15" strokeWidth="11" strokeLinecap="round" />
        {/* Open palm (flat hand presenting) */}
        <ellipse cx="93" cy="55" rx="5" ry="4" fill="#d49a75" transform="rotate(-20, 93, 55)" />
      </g>
    ) : (
      <g className="right-arm-wave">
        <path d="M 70 85 C 82 100, 78 125, 72 138" fill="none" stroke="#facc15" strokeWidth="11" strokeLinecap="round" />
        <circle cx="73" cy="141" r="4.5" fill="#d49a75" />
      </g>
    )}

    {/* Torso & Kurta */}
    <path d="M 32 80 C 32 70, 68 70, 68 80 L 65 145 C 65 148, 35 148, 35 145 Z" fill="#facc15" />
    <path d="M 33 80 C 33 70, 67 70, 67 80 L 64 125 C 64 128, 36 128, 36 125 Z" fill="#1e3a8a" />
    <path d="M 45 75 L 50 95 L 55 75 Z" fill="#facc15" />
    <path d="M 47 75 L 50 85 L 53 75 Z" fill="#d49a75" />
    <path d="M 60 75 C 78 80, 75 130, 67 145 L 58 145 C 65 130, 65 85, 55 80 Z" fill="#ea580c" />
    <path d="M 59 140 L 66 140" stroke="#fbbf24" strokeWidth="2.5" />
    <path d="M 60 145 L 60 150 M 62 145 L 62 150 M 64 145 L 64 150 M 66 145 L 66 150" stroke="#fbbf24" strokeWidth="1" />
    <circle cx="50" cy="98" r="1.5" fill="#fbbf24" />
    <circle cx="50" cy="106" r="1.5" fill="#fbbf24" />
    <circle cx="50" cy="114" r="1.5" fill="#fbbf24" />
    <circle cx="50" cy="122" r="1.5" fill="#fbbf24" />
    <path d="M 38 92 L 42 92 L 40 89 Z" fill="#ef4444" />
    <path d="M 37 93 L 43 93 L 43 94 L 37 94 Z" fill="#0f172a" />
    <rect x="45" y="65" width="10" height="15" fill="#d49a75" />
    <path d="M 45 73 C 50 78, 55 73, 55 73 L 55 80 L 45 80 Z" fill="#b87d5a" />

    {/* Head Group */}
    <g className="head-group-t">
      <path d="M 32 45 C 32 75, 68 75, 68 45 C 68 20, 32 20, 32 45 Z" fill="#d49a75" />
      <path d="M 50 33 L 50 40" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="42" r="1.2" fill="#ea580c" />
      <ellipse cx="30" cy="48" rx="4" ry="6" fill="#d49a75" />
      <ellipse cx="70" cy="48" rx="4" ry="6" fill="#d49a75" />
      <path d="M 70 45 C 71.5 46, 71.5 49.5, 69.5 51" fill="none" stroke="#b87d5a" strokeWidth="0.8" strokeLinecap="round" />

      {/* Eyebrows */}
      <path d="M 37 36 L 46 39" fill="none" stroke="#171717" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 63 36 L 54 39" fill="none" stroke="#171717" strokeWidth="2.5" strokeLinecap="round" />

      {/* Eyes */}
      <g className="eyes-group-t">
        <path d="M 37 44 C 37 42, 46 42, 46 44 C 46 48, 37 48, 37 44 Z" fill="#ffffff" />
        <path d="M 63 44 C 63 42, 54 42, 54 44 C 54 48, 63 48, 63 44 Z" fill="#ffffff" />
        <circle cx="41.5" cy="45.5" r="2" fill="#171717" />
        <circle cx="58.5" cy="45.5" r="2" fill="#171717" />
        <circle cx="42.5" cy="44.5" r="0.6" fill="#fff" />
        <circle cx="59.5" cy="44.5" r="0.6" fill="#fff" />
      </g>

      {/* HAIR SYSTEM - Balanced handsome anime two-block cut */}
      {/* 1. Base Cap */}
      <path
        d="
          M 68 47
          C 67 40, 68 32, 71 28
          C 73 22, 69 15, 60 14
          C 52 11, 40 10, 30 13
          C 22 16, 20 23, 21 32
          C 22 39, 24 45, 27 48
          C 29 44, 29 38, 31 35
          C 33 34, 34 38, 36 41
          C 37 38, 39 34, 42 33
          C 43 37, 45 40, 46 39
          C 48 35, 49 32, 53 32
          C 56 31, 58 31, 60 32
          C 63 33, 66 36, 67 40
          C 67 43, 67 45, 68 47
          Z
        "
        fill="url(#tHairBaseGrad)"
      />

      {/* 2. Top Quiff Wave */}
      <path
        d="
          M 60 32
          C 55 21, 46 13, 34 13
          C 25 13, 22 19, 22 27
          C 23 34, 26 41, 29 43
          C 28 37, 29 31, 33 27
          C 37 21, 44 17, 52 18
          C 56 18, 58 24, 60 32
          Z
        "
        fill="url(#tHairSwoopGrad)"
      />

      {/* 3. Right Swept-Back Layer */}
      <path
        d="
          M 56 16
          C 64 16, 70 21, 70 28
          C 69 34, 67 38, 67 43
          C 65 37, 63 34, 59 32
          C 57 26, 56 20, 56 16
          Z
        "
        fill="#1c1f26"
      />

      {/* 4. Signature Comma Bang */}
      <path
        d="
          M 53 25
          C 47 28, 42 33, 42 38
          C 42 41, 44 41, 45 38
          C 46 34, 48 29, 53 25
          Z
        "
        fill="#222631"
      />

      {/* 5. Left Curtain Lock */}
      <path
        d="
          M 42 22
          C 35 26, 31 32, 32 39
          C 32.5 42, 34.5 42, 35 39
          C 36 35, 37 29, 42 22
          Z
        "
        fill="#1a1c22"
      />

      {/* 6. Hair Texture Flow Lines */}
      <path d="M 58 28 C 51 19, 43 14, 34 15" fill="none" stroke="#485265" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <path d="M 55 24 C 48 18, 39 16, 30 20" fill="none" stroke="#485265" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
      <path d="M 59 29 C 63 26, 66 27, 68 30" fill="none" stroke="#485265" strokeWidth="1.0" strokeLinecap="round" opacity="0.5" />
      <path d="M 60 32 C 64 32, 66 35, 67 39" fill="none" stroke="#485265" strokeWidth="0.9" strokeLinecap="round" opacity="0.4" />
      <path d="M 48 27 C 44 31, 43 35, 43.5 38.5" fill="none" stroke="#485265" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
      <path d="M 39 27 C 35 31, 34 35, 34.5 39" fill="none" stroke="#485265" strokeWidth="1.0" strokeLinecap="round" opacity="0.5" />

      {/* 7. Subtle Top Highlight */}
      <path d="M 47 14 C 40 12.5, 33 13, 27 17" fill="none" stroke="#6d7991" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      <path d="M 56 16 C 62 16, 66 19, 68 23" fill="none" stroke="#6d7991" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />

      {/* 8. Wispy Left Jaw Strand */}
      <path d="M 26 44 C 25 48, 25.5 51, 26 53" fill="none" stroke="#1c1e24" strokeWidth="1.2" strokeLinecap="round" />

      {/* Nose */}
      <path d="M 48 52 L 50 56 L 52 55" fill="none" stroke="#b87d5a" strokeWidth="1.5" strokeLinecap="round" />

      {/* Mouth */}
      <g className={isTalking ? "mouth-talking-t" : ""}>
        <path className="mouth-closed-t" d="M 44 62 Q 52 65, 56 60" fill="none" stroke="#8c4c34" strokeWidth="1.5" strokeLinecap="round" />
        <g className="mouth-open-t" style={{ display: "none" }}>
          <path d="M 44 61 Q 52 67, 56 60 Z" fill="#7f1d1d" />
          <path d="M 45 61.5 Q 51 63, 54 61.5 Z" fill="#ffffff" />
        </g>
      </g>
    </g>
    <style>
      {`
        @keyframes body-glow-t { 0%, 100% { filter: drop-shadow(0 0 12px rgba(56,189,248,0.4)); } 50% { filter: drop-shadow(0 0 30px rgba(56,189,248,0.9)); } }
        @keyframes head-tilt-t { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(3deg); } }
        @keyframes blink-t { 0%, 95%, 98%, 100% { transform: scaleY(1); } 96%, 99% { transform: scaleY(0.1); } }
        @keyframes arm-swing-t { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-5deg); } }
        @keyframes talk-t { 0%, 100% { transform: scaleY(0.7); } 50% { transform: scaleY(1.3); } }
        @keyframes point-wave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-8deg); } }
        @keyframes right-wave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(5deg); } }
        .avatar-glow-tutorial { animation: body-glow-t 3s ease-in-out infinite; }
        .head-group-t { animation: head-tilt-t 4s ease-in-out infinite; transform-origin: 50% 70px; }
        .eyes-group-t { animation: blink-t 4s infinite; transform-origin: 50% 45px; }
        .left-arm-t { animation: arm-swing-t 3s ease-in-out infinite; transform-origin: 30px 85px; }
        .right-arm-point { animation: point-wave 1s ease-in-out infinite; transform-origin: 70px 85px; }
        .right-arm-wave { animation: right-wave 3.5s ease-in-out infinite; transform-origin: 70px 85px; }
        .mouth-talking-t .mouth-closed-t { display: none !important; }
        .mouth-talking-t .mouth-open-t { display: block !important; animation: talk-t 0.15s infinite alternate; transform-origin: 50% 63px; }
      `}
    </style>
  </svg>
);

// Each step targets a real DOM element by selector
interface TutorialStep {
  title: string;
  text: string;
  selector: string | null;
  position: "center" | "below";
  selectorIndex?: number;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "🙏 Namaste! VayuSangam mein Swagat Hai!",
    text: "Main hoon aapka VayuAI Guide. Chaliye main aapko poori website ghumaata hoon!",
    selector: null, // Center screen welcome
    position: "center",
  },
  {
    title: "🏠 Home Button",
    text: "Yeh Home button hai. Kabhi bhi yahan click karke wapas landing page pe aa sakte ho jahan AQI overview aur quick links hain.",
    selector: 'a[href="/"]',
    position: "below",
  },
  {
    title: "📈 Forecast Tab",
    text: "Yeh Forecast section hai. Yahan 72-hour ka PM2.5, PM10, AQI ka detailed prediction milega. Kisi bhi station ko select karke uska data dekhiye!",
    selector: 'a[href="/forecast"]',
    position: "below",
  },
  {
    title: "🗺️ Live Map Tab",
    text: "Yeh Live Map hai. Real-time pollution hotspots, fire sources, aur wind patterns ek interactive map pe dekhiye. Kisi bhi area pe click karke details milenge!",
    selector: 'a[href="/map"]',
    position: "below",
  },
  {
    title: "📄 Reports Tab",
    text: "Yeh Reports section hai. Detailed analysis, correlation data, aur scientific insights — sab kuch data-backed aur visual format mein!",
    selector: 'a[href="/reports"]',
    position: "below",
  },
  {
    title: "🌡️ Check Current Air",
    text: "Yeh button seedha aapko current AQI forecast pe le jayega. Abhi ki air quality jaanni ho toh bas isko dabao!",
    selector: 'a[href="/forecast"]',
    position: "below",
    selectorIndex: 1, // Second forecast link (the button)
  },
  {
    title: "🤖 VayuAI Chatbot",
    text: "Aur last mein — kabhi bhi koi sawal ho toh neeche right side mein mere character pe click karna. Main humesha ready hoon! 🚀",
    selector: null,
    position: "center",
  },
];

export default function WelcomeTutorial() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [isTalking, setIsTalking] = useState(false);
  const [ready, setReady] = useState(false);
  const [highlight, setHighlight] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [charPos, setCharPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const getElementRect = useCallback((stepIdx: number) => {
    const s = tutorialSteps[stepIdx];
    if (!s.selector) return null;
    const els = document.querySelectorAll(s.selector);
    const idx = s.selectorIndex || 0;
    const el = els[idx] as HTMLElement | null;
    if (!el) return null;
    return el.getBoundingClientRect();
  }, []);

  const positionForStep = useCallback((stepIdx: number) => {
    const s = tutorialSteps[stepIdx];
    const rect = getElementRect(stepIdx);

    if (!rect || s.position === "center") {
      // Center of screen
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setHighlight(null);
      setCharPos({ x: cx - 160, y: cy - 60 });
      setBubblePos({ x: cx - 10, y: cy - 100 });
      return;
    }

    // Highlight the element
    const padding = 8;
    setHighlight({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Position character below and slightly left of the element
    const charX = Math.max(10, rect.left + rect.width / 2 - 80);
    const charY = rect.bottom + 20;
    setCharPos({ x: Math.min(charX, window.innerWidth - 140), y: Math.min(charY, window.innerHeight - 280) });

    // Position bubble to the right of character
    const bubX = charX + 130;
    const bubY = charY;
    setBubblePos({ x: Math.min(bubX, window.innerWidth - 350), y: Math.min(bubY, window.innerHeight - 200) });
  }, [getElementRect]);

  useEffect(() => {
    const seen = localStorage.getItem("vayuWelcomeDone");
    if (!seen) {
      setVisible(true);
      setTimeout(() => {
        setReady(true);
        positionForStep(0);
        setIsTalking(true);
        setTimeout(() => setIsTalking(false), 3000);
      }, 500);
    }
  }, [positionForStep]);

  useEffect(() => {
    if (!visible) return;
    positionForStep(step);
  }, [step, visible, positionForStep]);

  const nextStep = () => {
    if (step < tutorialSteps.length - 1) {
      setReady(false);
      setTimeout(() => {
        setStep(step + 1);
        setReady(true);
        setIsTalking(true);
        setTimeout(() => setIsTalking(false), 2500);
      }, 400);
    } else {
      localStorage.setItem("vayuWelcomeDone", "true");
      setReady(false);
      setTimeout(() => setVisible(false), 400);
    }
  };

  const skipTutorial = () => {
    localStorage.setItem("vayuWelcomeDone", "true");
    setReady(false);
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible) return null;

  const currentStep = tutorialSteps[step];

  return (
    <>
      {/* Full overlay with cutout for highlighted element */}
      <div className="fixed inset-0 z-[100]" style={{ pointerEvents: "auto" }}>
        {/* Dark overlay using box-shadow trick for spotlight cutout */}
        <div
          className="absolute inset-0 transition-all duration-700 ease-out"
          style={{
            background: highlight
              ? "transparent"
              : "rgba(0,0,0,0.75)",
            boxShadow: highlight
              ? `0 0 0 9999px rgba(0,0,0,0.75), inset 0 0 0 0 rgba(0,0,0,0)`
              : "none",
          }}
        />

        {/* Spotlight cutout (highlighted element) */}
        {highlight && (
          <div
            className="absolute transition-all duration-700 ease-out rounded-xl"
            style={{
              top: highlight.top,
              left: highlight.left,
              width: highlight.width,
              height: highlight.height,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.75), 0 0 30px 10px rgba(56,189,248,0.4)",
              border: "2px solid rgba(56,189,248,0.6)",
              zIndex: 101,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Character */}
        <div
          className="absolute transition-all duration-700 ease-out"
          style={{
            left: charPos.x,
            top: charPos.y,
            transform: ready ? "scale(1) translateY(0)" : "scale(0.5) translateY(50px)",
            opacity: ready ? 1 : 0,
            zIndex: 102,
            pointerEvents: "none",
          }}
        >
          <TutorialAvatar isTalking={isTalking} pointing={!!highlight} />
        </div>

        {/* Speech Bubble */}
        <div
          className="absolute transition-all duration-500 ease-out"
          style={{
            left: bubblePos.x,
            top: bubblePos.y,
            transform: ready ? "scale(1) translateY(0)" : "scale(0.9) translateY(20px)",
            opacity: ready ? 1 : 0,
            zIndex: 103,
            pointerEvents: ready ? "auto" : "none",
            width: "320px",
          }}
        >
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-5 shadow-2xl relative">
            {/* Arrow pointing left toward character */}
            <div className="absolute -left-3 top-10 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[12px] border-r-[#0f172a]" />

            {/* Step dots */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1">
                {tutorialSteps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? "w-5 bg-cyan-400" : i < step ? "w-2 bg-cyan-700" : "w-2 bg-slate-700"
                    }`}
                  />
                ))}
              </div>
              <span className="text-slate-500 text-[11px] font-mono">
                {step + 1}/{tutorialSteps.length}
              </span>
            </div>

            <h3 className="text-lg font-bold text-white mb-2">{currentStep.title}</h3>
            <p className="text-slate-300 text-[14px] leading-relaxed mb-4">{currentStep.text}</p>

            <div className="flex items-center justify-between">
              <button
                onClick={skipTutorial}
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                Skip
              </button>
              <button
                onClick={nextStep}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95 shadow-lg shadow-cyan-900/30"
              >
                {step < tutorialSteps.length - 1 ? "Aage →" : "Shuru Karein! 🚀"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
