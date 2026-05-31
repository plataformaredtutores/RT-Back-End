import { Router } from 'express'
import {
  editAdminProfitShare,
  makeAdminPayment,
  deleteAdminPayment,
} from '../controllers/adminController'

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
 * /admin/payments/{period}:
 *   delete:
 *     summary: Delete an admin payment by period
 *     description: |
 *       Permanently deletes the admin payment record matching the given billing period.
 *       The `period` must be the ISO 8601 date-time string of the first day of the month
 *       (e.g. `2026-01-01T00:00:00.000Z`).
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: period
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *           example: '2026-01-01T00:00:00.000Z'
 *         description: First day of the billing month (UTC) of the payment to delete
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
 *         description: Invalid period value
 *       403:
 *         description: Forbidden
 */
router.delete('/payments/:period', deleteAdminPayment)

export default router
