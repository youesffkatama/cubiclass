/**
 * StudyPlan Model
 * Manages personalized study schedules and progress tracking
 */

 import mongoose, { Schema, Document } from 'mongoose';

 export interface IStudyTask {
   day: number;
   date: Date;
   type: 'read' | 'review' | 'practice' | 'quiz' | 'rest';
   title: string;
   description: string;
   duration: number; // minutes
   nodeId?: mongoose.Types.ObjectId;
   priority: 'low' | 'medium' | 'high';
   status: 'pending' | 'in_progress' | 'completed' | 'skipped';
   completedAt?: Date;
   timeSpent?: number; // actual minutes spent
 }
 
 export interface IStudyPlan extends Document {
   userId: mongoose.Types.ObjectId;
   title: string;
   goal: string;
   nodes: mongoose.Types.ObjectId[];
   examDate: Date;
   startDate: Date;
   endDate: Date;
   schedule: IStudyTask[];
   progress: {
     completedTasks: number;
     totalTasks: number;
     percentage: number;
     currentDay: number;
     streak: number;
     lastStudyDate?: Date;
   };
   settings: {
     dailyGoalMinutes: number;
     difficulty: 'beginner' | 'intermediate' | 'advanced';
     studyDays: number[]; // 0-6 (Sunday-Saturday)
     reminderEnabled: boolean;
     spacedRepetition: boolean;
   };
   analytics: {
     totalTimeSpent: number;
     avgDailyTime: number;
     mostProductiveTime?: string;
     subjectDistribution: Map<string, number>;
   };
   recommendations: string[];
   isActive: boolean;
   createdAt: Date;
   updatedAt: Date;
 }
 
 const StudyTaskSchema = new Schema<IStudyTask>({
   day: {
     type: Number,
     required: true
   },
   date: {
     type: Date,
     required: true
   },
   type: {
     type: String,
     enum: ['read', 'review', 'practice', 'quiz', 'rest'],
     required: true
   },
   title: {
     type: String,
     required: true,
     maxlength: 200
   },
   description: {
     type: String,
     maxlength: 500
   },
   duration: {
     type: Number,
     required: true,
     min: 5,
     max: 300
   },
   nodeId: {
     type: Schema.Types.ObjectId,
     ref: 'KnowledgeNode'
   },
   priority: {
     type: String,
     enum: ['low', 'medium', 'high'],
     default: 'medium'
   },
   status: {
     type: String,
     enum: ['pending', 'in_progress', 'completed', 'skipped'],
     default: 'pending'
   },
   completedAt: Date,
   timeSpent: Number
 }, { _id: false });
 
 const StudyPlanSchema = new Schema<IStudyPlan>({
   userId: {
     type: Schema.Types.ObjectId,
     ref: 'User',
     required: true,
     index: true
   },
   title: {
     type: String,
     required: true,
     maxlength: 200
   },
   goal: {
     type: String,
     required: true,
     maxlength: 500
   },
   nodes: [{
     type: Schema.Types.ObjectId,
     ref: 'KnowledgeNode'
   }],
   examDate: {
     type: Date,
     required: true
   },
   startDate: {
     type: Date,
     default: Date.now
   },
   endDate: {
     type: Date,
     required: true
   },
   schedule: {
     type: [StudyTaskSchema],
     default: []
   },
   progress: {
     completedTasks: {
       type: Number,
       default: 0
     },
     totalTasks: {
       type: Number,
       default: 0
     },
     percentage: {
       type: Number,
       default: 0,
       min: 0,
       max: 100
     },
     currentDay: {
       type: Number,
       default: 1
     },
     streak: {
       type: Number,
       default: 0
     },
     lastStudyDate: Date
   },
   settings: {
     dailyGoalMinutes: {
       type: Number,
       default: 60,
       min: 15,
       max: 300
     },
     difficulty: {
       type: String,
       enum: ['beginner', 'intermediate', 'advanced'],
       default: 'intermediate'
     },
     studyDays: {
       type: [Number],
       default: [1, 2, 3, 4, 5] // Monday to Friday
     },
     reminderEnabled: {
       type: Boolean,
       default: true
     },
     spacedRepetition: {
       type: Boolean,
       default: true
     }
   },
   analytics: {
     totalTimeSpent: {
       type: Number,
       default: 0
     },
     avgDailyTime: {
       type: Number,
       default: 0
     },
     mostProductiveTime: String,
     subjectDistribution: {
       type: Map,
       of: Number,
       default: new Map()
     }
   },
   recommendations: {
     type: [String],
     default: []
   },
   isActive: {
     type: Boolean,
     default: true
   }
 }, {
   timestamps: true
 });
 
 // Indexes
 StudyPlanSchema.index({ userId: 1, isActive: 1 });
 StudyPlanSchema.index({ examDate: 1 });
 StudyPlanSchema.index({ 'progress.percentage': -1 });
 
 // Pre-save hook to calculate progress
 StudyPlanSchema.pre('save', function(next) {
   if (this.isModified('schedule')) {
     this.progress.totalTasks = this.schedule.length;
     this.progress.completedTasks = this.schedule.filter(
       task => task.status === 'completed'
     ).length;
     
     this.progress.percentage = this.progress.totalTasks > 0
       ? Math.round((this.progress.completedTasks / this.progress.totalTasks) * 100)
       : 0;
     
     // Calculate total time spent
     this.analytics.totalTimeSpent = this.schedule.reduce(
       (sum, task) => sum + (task.timeSpent || 0),
       0
     );
     
     // Calculate average daily time
     const daysElapsed = Math.max(1, 
       Math.ceil((Date.now() - this.startDate.getTime()) / (1000 * 60 * 60 * 24))
     );
     this.analytics.avgDailyTime = Math.round(this.analytics.totalTimeSpent / daysElapsed);
   }
   next();
 });
 
 // Method to get today's tasks
 StudyPlanSchema.methods.getTodaysTasks = function() {
   const today = new Date().toISOString().split('T')[0];
   return this.schedule.filter(task => 
     task.date.toISOString().split('T')[0] === today
   );
 };
 
 // Method to complete task
 StudyPlanSchema.methods.completeTask = function(
   day: number,
   timeSpent: number
 ) {
   const taskIndex = this.schedule.findIndex(t => t.day === day);
   
   if (taskIndex !== -1) {
     this.schedule[taskIndex].status = 'completed';
     this.schedule[taskIndex].completedAt = new Date();
     this.schedule[taskIndex].timeSpent = timeSpent;
     
     // Update streak
     const today = new Date().toISOString().split('T')[0];
     const lastStudy = this.progress.lastStudyDate?.toISOString().split('T')[0];
     
     if (!lastStudy) {
       this.progress.streak = 1;
     } else {
       const daysDiff = Math.floor(
         (new Date(today).getTime() - new Date(lastStudy).getTime()) / (1000 * 60 * 60 * 24)
       );
       
       if (daysDiff === 1) {
         this.progress.streak += 1;
       } else if (daysDiff > 1) {
         this.progress.streak = 1;
       }
     }
     
     this.progress.lastStudyDate = new Date();
     
     return this.save();
   }
   
   throw new Error('Task not found');
 };
 
 // Method to get upcoming tasks
 StudyPlanSchema.methods.getUpcomingTasks = function(days: number = 7) {
   const today = new Date();
   const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
   
   return this.schedule.filter(task => 
     task.date >= today && 
     task.date <= futureDate &&
     task.status === 'pending'
   );
 };
 
 // Method to check if plan is overdue
 StudyPlanSchema.methods.isOverdue = function(): boolean {
   return this.examDate < new Date() && this.progress.percentage < 100;
 };
 
 // Method to get remaining days
 StudyPlanSchema.methods.getRemainingDays = function(): number {
   const now = new Date();
   const diff = this.examDate.getTime() - now.getTime();
   return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
 };
 
 export default mongoose.model<IStudyPlan>('StudyPlan', StudyPlanSchema);