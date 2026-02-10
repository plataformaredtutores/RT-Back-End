import { Router } from 'express'
import { editCoordinatorProfitShare, makeCoordinatorPayment } from '../controllers/coordinatorController'

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
 *     summary: Create a coordinator payment
 *     description: Creates a payment marked as completed for the current month.
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
 *             $ref: '#/components/schemas/CreateCoordinatorPaymentInput'
 *     responses:
 *       201:
 *         description: Coordinator payment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateCoordinatorPaymentResponse'
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Coordinator not found
 *       403:
 *         description: Forbidden
 */
router.post('/:institutionId/payments', makeCoordinatorPayment)

export default router

