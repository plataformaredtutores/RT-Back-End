import { Router } from 'express'
import {
  createGuardianTutorLink,
  editTutorPaymentsFromPeriod,
  removeGuardianTutorLink,
} from '../controllers/tutorController'

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
 *     summary: Update tutor payment status for a date range
 *     description: |
 *       Bulk-updates the `tutorPaymentStatus` field on every class payment belonging to the
 *       given tutor whose class date falls within [`periodStart`, `periodEnd`] (inclusive, UTC).
 *       The range is expanded to full months: `periodStart` is treated as the first moment of
 *       its month and `periodEnd` as the last moment of its month.
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
 *             required: [periodStart, periodEnd, status]
 *             properties:
 *               periodStart:
 *                 type: string
 *                 format: date
 *                 example: '2026-01-01'
 *                 description: Any date within the first month of the range (UTC)
 *               periodEnd:
 *                 type: string
 *                 format: date
 *                 example: '2026-02-01'
 *                 description: Any date within the last month of the range (UTC)
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

/**
 * @openapi
 * /tutors/guardian-links:
 *   delete:
 *     summary: Delete a guardian-tutor link
 *     description: Deletes a guardian-tutor relationship identified by guardianId, tutorId, and institutionId.
 *     tags: [Tutors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeleteGuardianTutorLinkInput'
 *     responses:
 *       200:
 *         description: Guardian-tutor link deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteGuardianTutorLinkResponse'
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Link not found
 */
router.delete('/guardian-links', removeGuardianTutorLink)

export default router
