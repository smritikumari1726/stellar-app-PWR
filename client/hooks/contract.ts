"use client";

import {
  Contract,
  Networks,
  TransactionBuilder,
  Keypair,
  xdr,
  Address,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import {
  isConnected,
  getAddress,
  signTransaction,
  setAllowed,
  isAllowed,
  requestAccess,
} from "@stellar/freighter-api";

// ============================================================
// CONSTANTS — Update these for your contract
// ============================================================

/** Your deployed Soroban contract ID */
export const CONTRACT_ADDRESS =
  "CBEBD2WOHKQ2LCEM64NT5PRXY7CCNM4V7D37BEVQW3BQWPQ5UC2XLKKX";

/** Network passphrase (testnet by default) */
export const NETWORK_PASSPHRASE = Networks.TESTNET;

/** Soroban RPC URL */
export const RPC_URL = "https://soroban-testnet.stellar.org";

/** Horizon URL */
export const HORIZON_URL = "https://horizon-testnet.stellar.org";

/** Network name for Freighter */
export const NETWORK = "TESTNET";

// ============================================================
// RPC Server Instance
// ============================================================

const server = new rpc.Server(RPC_URL);

// ============================================================
// Wallet Helpers
// ============================================================

export async function checkConnection(): Promise<boolean> {
  const result = await isConnected();
  return result.isConnected;
}

export async function connectWallet(): Promise<string> {
  const connResult = await isConnected();
  if (!connResult.isConnected) {
    throw new Error("Freighter extension is not installed or not available.");
  }

  const allowedResult = await isAllowed();
  if (!allowedResult.isAllowed) {
    await setAllowed();
    await requestAccess();
  }

  const { address } = await getAddress();
  if (!address) {
    throw new Error("Could not retrieve wallet address from Freighter.");
  }
  return address;
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    const connResult = await isConnected();
    if (!connResult.isConnected) return null;

    const allowedResult = await isAllowed();
    if (!allowedResult.isAllowed) return null;

    const { address } = await getAddress();
    return address || null;
  } catch {
    return null;
  }
}

// ============================================================
// Contract Interaction Helpers
// ============================================================

/**
 * Build, simulate, and optionally sign + submit a Soroban contract call.
 *
 * @param method   - The contract method name to invoke
 * @param params   - Array of xdr.ScVal parameters for the method
 * @param caller   - The public key (G...) of the calling account
 * @param sign     - If true, signs via Freighter and submits. If false, only simulates.
 * @returns        The result of the simulation or submission
 */
export async function callContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller: string,
  sign: boolean = true
) {
  const contract = new Contract(CONTRACT_ADDRESS);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(
      `Simulation failed: ${(simulated as rpc.Api.SimulateTransactionErrorResponse).error}`
    );
  }

  if (!sign) {
    // Read-only call — just return the simulation result
    return simulated;
  }

  // Prepare the transaction with the simulation result
  const prepared = rpc.assembleTransaction(tx, simulated).build();

  // Sign with Freighter
  const { signedTxXdr } = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const txToSubmit = TransactionBuilder.fromXDR(
    signedTxXdr,
    NETWORK_PASSPHRASE
  );

  const result = await server.sendTransaction(txToSubmit);

  if (result.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${result.status}`);
  }

  // Poll for confirmation
  let getResult = await server.getTransaction(result.hash);
  while (getResult.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResult = await server.getTransaction(result.hash);
  }

  if (getResult.status === "FAILED") {
    throw new Error("Transaction failed on chain.");
  }

  return getResult;
}

/**
 * Read-only contract call (does not require signing).
 */
export async function readContract(
  method: string,
  params: xdr.ScVal[] = [],
  caller?: string
) {
  const account =
    caller || Keypair.random().publicKey(); // Use a random keypair for read-only
  const sim = await callContract(method, params, account, false);
  if (
    rpc.Api.isSimulationSuccess(sim as rpc.Api.SimulateTransactionResponse) &&
    (sim as rpc.Api.SimulateTransactionSuccessResponse).result
  ) {
    return scValToNative(
      (sim as rpc.Api.SimulateTransactionSuccessResponse).result!.retval
    );
  }
  return null;
}

// ============================================================
// ScVal Conversion Helpers
// ============================================================

export function toScValString(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: "string" });
}

export function toScValU32(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: "u32" });
}

export function toScValI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

export function toScValAddress(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

export function toScValBool(value: boolean): xdr.ScVal {
  return nativeToScVal(value, { type: "bool" });
}

// ============================================================
// Product Warranty Registry — Contract Methods
// ============================================================

export interface ProductData {
  manufacturer: string;
  model: string;
  owner: string;
  registration_time: number;
  warranty_months: number;
}

/**
 * Register a new product with warranty. Anyone can call (permissionless).
 * Calls: register_product(product_id: String, manufacturer: String, model: String, warranty_months: u32, owner: Address)
 */
export async function registerProduct(
  caller: string,
  productId: string,
  manufacturer: string,
  model: string,
  warrantyMonths: number,
  owner: string
) {
  return callContract(
    "register_product",
    [
      toScValString(productId),
      toScValString(manufacturer),
      toScValString(model),
      toScValU32(warrantyMonths),
      toScValAddress(owner),
    ],
    caller,
    true
  );
}

/**
 * Get product details. Anyone can call (permissionless).
 * Calls: get_product(product_id: String) -> Option<Product>
 */
export async function getProduct(productId: string, caller?: string) {
  return readContract("get_product", [toScValString(productId)], caller);
}

/**
 * Check if warranty is valid. Anyone can call (permissionless).
 * Calls: is_warranty_valid(product_id: String) -> bool
 */
export async function isWarrantyValid(productId: string, caller?: string) {
  return readContract("is_warranty_valid", [toScValString(productId)], caller);
}

/**
 * Get warranty expiry timestamp. Anyone can call (permissionless).
 * Calls: get_warranty_expiry(product_id: String) -> Option<u64>
 */
export async function getWarrantyExpiry(productId: string, caller?: string) {
  return readContract("get_warranty_expiry", [toScValString(productId)], caller);
}

/**
 * Transfer product ownership. Anyone can call (permissionless).
 * Calls: transfer_ownership(product_id: String, new_owner: Address)
 */
export async function transferOwnership(
  caller: string,
  productId: string,
  newOwner: string
) {
  return callContract(
    "transfer_ownership",
    [toScValString(productId), toScValAddress(newOwner)],
    caller,
    true
  );
}

/**
 * Get all registered product IDs. Anyone can call (permissionless).
 * Calls: get_all_products() -> Vec<String>
 */
export async function getAllProducts(caller?: string) {
  return readContract("get_all_products", [], caller);
}

/**
 * Get total product count. Anyone can call (permissionless).
 * Calls: get_product_count() -> u32
 */
export async function getProductCount(caller?: string) {
  return readContract("get_product_count", [], caller);
}

export { nativeToScVal, scValToNative, Address, xdr };
