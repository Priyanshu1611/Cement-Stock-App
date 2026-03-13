"use client"

import { Home, PackagePlus, ShoppingCart, History } from "lucide-react"

export type Screen = "dashboard" | "incoming" | "sale" | "history"

interface BottomNavProps {
  current: Screen
  onNavigate: (screen: Screen) => void
}

export function BottomNav({ current, onNavigate }: BottomNavProps) {
  const items: { id: Screen; icon: React.ReactNode; label: string }[] = [
    { id: "dashboard", icon: <Home className="h-8 w-8" />, label: "Home" },
    { id: "incoming", icon: <PackagePlus className="h-8 w-8" />, label: "In" },
    { id: "sale", icon: <ShoppingCart className="h-8 w-8" />, label: "Sale" },
    { id: "history", icon: <History className="h-8 w-8" />, label: "History" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t-3 border-border shadow-xl">
      <div className="flex justify-around items-center h-24 max-w-2xl mx-auto px-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center gap-1 w-20 h-20 rounded-xl transition-all active:scale-95 ${
              current === item.id
                ? "text-primary bg-primary/15 font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {item.icon}
            <span className="text-sm font-semibold">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
