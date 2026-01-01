/**
 * Analytics Controller
 * Handles study analytics, heatmaps, progress tracking, and insights
 */

 import { Request, Response } from 'express';
 import analyticsService from '../services/analytics.service';
 import plannerService from '../services/planner.service';
 import User from '../models/User.model';
 import StudyPlan from '../models/StudyPlan.model';
 import { catchAsync } from '../utils/AppError';
 import { NotFoundError, ValidationError } from '../utils/AppError';
 import { sendSuccess } from '../utils/helpers';
 import logger from '../utils/logger';
 
 /**
  * Get study heatmap
  * GET /api/v1/analytics/heatmap
  */
 export const getStudyHeatmap = catchAsync(async (req: Request, res: Response) => {
   const days = parseInt(req.query.days as string) || 365;
   
   const heatmap = await analyticsService.getStudyHeatmap(req.userId!, days);
   
   sendSuccess(res, {
     heatmap,
     days,
   });
 });
 
 /**
  * Get subject distribution
  * GET /api/v1/analytics/subjects
  */
 export const getSubjectDistribution = catchAsync(async (req: Request, res: Response) => {
   const distribution = await analyticsService.getSubjectDistribution(req.userId!);
   
   sendSuccess(res, {
     distribution,
   });
 });
 
 /**
  * Get performance metrics
  * GET /api/v1/analytics/performance
  */
 export const getPerformanceMetrics = catchAsync(async (req: Request, res: Response) => {
   const metrics = await analyticsService.getPerformanceMetrics(req.userId!);
   
   sendSuccess(res, {
     metrics,
   });
 });
 
 /**
  * Get knowledge gaps
  * GET /api/v1/analytics/knowledge-gaps
  */
 export const getKnowledgeGaps = catchAsync(async (req: Request, res: Response) => {
   const gaps = await analyticsService.analyzeKnowledgeGaps(req.userId!);
   
   sendSuccess(res, {
     gaps,
   });
 });
 
 /**
  * Get learning trend
  * GET /api/v1/analytics/trend
  */
 export const getLearningTrend = catchAsync(async (req: Request, res: Response) => {
   const days = parseInt(req.query.days as string) || 30;
   
   const trend = await analyticsService.getLearningTrend(req.userId!, days);
   
   sendSuccess(res, {
     trend,
     days,
   });
 });
 
 /**
  * Get complete dashboard data
  * GET /api/v1/analytics/dashboard
  */
 export const getDashboard = catchAsync(async (req: Request, res: Response) => {
   const [
     user,
     heatmap,
     subjects,
     performance,
     gaps,
     trend,
   ] = await Promise.all([
     User.findById(req.userId),
     analyticsService.getStudyHeatmap(req.userId!, 30),
     analyticsService.getSubjectDistribution(req.userId!),
     analyticsService.getPerformanceMetrics(req.userId!),
     analyticsService.analyzeKnowledgeGaps(req.userId!),
     analyticsService.getLearningTrend(req.userId!, 14),
   ]);
   
   sendSuccess(res, {
     user: {
       username: user?.username,
       level: user?.dna.level,
       xp: user?.dna.xp,
       rank: user?.dna.rank,
       streak: user?.dna.streak,
       badges: user?.dna.badges,
     },
     heatmap,
     subjects,
     performance,
     gaps,
     trend,
   });
 });
 
 /**
  * Create study plan
  * POST /api/v1/analytics/study-plan
  */
 export const createStudyPlan = catchAsync(async (req: Request, res: Response) => {
   const {
     title,
     goal,
     nodeIds,
     examDate,
     difficulty,
     dailyGoalMinutes,
     studyDays,
   } = req.body;
   
   logger.info(`Creating study plan: ${title}`);
   
   // Generate plan
   const planData = await plannerService.generateStudyPlan(
     req.userId!,
     nodeIds,
     new Date(examDate),
     difficulty || 'intermediate'
   );
   
   // Create plan document
   const plan = await StudyPlan.create({
     userId: req.userId,
     title,
     goal,
     nodes: nodeIds,
     examDate: new Date(examDate),
     endDate: new Date(examDate),
     schedule: planData.schedule,
     progress: {
       totalTasks: planData.schedule.length,
     },
     settings: {
       dailyGoalMinutes: dailyGoalMinutes || 60,
       difficulty: difficulty || 'intermediate',
       studyDays: studyDays || [1, 2, 3, 4, 5],
     },
     recommendations: planData.recommendations,
   });
   
   logger.info(`Study plan created: ${plan._id}`);
   
   sendSuccess(res, {
     plan: {
       id: plan._id,
       title: plan.title,
       goal: plan.goal,
       examDate: plan.examDate,
       daysRemaining: plan.getRemainingDays(),
       totalTasks: plan.schedule.length,
       schedule: plan.schedule,
       recommendations: plan.recommendations,
     },
   }, 'Study plan created', 201);
 });
 
 /**
  * Get study plans
  * GET /api/v1/analytics/study-plans
  */
 export const getStudyPlans = catchAsync(async (req: Request, res: Response) => {
   const plans = await StudyPlan.find({
     userId: req.userId,
     isActive: true,
   })
     .sort({ createdAt: -1 })
     .populate('nodes', 'meta.originalName');
   
   sendSuccess(res, {
     plans: plans.map(plan => ({
       id: plan._id,
       title: plan.title,
       goal: plan.goal,
       examDate: plan.examDate,
       daysRemaining: plan.getRemainingDays(),
       progress: plan.progress,
       isOverdue: plan.isOverdue(),
     })),
   });
 });
 
 /**
  * Get study plan details
  * GET /api/v1/analytics/study-plans/:id
  */
 export const getStudyPlan = catchAsync(async (req: Request, res: Response) => {
   const { id } = req.params;
   
   const plan = await StudyPlan.findOne({
     _id: id,
     userId: req.userId,
   }).populate('nodes', 'meta.originalName persona.generatedName');
   
   if (!plan) {
     throw new NotFoundError('Study plan');
   }
   
   sendSuccess(res, {
     plan: {
       id: plan._id,
       title: plan.title,
       goal: plan.goal,
       nodes: plan.nodes,
       examDate: plan.examDate,
       daysRemaining: plan.getRemainingDays(),
       schedule: plan.schedule,
       progress: plan.progress,
       settings: plan.settings,
       analytics: plan.analytics,
       recommendations: plan.recommendations,
       todaysTasks: plan.getTodaysTasks(),
       upcomingTasks: plan.getUpcomingTasks(7),
     },
   });
 });
 
 /**
  * Complete task
  * POST /api/v1/analytics/study-plans/:id/complete-task
  */
 export const completeTask = catchAsync(async (req: Request, res: Response) => {
   const { id } = req.params;
   const { day, timeSpent } = req.body;
   
   const plan = await StudyPlan.findOne({
     _id: id,
     userId: req.userId,
   });
   
   if (!plan) {
     throw new NotFoundError('Study plan');
   }
   
   // Complete the task
   await plan.completeTask(day, timeSpent);
   
   // Award XP
   const user = await User.findById(req.userId);
   if (user) {
     user.dna.xp += 10;
     await user.save();
     
     // Check for achievements
     await analyticsService.checkAchievements(req.userId!);
   }
   
   logger.info(`Task completed: Plan ${id}, Day ${day}`);
   
   sendSuccess(res, {
     progress: plan.progress,
     streak: plan.progress.streak,
   });
 });
 
 /**
  * Delete study plan
  * DELETE /api/v1/analytics/study-plans/:id
  */
 export const deleteStudyPlan = catchAsync(async (req: Request, res: Response) => {
   const { id } = req.params;
   
   const plan = await StudyPlan.findOne({
     _id: id,
     userId: req.userId,
   });
   
   if (!plan) {
     throw new NotFoundError('Study plan');
   }
   
   await plan.deleteOne();
   
   logger.info(`Study plan deleted: ${id}`);
   
   sendSuccess(res, null, 'Study plan deleted');
 });
 
 /**
  * Generate knowledge graph
  * POST /api/v1/analytics/knowledge-graph
  */
 export const generateKnowledgeGraph = catchAsync(async (req: Request, res: Response) => {
   const { nodeIds } = req.body;
   
   if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
     throw new ValidationError('Node IDs are required');
   }
   
   logger.info(`Generating knowledge graph for ${nodeIds.length} documents`);
   
   const graph = await plannerService.generateKnowledgeGraph(nodeIds, req.userId!);
   
   sendSuccess(res, {
     graph,
   });
 });
 
 /**
  * Get user badges
  * GET /api/v1/analytics/badges
  */
 export const getBadges = catchAsync(async (req: Request, res: Response) => {
   const user = await User.findById(req.userId);
   
   if (!user) {
     throw new NotFoundError('User');
   }
   
   // Define all possible badges
   const allBadges = [
     {
       id: 'first_upload',
       name: 'First Upload',
       description: 'Upload your first document',
       icon: '📄',
       unlocked: user.dna.badges.includes('first_upload'),
     },
     {
       id: 'prolific_learner',
       name: 'Prolific Learner',
       description: 'Upload 10 documents',
       icon: '📚',
       unlocked: user.dna.badges.includes('prolific_learner'),
     },
     {
       id: 'week_warrior',
       name: 'Week Warrior',
       description: 'Study for 7 days in a row',
       icon: '🔥',
       unlocked: user.dna.badges.includes('week_warrior'),
     },
     {
       id: 'monthly_master',
       name: 'Monthly Master',
       description: 'Maintain a 30-day streak',
       icon: '⭐',
       unlocked: user.dna.badges.includes('monthly_master'),
     },
     {
       id: 'level_10',
       name: 'Level 10',
       description: 'Reach level 10',
       icon: '🎖️',
       unlocked: user.dna.badges.includes('level_10'),
     },
   ];
   
   sendSuccess(res, {
     badges: allBadges,
     unlockedCount: user.dna.badges.length,
     totalCount: allBadges.length,
   });
 });
 
 export default {
   getStudyHeatmap,
   getSubjectDistribution,
   getPerformanceMetrics,
   getKnowledgeGaps,
   getLearningTrend,
   getDashboard,
   createStudyPlan,
   getStudyPlans,
   getStudyPlan,
   completeTask,
   deleteStudyPlan,
   generateKnowledgeGraph,
   getBadges,
 };