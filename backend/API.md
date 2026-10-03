# Backend API

Base URL: `http://localhost:5000/api`

Every response looks like:

```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": { "code": "NotCurrentHolder", "message": "You are not the current holder of this batch." } }
```

Logged-in routes need the header `Authorization: Bearer <token>` (token from `/auth/login`).
Lists accept `?page=1&limit=20` and return `{ items, page, limit, total, pages }`.

---

## How a blockchain action works (frontend)

Participants sign their own transactions in MetaMask. Every action is 3 calls:

```js
// 1. ask the backend to validate it and build the transaction
const { data } = await api.post("/transfers/prepare", { batchId, to });

// 2. user signs it in MetaMask (ethers v6 BrowserProvider)
const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
const tx = await signer.sendTransaction({ to: data.data.tx.to, data: data.data.tx.data });

// 3. send the hash back – backend waits for it, updates MongoDB, returns the result
const result = await api.post("/transactions", { txHash: tx.hash });
```

Before step 2, check that the MetaMask account equals `user.participant.walletAddress`
(from `/auth/me`), otherwise step 3 returns `WalletMismatch`.

---

## Auth

| Method | Path | Who | Body / notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | logged in | current user + participant (role, walletAddress) |
| POST | `/auth/change-password` | logged in | `{ currentPassword, newPassword }` |

## Batches

| Method | Path | Who | Body / notes |
|---|---|---|---|
| POST | `/batches/prepare` | Manufacturer | `{ batchId, medicineName, description?, manufacturingDate: "YYYY-MM-DD", expiryDate: "YYYY-MM-DD", quantity }` → `{ tx, dataHash }` |
| GET | `/batches` | logged in | `?scope=holding\|manufactured&search=` (admins always get all) |
| GET | `/batches/:batchId` | logged in | batch, `status`, on-chain `history`, `transfers`, `pendingTransfer`, `isHolder`, `qrCode` (data URL), `verifyUrl` |
| GET | `/batches/:batchId/qr` | logged in | PNG download; `?format=dataurl` for JSON |

## Transfers

| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/transfers` | logged in | `?direction=incoming\|outgoing\|all&status=Pending&batchId=` |
| GET | `/transfers/:transferId` | parties / admin | |
| POST | `/transfers/prepare` | Manufacturer, Distributor, Wholesaler | `{ batchId, to: walletAddress }` → `{ tx }` |
| POST | `/transfers/:transferId/confirm/prepare` | receiver | → `{ tx }` |
| POST | `/transfers/:transferId/reject/prepare` | receiver | → `{ tx }` |
| POST | `/transfers/:transferId/cancel/prepare` | sender | → `{ tx }` |

## Transactions

| Method | Path | Who | Body / notes |
|---|---|---|---|
| POST | `/transactions` | logged in | `{ txHash }` → `{ transaction, batch, transfer }` after it is mined |

## Customer verification

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/verify/:batchId` | **public** | `status`: `VERIFIED` / `UNREGISTERED` / `EXPIRED` / `INCONSISTENT`, `message`, `batch`, `currentHolder`, `history[]` (names + tx hashes), `registration`, `daysToExpiry` |

## Participants

| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/participants/directory` | logged in | active participants (for choosing a transfer receiver), `?role=` |
| GET | `/participants` | admin | `?role=&active=&search=` |
| POST | `/participants` | admin | `{ name, walletAddress, role, email, password, location?, contactPhone? }` – registers on-chain + creates the login |
| GET | `/participants/:id` | admin | |
| PUT | `/participants/:id` | admin | `{ name?, role?, email?, location?, contactPhone? }` |
| PATCH | `/participants/:id/status` | admin | `{ active: true\|false }` |
| POST | `/participants/:id/sync` | admin | re-register on-chain from MongoDB (after a local chain restart) |

## Admin dashboard

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/stats` | totals: batches, participants (by role), transfers (by status), verifications, verified medicines, invalid attempts, chain + sync status |
| GET | `/admin/batches` | `?search=` |
| GET | `/admin/transfers` | `?status=Rejected` etc. |
| GET | `/admin/transactions` | `?status=success\|failed\|rejected&action=` – `rejected` = invalid attempts blocked before signing |
| GET | `/admin/verifications` | `?status=` |
| GET | `/admin/sync` | chain head vs last synced block |

## Other

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | API, database and blockchain status |

## Roles in `user`

- `user.role` = `"admin"` or `"participant"`
- `user.participant.role` = `"Manufacturer" | "Distributor" | "Wholesaler" | "Pharmacy"`