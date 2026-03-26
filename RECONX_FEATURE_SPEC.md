# ReconX -- Complete Feature Specification

**Version:** 2.0
**Date:** March 15, 2026
**Author:** Senior Reconciliation Architect
**Target audience:** Former VP of Reconciliation Operations (10+ years IntelliMatch)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Model](#2-data-model)
3. [User Personas & Permissions](#3-user-personas--permissions)
4. [Screen-by-Screen Specification](#4-screen-by-screen-specification)
   - 4.1 [Command Center (Dashboard)](#41-command-center-dashboard)
   - 4.2 [Reconciliation Contexts (Setup)](#42-reconciliation-contexts-setup)
   - 4.3 [Data Ingestion & File Manager](#43-data-ingestion--file-manager)
   - 4.4 [Matching Engine Console](#44-matching-engine-console)
   - 4.5 [Items Explorer](#45-items-explorer)
   - 4.6 [Match Groups Viewer](#46-match-groups-viewer)
   - 4.7 [Balance Pools & Proof](#47-balance-pools--proof)
   - 4.8 [Exception Management](#48-exception-management)
   - 4.9 [Case Manager](#49-case-manager)
   - 4.10 [Write-Off Center](#410-write-off-center)
   - 4.11 [Manual Matching Workbench](#411-manual-matching-workbench)
   - 4.12 [Carryforward Manager](#412-carryforward-manager)
   - 4.13 [Aging Analysis](#413-aging-analysis)
   - 4.14 [Audit Trail & Compliance](#414-audit-trail--compliance)
   - 4.15 [Reports & Analytics](#415-reports--analytics)
   - 4.16 [Administration](#416-administration)
   - 4.17 [Notifications & Alerts](#417-notifications--alerts)
5. [Matching Logic Deep-Dive](#5-matching-logic-deep-dive)
6. [Workflows & Approval Chains](#6-workflows--approval-chains)
7. [Gap Analysis vs. Current Implementation](#7-gap-analysis-vs-current-implementation)

---

## 1. Architecture Overview

```
+---------------------------------------------------------------------+
|                         ReconX Platform                              |
+---------------------------------------------------------------------+
|  Presentation Layer    | React + TypeScript + Chart.js               |
|  State Management      | Zustand (client) / would be API in prod    |
|  Matching Engine       | Multi-pass pipeline (Exact > Tol > Fuzzy > AI) |
|  Data Layer            | Seed data (demo) / SQL + REST in prod      |
|  Audit & Compliance    | Immutable audit log, full event sourcing    |
|  Export & Reporting    | PDF, Excel, CSV, scheduled email            |
+---------------------------------------------------------------------+
```

### Design Principles
- **Zero-click insight**: The most critical information visible within 2 seconds of login
- **Drill-down everywhere**: Summary > Context > Pool > Match Group > Item > Audit Event
- **Role-aware UI**: Features and actions conditionally rendered per persona
- **IntelliMatch parity+**: Every feature an IntelliMatch power user expects, plus cloud-native enhancements IntelliMatch never had

---

## 2. Data Model

### 2.1 Existing Entities (Already Implemented)

| Entity | Key Fields | Status |
|--------|-----------|--------|
| `ReconContext` | id, name, type (CASH/SECURITIES), currency, counterparty, matchRate, healthStatus | Implemented |
| `ReconItem` | id, contextId, side (INTERNAL/EXTERNAL), valueDate, reference, amount, status, matchId, matchPass, reasonCode, age | Implemented |
| `MatchResult` | id, contextId, pass, confidence, internalItemId, externalItemId, toleranceApplied, fieldsMatched, ruleUsed | Implemented |
| `BalancePool` | id, contextId, reconDate, openingBalance, debits, credits, calculatedClosing, statedClosing, variance, proofStatus, signOffStatus | Implemented |
| `MatchRule` | id, contextId, pass, type, fields, tolerance, toleranceType, dateRange, isAutoSuggested | Implemented |
| `Exception` | id, itemId, contextId, reasonCode, assignedTo, slaDeadline, slaBreach, priority, notes | Implemented |
| `WriteOffRequest` | id, itemId, amount, reasonCode, requestedBy, status, approvedBy, comments | Implemented |
| `Case` | id, exceptionId, contextId, status, priority, assignedTo, notes (AuditEvent[]), amount | Implemented |
| `AuditEvent` | id, timestamp, user, action, detail | Implemented |
| `TeamMember` | id, name, role, assignedContexts, itemsResolvedToday, avgResolutionTime, slaCompliance | Implemented |
| `DashboardKPIs` | overallMatchRate, agingBuckets, valueTiers, matchRateTrend, topBreakCounterparties | Implemented |

### 2.2 Missing Entities (Required for Enterprise Parity)

| Entity | Key Fields | Purpose |
|--------|-----------|---------|
| `MatchGroup` | id, contextId, matchType (1:1, 1:N, N:1, N:N, NET), internalItems[], externalItems[], netDifference, status, createdAt, breakReason | **Critical** -- IntelliMatch groups matched items into groups that can be drilled into, broken apart, re-matched. Currently `MatchResult` only supports 1:1. |
| `DataSource` | id, contextId, side, sourceType (FILE/SFTP/API/DB), format (CSV/MT940/SWIFT/BAI2/CAMT.053), fieldMapping, lastIngested, rowCount, validationErrors | File ingestion and mapping |
| `FieldMapping` | id, dataSourceId, sourceField, targetField, transformRule, isKey, isMatchField | Column mapping for incoming files |
| `ReconciliationRun` | id, contextId, reconDate, startedAt, completedAt, status, triggeredBy, totalItemsProcessed, matchesMade, exceptionsCreated | Run history / re-runability |
| `CarryForwardItem` | id, originalItemId, contextId, originalDate, currentDate, daysCarried, status, autoResolved | Tracks items carried from prior days |
| `ApprovalChain` | id, contextId, actionType (WRITE_OFF/SIGN_OFF/MANUAL_MATCH), thresholds[], approvers[], currentStep | Multi-tier approval routing |
| `SLAPolicy` | id, contextId, priority, targetHours, escalationPath[], breachAction | SLA configuration per context |
| `Comment` | id, parentType (EXCEPTION/CASE/MATCH_GROUP/WRITE_OFF), parentId, author, text, timestamp, attachments[] | Threaded comments on any entity |
| `Attachment` | id, commentId, fileName, fileType, fileSize, url | Supporting documents (SWIFT messages, emails) |
| `ScheduledTask` | id, type (MATCHING_RUN/REPORT_GENERATION/SLA_CHECK), schedule (cron), lastRun, nextRun, status | Automation |
| `UserPreference` | id, userId, defaultContext, defaultView, columnOrder, savedFilters[], theme | Per-user customization |
| `SavedFilter` | id, userId, name, screenTarget, filterCriteria, isShared | Reusable filter sets |
| `ReconTemplate` | id, name, description, contextType, defaultRules[], defaultFieldMappings[], defaultSLAs | Recon setup templates |
| `BreakCategory` | id, code, description, isSystemDefined, requiresApproval, autoAction | Extensible reason code taxonomy |
| `Counterparty` | id, name, shortCode, contactName, contactEmail, slaAgreement, lastActivity | Counterparty master |
| `NotificationRule` | id, userId, triggerEvent, channel (EMAIL/IN_APP/SLACK), isActive | Notification preferences |
| `SignOffCeremony` | id, poolId, contextId, reconDate, steps[], currentStep, completedAt, participants[] | Multi-step sign-off workflow |

### 2.3 Entity Relationship Summary

```
ReconContext
  |-- DataSource[] (INTERNAL side, EXTERNAL side)
  |     |-- FieldMapping[]
  |-- MatchRule[] (ordered by pass number)
  |-- ReconciliationRun[]
  |-- BalancePool[] (one per business date)
  |     |-- SignOffCeremony
  |-- ReconItem[]
  |     |-- MatchGroup (many-to-many via MatchGroupItem)
  |     |-- Exception
  |     |     |-- Case
  |     |     |-- Comment[]
  |     |     |-- WriteOffRequest
  |     |-- CarryForwardItem
  |-- SLAPolicy[]
  |-- ApprovalChain[]
```

---

## 3. User Personas & Permissions

### 3.1 Analyst

| Capability | Allowed |
|-----------|---------|
| View all screens | Yes |
| Run matching engine | Yes |
| Create manual matches | Yes |
| Accept/reject AI-proposed matches | Yes |
| Assign reason codes to exceptions | Yes |
| Add notes/comments | Yes |
| Request write-off | Yes (initiates request) |
| Approve write-off | **No** (supervisor only) |
| Sign off balance pool | **No** (supervisor only) |
| Create/edit match rules | **No** (supervisor only) |
| View audit trail | Yes (read-only) |
| Export data | Yes |
| Break apart a match group | Yes (creates audit entry, requires supervisor confirmation if amount > threshold) |
| Reassign exceptions | Own context only |

### 3.2 Supervisor

| Capability | Allowed |
|-----------|---------|
| Everything Analyst can do | Yes |
| Approve/reject write-offs | Yes |
| Sign off balance pools | Yes |
| Create/edit/delete match rules | Yes |
| Reassign exceptions across analysts | Yes |
| Override SLA deadlines | Yes |
| Bulk actions (bulk assign, bulk close) | Yes |
| Configure SLA policies | Yes |
| View team performance metrics | Yes |
| Approve manual matches above threshold | Yes |

### 3.3 Auditor (NEW -- Not Yet Implemented)

| Capability | Allowed |
|-----------|---------|
| View all screens | Yes (read-only) |
| Run matching engine | **No** |
| Create/modify anything | **No** |
| View full audit trail | Yes (unfiltered) |
| View historical recon runs | Yes |
| Export audit reports | Yes |
| View sign-off ceremony details | Yes |
| View write-off approval chains | Yes |
| Compare recon runs across dates | Yes |
| Access SOX compliance dashboard | Yes |
| Generate regulatory reports | Yes |
| View user activity log | Yes |

---

## 4. Screen-by-Screen Specification

---

### 4.1 Command Center (Dashboard)

**Purpose:** Single-pane-of-glass view of all reconciliation activity. An IntelliMatch veteran expects to see the "health of the book" within 2 seconds.

#### Widgets / Features

| # | Widget | Description | Data Source |
|---|--------|-------------|-------------|
| 1 | **Overall Match Rate** | Large KPI number with sparkline trend (30 days). Color-coded: green >= 95%, amber >= 85%, red < 85%. | `DashboardKPIs.overallMatchRate`, `matchRateTrend` |
| 2 | **Context Health Grid** | Card per ReconContext showing: name, match rate, exception count, proof status, health dot (G/A/R). Click to navigate to that context. | `ReconContext[]` |
| 3 | **Exception Heatmap** | Matrix: rows = contexts, columns = reason codes. Cell color intensity = count. Click cell to drill into filtered exception list. | `Exception[]` grouped |
| 4 | **Aging Waterfall** | Stacked bar chart: 0-1d, 2-5d, 6-15d, 16-30d, 30d+. Shows count AND value. IntelliMatch shows this as "aging buckets" -- critical for SOX. | `DashboardKPIs.agingBuckets` |
| 5 | **Value at Risk** | Donut chart showing unmatched value by tier ($0-10K, $10K-100K, etc.). Total unmatched value in center. | `DashboardKPIs.valueTiers` |
| 6 | **SLA Breach Counter** | Real-time count of exceptions breaching SLA, with countdown timers for the top 5 nearest breaches. | `Exception[]` where `slaBreach === true` |
| 7 | **Balance Proof Summary** | Horizontal bar: X pools in proof (green) vs Y pools out of proof (red). Click to go to Balance Pools. | `BalancePool[]` |
| 8 | **Pending Approvals** | Badge count for: pending write-offs, pending sign-offs, proposed matches awaiting review. Each clickable. | `WriteOffRequest[]`, `BalancePool[]`, `ReconItem[]` |
| 9 | **Team Workload** | Bar chart: items assigned per analyst, colored by SLA compliance. Shows avg resolution time. | `TeamMember[]` |
| 10 | **Top Break Counterparties** | Ranked table: counterparty name, break count, total break value. Identifies systemic issues. | `DashboardKPIs.topBreakCounterparties` |
| 11 | **Recent Activity Feed** | Live-updating list of last 20 audit events (match created, write-off approved, pool signed off, etc.). | `AuditEvent[]` |
| 12 | **Match Rate Trend** | 30-day line chart with area fill. Shows target line at 95%. | `DashboardKPIs.matchRateTrend` |

#### Persona Actions

| Persona | Actions on This Screen |
|---------|----------------------|
| Analyst | View KPIs, click to drill into any context, see own assigned items |
| Supervisor | Same + see team workload, pending approvals count, click to approve |
| Auditor | Read-only view, can export snapshot as PDF |

#### What IntelliMatch Has That We Must Match
- IntelliMatch's "Dashboard" shows a context tree on the left with expand/collapse. Each node shows match rate and exception count. We replicate this with the Context Health Grid but should also support a tree view toggle.
- IntelliMatch shows "items processed today vs. yesterday" -- we should add a day-over-day comparison widget.

---

### 4.2 Reconciliation Contexts (Setup)

**Purpose:** Define and configure reconciliation contexts (what IntelliMatch calls "reconciliation definitions" or "recon defs"). This is where a supervisor sets up the two-sided reconciliation.

#### Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Context List** | Table of all contexts with: name, type (CASH/SECURITIES/POSITION/TRANSACTION), currency, counterparty, match rate, health status, last run date. Sortable and filterable. |
| 2 | **Create Context Wizard** | Step-by-step: (1) Name & type, (2) Internal data source config, (3) External data source config, (4) Field mapping, (5) Match rule setup, (6) SLA policy, (7) Approval chain, (8) Review & activate. |
| 3 | **Context Detail** | Full configuration view: data sources, field mappings, match rules (ordered), SLA policies, assigned team members, approval thresholds. |
| 4 | **Clone Context** | Duplicate an existing context with all rules/mappings. Common when adding a new counterparty with similar structure. |
| 5 | **Context Templates** | Pre-built templates for common recon types: Nostro, Custody, Trade Confirmation, Margin, Collateral. |
| 6 | **Context Groups** | Group contexts by business line, entity, or region. Allows dashboard filtering by group. |
| 7 | **Deactivate/Archive** | Soft-delete a context. Historical data preserved. Audit trail records who and when. |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | View context config (read-only) |
| Supervisor | Create, edit, clone, deactivate contexts |
| Auditor | View context config history, see who changed what and when |

#### Data Requirements
- `ReconContext`, `DataSource`, `FieldMapping`, `MatchRule`, `SLAPolicy`, `ApprovalChain`, `ReconTemplate`

---

### 4.3 Data Ingestion & File Manager

**Purpose:** Upload, map, validate, and process data files. IntelliMatch calls this "Data Loading" and it is where analysts spend the first 30 minutes of their day.

#### Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **File Upload** | Drag-and-drop zone. Supports CSV, TSV, Excel (.xlsx), MT940 (SWIFT), BAI2, CAMT.053, fixed-width. Auto-detect format. |
| 2 | **File Queue** | Shows uploaded files with status: Pending, Validating, Processing, Loaded, Error. Progress bar for large files. |
| 3 | **Field Mapping UI** | Side-by-side: source columns on left, target fields on right. Drag to map. Auto-suggest mappings based on column names. Show sample data for each column. |
| 4 | **Data Preview** | First 50 rows of parsed data. Highlight validation errors (missing required fields, type mismatches, duplicate references). |
| 5 | **Validation Report** | Summary: total rows, valid rows, error rows, warning rows. Drill into each error with row number and field. |
| 6 | **Transform Rules** | Per-field transformations: date format conversion, amount sign flip, reference prefix/suffix strip, currency code normalization. |
| 7 | **File History** | Log of all files loaded per context per date. Includes: file name, upload time, user, row count, error count. Re-download original file. |
| 8 | **Scheduled Ingestion** | SFTP/API polling on schedule. Auto-load when files appear. Send notification on success/failure. |
| 9 | **Duplicate Detection** | Warn if a file with the same hash has been loaded before. Option to skip or reload. |
| 10 | **Multi-file Support** | Load multiple files into the same side (e.g., ledger data from 3 systems into INTERNAL). Merge or overlay options. |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | Upload files, map fields, preview data, trigger load |
| Supervisor | Configure scheduled ingestion, set transform rules, approve mappings |
| Auditor | View file history, download original files, verify data lineage |

#### Data Requirements
- `DataSource`, `FieldMapping`, file metadata, validation error log

#### What IntelliMatch Does Here
- IntelliMatch has a "Data Manager" with a file tree. You select a context, see expected vs. received files. Red flags for missing files. We should replicate this "expected files" concept with a file calendar.

---

### 4.4 Matching Engine Console

**Purpose:** Configure, run, and monitor the multi-pass matching pipeline. This is the intellectual heart of the platform.

#### Features (Current + Gaps)

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 1 | **Match Rule Configuration** | Partial | Ordered list of rules by pass number. Each rule: type (EXACT/TOLERANCE/FUZZY/AI), fields to match on, tolerance value/type, date range. **Gap:** Cannot reorder passes via drag-and-drop. Cannot add custom pass types. |
| 2 | **Run Matching** | Implemented | Run button triggers multi-pass matching for selected context. Animated progress through passes. |
| 3 | **Pass-by-Pass Results** | Implemented | After run: card per pass showing matches found, items processed, remaining unmatched. |
| 4 | **Match Waterfall** | Implemented | Visual showing how many items matched at each pass, with a funnel visualization. |
| 5 | **AI-Suggested Rules** | Implemented | System suggests new rules based on patterns in unmatched items. |
| 6 | **Run History** | **NOT IMPLEMENTED** | Log of every matching run: date, time, user, context, pass results, duration. Compare runs side-by-side. |
| 7 | **Dry Run / Preview** | **NOT IMPLEMENTED** | Run matching without committing results. Shows "what would match" for review before accepting. |
| 8 | **Match Rule Testing** | **NOT IMPLEMENTED** | Test a single rule against current unmatched items. See matches before activating the rule. |
| 9 | **Net Matching** | **NOT IMPLEMENTED** | Match N internal items to M external items where the NET difference is within tolerance. Critical for batch payments. |
| 10 | **Split Matching** | **NOT IMPLEMENTED** | Match 1 internal item to N external items (or vice versa). Common for settlements split across multiple payments. |
| 11 | **Composite Keys** | **NOT IMPLEMENTED** | Build match keys from concatenation of multiple fields (e.g., Reference + Date + Currency = composite key). |
| 12 | **Match Scoring Matrix** | **NOT IMPLEMENTED** | Weighted scoring across fields: Reference match = 40 pts, Amount exact = 30 pts, Date same = 20 pts, Counterparty match = 10 pts. Threshold score to auto-match vs. propose. |
| 13 | **Rule Effectiveness Report** | **NOT IMPLEMENTED** | Per rule: how many matches it produces, false positive rate, average confidence. Helps optimize rule ordering. |
| 14 | **Cross-Context Matching** | **NOT IMPLEMENTED** | Match items across different contexts (e.g., USD Nostro debit matched against Trade Settlement credit). |

#### Match Types Matrix

| Match Type | Internal | External | Description | Status |
|-----------|----------|----------|-------------|--------|
| **1:1** | 1 item | 1 item | Standard match. One ledger entry matches one bank statement entry. | Implemented |
| **1:N** | 1 item | N items | One large payment on our side matched to multiple smaller entries on the bank side. | **NOT IMPLEMENTED** |
| **N:1** | N items | 1 item | Multiple ledger entries matched to one consolidated bank entry. | **NOT IMPLEMENTED** |
| **N:N** | N items | N items | Multiple items on both sides that together balance out. | **NOT IMPLEMENTED** |
| **NET** | N items | M items | Net total of N items equals net total of M items within tolerance. | **NOT IMPLEMENTED** |
| **SPLIT** | 1 item | N items | One item split across multiple counterpart entries. Different from 1:N in that the original was explicitly split. | **NOT IMPLEMENTED** |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | Run matching, view results, accept/reject AI suggestions |
| Supervisor | Create/edit/reorder rules, activate suggested rules, view run history, compare runs |
| Auditor | View run history (read-only), verify rule configurations at point-in-time, export rule audit |

#### Data Requirements
- `MatchRule`, `MatchResult`, `MatchGroup`, `ReconciliationRun`, `ReconItem`

---

### 4.5 Items Explorer

**Purpose:** The master list of all reconciliation items. IntelliMatch calls this the "Items View" or "Transaction List." Analysts live here.

#### Features (Current + Gaps)

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 1 | **Status Tabs** | Implemented | Filter by: All, Matched, Unmatched, Proposed, Break, Write-off |
| 2 | **Column Sort** | Implemented | Sort by valueDate, reference, amount, age |
| 3 | **Context Filter** | Implemented | Dropdown to filter by context |
| 4 | **Search** | **NOT IMPLEMENTED** | Free-text search across reference, description, counterparty. Must be instant (client-side for demo). |
| 5 | **Advanced Filters Panel** | **NOT IMPLEMENTED** | Filter by: date range, amount range, side (Internal/External), match pass type, assigned analyst, reason code, SLA status. Combinable. Saveable. |
| 6 | **Column Chooser** | **NOT IMPLEMENTED** | Show/hide columns. Reorder via drag-and-drop. Save as preference. |
| 7 | **Side-by-Side View** | **NOT IMPLEMENTED** | Split screen: Internal items on left, External items on right. Matched pairs highlighted with connecting lines. |
| 8 | **Item Detail Drawer** | **NOT IMPLEMENTED** | Click an item to open a right-side drawer showing: all fields, match group (if matched), audit history for this item, linked exception, comments, original source data. |
| 9 | **Bulk Select & Actions** | **NOT IMPLEMENTED** | Checkbox selection. Bulk actions: assign reason code, assign to analyst, create manual match, request write-off. |
| 10 | **Export** | **NOT IMPLEMENTED** | Export filtered view to CSV/Excel. Include all visible columns. |
| 11 | **Pagination / Virtualization** | Partial | Currently renders all items. Need virtual scrolling for 10K+ items. |
| 12 | **Inline Editing** | **NOT IMPLEMENTED** | Edit reason code, add quick note, reassign -- without leaving the list. |
| 13 | **Color Coding by Age** | **NOT IMPLEMENTED** | Row background shade darkens as age increases. Visual urgency indicator. |
| 14 | **Carryforward Badge** | **NOT IMPLEMENTED** | Badge on items carried from prior days showing "CF+3d" etc. |

#### Filter Dimensions (What an analyst needs daily)

| Filter | Type | Options |
|--------|------|---------|
| Context | Dropdown | All contexts |
| Side | Toggle | Internal / External / Both |
| Status | Multi-select | Matched, Unmatched, Proposed, Break, Write-off |
| Value Date | Date range | From / To with calendar picker |
| Amount | Range | Min / Max with currency |
| Currency | Multi-select | USD, EUR, GBP, JPY, CHF |
| Counterparty | Typeahead | Search across counterparty names |
| Reference | Text | Contains / Starts with / Exact |
| Match Pass | Multi-select | Exact, Tolerance, Fuzzy, AI, Manual, None |
| Reason Code | Multi-select | All reason codes |
| Assigned To | Dropdown | All team members |
| SLA Status | Toggle | Within SLA / Breached / Near Breach |
| Age | Range | Min days / Max days |
| Carryforward | Toggle | Yes / No |
| Priority | Multi-select | Low, Medium, High, Critical |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | Search, filter, sort, view detail, assign reason codes, add notes, select items for manual matching, request write-off |
| Supervisor | Same + bulk assign, bulk close, change priority |
| Auditor | Read-only. Filter and export. View audit trail per item. |

---

### 4.6 Match Groups Viewer

**Purpose:** View, inspect, and manage match groups. This is what IntelliMatch calls "Match Groups" or "Matched Pairs" -- the fundamental output of reconciliation. **THIS SCREEN DOES NOT EXIST YET AND IS CRITICAL.**

#### Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Match Group List** | Table: Group ID, match type (1:1, 1:N, N:N, NET), internal count, external count, internal total, external total, net difference, match pass, confidence, status, created date. |
| 2 | **Match Type Filter** | Filter by: 1:1, 1:N, N:1, N:N, NET. This is how supervisors audit match quality. |
| 3 | **Confidence Filter** | Slider: show only groups with confidence below X%. Focuses review on low-confidence matches. |
| 4 | **Group Detail Expandable** | Click to expand: shows all internal items and all external items side by side. Field-by-field comparison. Differences highlighted in amber. |
| 5 | **Break Apart** | Button to unmatch a group. Returns all items to UNMATCHED status. Creates audit entry. Requires supervisor approval if group value > $100K. |
| 6 | **Modify Group** | Add or remove items from a match group. Recalculates net difference. |
| 7 | **Tolerance Visualization** | For tolerance matches: show the exact difference per field. Bar chart showing how close to the tolerance boundary. |
| 8 | **Match Lineage** | Show which rule matched the group, which pass, at what time, confidence score. Links back to matching run. |
| 9 | **Net Matching Detail** | For NET matches: waterfall showing how N items on internal side net to M items on external side. Show the netting calculation. |
| 10 | **Group Audit Trail** | Every action on this group: created, modified, broken apart, re-matched, commented on. |
| 11 | **Bulk Break** | Select multiple groups, break them all. Used when a matching rule produces false positives. |
| 12 | **Statistics** | Summary bar: total groups, by type, avg confidence, auto-matched vs manual, tolerance utilization distribution. |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | View groups, expand detail, break apart (with constraints), add comments |
| Supervisor | Approve break-apart requests, modify groups, bulk break, review low-confidence groups |
| Auditor | Read-only. Filter by date/type/confidence. Export match group report. View lineage. **This is the primary SOX audit screen.** |

#### Data Requirements
- New `MatchGroup` entity (replacing simple `MatchResult` for 1:1 cases and adding N:M support)

---

### 4.7 Balance Pools & Proof

**Purpose:** Daily balance proof and sign-off ceremony. IntelliMatch calls this "Balance Manager" or "Proof of Reconciliation."

#### Features (Current + Gaps)

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 1 | **Pool List by Context** | Implemented | Dropdown to select context, list of pools by date |
| 2 | **Balance Waterfall** | Implemented | Opening + Credits - Debits = Calculated Closing vs Stated Closing |
| 3 | **Proof Status Badge** | Implemented | IN PROOF / OUT OF PROOF / PENDING |
| 4 | **Sign-Off Buttons** | Implemented | Approve / Reject with confirmation dialog |
| 5 | **Workflow Stepper** | Implemented | Reconciled > In Proof > Signed Off |
| 6 | **Summary Stats** | Implemented | Total pools, in proof, out of proof, approved, total variance |
| 7 | **Balance Proof Formula Display** | **NOT IMPLEMENTED** | Explicitly show: `Opening Balance + Sum(Credits) - Sum(Debits) = Calculated Closing`. Then: `Calculated Closing - Stated Closing = Variance`. This is THE formula auditors look for. |
| 8 | **Drill into Movements** | **NOT IMPLEMENTED** | Click on "Credits" to see all credit items for that day. Click on "Debits" to see all debit items. This drill-down is fundamental. |
| 9 | **Multi-Level Sign-Off** | **NOT IMPLEMENTED** | Sign-off ceremony: (1) Analyst certifies match completion, (2) Supervisor reviews and signs, (3) Optional: Senior Manager final approval for RED contexts. |
| 10 | **Sign-Off Deadline** | **NOT IMPLEMENTED** | Configurable deadline per context (e.g., "USD Nostro must be signed off by 10:00 AM EST"). Countdown timer. Escalation if missed. |
| 11 | **Historical Comparison** | **NOT IMPLEMENTED** | Compare today's pool with yesterday's. Show movement: new items, resolved items, carried forward items. |
| 12 | **Variance Drill-Down** | **NOT IMPLEMENTED** | When OUT OF PROOF: show which specific items cause the variance. Link each variance component to the responsible exception. |
| 13 | **Carryforward Indicator** | **NOT IMPLEMENTED** | Show how many items in this pool are carried from prior days. Age distribution of carryforward items. |
| 14 | **Proof Certificate** | **NOT IMPLEMENTED** | Printable/exportable PDF showing: context, date, all balances, variance, sign-off chain, auditor-ready format. |
| 15 | **Cross-Context Proof** | **NOT IMPLEMENTED** | For consolidated entities: sum of all context pools = total entity position. Bank-wide view. |

#### The Sign-Off Ceremony (Critical IntelliMatch Feature)

IntelliMatch has a formal "sign-off" process that auditors specifically look for:

1. **Analyst Certification**: "I certify that I have investigated all exceptions and the reconciliation is complete to the best of my knowledge."
   - Checkbox with timestamp and digital signature
   - Cannot proceed if there are CRITICAL priority exceptions unresolved
   - Cannot proceed if match rate is below configurable threshold

2. **Supervisor Review**: Supervisor sees analyst certification, reviews:
   - Exception summary
   - Aging of remaining items
   - Variance amount
   - Carryforward items
   - Then clicks Approve or Reject (with mandatory reason for rejection)

3. **Audit Record**: Immutable record of the entire ceremony with timestamps and user IDs

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | View pools, drill into movements, certify completion (step 1 of sign-off) |
| Supervisor | Review certification, approve/reject sign-off, view variance drill-down |
| Auditor | View sign-off ceremony history, verify timestamps, export proof certificates |

---

### 4.8 Exception Management

**Purpose:** Investigate and resolve reconciliation breaks. IntelliMatch calls these "exceptions" or "breaks." This is where analysts spend 80% of their time after matching.

#### Features (Current + Gaps)

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 1 | **Exception List** | Implemented | Filterable table with priority, reason code, assigned analyst, SLA status |
| 2 | **Priority Tabs** | Implemented | All / Critical / High / Medium / Low |
| 3 | **Write-Off Request** | Implemented | Create write-off request from exception |
| 4 | **Case Escalation** | Implemented | Escalate exception to a formal case |
| 5 | **Add Notes** | Implemented | Add text notes to an exception |
| 6 | **Reassign** | Implemented | Reassign to a different analyst |
| 7 | **Resolve** | Implemented | Mark exception as resolved |
| 8 | **SLA Countdown Timer** | **NOT IMPLEMENTED** | Live countdown to SLA breach per exception. Color: green > 4h, amber > 1h, red < 1h, flashing if breached. |
| 9 | **Root Cause Analysis** | **NOT IMPLEMENTED** | Guided workflow: (1) Check counterparty for matching entry, (2) Check date variance, (3) Check amount difference, (4) Classify root cause. Pre-populated checklist. |
| 10 | **Counterparty Contact** | **NOT IMPLEMENTED** | Link to counterparty contact info. Template email: "Regarding reference X, we are unable to match..." Auto-populated. |
| 11 | **Linked Items Panel** | **NOT IMPLEMENTED** | Show potential matching candidates: items on the opposite side that partially match (same amount, close date, similar reference). Analyst can click to create manual match. |
| 12 | **Exception Grouping** | **NOT IMPLEMENTED** | Auto-group exceptions by: reason code, counterparty, value date, amount range. Batch investigate related exceptions. |
| 13 | **Auto-Resolution Rules** | **NOT IMPLEMENTED** | Configure rules: "If exception is TIMING and age > 5d, auto-resolve with note: Expected timing difference." |
| 14 | **Bulk Actions** | **NOT IMPLEMENTED** | Select multiple: bulk assign reason code, bulk assign analyst, bulk request write-off, bulk resolve. |
| 15 | **Exception Dashboard** | **NOT IMPLEMENTED** | Mini-dashboard at top: total open, by priority, by reason code, by analyst, by age bucket. Donut + bar charts. |
| 16 | **Attachment Support** | **NOT IMPLEMENTED** | Attach supporting documents: SWIFT messages, counterparty emails, screenshots. View inline. |
| 17 | **Threaded Comments** | **NOT IMPLEMENTED** | Replace flat notes with threaded comments. Tag team members with @mention. |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | Investigate, add notes, assign reason code, request write-off, escalate to case, resolve, attach documents |
| Supervisor | All analyst actions + bulk operations, reassign across team, override SLA, approve auto-resolution rules |
| Auditor | View exception history, verify resolution audit trail, check SLA compliance, export exception aging report |

---

### 4.9 Case Manager

**Purpose:** Manage complex, long-running investigation cases that require more than a simple exception resolution. IntelliMatch calls this "Case Management" or "Investigation Manager."

#### Features (Current + Gaps)

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 1 | **Case List** | Partial | Table showing all cases. Status: Open, In Progress, Pending External, Escalated, Resolved, Closed. |
| 2 | **Case Detail** | **NOT IMPLEMENTED** | Full page view: case header, linked exception/item, timeline of events, threaded comments, attachments, status workflow. |
| 3 | **Case Timeline** | **NOT IMPLEMENTED** | Visual timeline of all events: created, assigned, comment added, status changed, document attached, resolved. |
| 4 | **Case Kanban Board** | **NOT IMPLEMENTED** | Drag-and-drop board: columns = status. Move cases between columns. Visual workload management. |
| 5 | **Case Assignment** | Partial | Assign to team member. Auto-assignment based on context/expertise. |
| 6 | **Escalation Path** | **NOT IMPLEMENTED** | Configurable: Level 1 (Analyst, 24h) > Level 2 (Senior Analyst, 48h) > Level 3 (Supervisor, 72h) > Level 4 (Manager, 96h). Auto-escalate on SLA breach. |
| 7 | **Case Templates** | **NOT IMPLEMENTED** | Pre-defined investigation templates: Missing Trade, Rate Dispute, Counterparty Discrepancy. Each has a checklist of investigation steps. |
| 8 | **Related Cases** | **NOT IMPLEMENTED** | Show cases with same counterparty, similar amount, or same root cause. Pattern detection. |
| 9 | **External Communication Log** | **NOT IMPLEMENTED** | Log emails/calls with counterparty. Track: contacted, awaiting response, response received. |
| 10 | **Resolution Workflow** | **NOT IMPLEMENTED** | Formal resolution: root cause identified, corrective action taken, preventive action documented. Required fields before closing. |
| 11 | **Case Metrics** | **NOT IMPLEMENTED** | Avg time to resolve by case type, analyst, priority. Trend charts. |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | Create cases, update status, add comments/documents, resolve |
| Supervisor | All analyst actions + view kanban, reassign, change priority, configure escalation paths, view metrics |
| Auditor | View case history, verify resolution documentation, export case reports |

---

### 4.10 Write-Off Center

**Purpose:** Manage the full lifecycle of write-off requests. In financial recon, writing off an unmatched item has P&L impact and requires rigorous approval.

#### Features (Current + Gaps)

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 1 | **Write-Off List** | Implemented | Table of all write-off requests with status (Pending, Approved, Rejected) |
| 2 | **Approve/Reject** | Implemented | Supervisor can approve or reject |
| 3 | **Threshold-Based Routing** | **NOT IMPLEMENTED** | Configurable: < $1K auto-route to supervisor, $1K-$50K requires VP approval, > $50K requires CFO approval. Multi-tier. |
| 4 | **Write-Off Policy Engine** | **NOT IMPLEMENTED** | Rules: "FX rounding < $2 can be auto-approved." "Fee differences < $10 require one approval." "Missing trades require two approvals regardless of amount." |
| 5 | **Write-Off Budget Tracking** | **NOT IMPLEMENTED** | Track total write-offs against a monthly/quarterly budget. Alert when approaching 80% of budget. |
| 6 | **GL Integration Stub** | **NOT IMPLEMENTED** | Show what the GL posting would look like: Dr/Cr entries, account codes, amounts. (Demo data, not real GL.) |
| 7 | **Write-Off Report** | **NOT IMPLEMENTED** | Monthly summary: total written off by context, by reason code, by approver. Trend chart. |
| 8 | **Reversal** | **NOT IMPLEMENTED** | Reverse an approved write-off if the matching entry appears later. Creates audit entry. |
| 9 | **Supporting Documentation** | **NOT IMPLEMENTED** | Require attachment of supporting docs before approval (configurable per threshold). |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | Request write-off, add supporting documents and comments |
| Supervisor | Approve/reject, view budget utilization, configure thresholds |
| Auditor | View write-off history, verify approval chain, export write-off report for SOX |

---

### 4.11 Manual Matching Workbench

**Purpose:** A dedicated screen for analysts to manually match items when the automated engine cannot find a match. IntelliMatch has a dedicated "Manual Match" screen and it is heavily used.

#### Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Split-Screen Layout** | Left panel: unmatched INTERNAL items. Right panel: unmatched EXTERNAL items. Both filterable and sortable. |
| 2 | **Drag-and-Drop Matching** | Drag an internal item onto an external item to propose a match. Or select multiple items on each side for N:N matching. |
| 3 | **Auto-Suggest Candidates** | When selecting an item on one side, the other side auto-filters to show potential matches (same amount, similar date, similar reference). Ranked by likelihood. |
| 4 | **Difference Calculator** | When items are selected for matching, show: amount difference, date difference, reference comparison (side by side with diffs highlighted). |
| 5 | **Match Preview** | Before confirming: show what the match group would look like. Require a comment explaining why this manual match is correct. |
| 6 | **Supervisor Approval Queue** | Manual matches above a configurable threshold ($X) require supervisor approval before becoming permanent. |
| 7 | **Net Matching Mode** | Toggle to "Net Matching": select multiple items on each side, system calculates net. If within tolerance, allow match creation. |
| 8 | **Keyboard Shortcuts** | Power users need speed: Tab to move between panels, Enter to select, Ctrl+M to match, Ctrl+Z to undo last selection. |
| 9 | **Recently Matched** | Panel showing the last 10 manual matches created in this session. Quick undo. |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | Select items, create manual matches, add comments |
| Supervisor | Approve manual match requests above threshold |
| Auditor | View manual match history, verify each has a comment/justification |

#### Data Requirements
- `ReconItem[]` filtered by status UNMATCHED, `MatchGroup` (new), `AuditEvent`

---

### 4.12 Carryforward Manager

**Purpose:** Track items that remain unmatched from prior business days and are "carried forward" into subsequent days. This is a critical IntelliMatch feature -- a VP of Recon Ops cares deeply about carryforward aging.

#### Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Carryforward Summary** | Per context: how many items carried from each prior date. Bar chart: X-axis = original date, Y-axis = count. Color by age bucket. |
| 2 | **Carryforward List** | Table: original item ID, original date, days carried, amount, side, status, assigned analyst. |
| 3 | **Auto-Resolution** | Items that appear on the opposite side in a subsequent day's file: system auto-matches them and shows "CF-resolved." |
| 4 | **Carryforward Policy** | Configurable: "Items > 30 days old must be escalated to supervisor." "Items > 60 days must be written off or have a formal case." |
| 5 | **Carryforward Trend** | Line chart: carryforward count over last 30 days. Should trend toward zero. Increasing trend = problem. |
| 6 | **Impact on Proof** | Show how carryforward items affect the balance proof. Itemized: which carryforward items contribute to the variance. |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | View carryforward items, investigate, resolve |
| Supervisor | Configure carryforward policies, review aging carryforward, escalate |
| Auditor | View carryforward aging trends, verify policy compliance |

---

### 4.13 Aging Analysis

**Purpose:** Dedicated aging analysis that goes beyond the dashboard widget. IntelliMatch has a full "Aging Report" that auditors pull monthly.

#### Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Aging Matrix** | Rows = contexts, Columns = aging buckets (0-1d, 2-5d, 6-15d, 16-30d, 30-60d, 60-90d, 90d+). Cells show count AND value. Click cell to drill into items. |
| 2 | **Aging by Reason Code** | Pivot: rows = reason codes, columns = aging buckets. Shows which root causes generate the oldest exceptions. |
| 3 | **Aging by Counterparty** | Pivot: rows = counterparties, columns = aging buckets. Identifies problematic counterparties. |
| 4 | **Aging by Analyst** | Pivot: rows = analysts, columns = aging buckets. Shows individual workload and resolution speed. |
| 5 | **Aging Trend** | Line chart: total aged items over time. Split by bucket. Goal: aging should be decreasing. |
| 6 | **Value-Weighted Aging** | Same matrix but cell values are dollar amounts, not counts. A few high-value aged items may matter more than many low-value ones. |
| 7 | **SLA Compliance by Age** | Cross-reference: which items are within SLA vs. breached, by age bucket. |
| 8 | **Export for SOX** | One-click export of aging matrix in auditor-standard format. Includes context, date range, filter criteria, generated-by, timestamp. |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | View own items in aging matrix |
| Supervisor | View team-wide aging, identify systemic issues |
| Auditor | **Primary user.** Generate aging reports for period-end. Export for SOX documentation. |

---

### 4.14 Audit Trail & Compliance

**Purpose:** Immutable, searchable log of every action taken in the system. SOX compliance requires demonstrating who did what, when.

#### Features (Current + Gaps)

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 1 | **Audit Event List** | Partial | Basic list in ReconReport screen. **Gap:** Not searchable, not filterable, limited to 10 events. |
| 2 | **Full Audit Search** | **NOT IMPLEMENTED** | Search by: user, action type, date range, entity type (item, exception, write-off, pool), entity ID. |
| 3 | **User Activity Report** | **NOT IMPLEMENTED** | Per user: all actions in a date range. For SOX: prove that controls were performed by authorized individuals. |
| 4 | **Change Diff View** | **NOT IMPLEMENTED** | For any entity change: show before/after. E.g., "Exception reason code changed from TIMING to COUNTERPARTY_ERROR by Sarah Chen at 10:42 AM." |
| 5 | **Compliance Dashboard** | **NOT IMPLEMENTED** | SOX-oriented summary: all sign-offs completed? All write-offs properly approved? Any exceptions aged > policy threshold? Controls checklist: green/red. |
| 6 | **Regulatory Report Templates** | **NOT IMPLEMENTED** | Pre-built: SOX 404 Reconciliation Evidence, SOX Sign-Off Summary, Write-Off Approval Chain Report, Exception Aging Report, Data Lineage Report. |
| 7 | **Data Retention Policy** | **NOT IMPLEMENTED** | Configure how long audit data is retained (e.g., 7 years for SOX). Show retention status. |
| 8 | **Tamper Detection** | **NOT IMPLEMENTED** | Hash chain on audit events. Any tampering would break the chain. (Enterprise feature for auditor confidence.) |
| 9 | **Export with Attestation** | **NOT IMPLEMENTED** | Export audit trail with system attestation: "This report was generated on [date] by [user] and has not been modified." Digital signature. |

#### Persona Actions

| Persona | Actions |
|---------|---------|
| Analyst | View audit trail for own actions |
| Supervisor | View full audit trail, generate compliance reports |
| Auditor | **Primary user.** Search, filter, export, verify control effectiveness, generate SOX evidence packages. |

---

### 4.15 Reports & Analytics

**Purpose:** Comprehensive reporting beyond the daily dashboard. IntelliMatch has a full "Report Designer" -- we provide canned reports for the demo.

#### Report Catalog

| # | Report | Description | Primary User |
|---|--------|-------------|-------------|
| 1 | **Daily Reconciliation Summary** | Implemented (ReconReport screen). Per context: match rate, balance proof, exceptions, sign-off status. | Supervisor |
| 2 | **Exception Aging Report** | Aging matrix by context, reason code, counterparty. Exportable. | Auditor |
| 3 | **Write-Off Summary** | Total write-offs by period, context, reason code, approver. Trend chart. | Auditor, CFO |
| 4 | **SLA Compliance Report** | Percentage of exceptions resolved within SLA by context, analyst, priority. | Supervisor |
| 5 | **Team Performance Report** | Per analyst: items resolved, avg resolution time, SLA compliance, error rate. Leaderboard. | Supervisor |
| 6 | **Match Quality Report** | Match rate by pass type, confidence distribution, false positive rate, manual match percentage. | Supervisor |
| 7 | **Carryforward Trend Report** | Carryforward count and value over time by context. | Auditor |
| 8 | **Balance Proof History** | For a context: 30-day balance proof history. In-proof streak, variance history. | Auditor |
| 9 | **Counterparty Dispute Report** | By counterparty: open exceptions, aging, dispute frequency, resolution pattern. | Analyst, Supervisor |
| 10 | **Rule Effectiveness Report** | Per match rule: matches produced, avg confidence, false positive rate. Optimization recommendations. | Supervisor |
| 11 | **Data Quality Report** | File load success rate, validation error trends, missing fields, duplicate records. | Supervisor |
| 12 | **SOX Evidence Package** | Combined report: sign-off ceremonies, write-off approvals, exception aging, control checklist. Auditor-ready PDF. | Auditor |
| 13 | **Period-End Reconciliation Pack** | Month-end or quarter-end comprehensive package: all contexts, all proofs, all sign-offs, exception disposition. | Auditor, Controller |

#### Report Features

| Feature | Description |
|---------|-------------|
| **Scheduling** | Schedule any report: daily, weekly, monthly. Email to distribution list. |
| **Export Formats** | PDF, Excel, CSV |
| **Parameterized** | Date range, context filter, user filter, threshold |
| **Drill-Through** | Click any number in a report to see the underlying items |
| **Comparison Mode** | Compare this period vs. prior period for any report |

---

### 4.16 Administration

**Purpose:** System configuration and user management. Not part of the daily recon workflow but essential for platform completeness.

#### Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **User Management** | Create/edit/deactivate users. Assign roles: Analyst, Supervisor, Auditor, Admin. |
| 2 | **Team Configuration** | Create teams, assign members, assign contexts to teams. |
| 3 | **Role Permissions** | Configurable permission matrix. Fine-grained: "Can approve write-offs > $50K" |
| 4 | **SLA Policy Editor** | Define SLA policies per context and priority level. Set escalation paths. |
| 5 | **Approval Chain Editor** | Define multi-tier approval chains for write-offs, sign-offs, manual matches. |
| 6 | **Reason Code Management** | Add/edit/deactivate reason codes. Set which require specific resolution workflows. |
| 7 | **Notification Configuration** | Configure per-event notifications: email, in-app, Slack/Teams webhook. |
| 8 | **System Health** | Uptime, data load status, matching engine performance metrics. |
| 9 | **Data Retention Settings** | Configure retention periods per data type. Archive/purge controls. |
| 10 | **Branding** | Configurable logo, colors, company name. White-label ready. |

---

### 4.17 Notifications & Alerts

**Purpose:** Proactive notifications to keep analysts and supervisors informed of items requiring attention.

#### Alert Types

| Alert | Trigger | Recipients |
|-------|---------|------------|
| SLA Breach Warning | Exception within 1 hour of SLA deadline | Assigned analyst |
| SLA Breached | Exception past SLA deadline | Assigned analyst + supervisor |
| Pool Awaiting Sign-Off | Balance pool in proof, pending approval | Supervisor |
| Pool Out of Proof | Balance pool variance detected | Analyst + supervisor |
| Write-Off Pending Approval | New write-off request created | Next approver |
| Match Rate Drop | Context match rate drops below threshold | Supervisor |
| File Not Received | Expected data file not loaded by deadline | Supervisor |
| High-Value Exception | New exception with amount > configurable threshold | Supervisor |
| Escalation | Case auto-escalated due to SLA breach | Next-level approver |
| Carryforward Alert | Items > configurable age threshold | Assigned analyst |

#### Notification Channels
- **In-App**: Toast notifications + notification center (bell icon with badge count)
- **Email**: Configurable digest (immediate, hourly, daily)
- **Webhook**: Slack/Teams integration for team channels

---

## 5. Matching Logic Deep-Dive

### 5.1 Current Implementation

The matching engine implements a 4-pass pipeline:

1. **Pass 1 -- EXACT**: Match on reference (normalized substring match) + exact amount + exact value date. Confidence: 100%.
2. **Pass 2 -- TOLERANCE**: Same as exact but amount within configurable tolerance (e.g., $0.50 absolute). Confidence: 85-100%.
3. **Pass 3 -- FUZZY**: Partial reference match + date range (+-2 days) + amount within tolerance. Best-match selection. Confidence: 70-95%.
4. **Pass 4 -- AI SUGGESTED**: Cross-field pattern analysis: counterparty + amount within 0.5% + date within 3 days. Confidence: 60-85%. These are flagged as PROPOSED for human review.

### 5.2 What Is Missing for Enterprise Parity

#### 5.2.1 N:M Matching (1:N, N:1, N:N, NET)

IntelliMatch's most powerful feature is its ability to handle complex match groups:

**1:N Example (Common in Nostro recon):**
- Internal: Wire Transfer $1,000,000
- External: Three bank entries: $400,000 + $350,000 + $250,000

The engine should:
1. Identify that the sum of the 3 external entries equals the 1 internal entry
2. Create a match group with type "1:N"
3. Show the netting in the Match Groups viewer

**N:N Example (Common in trade settlement):**
- Internal: 5 trade entries totaling $2,345,678.90
- External: 3 bank settlement entries totaling $2,345,678.90

**NET Matching Algorithm:**
```
1. Group unmatched items by common attributes (counterparty, date, currency)
2. For each group, calculate net internal and net external
3. If |net_internal - net_external| <= tolerance:
   a. Create NET match group
   b. Include all contributing items
4. Support configurable maximum group size (prevent runaway groups)
```

#### 5.2.2 Split Matching

Different from 1:N in intent:
- A known split: the source system tells us an item was split
- The engine should look for the parts and assemble them

#### 5.2.3 Match Scoring Matrix

Replace the current boolean pass/fail with a weighted scoring system:

| Field | Weight | Scoring |
|-------|--------|---------|
| Reference | 40% | Exact = 100, Substring = 70, Fuzzy (Levenshtein) = 50, No match = 0 |
| Amount | 30% | Exact = 100, Within 0.01% = 95, Within tolerance = 80, No match = 0 |
| Value Date | 20% | Same day = 100, +/-1d = 80, +/-2d = 60, +/-3d = 40, Beyond = 0 |
| Counterparty | 10% | Exact = 100, Alias match = 80, No match = 0 |

**Total score**: Weighted sum. Auto-match if >= 90. Propose if >= 70. Ignore if < 70.

#### 5.2.4 Composite Match Keys

Allow users to define composite keys:
```
Key1 = CONCAT(currency, valueDate, LEFT(reference, 8))
Key2 = CONCAT(counterparty, amount, ABS(datepart(day, valueDate)))
```

Match on Key1 first, then Key2. This is how IntelliMatch power users optimize matching for their specific data patterns.

#### 5.2.5 Configurable Match Field Transformations

Before comparing, apply transformations:
- Strip leading zeros from reference
- Normalize counterparty names (via alias table)
- Convert date formats
- Apply exchange rate to normalize amounts to base currency
- Apply sign convention (bank debit = positive, ledger debit = negative)

---

## 6. Workflows & Approval Chains

### 6.1 Exception Resolution Workflow

```
NEW EXCEPTION
    |
    v
[Auto-assign to analyst based on context/workload]
    |
    v
INVESTIGATING
    |
    +---> [Matched manually] --> RESOLVED --> Close
    |
    +---> [Request write-off] --> PENDING WRITE-OFF
    |         |
    |         +---> [Approved] --> WRITTEN OFF --> Close
    |         +---> [Rejected] --> Back to INVESTIGATING
    |
    +---> [Escalate to case] --> CASE OPEN --> (Case workflow)
    |
    +---> [Auto-resolved] --> RESOLVED (carried forward item matched next day)
    |
    +---> [SLA Breached] --> AUTO-ESCALATE to supervisor
```

### 6.2 Write-Off Approval Chain

```
ANALYST requests write-off
    |
    v
[Amount < $1,000?]
    |-- YES --> Supervisor approves/rejects
    |-- NO  --> [Amount < $50,000?]
                    |-- YES --> Supervisor approves/rejects
                    |              |
                    |              v
                    |           [Approved?] --> VP counter-signs (if required by policy)
                    |-- NO  --> VP approves/rejects
                                   |
                                   v
                                [Approved?] --> CFO/Controller counter-signs
```

### 6.3 Balance Pool Sign-Off Ceremony

```
MATCHING COMPLETE
    |
    v
[Balance proof calculated]
    |
    v
[In proof?]
    |-- YES --> Analyst certifies completion
    |              |
    |              v
    |           Supervisor reviews and signs off
    |              |
    |              v
    |           [Red context?] --> Manager final approval
    |              |
    |              v
    |           SIGNED OFF (immutable record created)
    |
    |-- NO  --> Analyst investigates variance
                   |
                   v
                [Variance resolved?]
                   |-- YES --> Re-run proof --> Loop back
                   |-- NO  --> Supervisor reviews
                                  |
                                  v
                               [Approve out-of-proof?]
                                  |-- YES --> Sign off with exception note
                                  |-- NO  --> Continue investigation
```

### 6.4 Manual Match Approval

```
ANALYST creates manual match
    |
    v
[Match value > $100K?]
    |-- YES --> Route to supervisor for approval
    |              |
    |              v
    |           [Supervisor approves?]
    |              |-- YES --> Match confirmed
    |              |-- NO  --> Items return to unmatched
    |
    |-- NO  --> Match auto-confirmed (with audit trail)
```

---

## 7. Gap Analysis vs. Current Implementation

### 7.1 Critical Gaps (Must fix for demo credibility)

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| 1 | **No Match Groups entity/screen** | Cannot show 1:N, N:1, N:N, NET matching. Cannot drill into match groups. Cannot break apart matches. An IntelliMatch user will immediately notice this. | P0 |
| 2 | **No Auditor role** | No separate auditor view. Auditors need read-only access with enhanced audit trail visibility and SOX-specific reports. | P0 |
| 3 | **No drill-down from Balance Pool to movements** | Cannot click "Credits" to see individual credit items. This is fundamental to balance proof verification. | P0 |
| 4 | **No search on Items screen** | Cannot find a specific transaction by reference number. Every IntelliMatch user's first action is to search by reference. | P0 |
| 5 | **No Sign-Off Ceremony** | Current sign-off is a single button click. IntelliMatch has a formal multi-step ceremony with analyst certification and supervisor review. | P1 |
| 6 | **No Manual Matching Workbench** | Manual matching is the #1 daily activity for analysts. No dedicated screen for this. | P1 |
| 7 | **No Carryforward tracking** | No way to see which items were carried from prior days. Critical for aging analysis and period-end reporting. | P1 |
| 8 | **No N:M matching logic** | Only 1:1 matching implemented. Batch payments and consolidated settlements cannot be matched. | P1 |
| 9 | **No Advanced Filters** | Cannot filter by date range, amount range, multiple criteria simultaneously. Analysts need this constantly. | P1 |
| 10 | **Audit Trail is minimal** | Only captures a few event types. Not searchable. Not exportable. | P2 |

### 7.2 Cosmetic / UX Gaps

| # | Gap | Description |
|---|-----|-------------|
| 1 | No item detail drawer | Must click through to see item details |
| 2 | No keyboard shortcuts | Power users expect keyboard navigation |
| 3 | No saved filters | Analysts recreate the same filters every day |
| 4 | No column chooser | Fixed column layout on Items screen |
| 5 | No virtual scrolling | Performance will degrade with realistic data volumes |
| 6 | No breadcrumb navigation | Lost context when drilling down |
| 7 | No dark/light mode toggle | Fixed dark mode (though dark is appropriate for financial terminals) |

### 7.3 What We Have That IntelliMatch Does NOT

These are our differentiators:

| # | Feature | Why It Matters |
|---|---------|---------------|
| 1 | **AI-Suggested Matching (Pass 4)** | IntelliMatch has no ML/AI matching. We do. This is our innovation story. |
| 2 | **AI-Suggested Rules** | IntelliMatch requires manual rule creation. We auto-suggest rules based on data patterns. |
| 3 | **Real-time Matching Progress Animation** | IntelliMatch runs matching as a batch job. We show pass-by-pass progress in real-time with animations. |
| 4 | **Modern Cloud-Native UI** | IntelliMatch has a Java Swing / thick-client UI from 2005. We have a modern, responsive web UI. |
| 5 | **Role Switcher** | IntelliMatch requires logging out and back in with a different user. We toggle instantly for demo purposes. |
| 6 | **One-Click Deploy** | IntelliMatch requires a 6-month implementation. We deploy to a URL in seconds. |

### 7.4 Feature Priority Matrix for Demo

| Feature | Demo Impact | Implementation Effort | Recommendation |
|---------|------------|----------------------|----------------|
| Match Groups screen | Very High | Medium | **Build next** |
| Items search + advanced filters | Very High | Low | **Build next** |
| Balance Pool movement drill-down | Very High | Medium | **Build next** |
| Manual Matching Workbench | Very High | High | Build after above |
| Auditor role + SOX dashboard | High | Medium | Build after above |
| Sign-Off Ceremony | High | Medium | Build after above |
| N:M Matching logic | High | Very High | Scope carefully |
| Carryforward Manager | Medium | Medium | Build if time |
| Case Manager detail page | Medium | Medium | Build if time |
| Aging Analysis screen | Medium | Low | Build if time |
| Notifications | Low (demo) | Medium | Skip for demo |
| Administration | Low (demo) | High | Skip for demo |
| Data Ingestion | Low (demo) | High | Skip for demo (use seed data) |

---

## Appendix A: IntelliMatch Feature Comparison

| IntelliMatch Feature | ReconX Equivalent | Status |
|---------------------|-------------------|--------|
| Reconciliation Definition | ReconContext | Implemented |
| Data Manager | Data Ingestion & File Manager | NOT implemented |
| Matching Engine (auto match) | Matching Engine Console | Partially implemented |
| Manual Match | Manual Matching Workbench | NOT implemented |
| Match Groups (1:1, 1:N, N:N) | Match Groups Viewer | NOT implemented |
| Break/Re-match | Break apart in Match Groups | NOT implemented |
| Exception Management | Exception Management | Partially implemented |
| Case Management | Case Manager | Partially implemented |
| Write-Off Management | Write-Off Center | Partially implemented |
| Balance Proof | Balance Pools & Proof | Partially implemented |
| Sign-Off Manager | Part of Balance Pools | Partially implemented |
| Aging Report | Aging Analysis | NOT implemented |
| Carryforward | Carryforward Manager | NOT implemented |
| Audit Trail | Audit Trail & Compliance | Minimally implemented |
| User Administration | Administration | NOT implemented |
| Report Designer | Reports & Analytics | Partially implemented |
| Scheduled Jobs | ScheduledTask entity | NOT implemented |
| SWIFT Message Viewer | Attachment support | NOT implemented |
| GL Posting | GL Integration Stub | NOT implemented |
| Multi-entity consolidation | Cross-context proof | NOT implemented |

## Appendix B: Data Volume Expectations for Demo

| Entity | Demo Volume | Production Volume |
|--------|------------|-------------------|
| Contexts | 4 | 50-200 |
| Items per context per day | 100-400 | 5,000-50,000 |
| Total items (30 days) | ~2,000 | 500,000-5,000,000 |
| Match groups | ~900 | 200,000-2,000,000 |
| Exceptions | 60 | 2,000-20,000 |
| Balance pools | 20 | 1,500-6,000 |
| Write-off requests | 8 | 200-2,000 |
| Audit events | ~50 | 100,000+ |

## Appendix C: Terminology Mapping

| Industry Term | IntelliMatch Term | ReconX Term |
|--------------|-------------------|-------------|
| Reconciliation Definition | Recon Def | ReconContext |
| Transaction | Item | ReconItem |
| Internal Side | Book / Ledger | INTERNAL |
| External Side | Bank / Counterparty | EXTERNAL |
| Matched Pair / Group | Match Group | MatchGroup |
| Break / Exception | Break | Exception |
| Write-Off | Write-Off | WriteOffRequest |
| Balance Proof | Balance Pool | BalancePool |
| Sign-Off | Sign-Off | SignOffCeremony |
| Aging Bucket | Aging Bucket | AgingBucket |
| Carry Forward | CF / Brought Forward | CarryForwardItem |
| Tolerance | Tolerance | tolerance (on MatchRule) |
| Matching Pass | Match Pass / Rule | MatchRule pass |
| Reason Code | Break Category | ReasonCode |

---

*Document generated March 15, 2026. This specification represents the complete feature set required to position ReconX as a credible alternative to IntelliMatch, FIS Integrity, SmartStream TLM, Duco, and Gresham Clareti.*
