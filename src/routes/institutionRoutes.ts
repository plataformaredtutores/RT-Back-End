// routes/institutionRoutes.ts
import { Router } from 'express';

import { 
  createInstitution,
  getInstitutions,
  searchInstitutions,
  getGuardiansFromInstitution,
  deleteInstitution,
  reactivateInstitution,
} from '../controllers/institutionController';

const router = Router();

/**
 * @openapi
 * /institutions:
 *   post:
 *     summary: Create an institution
 *     description: Creates an institution and seeds default fee rows (all amounts set to 0) for every type/modality/student-count combination.
 *     tags: [Institutions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInstitutionInput'
 *     responses:
 *       201:
 *         description: Created institution
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Institution'
 */
router.post('/', createInstitution);
/**
 * @openapi
 * /institutions:
 *   get:
 *     summary: Get all institutions
 *     tags: [Institutions]
 *     responses:
 *       200:
 *         description: List of institutions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Institution'
 */
router.get('/', getInstitutions);

/**
 * @openapi
 * /institutions/{institutionId}/guardians:
 *   get:
 *     summary: Get guardians from an institution
 *     tags: [Institutions]
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Institution ID
 *     responses:
 *       200:
 *         description: List of guardian
 */
router.get('/:institutionId/guardians', getGuardiansFromInstitution);

/**
 * @openapi
 * /institutions/search:
 *   get:
 *     summary: Search institutions by name
 *     tags: [Institutions]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query to match institution names
 *     responses:
 *       200:
 *         description: List of institutions matching the search query
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Institution'
 *       400:
 *         description: Bad request - search query is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       403:
 *         description: Forbidden - admin access required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.get('/search', searchInstitutions);

/**
 * @openapi
 * /institutions/{id}:
 *   delete:
 *     summary: Delete (deactivate) an institution
 *     description: Deletes an institution only if there are no pending class payments in the last 12 months and all coordinator payments for those months exist and are completed. Operation is a soft delete that deactivates the institution and its users.
 *     tags: [Institutions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Institution ID
 *     responses:
 *       200:
 *         description: Institution deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteInstitutionResponse'
 *       400:
 *         description: Cannot delete due to pending or missing payments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteInstitutionResponse'
 */
router.delete('/:id', deleteInstitution);

/**
 * @openapi
 * /institutions/{id}/reactivate:
 *   patch:
 *     summary: Reactivate an institution
 *     description: Reactivates a previously deactivated institution.
 *     tags: [Institutions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Institution ID
 *     responses:
 *       200:
 *         description: Institution reactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReactivateInstitutionResponse'
 *       404:
 *         description: Institution not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReactivateInstitutionResponse'
 */
router.patch('/:id/reactivate', reactivateInstitution);

export default router;
