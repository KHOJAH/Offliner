---
system: "Offliner Design System"
version: "2.0.0"
created: "2026-11-07"
author: "Offliner Core Team"
platform: "Cross-Platform Desktop (macOS, Linux, Windows)"
design_language: "Apple Human Interface Guidelines + Anthropic Claude Warm Minimalism"
target_canvas:
  viewport_default: { width: 1280, height: 840 }
  viewport_minimum: { width: 900, height: 600 }
  grid_container_max_width: 900
themes:
  - id: "light"
    name: "Light Mode (Daylight)"
    bg_app: "#FAFAF8"
    bg_surface: "#FFFFFF"
    border_hairline: "rgba(0, 0, 0, 0.08)"
    accent: "#0071E3"
    text_primary: "#1D1D1F"
    text_secondary: "#6E6E73"
  - id: "dark"
    name: "Dark Mode (Obsidian)"
    bg_app: "#0D0E11"
    bg_surface: "#17181C"
    border_hairline: "rgba(255, 255, 255, 0.08)"
    accent: "#2997FF"
    text_primary: "#F5F5F7"
    text_secondary: "#86868B"
  - id: "monochrome"
    name: "Monochrome Mode (Noir)"
    bg_app: "#000000"
    bg_surface: "#121212"
    border_hairline: "#262626"
    accent: "#FFFFFF"
    text_primary: "#FFFFFF"
    text_secondary: "#9E9E9E"
    saturation: "0%"
typography:
  font_sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', -system-ui, 'Segoe UI', Roboto, sans-serif"
  font_display: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif"
  font_mono: "'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace"
  scale:
    caption: { size: "11px", line_height: "1.36", weight: 500, letter_spacing: "0.02em" }
    footnote: { size: "12px", line_height: "1.4", weight: 400, letter_spacing: "0.01em" }
    body_sm: { size: "13px", line_height: "1.45", weight: 400, letter_spacing: "-0.01em" }
    body: { size: "14px", line_height: "1.47", weight: 400, letter_spacing: "-0.02em" }
    body_md: { size: "15px", line_height: "1.48", weight: 500, letter_spacing: "-0.02em" }
    headline_sm: { size: "16px", line_height: "1.4", weight: 600, letter_spacing: "-0.02em" }
    headline: { size: "18px", line_height: "1.35", weight: 700, letter_spacing: "-0.025em" }
    title_2: { size: "24px", line_height: "1.3", weight: 700, letter_spacing: "-0.03em" }
    title_1: { size: "32px", line_height: "1.25", weight: 700, letter_spacing: "-0.035em" }
    large_hero: { size: "48px", line_height: "1.15", weight: 800, letter_spacing: "-0.04em" }
radii:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
springs:
  snappy: "cubic-bezier(0.16, 1, 0.3, 1)"
  bouncy: "cubic-bezier(0.34, 1.56, 0.64, 1)"
  duration_fast: "150ms"
  duration_normal: "250ms"
  duration_slow: "400ms"
---

# Offliner Design System & Token Specification

## 1. System Philosophy
Offliner combines the tactile clarity, refined materials, and system typography of **Apple Human Interface Guidelines** with the calm, typography-first warm minimalism of **Anthropic Claude**.
- **Materiality & Translucency**: Subdued frosted glass (`backdrop-blur-md`, `backdrop-filter: blur(20px)`), razor-thin 1px hairline borders with alpha transparency, and soft ambient drop shadows.
- **Micro-Interactions**: Apple spring animation curves (`cubic-bezier(0.16, 1, 0.3, 1)`), tactile scale feedback (`active:scale-[0.98]`), and smooth progressive updates without screen flash.
- **Content Hierarchy**: Content and media always take center stage. Technical parameters (format tags, resolution badges, bitrates) are styled as compact, high-legibility pills.

## 2. Tri-Theme Color Specifications
| Token Role | Light Mode (`[data-theme="light"]`) | Dark Mode (`[data-theme="dark"]`) | Monochrome Mode (`[data-theme="monochrome"]`) |
|---|---|---|---|
| Background Canvas | `#FAFAF8` (Warm Daylight) | `#0D0E11` (Deep Obsidian) | `#000000` (Pure Noir, R=G=B=0) |
| Elevated Surface | `#FFFFFF` | `#17181C` | `#121212` (R=G=B=18) |
| Secondary Surface | `#F5F5F7` | `#222328` | `#1E1E1E` (R=G=B=30) |
| Hairline Border | `rgba(0, 0, 0, 0.08)` | `rgba(255, 255, 255, 0.08)` | `#262626` (R=G=B=38) |
| Glass Border | `rgba(0, 0, 0, 0.06)` | `rgba(255, 255, 255, 0.06)` | `rgba(255, 255, 255, 0.15)` |
| Text Primary | `#1D1D1F` (Rich Graphite) | `#F5F5F7` (Crisp Chalk) | `#FFFFFF` (Pure White, R=G=B=255) |
| Text Secondary | `#6E6E73` (Neutral Gray) | `#86868B` (Subtle Silver) | `#9E9E9E` (Mid Gray, R=G=B=158) |
| Text Tertiary | `#86868B` | `#636366` | `#666666` (R=G=B=102) |
| Primary Accent | `#0071E3` (Apple Blue) | `#2997FF` (Electric Azure) | `#FFFFFF` (Pure White, R=G=B=255) |
| Accent Hover | `#0077ED` | `#40A2FF` | `#E0E0E0` (R=G=B=224) |
| Accent Text | `#FFFFFF` | `#FFFFFF` | `#000000` (Pure Black, R=G=B=0) |
| Success Indicator | `#34C759` | `#30D158` | `#FFFFFF` (High-contrast outlined badge) |
| Warning Indicator | `#FF9500` | `#FF9F0A` | `#CCCCCC` (R=G=B=204) |
| Danger Indicator | `#FF3B30` | `#FF453A` | `#FFFFFF` (High-contrast fill) |

## 3. Mathematical Zero-Saturation Proof for Monochrome Mode
In the standard RGB color model, chromatic saturation $S$ is defined as:
$$S = \frac{\max(R, G, B) - \min(R, G, B)}{1 - |\max(R, G, B) + \min(R, G, B) - 1|}$$
When $R = G = B$, $\max(R, G, B) - \min(R, G, B) = 0$, identically yielding $S = 0.0$ (0.0000% chroma).
Every color token in Monochrome mode strictly satisfies $R = G = B$, guaranteeing complete zero chromatic saturation.

## 4. Glassmorphism & Elevation System
- **Level 1 (Subtle Paneling)**:
  `background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--border-hairline); box-shadow: 0 1px 3px rgba(0,0,0,0.04);`
- **Level 2 (Interactive Floating Cards)**:
  `border-radius: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);`
- **Level 3 (Modal & Toasts)**:
  `border-radius: 20px; box-shadow: 0 12px 32px rgba(0,0,0,0.08); border: 1px solid var(--border-hairline);`

## 5. Component Rules
- **Pills & Selectors**: Height 34px, padding 0 14px, radius 9999px or 8px, font-size 13px, font-weight 600. Active pills take `--accent` background with `--accent-text`.
- **Primary CTA Buttons**: Height 44px, padding 0 32px, radius 9999px, font-size 15px, font-weight 600, spring transition.
- **Sliders**: Track height 6px, rounded full, thumb diameter 20px with drop shadow.
- **Inputs**: Height 44px, padding 0 14px, radius 12px, background `var(--bg-surface-hover)`, border 1px solid var(--border-subtle), focus: border `--accent`, focus-ring 3px `var(--accent-subtle)`.
