/**
 * ChatSession Model
 * Stores conversation history between user and AI persona
 */

 import mongoose, { Schema, Document } from 'mongoose';

 export interface IMessage {
   role: 'user' | 'assistant' | 'system';
   content: string;
   timestamp: Date;
   metadata?: {
     model?: string;
     tokens?: number;
     sources?: Array<{
       nodeId: string;
       chunkIndex: number;
       similarity: number;
     }>;
   };
 }
 
 export interface IChatSession extends Document {
   userId: mongoose.Types.ObjectId;
   nodeId: mongoose.Types.ObjectId;
   title: string;
   messages: IMessage[];
   metadata: {
     totalMessages: number;
     totalTokens: number;
     avgResponseTime: number;
     lastMessageAt: Date;
     model: string;
   };
   analytics: {
     questionsAsked: number;
     conceptsCovered: string[];
     difficulty: 'easy' | 'medium' | 'hard';
     userSatisfaction?: number;
   };
   isActive: boolean;
   createdAt: Date;
   updatedAt: Date;
 }
 
 const MessageSchema = new Schema<IMessage>({
   role: {
     type: String,
     enum: ['user', 'assistant', 'system'],
     required: true
   },
   content: {
     type: String,
     required: true,
     maxlength: 10000
   },
   timestamp: {
     type: Date,
     default: Date.now
   },
   metadata: {
     model: String,
     tokens: Number,
     sources: [{
       nodeId: {
         type: Schema.Types.ObjectId,
         ref: 'KnowledgeNode'
       },
       chunkIndex: Number,
       similarity: Number
     }]
   }
 }, { _id: false });
 
 const ChatSessionSchema = new Schema<IChatSession>({
   userId: {
     type: Schema.Types.ObjectId,
     ref: 'User',
     required: true,
     index: true
   },
   nodeId: {
     type: Schema.Types.ObjectId,
     ref: 'KnowledgeNode',
     required: true,
     index: true
   },
   title: {
     type: String,
     required: true,
     default: 'New Conversation',
     maxlength: 200
   },
   messages: {
     type: [MessageSchema],
     default: []
   },
   metadata: {
     totalMessages: {
       type: Number,
       default: 0
     },
     totalTokens: {
       type: Number,
       default: 0
     },
     avgResponseTime: {
       type: Number,
       default: 0
     },
     lastMessageAt: {
       type: Date,
       default: Date.now
     },
     model: {
       type: String,
       default: 'mistralai/mistral-7b-instruct:free'
     }
   },
   analytics: {
     questionsAsked: {
       type: Number,
       default: 0
     },
     conceptsCovered: {
       type: [String],
       default: []
     },
     difficulty: {
       type: String,
       enum: ['easy', 'medium', 'hard'],
       default: 'medium'
     },
     userSatisfaction: {
       type: Number,
       min: 1,
       max: 5
     }
   },
   isActive: {
     type: Boolean,
     default: true
   }
 }, {
   timestamps: true
 });
 
 // Indexes for performance
 ChatSessionSchema.index({ userId: 1, createdAt: -1 });
 ChatSessionSchema.index({ nodeId: 1, isActive: 1 });
 ChatSessionSchema.index({ 'metadata.lastMessageAt': -1 });
 
 // Pre-save hook to update metadata
 ChatSessionSchema.pre('save', function(next) {
   if (this.isModified('messages')) {
     this.metadata.totalMessages = this.messages.length;
     
     // Update total tokens
     this.metadata.totalTokens = this.messages.reduce(
       (sum, msg) => sum + (msg.metadata?.tokens || 0),
       0
     );
     
     // Update last message timestamp
     if (this.messages.length > 0) {
       this.metadata.lastMessageAt = this.messages[this.messages.length - 1].timestamp;
     }
     
     // Auto-generate title from first user message
     if (this.title === 'New Conversation' && this.messages.length > 0) {
       const firstUserMessage = this.messages.find(m => m.role === 'user');
       if (firstUserMessage) {
         this.title = firstUserMessage.content.slice(0, 50) + 
           (firstUserMessage.content.length > 50 ? '...' : '');
       }
     }
   }
   next();
 });
 
 // Method to add message
 ChatSessionSchema.methods.addMessage = function(
   role: 'user' | 'assistant',
   content: string,
   metadata?: any
 ) {
   this.messages.push({
     role,
     content,
     timestamp: new Date(),
     metadata
   });
   
   if (role === 'user') {
     this.analytics.questionsAsked += 1;
   }
   
   return this.save();
 };
 
 // Method to get recent messages
 ChatSessionSchema.methods.getRecentMessages = function(limit: number = 10) {
   return this.messages.slice(-limit);
 };
 
 // Method to calculate session duration
 ChatSessionSchema.methods.getSessionDuration = function(): number {
   if (this.messages.length < 2) return 0;
   
   const firstMessage = this.messages[0].timestamp;
   const lastMessage = this.messages[this.messages.length - 1].timestamp;
   
   return Math.floor((lastMessage.getTime() - firstMessage.getTime()) / 1000 / 60); // minutes
 };
 
 export default mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);