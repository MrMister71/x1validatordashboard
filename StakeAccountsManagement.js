import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Connection,
  PublicKey,
  Transaction,
  StakeProgram
} from '@solana/web3.js';

function StakeAccountsManagement() {
  const [stakeAccount, setStakeAccount] = useState("");
  const [accountInfo, setAccountInfo] = useState(null);
  const [newStakeAuthority, setNewStakeAuthority] = useState("");
  const [newWithdrawAuthority, setNewWithdrawAuthority] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const { publicKey, signTransaction } = useWallet();
  const connection = new Connection("https://rpc.mainnet.x1.xyz");

  // -----------------------------
  // Lookup Stake Account
  // -----------------------------
  const lookupStakeAccount = async () => {
    try {
      const response = await fetch("https://rpc.mainnet.x1.xyz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [stakeAccount, { encoding: "jsonParsed", commitment: "confirmed" }]
        })
      });

      const data = await response.json();
      const info = data.result?.value;

      if (info) {
        setAccountInfo({
          address: stakeAccount,
          balance: (info.lamports / 1e9).toFixed(6) + " XNT",
          stakeAuthority: info.data?.parsed?.info?.meta?.authorized?.staker || "Unknown",
          withdrawAuthority: info.data?.parsed?.info?.meta?.authorized?.withdrawer || "Unknown"
        });
      } else {
        setAccountInfo(null);
      }
    } catch (err) {
      console.error("Error fetching stake account:", err);
      setStatusMessage("Error fetching stake account info.");
    }
  };

  // -----------------------------
  // Change Authority (Manual Signing + Validation)
  // -----------------------------
  const changeAuthority = async (type) => {
    if (!publicKey || !signTransaction) {
      setStatusMessage("Wallet connection or functions not available!");
      return;
    }
    if (!accountInfo) {
      setStatusMessage("Lookup a stake account first.");
      return;
    }

    try {
      const newAuth = type === "Stake" ? newStakeAuthority : newWithdrawAuthority;

      // Validation: must not be empty or equal to stake account address
      if (!newAuth || newAuth === stakeAccount) {
        setStatusMessage("Invalid authority: must be a wallet pubkey, not the stake account address.");
        return;
      }

      // Ensure connected wallet matches current authority
      const currentAuthority =
        type === "Stake" ? accountInfo.stakeAuthority : accountInfo.withdrawAuthority;
      if (publicKey.toString() !== currentAuthority) {
        setStatusMessage(`Connected wallet is not the current ${type.toLowerCase()} authority.`);
        return;
      }

      // Use correct string for authorization type
      const stakeAuthorizationType = type === "Stake" ? "Staker" : "Withdrawer";

      // Get latest blockhash first
      const { blockhash } = await connection.getLatestBlockhash("finalized");

      // Build transaction
      const tx = new Transaction({
        feePayer: publicKey,
        recentBlockhash: blockhash,
      });

      tx.add(
        StakeProgram.authorize({
          stakePubkey: new PublicKey(stakeAccount),
          authorizedPubkey: publicKey,                 // current authority signer
          newAuthorizedPubkey: new PublicKey(newAuth), // target wallet pubkey
          stakeAuthorizationType,                      // "Staker" or "Withdrawer"
        })
      );

      // Manual signing (Backpack popup)
      const signedTx = await signTransaction(tx);

      // Send raw transaction
      const txid = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });

      // Confirm transaction
      await connection.confirmTransaction(txid, "confirmed");

      // Fetch logs for debugging
      const txDetails = await connection.getTransaction(txid, { commitment: "confirmed" });
      console.log("Transaction logs:", txDetails?.meta?.logMessages);

      // Re-fetch account info to reflect the change
      await lookupStakeAccount();

      setStatusMessage(`Transaction confirmed ✅: ${txid}`);
    } catch (err) {
      console.error("Error changing authority:", err);
      setStatusMessage("Error sending transaction. Check console for details.");
    }
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <section className="section stake-section">
      <h2>Stake Account Inspector & Authority Manager</h2>
      <p>Enter a stake account pubkey to inspect details and manage authorities.</p>

      <div>
        <input
          type="text"
          placeholder="Enter stake account pubkey"
          value={stakeAccount}
          onChange={(e) => setStakeAccount(e.target.value)}
        />
        <button onClick={lookupStakeAccount}>Inspect Stake</button>
      </div>

      {accountInfo && (
        <div className="stake-info">
          <p><strong>Stake Account:</strong> {accountInfo.address}</p>
          <p><strong>Balance:</strong> {accountInfo.balance}</p>
          <p><strong>Stake Authority:</strong> {accountInfo.stakeAuthority}</p>
          <p><strong>Withdraw Authority:</strong> {accountInfo.withdrawAuthority}</p>
        </div>
      )}

      <div className="authority-panel">
        <h3>Change Authorities</h3>
        <input
          type="text"
          placeholder="New Stake Authority (wallet pubkey)"
          value={newStakeAuthority}
          onChange={(e) => setNewStakeAuthority(e.target.value)}
        />
        <button
          onClick={() => changeAuthority("Stake")}
          disabled={
            !publicKey ||
            !accountInfo ||
            publicKey.toString() !== accountInfo.stakeAuthority
          }
        >
          Change Stake Authority
        </button>

        <input
          type="text"
          placeholder="New Withdraw Authority (wallet pubkey)"
          value={newWithdrawAuthority}
          onChange={(e) => setNewWithdrawAuthority(e.target.value)}
        />
        <button
          onClick={() => changeAuthority("Withdraw")}
          disabled={
            !publicKey ||
            !accountInfo ||
            publicKey.toString() !== accountInfo.withdrawAuthority
          }
        >
          Change Withdraw Authority
        </button>
      </div>

      {statusMessage && <p className="status">{statusMessage}</p>}
    </section>
  );
}

export default StakeAccountsManagement;
