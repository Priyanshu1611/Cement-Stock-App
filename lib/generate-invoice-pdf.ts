export type PdfFirm = {
  name: string
  gst: string
  firmMobile: string
  address: string
  tagline: string
}

export type PdfItem = {
  description: string
  hsnCode: string
  unit: string
  quantity: string
  rate: string
  gstPercent: string
  gstType: "+" | "-"
}

export type PdfResult = {
  blobUrl: string
  file: File
  fileName: string
}

const SHARED_FIRM_CONTACT = "9425461119, 8770328909"
const TAGLINE = "Cement & Building Material Seller"

const toNumber = (value: string | number): number => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const currency = (value: number): string => value.toFixed(2)

type CalculatedItem = {
  amount: number
  gst: number
  cgst: number
  sgst: number
  total: number
}

const calculateItem = (item: PdfItem): CalculatedItem => {
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

const displayRatePerUnit = (item: PdfItem, calc: CalculatedItem): number => {
  const qty = toNumber(item.quantity)
  if (qty === 0) return 0
  return item.gstType === "+" ? calc.total / qty : calc.amount / qty
}

export async function generateInvoicePdf(params: {
  firm: PdfFirm
  invoiceNo: string
  invoiceDate: string
  customerName: string
  mobile: string
  customerGst: string
  items: PdfItem[]
}): Promise<PdfResult> {
  const { firm, invoiceNo, invoiceDate, customerName, mobile, customerGst, items } = params

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
  doc.text(`GSTIN: ${firm.gst}`, 14, 11)
  doc.text("** Shree Ganeshay Namah **", centerX, 11, { align: "center" })
  doc.text(`Mo. ${firm.firmMobile}`, 196, 11, { align: "right" })

  let y = 19
  doc.setFont("helvetica", "bold").setFontSize(22).text(firm.name, centerX, y, { align: "center" })
  y += 7

  doc.setFont("helvetica", "normal").setFontSize(9)
  const addressLines = doc.splitTextToSize(firm.address, 175)
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

  const calculations = items.map(calculateItem)
  const grandTotal = calculations.reduce((acc, c) => acc + c.total, 0)

  const bodyRows: any[] = items.map((item, index) => {
    const calc = calculations[index]
    const dispRate = currency(displayRatePerUnit(item, calc))
    return [
      String(index + 1), item.description || "-", item.hsnCode || "-", item.unit,
      currency(toNumber(item.quantity)), dispRate,
      currency(calc.amount), `${toNumber(item.gstPercent)}%`,
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
      { content: currency(grandTotal), styles: { halign: "right" } },
    ]],
    styles: { font: "helvetica", fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    footStyles: { fontStyle: "bold", fillColor: [245, 245, 245], lineWidth: 0.1 },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.raw[0] === "") {
        data.cell.styles.lineWidth = { top: 0, right: 0.1, bottom: 0, left: 0.1 }
      }
    },
  })

  const finalY = (doc as any).lastAutoTable?.finalY ?? lineY + 40
  doc.text("Seller Signature", 196, finalY + 14, { align: "right" })

  const blob = doc.output("blob")
  const blobUrl = URL.createObjectURL(blob)
  const fileName = `gst-invoice-${Date.now()}.pdf`

  return {
    blobUrl,
    file: new File([blob], fileName, { type: "application/pdf" }),
    fileName,
  }
}
