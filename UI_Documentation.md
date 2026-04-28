# UI & Design System Documentation: Chat Detail Screen

This document provides a pixel-perfect, 100% comprehensive breakdown of the `src/screens/ChatDetailScreen.tsx` frontend architecture. It focuses strictly on visual styling, component structural layout, typography, animations, and the global color palette used to construct the interface.

---

## 1. Global Color Palette

Every hex code and tailwind color mapping used in the UI:

### Backgrounds & Gradients
*   **`#0f172a`** (Dark Blue/Slate): Primary screen background container color. Also the starting point of the gradient (`from-[#0f172a]`), and the icon color used inside the Send/Mic button in the footer.
*   **`#113a5a`**: Middle color of the main background gradient (`via-[#113a5a]`).
*   **`#008ba3`**: End color of the main background gradient (`to-[#008ba3]`).
*   **`bg-[#3b82f6]`**: Header avatar circle background.
*   **`bg-black/60`**: Message Actions modal backdrop.
*   **`bg-black/50`**: Fullscreen image viewer top bar.
*   **`bg-black`**: Fullscreen image viewer main background.

### Chat Bubbles
*   **`#00b4d8`**: Primary background for Sender (My) chat bubbles and the "uploading" banner.
*   **`bg-slate-800/80`**: Background for Receiver chat bubbles.
*   **`border-slate-700/50`**: Border color for Receiver chat bubbles.

### Input Bar & Footer
*   **`#009fb7`**: Background for the entire input container (in Idle text, and Recording states).
*   **`#00E5FF`**: Action button background (Mic/Send in Idle State) and the read receipt `Check` icon color.
*   **`bg-slate-800/95`**: Background color of the attachment toggle menu.

### Accents & Interaction States
*   **`blue-100`**: Chat timestamp text for Sender messages.
*   **`blue-300`**: Text color for the direct audio link.
*   **`blue-400`**: Icon color for the "Copy message" button.
*   **`blue-500`**: Gallery attachment button background & Loading spinner border.
*   **`violet-500`**: Camera attachment button background.
*   **`green-500`**: File attachment button background.
*   **`red-400` / `red-500` / `red-600`**: Trash icons, Cancel recording button, Delete-everyone action, active recording pulse dot, error messages.

### Typography & Shades
*   **`white` (`#ffffff`)**: Header text, Sender chat text, Action icons in headers, idle input placeholder (`white/80`).
*   **`slate-100`**: Text color inside Receiver chat bubbles.
*   **`slate-200`**: Header icons hover state.
*   **`slate-300`**: Header sub-title (phone number), attachment menu labels, action menu items.
*   **`slate-400`**: Timestamp text for Receiver messages, Empty state placeholder text.
*   **`white/10` & `white/20` & `white/30`**: Recording state overlays, ghost buttons, icon hovers.

---

## 2. Global Layout & Architecture

**Screen Wrapper**
*   **Direction Support:** Dynamic layout relying on the `dir` property (e.g. `dir={dir}`) which adapts automatically for LTR/RTL languages.
*   **Container:** `<div className="flex flex-col h-screen bg-[#0f172a] font-sans relative overflow-hidden">`
*   **Decoration Background:** Full viewport overlay, fixed in background: `absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3] opacity-80 pointer-events-none`.

**Structure:**
The screen uses a vertical `flex-col` layout containing three main semantic blocks:
1.  **Header:** Absolute spacing at the top (`justify-between`), overlaying the background.
2.  **Main Chat Area (`main`):** `flex-1 overflow-y-auto` allowing the conversation to consume exactly the remaining vertical viewport height minus header/footer. Added `relative z-10 px-4 py-4`. 
3.  **Footer (`footer`):** Bottom-anchored element wrapped in `mb-safe w-full relative z-40`.

---

## 3. Component-by-Component Breakdown

### 3.1 The Header
*   **Wrapper:** `<header className="flex items-center justify-between px-3 py-4 z-20">`
*   **Left Section (Back + Contact):** `flex items-center gap-3 flex-1`
    *   **Back Button:** `p-1 -ml-1 text-white hover:text-slate-200 transition-colors`. Uses `ArrowLeft`.
    *   **Avatar:** `w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center text-white font-semibold text-sm shrink-0`.
    *   **Name:** `font-semibold text-white text-[17px] leading-tight truncate max-w-[150px]`.
    *   **Phone Subtitle:** `text-[13px] text-slate-300 mt-0.5`.
