# BizOS Launch Readiness Audit

**Document version:** 1.0  
**Date:** 2026-06-15  
**Scope:** BizOS Backend + Frontend (full platform)  
**Review panel:** SaaS Founder · ERP Consultant · POS Consultant · Retail Operations Expert · Product Manager · Principal Engineer  

**Methodology:** Code-level audit of services, repositories, routes, schema, seed data, and frontend workflows. No assumptions—findings trace to implemented behavior.

---

## Launch Readiness Score: **38 / 100**

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Core transactional integrity | 55 | 20% | 11.0 |
| Workflow completeness | 40 | 15% | 6.0 |
| Reporting | 45 | 10% | 4.5 |
| RBAC & security | 30 | 15% | 4.5 |
| SaaS / commercial readiness | 15 | 15% | 2.25 |
| Frontend / UX parity | 35 | 10% | 3.5 |
| Bangladesh SME fit | 50 | 10% | 5.0 |
| Test / ops readiness | 10 | 5% | 0.5 |
| **Total** | | | **37.25 → 38** |

**Board verdict:** Do **not** launch commercially until P0 data-integrity and security issues are resolved. Backend core is investable; product layer is pre-beta.

---

# Part 1 — Business Workflow Audit

## 1. Customer Journey

### Implemented happy path
1. `POST /customers` → create customer (phone uniqueness per shop)
2. Optional `POST /khata/accounts/ensure` → khata account (balance 0)
3. `POST /sales` with `customerId` → stats updated (`totalPurchasesCents`, `totalOrders`)
4. Sale with due → khata DEBIT auto-created if `customerId` present
5. `POST /payments` (payableType=sale) or khata collection → reduces due
6. `GET /customers`, `GET /customers/:id` → list/detail
7. Soft delete via `DELETE /customers/:id`

### Frontend journey
- `/dashboard/customers` — list, form, detail (real API)
- Ledger customer tab — khata via real API
- POS customer selector — API with mock fallback

### Missing workflow steps
| Step | Priority |
|------|----------|
| Auto-create khata on customer create | Important |
| Customer credit limit set + enforce at POS | Critical |
| Customer statement (sales + khata + payments) printable PDF | Critical |
| Due reminder workflow (SMS/WhatsApp/Telegram) | Critical |
| Customer merge / duplicate detection beyond phone | Important |
| Block delete if open balance or active dues | Critical |
| Customer ledger page (parity with supplier) | Important |
| Loyalty / tags → price list assignment | Optional |

### Edge cases not handled
- **Sale with `dueCents > 0` but no `customerId`** → receivable on sale row only; no khata; untracked walk-in credit
- Soft-deleted customer still on historical sales (`SetNull` FK)
- Khata collection does **not** reduce `sale.dueCents` → sale vs khata divergence
- `totalPurchasesCents` not net of returns

### Data consistency issues
- Sale dues vs khata balance can drift (two payment paths)
- No reconciliation job between `sales.due_cents` aggregate and khata

---

## 2. Supplier Journey

### Implemented happy path
1. `POST /suppliers` → create
2. `POST /purchases` with `supplierId` → PO; if RECEIVED → stock IN; if due → khata CREDIT
3. `PUT /purchases/:id/status` → ORDERED to RECEIVED triggers stock
4. `POST /payments` (payableType=purchase) → reduces PO due + khata DEBIT
5. `POST /khata/accounts/:id/repayment` → supplier payment
6. `GET /suppliers/:id/due-tracking`, `/ledger`, `/payments`, `/purchases`

### Missing workflow steps
| Step | Priority |
|------|----------|
| Purchase order approval | Optional |
| Partial line receive | Important |
| Supplier statement PDF | Important |
| Payment schedule / aging | Important |
| Block delete with open PO/khata | Critical |

### Edge cases not handled
- **Due-tracking double-count bug:** `totalShopOwesCents = purchaseDueCents + abs(khataBalance)` when both reflect same obligation → **inflated payables**
- Payments list excludes khata repayments
- Purchase without supplier but with due → no khata tracking

