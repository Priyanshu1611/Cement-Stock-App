import { supabase } from "./supabase-client"

export type SaveItemInput = {
  description: string
  hsnCode: string
  unit: string
  quantity: string
  rate: string
  gstPercent: string
  gstType: "+" | "-"
  taxableAmount: number
  cgst: number
  sgst: number
  totalAmount: number
}

export type SaveInvoiceInput = {
  firmName: string
  invoiceNumber: string
  invoiceDate: string
  customerName: string
  customerMobile: string
  customerGst: string
  grandTotal: number
  items: SaveItemInput[]
}

export type InvoiceSearchResult = {
  id: number
  firm_name: string
  invoice_number: string | null
  invoice_date: string
  customer_name: string
  customer_mobile: string | null
  grand_total: number
  created_at: string
}

export type InvoiceDetail = {
  id: number
  firm_name: string
  invoice_number: string | null
  invoice_date: string
  customer_name: string
  customer_mobile: string | null
  customer_gst: string | null
  grand_total: number
  created_at: string
}

export type InvoiceItemDetail = {
  id: number
  invoice_id: number
  description: string | null
  hsn_code: string | null
  unit: string | null
  quantity: number
  rate: number
  gst_percent: number
  gst_type: "+" | "-"
  taxable_amount: number
  cgst: number
  sgst: number
  total_amount: number
  sort_order: number
}

export async function saveBillingInvoice(data: SaveInvoiceInput): Promise<number> {
  if (!supabase) throw new Error("Supabase not configured")

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      firm_name: data.firmName,
      invoice_number: data.invoiceNumber.trim() || null,
      invoice_date: data.invoiceDate,
      customer_name: data.customerName.trim() || "Unknown",
      customer_mobile: data.customerMobile.trim() || null,
      customer_gst: data.customerGst.trim() || null,
      grand_total: data.grandTotal,
    })
    .select("id")
    .single()

  if (error) throw error

  const itemRows = data.items.map((item, idx) => ({
    invoice_id: invoice.id,
    description: item.description.trim() || null,
    hsn_code: item.hsnCode.trim() || null,
    unit: item.unit,
    quantity: parseFloat(item.quantity) || 0,
    rate: parseFloat(item.rate) || 0,
    gst_percent: parseFloat(item.gstPercent) || 0,
    gst_type: item.gstType,
    taxable_amount: item.taxableAmount,
    cgst: item.cgst,
    sgst: item.sgst,
    total_amount: item.totalAmount,
    sort_order: idx,
  }))

  const { error: itemsError } = await supabase.from("invoice_items").insert(itemRows)
  if (itemsError) throw itemsError

  return invoice.id as number
}

export async function searchInvoices(params: {
  invoiceNumber?: string
  customerName?: string
  dateFrom?: string
  dateTo?: string
}): Promise<InvoiceSearchResult[]> {
  if (!supabase) throw new Error("Supabase not configured")

  let query = supabase
    .from("invoices")
    .select("id, firm_name, invoice_number, invoice_date, customer_name, customer_mobile, grand_total, created_at")
    .order("invoice_date", { ascending: false })
    .limit(100)

  if (params.invoiceNumber?.trim()) {
    query = query.ilike("invoice_number", `%${params.invoiceNumber.trim()}%`)
  }
  if (params.customerName?.trim()) {
    query = query.ilike("customer_name", `%${params.customerName.trim()}%`)
  }
  if (params.dateFrom?.trim()) {
    query = query.gte("invoice_date", params.dateFrom.trim())
  }
  if (params.dateTo?.trim()) {
    query = query.lte("invoice_date", params.dateTo.trim())
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as InvoiceSearchResult[]
}

export async function getInvoiceById(id: number): Promise<{
  invoice: InvoiceDetail
  items: InvoiceItemDetail[]
}> {
  if (!supabase) throw new Error("Supabase not configured")

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw error

  const { data: items, error: itemsError } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order")

  if (itemsError) throw itemsError

  return {
    invoice: invoice as InvoiceDetail,
    items: (items ?? []) as InvoiceItemDetail[],
  }
}
