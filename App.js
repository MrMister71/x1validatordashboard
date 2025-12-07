import React, { useMemo, useState } from 'react';
import {
  ConnectionProvider,
  WalletProvider
} from '@solana/wallet-adapter-react';
import {
  WalletAdapterNetwork
} from '@solana/wallet-adapter-base';
import {
  WalletModalProvider,
  WalletMultiButton
} from '@solana/wallet-adapter-react-ui';

import '@solana/wallet-adapter-react-ui/styles.css';
import './App.css';
import StakeAccountsManagement from './StakeAccountsManagement'; // import the new component

function App() {
  // -----------------------------
  // SECTION A: Wallet Adapter Setup
  // -----------------------------
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = 'https://rpc.mainnet.x1.xyz';

  const wallets = useMemo(() => [], []);

  // -----------------------------
  // SECTION B: Validator Lookup State
  // -----------------------------
  const [validators, setValidators] = useState([]);
  const [validatorData, setValidatorData] = useState([]);

  // -----------------------------
  // SECTION C: Functions
  // -----------------------------
  const addValidator = async (voteAddress) => {
    if (voteAddress && !validators.includes(voteAddress)) {
      setValidators([...validators, voteAddress]);
      await fetchValidatorData(voteAddress);
    }
  };

  const fetchValidatorData = async (voteAddress) => {
    try {
      const response = await fetch("https://rpc.mainnet.x1.xyz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getVoteAccounts"
        })
      });

      const data = await response.json();
      const allValidators = [...data.result.current, ...data.result.delinquent];
      const validator = allValidators.find(v => v.votePubkey === voteAddress);

      const newEntry = {
        voteAddress,
        commission: validator ? validator.commission + "%" : "N/A",
        stake: validator ? (validator.activatedStake / 1e9).toFixed(2) + " X1" : "N/A",
        status: validator
          ? (data.result.current.includes(validator) ? "Active" : "Delinquent")
          : "Not Found"
      };

      setValidatorData(prev => [...prev, newEntry]);
    } catch (error) {
      console.error("Error fetching validator data:", error);
    }
  };

  // -----------------------------
  // SECTION D: Render
  // -----------------------------
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="App">
            <header className='dashboard-header'>
              <h1 className='dashboard-title'>X1 Validator Dashboard</h1>
              <WalletMultiButton />
            </header>

            {/* VALIDATOR LOOKUP SECTION */}
            <section className="section">
              <h2>Validator Lookup</h2>
              <p>Enter a vote address to look up validator details.</p>
              <div>
                <input
                  type="text"
                  id="voteAddressInput"
                  placeholder="Enter vote address"
                />
                <button
                  onClick={() => {
                    const input = document.getElementById("voteAddressInput");
                    addValidator(input.value.trim());
                    input.value = "";
                  }}
                >
                  Add Validator
                </button>
              </div>

              <table id="validatorTable">
                <thead>
                  <tr>
                    <th>Vote Address</th>
                    <th>Commission</th>
                    <th>Stake</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validatorData.map((v, idx) => (
                    <tr key={idx}>
                      <td>{v.voteAddress}</td>
                      <td>{v.commission}</td>
                      <td>{v.stake}</td>
                      <td>{v.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* STAKE ACCOUNTS MANAGEMENT SECTION */}
            <StakeAccountsManagement />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
