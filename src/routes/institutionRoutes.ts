// routes/institutionRoutes.ts
import { Router } from 'express';

import { 
  createInstitution,
  deleteInstitution,
  getInstitutions,
  searchInstitutions,
  getGuardiansFromInstitution
} from '../controllers/institutionController';

const router = Router();

/**
 * @openapi
 * /institutions:
 *   post:
 *     summary: Create an institution
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
 *                 $ref: '#/components/schemas/UserWithGuardianLinks'
 *
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

export default router;
