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
    components: {
      schemas: {
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
            role: { type: 'string', enum: ['admin', 'coordinator', 'tutor', 'parent'] },
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
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['admin', 'coordinator', 'tutor', 'parent'] },
            rut: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            chargeEmail: { type: 'string', nullable: true },
            institutionId: { type: 'integer', nullable: true },
          },
          required: ['name', 'email', 'role']
        },
        Institution: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'createdAt', 'updatedAt']
        },
        CreateInstitutionInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name']
        },
        UserWithInstitution: {
          allOf: [
            { $ref: '#/components/schemas/User' },
            {
              type: 'object',
              properties: {
                Institution: { $ref: '#/components/schemas/Institution' }
              }
            }
          ]
        },
        UserBankAccount: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            userId: { type: 'integer' },
            bankName: { type: 'string' },
            accountType: { type: 'string', enum: ['ahorro', 'corriente', 'vista'] },
            accountNumber: { type: 'string' },
            accountEmail: { type: 'string', format: 'email' },
            rutHolder: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Student: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            parentId: { type: 'integer' },
            institutionId: { type: 'integer' }
          }
        },
        ParentTutor: {
          type: 'object',
          properties: {
            parentId: { type: 'integer' },
            tutorId: { type: 'integer' },
            institutionId: { type: 'integer' },
            active: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
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
                      { $ref: '#/components/schemas/ParentTutor' },
                      {
                        type: 'object',
                        properties: {
                          Parent: { $ref: '#/components/schemas/User' }
                        }
                      }
                    ]
                  } 
                },
                ParentLinks: { 
                  type: 'array', 
                  items: { 
                    allOf: [
                      { $ref: '#/components/schemas/ParentTutor' },
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
            bankName: { type: 'string' },
            accountType: { type: 'string' },
            accountNumber: { type: 'string' },
            rutHolder: { type: 'string' },
            accountEmail: { type: 'string', format: 'email' },
          },
          required: ['userId', 'bankName', 'accountType', 'accountNumber', 'rutHolder', 'accountEmail']
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
                }
              }
            }
          ]
        },
        UserByIdResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            user: { $ref: '#/components/schemas/UserWithInstitution' }
          }
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
        }
      }
    }
  },
  apis: ['src/routes/**/*.ts', 'src/controllers/**/*.ts'],
}

export const swaggerSpec = swaggerJSDoc(options)
