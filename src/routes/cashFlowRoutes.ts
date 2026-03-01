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
 *       Returns a summary of amounts to receive and pay.
 *       
 *       **Logic based on Authenticated User Role:**
 *
 *       For **admin**:
 *       - Returns global financial summary and admin profit shares.
 *       - \`institutionId\` is optional to filter specific institution class payments.
 *
 *       For **coordinator**:
 *       - Returns financial summary scoped to their assigned institution and their profit shares.
 *       - Institution ID is automatically inferred from the user credential.
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/MonthYear'
 *         description: Start month (MM-YYYY)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/MonthYear'
 *         description: End month (MM-YYYY)
 *       - in: query
 *         name: institutionId
 *         schema:
 *           type: integer
 *         description: Optional filter by institution ID (Only for admin role)
 *     responses:
 *       200:
 *         description: Cash flow summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 amountToReceive:
 *                   type: number
 *                   description: Total pending payments from Guardians
 *                 amountReceived:
 *                   type: number
 *                   description: Total completed payments from Guardians
 *                 amountToPay:
 *                   type: number
 *                   description: Total pending payments to Tutors
 *                 amountPaid:
 *                   type: number
 *                   description: Total completed payments to Tutors
 *                 adminPayments:
 *                   type: array
 *                   description: List of admin profit share payments (only if role=admin)
 *                   items:
 *                     type: object
 *                     properties:
 *                       amount:
 *                         type: number
 *                       status:
 *                         type: string
 *                         enum: [pending, completed]
 *                       period:
 *                         type: string
 *                         format: date-time
 *                 coordinatorPayments:
 *                   type: array
 *                   description: List of coordinator profit share payments (only if role=coordinator)
 *                   items:
 *                     type: object
 *                     properties:
 *                       amount:
 *                         type: number
 *                       status:
 *                         type: string
 *                         enum: [pending, completed]
 *                       period:
 *                         type: string
 *                         format: date-time
 *                 adminAmountToReceive:
 *                   type: number
 *                   description: Total pending profit share amount for Admin
 *                 adminAmountReceived:
 *                   type: number
 *                   description: Total completed profit share amount for Admin
 *                 coordinatorAmountToReceive:
 *                   type: number
 *                   description: Total pending profit share amount for Coordinator
 *                 coordinatorAmountReceived:
 *                   type: number
 *                   description: Total completed profit share amount for Coordinator
 *       400:
 *         description: Bad Request (Missing dates, invalid formats, or non-matching start/end dates)
 *       403:
 *         description: Forbidden (Invalid role or permissions)
 */
router.get('/summary', getCashFlowSummary)

/**
 * @openapi
 * /cashflow/details:
 *   get:
 *     summary: Get cash flow details
 *     tags: [CashFlow]
 *     description: |
 *       Returns detailed financial information separated by user role.
 *       
 *       **Logic based on Filtered User Role:**
 *
 *       For **coordinator**:
 *       - Returns a list of coordinators with their calculated profit shares and payment statuses for the specified period.
 * 
 *       For **tutor**:
 *       - Returns a list of tutors with their total earnings and payment status for the specified period.
 *       
 *       For **guardian**:
 *       - Returns a list of guardians with their total payments and payment status for the specified period.
 * 
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/MonthYear'
 *         description: Start month (MM-YYYY)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/MonthYear'
 *         description: End month (MM-YYYY)
 *       - in: query
 *         name: filteredUserRole
 *         required: false
 *         schema:
 *           type: string
 *           enum: [coordinator, tutor, guardian, admin]
 *         description: The role to filter the details by (e.g. coordinator, tutor, guardian)
 *       - in: query
 *         name: institutionId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Optional filter by institution ID
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Cash flow details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   # Specific fields based on the role (e.g. coordinatorPayments, totalAmount, paymentStatus)
 *       400:
 *         description: Bad Request (Missing dates, invalid formats, or non-matching start/end dates)
 *       403:
 *         description: Forbidden (Invalid role or permissions)
 */
router.get('/details', getCashFlowDetails)

export default router;