### Data consistency issues
- Supplier payables report unreliable until double-count fixed
- `totalSuppliedCents` not reduced on CANCELLED PO

---

## 3. Sales Journey

### Implemented happy path
1. `POST /sales` → validate stock → compute totals → invoice number
2. Transaction: stock OUT, sale + items (always COMPLETED), optional payment, optional khata DEBIT
3. CASH payment → cashbook IN
4. `GET /sales`, `GET /sales/:id`, `GET /sales/:id/invoice` (PDF)
5. `POST /sales/:id/return` → stock RETURN, refund payment, khata CREDIT if due reduced
6. Additional payment via `POST /payments` payableType=sale

### Frontend journey
- POS checkout → real `sales.createSale` (mock fallback on error — **critical bug**)
- Returns → **local Zustand only**; backend `sales.return` not called
- Offline → outbox queue then error thrown (no pending receipt UX)

### Missing workflow steps
| Step | Priority |
|------|----------|
| Sale void (distinct from return) | Critical |
| Hold / park sale | Important |
| Split payment (cash + bKash) | Critical |
| Cashier shift open/close | Critical |
| Manager PIN for discount/void | Important |
| Barcode scan-first POS | Critical |
| Thermal receipt print | Critical |
| Link bKash/Nagad sale to MFS wallet | Critical |
| Quotation → sale conversion | Optional |
| Sales order (deliver later) | Optional |

### Edge cases not handled
- Concurrent sales race on stock (no row lock)
- `OVERPAID` status never set; excess payment capped silently
- Return refund hardcoded CASH only
- Upfront sale payment does not emit `payment.recorded` event
- Partial return keeps status COMPLETED (confusing)
- No DRAFT sale despite enum existing

### Data consistency issues
- Mock checkout on API failure shows fake invoice (frontend)
- Khata vs sale due divergence on collection path
- Automated cashbook OUT (returns) has no insufficient-cash guard

---

## 4. Purchase Journey

### Implemented happy path
1. `POST /purchases` → lines, totals; RECEIVED default → stock IN + movements
2. Payment → cashbook OUT (CASH); due → khata CREDIT (supplier)
3. `PUT /purchases/:id/status` → ORDERED to RECEIVED
4. `POST /purchases/:id/return` → stock OUT, refund, khata adjust

### Frontend journey
- `/dashboard/purchases` — full CRUD UI (real API)

### Missing workflow steps
| Step | Priority |
|------|----------|
| PO → GRN partial receive per line | Important |
| Purchase approval workflow | Optional |
| Landed cost / freight allocation | Optional |
| Weighted average cost (currently overwrites with latest) | Important |
| DELETE purchase route (permission seeded, no route) | Low |

### Edge cases not handled
- Payment on ORDERED (not cancelled) before goods received
- ORDERED → CANCELLED with no notification
- No `purchase.created` event

---

## 5. Inventory Journey

### Implemented happy path
1. Product CRUD, categories tree, brands, units
2. Stock movements on sale/purchase/return
3. `POST /products/:id/stock-adjustments` → IN/OUT/ADJUSTMENT/DAMAGE
4. `GET /products?lowStock=true`
5. Low stock event → worker → socket notification

### Frontend journey
- `/dashboard/inventory` — products + ledger tab (real API)

### Missing workflow steps
| Step | Priority |
|------|----------|
| Stock take / physical count | Critical |
| Inter-branch transfer | Important |
| Variants (size/color) | Important |
| Batch / expiry (grocery) | Important |
| Serial / IMEI (electronics) | Important |
| Reorder point → suggested PO | Important |
| Reservation for pending sales | Optional |
| Negative stock policy per shop | Important |

### Edge cases not handled
- No low-stock check after manual adjustment
- `referenceId` on movements often null
- Product delete without stock/history check

---

## 6. Khata Journey

