declare module "html2pdf.js" {
  type Html2PdfOptions = {
    margin?: number | [number, number] | [number, number, number, number]
    filename?: string
    image?: {
      type?: "jpeg" | "png" | "webp"
      quality?: number
    }
    html2canvas?: {
      scale?: number
      useCORS?: boolean
      logging?: boolean
      letterRendering?: boolean
      backgroundColor?: string
      onclone?: (documentClone: Document) => void
    }
    jsPDF?: {
      unit?: "pt" | "mm" | "cm" | "in" | "px"
      format?: string | [number, number]
      orientation?: "portrait" | "landscape"
    }
  }

  type Html2PdfBuilder = {
    from: (element: HTMLElement) => Html2PdfBuilder
    set: (options: Html2PdfOptions) => Html2PdfBuilder
    save: () => Promise<void>
  }

  type Html2PdfFactory = () => Html2PdfBuilder

  const html2pdf: Html2PdfFactory
  export default html2pdf
}
