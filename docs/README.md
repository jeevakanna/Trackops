# TrackOps Documentation Suite

Welcome to the TrackOps technical and operational documentation repository. This directory houses system specifications, architectural blueprints, deployment guides, testing matrices, and business requirements for the TrackOps Comic Stall Management System.

---

## 📚 Documentation Index

### 🏗️ Architecture & Workflows
* **[Architecture Specification](architecture/ARCHITECTURE.md)**: High-level topology, Express 5 + React SPA architecture, PostgreSQL ER diagram, data flow models, and database constraints.
* **[Workflow Documentation](architecture/WORKFLOW_DOCUMENTATION.md)**: Operational retail lifecycle including Stall Setup, Vendor Purchasing, POS Checkout, Operating Expenses, and Financial Audits.

### ⚙️ Operations & Deployment
* **[Production Operations Manual](operations/PRODUCTION_OPERATIONS_MANUAL.md)**: Standard operating procedures (SOPs) for server startup, graceful shutdown, automated backups, restore drills, and system health checks.
* **[Deployment Matrix](operations/DEPLOYMENT.md)**: Environment specification comparing UAT (`localhost:3000`) and Production (`localhost:5000`), port maps, and zero-downtime serving configurations.

### 📋 Requirements & Specifications
* **[Product Requirements Document v1.0](requirements/TrackOps_PRD_v1.0.md)**: Core foundational functional scope and initial user journey.
* **[Product Requirements Document v1.3](requirements/TrackOps_PRD_v1.3.md)**: Enhanced specifications including accrual-aware accounting, inventory movement logs, and PDF/Excel export requirements.
* **[Business Requirements Document (BRD)](requirements/TrackOps%20—%20Business%20Requirements%20Document%20(BRD).pdf)**: Executive requirements, stakeholder sign-offs, and commercial objectives.
* **[REST API Documentation](requirements/TrackOps%20—%20API%20Documentation.pdf)**: Complete endpoints, schemas, request payloads, and status codes.

### 🧪 Quality Assurance & Testing
* **[UAT Test Report](testing/UAT_TEST_REPORT.md)**: 24-point acceptance test matrix, verification criteria, and certified testing results.
* **[Manual Test Cases Workbook](testing/manual%20test%20trackops.xlsx)**: Comprehensive spreadsheet of test scenarios, step-by-step procedures, and pass/fail logs.

### 📜 Release History
* **[Changelog](CHANGELOG.md)**: Detailed release notes, breaking change warnings, schema migrations, and feature rollouts.
