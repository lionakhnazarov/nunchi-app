# Token Dashboard

A minimal token dashboard for displaying ERC20 token balances and transferring tokens on a local Ganache network.

## Setup

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# Backend dependencies
cd backend && npm install && cd ..

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment

Create a `.env` file in the `backend` directory:

```env
PRIVATE_KEY=your_ganache_private_key_here
RPC_URL=http://127.0.0.1:7545
CONTRACT_ADDRESS=
PORT=3001
```

### 3. Deploy Contract

1. Start Ganache:
```bash
npm run ganache
```

2. Copy a private key from Ganache output and add it to `backend/.env` as `PRIVATE_KEY`

3. Deploy the contract:
```bash
npm run deploy:local
```

4. Copy the contract address from output and add it to `backend/.env` as `CONTRACT_ADDRESS`

## Running

### Start Ganache (Terminal 1)
```bash
npm run ganache
```

### Start Backend (Terminal 2)
```bash
npm run backend
```

### Start Frontend (Terminal 3)
```bash
npm run frontend
```

Open `http://localhost:3000` in your browser.

## Usage

1. **Connect MetaMask**: Click "Connect MetaMask Wallet" - the app will automatically add Ganache network (Chain ID: 1337)
2. **Request Tokens**: Enter an address and click "Request Tokens (Faucet)"
3. **Check Balance**: Enter an address to view token balance
4. **Transfer Tokens**: Connect wallet, enter recipient and amount, then click "Transfer"

## API Endpoints

- `GET /balance/:address` - Get token balance for an address
- `POST /faucet` - Mint tokens to an address (body: `{ address }`)
- `GET /events/faucet` - Get recent faucet events
