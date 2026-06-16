import { Router } from 'express';
import { UserController } from '@/controllers/user.controller';
import { UserService } from '@/services/user.service';
import { UserRepository } from '@/repositories/user.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import { inviteUserSchema, updateUserRoleSchema } from '@/validators/user.schema';

const router = Router();
const userRepo = new UserRepository(prisma);
const userService = new UserService(userRepo);
const userController = new UserController(userService);

router.use(authenticate);
router.use(tenantContext);

router.get('/', authorize('users.read'), userController.listUsers);
router.post('/', authorize('users.invite'), validate(inviteUserSchema), userController.inviteUser);
router.put('/:id', authorize('users.update'), validate(updateUserRoleSchema), userController.updateUserRole);
router.delete('/:id', authorize('users.update'), userController.deleteUser);
router.get('/roles', authorize('users.read'), userController.listRoles);

export const userRoutes = router;