### Implemented happy path
1. `POST /khata/accounts/ensure` → find or create account
2. Auto entries from sales (DEBIT) and purchases (CREDIT)
3. `POST /khata/accounts/:id/collection` → payment RECEIVED + CREDIT entry
4. `POST /khata/accounts/:id/repayment` → payment MADE + DEBIT entry
5. `POST /khata/accounts/:id/adjustments` → manual balance shift
6. `GET /khata/due-summary` → receivables/payables from khata only

### Frontend journey
- `/dashboard/ledger` — summary, customer khata, supplier khata (real API)
- `/dashboard/customers` — linked khata operations

### Missing workflow steps
| Step | Priority |
|------|----------|
| Unified payment path (collection always posts cashbook) | Critical |
| Credit limit enforcement | Critical |
| Aging buckets (30/60/90 days) | Important |
| Interest on overdue | Optional |
| Reminder automation | Critical |
| Printable khata statement | Critical |
| Invoice-level allocation (which sale being paid) | Important |

### Edge cases not handled
- **Two collection paths:** `/khata/.../collection` vs `/payments` khata — different cashbook behavior
- Due summary excludes sale/purchase `dueCents` not in khata
- Immutable entries — no formal reversal (only adjustment forward)
- `khata.entryAdded` event uses `payment.id` as `entryId` (misleading)

### Data consistency issues
- **High severity:** khata collection missing cashbook when CASH
- Sale credit without customer leaves orphan receivable

---

## 7. Expense Journey

### Implemented happy path
1. Expense categories CRUD
2. `POST /expenses` → record; CASH → cashbook OUT
3. Update amount → cashbook adjustment; delete → cashbook reversal
4. Recurring expense templates + `POST /expenses/recurring/process` (manual)

### Frontend journey
- `/dashboard/expenses` — daily expenses only (real API)
- Recurring expenses — API exists, **no UI**

### Missing workflow steps
| Step | Priority |
|------|----------|
| Scheduled cron for recurring expenses | Important |
| Expense approval | Optional |
| Link non-cash expense to MFS/bank | Important |
| Receipt photo attachment | Important |
| Budget vs actual by category | Optional |

### Edge cases not handled
- `processRecurringExpenses` doesn't emit `expense.created` per item
- Category delete without expense reassignment

---

## 8. Cashbook Journey

### Implemented happy path
1. Automated entries from sales, purchases, expenses, MFS, flexiload, payments (CASH only)
2. Manual `POST /cashbook/cash-in`, `/cash-out` (out checks balance)
3. `GET /cashbook/balance`, `/entries`
4. `GET /cashbook/closing-preview`, `POST /cashbook/closing` → daily closing record

### Frontend journey
- **No merchant UI page** — API + hooks only

### Missing workflow steps
| Step | Priority |
|------|----------|
| Cashbook UI (in/out, balance, history) | Critical |
| Daily closing wizard for cashier | Critical |
| Variance adjustment entry on close | Important |
| Multi-drawer / multi-register | Optional |
| Bank account separate from physical cash | Important |
| Z-report tied to closing | Critical |

### Edge cases not handled
- Khata collection/repayment **not** in cashbook
- Automated OUT can drive **negative** balance (manual OUT blocked)
- Backdated entries distort running balance order
- Closing variance recorded but not posted to cashbook

### Data consistency issues
- Physical cashbook vs MFS digital float not reconciled in one view

---

## 9. Mobile Banking (MFS) Journey

### Implemented happy path
1. MFS account CRUD (bKash, Nagad, Rocket, Upay)
2. `POST /mfs/transactions` → wallet balance rules by type
3. CASH_IN → cashbook IN (+ fees); CASH_OUT → cashbook OUT
4. Commission stored on transaction

### Frontend journey
- `/dashboard/mobile-services` — **wrong API paths**, mock fallback
- Real SDK: `lib/api/modules/mfs.api.ts` + `use-mfs-query.ts` **unused by UI**

