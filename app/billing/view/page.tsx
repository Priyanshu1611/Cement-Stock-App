"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getInvoiceById, type InvoiceDetail, type InvoiceItemDetail } from "@/lib/billing-actions"
import { generateInvoicePdf } from "@/lib/generate-invoice-pdf"

const SHARED_FIRM_CONTACT = "9425461119, 8770328909"
const SHARED_ADDRESS = "Damua/Chhindwara, District-Chhindwara (M.P.) 480555"
const TAGLINE = "Cement & Building Material Seller"

const FIRMS: Record<string, { gst: string; firmMobile: string; address: string; tagline: string }> = {
  "Pravin Enterprises": {
    gst: "23ALJPK7162P1ZL",
    firmMobile: SHARED_FIRM_CONTACT,
    address: SHARED_ADDRESS,
    tagline: TAGLINE,
  },
  "Cement Traders": {
    gst: "23AKKPK0262A1ZU",
    firmMobile: SHARED_FIRM_CONTACT,
    address: SHARED_ADDRESS,
    tagline: TAGLINE,
  },
}

const currency = (value: number | string): string => Number(value).toFixed(2)

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "-"
  const [y, m, d] = dateStr.split("T")[0].split("-")
  return y && m && d ? `${d}/${m}/${y}` : dateStr
}

