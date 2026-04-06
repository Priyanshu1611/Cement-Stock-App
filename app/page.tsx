"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BottomNav, type Screen } from "@/components/bottom-nav"
import { DashboardScreen } from "@/components/dashboard-screen"
import { IncomingScreen } from "@/components/incoming-screen"
import { SaleScreen } from "@/components/sale-screen"
import { HistoryScreen } from "@/components/history-screen"
import { getInitialState, addTransaction, type InventoryState, type CementItem } from "@/lib/inventory-store"
import { supabase } from "@/lib/supabase-client"

export default function Home() {
  const router = useRouter()

  const [screen, setScreen] = useState<Screen>("dashboard")
  const [state, setState] = useState<InventoryState>({
    currentStock: 0,
    brandStock: { ultratech: 0, acc: 0, ambuja: 0 },
    todayIncoming: 0,
    todaySales: 0,
    transactions: [],
  })
  const [mounted, setMounted] = useState(false)

  // 🔥 AUTH + REDIRECT FIX
  useEffect(() => {
    const handleAuth = async () => {
      if (!supabase) return

      // Step 1: get session
      let { data } = await supabase.auth.getSession()

      // Step 2: handle OAuth redirect (IMPORTANT)
      if (!data.session && typeof window !== "undefined" && window.location.hash) {
        const params = new URLSearchParams(window.location.hash.substring(1))

        const access_token = params.get("access_token")
        const refresh_token = params.get("refresh_token")

        if (access_token && refresh_token) {
          await supabase.auth.setSession({
            access_token,
            refresh_token,
          })

          // clean URL
          window.history.replaceState({}, document.title, window.location.pathname)

          const updated = await supabase.auth.getSession()
          data = updated.data
        }
      }

      // Step 3: redirect to billing if logged in
      if (data.session) {
        router.push("/billing")
        return
      }
    }

    handleAuth()
  }, [])

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