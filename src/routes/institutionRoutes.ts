// routes/institutionRoutes.ts
import { Router } from 'express';

import { 
  createInstitution,
  getInstitutions,
  searchInstitutions,
  getGuardiansFromInstitution,
  deactivateInstitution,
  reactivateInstitution,
  getInstitutionDeletionOptions,
  deleteInstitution,
} from '../controllers/institutionController';

const router = Router();

/**
 * @openapi
 * /institutions:
 *   post:
 *     summary: Create an institution
 *     description: Creates an institution and clones fee rows from institution id=1 (The Grange School).
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
 *               $ref: '#/components/schemas/CreateInstitutionResponse'
 */
router.post('/', createInstitution);
/**
 * @openapi
 * /institutions:
 *   get:
 *     summary: Get all institutions
 *     tags: [Institutions]
 *     parameters:
 *       - in: query
 *         name: sendInactive
 *         required: false
 *         schema:
 *           type: boolean
 *         description: If false, only active institutions are returned. If true or omitted, returns all.
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
 *     summary: Deactivate an institution
 *     description: |
 *       Soft delete an institution.
 *       - If the institution has no users, it can be deactivated immediately (no payment checks).
 *       - Otherwise, it can be deactivated only if there are no pending class payments in the last 12 months and all coordinator payments for those months exist and are completed.
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
 *         description: Institution deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeactivateInstitutionResponse'
 *       400:
 *         description: Cannot deactivate due to pending or missing payments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeactivateInstitutionResponse'
 */
router.delete('/:id', deactivateInstitution);

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

/**
 * @openapi
 * /institutions/{id}/deletion-options:
 *   get:
 *     summary: Get deletion options for an institution
 *     description: Returns whether the institution can be hard-deleted (no classes associated).
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
 *         description: Deletion options
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InstitutionDeletionOptionsResponse'
 *       400:
 *         description: Invalid institution id
 */
router.get('/:id/deletion-options', getInstitutionDeletionOptions);

/**
 * @openapi
 * /institutions/{id}/hard-delete:
 *   delete:
 *     summary: Permanently delete an institution
 *     description: Hard-delete an institution only if it has no classes associated.
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
 *         description: Institution deleted permanently
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteInstitutionResponse'
 *       400:
 *         description: Cannot hard-delete institution
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteInstitutionResponse'
 */
router.delete('/:id/hard-delete', deleteInstitution);

export default router;
