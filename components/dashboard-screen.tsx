"use client"

import { Button } from "@/components/ui/button"
import { Package, TrendingUp, TrendingDown, PackagePlus, ShoppingCart, History } from "lucide-react"
import type { InventoryState } from "@/lib/inventory-store"
import { BRAND_LABELS, type CementBrand } from "@/lib/inventory-store"
import type { Screen } from "./bottom-nav"

interface DashboardScreenProps {
  state: InventoryState
  onNavigate: (screen: Screen) => void
}

export function DashboardScreen({ state, onNavigate }: DashboardScreenProps) {
  const brands: CementBrand[] = ["ultratech", "acc", "ambuja"]
  
  return (
    <div className="p-6 pb-32 flex flex-col gap-6">
      {/* Header */}
      <h1 className="text-3xl font-bold text-center text-foreground">Cement Inventory</h1>
      
      {/* Current Stock - Very Large */}
      <div className="bg-card border-4 border-primary rounded-2xl p-8 text-center shadow-sm">
        <div className="flex items-center justify-center gap-4 mb-2">
          <Package className="h-12 w-12 text-primary" />
          <span className="text-xl font-semibold text-muted-foreground uppercase tracking-wide">Total Stock</span>
        </div>
        <p className="text-8xl font-black text-foreground leading-none">{state.currentStock}</p>
        <p className="text-2xl text-muted-foreground mt-2">bags</p>
      </div>

      {/* Stock by Brand */}
      <div className="bg-card border-3 rounded-xl p-5">
        <h2 className="text-lg font-bold text-muted-foreground uppercase tracking-wide mb-4 text-center">Stock by Brand</h2>
        <div className="grid grid-cols-3 gap-3">
          {brands.map((brand) => (
            <div key={brand} className="text-center p-4 bg-background rounded-xl border-2">
              <p className="text-sm font-semibold text-muted-foreground">{BRAND_LABELS[brand]}</p>
              <p className="text-3xl font-black text-foreground">{state.brandStock[brand]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Today Stats - Side by Side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border-3 border-accent/50 rounded-xl p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingUp className="h-8 w-8 text-accent" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Today In</p>
          <p className="text-5xl font-black text-foreground">{state.todayIncoming}</p>
          <p className="text-base text-muted-foreground">bags</p>
        </div>

        <div className="bg-card border-3 border-destructive/50 rounded-xl p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingDown className="h-8 w-8 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Today Sales</p>
          <p className="text-5xl font-black text-foreground">{state.todaySales}</p>
          <p className="text-base text-muted-foreground">bags</p>
        </div>
      </div>

      {/* Large Action Buttons */}
      <div className="flex flex-col gap-4 mt-2">
        <Button 
          className="w-full h-20 text-2xl font-bold bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-md active:scale-[0.98] transition-transform"
          onClick={() => onNavigate("incoming")}
        >
          <PackagePlus className="h-8 w-8 mr-4" />
          Add Incoming
        </Button>

        <Button 
          className="w-full h-20 text-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-md active:scale-[0.98] transition-transform"
          onClick={() => onNavigate("sale")}
        >
          <ShoppingCart className="h-8 w-8 mr-4" />
          New Sale
        </Button>

        <Button 
          variant="outline"
          className="w-full h-18 text-xl font-bold border-3 rounded-xl active:scale-[0.98] transition-transform bg-card"
          onClick={() => onNavigate("history")}
        >
          <History className="h-7 w-7 mr-3" />
          History
        </Button>
      </div>
    </div>
  )
}
