"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { History, PackagePlus, Banknote, CreditCard } from "lucide-react"
import type { Transaction } from "@/lib/inventory-store"
import { BRAND_LABELS, type CementBrand } from "@/lib/inventory-store"

interface HistoryScreenProps {
  transactions: Transaction[]
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  })
}

function getTypeIcon(type: Transaction["type"]) {
  switch (type) {
    case "incoming":
      return <PackagePlus className="h-6 w-6 text-accent" />
    case "cash-sale":
      return <Banknote className="h-6 w-6 text-primary" />
    case "credit-sale":
      return <CreditCard className="h-6 w-6 text-amber-600" />
  }
}

function getTypeLabel(type: Transaction["type"]) {
  switch (type) {
    case "incoming":
      return "Incoming"
    case "cash-sale":
      return "Cash Sale"
    case "credit-sale":
      return "Credit Sale"
  }
}

function getTypeBadgeClass(type: Transaction["type"]) {
  switch (type) {
    case "incoming":
      return "bg-accent/10 text-accent"
    case "cash-sale":
      return "bg-primary/10 text-primary"
    case "credit-sale":
      return "bg-amber-100 text-amber-700"
  }
}

export function HistoryScreen({ transactions }: HistoryScreenProps) {
  return (
    <div className="p-4 pb-28">
      <Card className="border-3">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <History className="h-8 w-8 text-primary" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-16 w-16 mx-auto mb-3 opacity-50" />
              <p className="text-xl">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-4 rounded-xl border-3 bg-card"
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getTypeIcon(tx.type)}
                      <span className={`px-3 py-1 rounded-lg text-sm font-bold ${getTypeBadgeClass(tx.type)}`}>
                        {getTypeLabel(tx.type)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{formatDate(tx.time)}</p>
                      <p className="text-sm font-semibold">{formatTime(tx.time)}</p>
                    </div>
                  </div>
                  
                  {/* Customer & Vehicle */}
                  {(tx.customer || tx.vehicleNumber) && (
                    <div className="mb-3 pb-3 border-b border-border">
                      {tx.customer && (
                        <p className="text-lg font-semibold text-foreground">{tx.customer}</p>
                      )}
                      {tx.vehicleNumber && (
                        <p className="text-base text-muted-foreground">Vehicle: {tx.vehicleNumber}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Items */}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Items</p>
                    {tx.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-lg">
                        <span className="text-foreground">{BRAND_LABELS[item.brand as CementBrand]}</span>
                        <span className="font-bold">{item.bags} bags</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Total */}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                    <span className="text-lg font-semibold text-muted-foreground">Total</span>
                    <span className="text-2xl font-black text-primary">{tx.totalBags} bags</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
