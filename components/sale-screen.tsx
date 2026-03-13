"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Banknote, CreditCard, Check, Camera, MessageCircle, Plus, Trash2 } from "lucide-react"
import { SignaturePad } from "./signature-pad"
import { BRAND_LABELS, type CementBrand, type CementItem } from "@/lib/inventory-store"

interface SaleScreenProps {
  onSave: (data: {
    type: "cash" | "credit"
    items: CementItem[]
    totalBags: number
    customer: string
    mobile?: string
    vehicleNumber: string
    signature?: string
    photo?: string
  }) => void
}

export function SaleScreen({ onSave }: SaleScreenProps) {
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash")
  const [customer, setCustomer] = useState("")
  const [mobile, setMobile] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [cementItems, setCementItems] = useState<{ brand: CementBrand | ""; bags: string }[]>([
    { brand: "", bags: "" }
  ])
  const [signature, setSignature] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const brands: CementBrand[] = ["ultratech", "acc", "ambuja"]

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPhoto(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const addCementItem = () => {
    setCementItems([...cementItems, { brand: "", bags: "" }])
  }

  const removeCementItem = (index: number) => {
    if (cementItems.length > 1) {
      setCementItems(cementItems.filter((_, i) => i !== index))
    }
  }

  const updateCementItem = (index: number, field: "brand" | "bags", value: string) => {
    const updated = [...cementItems]
    if (field === "brand") {
      updated[index].brand = value as CementBrand | ""
    } else {
      updated[index].bags = value
    }
    setCementItems(updated)
  }

  const validItems = cementItems.filter(item => item.brand && item.bags && parseInt(item.bags) > 0)
  const totalBags = validItems.reduce((sum, item) => sum + parseInt(item.bags || "0"), 0)

  const isValid = customer && vehicleNumber && validItems.length > 0

  const handleSave = () => {
    if (!isValid) return

    const items: CementItem[] = validItems.map(item => ({
      brand: item.brand as CementBrand,
      bags: parseInt(item.bags)
    }))

    onSave({
      type: paymentType,
      items,
      totalBags,
      customer,
      mobile: mobile || undefined,
      vehicleNumber,
      ...(paymentType === "credit" && {
        signature: signature || undefined,
        photo: photo || undefined,
      }),
    })

    setSaved(true)
    
    if (paymentType === "credit" && mobile) {
      setTimeout(() => {
        setShowWhatsApp(true)
      }, 1000)
    } else {
      setTimeout(() => {
        resetForm()
      }, 1500)
    }
  }

  const resetForm = () => {
    setSaved(false)
    setShowWhatsApp(false)
    setCustomer("")
    setMobile("")
    setVehicleNumber("")
    setCementItems([{ brand: "", bags: "" }])
    setSignature(null)
    setPhoto(null)
  }

  const handleWhatsApp = () => {
    const now = new Date()
    const dateStr = now.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    const timeStr = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    
    const itemsText = validItems
      .map(item => `${BRAND_LABELS[item.brand as CementBrand]} - ${item.bags} bags`)
      .join("\n")
    
    const message = encodeURIComponent(
`*CEMENT DELIVERY CONFIRMATION*
━━━━━━━━━━━━━━━━━━━━

*Customer:* ${customer}
*Vehicle No:* ${vehicleNumber}

*Items:*
${itemsText}

*Total Bags:* ${totalBags}
*Date:* ${dateStr}
*Time:* ${timeStr}

━━━━━━━━━━━━━━━━━━━━

_If any information is incorrect please inform immediately._

Thank you for your business!`
    )
    
    let cleanMobile = mobile.replace(/[\s\-\(\)]/g, "")
    if (!cleanMobile.startsWith("+")) {
      if (!cleanMobile.startsWith("91")) {
        cleanMobile = "91" + cleanMobile
      }
    }
    
    window.open(`https://wa.me/${cleanMobile}?text=${message}`, "_blank")
  }

  return (
    <div className="p-6 pb-32">
      {/* Header */}
      <h1 className="text-3xl font-bold text-foreground text-center mb-6">Sale Entry</h1>

      <div className="flex flex-col gap-5">
        {/* Payment Type Toggle */}
        <div className="space-y-3">
          <label className="text-xl font-bold text-foreground">Payment Type</label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={paymentType === "cash" ? "default" : "outline"}
              className={`h-20 text-xl font-bold rounded-xl border-3 flex items-center justify-center gap-3 ${
                paymentType === "cash" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-card"
              }`}
              onClick={() => setPaymentType("cash")}
            >
              <Banknote className="h-8 w-8" />
              Cash
            </Button>
            <Button
              type="button"
              variant={paymentType === "credit" ? "default" : "outline"}
              className={`h-20 text-xl font-bold rounded-xl border-3 flex items-center justify-center gap-3 ${
                paymentType === "credit" 
                  ? "bg-amber-600 text-white" 
                  : "bg-card"
              }`}
              onClick={() => setPaymentType("credit")}
            >
              <CreditCard className="h-8 w-8" />
              Credit
            </Button>
          </div>
        </div>

        {/* Customer Name */}
        <div className="space-y-2">
          <label className="text-xl font-bold text-foreground">Customer Name *</label>
          <Input
            placeholder="Enter customer name"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="h-16 text-xl border-3 rounded-xl bg-card"
          />
        </div>

        {/* Mobile */}
        <div className="space-y-2">
          <label className="text-xl font-bold text-foreground">Mobile Number</label>
          <Input
            type="tel"
            inputMode="tel"
            placeholder="Enter mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="h-16 text-xl border-3 rounded-xl bg-card"
          />
        </div>

        {/* Vehicle Number */}
        <div className="space-y-2">
          <label className="text-xl font-bold text-foreground">Vehicle Number *</label>
          <Input
            placeholder="MH 12 AB 1234"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
            className="h-16 text-xl border-3 rounded-xl bg-card"
          />
        </div>

        {/* Cement Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xl font-bold text-foreground">Cement Items *</label>
            {totalBags > 0 && (
              <span className="text-xl font-bold text-primary">Total: {totalBags} bags</span>
            )}
          </div>
          
          {cementItems.map((item, index) => (
            <div key={index} className="bg-card border-3 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-muted-foreground">Item {index + 1}</span>
                {cementItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => removeCementItem(index)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                )}
              </div>
              
              {/* Brand Selection */}
              <div className="grid grid-cols-3 gap-2">
                {brands.map((b) => (
                  <Button
                    key={b}
                    type="button"
                    variant={item.brand === b ? "default" : "outline"}
                    className={`h-14 text-base font-bold rounded-lg border-2 ${
                      item.brand === b 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-background"
                    }`}
                    onClick={() => updateCementItem(index, "brand", b)}
                  >
                    {BRAND_LABELS[b]}
                  </Button>
                ))}
              </div>
              
              {/* Bags Input */}
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Number of bags"
                value={item.bags}
                onChange={(e) => updateCementItem(index, "bags", e.target.value)}
                className="h-20 text-4xl text-center font-black border-2 rounded-xl bg-background"
              />
            </div>
          ))}
          
          <Button
            type="button"
            variant="outline"
            className="w-full h-16 text-lg font-bold border-3 border-dashed rounded-xl bg-card"
            onClick={addCementItem}
          >
            <Plus className="h-6 w-6 mr-2" />
            Add Another Cement Item
          </Button>
        </div>

        {/* Credit Sale Only: Signature & Photo */}
        {paymentType === "credit" && (
          <>
            <div className="space-y-3">
              <label className="text-xl font-bold text-foreground">Signature</label>
              <SignaturePad onSave={setSignature} />
              {signature && (
                <p className="text-lg text-accent font-semibold flex items-center gap-2">
                  <Check className="h-6 w-6" /> Signature captured
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-xl font-bold text-foreground">Vehicle Photo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoCapture}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full h-18 text-xl font-bold border-3 rounded-xl bg-card"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-7 w-7 mr-3" />
                {photo ? "Photo Captured" : "Capture Vehicle Photo"}
              </Button>
              {photo && (
                <img
                  src={photo}
                  alt="Vehicle"
                  className="w-full h-48 object-cover rounded-xl border-3"
                />
              )}
            </div>
          </>
        )}

        {/* Action Buttons */}
        {showWhatsApp ? (
          <div className="flex flex-col gap-4 mt-2">
            {/* Delivery Confirmation Receipt */}
            <div className="bg-card border-4 border-accent rounded-2xl overflow-hidden shadow-lg">
              <div className="bg-accent px-6 py-4">
                <h2 className="text-2xl font-black text-center text-accent-foreground">
                  Delivery Confirmed
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-lg text-muted-foreground font-medium">Customer</span>
                  <span className="text-xl font-bold text-foreground">{customer}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-lg text-muted-foreground font-medium">Vehicle No</span>
                  <span className="text-xl font-bold text-foreground">{vehicleNumber}</span>
                </div>
                
                {/* Items List */}
                <div className="py-2 border-b border-border">
                  <span className="text-lg text-muted-foreground font-medium">Items</span>
                  <div className="mt-2 space-y-1">
                    {validItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-lg">
                        <span className="text-foreground">{BRAND_LABELS[item.brand as CementBrand]}</span>
                        <span className="font-bold">{item.bags} bags</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between items-center py-3 bg-primary/10 rounded-xl px-4 -mx-2">
                  <span className="text-lg text-muted-foreground font-medium">Total Bags</span>
                  <span className="text-4xl font-black text-primary">{totalBags}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-lg text-muted-foreground font-medium">Date</span>
                  <span className="text-lg font-bold text-foreground">
                    {new Date().toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-lg text-muted-foreground font-medium">Time</span>
                  <span className="text-lg font-bold text-foreground">
                    {new Date().toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
            
            <Button
              className="w-full h-24 text-2xl font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg active:scale-[0.98] transition-transform"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="h-10 w-10 mr-3" />
              Send Confirmation on WhatsApp
            </Button>
            <Button
              variant="outline"
              className="w-full h-18 text-xl font-bold border-3 rounded-xl bg-card"
              onClick={resetForm}
            >
              New Sale
            </Button>
          </div>
        ) : (
          <Button
            className={`w-full h-24 text-2xl font-bold rounded-xl mt-4 shadow-lg active:scale-[0.98] transition-transform ${
              paymentType === "cash"
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-amber-600 hover:bg-amber-700 text-white"
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
              "Save Sale"
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
