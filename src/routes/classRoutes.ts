import { Router } from "express"
import { 
  createClass,
  getClassesCashFlowSummary,
  getClassesDetails,
  deleteClass,
  updateClassPaymentStatus
} from "../controllers/classController"

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
 *       403:
 *         description: Forbidden (role not allowed)
 *     
*/
router.post("/", createClass)

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
 *     summary: Update class payment status
 *     tags: [Classes]
 *     description: |
 *       Updates guardianPaymentStatus and/or tutorPaymentStatus for a ClassPayment.
 *       Provide at least one of the two fields.
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClassPayment'
 *       403:
 *         description: Forbidden
 */
router.patch('/class-payments/:classPaymentId/status', updateClassPaymentStatus)



export default router