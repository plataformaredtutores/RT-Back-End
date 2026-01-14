import { Router } from 'express';
import { 
  addStudentToGuardian,
  removeStudentFromGuardian,
  getStudentsByGuardianId
} from '../controllers/studentController';

const router = Router();

/**
 * @openapi
 * /students/{guardianId}:
 *   get:
 *     summary: Get students by guardian ID
 *     description: |
 *       Retrieve all students associated with a specific guardian.
 *       - Requires admin or coordinator role
 *     tags: [Students]
 *     parameters:
 *       - in: path
 *         name: guardianId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Guardian ID
 *     responses:
 *       200:
 *         description: List of students retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 students:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Student'
 *       403:
 *         description: Forbidden - user is not an admin or coordinator
 *       404:
 *         description: No students found for the specified guardian
 */
router.get('/:guardianId', getStudentsByGuardianId);

/**
 * @openapi
 * /students/add:
 *   post:
 *     summary: Add a student to a guardian
 *     description: |
 *       Create a new student and associate them with a guardian.
 *       - Requires admin or coordinator role
 *       - All fields are required
 *     tags: [Students]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddStudentToGuardianRequest'
 *     responses:
 *       201:
 *         description: Student created and added to guardian successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AddStudentToGuardianResponse'
 *       400:
 *         description: Invalid input or validation error (missing required fields, institution not found)
 *       403:
 *         description: Forbidden - user is not an admin or coordinator
 *       404:
 *         description: Guardian not found
 */
router.post('/add', addStudentToGuardian);

/**
 * @openapi
 * /students/delete:
 *   post:
 *     summary: Remove a student from a guardian
 *     description: |
 *       Delete a student record and remove their association with a guardian.
 *       - Requires admin or coordinator role
 *       - The student must be associated with the specified guardian
 *     tags: [Students]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RemoveStudentFromGuardianRequest'
 *     responses:
 *       200:
 *         description: Student removed from guardian successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RemoveStudentFromGuardianResponse'
 *       400:
 *         description: Invalid input or validation error (missing required fields)
 *       403:
 *         description: Forbidden - user is not an admin or coordinator
 *       404:
 *         description: Student not found for the specified guardian
 */
router.post('/delete', removeStudentFromGuardian);

export default router;
