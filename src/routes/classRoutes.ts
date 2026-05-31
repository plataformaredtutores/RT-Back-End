import { Router } from 'express'
import {
  createClass,
  getClassesCashFlowSummary,
  getClassesDetails,
  deleteClass,
  updateClassPaymentStatus,
  updateGuardianClassPaymentStatusByGuardianId,
} from '../controllers/classController'

const router = Router()

/**
 * @openapi
 * /classes:
 *   post:
 *     summary: Create a class
 *     tags: [Classes]
 *     description: |
 *       Creates a class and its related ClassPayment.
 *
 *       This endpoint can be used by 3 roles:
 *       - tutor: institutionId and tutorId are inferred from the authenticated tutor.
 *       - coordinator: institutionId is inferred from the authenticated coordinator; tutorId must be provided.
 *       - admin: tutorId and institutionId must be provided.
 *
 *       Class creation is blocked when the month of the class is already settled:
 *       - if an admin payment exists for that month
 *       - if a coordinator payment exists for that institution and month
 *       - if any class for that tutor in that month already has tutorPaymentStatus = completed
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClassInput'
 *     responses:
 *       201:
 *         description: Created class and its payment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateClassResponse'
 *       409:
 *         description: Class creation blocked because monthly payments are already settled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateClassBlockedResponse'
 *       403:
 *         description: Forbidden (role not allowed)
 *
 */
router.post('/', createClass)

/**
 * @openapi
 * /classes/cash-flow-summary:
 *   get:
 *     summary: Get classes cash flow summary
 *     tags: [Classes]
 *     description: |
 *       Returns a cash-flow summary computed from ClassPayment.
 *
 *       The returned shape depends on the authenticated role:
 *       - guardian/tutor: { pendingAmount, paidAmount }
 *       - coordinator/admin: { pendingIncomes, receivedIncomes, pendingExpenses, paidExpenses }
 *
 *       Notes about scoping:
 *       - guardian: scoped to the authenticated guardian (and institution)
 *       - tutor: scoped to the authenticated tutor (and institution)
 *       - coordinator: scoped to the authenticated coordinator's institution
 *       - admin: requires institutionId query param
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by class date >= startDate
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by class date <= endDate
 *       - in: query
 *         name: tutorId
 *         schema:
 *           type: integer
 *         description: Optional filter by tutorId (ignored for role tutor)
 *       - in: query
 *         name: guardianId
 *         schema:
 *           type: integer
 *         description: Optional filter by guardianId (ignored for role guardian)
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Optional filter by studentId
 *       - in: query
 *         name: institutionId
 *         schema:
 *           type: integer
 *         description: Required for role admin (institution to query)
 *     responses:
 *       200:
 *         description: Cash flow summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClassesCashFlowSummaryResponse'
 *       403:
 *         description: Forbidden
 */
router.get('/cash-flow-summary', getClassesCashFlowSummary)

/**
 * @openapi
 * /classes:
 *   get:
 *     summary: List classes with details
 *     tags: [Classes]
 *     description: |
 *       Returns classes with related information (ClassPayment, Tutor, Student + Guardian, Institution).
 *
 *       Scoping depends on the authenticated role:
 *       - guardian: only classes for the guardian's students (and institution)
 *       - tutor: only classes for the tutor (and institution)
 *       - coordinator: all classes in the coordinator's institution
 *       - admin: requires institutionId query param
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by class date >= startDate
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by class date <= endDate
 *       - in: query
 *         name: tutorId
 *         schema:
 *           type: integer
 *         description: Optional filter by tutorId (ignored for role tutor)
 *       - in: query
 *         name: guardianId
 *         schema:
 *           type: integer
 *         description: Optional filter by guardianId (ignored for role guardian)
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Optional filter by studentId
 *       - in: query
 *         name: institutionId
 *         schema:
 *           type: integer
 *         description: Required for role admin (institution to query)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number (1-based). If provided with pageSize, enables pagination.
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page. If provided with page, enables pagination.
 *     responses:
 *       200:
 *         description: Array of class details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ClassDetails'
 *       403:
 *         description: Forbidden
 */
router.get('/', getClassesDetails)

/**
 * @openapi
 * /classes/{classId}:
 *   delete:
 *     summary: Delete a class
 *     tags: [Classes]
 *     description: |
 *       Deletes the class and any related ClassPayment.
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       403:
 *         description: Forbidden
 */
router.delete('/:classId', deleteClass)

/**
 * @openapi
 * /classes/class-payments/{classPaymentId}/status:
 *   patch:
 *     summary: Update class payment fields
 *     tags: [Classes]
 *     description: |
 *       Updates guardianPaymentStatus, tutorPaymentStatus and/or guardianPaymentType.
 *       At least one field must be provided.
 *     parameters:
 *       - in: path
 *         name: classPaymentId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateClassPaymentStatusInput'
 *     responses:
 *       200:
 *         description: Updated ClassPayment
 *       400:
 *         description: At least one field must be provided
 *       403:
 *         description: Forbidden
 */
router.patch('/class-payments/:classPaymentId/status', updateClassPaymentStatus)

/**
 * @openapi
 * /classes/class-payments/bulk-status:
 *   patch:
 *     summary: Bulk-update guardian class payments by guardian and period
 *     tags: [Classes]
 *     description: |
 *       Updates guardian-side class payments for all classes that belong to a
 *       specific guardian, optionally filtered by class date range.
 *
 *       Behavior:
 *       - `guardianPaymentStatus = pending`: sets `guardianPaymentStatus` to `pending`
 *       - `guardianPaymentStatus = card | bankTransfer`: sets `guardianPaymentType`
 *         and marks `guardianPaymentStatus` as `completed`
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkUpdateGuardianClassPaymentStatusInput'
 *     responses:
 *       200:
 *         description: Number of records updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkUpdateClassPaymentsResponse'
 *       400:
 *         description: Missing or invalid input
 *       403:
 *         description: Forbidden
 */
router.patch('/class-payments/bulk-status', updateGuardianClassPaymentStatusByGuardianId)

export default router
