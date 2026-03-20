"use client";

import { useState, useCallback } from "react";
import {
  registerProduct,
  getProduct,
  isWarrantyValid,
  getWarrantyExpiry,
  transferOwnership,
  getAllProducts,
  getProductCount,
  CONTRACT_ADDRESS,
} from "@/hooks/contract";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Spotlight } from "@/components/ui/spotlight";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Icons ────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// ── Styled Input ─────────────────────────────────────────────

function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">
        {label}
      </label>
      <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#7c6cf0]/30 focus-within:shadow-[0_0_20px_rgba(124,108,240,0.08)]">
        <input
          {...props}
          className="w-full rounded-[11px] bg-transparent px-4 py-3 font-mono text-sm text-white/90 placeholder:text-white/15 outline-none"
        />
      </div>
    </div>
  );
}

// ── Method Signature ─────────────────────────────────────────

function MethodSignature({
  name,
  params,
  returns,
  color,
}: {
  name: string;
  params: string;
  returns?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 font-mono text-sm">
      <span style={{ color }} className="font-semibold">fn</span>
      <span className="text-white/70">{name}</span>
      <span className="text-white/20 text-xs">{params}</span>
      {returns && (
        <span className="ml-auto text-white/15 text-[10px]">{returns}</span>
      )}
    </div>
  );
}

// ── Warranty Status Config ───────────────────────────────────

const WARRANTY_CONFIG = {
  valid: { color: "text-[#34d399]", bg: "bg-[#34d399]/10", border: "border-[#34d399]/20", dot: "bg-[#34d399]", variant: "success" as const },
  expired: { color: "text-[#f87171]", bg: "bg-[#f87171]/10", border: "border-[#f87171]/20", dot: "bg-[#f87171]", variant: "warning" as const },
  notFound: { color: "text-white/40", bg: "bg-white/[0.02]", border: "border-white/[0.06]", dot: "bg-white/20", variant: "info" as const },
};

// ── Main Component ───────────────────────────────────────────

type Tab = "lookup" | "register" | "transfer" | "browse";

interface ContractUIProps {
  walletAddress: string | null;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function ContractUI({ walletAddress, onConnect, isConnecting }: ContractUIProps) {
  const [activeTab, setActiveTab] = useState<Tab>("lookup");
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Register form
  const [regProductId, setRegProductId] = useState("");
  const [regManufacturer, setRegManufacturer] = useState("");
  const [regModel, setRegModel] = useState("");
  const [regWarrantyMonths, setRegWarrantyMonths] = useState("12");
  const [isRegistering, setIsRegistering] = useState(false);

  // Lookup form
  const [lookupId, setLookupId] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [productData, setProductData] = useState<Record<string, string> | null>(null);
  const [warrantyValid, setWarrantyValid] = useState<boolean | null>(null);
  const [warrantyExpiry, setWarrantyExpiry] = useState<string | null>(null);

  // Transfer form
  const [transferId, setTransferId] = useState("");
  const [transferNewOwner, setTransferNewOwner] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  // Browse
  const [allProducts, setAllProducts] = useState<string[]>([]);
  const [productCount, setProductCount] = useState<number>(0);
  const [isBrowsing, setIsBrowsing] = useState(false);

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts * 1000);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatExpiry = (expiryTs: number | null) => {
    if (!expiryTs) return "N/A";
    const now = Math.floor(Date.now() / 1000);
    if (expiryTs < now) return `Expired on ${formatTimestamp(expiryTs)}`;
    return `Valid until ${formatTimestamp(expiryTs)}`;
  };