### Missing workflow steps
| Step | Priority |
|------|----------|
| Wire UI to real `/mfs` API | Critical |
| Float reconciliation (wallet vs physical cash) | Critical |
| Commission income report | Critical |
| Link POS bKash payment to MFS account | Critical |
| Statement import / provider API sync | Important |
| Daily float alert | Important |
| SEND_MONEY / BILL_PAY cashbook impact | Important |

### Edge cases not handled
- Manual `balanceCents` edit bypasses transaction audit
- PENDING/FAILED single-step (no rollback workflow)

---

## 10. Flexiload Journey

### Implemented happy path
1. Flexiload account CRUD per operator
2. `POST /flexiload/recharge` → deduct SIM balance, cashbook IN, store commission

### Frontend journey
- Same as MFS — mock/wrong paths

### Missing workflow steps
| Step | Priority |
|------|----------|
| Wire UI to real `/flexiload` API | Critical |
| Failed recharge reversal | Important |
| Operator balance reconciliation | Critical |
| Margin report by operator | Critical |
| Retailer API integration | Future |

### Edge cases not handled
- Commission not posted to cashbook as income
- Postpaid vs prepaid same treatment

---

# Part 2 — Workflow Improvement Report

## P0 — Data integrity fixes (before any launch)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Supplier due-tracking double-count | Single source: khata OR purchase due, not sum |
| 2 | Khata collection missing cashbook | Post cashbook IN on CASH collection/repayment |
| 3 | Unify khata payment paths | One service method for all collection types |
| 4 | Sale due without customer | Block or force customer selection for credit sales |
| 5 | POS mock checkout fallback | Remove; show error + retry |
| 6 | POS returns not calling API | Wire `POST /sales/:id/return` |
| 7 | Frontend MFS/flexiload wrong API | Migrate to `mfs.api.ts` / `flexiload.api.ts` |

## P1 — Workflow completion

| # | Improvement |
|---|-------------|
| 8 | Cashbook UI + daily closing |
| 9 | Customer khata statement PDF |
| 10 | Credit limit on khata accounts |
| 11 | Cashier shift + Z-report |
| 12 | Split payments on sale create |
| 13 | Stock take module |
| 14 | Recurring expense cron worker |
| 15 | Settings page (shop, team, receipt) |

## P2 — Operational excellence

| # | Improvement |
|---|-------------|
| 16 | Due reminder automations |
| 17 | Sales-by-product report |
| 18 | MFS/flexiload reconciliation screens |
| 19 | Negative stock policy setting |
| 20 | Row-level locking on product stock |

---

# Part 3 — Complete Reporting Matrix

**Legend:** ✅ Implemented · ⚠️ Partial · ❌ Missing

## Sales Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| Daily sales | ✅ `/reports/daily-sales` | ✅ Reports | ✅ |
| Monthly sales | ✅ `/reports/monthly-sales` | ✅ Reports | ✅ |
| Dashboard revenue KPI | ✅ `/reports/dashboard` | ✅ Dashboard | ✅ |
| Sales by product | ❌ | ❌ | ❌ |
| Sales by category | ❌ | ❌ | ❌ |
| Sales by cashier | ❌ | ❌ | ❌ |
| Sales by payment method | ❌ | ❌ | ❌ |
| Hourly sales (restaurant) | ❌ | ❌ | ❌ |
| Returns / voids summary | ❌ | ❌ | ❌ |
| Average ticket size | ⚠️ dashboard KPI | ✅ | ⚠️ |
| Top customers by revenue | ❌ | ❌ | ❌ |
| Discount analysis | ⚠️ in daily/monthly | ❌ | ⚠️ |
| Z-report / register close | ❌ | ❌ | ❌ |

## Purchase Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| Purchase summary by period | ❌ | ❌ | ❌ |
| Purchase by supplier | ❌ | ❌ | ❌ |
| Purchase by product | ❌ | ❌ | ❌ |
| Open purchase orders | ❌ | ❌ | ❌ |
| GRN / receive history | ❌ | ❌ | ❌ |

