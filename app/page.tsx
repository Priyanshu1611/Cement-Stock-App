"use client"

import { useState, useEffect } from "react"
import { BottomNav, type Screen } from "@/components/bottom-nav"
import { DashboardScreen } from "@/components/dashboard-screen"
import { IncomingScreen } from "@/components/incoming-screen"
import { SaleScreen } from "@/components/sale-screen"
import { HistoryScreen } from "@/components/history-screen"
import { getInitialState, addTransaction, type InventoryState, type CementItem } from "@/lib/inventory-store"

export default function Home() {
  const [screen, setScreen] = useState<Screen>("dashboard")
  const [state, setState] = useState<InventoryState>({
    currentStock: 0,
    brandStock: { ultratech: 0, acc: 0, ambuja: 0 },
    todayIncoming: 0,
    todaySales: 0,
    transactions: [],
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setState(getInitialState())
    setMounted(true)
  }, [])

  const handleIncomingSave = (data: {
    items: CementItem[]
    totalBags: number
  }) => {
    const newState = addTransaction(state, {
      type: "incoming",
      items: data.items,
      totalBags: data.totalBags,
      vehicle: "Truck",
    })
    setState(newState)
  }

  const handleSaleSave = (data: {
    type: "cash" | "credit"
    items: CementItem[]
    totalBags: number
    customer: string
    mobile?: string
    vehicleNumber: string
    signature?: string
    photo?: string
  }) => {
    const newState = addTransaction(state, {
      type: data.type === "cash" ? "cash-sale" : "credit-sale",
      items: data.items,
      totalBags: data.totalBags,
      customer: data.customer,
      mobile: data.mobile,
      vehicleNumber: data.vehicleNumber,
      signature: data.signature,
      photo: data.photo,
    })
    setState(newState)
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background max-w-2xl mx-auto">
      {screen === "dashboard" && (
        <DashboardScreen
          state={state}
          onNavigate={setScreen}
        />
      )}
      {screen === "incoming" && (
        <IncomingScreen onSave={handleIncomingSave} />
      )}
      {screen === "sale" && (
        <SaleScreen onSave={handleSaleSave} />
      )}
      {screen === "history" && (
        <HistoryScreen transactions={state.transactions} />
      )}
      <BottomNav current={screen} onNavigate={setScreen} />
    </main>
  )
}
