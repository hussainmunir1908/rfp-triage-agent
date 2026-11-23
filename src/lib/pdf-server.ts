import { extractText, getDocumentProxy } from "unpdf";

/** Text of each page of a PDF, for API clients that upload the file itself. */
export async function extractPagesFromPdf(data: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return text;
}
