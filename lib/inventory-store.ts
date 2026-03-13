export type TransactionType = "incoming" | "cash-sale" | "credit-sale"

export type CementBrand = "ultratech" | "acc" | "ambuja"

export interface CementItem {
  brand: CementBrand
  bags: number
}

export interface Transaction {
  id: string
  time: Date
  type: TransactionType
  items: CementItem[]
  totalBags: number
  vehicle?: string
  customer?: string
  company?: string
  mobile?: string
  vehicleNumber?: string
  signature?: string
  photo?: string
}

export interface BrandStock {
  ultratech: number
  acc: number
  ambuja: number
}

export interface InventoryState {
  currentStock: number
  brandStock: BrandStock
  todayIncoming: number
  todaySales: number
  transactions: Transaction[]
}

const STORAGE_KEY = "cement-inventory-v2"

export const BRAND_LABELS: Record<CementBrand, string> = {
  ultratech: "UltraTech",
  acc: "ACC",
  ambuja: "Ambuja",
}

export function getInitialState(): InventoryState {
  if (typeof window === "undefined") {
    return {
      currentStock: 0,
      brandStock: { ultratech: 0, acc: 0, ambuja: 0 },
      todayIncoming: 0,
      todaySales: 0,
      transactions: [],
    }
  }
  
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const parsed = JSON.parse(stored)
    return {
      ...parsed,
      brandStock: parsed.brandStock || { ultratech: 0, acc: 0, ambuja: 0 },
      transactions: parsed.transactions.map((t: Transaction) => ({
        ...t,
        time: new Date(t.time),
      })),
    }
  }
  
  return {
    currentStock: 500,
    brandStock: { ultratech: 200, acc: 150, ambuja: 150 },
    todayIncoming: 0,
    todaySales: 0,
    transactions: [],
  }
}

export function saveState(state: InventoryState) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
}

export function addTransaction(
  state: InventoryState,
  transaction: Omit<Transaction, "id" | "time">
): InventoryState {
  const newTransaction: Transaction = {
    ...transaction,
    id: crypto.randomUUID(),
    time: new Date(),
  }
  
  let { currentStock, brandStock, todayIncoming, todaySales } = state
  const newBrandStock = { ...brandStock }
  
  if (transaction.type === "incoming") {
    for (const item of transaction.items) {
      currentStock += item.bags
      newBrandStock[item.brand] += item.bags
      todayIncoming += item.bags
    }
  } else {
    for (const item of transaction.items) {
      currentStock -= item.bags
      newBrandStock[item.brand] -= item.bags
      todaySales += item.bags
    }
  }
  
  const newState = {
    currentStock,
    brandStock: newBrandStock,
    todayIncoming,
    todaySales,
    transactions: [newTransaction, ...state.transactions],
  }
  
  saveState(newState)
  return newState
}
