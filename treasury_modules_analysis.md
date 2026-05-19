# Treasury Modules Analysis: Bulk Approval & Salesmen Expense Approval

This document analyzes the technical implementation, logic flows, and data structures of the Treasury modules in the Financial Management system.

## 1. Module Overview

### 1.1 Bulk Approval Module
**Path:** `src/modules/financial-management/treasury/bulk-approval`  
**Purpose:** Handles multi-tier consensus approval for disbursement drafts (Type 1: General, Type 2: Salesman Expenses).

### 1.2 Salesmen Expense Approval Module
**Path:** `src/modules/financial-management/treasury/salesmen-expense-approval`  
**Purpose:** Preliminary authorization of salesman-encoded expenses. Authorized expenses are bundled into a `disbursement_draft` for final treasury approval.

---

## 2. Technical Architecture

### Frontend Structure (Both Modules)
- **Entry Point:** `index.ts` (exports the main module component).
- **Main Component:** `*Module.tsx` (handles layout and high-level state).
- **Hooks:** `use*Approval.ts` (encapsulates state management, search, and pagination).
- **Providers:** `fetchProvider.ts` (abstracts API calls).
- **Types:** `type.ts` (TypeScript interfaces for API responses and payloads).

### Backend Implementation
- **API Routes:**
  - `src/app/api/fm/treasury/bulk-approval/route.ts`
  - `src/app/api/fm/treasury/salesman-expense-approval/route.ts`
- **Data Persistence:** Directus (Headless CMS/Database).
- **RBAC:** 
  - `Bulk Approval`: Based on `disbursement_draft_approver` (hierarchical levels per division).
  - `Salesman Expense`: Based on `department_head_id` (Department table) and `supervisor_id` (Division table).

---

## 3. Logic Flows

### 3.1 Salesman Expense Approval Flow
1. **Discovery:** Authorized users (Dept Heads/Supervisors) view salesmen with pending/rejected expenses in their jurisdiction.
2. **Review:** User reviews individual receipts (`expense_draft` records) and their ceiling limits.
3. **Action (Confirm):**
   - User approves/rejects specific items.
   - User can adjust amounts (triggers `UPDATE` action in `expense_draft_logs`).
   - Approved items are bundled into a `disbursement_draft` (transaction_type: 2).
   - If a draft already exists (resubmission), it is recycled, and variance logs are recorded.
4. **Outcome:** A `Submitted` draft enters the Bulk Approval queue.

### 3.2 Bulk Approval Consensus Flow
1. **Tier Identification:** Each draft has a `status` (Submitted, Pending_L2, Pending_L3, etc.) representing its active tier.
2. **Voting:**
   - Approvers at the **active tier** can vote (Approved/Rejected).
   - Approvers can edit payable amounts during voting (records variance snapshots in logs).
3. **Consensus Logic:**
   - **Approval:** Requires 100% consensus in the current tier. When the last approver in the tier votes "Approved", the draft advances to the next level (`Pending_L(X+1)`).
   - **Final Approval:** When the highest tier completes, the draft is converted into a **Live Disbursement** (`disbursement` and `disbursement_payables` tables) and assigned a real Document Number (e.g., `NT-1001`).
   - **Rejection:** 
     - Increments `approval_version`.
     - Resets status. 
     - **Salesman Expenses (Type 2):** Reverts underlying `expense_draft` items back to the salesman for correction.
     - **General (Type 1):** Returns to Level 1.

---

## 4. Key Data Models

### disbursement_draft (Bulk Approval)
| Field | Description |
|---|---|
| `status` | Submitted, Pending_L1..N, Approved, Rejected |
| `approval_version` | Increments on each rejection round |
| `version` | Increments on content changes (e.g., amount edits) |
| `division_id` | Determines the routing hierarchy |

### expense_draft (Salesman Expense)
| Field | Description |
|---|---|
| `status` | Drafts, Approved, Rejected |
| `amount` | Can be adjusted by approvers |
| `version` | Tracks adjustments during authorization |

---

## 5. Security & RBAC Implementation

### Multi-Division Context
Approvers can have different hierarchies across multiple divisions. The system dynamically identifies the user's role per division when listing drafts or validating votes.

### Audit Trails
- **Vote History:** Every vote is recorded with versioning, preserving history across rejection rounds.
- **Payload Snapshots:** Amount changes record `old_total` vs `new_total` in `disbursement_draft_logs`.
- **Expense Logs:** Individual salesman expense adjustments are tracked via `expense_draft_logs`.

---

> [!NOTE]
> The Bulk Approval module is designed for "consensus", meaning every registered approver at a given level must approve before advancement. This prevents a single user from bypassing the hierarchy unless they are the only one in that tier.
