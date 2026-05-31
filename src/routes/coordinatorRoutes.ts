import { Router } from 'express'
import {
  editCoordinatorProfitShare,
  makeCoordinatorPayment,
  deleteCoordinatorPayment,
} from '../controllers/coordinatorController'

const router = Router()

/**
 * @openapi
 * /coordinators/{institutionId}/profit-share:
 *   patch:
 *     summary: Edit coordinator profit share
 *     description: Updates the profit share for a coordinator in a specific institution.
 *     tags: [Coordinators]
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Institution ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EditCoordinatorProfitShareInput'
 *     responses:
 *       200:
 *         description: Coordinator profit share updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EditCoordinatorProfitShareResponse'
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Coordinator profit share not found
 */
router.patch('/:institutionId/profit-share', editCoordinatorProfitShare)

/**
 * @openapi
 * /coordinators/{institutionId}/payments:
 *   post:
 *     summary: Record coordinator payments
 *     description: |
 *       Creates one or more coordinator profit-share payment records, all marked as `completed`.
 *       `coordinatorId` must be included in the request body alongside the payments array.
 *       All records are created inside a single database transaction.
 *       The coordinator must exist, have the `coordinator` role, and be active.
 *     tags: [Coordinators]
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Institution ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [coordinatorId, payments]
 *             properties:
 *               coordinatorId:
 *                 type: integer
 *                 description: ID of the coordinator receiving the payments
 *               payments:
 *                 type: array
 *                 description: One or more payment periods to record
 *                 items:
 *                   type: object
 *                   required: [amount, period]
 *                   properties:
 *                     amount:
 *                       type: number
 *                       description: Payment amount
 *                     period:
 *                       type: string
 *                       format: date-time
 *                       description: First day of the billing month (UTC)
 *     responses:
 *       201:
 *         description: Coordinator payments created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 payments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       coordinatorId:
 *                         type: integer
 *                       institutionId:
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
 *         description: Invalid input or coordinator is inactive
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Coordinator not found
 */
router.post('/:institutionId/payments', makeCoordinatorPayment)

/**
 * @openapi
 * /coordinators/{coordinatorId}/payments/{period}:
 *   delete:
 *     summary: Delete a coordinator payment
 *     description: |
 *       Permanently deletes a coordinator payment record identified by its
 *       numeric payment ID (`period` path param) scoped to the given `coordinatorId`.
 *     tags: [Coordinators]
 *     parameters:
 *       - in: path
 *         name: coordinatorId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the coordinator who owns the payment
 *       - in: path
 *         name: period
 *         required: true
 *         schema:
 *           type: integer
 *         description: Numeric ID of the coordinator payment record to delete
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
router.delete('/:coordinatorId/payments/:period', deleteCoordinatorPayment)

export default router
