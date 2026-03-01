import swaggerJSDoc from 'swagger-jsdoc'

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'RT Backend API',
      version: '1.0.0',
    },
    servers: [
      { url: `http://localhost:${process.env.PORT || 3000}` }
    ],
    paths: {
      '/users/deactivate/{id}/{role}': {
        patch: {
          summary: 'Deactivate a user by ID',
          description: 'Soft delete a user by marking them as inactive (isActive = false).',
          tags: ['Users'],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string' },
              description: 'User ID'
            },
            {
              in: 'path',
              name: 'role',
              required: true,
              schema: {
                type: 'string',
                enum: ['admin', 'coordinator', 'tutor', 'guardian']
              },
              description: 'User role'
            }
          ],
          responses: {
            200: {
              description: 'User deactivated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DeactivateUserResponse' }
                }
              }
            },
            400: {
              description: 'Cannot deactivate due to pending or missing payments',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DeleteUserBlockedResponse' }
                }
              }
            },
            403: { description: 'Forbidden - user lacks permission to deactivate this user' },
            404: { description: 'User not found' }
          }
        }
      },
      '/users/{id}/reactivate/{role}': {
        patch: {
          summary: 'Reactivate a user by ID',
          description: 'Reactivates a previously deactivated user (isActive = true).',
          tags: ['Users'],
          parameters: [
            {
              in: 'path',
              name: 'id',
              required: true,
              schema: { type: 'string' },
              description: 'User ID'
            },
            {
              in: 'path',
              name: 'role',
              required: true,
              schema: {
                type: 'string',
                enum: ['admin', 'coordinator', 'tutor', 'guardian']
              },
              description: 'User role'
            }
          ],
          responses: {
            200: {
              description: 'User reactivated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ReactivateUserResponse' }
                }
              }
            },
            403: { description: 'Forbidden - user lacks permission to reactivate this user' },
            404: { description: 'User not found' }
          }
        }
      }
    },
    components: {
      schemas: {
        MonthYear: {
          type: 'string',
          pattern: '^(0[1-9]|1[0-2])-(\\d{4})$',
          example: '02-2026',
          description: 'Month and year in MM-YYYY format'
        },
        UserLoginRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' }
          },
          required: ['email', 'password']
        },
        UserLoginResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                email: { type: 'string' },
                role: { type: 'string' },
                name: { type: 'string' },
                institutionId: { type: 'integer', nullable: true }
              }
            }
          },
          required: ['ok', 'user']
        },
        MailRequest: {
          type: 'object',
          properties: {
            to: {
              oneOf: [
                { type: 'string', format: 'email' },
                { type: 'array', items: { type: 'string', format: 'email' }, minItems: 1 }
              ]
            },
            cc: {
              oneOf: [
                { type: 'string', format: 'email' },
                { type: 'array', items: { type: 'string', format: 'email' } }
              ]
            },
            bcc: {
              oneOf: [
                { type: 'string', format: 'email' },
                { type: 'array', items: { type: 'string', format: 'email' } }
              ]
            },
            subject: { type: 'string' },
            text: { type: 'string' },
            html: { type: 'string' },
            replyTo: { type: 'string', format: 'email' }
          },
          required: ['to', 'subject']
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['admin', 'coordinator', 'tutor', 'guardian'] },
            rut: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            chargeEmail: { type: 'string', nullable: true },
            institutionId: { type: 'integer', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt']
        },
        UserInput: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'User full name (required)' },
            email: { type: 'string', format: 'email', description: 'User email (must be unique, required)' },
            role: { type: 'string', enum: ['admin', 'coordinator', 'tutor', 'guardian'], description: 'User role (required)' },
            rut: { type: 'string', description: 'RUT in format XX.XXX.XXX-K (required, used to generate initial password)' },
            phone: { type: 'string', nullable: true, description: 'Phone number (optional)' },
            address: { type: 'string', nullable: true, description: 'Address (optional)' },
            chargeEmail: { type: 'string', format: 'email', nullable: true, description: 'Charge email (optional)' },
            institutionId: { type: 'integer', nullable: true, description: 'Institution ID (required for non-admin users, inferred for coordinators)' },
          },
          required: ['name', 'email', 'role', 'rut']
        },
        Institution: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'isActive', 'createdAt', 'updatedAt']
        },
        CreateInstitutionInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name']
        },
        CreateInstitutionResponse: {
          type: 'object',
          properties: {
            institution: { $ref: '#/components/schemas/Institution' },
            fees: {
              type: 'array',
              items: { $ref: '#/components/schemas/Fee' }
            }
          },
          required: ['institution', 'fees']
        },
        DeleteInstitutionResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['ok', 'message'],
        },
        ReactivateInstitutionResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['ok', 'message'],
        },
        InstitutionDeletionOptionsResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            canHardDelete: { type: 'boolean' },
          },
          required: ['ok', 'canHardDelete'],
        },
        HardDeleteInstitutionResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['ok', 'message'],
        },
        ReactivateUserResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['ok', 'message'],
        },
        DeactivateUserResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['ok', 'message'],
        },
        DeleteUserResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['ok', 'message'],
        },
        EditAdminProfitShareInput: {
          type: 'object',
          description: 'Updates admin profit share using day-boundary activation (new share starts next day at 00:00:00.000 UTC).',
          properties: {
            profitShare: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'New admin profit share percentage (0-100)',
            },
          },
          required: ['profitShare'],
        },
        EditAdminProfitShareResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                profitShare: { type: 'number' },
                availableSince: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Effective start timestamp (next day at 00:00:00.000 UTC).'
                },
                availableUntil: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Effective end timestamp (far-future while active).'
                },
              },
            },
          },
          required: ['ok', 'message', 'data'],
        },
        EditCoordinatorProfitShareInput: {
          type: 'object',
          properties: {
            coordinatorId: { type: 'integer' },
            profitShare: { type: 'number' },
          },
          required: ['coordinatorId', 'profitShare'],
        },
        EditCoordinatorProfitShareResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['ok', 'message'],
        },
        CreateCoordinatorPaymentInput: {
          type: 'object',
          properties: {
            coordinatorId: { type: 'integer' },
            amount: { type: 'number' },
          },
          required: ['coordinatorId', 'amount'],
        },
        CreateCoordinatorPaymentResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
            payment: { $ref: '#/components/schemas/CoordinatorPayment' },
          },
          required: ['ok', 'message', 'payment'],
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['ok', 'message'],
        },
        CreateGuardianTutorLinkInput: {
          type: 'object',
          properties: {
            guardianId: { type: 'integer' },
            tutorId: { type: 'integer' },
            institutionId: { type: 'integer' },
          },
          required: ['guardianId', 'tutorId', 'institutionId'],
        },
        CreateGuardianTutorLinkResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            link: { $ref: '#/components/schemas/GuardianTutor' },
          },
          required: ['ok', 'link'],
        },
        DeleteUserBlockedResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['ok', 'message'],
        },
        UserWithInstitution: {
          allOf: [
            { $ref: '#/components/schemas/User' },
            {
              type: 'object',
              properties: {
                Institution: { $ref: '#/components/schemas/Institution' },
                BankAccount: { $ref: '#/components/schemas/UserBankAccount', nullable: true },
                coordinatorProfitShares: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/CoordinatorProfitShare' },
                  nullable: true
                }
              }
            }
          ]
        },
        CoordinatorProfitShare: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            coordinatorId: { type: 'integer' },
            institutionId: { type: 'integer' },
            profitShare: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'coordinatorId', 'institutionId', 'profitShare']
        },
        UserBankAccount: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            userId: { type: 'integer' },
            bankName: { type: 'string' },
            accountType: { type: 'string', enum: ['AHORRO', 'CORRIENTE', 'VISTA'] },
            accountNumber: { type: 'string' },
            accountEmail: { type: 'string', format: 'email' },
            accountName: { type: 'string' },
            rut: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        CoordinatorPayment: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            coordinatorId: { type: 'integer' },
            institutionId: { type: 'integer' },
            periodYear: { type: 'integer' },
            periodMonth: { type: 'integer' },
            amount: { type: 'integer' },
            status: { $ref: '#/components/schemas/PaymentStatus' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: [
            'id',
            'coordinatorId',
            'institutionId',
            'periodYear',
            'periodMonth',
            'amount',
            'status',
            'createdAt',
            'updatedAt',
          ],
        },
        Student: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            guardianId: { type: 'integer' },
            institutionId: { type: 'integer' },
            isActive: { type: 'boolean' }
          }
        },
        StudentSummary: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' }
          },
          required: ['id', 'name']
        },
        TutorSummary: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          },
          required: ['name']
        },
        GuardianLinkWithTutor: {
          type: 'object',
          properties: {
            tutorId: { type: 'integer' },
            Tutor: { $ref: '#/components/schemas/TutorSummary' }
          },
          required: ['tutorId', 'Tutor']
        },
        UserWithGuardianLinks: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            Students: {
              type: 'array',
              items: { $ref: '#/components/schemas/StudentSummary' }
            },
            GuardianLinks: {
              type: 'array',
              items: { $ref: '#/components/schemas/GuardianLinkWithTutor' }
            }
          },
          required: ['id', 'name', 'Students', 'GuardianLinks']
        },
        GuardianTutor: {
          type: 'object',
          properties: {
            guardianId: { type: 'integer' },
            tutorId: { type: 'integer' },
            institutionId: { type: 'integer' },
            active: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        TutorLink: {
          type: 'object',
          description: 'Tutor link with active guardian only.',
          allOf: [
            { $ref: '#/components/schemas/GuardianTutor' },
            {
              type: 'object',
              properties: {
                Guardian: { $ref: '#/components/schemas/User' }
              }
            }
          ]
        },
        GuardianLink: {
          type: 'object',
          allOf: [
            { $ref: '#/components/schemas/GuardianTutor' },
            {
              type: 'object',
              properties: {
                Tutor: { $ref: '#/components/schemas/User' }
              }
            }
          ]
        },
        UserDetail: {
          allOf: [
            { $ref: '#/components/schemas/User' },
            {
              type: 'object',
              properties: {
                Institution: { $ref: '#/components/schemas/Institution', nullable: true },
                BankAccount: { $ref: '#/components/schemas/UserBankAccount', nullable: true },
                Students: { 
                  type: 'array', 
                  items: { $ref: '#/components/schemas/Student' } 
                },
                TutorLinks: { 
                  type: 'array', 
                  items: { 
                    allOf: [
                      { $ref: '#/components/schemas/GuardianTutor' },
                      {
                        type: 'object',
                        properties: {
                          Guardian: { $ref: '#/components/schemas/User' }
                        }
                      }
                    ]
                  } 
                },
                GuardianLinks: { 
                  type: 'array', 
                  items: { 
                    allOf: [
                      { $ref: '#/components/schemas/GuardianTutor' },
                      {
                        type: 'object',
                        properties: {
                          Tutor: { $ref: '#/components/schemas/User' }
                        }
                      }
                    ]
                  } 
                }
              }
            }
          ]
        },
        UserBankAccountInput: {
          type: 'object',
          properties: {
            userId: { type: 'integer' },
            bankName: { type: 'string' },
            accountType: { type: 'string' },
            accountNumber: { type: 'string' },
            rut: { type: 'string' },
            accountEmail: { type: 'string', format: 'email' },
            accountName: { type: 'string' }
          },
          required: ['bankName', 'accountType', 'accountNumber', 'rut', 'accountEmail', 'accountName']
        },

        ClassSubject: {
          type: 'string',
          enum: [
            'biology',
            'chemistry',
            'physics',
            'mathematics',
            'spanish',
            'french',
            'english',
            'pet',
            'socialStudies',
            'studySkills',
            'other'
          ]
        },
        ClassModality: {
          type: 'string',
          enum: ['inPerson', 'online']
        },
        ClassType: {
          type: 'string',
          enum: ['school', 'university', 'cancelled']
        },
        PaymentStatus: {
          type: 'string',
          enum: ['completed', 'pending']
        },
        PaymentType: {
          type: 'string',
          enum: ['card', 'bankTransfer']
        },
        Class: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            date: { type: 'string', format: 'date-time' },
            subject: { $ref: '#/components/schemas/ClassSubject' },
            modality: { $ref: '#/components/schemas/ClassModality' },
            numberOfStudents: { type: 'integer' },
            type: { $ref: '#/components/schemas/ClassType' },
            duration: { type: 'integer' },
            institutionId: { type: 'integer' },
            studentId: { type: 'integer' },
            tutorId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          },
          required: [
            'id',
            'date',
            'subject',
            'modality',
            'numberOfStudents',
            'type',
            'duration',
            'institutionId',
            'studentId',
            'tutorId',
            'createdAt',
            'updatedAt'
          ]
        },
        ClassPayment: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            classId: { type: 'integer' },
            guardianAmount: { type: 'integer' },
            guardianPaymentStatus: { $ref: '#/components/schemas/PaymentStatus' },
            guardianPaymentType: { $ref: '#/components/schemas/PaymentType' },
            tutorAmount: { type: 'integer' },
            tutorPaymentStatus: { $ref: '#/components/schemas/PaymentStatus' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          },
          required: [
            'id',
            'classId',
            'guardianAmount',
            'guardianPaymentStatus',
            'guardianPaymentType',
            'tutorAmount',
            'tutorPaymentStatus',
            'createdAt',
            'updatedAt'
          ]
        },
        CreateClassBaseInput: {
          type: 'object',
          properties: {
            studentId: { type: 'integer' },
            date: {
              type: 'string',
              description: 'ISO 8601 date-time string',
              example: '2025-12-31T10:00:00.000Z'
            },
            numberOfStudents: { type: 'integer', minimum: 1 },
            duration: { type: 'integer', minimum: 1, description: 'Duration in minutes' },
            subject: { $ref: '#/components/schemas/ClassSubject' },
            type: { $ref: '#/components/schemas/ClassType' },
            modality: { $ref: '#/components/schemas/ClassModality' }
          },
          required: ['studentId', 'date', 'numberOfStudents', 'duration', 'subject', 'type', 'modality']
        },
        CreateClassAsTutorInput: {
          allOf: [
            { $ref: '#/components/schemas/CreateClassBaseInput' }
          ],
          description: 'Tutor creates a class. institutionId and tutorId are inferred from the authenticated tutor.'
        },
        CreateClassAsCoordinatorInput: {
          allOf: [
            { $ref: '#/components/schemas/CreateClassBaseInput' },
            {
              type: 'object',
              properties: {
                tutorId: { type: 'integer', description: 'Tutor who will teach the class' }
              },
              required: ['tutorId']
            }
          ],
          description: 'Coordinator creates a class. institutionId is inferred from the authenticated coordinator; tutorId must be provided.'
        },
        CreateClassAsAdminInput: {
          allOf: [
            { $ref: '#/components/schemas/CreateClassBaseInput' },
            {
              type: 'object',
              properties: {
                tutorId: { type: 'integer', description: 'Tutor who will teach the class' },
                institutionId: { type: 'integer', description: 'Institution that owns the class' }
              },
              required: ['tutorId', 'institutionId']
            }
          ],
          description: 'Admin creates a class. tutorId and institutionId must be provided.'
        },
        CreateClassInput: {
          oneOf: [
            { $ref: '#/components/schemas/CreateClassAsTutorInput' },
            { $ref: '#/components/schemas/CreateClassAsCoordinatorInput' },
            { $ref: '#/components/schemas/CreateClassAsAdminInput' }
          ],
          description: 'Role-based input. Required fields depend on authenticated user role (tutor/coordinator/admin).'
        },
        CreateClassResponse: {
          type: 'object',
          properties: {
            class: { $ref: '#/components/schemas/Class' },
            classPayment: { $ref: '#/components/schemas/ClassPayment' }
          },
          required: ['class', 'classPayment']
        },

        ClassesCashFlowSummaryAmounts: {
          type: 'object',
          properties: {
            pendingAmount: { type: 'integer', description: 'Pending amount for the authenticated role' },
            paidAmount: { type: 'integer', description: 'Paid amount for the authenticated role' }
          },
          required: ['pendingAmount', 'paidAmount']
        },
        ClassesCashFlowSummaryInstitution: {
          type: 'object',
          properties: {
            pendingIncomes: { type: 'integer', description: 'Pending guardian incomes (institution scope)' },
            receivedIncomes: { type: 'integer', description: 'Received guardian incomes (institution scope)' },
            pendingExpenses: { type: 'integer', description: 'Pending tutor expenses (institution scope)' },
            paidExpenses: { type: 'integer', description: 'Paid tutor expenses (institution scope)' }
          },
          required: ['pendingIncomes', 'receivedIncomes', 'pendingExpenses', 'paidExpenses']
        },
        ClassesCashFlowSummaryResponse: {
          description: 'Cash-flow summary. Shape depends on authenticated role (guardian/tutor vs coordinator/admin).',
          oneOf: [
            { $ref: '#/components/schemas/ClassesCashFlowSummaryAmounts' },
            { $ref: '#/components/schemas/ClassesCashFlowSummaryInstitution' }
          ]
        },

        UserIdName: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' }
          },
          required: ['id', 'name']
        },
        StudentWithGuardianSummary: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            Guardian: { $ref: '#/components/schemas/UserIdName' }
          },
          required: ['id', 'name', 'Guardian']
        },
        InstitutionSummary: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' }
          },
          required: ['id', 'name']
        },
        TutorBrief: {
          allOf: [
            { $ref: '#/components/schemas/UserIdName' }
          ],
          description: 'Tutor basic info (id and name)'
        },
        ClassDetails: {
          description: 'Class with included relations: ClassPayment, Tutor, Student (with Guardian), Institution.',
          allOf: [
            { $ref: '#/components/schemas/Class' },
            {
              type: 'object',
              properties: {
                ClassPayment: { $ref: '#/components/schemas/ClassPayment', nullable: true },
                Tutor: { $ref: '#/components/schemas/TutorBrief' },
                Student: { $ref: '#/components/schemas/StudentWithGuardianSummary' },
                Institution: { $ref: '#/components/schemas/InstitutionSummary' }
              },
              required: ['Tutor', 'Student', 'Institution']
            }
          ]
        },

        UpdateClassPaymentStatusInput: {
          description: 'Provide at least one of guardianPaymentStatus or tutorPaymentStatus.',
          oneOf: [
            {
              type: 'object',
              properties: {
                guardianPaymentStatus: { $ref: '#/components/schemas/PaymentStatus' }
              },
              required: ['guardianPaymentStatus']
            },
            {
              type: 'object',
              properties: {
                tutorPaymentStatus: { $ref: '#/components/schemas/PaymentStatus' }
              },
              required: ['tutorPaymentStatus']
            },
            {
              type: 'object',
              properties: {
                guardianPaymentStatus: { $ref: '#/components/schemas/PaymentStatus' },
                tutorPaymentStatus: { $ref: '#/components/schemas/PaymentStatus' }
              },
              required: ['guardianPaymentStatus', 'tutorPaymentStatus']
            }
          ]
        },
        CreateUserWithBankAccountInput: {
          allOf: [
            { $ref: '#/components/schemas/UserInput' },
            {
              type: 'object',
              properties: {
                BankAccount: {
                  allOf: [{ $ref: '#/components/schemas/UserBankAccountInput' }],
                  nullable: true
                },
                coordinatorProfitShare: {
                  type: 'number',
                  nullable: true,
                  description: 'Profit share percentage for coordinator users. Defaults to 30 when omitted.'
                }
              }
            }
          ]
        },
        CreateUserResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            user: { $ref: '#/components/schemas/User' }
          },
          required: ['ok', 'user']
        },
        UserByIdResponse: {
          description: 'UserDetail with optional profit share fields. coordinatorProfitShare is only present when user role is coordinator. adminProfitShare is only present when user role is admin.',
          allOf: [
            { $ref: '#/components/schemas/UserDetail' },
            {
              type: 'object',
              properties: {
                coordinatorProfitShare: { 
                  type: 'number', 
                  nullable: true,
                  description: 'Profit share percentage for coordinator users. Only present when user role is coordinator.'
                },
                adminProfitShare: {
                  type: 'number',
                  nullable: true,
                  description: 'Current active profit share percentage for admin users. Only present when user role is admin.'
                }
              }
            }
          ]
        },
        EditUserPersonalInformationInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            rut: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            chargeEmail: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true }
          },
          required: ['name', 'phone', 'rut']
        },
        ChangePasswordRequest: {
          type: 'object',
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string' },
          },
          required: ['currentPassword', 'newPassword'],
        },
        Fee: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            type: { type: 'string' },
            modality: { 
              type: 'string', 
              enum: ['inPerson', 'online', 'cancelled'] 
            },
            numberOfStudents: { type: 'integer' },
            guardianAmount: { type: 'integer' },
            tutorAmount: { type: 'integer' },
            institutionId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          },
          required: [
            'id',
            'type',
            'modality',
            'numberOfStudents',
            'guardianAmount',
            'tutorAmount',
            'institutionId',
            'createdAt',
            'updatedAt'
          ]
        },
        SimulateFeePaymentRequest: {
          type: 'object',
          properties: {
            fees: {
              type: 'array',
              items: { $ref: '#/components/schemas/Fee' }
            },
            type: { type: 'string' },
            classModality: { 
              type: 'string', 
              enum: ['inPerson', 'online', 'cancelled'] 
            },
            numberOfStudents: { type: 'integer' },
            duration: { 
              type: 'integer',
              description: 'Duration in minutes'
            }
          },
          required: ['fees', 'type', 'classModality', 'numberOfStudents', 'duration']
        },
        SimulateFeePaymentResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            result: {
              oneOf: [
                { type: 'number' },
                {
                  type: 'object',
                  properties: {
                    guardianAmount: { type: 'number' },
                    tutorAmount: { type: 'number' }
                  },
                  required: ['guardianAmount', 'tutorAmount']
                }
              ]
            }
          },
          required: ['ok', 'result']
        },
        EditFeesRequest: {
          type: 'object',
          properties: {
            fees: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  feeId: { 
                    type: 'integer',
                    description: 'Fee ID to update'
                  },
                  tutorAmount: { 
                    type: 'integer',
                    description: 'New tutor amount'
                  },
                  guardianAmount: { 
                    type: 'integer',
                    description: 'New guardian amount'
                  }
                },
                required: ['feeId', 'tutorAmount', 'guardianAmount']
              },
              minItems: 1,
              description: 'Array of fees to update. Can also be a single fee object for backward compatibility.'
            }
          },
          required: ['fees']
        },
        EditFeesResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['ok', 'message']
        },
        CreateGuardianInput: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Guardian name' },
            email: { type: 'string', format: 'email', description: 'Guardian email' },
            rut: { type: 'string', description: 'Guardian RUT (e.g., 12345678-9)' },
            phone: { type: 'string', nullable: true, description: 'Guardian phone number (optional)' },
            address: { type: 'string', nullable: true, description: 'Guardian address (optional)' },
            chargeEmail: { type: 'string', format: 'email', nullable: true, description: 'Charge email (optional)' },
            institution: { type: 'integer', description: 'Institution ID (required for admin, inferred for coordinator)' }
          },
          required: ['name', 'email', 'rut']
        },
        CreateGuardianResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            guardian: { $ref: '#/components/schemas/User' }
          },
          required: ['ok', 'guardian']
        },
        AddStudentToGuardianRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Student name (required)' },
            institutionId: { type: 'integer', description: 'Institution ID (required)' },
            guardianId: { type: 'integer', description: 'Guardian ID (required)' }
          },
          required: ['name', 'institutionId', 'guardianId']
        },
        AddStudentToGuardianResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            student: { $ref: '#/components/schemas/Student' },
            reactivated: { type: 'boolean', description: 'True when an existing inactive student was reactivated instead of creating a new record' }
          },
          required: ['ok', 'student']
        },
        RemoveStudentFromGuardianRequest: {
          type: 'object',
          properties: {
            guardianId: { type: 'integer', description: 'Guardian ID (required)' },
            studentId: { type: 'integer', description: 'Student ID (required)' }
          },
          required: ['guardianId', 'studentId']
        },
        RemoveStudentFromGuardianResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['ok', 'message']
        }
      }
    }
  },
  apis: ['src/routes/**/*.ts', 'src/controllers/**/*.ts'],
}

export const swaggerSpec = swaggerJSDoc(options)
