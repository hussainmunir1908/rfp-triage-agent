import { getDocumentProxy } from "unpdf";
import { joinTextItems } from "./pdf-text";

/** Text of each page of a PDF, for API clients that upload the file itself. */
export async function extractPagesFromPdf(data: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(data);
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(joinTextItems(content.items));
  }
  return pages;
}
