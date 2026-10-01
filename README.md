# Pharma Supply Chain Verification

Tracks medicine batches on the blockchain from the manufacturer all the way to the pharmacy. Each batch gets a QR code, and anyone can scan it to see where the medicine came from and whether it's genuine.

Built with Next.js, Express, MongoDB and Solidity, deployed on the Sepolia testnet.

## What it does

There are three parts to the app:

- **Supply chain portal** – manufacturers register batches, and batches get passed down the chain (distributor → wholesaler → pharmacy). The receiver has to confirm each transfer before ownership changes.
- **Verification page** – public page where customers scan the QR or type in the batch ID. Shows the medicine details, the full transfer history, and flags it if the batch is unregistered, expired, or the transfer order looks wrong.
- **Admin panel** – for adding participants, assigning roles, disabling accounts, and keeping an eye on batches and transfers (including rejected ones).

Batch registrations and transfers are stored on-chain. MongoDB holds user accounts, participant info and the tx hashes, so the dashboard doesn't have to hit the chain for everything.

## Folder layout

```
contracts/   solidity contracts + hardhat scripts and tests
backend/     express api, mongoose models, ethers.js services
frontend/    next.js app (all three portals live here)
docs/        extra notes on the api and contracts
```

## Running it locally

You'll need Node 18+, MongoDB (or Docker), MetaMask, and a Sepolia RPC URL from Alchemy/Infura with some test ETH.

**Contracts**

```bash
cd contracts
npm install
cp .env.example .env    # add RPC url + deployer key
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat run scripts/seedRoles.js --network sepolia
```

Deployed addresses end up in `contracts/deployments/`. Copy the ABIs into `backend/src/abi/` and put the addresses in the backend and frontend env files.

If you don't want to use Sepolia while developing, `npx hardhat node` in one terminal and deploy with `--network localhost` instead.

**Database**

```bash
docker-compose up -d mongo
```

**Backend**

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Runs on port 5000.

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Env variables

Check the `.env.example` file in each folder. The main ones:

- `contracts/.env` – `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`
- `backend/.env` – `MONGO_URI`, `JWT_SECRET`, `RPC_URL`, `ADMIN_PRIVATE_KEY`, and the three contract addresses
- `frontend/.env.local` – `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CHAIN_ID`, contract addresses

Don't commit any of these.

## Roles

- Manufacturer – registers batches, can transfer
- Distributor / Wholesaler – receive and transfer
- Pharmacy – receives only (end of the chain)
- Admin – manages participants, no batch actions

Customers don't need to log in to verify anything.

## How a batch moves

1. Admin adds the participants and their wallet addresses.
2. Manufacturer registers a batch (name, batch ID, mfg date, expiry, quantity) and a QR is generated.
3. Whoever holds the batch sends a transfer request to the next participant.
4. The receiver accepts it, and ownership updates on-chain.
5. Repeat until it reaches the pharmacy.

## API

Main routes, more detail in `docs/api.md`:

```
POST   /api/auth/login
GET    /api/batches
POST   /api/batches
GET    /api/batches/:batchId
POST   /api/transfers
GET    /api/transfers/pending
PATCH  /api/transfers/:id/confirm
PATCH  /api/transfers/:id/reject
GET    /api/verify/:batchId          (public)
GET    /api/participants             (admin)
POST   /api/participants             (admin)
PATCH  /api/participants/:id/status  (admin)
GET    /api/admin/stats              (admin)
```

## Tests

```bash
cd contracts && npx hardhat test
cd backend && npm test
```