*   **Right Section (Calls):** `flex items-center gap-5 text-white pr-2`
    *   **Video / Audio Icons:** Nested in a button using `hover:text-slate-200 transition-colors`.

### 3.2 Main Chat Bubbles
*   **Row Wrapper:** `<div className="flex justify-end/start">` mapped dynamically to Sender (end) or Receiver (start).
*   **Bubble Container:** Base classes `max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm cursor-pointer transition-transform active:scale-[0.98]`.
    *   **If Sender:** Appends `bg-[#00b4d8] text-white rounded-br-sm`. (The bottom-right corner becomes square-ish).
    *   **If Receiver:** Appends `bg-slate-800/80 text-slate-100 rounded-bl-sm border border-slate-700/50`. (The bottom-left corner becomes square-ish).
*   **Message Text:** `text-[15px] whitespace-pre-wrap leading-tight`.
*   **Timestamp Row:** `flex items-center justify-end gap-1 mt-1 pb-0.5`.
    *   **Time font:** `text-[10px]` with `text-blue-100` (Sender) or `text-slate-400` (Receiver).
    *   **Read Check:** The `Check` icon sizes at `w-[14px] h-[14px]`.

### 3.3 Imbedded Media in Chat
*   **Images:** Rendered as `<img className="max-w-[200px] max-h-[200px] min-w-[120px] min-h-[120px] rounded-lg object-cover bg-slate-700/50" />`. Image container wrapped in `flex flex-col gap-1 mt-1`.
*   **Audio Wrapper:** Hardcoded structural fix `mt-1 pb-1 flex flex-col gap-1` with explicit `dir="ltr"` so WebKit audio players don't break in Arabic.
    *   **Audio Element:** `<audio className="w-[240px] h-[50px] outline-none rounded-full bg-slate-100/10" style="display: block; min-width: 240px" />`. 
*   **Uploading Banner:** `<div className="max-w-[75%] px-4 py-3 rounded-2xl bg-[#00b4d8] text-white rounded-br-sm shadow-sm flex items-center gap-3">`. Spinner uses standard `w-4 h-4 border-2 border-t-transparent animate-spin`.

### 3.4 Footer / Input Area
The footer manages 3 distinct states.
*   **Wrapper:** `<footer className="px-2 pb-3 mb-safe z-40 w-full relative">`

**State 1: Idle (Text Input Mode)**
*   **Row Container:** `flex items-end gap-2`
*   **Main Input Bubble:** `flex-1 bg-[#009fb7] rounded-[28px] flex items-center shadow-sm pl-4 pr-1 min-h-[48px]`.
    *   **Textarea:** `flex-1 max-h-32 bg-transparent text-white placeholder-white/80 py-3 outline-none resize-none overflow-y-auto leading-tight`.
*   **Inline Attach/Camera Icons:** `p-2 hover:bg-white/20 rounded-full transition-colors`.
*   **Send/Mic Trigger Button:** `w-[48px] h-[48px] bg-[#00E5FF] rounded-full flex items-center justify-center text-[#0f172a] shadow-md hover:brightness-110 transition-colors`.

**State 2: Recording In Progress**
*   **Container:** `flex items-center gap-2 bg-[#009fb7] p-1 pl-2 rounded-[28px] shadow-sm animate-in fade-in zoom-in-95 duration-200`
*   **Cancel Button:** `p-3 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors`.
*   **Center UI (Blinking):** `flex-1 flex items-center justify-center gap-3 bg-white/10 rounded-full h-[48px]`. Includes an `animate-pulse w-3 h-3 bg-red-500 rounded-full`.
*   **Stop Button:** `<button className="w-[48px] h-[48px] bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors animate-pulse shrink-0">`.

**State 3: Reviewing Audio**
*   **Cancel Button:** `p-3 bg-red-400 text-white rounded-full hover:bg-red-500 transition-colors shadow-sm`.
*   **Audio Tag Container:** `flex-1 flex items-center justify-center px-1` with `dir="ltr"`.
*   **Audio Element:** `<audio className="w-[230px] h-[50px] outline-none" />`.
*   **Send Ready Button:** `<button className="w-[48px] h-[48px] bg-white rounded-full flex items-center justify-center text-[#009fb7] shadow-md hover:brightness-95 transition-colors shrink-0">`.

