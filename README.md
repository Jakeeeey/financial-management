# Financial Management System (VOS - Master Workspace)

Modern and responsive Financial Management system built with Next.js 16, React 19, and Tailwind CSS 4. This project serves as the **Master Template** for the VOS workspace, containing a unified dependency stack for all modules.

---

## 🚀 Getting Started

Follow these steps to set up the project locally:

### 1. Installation

Clear previous module locks and perform a clean install to sync with the workspace masterlist:

```bash
rm package-lock.json && rm -rf node_modules
npm install
```

### 2. Run Development Server

Once the installation is complete, you can start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 🛠 Tech Stack & Master Dependencies

### **Core Framework & Master Controls**
- **Next.js (`^16.2.1`)**: Powers the server-side rendering, routing logic, and the central module shell infrastructure.
- **React (`19.2.3`)**: Handles the modular UI component tree and state logic for all unified operations.
- **TypeScript (`^5`)**: Provides absolute type safety for complex financial flows, API responses, and shared UI types.

### **Unified UI & Interactive Elements**
- **Tailwind CSS (`^4`)**: A utility-first styling engine used for rapid layout design across the entire workspace.
- **Shadcn UI (`^4.0.0`)**: A library of reusable, accessible UI components (buttons, inputs, cards) following standardized VOS design.
- **Framer Motion (`^12.35.2`)**: **[NEW]** Provides high-performance micro-animations and smooth layout transitions for a premium UI feel.
- **DND Kit (`^6.3.1`)**: **[NEW]** A modern drag-and-drop toolkit used for advanced resource planning and interactive layout builders.
- **Radix UI (`^1.4.3`)**: Lower-level headless primitives that ensure accessibility for all interactive workspace elements.
- **Lucide Icons (`^0.563.0`)**: A consistent icon set used for navigation, status indicators, and financial reporting.

### **State & Data Processing**
- **React Hook Form (`^7.71.1`)**: Manages high-performance data entry for complex forms like Journal Entries or Multi-step Registrations.
- **Zod (`^4.3.6`)**: Ensures strict validation of user inputs before they are committed to the central database.
- **TanStack Table (`^8.21.3`)**: The core engine for all module-wide data grids, supporting complex sorting, filtering, and pagination.
- **Recharts (`^2.15.4`)**: Powers financial visualization dashboards, cashflow trends, and performance metrics.
- **XLSX (`^0.18.5`)**: **[NEW]** Native Excel support for importing/exporting complex financial data sheets directly from the browser.

### **Advanced Utilities & Printing**
- **jsPDF (`^4.2.0`) & AutoTable (`^5.0.7`)**: Integrated to generate professional, pixel-perfect PDF reports and printable financial statements.
- **QRCode.React (`^4.2.0`)**: **[NEW]** Support for generating and rendering dynamic QR codes for digital employee identification or asset tracking.
- **Browser Image Compression (`^2.0.2`)**: Optimizes file uploads like supplier receipts or asset photos to ensure peak upload performance.
- **html-to-image (`^1.11.13`)**: **[NEW]** Allows generating image snapshots of specific UI elements for export or thumbnail generation.

---