## Inventory Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| Stock valuation | ✅ `/reports/inventory` | ✅ Reports | ✅ |
| Low stock list | ✅ inventory report | ✅ Reports | ✅ |
| Stock movement ledger | ✅ per-product API | ✅ Inventory tab | ✅ |
| Dead / slow movers | ❌ | ❌ | ❌ |
| Shrinkage / damage | ❌ | ❌ | ❌ |
| Stock take variance | ❌ | ❌ | ❌ |
| Reorder suggestions | ❌ | ❌ | ❌ |
| Expiry report | ❌ | ❌ | ❌ |

## Profit Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| P&L (gross/net) | ✅ `/reports/profit` | ✅ Reports | ✅ |
| Gross margin % | ✅ | ✅ | ✅ |
| Product-level margin | ❌ | ❌ | ❌ |
| Category margin | ❌ | ❌ | ❌ |

## Expense Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| Expense by category | ⚠️ dashboard distribution | ✅ Dashboard | ⚠️ |
| Expense trend | ❌ dedicated | ❌ | ❌ |
| Recurring expense schedule | ❌ | ❌ | ❌ |
| Budget vs actual | ❌ | ❌ | ❌ |

## Cash Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| Cashbook balance | ✅ `/cashbook/balance` | ❌ no UI | ⚠️ |
| Cashbook entries | ✅ `/cashbook/entries` | ❌ | ⚠️ |
| Daily closing history | ✅ `/cashbook/closings` | ❌ | ⚠️ |
| Cash vs sales reconciliation | ❌ | ❌ | ❌ |
| Petty cash | ❌ | ❌ | ❌ |

## Customer Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| Customer list | ✅ `/customers` | ✅ | ✅ |
| Customer khata statement | ❌ PDF | ❌ | ❌ |
| Customer aging | ❌ | ❌ | ❌ |
| Customer purchase history | ⚠️ via sales filter | ⚠️ | ⚠️ |

## Supplier Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| Supplier due tracking | ✅ `/suppliers/:id/due-tracking` | ✅ Ledger | ⚠️ double-count bug |
| Supplier ledger | ✅ | ✅ | ✅ |
| Supplier payment history | ✅ `/suppliers/:id/payments` | ⚠️ partial | ⚠️ |
| Supplier statement PDF | ❌ | ❌ | ❌ |

## Due Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| AR/AP summary | ✅ `/reports/dues` | ✅ Reports | ✅ |
| Due aging buckets | ❌ | ❌ | ❌ |
| Collection forecast | ❌ | ❌ | ❌ |
| Overdue list | ❌ | ❌ | ❌ |

## Mobile Banking Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| MFS balance by provider | ⚠️ dashboard balances | ❌ | ⚠️ |
| MFS transaction log | ✅ `/mfs/transactions` | ❌ mock UI | ⚠️ |
| Commission summary | ❌ | ❌ | ❌ |
| Float reconciliation | ❌ | ❌ | ❌ |
| CICO volume by day | ❌ | ❌ | ❌ |

## Flexiload Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| Recharge log | ✅ `/flexiload/recharges` | ❌ mock UI | ⚠️ |
| Margin by operator | ❌ | ❌ | ❌ |
| Failed recharge | ❌ | ❌ | ❌ |

## Tax Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| Tax collected (VAT) | ⚠️ in sales aggregates | ❌ | ⚠️ |
| VAT summary return format | ❌ | ❌ | ❌ |
| TIN invoice register | ❌ | ❌ | ❌ |
| Supplementary duty | ❌ | ❌ | ❌ |

## Employee Reports

| Report | Backend | Frontend | Status |
|--------|---------|----------|--------|
| Sales by employee | ❌ | ❌ | ❌ |
| Cashier shift report | ❌ | ❌ | ❌ |
| Attendance | ❌ | ❌ | ❌ |
| Payroll | ❌ | ❌ | ❌ |

### Reporting summary

