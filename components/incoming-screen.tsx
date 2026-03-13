"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PackagePlus, Check } from "lucide-react"
import { BRAND_LABELS, type CementBrand, type CementItem } from "@/lib/inventory-store"

interface IncomingScreenProps {
  onSave: (data: {
    items: CementItem[]
    totalBags: number
  }) => void
}

export function IncomingScreen({ onSave }: IncomingScreenProps) {
  const [brand, setBrand] = useState<CementBrand | "">("")
  const [bags, setBags] = useState("")
  const [saved, setSaved] = useState(false)

  const brands: CementBrand[] = ["ultratech", "acc", "ambuja"]

  const handleSave = () => {
    if (!brand || !bags) return
    onSave({
      items: [{ brand, bags: parseInt(bags) }],
      totalBags: parseInt(bags),
    })
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setBrand("")
      setBags("")
    }, 1500)
  }

  const isValid = brand && bags && parseInt(bags) > 0

  return (
    <div className="p-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <PackagePlus className="h-10 w-10 text-accent" />
        <h1 className="text-3xl font-bold text-foreground">Add Incoming</h1>
      </div>

      <div className="flex flex-col gap-6">
        {/* Cement Brand */}
        <div className="space-y-3">
          <label className="text-xl font-bold text-foreground">Cement Brand</label>
          <div className="grid grid-cols-3 gap-3">
            {brands.map((b) => (
              <Button
                key={b}
                type="button"
                variant={brand === b ? "default" : "outline"}
                className={`h-20 text-lg font-bold rounded-xl border-3 ${
                  brand === b 
                    ? "bg-accent text-accent-foreground" 
                    : "bg-card"
                }`}
                onClick={() => setBrand(b)}
              >
                {BRAND_LABELS[b]}
              </Button>
            ))}
          </div>
        </div>

        {/* Bags - Large Number Input */}
        <div className="space-y-3">
          <label className="text-xl font-bold text-foreground">Number of Bags</label>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={bags}
            onChange={(e) => setBags(e.target.value)}
            className="h-28 text-6xl text-center font-black border-3 rounded-xl bg-card"
          />
        </div>

        {/* Save Button */}
        <Button
          className={`w-full h-24 text-2xl font-bold rounded-xl mt-4 shadow-lg active:scale-[0.98] transition-transform ${
            saved 
              ? "bg-accent text-accent-foreground" 
              : "bg-accent hover:bg-accent/90 text-accent-foreground"
          }`}
          onClick={handleSave}
          disabled={!isValid || saved}
        >
          {saved ? (
            <>
              <Check className="h-8 w-8 mr-3" />
              Saved!
            </>
          ) : (
            "Save Incoming"
          )}
        </Button>
      </div>
    </div>
  )
}