function InvoiceView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = Number(searchParams.get("id"))

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [items, setItems] = useState<InvoiceItemDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfFileName, setPdfFileName] = useState<string>("")

  useEffect(() => {
    if (!id || isNaN(id)) {
      setError("Invalid invoice ID")
      setLoading(false)
      return
    }
    getInvoiceById(id)
      .then(({ invoice, items }) => {
        setInvoice(invoice)
        setItems(items)
      })
      .catch((err) => setError(err?.message ?? "Failed to load invoice"))
      .finally(() => setLoading(false))
  }, [id])

  const grandTotal = items.reduce((acc, item) => acc + Number(item.total_amount), 0)

  const handleGeneratePdf = async () => {
    if (!invoice) return
    setIsGeneratingPdf(true)
    try {
      const firm = FIRMS[invoice.firm_name] ?? {
        gst: "",
        firmMobile: SHARED_FIRM_CONTACT,
        address: SHARED_ADDRESS,
        tagline: TAGLINE,
      }
      const result = await generateInvoicePdf({
        firm: { name: invoice.firm_name, ...firm },
        invoiceNo: invoice.invoice_number ?? "",
        invoiceDate: invoice.invoice_date?.split("T")[0] ?? "",
        customerName: invoice.customer_name,
        mobile: invoice.customer_mobile ?? "",
        customerGst: invoice.customer_gst ?? "",
        items: items.map((item) => ({
          description: item.description ?? "",
          hsnCode: item.hsn_code ?? "",
          unit: item.unit ?? "Bags",
          quantity: String(item.quantity),
          rate: String(item.rate),
          gstPercent: String(item.gst_percent),
          gstType: item.gst_type,
        })),
      })
      setPreviewUrl(result.blobUrl)
      setPdfFile(result.file)
      setPdfFileName(result.fileName)
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
    if (!pdfFile || !invoice) return
    const textMessage = `Hello ${invoice.customer_name}, please find your attached invoice. Total Amount: Rs. ${currency(grandTotal)}`
    const executeFallback = () => {
      alert("Native file sharing unavailable. Invoice will download and WhatsApp will open.")
      downloadPdf()
      const phoneStr = (invoice.customer_mobile ?? "").replace(/\D/g, "")
      window.open(`https://wa.me/${phoneStr}?text=${encodeURIComponent(textMessage)}`, "_blank")
    }
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({ files: [pdfFile], title: `Invoice - ${invoice.customer_name}`, text: textMessage })
      } catch (err: any) {
        if (err.name !== "AbortError") executeFallback()
      }
    } else {
      executeFallback()
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading invoice...</p>
      </main>
    )
  }

  if (error || !invoice) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <p className="text-destructive">{error ?? "Invoice not found"}</p>
        <button onClick={() => router.push("/billing")} className="rounded-md border px-4 py-2 text-sm">
          ← Back to Billing
        </button>
      </main>
    )
  }

  const firm = FIRMS[invoice.firm_name]

  return (
    <main className="min-h-screen bg-background p-3 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">

        <header className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/billing")}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold">Invoice #{invoice.id}</h1>
            <span className="rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Read-only
            </span>
          </div>
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
            className="rounded-md bg-primary px-6 py-2.5 text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isGeneratingPdf ? "Generating..." : "Generate PDF"}
          </button>
        </header>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-4 rounded-lg border bg-muted/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">** Shree Ganeshay Namah **</p>
            <p className="mt-1 text-3xl font-bold leading-tight md:text-4xl">{invoice.firm_name}</p>
            {firm && (
              <>
                <p className="mt-2 text-sm text-muted-foreground">GSTIN: {firm.gst}</p>
                <p className="mt-1 text-base">Seller Mo. {firm.firmMobile}</p>
                <p className="mt-2 text-sm leading-snug md:text-base">{firm.address}</p>
                <p className="mt-2 text-base font-medium">{firm.tagline}</p>
              </>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Invoice No.</p>
              <p className="rounded-md border bg-muted/40 px-3 py-3 text-lg">{invoice.invoice_number ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Date</p>
              <p className="rounded-md border bg-muted/40 px-3 py-3 text-lg">{formatDate(invoice.invoice_date)}</p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Customer Name</p>
              <p className="rounded-md border bg-muted/40 px-3 py-3 text-lg">{invoice.customer_name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Mobile No.</p>
              <p className="rounded-md border bg-muted/40 px-3 py-3 text-lg">{invoice.customer_mobile ?? "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Customer GST</p>
              <p className="rounded-md border bg-muted/40 px-3 py-3 text-lg">{invoice.customer_gst ?? "-"}</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Items</h2>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                  <div className="space-y-1 md:col-span-3">
                    <p className="text-xs font-medium text-muted-foreground">Description</p>
                    <p className="rounded-md border bg-muted/40 px-2 py-2 text-sm">{item.description || "-"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground">HSN / SAC</p>
                    <p className="rounded-md border bg-muted/40 px-2 py-2 text-sm">{item.hsn_code || "-"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <p className="text-xs font-medium text-muted-foreground">Unit</p>
                    <p className="rounded-md border bg-muted/40 px-2 py-2 text-sm">{item.unit || "-"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <p className="text-xs font-medium text-muted-foreground">Qty</p>
                    <p className="rounded-md border bg-muted/40 px-2 py-2 text-sm">{currency(item.quantity)}</p>
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <p className="text-xs font-medium text-muted-foreground">Rate</p>
                    <p className="rounded-md border bg-muted/40 px-2 py-2 text-sm">{currency(item.rate)}</p>
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <p className="text-xs font-medium text-muted-foreground">GST%</p>
                    <p className="rounded-md border bg-muted/40 px-2 py-2 text-sm">{item.gst_percent}%</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground">Type</p>
                    <p className="rounded-md border bg-muted/40 px-2 py-2 text-sm">{item.gst_type === "+" ? "+ GST" : "- GST"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <p className="text-xs font-medium text-muted-foreground">S.No</p>
                    <p className="rounded-md border bg-muted/40 px-2 py-2 text-sm text-center">{index + 1}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">GST Calculation</h2>
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
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="border px-2 py-2 text-center">{index + 1}</td>
                    <td className="border px-2 py-2">{item.description || "-"}</td>
                    <td className="border px-2 py-2 text-right">{currency(item.quantity)}</td>
                    <td className="border px-2 py-2 text-right">{currency(item.rate)}</td>
                    <td className="border px-2 py-2 text-right">{currency(item.taxable_amount)}</td>
                    <td className="border px-2 py-2 text-right">{item.gst_percent}%</td>
                    <td className="border px-2 py-2 text-right">{currency(item.cgst)}</td>
                    <td className="border px-2 py-2 text-right">{currency(item.sgst)}</td>
                    <td className="border px-2 py-2 text-right font-semibold">{currency(item.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col items-end justify-center rounded bg-muted p-4">
            <span className="text-sm font-bold">Grand Total</span>
            <span className="text-2xl font-bold">{currency(grandTotal)}</span>
          </div>
        </section>

        <section className="flex justify-end pb-8">
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
            className="rounded-md bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isGeneratingPdf ? "Generating..." : "Generate PDF"}
          </button>
        </section>
      </div>

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
              <iframe src={previewUrl} className="h-full w-full rounded border bg-white shadow-sm" title="PDF Preview" />
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

export default function InvoiceViewPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    }>
      <InvoiceView />
    </Suspense>
  )
}