| Category | Implemented | Missing | Coverage |
|----------|-------------|---------|----------|
| Sales | 4 | 9 | 31% |
| Purchase | 0 | 5 | 0% |
| Inventory | 3 | 5 | 38% |
| Profit | 2 | 2 | 50% |
| Expense | 1 | 3 | 25% |
| Cash | 3 | 2 | 60% (no UI) |
| Customer | 1 | 3 | 25% |
| Supplier | 2 | 2 | 50% |
| Due | 1 | 3 | 25% |
| MFS | 1 | 4 | 20% |
| Flexiload | 1 | 2 | 33% |
| Tax | 0 | 4 | 0% |
| Employee | 0 | 4 | 0% |
| **Total** | **19** | **46** | **29%** |

---

# Part 4 — RBAC System Review

## Current state

- **49 seeded permissions** in `prisma/seed.ts`
- **4 roles:** SuperAdmin, Owner, Manager, Staff
- **Owner/SuperAdmin:** wildcard `*` at login (no DB role_permission rows)
- **Manager:** all 49 permissions (seed only — not on `registerShopAndOwner`)
- **Staff:** `products.read`, `sales.read`, `sales.create` only
- **Middleware:** `authorize()` AND semantics across required permissions
- **Frontend:** sidebar filter only; `PermissionGuard` unused

## Gaps

| Gap | Severity |
|-----|----------|
| 5 route permissions missing from seed (`shop.*`, `customers.update/delete`) | High |
| New shops via register: Manager/Staff have **zero** permissions until manual seed | Critical |
| 3 seeded permissions unused (`sales.update/delete`, `purchases.delete`) | Low |
| No user/role management API | Critical |
| No platform super-admin (cross-tenant) | Critical |
| Dashboard loads for Staff but may 403 on `/reports/dashboard` | High |
| Customers/Telegram/MFS pages have no nav permission gates | Medium |

---

## Required Roles & Permissions Matrix

### Recommended roles (8)

| Role | Description |
|------|-------------|
| **Owner** | Full shop access, billing, team, settings |
| **Partner** | Same as Owner minus shop delete / billing |
| **Manager** | Operations: inventory, purchases, reports, void approval |
| **Accountant** | Read-all finance; write expenses, cashbook, khata; no POS |
| **Cashier** | POS checkout, customers read, limited returns |
| **Salesperson** | POS + customers + khata collection (no cost price) |
| **Inventory Manager** | Products, stock, purchases receive; no sales |
| **Employee** | Read-only dashboard assigned modules |

### Permission catalog (recommended 65 permissions)

**Format:** `{resource}.{action}`

#### Shop & team (new module)
| Permission | Owner | Partner | Manager | Accountant | Cashier | Salesperson | Inv Mgr | Employee |
|------------|:-----:|:-------:|:-------:|:----------:|:-------:|:-----------:|:-------:|:--------:|
| `shop.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `shop.update` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `shop.delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users.read` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users.invite` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users.update` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `roles.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `billing.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

#### Customers
| Permission | Owner | Partner | Manager | Accountant | Cashier | Salesperson | Inv Mgr | Employee |
|------------|:-----:|:-------:|:-------:|:----------:|:-------:|:-----------:|:-------:|:--------:|
| `customers.create` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `customers.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `customers.update` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `customers.delete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

#### Products / inventory
| Permission | Owner | Partner | Manager | Accountant | Cashier | Salesperson | Inv Mgr | Employee |
|------------|:-----:|:-------:|:-------:|:----------:|:-------:|:-----------:|:-------:|:--------:|
| `products.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `products.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `products.read.cost` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `products.update` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `products.delete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `stock.adjust` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

