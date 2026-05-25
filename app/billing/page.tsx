"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { hasSupabaseEnv } from "@/lib/supabase-client"
import { saveBillingInvoice, searchInvoices, type InvoiceSearchResult } from "@/lib/billing-actions"
import { generateInvoicePdf } from "@/lib/generate-invoice-pdf"

type Firm = {
  name: string
  gst: string
  firmMobile: string
  address: string
  tagline: string
}

type ItemRow = {
  id: string
  description: string
  hsnCode: string
  unit: string
  quantity: string
  rate: string
  gstPercent: string
  gstType: "+" | "-"
}

type CalculatedItem = {
  amount: number
  gst: number
  cgst: number
  sgst: number
  total: number
}

const SHARED_FIRM_CONTACT = "9425461119, 8770328909"
const SHARED_ADDRESS = "Damua/Chhindwara, District-Chhindwara (M.P.) 480555"
const TAGLINE = "Cement & Building Material Seller"

const firms: Firm[] = [
  {
    name: "Pravin Enterprises",
    gst: "23ALJPK7162P1ZL",
    firmMobile: SHARED_FIRM_CONTACT,
    address: SHARED_ADDRESS,
    tagline: TAGLINE,
  },
  {
    name: "Cement Traders",
    gst: "23AKKPK0262A1ZU",
    firmMobile: SHARED_FIRM_CONTACT,
    address: SHARED_ADDRESS,
    tagline: TAGLINE,
  },
]

const HSN_OPTIONS = [
  { code: "2523", label: "Cement (HSN)" },
  { code: "2517", label: "Stone / Aggregate (HSN)" },
  { code: "2505", label: "Sand (HSN)" },
  { code: "2710", label: "Diesel (HSN)" },
  { code: "9965", label: "Transport Service (SAC)" },
  { code: "9986", label: "Labour / Machinery (SAC)" },
]

const UNIT_OPTIONS = [
  "Bags", "Pieces", "Kg", "Ton", "Cubic Meter", "Cubic Feet",
  "Liters", "Meters", "Square Feet", "Hours", "Trips",
]

const CUSTOMER_CACHE_KEY = "billing-customer-names"
const DESCRIPTION_CACHE_KEY = "billing-item-descriptions"
const CUSTOMER_GST_CACHE_KEY = "billing-customer-gst"

const createRow = (): ItemRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  description: "",
  hsnCode: "",
  unit: "Bags",
  quantity: "",
  rate: "",
  gstPercent: "18",
  gstType: "+",
})

const toNumber = (value: string): number => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const currency = (value: number): string => value.toFixed(2)

const displayRatePerUnit = (item: ItemRow, calc: CalculatedItem): number => {
  const qty = toNumber(item.quantity)
  if (qty === 0) return 0
  return item.gstType === "+" ? calc.total / qty : calc.amount / qty
}

const calculateItem = (item: ItemRow): CalculatedItem => {
  const quantity = toNumber(item.quantity)
  const rate = toNumber(item.rate)
  const gstPercent = toNumber(item.gstPercent)
  const baseAmount = quantity * rate

  let taxable = 0
  let gstAmount = 0

  if (item.gstType === "+") {
    taxable = baseAmount
    gstAmount = taxable * (gstPercent / 100)
  } else {
    taxable = baseAmount / (1 + gstPercent / 100)
    gstAmount = baseAmount - taxable
  }

  const cgst = gstAmount / 2
  const sgst = gstAmount / 2
  const total = taxable + cgst + sgst

  return { amount: taxable, gst: gstAmount, cgst, sgst, total }
}

