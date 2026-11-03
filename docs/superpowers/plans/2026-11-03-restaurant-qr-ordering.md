# Restaurant QR Ordering Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Turn the existing burger tasting game into a functional, local-only restaurant QR ordering demonstration while retaining 3D tasting.

**Architecture:** Keep `PlayScreen` in `src/App.tsx` as the 3D feature; replace only its outer navigation with a menu/order flow. Put pure price, table, cart and order state in `src/core/`; static catalog in `src/data/`; screens in focused `src/ui/` files. Use localStorage only for cart and demo orders.

**Tech Stack:** React 19, TypeScript strict, Vite 7, Vitest, Playwright, lucide-react; no backend or payment SDK.

**Spec:** [Restaurant QR Ordering Design](../specs/2026-11-03-restaurant-qr-ordering-design.md)

## Global Constraints

- Work on `ybh_add`; do not change or push `main`.
- Money is integer cents in all business logic; format to ¥ only at presentation.
- The only tasting food is existing `classic-burger`; catalog items without 3D stay orderable.
- Demo orders are explicitly local-only, never claim restaurant receipt or payment.
- No actual payment, inventory, kitchen, accounts, or server.
- Preserve existing audio/model stage mechanics and keep the current 3D browser regressions green.

---

### Task 1: Pure ordering domain and catalog

**Files:** Create `src/data/menu.ts`, `src/core/table.ts`, `src/core/cart.ts`, `src/core/orders.ts`; create corresponding `*.test.ts`.

**Interfaces:** `menuItems: readonly MenuItem[]`, `menuCategories`, `menuItemById(id)`; `parseTable(search): string | null`; `addLine(lines,item,choices,quantity,note): CartLine[]`, `setLineQuantity(lines,id,quantity)`, `cartTotal(lines)`, `formatPrice(cents)`, `readCart(storage)`, `saveCart(storage,lines)`; `createDemoOrder(table,lines,now?)`, `readOrder(storage)`, `saveOrder(storage,order)`. Choose stable option IDs, normalize note and option order for line identity, cap quantity 1..99, reject invalid/stale local storage, and calculate totals from trusted catalog on restore. Use menu prices in cents and the burger's existing cover; add at least two non-3D menu items with meaningful visual covers rather than nonexistent URLs.

- [x] **Step 1: Add red tests for table parsing, money/merge, malformed storage and order snapshots.** Test `parseTable('?table=a01') === 'A01'`, invalid table `null`, option-specific cart lines, integer cent totals, malformed JSON -> empty, order ID and status.
- [x] **Step 2: Run `pnpm test` and confirm the new tests fail before implementation.**
- [x] **Step 3: Implement the typed pure functions with no React/DOM imports.** Ensure optional storage errors do not erase an active cart on failed submit.
- [x] **Step 4: Run focused tests and `pnpm typecheck`; commit domain files.**

### Task 2: Menu and item-detail interface

**Files:** Create `src/ui/MenuHome.tsx`, `src/ui/MenuItemDetail.tsx`; modify `src/style.css`; create any needed actual cover assets under `public/foods/`.

**Interfaces:** `MenuHome({table, items, onOpen, onCart, cartCount, total, onDemoTable})`; `MenuItemDetail({item,onClose,onTaste,onAdd})` with `onAdd(choices,quantity,note)`. Parent owns category and item selection or menu keeps category state across detail mounting. Render only actual menu assets. Show sold-out state and make item detail functional without GLB.

- [x] **Step 1: Add a component/browser test that finds menu categories, price, table hint, sold-out item and accessible detail actions.** Run to confirm it fails against the current food-picker home.
- [x] **Step 2: Implement menu, detail and responsive styling within existing restaurant visual vocabulary.** Use lucide icons, compact price/info hierarchy, 44px touch targets, natural mobile menu flow and a bottom cart summary.
- [x] **Step 3: Run focused tests, typecheck and build; commit menu UI.**

### Task 3: Cart, checkout and result

**Files:** Create `src/ui/CartSheet.tsx`, `src/ui/OrderReview.tsx`, `src/ui/OrderResult.tsx`; modify `src/App.tsx`, `src/style.css`.

**Interfaces:** `CartSheet({lines,onClose,onQuantity,onReview})`; `OrderReview({table,lines,onBack,onSubmit,onDemoTable,error})`; `OrderResult({order,onMenu})`. App reads URL table, owns `{screen,item,cart,order}`, persists cart on updates, and only clears after order persistence succeeds. Enter tasting from detail and return there with choices and quantity preserved. Provide clear paths out of cart, checkout, and result.

- [x] **Step 1: Add browser red tests for `/?table=A01` -> item -> options/quantity -> cart -> review -> submit -> result and refresh.** Add missing-table path (demo table selection), local storage failure, and tasting-return coverage.
- [x] **Step 2: Implement cart/order screens and wire App transitions, reusing existing `PlayScreen` without rewriting scene code.** Keep cart state while tasting, quote totals in integer cents, avoid asserting a real order is received by restaurant.
- [x] **Step 3: Run focused browser tests and the unit suite; commit integrated app.**

### Task 4: Regression and publication

**Files:** Modify `README.md`, `package.json` description, existing `tests/*.spec.ts` only where their old picker entry needs adapting (preserve original assertions about 3D behavior).

- [x] **Step 1: Update docs to explain `/?table=A01`, demo-only orders, sample menu, and the 3D tasting path.**
- [x] **Step 2: Run `pnpm test`, `pnpm build`, `pnpm test:browser`, `git diff --check`.** Investigate any failures; test desktop and mobile first viewport visually when tooling allows.
- [x] **Step 3: Check clean staged scope, commit, and push only `ybh_add`; verify remote SHA and leave `main` unchanged.** Implementation commit `2a50546` verified on remote `ybh_add`; `main` remains `6c7203248c39992fefdc564297e3d6b8980b9ab5`.

## Execution record

Implemented on `ybh_add` with separate domain/UI agents and integration in the current worktree. Styling lives in scoped `src/ui/ordering.css` and `checkout.css` rather than changing legacy scene styles. Domain and UI are included in one reviewed implementation commit rather than separate task commits.

Verification: 123 unit tests pass; TypeScript and production build pass. Full browser run passed 14 of 15 tests; the milestone-audio case was interrupted while App/MenuHome edits triggered Vite HMR. Without edits, its focused rerun passed along with ordering (5/5), and final menu/navigation/persistence verification passed 5/5 after storage fixes. All 15 browser cases passed across these runs. Browser assertions cover 320/390/1440 widths, no initial model downloads, table/cart/receipt refresh, missing table, sold-out menu, storage failure, preserved tasting draft, model stages, gestures and audio. Screenshot artifacts were generated; image inspection was unavailable for this model, so no visual review is claimed.

Review fixes: receipts validate historical snapshots without catalog repricing; order creation atomically saves receipt and empty cart in one localStorage envelope; category and menu scroll survive navigation. Existing Vite Three.js bundle-size warning remains.
