import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:7545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!CONTRACT_ADDRESS) {
  console.error("ERROR: CONTRACT_ADDRESS not set in .env file");
  process.exit(1);
}

if (!PRIVATE_KEY) {
  console.error("ERROR: PRIVATE_KEY not set in .env file");
  process.exit(1);
}

const TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function faucet(address to, uint256 amount) external",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "event FaucetUsed(address indexed to, uint256 amount, address indexed caller)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, TOKEN_ABI, signer);

app.get("/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid address format" });
    }

    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals();
    const symbol = await contract.symbol();
    const name = await contract.name();

    const formattedBalance = ethers.formatUnits(balance, decimals);

    res.json({
      address,
      balance: formattedBalance,
      rawBalance: balance.toString(),
      symbol,
      name,
      decimals: decimals.toString(),
      contractAddress: CONTRACT_ADDRESS
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).json({ 
      error: "Failed to fetch balance",
      message: error.message 
    });
  }
});

app.post("/faucet", async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid address format" });
    }

    const faucetAmount = "100";
    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(faucetAmount, decimals);

    const tx = await contract.faucet(address, amountWei);

    const receipt = await tx.wait();

    res.json({
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      address,
      amount: faucetAmount
    });
  } catch (error) {
    console.error("Error calling faucet:", error);
    res.status(500).json({ 
      error: "Failed to call faucet",
      message: error.message 
    });
  }
});

app.get("/events/faucet", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    let fromBlock = req.query.fromBlock ? parseInt(req.query.fromBlock) : null;
    
    const currentBlock = await provider.getBlockNumber();
    const toBlock = req.query.toBlock ? parseInt(req.query.toBlock) : currentBlock;
    
    if (!fromBlock) {
      fromBlock = Math.max(0, currentBlock - 1000);
    }
    
    let events = [];
    try {
      const filter = contract.filters.FaucetUsed();
      events = await contract.queryFilter(filter, fromBlock, toBlock);
    } catch (err) {
      console.error("Error querying FaucetUsed events:", err);
    }
    
    let transferEvents = [];
    try {
      const transferFilter = contract.filters.Transfer(ethers.ZeroAddress);
      transferEvents = await contract.queryFilter(transferFilter, fromBlock, toBlock);
    } catch (err) {
      console.error("Error querying Transfer events:", err);
    }
    
    const allEvents = [];
    
    for (const event of events) {
      if (event.args) {
        try {
          const decimals = await contract.decimals();
          const symbol = await contract.symbol();
          allEvents.push({
            type: "faucet",
            to: event.args.to,
            amount: ethers.formatUnits(event.args.amount, decimals),
            rawAmount: event.args.amount.toString(),
            caller: event.args.caller,
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            timestamp: null,
            symbol
          });
        } catch (err) {
          console.error("Error processing FaucetUsed event:", err);
        }
      }
    }
    
    for (const event of transferEvents) {
      if (event.args) {
        const fromAddress = event.args.from || event.args[0];
        const toAddress = event.args.to || event.args[1];
        const value = event.args.value || event.args[2];
        
        const zeroAddress = ethers.ZeroAddress;
        if (fromAddress && fromAddress.toLowerCase() === zeroAddress.toLowerCase()) {
          try {
            const decimals = await contract.decimals();
            const symbol = await contract.symbol();
            const isDuplicate = allEvents.some(e => 
              e.transactionHash === event.transactionHash && 
              e.to.toLowerCase() === toAddress.toLowerCase()
            );
            
            if (!isDuplicate) {
              allEvents.push({
                type: "mint",
                to: toAddress,
                amount: ethers.formatUnits(value, decimals),
                rawAmount: value.toString(),
                caller: null,
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber,
                timestamp: null,
                symbol
              });
            }
          } catch (err) {
            console.error("Error processing Transfer event:", err);
          }
        }
      }
    }
    
    allEvents.sort((a, b) => b.blockNumber - a.blockNumber);
    
    const limitedEvents = allEvents.slice(0, limit);
    
    const eventsWithTimestamps = await Promise.all(
      limitedEvents.map(async (event) => {
        try {
          const block = await provider.getBlock(event.blockNumber);
          return {
            ...event,
            timestamp: block ? block.timestamp : null
          };
        } catch (err) {
          return event;
        }
      })
    );
    
    res.json({
      events: eventsWithTimestamps,
      total: allEvents.length,
      fromBlock,
      toBlock,
      limit
    });
  } catch (error) {
    console.error("Error fetching faucet events:", error);
    res.status(500).json({ 
      error: "Failed to fetch faucet events",
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Contract address: ${CONTRACT_ADDRESS}`);
  console.log(`Network: ${RPC_URL}`);
});

