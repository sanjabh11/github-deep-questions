import { FileUpload } from '../../shared/types';
import * as pdfjsLib from 'pdfjs-dist';

export class PDFHandler {
  private static async extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  public static async processPDFContent(file: FileUpload): Promise<string> {
    try {
      // Convert base64 to array buffer
      const binaryString = atob(file.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Extract text from PDF
      const text = await this.extractTextFromPDF(bytes.buffer);
      return text;
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw error;
    }
  }
}