### 3.5 The Attachment Menu Overlay
*   **Wrapper Base:** `<div className="absolute bottom-20 left-4 right-4 bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 p-4 z-40 animate-in slide-in-from-bottom-2 fade-in">`. Note the translation off the `bottom-20` absolute pin.
*   **Internal Grid:** `grid grid-cols-3 gap-6 py-2 px-1`.
*   **Button Circles:** `w-14 h-14 rounded-full flex items-center justify-center text-white scale-100 group-hover:scale-110 transition-transform shadow-md`. Colors applied specifically: `bg-blue-500` (Gallery), `bg-violet-500` (Camera), `bg-green-500` (Files).
*   **Labels:** `text-xs text-slate-300 font-medium tracking-tight`.
*   **Dismissal Dimmer Base:** `<div className="absolute inset-0 z-30" />` wrapping underneath the attachment DOM but above main content.

### 3.6 Modals
**Message Actions Modal (Long-Press)**
*   **Base Backdrop:** `<div className="absolute inset-0 z-50 flex items-center justify-center px-4">` + `bg-black/60 backdrop-blur-sm`.
*   **Menu Box:** `bg-slate-800 rounded-2xl shadow-2xl z-10 w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200 border border-slate-700`.
*   **Action Row Base:** `flex items-center gap-3 px-6 py-4 transition-colors`.
    *   **Border top lines:** Used on secondary actions (`border-t border-slate-700/50`).

**Fullscreen Image Viewer**
*   **Container:** `fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200`. Note the ultra-high `z-[100]`.
*   **Top Bar Overlay:** `flex justify-between items-center p-4 bg-black/50 absolute top-0 left-0 right-0 z-10`.
*   **View Box:** `flex-1 flex items-center justify-center overflow-hidden p-2`.

---

## 4. Icons & Animations Mapping

### Icons (`lucide-react`)
*   **ArrowLeft:** Used in Header (`w-[22px] h-[22px] stroke-[1.5]`) and Image Viewer Back button (`w-6 h-6`).
*   **Phone:** Header Audio Call (`w-[20px] h-[20px] stroke-[1.5]`).
*   **Video:** Header Video Call (`w-[22px] h-[22px] stroke-[1.5]`).
*   **Paperclip:** Input Bar (`w-[22px] h-[22px] stroke-[1.5]`).
*   **Camera:** Input Bar (`w-[22px] h-[22px] stroke-[1.5]`) and inside the Attachment Menu Overlay (`w-6 h-6`).
*   **Mic:** Idle Footer record button (`w-5 h-5 stroke-[2.5]`).
*   **Send:** Idle Footer (`w-5 h-5 stroke-[2] ml-1`) and Audio Review Footer (`w-5 h-5 ml-1`).
*   **ImageIcon:** Attachment Menu Gallery (`w-6 h-6`).
*   **File:** Attachment Menu Document (`w-6 h-6`).
*   **Check:** Read receipt indicator (`w-[14px] h-[14px] stroke-[3]`).
*   **Copy:** Actions modal (`w-5 h-5`).
*   **Trash2:** Message Action Modal (`w-5 h-5`) and Audio Cancel Recording button (`w-5 h-5`).
*   **X:** Recording in-progress Cancel Icon (`w-5 h-5`).
*   **Square:** Recording in-progress Stop Icon (`w-5 h-5 fill-current`).

### Animations
Uses strict Tailwind classes (often driven by the `tailwindcss-animate` library semantics):
*   **`animate-spin`**: Loading spinner in `<main>` empty states and "uploading banner".
*   **`animate-pulse`**: Red recording dot wrapper and the large red stop recording `<button>`.
*   **`animate-in` + `fade-in` + `zoom-in-95` + `duration-200`**: Standard pairing applied to Footer states (Recording/Review) and Modals.
*   **`animate-in` + `fade-in` + `slide-in-from-bottom-2`**: Slide up behavior on the Attachment Menu.
*   **`transition-colors`**: Bound globally on virtually all hoverable buttons (`hover:bg-white/20`, etc).
*   **`transition-transform`**: Hover scale on Attachment menu icons (`group-hover:scale-110`) and click shrink on chat bubbles (`active:scale-[0.98]`).
