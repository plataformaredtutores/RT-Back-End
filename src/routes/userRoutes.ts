// routes/userRoutes.ts
import { Router } from 'express'
import { 
  createUser,
  getUsers,
  deleteUser,
  reactivateUser,
  getUserById,
  editUserBankAccount,
  editUserPersonalInformation,
  changeUserPassword,
  getTutorLinks,
  getGuardianLinks
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
 *           enum: [admin, coordinator, tutor, guardian]
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
 *         name: sendInactive
 *         schema:
 *           type: boolean
 *         description: If false, only active users are returned. If true or omitted, returns all.
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
 *     description: |
 *       Create a new user in the system.
 *       - Only admins or coordinators can create users
 *       - Coordinators cannot create admin or coordinator users
 *       - Admins must provide the institution ID
 *       - Coordinators automatically use their own institution
 *       - Initial password is set to the RUT number without the verifying digit
 *       - Email must be unique (database constraint)
 *       - For coordinators, coordinatorProfitShare defaults to 30% if not provided
 *       - Only coordinator users can include coordinatorProfitShare
 *       - Phone, address, and chargeEmail are optional
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserWithBankAccountInput'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateUserResponse'
 *       400:
 *         description: Invalid input or validation error (missing required fields, invalid email format, or database constraint violation)
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.post('/', createUser)
/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Delete a user by ID
 *     description: |
 *       Soft delete a user by marking them as inactive (isActive = false).
 *       - Admins and coordinators can delete users
 *       - Coordinators cannot delete admin or coordinator users
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
 *         description: User deleted successfully (soft delete)
 *       400:
 *         description: Cannot delete due to pending payments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteUserBlockedResponse'
 *       403:
 *         description: Forbidden - user lacks permission to delete this user
 *       404:
 *         description: User not found
 */
router.delete('/:id', deleteUser)
/**
 * @openapi
 * /users/{id}/reactivate:
 *   patch:
 *     summary: Reactivate a user by ID
 *     description: |
 *       Reactivates a previously deactivated user (isActive = true).
 *       - Admins and coordinators can reactivate users
 *       - Coordinators cannot reactivate admin or coordinator users
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
 *         description: User reactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReactivateUserResponse'
 *       403:
 *         description: Forbidden - user lacks permission to reactivate this user
 *       404:
 *         description: User not found
 */
router.patch('/:id/reactivate', reactivateUser)
/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     description: |
 *       Returns user details.
 *       - For guardians/tutors, only active students are returned
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
 *               $ref: '#/components/schemas/UserByIdResponse'
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
/**
 * @openapi
 * /users/{id}/change-password:
 *   patch:
 *     summary: Change a user's password
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
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Current password is incorrect
 *       404:
 *         description: User not found
 */
router.patch('/:id/change-password', changeUserPassword)

/**
 * @openapi
 * /users/{id}/tutor-links:
 *   get:
 *     summary: Get tutor links for a user
 *     description: |
 *       Returns tutor links. Only active links are returned by default,
 *       and guardians must be active to be included.
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
 *         description: Tutor links retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TutorLink'
 *       404:
 *         description: User not found
 */
router.get('/:id/tutor-links', getTutorLinks)
/**
 * @openapi
 * /users/{id}/guardian-links:
 *   get:
 *     summary: Get guardian links for a user
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
 *         description: Guardian links retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GuardianLink'
 *       404:
 *         description: User not found
 */
router.get('/:id/guardian-links', getGuardianLinks)

export default router;