  const handleLookup = useCallback(async () => {
    if (!lookupId.trim()) return setError("Enter a product ID");
    setError(null);
    setIsLookingUp(true);
    setProductData(null);
    setWarrantyValid(null);
    setWarrantyExpiry(null);
    try {
      const [product, valid, expiry] = await Promise.all([
        getProduct(lookupId.trim(), walletAddress || undefined),
        isWarrantyValid(lookupId.trim(), walletAddress || undefined),
        getWarrantyExpiry(lookupId.trim(), walletAddress || undefined),
      ]);
      
      if (product) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(product)) {
          mapped[String(k)] = String(v);
        }
        setProductData(mapped);
        setWarrantyValid(Boolean(valid));
        setWarrantyExpiry(expiry ? String(expiry) : null);
      } else {
        setError("Product not found");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setIsLookingUp(false);
    }
  }, [lookupId, walletAddress]);

  const handleRegister = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!regProductId.trim() || !regManufacturer.trim() || !regModel.trim()) {
      return setError("Fill in all fields");
    }
    const months = parseInt(regWarrantyMonths);
    if (isNaN(months) || months <= 0) return setError("Invalid warranty months");
    
    setError(null);
    setIsRegistering(true);
    setTxStatus("Awaiting signature...");
    try {
      await registerProduct(
        walletAddress,
        regProductId.trim(),
        regManufacturer.trim(),
        regModel.trim(),
        months,
        walletAddress
      );
      setTxStatus("Product registered on-chain!");
      setRegProductId("");
      setRegManufacturer("");
      setRegModel("");
      setRegWarrantyMonths("12");
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsRegistering(false);
    }
  }, [walletAddress, regProductId, regManufacturer, regModel, regWarrantyMonths]);

  const handleTransfer = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!transferId.trim() || !transferNewOwner.trim()) {
      return setError("Fill in all fields");
    }
    if (!transferNewOwner.startsWith("G")) {
      return setError("Invalid Stellar address");
    }
    
    setError(null);
    setIsTransferring(true);
    setTxStatus("Awaiting signature...");
    try {
      await transferOwnership(walletAddress, transferId.trim(), transferNewOwner.trim());
      setTxStatus("Ownership transferred on-chain!");
      setTransferId("");
      setTransferNewOwner("");
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsTransferring(false);
    }
  }, [walletAddress, transferId, transferNewOwner]);

  const handleBrowse = useCallback(async () => {
    setError(null);
    setIsBrowsing(true);
    try {
      const [count, products] = await Promise.all([
        getProductCount(walletAddress || undefined),
        getAllProducts(walletAddress || undefined),
      ]);
      setProductCount(Number(count) || 0);
      setAllProducts(Array.isArray(products) ? products : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setIsBrowsing(false);
    }
  }, [walletAddress]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "lookup", label: "Lookup", icon: <SearchIcon />, color: "#4fc3f7" },
    { key: "register", label: "Register", icon: <ShieldIcon />, color: "#7c6cf0" },
    { key: "transfer", label: "Transfer", icon: <RefreshIcon />, color: "#fbbf24" },
    { key: "browse", label: "Browse", icon: <CalendarIcon />, color: "#34d399" },
  ];

  return (
    <div className="w-full max-w-2xl animate-fade-in-up-delayed">
      {/* Toasts */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#f87171]/15 bg-[#f87171]/[0.05] px-4 py-3 backdrop-blur-sm animate-slide-down">
          <span className="mt-0.5 text-[#f87171]"><AlertIcon /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#f87171]/90">Error</p>
            <p className="text-xs text-[#f87171]/50 mt-0.5 break-all">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="shrink-0 text-[#f87171]/30 hover:text-[#f87171]/70 text-lg leading-none">&times;</button>
        </div>
      )}

      {txStatus && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#34d399]/15 bg-[#34d399]/[0.05] px-4 py-3 backdrop-blur-sm shadow-[0_0_30px_rgba(52,211,153,0.05)] animate-slide-down">
          <span className="text-[#34d399]">
            {txStatus.includes("on-chain") ? <CheckIcon /> : <SpinnerIcon />}
          </span>
          <span className="text-sm text-[#34d399]/90">{txStatus}</span>
        </div>
      )}

      {/* Main Card */}
      <Spotlight className="rounded-2xl">
        <AnimatedCard className="p-0" containerClassName="rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf0]/20 to-[#4fc3f7]/20 border border-white/[0.06]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#7c6cf0]">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90">Warranty Registry</h3>
                <p className="text-[10px] text-white/25 font-mono mt-0.5">{truncate(CONTRACT_ADDRESS)}</p>
              </div>
            </div>
            <Badge variant="info" className="text-[10px]">Soroban</Badge>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setError(null); setProductData(null); }}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all",
                  activeTab === t.key ? "text-white/90" : "text-white/35 hover:text-white/55"
                )}
              >
                <span style={activeTab === t.key ? { color: t.color } : undefined}>{t.icon}</span>
                {t.label}
                {activeTab === t.key && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full transition-all"
                    style={{ background: `linear-gradient(to right, ${t.color}, ${t.color}66)` }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Lookup */}
            {activeTab === "lookup" && (
              <div className="space-y-5">
                <MethodSignature name="get_product, is_warranty_valid" params="(product_id: String)" color="#4fc3f7" />
                <Input label="Product ID" value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="e.g. PROD-001" />
                <ShimmerButton onClick={handleLookup} disabled={isLookingUp} shimmerColor="#4fc3f7" className="w-full">
                  {isLookingUp ? <><SpinnerIcon /> Looking up...</> : <><SearchIcon /> Check Warranty</>}
                </ShimmerButton>

                {productData && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-fade-in-up">
                    <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">Product Details</span>
                      {warrantyValid !== null && (
                        <Badge variant={warrantyValid ? "success" : "warning"}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", warrantyValid ? "bg-[#34d399]" : "bg-[#f87171]")} />
                          {warrantyValid ? "Warranty Valid" : "Warranty Expired"}
                        </Badge>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/35">Product ID</span>
                        <span className="font-mono text-sm text-white/80">{lookupId}</span>
                      </div>
                      {productData.manufacturer && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/35">Manufacturer</span>
                          <span className="font-mono text-sm text-white/80">{productData.manufacturer}</span>
                        </div>
                      )}
                      {productData.model && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/35">Model</span>
                          <span className="font-mono text-sm text-white/80">{productData.model}</span>
                        </div>
                      )}
                      {productData.warranty_months && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/35">Warranty Period</span>
                          <span className="font-mono text-sm text-white/80">{productData.warranty_months} months</span>
                        </div>
                      )}
                      {productData.owner && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/35">Owner</span>
                          <span className="font-mono text-sm text-white/80">{truncate(productData.owner)}</span>
                        </div>
                      )}
                      {warrantyExpiry && (
                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                          <span className="text-xs text-white/35">Expiry Date</span>
                          <span className="font-mono text-sm text-white/80">{formatExpiry(parseInt(warrantyExpiry))}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Register */}
            {activeTab === "register" && (
              <div className="space-y-5">
                <MethodSignature name="register_product" params="(product_id, manufacturer, model, warranty_months, owner)" color="#7c6cf0" />
                <Input label="Product ID" value={regProductId} onChange={(e) => setRegProductId(e.target.value)} placeholder="e.g. PROD-001" />
                <Input label="Manufacturer" value={regManufacturer} onChange={(e) => setRegManufacturer(e.target.value)} placeholder="e.g. Apple" />
                <Input label="Model" value={regModel} onChange={(e) => setRegModel(e.target.value)} placeholder="e.g. iPhone 15" />
                <Input label="Warranty (months)" value={regWarrantyMonths} onChange={(e) => setRegWarrantyMonths(e.target.value)} placeholder="e.g. 12" type="number" />
                {walletAddress ? (
                  <ShimmerButton onClick={handleRegister} disabled={isRegistering} shimmerColor="#7c6cf0" className="w-full">
                    {isRegistering ? <><SpinnerIcon /> Registering...</> : <><ShieldIcon /> Register Product</>}
                  </ShimmerButton>
                ) : (
                  <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="w-full rounded-xl border border-dashed border-[#7c6cf0]/20 bg-[#7c6cf0]/[0.03] py-4 text-sm text-[#7c6cf0]/60 hover:border-[#7c6cf0]/30 hover:text-[#7c6cf0]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    Connect wallet to register products
                  </button>
                )}
                <p className="text-[10px] text-white/20 text-center">All functions are permissionless — anyone can register products</p>
              </div>
            )}

            {/* Transfer */}
            {activeTab === "transfer" && (
              <div className="space-y-5">
                <MethodSignature name="transfer_ownership" params="(product_id: String, new_owner: Address)" color="#fbbf24" />
                <Input label="Product ID" value={transferId} onChange={(e) => setTransferId(e.target.value)} placeholder="e.g. PROD-001" />
                <Input label="New Owner Address" value={transferNewOwner} onChange={(e) => setTransferNewOwner(e.target.value)} placeholder="G..." />
                {walletAddress ? (
                  <ShimmerButton onClick={handleTransfer} disabled={isTransferring} shimmerColor="#fbbf24" className="w-full">
                    {isTransferring ? <><SpinnerIcon /> Transferring...</> : <><RefreshIcon /> Transfer Ownership</>}
                  </ShimmerButton>
                ) : (
                  <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="w-full rounded-xl border border-dashed border-[#fbbf24]/20 bg-[#fbbf24]/[0.03] py-4 text-sm text-[#fbbf24]/60 hover:border-[#fbbf24]/30 hover:text-[#fbbf24]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    Connect wallet to transfer ownership
                  </button>
                )}
                <p className="text-[10px] text-white/20 text-center">Transfer is permissionless — any address can be set as new owner</p>
              </div>
            )}

            {/* Browse */}
            {activeTab === "browse" && (
              <div className="space-y-5">
                <MethodSignature name="get_all_products, get_product_count" params="()" color="#34d399" />
                <ShimmerButton onClick={handleBrowse} disabled={isBrowsing} shimmerColor="#34d399" className="w-full">
                  {isBrowsing ? <><SpinnerIcon /> Loading...</> : <><CalendarIcon /> Browse All Products</>}
                </ShimmerButton>

                {productCount > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 animate-fade-in-up">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs text-white/35">Total Products</span>
                      <span className="font-mono text-2xl text-white/80">{productCount}</span>
                    </div>
                    {allProducts.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">Product IDs</span>
                        <div className="flex flex-wrap gap-2">
                          {allProducts.map((id) => (
                            <span key={id} className="font-mono text-xs px-2 py-1 rounded-lg bg-white/[0.02] border border-white/[0.06] text-white/60">
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.04] px-6 py-3 flex items-center justify-between">
            <p className="text-[10px] text-white/15">Warranty Registry &middot; Soroban</p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
                <span className="font-mono text-[9px] text-white/15">Permissionless</span>
              </span>
            </div>
          </div>
        </AnimatedCard>
      </Spotlight>
    </div>
  );
}
