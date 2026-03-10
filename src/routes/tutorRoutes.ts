import { Router } from 'express'
import { createGuardianTutorLink, editTutorPaymentsFromPeriod } from '../controllers/tutorController'

const router = Router()

/**
 * @openapi
 * /tutors/guardian-links:
 *   post:
 *     summary: Create a guardian-tutor link
 *     description: Creates a GuardianTutor link.
 *     tags: [Tutors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGuardianTutorLinkInput'
 *     responses:
 *       201:
 *         description: Link created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateGuardianTutorLinkResponse'
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Link already exists
 */
router.post('/guardian-links', createGuardianTutorLink)

/**
 * @openapi
 * /tutors/{tutorId}/payments:
 *   patch:
 *     summary: Update tutor payment status for a period
 *     description: |
 *       Bulk-updates the `tutorPaymentStatus` field on every class payment belonging to the
 *       given tutor whose class falls within the calendar month indicated by `period`.
 *       `period` can be any date within the target month (e.g. `2026-02-01`).
 *     tags: [Tutors]
 *     parameters:
 *       - in: path
 *         name: tutorId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the tutor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [period, status]
 *             properties:
 *               period:
 *                 type: string
 *                 format: date
 *                 example: '2026-02-01'
 *                 description: Any date within the target month (UTC)
 *               status:
 *                 type: string
 *                 enum: [pending, completed]
 *                 description: New payment status to apply
 *     responses:
 *       200:
 *         description: Payments updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 updated:
 *                   type: integer
 *                   description: Number of payment records updated
 *       400:
 *         description: Invalid tutor ID or period format
 *       403:
 *         description: Forbidden
 */
router.patch('/:tutorId/payments', editTutorPaymentsFromPeriod)

export default router
