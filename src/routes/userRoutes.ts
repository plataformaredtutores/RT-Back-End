// routes/userRoutes.ts
import { Router } from 'express'
import { 
  createUser,
  getUsers,
  deleteUser,
  getUserById,
  editUserBankAccount,
  editUserPersonalInformation
} from '../controllers/userController'

const router = Router()

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List users
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, coordinator, tutor, parent]
 *         description: Filter by user role
 *       - in: query
 *         name: institutionId
 *         schema:
 *           type: integer
 *         description: Filter by institution id
 *       - in: query
 *         name: nameOrEmail
 *         schema:
 *           type: string
 *         description: Case-insensitive search in name or email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number (1-based)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserWithInstitution'
 */
router.get('/', getUsers)
/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create a user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserWithBankAccountInput'
 *     responses:
 *       201:
 *         description: Created user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
router.post('/', createUser)
/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Delete a user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       204:
 *         description: User deleted successfully
 */
router.delete('/:id', deleteUser)
/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserDetail'
 *       404:
 *         description: User not found
 */
router.get('/:id', getUserById)
/**
 * @openapi
 * /users/{id}/bank-account:
 *   patch:
 *     summary: Edit a user's bank account information
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserBankAccountInput'
 *     responses:
 *       200:
 *         description: Updated bank account information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserBankAccount'
 *       404:
 *         description: User not found
 */
router.patch('/:id/bank-account', editUserBankAccount)
/**
 * @openapi
 * /users/{id}/personal-information:
 *   patch:
 *     summary: Edit a user's personal information
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EditUserPersonalInformationInput'
 *     responses:
 *       201:
 *         description: Updated user information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
router.patch('/:id/personal-information', editUserPersonalInformation)
export default router;
