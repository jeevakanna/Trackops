# TrackOps 🚀
### Production-Grade Retail, Inventory & Accrual Accounting System for small businesses

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.3.0-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.17-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6.0.7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-1.64.1-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TrackOps is an offline-capable, high-throughput retail management and operational suite designed specifically for comic book stalls, pop-culture conventions, pop-up stalls, and independent merchandise retailers. It bridges the gap between chaotic on-the-floor point-of-sale checkout and rigorous, accrual-aware financial accounting.

---

## 🌟 Key Features

* **⚡ Fast Point-of-Sale (POS)**
  * Keyboard & barcode-free rapid search and add-to-cart workflow.
  * Instant dual-payment support: **Cash** and **UPI**.
  * Sequential unique transaction numbers (`S-0001`, `S-0002`).
  * Atomic stock reduction with strict safeguards against negative balances.

* **📦 Catalog & Inventory Tracking**
  * Multi-variant items (e.g., Comics, Manga, Graphic Novels, Figurines, Posters).
  * Unit types (`pcs`, `sets`, `packs`) with independent cost and selling price margins.
  * Real-time automated stock movement audit ledger recording additions, deductions, reasons, and timestamps.

* **💼 Vendor Purchasing & Restock Management**
  * Vendor purchase orders with unique references (`P-0001`, `P-0002`).
  * Auto-computes unit cost basis and adjusts inventory on confirmation.
  * Vendor notes and line-item historical records.

* **📊 Accrual-Aware Financial Accounting**
  * **Retail Accounting Logic**: Stock purchases are classified as asset acquisitions (*Money Out*). They only impact the Profit & Loss statement as **Cost of Goods Sold (COGS)** when items are sold.
  * **Net Profit Equation**:  
    $$\text{Net Profit} = \text{Sales Revenue} + \text{Other Income} - \text{COGS} - \text{Operating Expenses}$$
  * Dedicated registers for daily operational expenses (stall rent, stall electricity, transport, food) and miscellaneous income.
  * Midnight-to-midnight Asia/Kolkata date handling in Indian Rupee (**₹**).

* **📄 Executive Exports & Reports**
  * One-click print-ready **PDF export** using `jsPDF` and `jspdf-autotable`.
  * Comprehensive multi-tab **Excel workbook export** powered by `SheetJS (xlsx)`.

