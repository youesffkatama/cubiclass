/**
 * Analytics Routes
 * /api/v1/analytics
 */

 import { Router } from 'express';
 import analyticsController from '../controllers/analytics.controller';
 import { authenticate } from '../middleware/auth.middleware';
 import { limitGeneral, limitGeneration } from '../middleware/rateLimiter.middleware';
 import {
   validate,
   validateObjectId,
   createStudyPlanSchema,
   completeTaskSchema,
 } from '../middleware/validator.middleware';
 
 const router = Router();
 
 /**
  * All routes require authentication
  */
 router.use(authenticate);
 
 /**
  * Analytics data routes
  */
 
 // GET /api/v1/analytics/heatmap
 router.get(
   '/heatmap',
   limitGeneral,
   analyticsController.getStudyHeatmap
 );
 
 // GET /api/v1/analytics/subjects
 router.get(
   '/subjects',
   limitGeneral,
   analyticsController.getSubjectDistribution
 );
 
 // GET /api/v1/analytics/performance
 router.get(
   '/performance',
   limitGeneral,
   analyticsController.getPerformanceMetrics
 );
 
 // GET /api/v1/analytics/knowledge-gaps
 router.get(
   '/knowledge-gaps',
   limitGeneral,
   analyticsController.getKnowledgeGaps
 );
 
 // GET /api/v1/analytics/trend
 router.get(
   '/trend',
   limitGeneral,
   analyticsController.getLearningTrend
 );
 
 // GET /api/v1/analytics/dashboard
 router.get(
   '/dashboard',
   limitGeneral,
   analyticsController.getDashboard
 );
 
 /**
  * Study plan routes
  */
 
 // POST /api/v1/analytics/study-plan
 router.post(
   '/study-plan',
   limitGeneration,
   validate(createStudyPlanSchema),
   analyticsController.createStudyPlan
 );
 
 // GET /api/v1/analytics/study-plans
 router.get(
   '/study-plans',
   limitGeneral,
   analyticsController.getStudyPlans
 );
 
 // GET /api/v1/analytics/study-plans/:id
 router.get(
   '/study-plans/:id',
   limitGeneral,
   validateObjectId(),
   analyticsController.getStudyPlan
 );
 
 // POST /api/v1/analytics/study-plans/:id/complete-task
 router.post(
   '/study-plans/:id/complete-task',
   limitGeneral,
   validateObjectId(),
   validate(completeTaskSchema),
   analyticsController.completeTask
 );
 
 // DELETE /api/v1/analytics/study-plans/:id
 router.delete(
   '/study-plans/:id',
   limitGeneral,
   validateObjectId(),
   analyticsController.deleteStudyPlan
 );
 
 /**
  * Knowledge graph
  */
 
 // POST /api/v1/analytics/knowledge-graph
 router.post(
   '/knowledge-graph',
   limitGeneration,
   analyticsController.generateKnowledgeGraph
 );
 
 /**
  * Badges
  */
 
 // GET /api/v1/analytics/badges
 router.get(
   '/badges',
   limitGeneral,
   analyticsController.getBadges
 );
 
 export default router;