#### Sales / POS
| Permission | Owner | Partner | Manager | Accountant | Cashier | Salesperson | Inv Mgr | Employee |
|------------|:-----:|:-------:|:-------:|:----------:|:-------:|:-----------:|:-------:|:--------:|
| `sales.create` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `sales.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `sales.return` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `sales.void` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `sales.discount.override` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

#### Purchases
| Permission | Owner | Partner | Manager | Accountant | Cashier | Salesperson | Inv Mgr | Employee |
|------------|:-----:|:-------:|:-------:|:----------:|:-------:|:-----------:|:-------:|:--------:|
| `purchases.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `purchases.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `purchases.update` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `purchases.return` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

#### Khata / payments
| Permission | Owner | Partner | Manager | Accountant | Cashier | Salesperson | Inv Mgr | Employee |
|------------|:-----:|:-------:|:-------:|:----------:|:-------:|:-----------:|:-------:|:--------:|
| `khata.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `khata.write` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `khata.update` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `payments.create` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `payments.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `payments.refund` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

#### Finance
| Permission | Owner | Partner | Manager | Accountant | Cashier | Salesperson | Inv Mgr | Employee |
|------------|:-----:|:-------:|:-------:|:----------:|:-------:|:-----------:|:-------:|:--------:|
| `expenses.*` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `cashbook.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `cashbook.write` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `cashbook.close` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

#### MFS / Flexiload
| Permission | Owner | Partner | Manager | Accountant | Cashier | Salesperson | Inv Mgr | Employee |
|------------|:-----:|:-------:|:-------:|:----------:|:-------:|:-----------:|:-------:|:--------:|
| `mfs.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `mfs.write` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `flexiload.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `flexiload.write` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |

