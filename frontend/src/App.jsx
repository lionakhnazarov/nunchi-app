import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import axios from 'axios'

const API_BASE_URL = 'http://localhost:3001'

function App() {
  const [address, setAddress] = useState('')
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [recentEvents, setRecentEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)

  useEffect(() => {
    fetchRecentEvents()
    const interval = setInterval(() => {
      fetchRecentEvents()
    }, 5000)
    
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (walletAddress) {
      setAddress(walletAddress)
      fetchBalance(walletAddress)
    }
  }, [walletAddress])

  const fetchRecentEvents = async () => {
    setEventsLoading(true)
    try {
      const response = await axios.get(`${API_BASE_URL}/events/faucet?limit=10`)
      setRecentEvents(response.data.events || [])
      if (response.data.total === 0) {
        console.log('No events found. Query range:', {
          fromBlock: response.data.fromBlock,
          toBlock: response.data.toBlock
        })
      }
    } catch (err) {
      console.error('Failed to fetch events:', err)
      setRecentEvents([])
    } finally {
      setEventsLoading(false)
    }
  }

  const formatAddress = (addr) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const fetchBalance = async (addr) => {
    if (!addr) return
    
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`${API_BASE_URL}/balance/${addr}`)
      setBalance(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch balance')
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestTokens = async () => {
    if (!address) {
      setError('Please enter an address')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await axios.post(`${API_BASE_URL}/faucet`, { address })
    
      setTimeout(() => {
        fetchBalance(address)
        fetchRecentEvents()
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request tokens')
    } finally {
      setLoading(false)
    }
  }

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        
        const network = await provider.getNetwork()
        const expectedChainId = 1337n
        
        if (network.chainId !== expectedChainId) {
          setError('Please add the Ganache Local network to MetaMask (Chain ID: 1337)')
          setConnected(false)
        } else {
          const accounts = await provider.send("eth_requestAccounts", [])
          setWalletAddress(accounts[0])
          setConnected(true)
        }
      } catch (err) {
        setError('Failed to connect wallet: ' + (err.message || 'Unknown error'))
      }
    } else {
      setError('MetaMask is not installed')
    }
  }

  const handleTransfer = async () => {

    const amount = parseFloat(transferAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount greater than 0')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const balanceResponse = await axios.get(`${API_BASE_URL}/balance/${walletAddress}`)
      const userBalance = parseFloat(balanceResponse.data.balance)
      
      if (userBalance < amount) {
        setError(`Insufficient balance. You have ${userBalance.toLocaleString()} ${balanceResponse.data.symbol}, but trying to transfer ${amount.toLocaleString()}`)
        setLoading(false)
        return
      }

      const contractAddress = balanceResponse.data.contractAddress

      const contractABI = [
        "function transfer(address to, uint256 amount) external returns (bool)",
        "function balanceOf(address owner) view returns (uint256)"
      ]
      
      const contract = new ethers.Contract(contractAddress, contractABI, signer)
      const decimals = parseInt(balanceResponse.data.decimals)
      const amountWei = ethers.parseUnits(transferAmount, decimals)
      
      const code = await provider.getCode(contractAddress)
      if (code === '0x') {
        setError('Contract not found at this address. Please verify the contract is deployed.')
        setLoading(false)
        return
      }
      
      const tx = await contract.transfer(transferTo, amountWei, {
        gasLimit: 100000
      })
      
      await tx.wait()
      
      fetchBalance(walletAddress)
      setTransferTo('')
      setTransferAmount('')
    } catch (err) {
      setError('Transfer failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Token Dashboard</h1>
          {balance && (
            <p className="text-gray-600 mb-6">
              {balance.name} ({balance.symbol}) on Ganache Local
            </p>
          )}

          {/* Wallet Connection */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            {!connected ? (
              <button
                onClick={connectWallet}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Connect MetaMask Wallet
              </button>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-2">Connected:</p>
                <p className="text-sm font-mono text-gray-800 break-all">{walletAddress}</p>
              </div>
            )}
          </div>

          {/* Address Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Balance Display */}
          <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Balance:</span>
              <button
                onClick={() => fetchBalance(address)}
                disabled={loading || !address}
                className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : balance ? (
              <p className="text-2xl font-bold text-indigo-700">
                {parseFloat(balance.balance).toLocaleString()} {balance.symbol}
              </p>
            ) : (
              <p className="text-gray-500">Enter an address to check balance</p>
            )}
          </div>

          {/* Faucet Button */}
          <button
            onClick={handleRequestTokens}
            disabled={loading || !address}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition mb-6"
          >
            {loading ? 'Processing...' : 'Request Tokens (Faucet)'}
          </button>

          {/* Transfer Section */}
          {connected && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Transfer Tokens</h2>
              {balance && parseFloat(balance.balance) === 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ You have no tokens. Please use the "Request Tokens (Faucet)" button above to get some tokens first.
                  </p>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleTransfer}
                disabled={loading || !transferTo || !transferAmount}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                {loading ? 'Processing...' : 'Transfer'}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Faucet Events</h2>
            
            {eventsLoading && recentEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Loading events...</p>
            ) : recentEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No faucet events yet. Request tokens to see events here!</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentEvents.map((event, index) => (
                  <div
                    key={`${event.transactionHash}-${index}`}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">{formatAddress(event.to)}</span>
                          {' '}received{' '}
                          <span className="font-semibold text-green-700">
                            {parseFloat(event.amount).toLocaleString()} {event.symbol}
                          </span>
                        </p>
                        {event.caller && (
                          <p className="text-xs text-gray-500 mt-1">
                            Called by: {formatAddress(event.caller)}
                          </p>
                        )}
                      </div>
                      <a
                        href="#"
                        className="text-xs text-gray-400 cursor-default ml-2"
                        title="Local network - no explorer"
                        onClick={(e) => e.preventDefault()}
                      >
                      </a>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 font-mono">
                      Block: {event.blockNumber} | TX: {formatAddress(event.transactionHash)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

