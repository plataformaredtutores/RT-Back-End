import { Router } from 'express';
import { 
    getCashFlowSummary,
    getCashFlowDetails
} from '../controllers/cashFlowController';

const router = Router();

/**
 * @openapi
 * /cashflow/summary:
 *   get:
 *     summary: Get cash flow summary
 *     tags: [CashFlow]
 *     description: |
 *       Returns a summary of amounts to receive and pay for the institution.
 *       
 *       Calculates:
 *       - ammountToReceive: Pending payments from Guardians
 *       - amountReceived: Completed payments from Guardians
 *       - amountToPay: Pending payments to Tutors
 *       - amountPaid: Completed payments to Tutors
 *
 *       Role behavior:
 *       - coordinator: Data scoped to their institution.
 *       - admin: Requires institutionId query parameter.
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter until this date
 *       - in: query
 *         name: institutionId
 *         schema:
 *           type: integer
 *         description: Required for admin role
 *     responses:
 *       200:
 *         description: Cash flow summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ammountToReceive:
 *                   type: number
 *                 amountReceived:
 *                   type: number
 *                 amountToPay:
 *                   type: number
 *                 amountPaid:
 *                   type: number
 *                 share:
 *                   type: number
 *       403:
 *         description: Forbidden
 */
router.get('/summary', getCashFlowSummary)
router.get('/details', getCashFlowDetails)

export default router;