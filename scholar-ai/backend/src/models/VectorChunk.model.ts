import mongoose, { Schema, Document } from 'mongoose';

export interface IVectorChunk extends Document {
  nodeId: mongoose.Types.ObjectId;
  content: string;
  embedding: number[];
  metadata: {
    pageNumber?: number;
    chunkIndex: number;
    totalChunks: number;
    bbox?: number[]; // [x, y, width, height]
    startChar: number;
    endChar: number;
  };
  semantics: {
    topics: string[];
    entities: string[];
    sentiment?: number;
    complexity?: number;
  };
  createdAt: Date;
}

const VectorChunkSchema = new Schema<IVectorChunk>({
  nodeId: {
    type: Schema.Types.ObjectId,
    ref: 'KnowledgeNode',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  embedding: {
    type: [Number],
    required: true
  },
  metadata: {
    pageNumber: Number,
    chunkIndex: {
      type: Number,
      required: true
    },
    totalChunks: {
      type: Number,
      required: true
    },
    bbox: [Number],
    startChar: {
      type: Number,
      required: true
    },
    endChar: {
      type: Number,
      required: true
    }
  },
  semantics: {
    topics: [String],
    entities: [String],
    sentiment: Number,
    complexity: Number
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Critical: Vector search index for MongoDB Atlas
// This MUST be created in MongoDB Atlas UI or via mongosh
// Index name: "vector_index"
// Field: "embedding"
// Type: "vectorSearch"
// Dimensions: 384 (for all-MiniLM-L6-v2)
// Similarity: "cosine"

VectorChunkSchema.index({ nodeId: 1, 'metadata.chunkIndex': 1 });
VectorChunkSchema.index({ 'metadata.pageNumber': 1 });

export default mongoose.model<IVectorChunk>('VectorChunk', VectorChunkSchema);