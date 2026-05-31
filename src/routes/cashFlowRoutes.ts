import { Router } from 'express'
import { getCashFlowSummary, getCashFlowDetails } from '../controllers/cashFlowController'

const router = Router()

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
 *       Results are ordered alphabetically by name.
 *
 *       **Logic based on `filteredUserRole`:**
 *
 *       For **coordinator**:
 *       - Returns a list of coordinators with their calculated profit shares and total amount for the specified period.
 *       - Use `paymentStatus` to filter:
 *         - `pending` — only coordinators with at least one pending payment.
 *         - `completed` — only coordinators where all payments are completed.
 *         - *(omit)* — all coordinators regardless of status.
 *
 *       For **tutor**:
 *       - Returns a list of tutors with their class earnings for the specified period.
 *       - Use `paymentStatus` to filter classes by tutor payment status (`pending` or `completed`).
 *       - Each tutor entry includes a computed `totalAmount` and overall `paymentStatus`.
 *
 *       For **guardian**:
 *       - Returns a list of guardians with their total class payments for the specified period.
 *       - Use `filteredGuardianPaymentStatus` to filter:
 *         - `pending` — only guardians with pending (bank transfer) payments.
 *         - `bankTransfer` — only guardians whose payments are all completed via bank transfer (no pending, no card).
 *         - `card` — only guardians whose payments are all completed via card (no pending, no bank transfer).
 *         - `card-transfer` — guardians who have completed payments of **both** card and bank transfer types, with no pending payments.
 *         - `No payments` — guardians with no students/classes in the selected period.
 *         - `completed` — all guardians with all payments completed, regardless of type.
 *         - *(omit)* — all guardians, including those with `No payments`.
 *       - Each guardian entry includes computed `totalAmount`, `paymentStatus`, and `paymentType`
 *         (`card`, `bankTransfer`, or `null` when mixed / no completed payments).
 *         `paymentStatus` can be `pending`, `completed`, or `No payments`.
 *
 *       For **admin**:
 *       - Admin details are already included in the `/cashflow/summary` response.
 *         This endpoint returns a message redirecting to the summary.
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
 *         description: The role to filter the details by
 *       - in: query
 *         name: institutionId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Optional filter by institution ID (admin only)
 *       - in: query
 *         name: paymentStatus
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, completed]
 *         description: |
 *           Filter by payment status. Applies when `filteredUserRole` is `coordinator` or `tutor`.
 *           - `coordinator`: `pending` returns coordinators with at least one pending payment;
 *             `completed` returns coordinators where all payments are completed.
 *           - `tutor`: filters class payments included for each tutor by tutor payment status.
 *       - in: query
 *         name: filteredGuardianPaymentStatus
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, bankTransfer, card, card-transfer, completed, No payments]
 *         description: |
 *           Filter guardian payments by status/type. Only applies when `filteredUserRole` is `guardian`.
 *           - `pending` — guardians with pending (bank transfer) payments.
 *           - `bankTransfer` — guardians with all completed payments via bank transfer only (no card, no pending).
 *           - `card` — guardians with all completed payments via card only (no bank transfer, no pending).
 *           - `card-transfer` — guardians with both card and bank transfer completed payments, and no pending payments.
 *           - `completed` — guardians with all payments completed, regardless of type.
 *           - `No payments` — guardians without classes in the selected period.
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
 *         description: Cash flow details (paginated; shape of `items` varies by `filteredUserRole`)
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - description: Response when filteredUserRole=coordinator
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total coordinators matching filters before pagination
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           coordinator:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               Institution:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: integer
 *                                   name:
 *                                     type: string
 *                           coordinatorPayments:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 amount:
 *                                   type: number
 *                                 status:
 *                                   type: string
 *                                   enum: [pending, completed]
 *                                 period:
 *                                   type: string
 *                                   format: date-time
 *                           amount:
 *                             type: number
 *                             description: Total profit share amount (pending + completed) for the period
 *                 - description: Response when filteredUserRole=tutor
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total tutors matching filters before pagination
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           Institution:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                           totalAmount:
 *                             type: number
 *                             description: Sum of tutor earnings for the period
 *                           paymentStatus:
 *                             type: string
 *                             enum: [pending, completed]
 *                             description: Overall payment status (pending if any class payment is pending)
 *                 - description: Response when filteredUserRole=guardian
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total guardians matching filters before pagination
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           Institution:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                           totalAmount:
 *                             type: number
 *                             description: Sum of guardian payments for the period
 *                           paymentStatus:
 *                             type: string
 *                             enum: [pending, completed, No payments]
 *                             description: Overall payment status (`pending` if any class payment is pending; `No payments` when guardian has no classes in the period)
 *                           paymentType:
 *                             type: string
 *                             nullable: true
 *                             enum: [card, bankTransfer]
 *                             description: |
 *                               Payment type derived from completed payments.
 *                               `card` or `bankTransfer` if all completed payments share the same type;
 *                               `null` when types are mixed or there are no completed payments.
 *       400:
 *         description: Bad Request (Missing dates or invalid date format)
 *       403:
 *         description: Forbidden (Coordinator attempting to view coordinator or admin details)
 */
router.get('/details', getCashFlowDetails)

export default router