#### Reports & system
| Permission | Owner | Partner | Manager | Accountant | Cashier | Salesperson | Inv Mgr | Employee |
|------------|:-----:|:-------:|:-------:|:----------:|:-------:|:-----------:|:-------:|:--------:|
| `reports.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `reports.export` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `telegram.read` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `telegram.write` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `audit.read` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `uploads.write` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

### Missing access control rules (must implement)

1. **Field-level:** Hide `costPriceCents` from Cashier, Salesperson, Employee
2. **Route guards:** `PermissionGuard` on every dashboard page
3. **API:** Discount above X% requires `sales.discount.override`
4. **Void/return:** Requires `sales.void` or `sales.return` + manager PIN optional
5. **Credit sale:** Block if over `credit_limit_cents` without override
6. **Platform admin:** Separate auth realm for cross-tenant ops
7. **Plan limits:** Enforce max users/products per `ShopPlan`
8. **Session:** Cashier role cannot access `/reports`, `/settings`, `/cashbook`

---

# Part 5 — Board of Advisors Review

## SaaS Founder

**Missing for commercial launch:**
- Subscription billing (SSLCommerz/bKash merchant)
- Plan enforcement (`FREE`/`STARTER`/`PRO`/`ENTERPRISE` unused)
- Trial lifecycle (14-day → suspend)
- Platform admin (tenant list, MRR, churn)
- Onboarding funnel metrics
- User invitation flow
- Usage metering

**Score contribution:** 15/100 on SaaS dimension

## ERP Consultant

**Missing for ERP credibility:**
- General ledger / chart of accounts
- AP/AR aging
- Bank reconciliation
- Multi-warehouse
- Purchase accruals
- Period close
- Inter-company (future)

**Acceptable deferral** for SME POS v1, but report gap is severe.

## POS Consultant

**Missing for POS launch:**
- Receipt printer (ESC/POS)
- Barcode scanner workflow
- Cash drawer kick
- Shift management
- Hold/recall sale
- Split tender
- Offline receipt UX
- Void with reason code
- Hardware certification

**Critical:** Mock checkout and local-only returns are launch blockers.

## Retail Operations Expert

**Missing for daily shop ops:**
- Stock take
- Z-report at close
- Due reminders (WhatsApp)
- Customer statement
- Promotions
- Weighed items (grocery)
- Expiry management

## Product Manager

**Missing for PMF:**
- Business-type onboarding (grocery vs agent vs retail)
- Settings page (404 today)
- Mobile nav parity
- Notification product surface
- Customer reminder automations
- Sales-by-product report (#1 owner ask)

## Principal Engineer

**Missing for production:**
- Zero automated tests
- Dual API clients (frontend)
- Unguarded `/admin`
- Data consistency bugs (khata/cashbook/supplier due)
- No error telemetry
- JWT in non-HttpOnly cookies
- No CI typecheck gate

---

# Part 6 — Master Gap Register

## Critical (P0) — 22 items

1. Supplier due double-count bug  
2. Khata collection cashbook gap  
3. Sale credit without customer  
4. POS mock checkout on failure  
5. POS returns not persisted  
6. MFS/flexiload UI not wired  
7. Unguarded admin panel  
8. No subscription billing  
9. No team invite / role assignment API  
10. Settings page missing (404)  
11. Cashbook UI missing  
12. Customer khata statement  
13. Credit limit enforcement  
14. Remove production mock fallbacks  
15. JWT security (HttpOnly cookies)  
16. PermissionGuard on routes  
17. Register flow: Manager/Staff get zero permissions  
18. Seed missing `shop.*`, `customers.update/delete`  
19. Offline POS broken UX  
20. Z-report / shift close  
21. Sales by product report  
22. Due reminder automation  

## Important (P1) — 24 items

Stock take, split payments, barcode POS, receipt print, purchase reports, MFS reconciliation, flexiload margin report, recurring expense UI+cron, customer/supplier aging, WhatsApp reminders, weighted items, variants, multi-branch, PO partial receive, weighted avg cost, bank reconciliation view, notification inbox, payments center, audit viewer, global search, mobile nav parity, platform admin API, plan limits, PNG PWA icons  

## Optional (P2) — 15 items

Loyalty, serial/IMEI, restaurant tables, promotions engine, quotations, repair tickets, cheque tracking, delivery challan, AI forecasting, dark mode persist, product images, custom report builder, VAT return format, payroll, e-commerce sync  

## Future (P3) — 12 items

Full GL, manufacturing BOM, CRM pipeline, franchise multi-company, live bKash API, embedded lending, government e-invoice, HR module, IoT scales, regional expansion, blockchain audit (marketing), open banking  

---

# Part 7 — Path to #1 in Bangladesh

## 90-day launch wedge

**Target:** Neighborhood retail + khata + agent shops (not all 12 verticals)

### Days 1–30: Trust
- Fix all P0 data integrity bugs  
- Remove mock fallbacks  
- Cashbook UI + daily close  
- Wire MFS/flexiload UI  
- Settings + team invite  

### Days 31–60: Win vs KhataBook
- WhatsApp due reminders  
- Customer statement PDF  
- Sales by product report  
- Credit limits  
- POS receipt print + barcode  

### Days 61–90: Monetize
- Subscription billing (bKash/SSLCommerz)  
- Plan limits  
- Onboarding by business type  
- Telegram daily summary (wire existing prefs)  
- Beta with 50 agent shops + 50 grocery/retail  

## Competitive moat features (invest here)

1. MFS + flexiload float reconciliation (no competitor)  
2. Khata + POS + cashbook unified  
3. Bengali Telegram NLP entry  
4. WhatsApp payment reminders  
5. Offline POS with reliable sync  

## Launch readiness gates

| Gate | Target | Current |
|------|--------|---------|
| P0 bugs open | 0 | 22 |
| Test coverage (critical paths) | >80% | 0% |
| Mock fallbacks in prod | 0 | 5+ modules |
| Report coverage (owner essentials) | >70% | 29% |
| RBAC roles implemented | 8 | 4 (partial) |
| Merchant UI for all finance modules | 100% | ~60% |
| Security audit pass | Yes | No |

---

# Appendix — File References

| Area | Path |
|------|------|
| Workflow services | `BizOs-Backend/src/services/*.service.ts` |
| RBAC seed | `BizOs-Backend/src/prisma/seed.ts` |
| Reports | `BizOs-Backend/src/services/reports.service.ts` |
| Frontend permissions | `BizOs-Frontend/src/lib/auth/permissions.ts` |
| POS checkout | `BizOs-Frontend/src/features/pos/api/pos-api.ts` |
| Legacy API client | `BizOs-Frontend/src/lib/api-client.ts` |

---

*End of audit. Generated from codebase analysis on 2026-06-15.*
