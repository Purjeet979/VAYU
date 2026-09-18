"use client";

import React, { useState, useEffect, useRef } from "react";

interface AvatarFaceProps {
  isSpeaking: boolean;
  size?: number;
  width?: number;
  height?: number;
  className?: string;
}

const MAX_PUPIL = 1.5;

export default function AvatarFace({
  isSpeaking,
  size = 150,
  width,
  height,
  className = "",
}: AvatarFaceProps) {
  const w = width ?? size;
  const h = height ?? Math.round(w * 2);

  const containerRef = useRef<HTMLDivElement>(null);
  const [pupilOff, setPupilOff] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const VW = 100, VH = 200;
    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (VW / rect.width);
      const my = (e.clientY - rect.top) * (VH / rect.height);
      const dx = mx - 50;
      const dy = my - 45;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const inf = Math.min(dist / 40, 1);
      setPupilOff({ x: (dx / dist) * MAX_PUPIL * inf, y: (dy / dist) * MAX_PUPIL * inf });
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  const px = pupilOff.x.toFixed(2);
  const py = pupilOff.y.toFixed(2);

  return (
    <div
      ref={containerRef}
      className={`relative select-none flex items-end justify-center ${className}`}
      style={{ width: w, height: h }}
    >
      <svg
        width={w}
        height={h}
        viewBox="0 0 100 200"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible" }}
        className="avatar-float"
      >
        <defs>
          <radialGradient id="aura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.5)" />
            <stop offset="70%" stopColor="rgba(56, 189, 248, 0.2)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0)" />
          </radialGradient>

          {/* Hair Gradients */}
          <linearGradient id="hairBaseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2c3038" />
            <stop offset="40%" stopColor="#1c1e24" />
            <stop offset="100%" stopColor="#111215" />
          </linearGradient>
          <linearGradient id="hairSwoopGrad" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#353b47" />
            <stop offset="50%" stopColor="#22252e" />
            <stop offset="100%" stopColor="#131418" />
          </linearGradient>
          <linearGradient id="hairRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#282c35" />
            <stop offset="100%" stopColor="#121316" />
          </linearGradient>
          <linearGradient id="hairCrestGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3d4352" />
            <stop offset="60%" stopColor="#252933" />
            <stop offset="100%" stopColor="#15171c" />
          </linearGradient>
        </defs>

        {/* GLOWING AURA EFFECT */}
        <circle cx="50" cy="100" r="85" fill="url(#aura)" className="aura-pulse" />

        {/* LEGS / PANTS (White/Cream fitted pajama, confident stance) */}
        <path d="M 42 145 L 39 185 L 45 185 L 49 145 Z" fill="#f1f5f9" />
        <path d="M 58 145 L 61 185 L 55 185 L 51 145 Z" fill="#f1f5f9" />
        
        {/* SHOES (Brown Loafers, angled slightly outwards) */}
        <path d="M 33 185 L 46 185 L 46 190 C 46 192, 33 192, 33 190 Z" fill="#452710" />
        <path d="M 54 185 L 67 185 L 67 190 C 67 192, 54 192, 54 190 Z" fill="#452710" />

        {/* ARMS / SLEEVES (Yellow Kurta) */}
        <g className="left-arm">
          <path d="M 30 85 C 18 100, 22 125, 28 138" fill="none" stroke="#facc15" strokeWidth="11" strokeLinecap="round" />
          <circle cx="27" cy="141" r="4.5" fill="#d49a75" />
        </g>

        <path d="M 70 85 C 82 100, 78 125, 72 138" fill="none" stroke="#facc15" strokeWidth="11" strokeLinecap="round" />
        <circle cx="73" cy="141" r="4.5" fill="#d49a75" />

        {/* TORSO / KURTA BASE (Yellow) */}
        <path d="M 32 80 C 32 70, 68 70, 68 80 L 65 145 C 65 148, 35 148, 35 145 Z" fill="#facc15" />
        
        {/* NEHRU JACKET (Navy Blue) */}
        <path d="M 33 80 C 33 70, 67 70, 67 80 L 64 125 C 64 128, 36 128, 36 125 Z" fill="#1e3a8a" />
        
        {/* Jacket Collar / Neck cut */}
        <path d="M 45 75 L 50 95 L 55 75 Z" fill="#facc15" /> 
        <path d="M 47 75 L 50 85 L 53 75 Z" fill="#d49a75" /> 
        
        {/* TRADITIONAL SCARF / STOLE (Saffron draped over right shoulder) */}
        <path d="M 60 75 C 78 80, 75 130, 67 145 L 58 145 C 65 130, 65 85, 55 80 Z" fill="#ea580c" />
        <path d="M 59 140 L 66 140" stroke="#fbbf24" strokeWidth="2.5" />
        <path d="M 60 145 L 60 150 M 62 145 L 62 150 M 64 145 L 64 150 M 66 145 L 66 150" stroke="#fbbf24" strokeWidth="1" />

        {/* Jacket Buttons (Gold) */}
        <circle cx="50" cy="98" r="1.5" fill="#fbbf24" />
        <circle cx="50" cy="106" r="1.5" fill="#fbbf24" />
        <circle cx="50" cy="114" r="1.5" fill="#fbbf24" />
        <circle cx="50" cy="122" r="1.5" fill="#fbbf24" />

        {/* Pocket Square (Red) */}
        <path d="M 38 92 L 42 92 L 40 89 Z" fill="#ef4444" />
        <path d="M 37 93 L 43 93 L 43 94 L 37 94 Z" fill="#0f172a" />

        {/* NECK */}
        <rect x="45" y="65" width="10" height="15" fill="#d49a75" />
        <path d="M 45 73 C 50 78, 55 73, 55 73 L 55 80 L 45 80 Z" fill="#b87d5a" />

        {/* HEAD GROUP (Animated to tilt slightly) */}
        <g className="head-group">
          <path d="M 32 45 C 32 75, 68 75, 68 45 C 68 20, 32 20, 32 45 Z" fill="#d49a75" />
          
          {/* TILAK */}
          <path d="M 50 33 L 50 40" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="42" r="1.2" fill="#ea580c" />

          {/* EARS */}
          <ellipse cx="30" cy="48" rx="4" ry="6" fill="#d49a75" />
          <ellipse cx="70" cy="48" rx="4" ry="6" fill="#d49a75" />
          {/* Right inner ear detail */}
          <path d="M 70 45 C 71.5 46, 71.5 49.5, 69.5 51" fill="none" stroke="#b87d5a" strokeWidth="0.8" strokeLinecap="round" />

          {/* HAIR SYSTEM - Balanced handsome anime two-block cut */}
          {/* 1. Full Cohesive Base Cap (Full volume on both sides, perfectly framing the face) */}
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
            fill="url(#hairBaseGrad)"
          />

          {/* 2. Top Quiff Wave (Full, thick, sweeping over top-left) */}
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
            fill="url(#hairSwoopGrad)"
          />

          {/* 3. Right Swept-Back Layer (Gives body and shape to right side) */}
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

          {/* 4. Signature Soft Comma Bang (Curving gracefully over left eyebrow) */}
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

          {/* 5. Left Curtain Lock (Framing the left eye) */}
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

          {/* 6. Hair Texture Flow Lines (Crisp manga styling) */}
          <path d="M 58 28 C 51 19, 43 14, 34 15" fill="none" stroke="#485265" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          <path d="M 55 24 C 48 18, 39 16, 30 20" fill="none" stroke="#485265" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
          
          {/* Right side flow */}
          <path d="M 59 29 C 63 26, 66 27, 68 30" fill="none" stroke="#485265" strokeWidth="1.0" strokeLinecap="round" opacity="0.5" />
          <path d="M 60 32 C 64 32, 66 35, 67 39" fill="none" stroke="#485265" strokeWidth="0.9" strokeLinecap="round" opacity="0.4" />

          {/* Bang flow */}
          <path d="M 48 27 C 44 31, 43 35, 43.5 38.5" fill="none" stroke="#485265" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
          <path d="M 39 27 C 35 31, 34 35, 34.5 39" fill="none" stroke="#485265" strokeWidth="1.0" strokeLinecap="round" opacity="0.5" />

          {/* 7. Subtle Top Highlight */}
          <path d="M 47 14 C 40 12.5, 33 13, 27 17" fill="none" stroke="#6d7991" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
          <path d="M 56 16 C 62 16, 66 19, 68 23" fill="none" stroke="#6d7991" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />

          {/* 8. Wispy Left Jaw Strand */}
          <path d="M 26 44 C 25 48, 25.5 51, 26 53" fill="none" stroke="#1c1e24" strokeWidth="1.2" strokeLinecap="round" />

          {/* EYEBROWS */}
          <path d="M 37 36 L 46 39" fill="none" stroke="#171717" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 63 36 L 54 39" fill="none" stroke="#171717" strokeWidth="2.5" strokeLinecap="round" />

          {/* EYES GROUP (Animated to blink + interactive mouse tracking pupils) */}
          <g className="eyes-group">
            <path d="M 37 44 C 37 42, 46 42, 46 44 C 46 48, 37 48, 37 44 Z" fill="#ffffff" />
            <path d="M 63 44 C 63 42, 54 42, 54 44 C 54 48, 63 48, 63 44 Z" fill="#ffffff" />
            
            {/* Pupils wrapped with mouse tracking translation */}
            <g transform={`translate(${px},${py})`} style={{ transition: "transform 0.08s ease-out" }}>
              <circle cx="41.5" cy="45.5" r="2" fill="#171717" />
              <circle cx="58.5" cy="45.5" r="2" fill="#171717" />
              <circle cx="42.5" cy="44.5" r="0.6" fill="#fff" />
              <circle cx="59.5" cy="44.5" r="0.6" fill="#fff" />
            </g>
          </g>

          {/* NOSE */}
          <path d="M 48 52 L 50 56 L 52 55" fill="none" stroke="#b87d5a" strokeWidth="1.5" strokeLinecap="round" />

          {/* SMIRK MOUTH */}
          <g className={isSpeaking ? "mouth-talking" : ""}>
            <path className="mouth-closed" d="M 44 62 Q 52 65, 56 60" fill="none" stroke="#8c4c34" strokeWidth="1.5" strokeLinecap="round" />
            <g className="mouth-open hidden">
              <path d="M 44 61 Q 52 67, 56 60 Z" fill="#7f1d1d" />
              <path d="M 45 61.5 Q 51 63, 54 61.5 Z" fill="#ffffff" />
            </g>
          </g>
        </g>

        <style>
          {`
            @keyframes talk-pro { 0%, 100% { transform: scaleY(0.7); } 50% { transform: scaleY(1.3); } }
            @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
            @keyframes aura-fade { 0%, 100% { opacity: 0.5; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } }
            @keyframes head-tilt { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(3deg); } }
            @keyframes blink { 0%, 95%, 98%, 100% { transform: scaleY(1); } 96%, 99% { transform: scaleY(0.1); } }
            @keyframes arm-swing { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-4deg); } }

            .mouth-talking .mouth-closed { display: none; }
            .mouth-talking .mouth-open { display: block; animation: talk-pro 0.15s infinite alternate; transform-origin: 50% 63px; }
            .avatar-float { animation: float 4s ease-in-out infinite; }
            .aura-pulse { animation: aura-fade 3s ease-in-out infinite; transform-origin: 50% 100px; }
            .head-group { animation: head-tilt 5s ease-in-out infinite; transform-origin: 50% 70px; }
            .eyes-group { animation: blink 5s infinite; transform-origin: 50% 45px; }
            .left-arm { animation: arm-swing 4s ease-in-out infinite; transform-origin: 30px 85px; }
          `}
        </style>
      </svg>
    </div>
  );
}
