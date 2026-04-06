"use client"

import { useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"
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
  quantity: string
  rate: string
  gstPercent: string
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

const CUSTOMER_CACHE_KEY = "billing-customer-names"
const DESCRIPTION_CACHE_KEY = "billing-item-descriptions"

const createRow = (): ItemRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  description: "",
  quantity: "",
  rate: "",
  gstPercent: "18",
})

const toNumber = (value: string): number => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const currency = (value: number): string => value.toFixed(2)

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

const calculateItem = (item: ItemRow): CalculatedItem => {
  const quantity = toNumber(item.quantity)
  const rate = toNumber(item.rate)
  const gstPercent = toNumber(item.gstPercent)
  const amount = quantity * rate
  const gst = (amount * gstPercent) / 100
  const cgst = gst / 2
  const sgst = gst / 2
  const total = amount + gst
  return { amount, gst, cgst, sgst, total }
}

export default function BillingPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [firmName, setFirmName] = useState(firms[0].name)
  const [invoiceNo, setInvoiceNo] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [mobile, setMobile] = useState("")
  const [rows, setRows] = useState<ItemRow[]>([createRow()])
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([])
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([])
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  useEffect(() => {
    const cachedCustomers = localStorage.getItem(CUSTOMER_CACHE_KEY)
    if (cachedCustomers) {
      try {
        setCustomerSuggestions(JSON.parse(cachedCustomers) as string[])
      } catch {
        setCustomerSuggestions([])
      }
    }

    const cachedDescriptions = localStorage.getItem(DESCRIPTION_CACHE_KEY)
    if (cachedDescriptions) {
      try {
        setDescriptionSuggestions(JSON.parse(cachedDescriptions) as string[])
      } catch {
        setDescriptionSuggestions([])
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      if (!supabase) {
        setAuthLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (mounted) {
        setSession(data.session)
        setAuthLoading(false)
      }
    }

    loadSession()

    if (!supabase) {
      return () => {
        mounted = false
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession)
        setAuthLoading(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const selectedFirm = useMemo(
    () => firms.find((firm) => firm.name === firmName) ?? firms[0],
    [firmName],
  )

  const calculations = useMemo(() => rows.map((row) => calculateItem(row)), [rows])

  const grandTotal = useMemo(
    () => calculations.reduce((sum, item) => sum + item.total, 0),
    [calculations],
  )

  const persistSuggestions = (nameInput?: string, descriptionInputs?: string[]) => {
    if (typeof window === "undefined") return

    if (nameInput && nameInput.trim()) {
      const next = Array.from(new Set([nameInput.trim(), ...customerSuggestions])).slice(0, 50)
      setCustomerSuggestions(next)
      localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify(next))
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
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)))
  }

  const addItem = () => setRows((prev) => [...prev, createRow()])

  const removeItem = (id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev))
  }

  const loginWithGoogle = async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/billing`,
      },
    })
  }

  const logout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const generatePdf = async () => {
    persistSuggestions(customerName, rows.map((row) => row.description))
    setIsGeneratingPdf(true)
    try {
      const { jsPDF } = await import("jspdf")
      const autoTableModule = await import("jspdf-autotable")
      const autoTable = autoTableModule.default as (
        doc: InstanceType<typeof jsPDF>,
        options: Record<string, unknown>,
      ) => void

      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
      const invoiceDate = new Date().toLocaleDateString("en-IN")

      const centerX = 105

      // Row 1: GSTIN | invocation | firm phones
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.text(`GSTIN: ${selectedFirm.gst}`, 14, 11)
      doc.text("** Shree Ganeshay Namah **", centerX, 11, { align: "center" })
      doc.text(`Mo. ${selectedFirm.firmMobile}`, 196, 11, { align: "right" })

      // Firm name + address + tagline
      let y = 18
      doc.setFont("helvetica", "bold")
      doc.setFontSize(15)
      doc.text(selectedFirm.name, centerX, y, { align: "center" })
      y += 6

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      const addressLines = doc.splitTextToSize(selectedFirm.address, 175)
      addressLines.forEach((line: string) => {
        doc.text(line, centerX, y, { align: "center" })
        y += 4
      })

      y += 1
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text(TAGLINE, centerX, y, { align: "center" })
      y += 5
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.text(`Seller Mo. ${SHARED_FIRM_CONTACT}`, centerX, y, { align: "center" })
      y += 8

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.text(`Invoice No.: ${invoiceNo.trim() || "-"}`, 14, y)
      doc.text(`Date: ${invoiceDate}`, 196, y, { align: "right" })

      const metaY = y
      const custY = metaY + 7
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      const customerLine = `Mr./Ms.: ${customerName.trim() || "-"}`
      const nameLines = doc.splitTextToSize(customerLine, 125)
      let lineY = custY
      for (const line of nameLines) {
        doc.text(line, 14, lineY)
        lineY += 5.2
      }
      doc.text(`Customer Mo.: ${mobile.trim() || "-"}`, 196, custY, { align: "right" })

      const tableTopY = lineY + 5

      const bodyRows = rows.map((row, index) => [
        String(index + 1),
        row.description || "-",
        currency(toNumber(row.quantity)),
        currency(toNumber(row.rate)),
        currency(calculations[index].amount),
        `${currency(toNumber(row.gstPercent))}%`,
        currency(calculations[index].cgst),
        currency(calculations[index].sgst),
        currency(calculations[index].total),
      ])

      autoTable(doc, {
        startY: tableTopY,
        theme: "grid",
        head: [
          [
            "S.No.",
            "Description",
            "Qty",
            "Rate",
            "Taxable Amt",
            "GST %",
            "CGST",
            "SGST",
            "Amount",
          ],
        ],
        body: bodyRows,
        foot: [
          [
            {
              content: "Grand Total",
              colSpan: 8,
              styles: { halign: "right", fillColor: [245, 245, 245] },
            },
            {
              content: currency(grandTotal),
              styles: { halign: "right", fillColor: [245, 245, 245] },
            },
          ],
        ],
        styles: {
          font: "helvetica",
          fontSize: 8,
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          textColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          font: "helvetica",
          fontStyle: "bold",
        },
        footStyles: {
          font: "helvetica",
          fontStyle: "bold",
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { halign: "left", cellWidth: 46 },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
          7: { halign: "right" },
          8: { halign: "right" },
        },
      })

      const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? custY + 40
      const signatureY = finalY + 14
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text("Seller Signature", 196, signatureY, { align: "right" })

      doc.save(`gst-invoice-${Date.now()}.pdf`)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  if (!hasSupabaseEnv) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-3xl rounded-xl border bg-card p-6">
          <h1 className="text-2xl font-bold">Billing Setup Required</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and either{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> or{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY</code> in your environment, then enable Google
            provider in Supabase Auth.
          </p>
        </div>
      </main>
    )
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl rounded-xl border bg-card p-6 text-lg">Checking login...</div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-xl rounded-xl border bg-card p-8 text-center">
          <h1 className="text-3xl font-bold">GST Billing</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Sign in with Google to access the billing page.
          </p>
          <button
            type="button"
            onClick={loginWithGoogle}
            className="mt-6 w-full rounded-lg bg-primary px-4 py-4 text-lg font-semibold text-primary-foreground"
          >
            Login with Google
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-3 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">GST Billing</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-secondary px-3 py-2 text-sm md:text-base">{session.user.email}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted md:text-base"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Billing Details</h2>
          <div className="mb-4 rounded-lg border bg-muted/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">** Shree Ganeshay Namah **</p>
            <p className="mt-1 text-2xl font-bold leading-tight md:text-3xl">{selectedFirm.name}</p>
            <p className="mt-2 text-sm text-muted-foreground">GSTIN: {selectedFirm.gst}</p>
            <p className="mt-1 text-base">Seller Mo. {selectedFirm.firmMobile}</p>
            <p className="mt-2 text-sm leading-snug md:text-base">{selectedFirm.address}</p>
            <p className="mt-2 text-base font-medium">{selectedFirm.tagline}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">Firm</span>
              <select
                className="w-full rounded-md border bg-background px-3 py-3 text-lg"
                value={firmName}
                onChange={(event) => setFirmName(event.target.value)}
              >
                {firms.map((firm) => (
                  <option key={firm.name} value={firm.name}>
                    {firm.name} ({firm.gst})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Invoice No. (optional)</span>
              <input
                value={invoiceNo}
                onChange={(event) => setInvoiceNo(event.target.value)}
                placeholder="e.g. 4521"
                className="w-full rounded-md border bg-background px-3 py-3 text-lg"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Customer Name</span>
              <input
                list="customer-suggestions"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                onBlur={() => persistSuggestions(customerName)}
                placeholder="Enter customer name"
                className="w-full rounded-md border bg-background px-3 py-3 text-lg"
              />
              <datalist id="customer-suggestions">
                {customerSuggestions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Mobile No.</span>
              <input
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                placeholder="Enter mobile number"
                className="w-full rounded-md border bg-background px-3 py-3 text-lg"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground md:text-base"
            >
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id} className="rounded-lg border p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  <label className="space-y-1 md:col-span-4">
                    <span className="text-xs font-medium">Description</span>
                    <input
                      list="description-suggestions"
                      value={row.description}
                      onChange={(event) => updateRow(row.id, "description", event.target.value)}
                      onBlur={() => persistSuggestions(undefined, [row.description])}
                      placeholder="Product description"
                      className="w-full rounded-md border bg-background px-3 py-3 text-lg"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium">Quantity</span>
                    <input
                      value={row.quantity}
                      onChange={(event) => updateRow(row.id, "quantity", event.target.value)}
                      placeholder="0"
                      inputMode="decimal"
                      className="w-full rounded-md border bg-background px-3 py-3 text-lg"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium">Rate</span>
                    <input
                      value={row.rate}
                      onChange={(event) => updateRow(row.id, "rate", event.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="w-full rounded-md border bg-background px-3 py-3 text-lg"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium">GST %</span>
                    <input
                      value={row.gstPercent}
                      onChange={(event) => updateRow(row.id, "gstPercent", event.target.value)}
                      placeholder="18"
                      inputMode="decimal"
                      className="w-full rounded-md border bg-background px-3 py-3 text-lg"
                    />
                  </label>
                  <div className="flex items-end md:col-span-2">
                    <button
                      type="button"
                      onClick={() => removeItem(row.id)}
                      disabled={rows.length === 1}
                      className="w-full rounded-md border px-3 py-3 text-base disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Item #{index + 1}</p>
              </div>
            ))}
            <datalist id="description-suggestions">
              {descriptionSuggestions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">GST Calculation Table</h2>
          <div className="overflow-auto">
            <table className="min-w-full border-collapse border text-sm md:text-base">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-1 py-2 text-center text-xs md:px-2 md:text-sm">S.No.</th>
                  <th className="border px-1 py-2 text-left text-xs md:px-2 md:text-sm">Description</th>
                  <th className="border px-1 py-2 text-right text-xs md:px-2 md:text-sm">Qty</th>
                  <th className="border px-1 py-2 text-right text-xs md:px-2 md:text-sm">Rate</th>
                  <th className="border px-1 py-2 text-right text-xs md:px-2 md:text-sm">Taxable Amt</th>
                  <th className="border px-1 py-2 text-right text-xs md:px-2 md:text-sm">GST %</th>
                  <th className="border px-1 py-2 text-right text-xs md:px-2 md:text-sm">CGST</th>
                  <th className="border px-1 py-2 text-right text-xs md:px-2 md:text-sm">SGST</th>
                  <th className="border px-1 py-2 text-right text-xs md:px-2 md:text-sm">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="border px-2 py-2 text-center">{index + 1}</td>
                    <td className="border px-2 py-2">{row.description || "-"}</td>
                    <td className="border px-2 py-2 text-right">{currency(toNumber(row.quantity))}</td>
                    <td className="border px-2 py-2 text-right">{currency(toNumber(row.rate))}</td>
                    <td className="border px-2 py-2 text-right">{currency(calculations[index].amount)}</td>
                    <td className="border px-2 py-2 text-right">{currency(toNumber(row.gstPercent))}</td>
                    <td className="border px-2 py-2 text-right">{currency(calculations[index].cgst)}</td>
                    <td className="border px-2 py-2 text-right">{currency(calculations[index].sgst)}</td>
                    <td className="border px-2 py-2 text-right font-semibold">{currency(calculations[index].total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted px-4 py-3">
            <span className="text-lg font-semibold">Grand Total</span>
            <span className="text-2xl font-bold">{currency(grandTotal)}</span>
          </div>
        </section>

        <section className="flex justify-end pb-8">
          <button
            type="button"
            onClick={generatePdf}
            disabled={isGeneratingPdf}
            className="rounded-md bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-50"
          >
            {isGeneratingPdf ? "Generating..." : "Generate PDF"}
          </button>
        </section>
      </div>
    </main>
    // added test comment
  )
}