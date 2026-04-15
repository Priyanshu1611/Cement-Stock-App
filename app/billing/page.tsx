"use client"

import { useEffect, useMemo, useState } from "react"
import type { CellHook } from "jspdf-autotable"
import { hasSupabaseEnv, supabase } from "@/lib/supabase-client"

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
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function BillingPage() {
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
      const { jsPDF } = await import("jspdf")
      const autoTableModule = await import("jspdf-autotable")
      const autoTable = autoTableModule.default as any

      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
      
      let displayDate = new Date().toLocaleDateString("en-IN")
      if (invoiceDate) {
        const [y, m, d] = invoiceDate.split("-")
        if (y && m && d) displayDate = `${d}/${m}/${y}`
      }

      const centerX = 105

      doc.setFont("helvetica", "normal").setFontSize(9)
      doc.text(`GSTIN: ${selectedFirm.gst}`, 14, 11)
      doc.text("** Shree Ganeshay Namah **", centerX, 11, { align: "center" })
      doc.text(`Mo. ${selectedFirm.firmMobile}`, 196, 11, { align: "right" })

      let y = 19
      doc.setFont("helvetica", "bold").setFontSize(22).text(selectedFirm.name, centerX, y, { align: "center" })
      y += 7

      doc.setFont("helvetica", "normal").setFontSize(9)
      const addressLines = doc.splitTextToSize(selectedFirm.address, 175)
      addressLines.forEach((line: string) => { doc.text(line, centerX, y, { align: "center" }); y += 4 })

      y += 1
      doc.setFont("helvetica", "bold").setFontSize(10).text(TAGLINE, centerX, y, { align: "center" })
      y += 5
      doc.setFont("helvetica", "normal").setFontSize(9).text(`Seller Mo. ${SHARED_FIRM_CONTACT}`, centerX, y, { align: "center" })
      y += 8

      doc.text(`Invoice No.: ${invoiceNo.trim() || "-"}`, 14, y)
      doc.text(`Date: ${displayDate}`, 196, y, { align: "right" })

      const custY = y + 7
      doc.setFontSize(10)
      const customerLine = `Mr./Ms.: ${customerName.trim() || "-"}`
      const nameLines = doc.splitTextToSize(customerLine, 125)
      let lineY = custY
      for (const line of nameLines) { doc.text(line, 14, lineY); lineY += 5.2 }
      
      if (customerGst.trim()) {
        doc.setFont("helvetica", "bold")
        doc.text(`Party GSTIN: ${customerGst.trim()}`, 14, lineY)
        doc.setFont("helvetica", "normal")
        lineY += 5.2
      }

      doc.text(`Customer Mo.: ${mobile.trim() || "-"}`, 196, custY, { align: "right" })

      const bodyRows: any[] = rows.map((row, index) => {
        const calc = calculations[index]
        const dispRate = currency(displayRatePerUnit(row, calc))
        return [
          String(index + 1), row.description || "-", row.hsnCode || "-", row.unit,
          currency(toNumber(row.quantity)), dispRate,
          currency(calc.amount), `${toNumber(row.gstPercent)}%`,
          currency(calc.cgst), currency(calc.sgst), currency(calc.total),
        ]
      })

      const MIN_ROWS_FOR_FULL_PAGE = 20
      const missingRows = MIN_ROWS_FOR_FULL_PAGE - bodyRows.length
      
      if (missingRows > 0) {
        for (let i = 0; i < missingRows; i++) {
          bodyRows.push(["", "", "", "", "", "", "", "", "", "", ""])
        }
      }

      autoTable(doc, {
        startY: lineY + 5,
        theme: "grid",
        head: [["S.No.", "Description", "HSN/SAC", "Unit", "Quantity", "Rate", "Taxable Amt", "GST %", "CGST", "SGST", "Final Amount"]],
        body: bodyRows,
        foot: [[
          { content: "Grand Total", colSpan: 10, styles: { halign: "right" } },
          { content: currency(totals.total), styles: { halign: "right" } },
        ]],
        styles: { font: "helvetica", fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
        footStyles: { fontStyle: "bold", fillColor: [245, 245, 245], lineWidth: 0.1 },
        // This is the magic hook to remove horizontal lines on empty rows
        didParseCell: (data: any) => {
          if (data.section === "body" && data.row.raw[0] === "") {
            // keep left/right borders, but remove top/bottom borders
            data.cell.styles.lineWidth = { top: 0, right: 0.1, bottom: 0, left: 0.1 }
          }
        }
      })

      const finalY = (doc as any).lastAutoTable?.finalY ?? lineY + 40
      doc.text("Seller Signature", 196, finalY + 14, { align: "right" })
      
      const blob = doc.output("blob")
      const blobUrl = URL.createObjectURL(blob)
      const fileName = `gst-invoice-${Date.now()}.pdf`
      
      setPreviewUrl(blobUrl)
      setPdfFile(new File([blob], fileName, { type: "application/pdf" }))
      setPdfFileName(fileName)

    } finally {
      setIsGeneratingPdf(false)
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
    
    const textMessage = `Hello ${customerName || ''}, please find your attached invoice. Total Amount: Rs. ${currency(totals.total)}`
    
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
          title: `Invoice - ${customerName || 'Customer'}`,
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
        </header>

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

        <section className="flex justify-end pb-8">
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
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
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