* **🛡️ Enterprise Reliability & Single-Port Delivery**
  * Express 5 serves both the REST API and the pre-compiled, optimized static React assets on **Port 5000**.
  * Zero development server overhead in production, sub-10ms response times, and full offline resilience.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Client ["Client Tier (Browser / React 18)"]
        UI["React 18 SPA (TypeScript + Tailwind CSS)"]
        HashRouter["Hash-Based Route Navigation"]
        PDFGen["jsPDF + AutoTable Export Engine"]
        ExcelGen["SheetJS (xlsx) Engine"]
    end

    subgraph Server ["Server Tier (Node.js 20+ / Express 5)"]
        ExpressApp["Express 5 Web Server"]
        StaticServe["Static Production Server (dist/)"]
        APIRouter["REST API Controller Layer (/api/*)"]
        DBPool["pg.Pool Connection Pooler"]
    end

    subgraph Database ["Database Tier (PostgreSQL)"]
        ProdDB[("trackops_prod (Port 5432)")]
    end

    UI -->|HTTP / JSON Requests| StaticServe
    UI -->|REST Endpoints /api/*| APIRouter
    APIRouter --> DBPool
    DBPool -->|TCP / SQL Pool| ProdDB
```

---

## 📁 Repository Structure

```
trackops/
├── .github/                       # GitHub Actions CI workflow & issue/PR templates
│   ├── workflows/ci.yml           # Automated build validation pipeline
│   ├── ISSUE_TEMPLATE/            # Bug report and feature request templates
│   └── pull_request_template.md   # Standardized PR checklist
├── docs/                          # Comprehensive technical and operational documentation
│   ├── architecture/              # System topology & retail operational workflows
│   │   ├── ARCHITECTURE.md
│   │   └── WORKFLOW_DOCUMENTATION.md
│   ├── operations/                # Runbooks, production operations & deployment
│   │   ├── DEPLOYMENT.md
│   │   └── PRODUCTION_OPERATIONS_MANUAL.md
│   ├── requirements/              # PRDs, BRD, and REST API specification
│   │   ├── TrackOps_PRD_v1.0.md
│   │   ├── TrackOps_PRD_v1.3.md
│   │   ├── TrackOps — API Documentation.pdf
│   │   └── TrackOps — Business Requirements Document (BRD).pdf
│   ├── testing/                   # Test report matrices & execution sheets
│   │   ├── UAT_TEST_REPORT.md
│   │   └── manual test trackops.xlsx
│   ├── CHANGELOG.md               # Version history and migration logs
│   └── README.md                  # Documentation navigation hub
├── server/                        # Express 5 backend & database scripts
│   ├── db.ts                      # PostgreSQL pool configuration
│   ├── index.ts                   # REST API routes & static asset server
│   ├── schema.sql                 # Core products table
│   ├── sales_purchases_schema.sql # Sales, Purchases & inventory movement schema
│   ├── finances.sql               # Income & expense ledger schema
│   ├── migration_fk_set_null.sql  # Data integrity & cascade safeguards
│   ├── sample_data.sql            # Demo inventory and seed data
│   └── README.md                  # Database execution order guide
├── src/                           # React frontend application
│   ├── components/                # Reusable UI components (Header, Sidebar, Toast)
│   ├── pages/                     # Application views (Sales, Purchases, Inventory, Finances)
│   ├── services/                  # API client, storage & report generators
│   ├── types/                     # TypeScript data contracts & interfaces
│   ├── utils/                     # Accounting formulas, currency & date formatters
│   ├── App.tsx                    # Main app shell & hash router
│   ├── main.tsx                   # React DOM entry point
│   └── index.css                  # Tailwind CSS root stylesheet
├── tests/                         # Automated end-to-end and integration tests
│   ├── test_ui.ts                 # Playwright responsive viewport & interaction test
│   └── test_cr002.ts              # End-to-end change request validation
├── .env.example                   # Environment configuration template
├── .gitignore                     # Git exclusions (credentials, node_modules, dist)
├── CONTRIBUTING.md                 # Contribution guidelines & branch conventions
├── LICENSE                        # MIT Open Source License
├── package.json                   # Project manifest & npm scripts
├── SECURITY.md                    # Responsible disclosure policy
├── start_trackops.bat             # 1-Click launcher for Windows
└── start_trackops.sh              # 1-Click launcher for Linux / macOS
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: `v20.x` or higher
* **npm**: `v10.x` or higher
* **PostgreSQL**: `v14.x` or higher

### 1. Clone the Repository
```bash
git clone https://github.com/jeevakanna/trackops.git
cd trackops
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and configure your PostgreSQL database connection:
```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://trackops:trackops@localhost:5432/trackops_prod
PORT=5000
```

### 4. Initialize Database Schema
Create the database in PostgreSQL, then run the SQL scripts in `server/` in order:
```bash
# Example using psql
psql -U postgres -c "CREATE DATABASE trackops_prod;"
psql -U trackops -d trackops_prod -f server/schema.sql
psql -U trackops -d trackops_prod -f server/sales_purchases_schema.sql
psql -U trackops -d trackops_prod -f server/finances.sql
psql -U trackops -d trackops_prod -f server/migration_fk_set_null.sql

# (Optional) Seed demo catalog data:
psql -U trackops -d trackops_prod -f server/sample_data.sql
```
*(For detailed schema explanations, see [server/README.md](server/README.md).)*

---

## 💻 Running the Application

### Development Mode (Concurrent Vite + Express)
Runs the Vite frontend dev server with Hot Module Replacement (HMR) and the Express backend concurrently:
```bash
npm run dev:all
```
* **Frontend**: `http://localhost:3000` (or Vite's assigned port)
* **Backend API**: `http://localhost:5000/api`

### Production Mode (Unified Single-Port)
Builds the optimized React assets and serves them directly through Express on Port 5000:
```bash
npm run build
npm run start
```
* Open **`http://localhost:5000`** in your browser.

#### 1-Click Launchers
* **Windows**: Double-click `start_trackops.bat` (automatically starts PostgreSQL in WSL if needed and launches browser).
* **Linux / macOS**: Run `./start_trackops.sh`.

---

## 🧪 Testing & Validation

```bash
# Typecheck TypeScript codebase
npm run typecheck

# Validate production build bundle
npm run build

# Run automated Playwright UI responsiveness & navigation tests
npm run test:ui

# Run end-to-end CR-002 verification suite
npm run test:cr002
```

---

## 📚 Documentation Index

| Document | Category | Description |
| :--- | :--- | :--- |
| **[Architecture Specification](docs/architecture/ARCHITECTURE.md)** | Architecture | High-level topology, component diagrams, ER models, and constraints |
| **[Workflow Documentation](docs/architecture/WORKFLOW_DOCUMENTATION.md)** | Operations | Step-by-step comic stall retail operational lifecycle |
| **[Production Operations Manual](docs/operations/PRODUCTION_OPERATIONS_MANUAL.md)** | Operations | Startup, shutdown, backup/restore procedures, and health checks |
| **[Deployment Matrix](docs/operations/DEPLOYMENT.md)** | DevOps | UAT vs Production configuration breakdown |
| **[Product Requirements Document v1.3](docs/requirements/TrackOps_PRD_v1.3.md)** | Requirements | Accounting logic, inventory movements, and export specifications |
| **[Business Requirements Document (BRD)](docs/requirements/TrackOps%20—%20Business%20Requirements%20Document%20(BRD).pdf)** | Requirements | Executive specifications and business requirements |
| **[REST API Documentation](docs/requirements/TrackOps%20—%20API%20Documentation.pdf)** | API | Endpoints, query parameters, schemas, and payloads |
| **[UAT Test Report](docs/testing/UAT_TEST_REPORT.md)** | QA / Testing | 24-point acceptance matrix and sign-off report |
| **[Changelog](docs/CHANGELOG.md)** | Releases | Complete chronological release history and migrations |

---

## 🤝 Contributing

Contributions are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md) before submitting pull requests.

## 🔒 Security

For security vulnerability disclosures, please refer to [SECURITY.md](SECURITY.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
