/**
 * Authentication Routes
 * /api/v1/auth
 */

 import { Router } from 'express';
 import authController from '../controllers/auth.controller';
 import { authenticate } from '../middleware/auth.middleware';
 import { limitAuth, limitGeneral } from '../middleware/rateLimiter.middleware';
 import { validate, registerSchema, loginSchema, updateProfileSchema } from '../middleware/validator.middleware';
 import { sanitize } from '../middleware/validator.middleware';
 
 const router = Router();
 
 /**
  * Public routes
  */
 
 // POST /api/v1/auth/register
 router.post(
   '/register',
   limitAuth,
   sanitize,
   validate(registerSchema),
   authController.register
 );
 
 // POST /api/v1/auth/login
 router.post(
   '/login',
   limitAuth,
   sanitize,
   validate(loginSchema),
   authController.login
 );
 
 // POST /api/v1/auth/refresh
 router.post(
   '/refresh',
   limitGeneral,
   authController.refreshAccessToken
 );
 
 /**
  * Protected routes
  */
 
 // GET /api/v1/auth/me
 router.get(
   '/me',
   authenticate,
   limitGeneral,
   authController.getMe
 );
 
 // PATCH /api/v1/auth/profile
 router.patch(
   '/profile',
   authenticate,
   limitGeneral,
   sanitize,
   validate(updateProfileSchema),
   authController.updateProfile
 );
 
 // POST /api/v1/auth/change-password
 router.post(
   '/change-password',
   authenticate,
   limitAuth,
   sanitize,
   authController.changePassword
 );
 
 // POST /api/v1/auth/logout
 router.post(
   '/logout',
   authenticate,
   limitGeneral,
   authController.logout
 );
 
 // DELETE /api/v1/auth/account
 router.delete(
   '/account',
   authenticate,
   limitAuth,
   sanitize,
   authController.deleteAccount
 );
 
 export default router;