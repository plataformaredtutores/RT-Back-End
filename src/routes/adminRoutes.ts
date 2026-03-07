import { Router } from 'express'
import { editAdminProfitShare, makeAdminPayment, deleteAdminPayment } from '../controllers/adminController'

const router = Router()

/**
 * @openapi
 * /admin/profit-share:
 *   patch:
 *     summary: Edit admin profit share
 *     description: >
 *       Deactivates the current admin profit share and creates a new one.
 *       The current share remains active until today 23:59:59.999 UTC,
 *       and the new share becomes active tomorrow at 00:00:00.000 UTC.
 *       Validates that for every institution the new admin share plus the active
 *       coordinator shares (at the new effective timestamp) does not exceed 100%.
 *       Both operations run inside a
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

/**
 * @openapi
 * /admin/payments:
 *   post:
 *     summary: Record admin payments
 *     description: |
 *       Creates one or more admin profit-share payment records.
 *       Each entry requires an `amount` and a `period` (first day of the target month).
 *       All records are created inside a single database transaction.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required: [amount, period]
 *               properties:
 *                 amount:
 *                   type: number
 *                   description: Payment amount
 *                 period:
 *                   type: string
 *                   format: date-time
 *                   description: First day of the billing month (UTC)
 *     responses:
 *       200:
 *         description: Payments recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       amount:
 *                         type: number
 *                       period:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         enum: [pending, completed]
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden
 */
router.post('/payments', makeAdminPayment)

/**
 * @openapi
 * /admin/payments/{paymentId}:
 *   delete:
 *     summary: Delete an admin payment
 *     description: Permanently deletes the admin payment record with the given ID.
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the admin payment to delete
 *     responses:
 *       200:
 *         description: Payment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid payment ID
 *       403:
 *         description: Forbidden
 */
router.delete('/payments/:paymentId', deleteAdminPayment)

export default router
