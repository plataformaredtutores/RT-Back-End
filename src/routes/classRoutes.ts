import { Router } from "express"
import { createClass } from "../controllers/classController"

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


export default router