import { Router } from 'express'
import { postMail } from '../controllers/mailController'

const router = Router()

/**
 * @openapi
 * /mail:
 *   post:
 *     summary: Send email
 *     tags: [Mail]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MailRequest'
 *     responses:
 *       202:
 *         description: Mail accepted for delivery
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 id:
 *                   type: string
 */
router.post('/', postMail)

export default router
