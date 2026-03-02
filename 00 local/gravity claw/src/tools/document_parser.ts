import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import { VectorMemory } from '../memory/vectorDb.js';

export const documentTools = [
    {
        name: 'parse_pdf',
        description: 'Extract text from a PDF file. Provide the absolute local path to the file.',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Absolute path to the PDF file' }
            },
            required: ['filePath']
        },
        execute: async ({ filePath }: { filePath: string }) => {
            if (!fs.existsSync(filePath)) {
                return `Error: File not found at ${filePath}`;
            }

            try {
                const dataBuffer = fs.readFileSync(filePath);
                const parser = new PDFParse({ data: dataBuffer });
                const textResult = await parser.getText();
                return `Text extracted from PDF:\n\n${textResult.text.slice(0, 5000)}... (truncated)`;
            } catch (error: any) {
                return `Error parsing PDF: ${error.message}`;
            }
        }
    },
    {
        name: 'ingest_document',
        description: 'Parse a document (PDF) and save its content into long-term Vector Memory (RAG) for future recall.',
        parameters: {
            type: 'object',
            properties: {
                filePath: { type: 'string', description: 'Absolute path to the document file' },
                metadata: { type: 'object', description: 'Optional metadata to store with the document' }
            },
            required: ['filePath']
        },
        execute: async ({ filePath, metadata = {} }: { filePath: string, metadata: any }) => {
            if (!fs.existsSync(filePath)) return `Error: File not found at ${filePath}`;

            try {
                const dataBuffer = fs.readFileSync(filePath);
                const parser = new PDFParse({ data: dataBuffer });
                const textResult = await parser.getText();

                // Split text into chunks for better RAG
                const chunks = textResult.text.match(/[\s\S]{1,1500}/g) || [];
                for (const chunk of chunks) {
                    await VectorMemory.saveMemory(chunk, { ...metadata, source: filePath });
                }

                return `Successfully ingested document into Vector Memory. You can now use 'semantic_search' to query its content.`;
            } catch (error: any) {
                return `Error ingesting document: ${error.message}`;
            }
        }
    }
];