const getTodayYMD = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function BillingPage() {
  const router = useRouter()

  const [firmName, setFirmName] = useState(firms[0].name)
  const [invoiceNo, setInvoiceNo] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(getTodayYMD())
  const [customerName, setCustomerName] = useState("")
  const [mobile, setMobile] = useState("")
  const [customerGst, setCustomerGst] = useState("")
  const [rows, setRows] = useState<ItemRow[]>([createRow()])

  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([])
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([])
  const [customerGstSuggestions, setCustomerGstSuggestions] = useState<string[]>([])

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfFileName, setPdfFileName] = useState<string>("")

  // Save state
  const [isSaving, setIsSaving] = useState(false)

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInvoiceNo, setSearchInvoiceNo] = useState("")
  const [searchCustomer, setSearchCustomer] = useState("")
  const [searchDateFrom, setSearchDateFrom] = useState("")
  const [searchDateTo, setSearchDateTo] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<InvoiceSearchResult[] | null>(null)

  useEffect(() => {
    const cachedCustomers = localStorage.getItem(CUSTOMER_CACHE_KEY)
    if (cachedCustomers) {
      try { setCustomerSuggestions(JSON.parse(cachedCustomers) as string[]) } catch { setCustomerSuggestions([]) }
    }
    const cachedDescriptions = localStorage.getItem(DESCRIPTION_CACHE_KEY)
    if (cachedDescriptions) {
      try { setDescriptionSuggestions(JSON.parse(cachedDescriptions) as string[]) } catch { setDescriptionSuggestions([]) }
    }
    const cachedGsts = localStorage.getItem(CUSTOMER_GST_CACHE_KEY)
    if (cachedGsts) {
      try { setCustomerGstSuggestions(JSON.parse(cachedGsts) as string[]) } catch { setCustomerGstSuggestions([]) }
    }
  }, [])

  const selectedFirm = useMemo(() => firms.find((firm) => firm.name === firmName) ?? firms[0], [firmName])
  const calculations = useMemo(() => rows.map((row) => calculateItem(row)), [rows])

  const totals = useMemo(() => {
    return calculations.reduce(
      (acc, item) => ({ total: acc.total + item.total }),
      { total: 0 }
    )
  }, [calculations])

  const persistSuggestions = (nameInput?: string, descriptionInputs?: string[], gstInput?: string) => {
    if (typeof window === "undefined") return
    if (nameInput?.trim()) {
      const next = Array.from(new Set([nameInput.trim(), ...customerSuggestions])).slice(0, 50)
      setCustomerSuggestions(next)
      localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify(next))
    }
    if (gstInput?.trim()) {
      const nextGst = Array.from(new Set([gstInput.trim(), ...customerGstSuggestions])).slice(0, 50)
      setCustomerGstSuggestions(nextGst)
      localStorage.setItem(CUSTOMER_GST_CACHE_KEY, JSON.stringify(nextGst))
    }
    if (descriptionInputs && descriptionInputs.length > 0) {
      const clean = descriptionInputs.map((value) => value.trim()).filter(Boolean)
      if (clean.length > 0) {
        const next = Array.from(new Set([...clean, ...descriptionSuggestions])).slice(0, 100)
        setDescriptionSuggestions(next)
        localStorage.setItem(DESCRIPTION_CACHE_KEY, JSON.stringify(next))
      }
    }
  }

  const updateRow = (id: string, key: keyof ItemRow, value: string) => {
    setRows((prev) => prev.map((row) => {
      if (row.id !== id) return row
      const updated = { ...row, [key]: value }
      if (key === "description" || key === "hsnCode") {
        const valLower = value.toLowerCase()
        if (valLower.includes("cement") || valLower.includes("2523")) updated.unit = "Bags"
        else if (valLower.includes("transport") || valLower.includes("9965")) updated.unit = "Trips"
      }
      return updated
    }))
  }

  const generatePdf = async () => {
    persistSuggestions(customerName, rows.map((row) => row.description), customerGst)
    setIsGeneratingPdf(true)
    try {
      const result = await generateInvoicePdf({
        firm: selectedFirm,
        invoiceNo,
        invoiceDate,
        customerName,
        mobile,
        customerGst,
        items: rows,
      })
      setPreviewUrl(result.blobUrl)
      setPdfFile(result.file)
      setPdfFileName(result.fileName)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handleSave = async () => {
    if (!customerName.trim()) {
      toast.error("Enter customer name before saving")
      return
    }
    setIsSaving(true)
    try {
      const id = await saveBillingInvoice({
        firmName,
        invoiceNumber: invoiceNo,
        invoiceDate,
        customerName,
        customerMobile: mobile,
        customerGst,
        grandTotal: totals.total,
        items: rows.map((row, idx) => ({
          description: row.description,
          hsnCode: row.hsnCode,
          unit: row.unit,
          quantity: row.quantity,
          rate: row.rate,
          gstPercent: row.gstPercent,
          gstType: row.gstType,
          taxableAmount: calculations[idx].amount,
          cgst: calculations[idx].cgst,
          sgst: calculations[idx].sgst,
          totalAmount: calculations[idx].total,
        })),
      })
      persistSuggestions(customerName, rows.map((r) => r.description), customerGst)
      toast.success(`Invoice saved (ID: ${id})`)
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message ?? "Unknown error"}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSearch = async () => {
    if (!searchInvoiceNo.trim() && !searchCustomer.trim() && !searchDateFrom.trim() && !searchDateTo.trim()) {
      toast.error("Enter at least one search field")
      return
    }
    setIsSearching(true)
    try {
      const results = await searchInvoices({
        invoiceNumber: searchInvoiceNo,
        customerName: searchCustomer,
        dateFrom: searchDateFrom,
        dateTo: searchDateTo,
      })
      setSearchResults(results)
      if (results.length === 0) toast.info("No invoices found")
    } catch (err: any) {
      toast.error(`Search failed: ${err?.message ?? "Unknown error"}`)
    } finally {
      setIsSearching(false)
    }
  }

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPdfFile(null)
  }

  const downloadPdf = () => {
    if (!previewUrl) return
    const link = document.createElement("a")
    link.href = previewUrl
    link.download = pdfFileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const shareViaWhatsApp = async () => {
    if (!pdfFile) return

    const textMessage = `Hello ${customerName || ""}, please find your attached invoice. Total Amount: Rs. ${currency(totals.total)}`

    const executeFallback = () => {
      alert("Native file sharing is unavailable. The invoice will download now, and WhatsApp will open so you can attach it manually.")
      downloadPdf()
      const phoneStr = mobile.replace(/\D/g, "")
      const encodedText = encodeURIComponent(textMessage)
      window.open(`https://wa.me/${phoneStr}?text=${encodedText}`, "_blank")
    }

    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `Invoice - ${customerName || "Customer"}`,
          text: textMessage,
        })
      } catch (error: any) {
        console.error("Error sharing:", error)
        if (error.name !== "AbortError") {
          executeFallback()
        }
      }
    } else {
      executeFallback()
    }
  }

  return (
    <main className="min-h-screen relative bg-background p-3 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">GST Billing</h1>
          {hasSupabaseEnv && (
            <button
              type="button"
              onClick={() => { setSearchOpen((v) => !v); setSearchResults(null) }}
              className="rounded-md border bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"
            >
              {searchOpen ? "Close Search" : "Search Bills"}
            </button>
          )}
        </header>

        {/* Search Panel */}
        {hasSupabaseEnv && searchOpen && (
          <section className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="text-lg font-semibold">Search Bills</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-sm font-medium">Invoice Number</span>
                <input
                  value={searchInvoiceNo}
                  onChange={(e) => setSearchInvoiceNo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="e.g. 4521"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Customer Name</span>
                <input
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Customer name"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">From Date</span>
                <input
                  type="date"
                  value={searchDateFrom}
                  onChange={(e) => setSearchDateFrom(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">To Date</span>
                <input
                  type="date"
                  value={searchDateTo}
                  onChange={(e) => setSearchDateTo(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching}
                className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
              {searchResults !== null && (
                <button
                  type="button"
                  onClick={() => setSearchResults(null)}
                  className="rounded-md border px-4 py-2 text-sm font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            {searchResults !== null && searchResults.length > 0 && (
              <div className="overflow-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">ID</th>
                      <th className="px-3 py-2 text-left font-medium">Invoice No.</th>
                      <th className="px-3 py-2 text-left font-medium">Customer</th>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Firm</th>
                      <th className="px-3 py-2 text-right font-medium">Total (₹)</th>
                      <th className="px-3 py-2 text-center font-medium">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-t hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/billing/view?id=${inv.id}`)}
                      >
                        <td className="px-3 py-2 text-muted-foreground">#{inv.id}</td>
                        <td className="px-3 py-2">{inv.invoice_number ?? "-"}</td>
                        <td className="px-3 py-2 font-medium">{inv.customer_name}</td>
                        <td className="px-3 py-2">{inv.invoice_date}</td>
                        <td className="px-3 py-2 text-muted-foreground">{inv.firm_name}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {Number(inv.grand_total).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Open →</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {searchResults !== null && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground">No bills found for given criteria.</p>
            )}
          </section>
        )}

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Billing Details</h2>
          <div className="mb-4 rounded-lg border bg-muted/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">** Shree Ganeshay Namah **</p>
            <p className="mt-1 text-3xl font-bold leading-tight md:text-4xl">{selectedFirm.name}</p>
            <p className="mt-2 text-sm text-muted-foreground">GSTIN: {selectedFirm.gst}</p>
            <p className="mt-1 text-base">Seller Mo. {selectedFirm.firmMobile}</p>
            <p className="mt-2 text-sm leading-snug md:text-base">{selectedFirm.address}</p>
            <p className="mt-2 text-base font-medium">{selectedFirm.tagline}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Firm</span>
              <select className="w-full rounded-md border bg-background px-3 py-3 text-lg" value={firmName} onChange={(e) => setFirmName(e.target.value)}>
                {firms.map((f) => <option key={f.name} value={f.name}>{f.name} ({f.gst})</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Invoice No.</span>
              <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. 4521" className="w-full rounded-md border bg-background px-3 py-3 text-lg" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Date</span>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full rounded-md border bg-background px-3 py-3 text-lg" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Customer Name</span>
              <input list="customer-suggestions" value={customerName} onChange={(e) => setCustomerName(e.target.value)} onBlur={() => persistSuggestions(customerName)} placeholder="Enter customer name" className="w-full rounded-md border bg-background px-3 py-3 text-lg" />
              <datalist id="customer-suggestions">{customerSuggestions.map((v) => <option key={v} value={v} />)}</datalist>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Mobile No.</span>
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Enter mobile number" className="w-full rounded-md border bg-background px-3 py-3 text-lg" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Customer GST</span>
              <input list="customer-gst-suggestions" value={customerGst} onChange={(e) => setCustomerGst(e.target.value)} onBlur={() => persistSuggestions(undefined, undefined, customerGst)} placeholder="Enter GSTIN" className="w-full rounded-md border bg-background px-3 py-3 text-lg" />
              <datalist id="customer-gst-suggestions">{customerGstSuggestions.map((v) => <option key={v} value={v} />)}</datalist>
            </label>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Items</h2>
            <button type="button" onClick={() => setRows([...rows, createRow()])} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add Item</button>
          </div>
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id} className="rounded-lg border p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                  <label className="space-y-1 md:col-span-3">
                    <span className="text-xs font-medium">Description</span>
                    <input list="description-suggestions" value={row.description} onChange={(e) => updateRow(row.id, "description", e.target.value)} onBlur={() => persistSuggestions(undefined, [row.description])} className="w-full rounded-md border bg-background px-2 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium">HSN / SAC</span>
                    <input list="hsn-suggestions" value={row.hsnCode} onChange={(e) => updateRow(row.id, "hsnCode", e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 md:col-span-1">
                    <span className="text-xs font-medium">Unit</span>
                    <input list="unit-list" value={row.unit} onChange={(e) => updateRow(row.id, "unit", e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm" placeholder="Unit" />
                  </label>
                  <label className="space-y-1 md:col-span-1">
                    <span className="text-xs font-medium">Qty</span>
                    <input value={row.quantity} onChange={(e) => updateRow(row.id, "quantity", e.target.value)} inputMode="decimal" className="w-full rounded-md border bg-background px-2 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 md:col-span-1">
                    <span className="text-xs font-medium">Rate</span>
                    <input value={row.rate} onChange={(e) => updateRow(row.id, "rate", e.target.value)} inputMode="decimal" className="w-full rounded-md border bg-background px-2 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 md:col-span-1">
                    <span className="text-xs font-medium">GST%</span>
                    <input value={row.gstPercent} onChange={(e) => updateRow(row.id, "gstPercent", e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium">Type</span>
                    <select value={row.gstType} onChange={(e) => updateRow(row.id, "gstType", e.target.value as "+" | "-")} className="w-full rounded-md border bg-background px-2 py-2 text-sm">
                      <option value="+">+ GST</option>
                      <option value="-">- GST</option>
                    </select>
                  </label>
                  <div className="flex items-end md:col-span-1">
                    <button type="button" onClick={() => setRows(rows.filter((r) => r.id !== row.id))} disabled={rows.length === 1} className="w-full rounded-md border px-2 py-2 text-sm font-medium">Remove</button>
                  </div>
                </div>
              </div>
            ))}
            <datalist id="unit-list">{UNIT_OPTIONS.map(u => <option key={u} value={u} />)}</datalist>
            <datalist id="description-suggestions">{descriptionSuggestions.map(v => <option key={v} value={v} />)}</datalist>
            <datalist id="hsn-suggestions">{HSN_OPTIONS.map(opt => <option key={opt.code} value={opt.code}>{opt.label}</option>)}</datalist>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">GST Calculation Table</h2>
          <div className="overflow-auto">
            <table className="min-w-full border-collapse border text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-1 py-2 text-center">S.No.</th>
                  <th className="border px-1 py-2 text-left">Description</th>
                  <th className="border px-1 py-2 text-right">Qty</th>
                  <th className="border px-1 py-2 text-right">Rate</th>
                  <th className="border px-1 py-2 text-right">Taxable Amt</th>
                  <th className="border px-1 py-2 text-right">GST %</th>
                  <th className="border px-1 py-2 text-right">CGST</th>
                  <th className="border px-1 py-2 text-right">SGST</th>
                  <th className="border px-1 py-2 text-right">Final Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const calc = calculations[index]
                  const dispRate = displayRatePerUnit(row, calc)
                  return (
                    <tr key={row.id}>
                      <td className="border px-2 py-2 text-center">{index + 1}</td>
                      <td className="border px-2 py-2">{row.description || "-"}</td>
                      <td className="border px-2 py-2 text-right">{currency(toNumber(row.quantity))}</td>
                      <td className="border px-2 py-2 text-right">{currency(dispRate)}</td>
                      <td className="border px-2 py-2 text-right">{currency(calc.amount)}</td>
                      <td className="border px-2 py-2 text-right">{toNumber(row.gstPercent)}%</td>
                      <td className="border px-2 py-2 text-right">{currency(calc.cgst)}</td>
                      <td className="border px-2 py-2 text-right">{currency(calc.sgst)}</td>
                      <td className="border px-2 py-2 text-right font-semibold">{currency(calc.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col items-end justify-center rounded bg-muted p-4">
            <span className="text-sm font-bold">Grand Total</span>
            <span className="text-2xl font-bold">{currency(totals.total)}</span>
          </div>
        </section>

        <section className="flex justify-end gap-3 pb-8">
          {hasSupabaseEnv && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md border bg-secondary px-6 py-3 text-lg font-semibold text-secondary-foreground disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Invoice"}
            </button>
          )}
          <button type="button" onClick={generatePdf} disabled={isGeneratingPdf} className="rounded-md bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground">
            {isGeneratingPdf ? "Generating..." : "Preview PDF"}
          </button>
        </section>
      </div>

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 p-2 backdrop-blur-sm md:p-6">
          <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-xl font-bold">Invoice Preview</h3>
              <button onClick={closePreview} className="rounded-md border bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80">
                Close
              </button>
            </div>

            <div className="flex-1 bg-muted/30 p-2 md:p-4">
              <iframe
                src={previewUrl}
                className="h-full w-full rounded border bg-white shadow-sm"
                title="PDF Preview"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t p-4">
              <button
                onClick={downloadPdf}
                className="rounded-md border bg-secondary px-5 py-2 font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                Download PDF
              </button>
              <button
                onClick={shareViaWhatsApp}
                className="flex items-center gap-2 rounded-md bg-[#25D366] px-5 py-2 font-medium text-white hover:bg-[#20b858] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                Share via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
