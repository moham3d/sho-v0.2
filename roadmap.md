# 🚀 Product Roadmap: Al-Shorouk Radiology System

## 🌟 Product Vision
To transform the current functional prototype into a **premium, clinical-grade operating system** that delights users with its speed, clarity, and aesthetic excellence. We are moving from "Data Entry" to "Clinical Experience".

---

## 🎨 Design Philosophy: "Clinical Glass"
We will adopt a design language that emphasizes clarity, hygiene, and modernity.
*   **Palette:** 'Hospital Clean' White/Grays mixed with 'Trust' Blues and 'Alert' Accents. Using HSL color spaces for dynamic theming (Light/Dark modes).
*   **Materials:** Glassmorphism (frosted glass) for improved depth and hierarchy without clutter.
*   **Motion:** Subtle micro-interactions (buttery smooth transitions) to acknowledge every user action.
*   **Typography:** Professional sans-serif (Inter or outfit) for maximum readability at small sizes.

---

## 🗺️ Strategic Roadmap

### Phase 1: The "Visual Revolution" (Weeks 1-2)
*Focus: UI Overhaul & CSS Architecture*

**Goals:**
1.  **Eliminate the Monolith:** Break `custom.css` (44KB) into a modular CSS Variable-based Design System.
2.  **Immersive Layout:** Redesign the Shell (Sidebar, Header) to feel like a modern app, not a website.
3.  **Nurse Experience:** Complete overhaul of the Nurse Dashboard & Assessment Forms to be visually stunning and keyboard-friendly.

**Key Deliverables:**
*   [ ] **Design System Setup:** Define `variables.css` (Colors, Spacing, Typography).
*   [ ] **Layout Redesign:** Glassmorphic Sidebar navigation with active states.
*   [ ] **Dashboard Widgets:** Replace HTML tables with "Card" based summaries for patients.
*   [ ] **Animations:** precise CSS keyframes for page loads and modal entries.

### Phase 2: Intelligence & Velocity (Weeks 3-4)
*Focus: New Features & Data Visualization*

**Features:**
1.  **Live Ward Map:** (New Feature) A visual grid representing beds/rooms status instead of a list.
2.  **Smart Search:** Global search bar (Cmd+K style) to find Patients or Assessments instantly.
3.  **Analytics:** "Admin Command Center" showing daily throughput, average wait times, and usage stats.

### Phase 3: Connectivity (Month 2)
*Focus: HL7 & External Access*

**Features:**
1.  **Live HL7 Feed:** A "Matrix-style" real-time log viewer for incoming hospital messages.
2.  **Radiologist Workstation:** Specialized high-contrast dark mode for reading rooms.
3.  **Notification Hub:** In-app toasts/alerts for critical patient updates.

---

## 🛠️ Immediate Action Plan (Next 48 Hours)

We will start by proving the new design language on the **Nurse Dashboard**.

1.  **Establish the Look:** Create `public/css/theme.css` with our new HSL color tokens.
2.  **Refactor Layout:** Update `srv/views/partials/layout-header.ejs` to use the new CSS variables.
3.  **Pilot Redesign:** Rewrite the Nurse Dashboard to use a Card-based Grid layout instead of a table.

### 💡 User Experience Upgrade Ideas
*   **Greeting:** "Good Morning, [Name]" with a subtle weather/shift indicator.
*   **Status Indicators:** Pulsing dots for "Urgent" patients.
*   **Progress Bars:** Visual completion indicators for long Assessment forms.
