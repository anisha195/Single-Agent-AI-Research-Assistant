/**
 * RAG Knowledge Base and Vector Search Engine.
 * Handles document ingestion, chunking, vector generation, and similarity search.
 */

import fs from 'fs';
import path from 'path';

export interface DocumentChunk {
  id: string;
  document: string;
  content: string;
  score: number;
  metadata: {
    section?: string;
    chunkIndex: number;
    totalChunks: number;
    filename: string;
    fileType: string;
  };
  embedding?: number[];
  termVector?: Map<string, number>;
}

export interface IngestionStatus {
  totalDocuments: number;
  totalChunks: number;
  documents: { filename: string; chunks: number; sizeBytes: number }[];
  lastIndexedAt: string;
}

class VectorStore {
  private chunks: DocumentChunk[] = [];
  private vocabulary: Set<string> = new Set();
  private docFrequencies: Map<string, number> = new Map();
  private documentsDir: string;
  private isInitialized = false;

  constructor(documentsDir: string) {
    this.documentsDir = documentsDir;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await this.ingestAll();
    this.isInitialized = true;
  }

  public async ingestAll(): Promise<IngestionStatus> {
    this.chunks = [];
    this.vocabulary.clear();
    this.docFrequencies.clear();

    if (!fs.existsSync(this.documentsDir)) {
      fs.mkdirSync(this.documentsDir, { recursive: true });
    }

    const files = fs.readdirSync(this.documentsDir);
    const docSummary: { filename: string; chunks: number; sizeBytes: number }[] = [];

    for (const filename of files) {
      const ext = path.extname(filename).toLowerCase();
      if (!['.md', '.txt', '.markdown'].includes(ext)) {
        continue;
      }

      const fullPath = path.join(this.documentsDir, filename);
      const stat = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      const fileChunks = this.chunkDocument(filename, content, ext);
      this.chunks.push(...fileChunks);

      docSummary.push({
        filename,
        chunks: fileChunks.length,
        sizeBytes: stat.size,
      });
    }

    // Build TF-IDF / term vectors for fast, accurate similarity search
    this.buildVectorIndex();

    return {
      totalDocuments: docSummary.length,
      totalChunks: this.chunks.length,
      documents: docSummary,
      lastIndexedAt: new Date().toISOString(),
    };
  }

