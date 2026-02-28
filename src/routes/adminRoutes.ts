import { Router } from 'express'
import { editAdminProfitShare } from '../controllers/adminController'

const router = Router()

/**
 * @openapi
 * /admin/profit-share:
 *   patch:
 *     summary: Edit admin profit share
 *     description: >
 *       Deactivates the current admin profit share and creates a new one.
 *       Validates that for every institution the new admin share plus the active
 *       coordinator shares does not exceed 100%. Both operations run inside a
 *       database transaction.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EditAdminProfitShareInput'
 *     responses:
 *       200:
 *         description: Admin profit share updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EditAdminProfitShareResponse'
 *       400:
 *         description: Invalid input or combined shares exceed 100%
 *       403:
 *         description: Forbidden
 */
router.patch('/profit-share', editAdminProfitShare)

export default router
