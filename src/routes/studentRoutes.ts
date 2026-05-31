import { Router } from 'express'
import {
  addStudentToGuardian,
  removeStudentFromGuardian,
  getStudentsByGuardianId,
  reactivateStudent,
} from '../controllers/studentController'

const router = Router()

/**
 * @openapi
 * /students/{guardianId}:
 *   get:
 *     summary: Get students by guardian ID
 *     description: |
 *       Retrieve students associated with a specific guardian.
 *       - Admins/coordinators: returns all students
 *       - Guardians: returns only active students for their own guardianId
 *       - Tutors: returns only active students when there is an active tutor-guardian link
 *     tags: [Students]
 *     parameters:
 *       - in: path
 *         name: guardianId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Guardian ID
 *       - in: query
 *         name: sendInactive
 *         required: false
 *         schema:
 *           type: boolean
 *         description: If false, only active students are returned for admin/coordinator. If true or omitted, returns all. Guardians/tutors always receive only active students.
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
 *         description: Forbidden - user is not authenticated
 *       404:
 *         description: No students found for the specified guardian
 */
router.get('/:guardianId', getStudentsByGuardianId)
/**
 * @openapi
 * /students/{id}/reactivate:
 *   patch:
 *     summary: Reactivate a student
 *     description: |
 *       Reactivates a previously deactivated student.
 *       - Requires admin or coordinator role
 *     tags: [Students]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Student ID
 *     responses:
 *       200:
 *         description: Student reactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid student id
 *       403:
 *         description: Forbidden - user is not an admin or coordinator
 */
router.patch('/:id/reactivate', reactivateStudent)

/**
 * @openapi
 * /students/add:
 *   post:
 *     summary: Add a student to a guardian
 *     description: |
 *       Create a student for a guardian or reactivate an existing inactive one with the same name (case-insensitive).
 *       - Requires admin or coordinator role
 *       - All fields are required
 *       - If a student with the same name exists for the guardian and is inactive, it will be reactivated instead of creating a new record
 *     tags: [Students]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddStudentToGuardianRequest'
 *     responses:
 *       200:
 *         description: Student reactivated or already active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AddStudentToGuardianResponse'
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
router.post('/add', addStudentToGuardian)

/**
 * @openapi
 * /students/delete:
 *   post:
 *     summary: Remove a student from a guardian
 *     description: |
 *       Soft-delete (deactivate) a student by setting isActive = false for the specified guardian/student pair.
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
router.post('/delete', removeStudentFromGuardian)

export default router