  private chunkDocument(filename: string, text: string, ext: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    // Split by Markdown headers (## ) or double newlines
    const rawSections = text.split(/(?=^##?\s+)/m);
    let chunkCounter = 0;

    for (const section of rawSections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      // Extract section title if present
      const titleMatch = trimmed.match(/^##?\s+(.+)$/m);
      const sectionTitle = titleMatch ? titleMatch[1].trim() : 'General';

      // Split large sections into sub-chunks of ~250 words with small overlap
      const paragraphs = trimmed.split(/\n\s*\n/);
      let currentChunk = '';

      for (const para of paragraphs) {
        const pTrimmed = para.trim();
        if (!pTrimmed) continue;

        if ((currentChunk + '\n\n' + pTrimmed).length > 1200 && currentChunk.length > 200) {
          chunkCounter++;
          chunks.push({
            id: `${filename}-chunk-${chunkCounter}`,
            document: filename,
            content: currentChunk.trim(),
            score: 0,
            metadata: {
              section: sectionTitle,
              chunkIndex: chunkCounter,
              totalChunks: 0, // will populate below
              filename,
              fileType: ext.replace('.', ''),
            },
          });
          // Carry forward some context
          currentChunk = pTrimmed;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n\n' + pTrimmed : pTrimmed;
        }
      }

      if (currentChunk.trim()) {
        chunkCounter++;
        chunks.push({
          id: `${filename}-chunk-${chunkCounter}`,
          document: filename,
          content: currentChunk.trim(),
          score: 0,
          metadata: {
            section: sectionTitle,
            chunkIndex: chunkCounter,
            totalChunks: 0,
            filename,
            fileType: ext.replace('.', ''),
          },
        });
      }
    }

    // Update total chunks metadata
    for (const c of chunks) {
      c.metadata.totalChunks = chunks.length;
    }

    return chunks;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  private buildVectorIndex(): void {
    const N = this.chunks.length;
    if (N === 0) return;

    for (const chunk of this.chunks) {
      const tokens = this.tokenize(chunk.content);
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        this.vocabulary.add(token);
        this.docFrequencies.set(token, (this.docFrequencies.get(token) || 0) + 1);
      }
    }

    // Compute TF-IDF vector for each chunk
    for (const chunk of this.chunks) {
      const tokens = this.tokenize(chunk.content);
      const tf = new Map<string, number>();
      for (const t of tokens) {
        tf.set(t, (tf.get(t) || 0) + 1);
      }

      const termVector = new Map<string, number>();
      let normSq = 0;
      for (const [term, freq] of tf.entries()) {
        const df = this.docFrequencies.get(term) || 1;
        const idf = Math.log((N + 1) / (df + 0.5));
        const weight = (freq / tokens.length) * idf;
        termVector.set(term, weight);
        normSq += weight * weight;
      }

      // Normalize vector
      const norm = Math.sqrt(normSq) || 1;
      for (const [term, weight] of termVector.entries()) {
        termVector.set(term, weight / norm);
      }

      chunk.termVector = termVector;
    }
  }

  public search(query: string, topK: number = 3): DocumentChunk[] {
    if (!this.chunks.length) {
      return [];
    }

    const queryTokens = this.tokenize(query);
    if (!queryTokens.length) {
      return this.chunks.slice(0, topK);
    }

    const N = this.chunks.length;
    // Build query vector
    const qTf = new Map<string, number>();
    for (const t of queryTokens) {
      qTf.set(t, (qTf.get(t) || 0) + 1);
    }

    const qVector = new Map<string, number>();
    let qNormSq = 0;
    for (const [term, freq] of qTf.entries()) {
      const df = this.docFrequencies.get(term) || 0.5;
      const idf = Math.log((N + 1) / (df + 0.5));
      const weight = (freq / queryTokens.length) * idf;
      qVector.set(term, weight);
      qNormSq += weight * weight;
    }
    const qNorm = Math.sqrt(qNormSq) || 1;
    for (const [t, w] of qVector.entries()) {
      qVector.set(t, w / qNorm);
    }

    // Compute cosine similarity score for each chunk
    const scoredChunks = this.chunks.map((chunk) => {
      let dotProduct = 0;
      if (chunk.termVector) {
        for (const [term, qWeight] of qVector.entries()) {
          const docWeight = chunk.termVector.get(term) || 0;
          dotProduct += qWeight * docWeight;
        }
      }

      // Exact substring boost
      const lowerQuery = query.toLowerCase();
      const lowerContent = chunk.content.toLowerCase();
      if (lowerContent.includes(lowerQuery)) {
        dotProduct += 0.3;
      }

      return {
        ...chunk,
        score: Math.round(dotProduct * 1000) / 1000,
      };
    });

    // Sort descending by score
    scoredChunks.sort((a, b) => b.score - a.score);

    return scoredChunks.slice(0, Math.max(1, topK));
  }

  public getStatus(): IngestionStatus {
    const files = fs.existsSync(this.documentsDir) ? fs.readdirSync(this.documentsDir) : [];
    const docSummary = files
      .filter((f) => ['.md', '.txt'].includes(path.extname(f).toLowerCase()))
      .map((filename) => {
        const full = path.join(this.documentsDir, filename);
        const stat = fs.statSync(full);
        const fileChunks = this.chunks.filter((c) => c.document === filename).length;
        return {
          filename,
          chunks: fileChunks,
          sizeBytes: stat.size,
        };
      });

    return {
      totalDocuments: docSummary.length,
      totalChunks: this.chunks.length,
      documents: docSummary,
      lastIndexedAt: new Date().toISOString(),
    };
  }
}

// Global Vector Store Instance pointing to data/documents/
const docsPath = path.resolve(process.cwd(), 'data/documents');
export const vectorStore = new VectorStore(docsPath);

export async function searchDocuments(query: string, topK: number = 3) {
  await vectorStore.initialize();
  const rawResults = vectorStore.search(query, topK);

  // Return clean schema as requested in spec
  return rawResults.map((r) => ({
    document: r.document,
    content: r.content,
    score: r.score,
    metadata: r.metadata,
  }));
}
