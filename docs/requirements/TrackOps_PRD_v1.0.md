# TrackOps: Product Requirements Document

**Product/Feature:** TrackOps | **Owner:** Owner/Admin | **Date:** 12 Oct 2026 | **Version:** 1.0 | **Status:** Draft | **Linked BRD:** None

## 2.1 One-Line Summary

TrackOps is a self-hosted web app, usable on mobile and desktop, that lets a small stall owner track inventory, sales, and expenses and generate PDF and Excel reports, with all data stored on their own PC instead of third-party servers.

## 2.2 Problem & Opportunity

**Problem:** Existing business management tools are expensive, and they store business data on third-party servers. The owner needs an all-round application to track inventory and other business metrics on infrastructure they control.

**Who has it:** The owner of a small stall-type business (currently the only user).

**Why now:** This is a personal project that will directly support the owner's day-to-day business tracking. Target delivery is one month.

## 2.3 Goals & Non-Goals

| # | Goal | Success Metric | Target |
|---|---|---|---|
| 1 | Manage inventory | Add, edit, and manage products and stock levels | Working by end of month 1 |
| 2 | Record expenses | Log expense records | Working by end of month 1 |
| 3 | Record sales | Create sale records that update stock | Working by end of month 1 |
| 4 | Generate reports | Produce reports from stored data | Working by end of month 1 |
| 5 | Data ownership | All data stays on the owner's own PC | No third-party servers used |

**Non-Goals:**
- Third-party integrations (planned for future versions)
- Multi-user roles, staff logins, and user login (no login in v1)
- Credit sales and partial payments
- GST and tax handling (may be added in future)
- Multiple languages (English only)
- Native Android or iOS app (web app only)
- Customer and supplier management
- Payroll and multi-location stock

*Credit sales, GST, multi-language, login, and native apps are confirmed out of scope. The remaining items are assumptions pending confirmation (see 2.10).*

## 2.4 Users & Use Cases

| User Type | Use Case | Frequency |
|---|---|---|
| Admin (Owner) | Add and manage inventory | Weekly |
| Admin (Owner) | Record sales | Weekly |
| Admin (Owner) | Record expenses | Weekly |
| Admin (Owner) | Generate and review reports | Weekly |

## 2.5 Features (High-Level)

| # | Feature | Description | Priority |
|---|---|---|---|
| | *To be defined in the next draft; derive from the flow in 2.6 and the requirements in 2.7* | | |

## 2.6 User Flow

The Home page is the single entry point and links to three sections: Inventory, Finances, and Sales. A sale made in Sales updates both Inventory and Finances automatically.

1. **Home:** the owner opens the app and sees three sections: Inventory, Finances, and Sales.
2. **Inventory section:** opens the product list.
    - Add a new product.
    - Remove a product.
    - Adjust stock levels of an existing product.
3. **Finances section:** opens the financial records.
    - Add an expense record.
    - Add an income record.
    - View income and expense entries, including those created by sales.
4. **Sales section:** opens the billing screen.
    - Start a new bill by selecting products and quantities.
    - Save the bill to complete the sale.
    - On save, stock for each sold product is reduced in Inventory.
    - On save, the bill amount is recorded as income in Finances.
5. **Return to Home:** from any section the owner can go back to Home and open another section.

## 2.7 Requirements Detail

**Functional**

| ID | Requirement | Related Feature |
|---|---|---|
| FR-01 | The app supports a single admin user (the owner) with no login. | General |
| FR-02 | The user can add and manage inventory. | Inventory |
| FR-03 | The user can create expense records. | Expenses |
| FR-04 | The user can create sale records; every sale is paid in full. | Sales |
| FR-05 | The user can generate reports and export them as PDF and Excel. | Reports |
| FR-06 | All amounts are in Indian Rupees (₹); the interface is in English. | General |

**Non-Functional**

| ID | Requirement | Related Feature |
|---|---|---|
| NFR-01 | The app is a web application whose layout and features adapt to both mobile and desktop screens. | Platform |
| NFR-02 | The backend and database run on the owner's PC and data is stored in a local database; no third-party servers store business data. | Hosting / Privacy |
| NFR-03 | The app is needed only while the owner's PC is running; usage is low (weekly). | Availability |
| NFR-04 | No login or authentication in v1; access is limited to the owner's private network. | Security |

## 2.8 Design & UX

Mockups: *link to be added when the designer's output is ready.*

Design direction: clean, minimal, uncluttered, one primary action per screen.

## 2.9 Dependencies

- Owner's PC running and reachable while the app is in use
- Phone and PC on the same network so the web app opens in the phone's browser
- Completed UI designs before front-end build

## 2.10 Assumptions & Open Questions

| Item | Type | Owner | Status |
|---|---|---|---|
| Currency is Indian Rupee (₹) | Decision | Owner | Confirmed |
| No credit sales or partial payments; every sale is paid in full | Decision | Owner | Confirmed |
| No GST or tax in v1; may be added in a future version | Decision | Owner | Confirmed |
| English only | Decision | Owner | Confirmed |
| Reports export as PDF and Excel | Decision | Owner | Confirmed |
| Pure web app, responsive for mobile and desktop; no native Android app | Decision | Owner | Confirmed |
| Data stored in a local database on the owner's PC | Decision | Owner | Confirmed |
| No login in v1; single admin user | Decision | Owner | Confirmed |
| Remaining non-goals in 2.3 (customers/suppliers, payroll, multi-location stock) are out of scope | Assumption | Owner | Open |
| Tech stack for the web app and local database | Open question | Owner | Open |
| How the phone reaches the PC-hosted app (same Wi-Fi assumed) | Open question | Owner | Open |
| Backup method for the local database | Open question | Owner | Open |
| Can a saved sale be edited or cancelled (restoring stock and removing income)? | Open question | Owner | Open |
| Where Reports sit in the navigation | Open question | Owner | Open |
| Feature list (2.5) | Open question | Owner | Deferred to next draft |
| Sign-off approvers beyond the owner | Open question | Owner | Open |

## 2.11 Release Plan

| Phase | Scope | Target Date |
|---|---|---|
| v1.0 | Inventory, sales, expenses, and reports (detailed scope in next draft) | 12 Nov 2026 (1 month) |
| Future | Third-party integrations and extended features | TBD |

## 2.12 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| PC is off or unreachable | App unusable | Run the PC during use; consider an always-on option later |
| Data loss from a PC failure | Loss of business records | Regular automated backups to an external drive |
| One-month timeline is tight for a responsive web app | Delayed delivery | Keep scope minimal; build one responsive codebase |
| No login, and the app is reachable from phones on the network | Anyone on the same network could open it | Keep it on a private network only; add login later if exposure grows |

## 2.13 Sign-off

| Name | Role | Decision | Date |
|---|---|---|---|
| Owner | Owner / Admin | Pending | |
