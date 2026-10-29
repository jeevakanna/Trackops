# TrackOps Deployment & Multi-Environment Architecture

## Overview
TrackOps is configured across two isolated environments:
1. **UAT (User Acceptance Testing) Environment**: Current workspace (`E:\trackops`)
2. **Production v1.0 Environment**: Dedicated production directory (`E:\trackops-prod`)

---

## Environment Matrix

| Parameter | UAT Environment | Production (v1.0) Environment |
| :--- | :--- | :--- |
| **Directory** | `E:\trackops` | `E:\trackops-prod` |
| **Purpose** | Development, testing, staging, and user acceptance | Live production stall operations |
| **Application Port** | `http://localhost:3000` (Vite dev server) | `http://localhost:5000` (Optimized Express static bundle) |
| **API Port** | `http://localhost:4000` | `http://localhost:5000` (Unified port) |
| **PostgreSQL Database** | `trackops` on port `5432` | `trackops_prod` on port `5432` |
| **Database Data** | Contains historical test & UAT transaction data | Fresh, clean state (schemas & constraints only) |
| **Launch Script** | [`start_trackops.bat`](file:///e:/trackops/start_trackops.bat) | [`start_trackops_prod.bat`](file:///E:/trackops-prod/start_trackops_prod.bat) |
| **Start Command** | `npm run dev:all` | `npm run start` |

---

## Production v1.0 Highlights

- **Unified Single-Port Architecture**: Express serves both compiled, minified production assets (`dist/`) and `/api` routes on port `5000`.
- **Zero Dev Server Overhead**: In production, the app runs without Vite watcher or development hot reload overhead.
- **Dedicated Clean Database**: Initialized on PostgreSQL as `trackops_prod` with full table schemas, constraints, and sequences (`sale_number_seq`, `purchase_number_seq`), free of test records.
- **Automated Service Health**: Startup scripts automatically verify that the PostgreSQL service is active before launching the browser.

---

## Quick Start Guide

### Running Production v1.0
1. Navigate to `E:\trackops-prod`.
2. Double-click `start_trackops_prod.bat` (or run `npm run start`).
3. Browser opens automatically at `http://localhost:5000`.

### Running UAT
1. Navigate to `E:\trackops`.
2. Double-click `start_trackops.bat` (or run `npm run dev:all`).
3. Browser opens automatically at `http://localhost:3000`.
