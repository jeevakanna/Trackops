# Contributing to TrackOps

Thank you for your interest in contributing to TrackOps! TrackOps is a retail management system designed for fast Point-of-Sale (POS) operations, inventory tracking, and accrual-based accounting.

---

## 🛠️ Development Setup

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **PostgreSQL**: v14.x or higher

### 2. Getting Started
1. Clone the repository:
   ```bash
   git clone https://github.com/jeevakanna/trackops.git
   cd trackops
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Update DATABASE_URL with your PostgreSQL credentials
   ```
4. Initialize the database schema:
   Execute the SQL files in `server/` against your PostgreSQL database in the following sequence:
   - `schema.sql`
   - `sales_purchases_schema.sql`
   - `finances.sql`
   - `migration_fk_set_null.sql`
   *(Optional demo seed: `sample_data.sql`)*
5. Launch development servers (Vite frontend + Express backend concurrently):
   ```bash
   npm run dev:all
   ```

---

## 📜 Branching Strategy & Workflow

1. Fork the repo and create your branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bugfix
   ```
2. Commit changes with clear, descriptive messages following conventional commits:
   - `feat: add export to CSV for expense ledger`
   - `fix: prevent negative stock deduction during concurrent sales`
   - `docs: update API documentation links`
3. Verify that the build succeeds without TypeScript errors:
   ```bash
   npm run build
   ```
4. Open a Pull Request referencing the issue or feature you worked on.

---

## 🧪 Code Quality & Testing

- Ensure all TypeScript types are strictly maintained (no implicit `any`).
- Follow the existing Tailwind CSS component styling patterns.
- If modifying core calculations (COGS, Net Profit, inventory balance checks), verify that the accounting formulas in `src/utils/accounting.ts` and database constraints remain consistent.
