import { UserRole, PaymentStatus, PaymentType } from "@prisma/client"
import { Request, Response, NextFunction } from "express"
import prisma from "../lib/prisma"
import { calculateFeeAmount } from "./utils"

function getMonthBounds(value: Date) {
  const year = value.getUTCFullYear()
  const month = value.getUTCMonth()

  return {
    monthStart: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    monthEnd: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  }
}

function roundClassAmount(value: number) {
  const base = Math.trunc(value)
  const decimals = value - base
  return decimals >= 0.5 ? base + 1 : base
}

export async function createClass(req: Request, res: Response, next: NextFunction) {
  try {
    const role = (req as any).auth.role as UserRole

    const { 
      studentId, 
      date, 
      numberOfStudents,
      duration,
      subject,
      type,
      modality
    } = req.body

    const classDate = new Date(date)

    if (Number.isNaN(classDate.getTime())) {
      return res.status(400).json({ message: "Invalid class date" })
    }

    let institutionId: number | undefined = undefined
    let tutorId: number | undefined = undefined

    if (role === UserRole.tutor) {
      institutionId = (req as any).auth.institutionId
      tutorId = (req as any).auth.uid
    } else {
      if (role === UserRole.coordinator) {
        institutionId = (req as any).auth.institutionId
        tutorId = (req.body as any).tutorId
      } else if (role === UserRole.admin) {
        institutionId = (req.body as any).institutionId
        tutorId = (req.body as any).tutorId
      } else {
        return res.status(403).json({ message: "Forbidden" })
      }
    }

    const { monthStart, monthEnd } = getMonthBounds(classDate)

    const [adminPayment, coordinatorPayment] = await Promise.all([
      prisma.adminPayment.findFirst({
        where: {
          period: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        select: { period: true },
      }),
      institutionId === undefined
        ? Promise.resolve(null)
        : prisma.coordinatorPayment.findFirst({
            where: {
              institutionId,
              period: {
                gte: monthStart,
                lte: monthEnd,
              },
            },
            select: { id: true },
          }),
    ])

    if (adminPayment) {
      return res.status(409).json({
        message: "No se puede crear una clase cuando ya se ha pagado al admin",
      })
    }

    if (coordinatorPayment) {
      return res.status(409).json({
        message: "No se puede crear una clase cuando ya se ha pagado al coordinador",
      })
    }

    if (tutorId !== undefined && tutorId !== null) {
      const completedTutorPayment = await prisma.classPayment.findFirst({
        where: {
          tutorPaymentStatus: PaymentStatus.completed,
          Class: {
            tutorId,
            date: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        },
        select: { id: true },
      })

      if (completedTutorPayment) {
        return res.status(409).json({
          message: "No se puede crear una clase si ya se ha pagado al tutor",
        })
      }
    }

    const createData: any = {
      date: classDate,
      numberOfStudents,
      duration,
      subject,
      type,
      modality,
      Student: { connect: { id: studentId } }
    }

    if (tutorId !== undefined && tutorId !== null) {
      createData.Tutor = { connect: { id: tutorId } }
    }
    if (institutionId !== undefined && institutionId !== null) {
      createData.Institution = { connect: { id: institutionId } }
    }

    const newClass = await prisma.class.create({
      data: createData
    })

    const classFee = await prisma.fee.findFirst({
      where: {
        type,
        modality,
        numberOfStudents,
        institutionId
      }
    })

    let amounts = { guardianAmount: 0, tutorAmount: 0 }

    if (classFee) {
      amounts = calculateFeeAmount(classFee, duration)
    }

    const roundedGuardianAmount = roundClassAmount(amounts.guardianAmount)
    const roundedTutorAmount = roundClassAmount(amounts.tutorAmount)

    const classPayment = await prisma.classPayment.create({
      data: {
        classId: newClass.id,
        guardianAmount: roundedGuardianAmount,
        tutorAmount: roundedTutorAmount
      }
    })
    return res.status(201).json({ class: newClass, classPayment })

  } catch (err) {
    next(err)
  }
}



export async function getClassesCashFlowSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const role = (req as any).auth.role as UserRole
    const { 
      startDate,
      endDate,
      tutorId,
      guardianId,
      studentId,
    } = req.query

    // Guardian
    if (role === UserRole.guardian) {
      const guardianId = (req as any).auth.uid
      const institutionId = (req as any).auth.institutionId
      
      const pendingAmount = await prisma.classPayment.aggregate({
        _sum: {
          guardianAmount: true
        },
        where: {
          guardianPaymentStatus: PaymentStatus.pending,
          Class: {
            Student: {
              guardianId: guardianId
            },
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
            studentId: studentId ? Number(studentId) : undefined,
            tutorId: tutorId ? Number(tutorId) : undefined,
            institutionId: institutionId
          }
        }
      })

      const paidAmount = await prisma.classPayment.aggregate({
        _sum: {
          guardianAmount: true
        },
        where: {
          guardianPaymentStatus: PaymentStatus.completed,
          Class: {
            Student: {
              guardianId: guardianId
            },
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
            studentId: studentId ? Number(studentId) : undefined,
            tutorId: tutorId ? Number(tutorId) : undefined,
            institutionId: institutionId
          }
        }
      })

      return res.json({
        pendingAmount: pendingAmount._sum.guardianAmount || 0,
        paidAmount: paidAmount._sum.guardianAmount || 0
      })
    }

    // Tutor
    if (role === UserRole.tutor){
      const tutorId = (req as any).auth.uid
      const institutionId = (req as any).auth.institutionId

      const pendingAmount = await prisma.classPayment.aggregate({
        _sum: {
          tutorAmount: true
        },
        where: {
          tutorPaymentStatus: PaymentStatus.pending,
          Class: {
            tutorId: tutorId,
            Student: guardianId ? {
              guardianId: Number(guardianId)
            } : undefined,
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
            studentId: studentId ? Number(studentId) : undefined,
            institutionId: institutionId
          }
        }
      })

      const paidAmount = await prisma.classPayment.aggregate({
        _sum: {
          tutorAmount: true
        },
        where: {
          tutorPaymentStatus: PaymentStatus.completed,
          Class: {
            tutorId: tutorId,
            Student: guardianId ? {
              guardianId: Number(guardianId)
            } : undefined,
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
            studentId: studentId ? Number(studentId) : undefined,
            institutionId: institutionId
          }
        }
      })

      return res.json({
        pendingAmount: pendingAmount._sum.tutorAmount || 0,
        paidAmount: paidAmount._sum.tutorAmount || 0
      })
    }
    // Coordinator
    if (role === UserRole.coordinator) {
      const institutionId = (req as any).auth.institutionId

      const pendingIncomes = await prisma.classPayment.aggregate({
        _sum: {
          guardianAmount: true
        },
        where: {
          guardianPaymentStatus: PaymentStatus.pending,
          Class: {
            Student: guardianId ? {
              guardianId: Number(guardianId)
            } : undefined,
            Institution: {
              id: institutionId
            },
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
            tutorId: tutorId ? Number(tutorId) : undefined,
            studentId: studentId ? Number(studentId) : undefined,
          }
        }
      })

      const receivedIncomes = await prisma.classPayment.aggregate({
        _sum: {
          guardianAmount: true
        },
        where: {
          guardianPaymentStatus: PaymentStatus.completed,
          Class: {
            Student: guardianId ? {
              guardianId: Number(guardianId)
            } : undefined,
            Institution: {
              id: institutionId
            },
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
            tutorId: tutorId ? Number(tutorId) : undefined,
            studentId: studentId ? Number(studentId) : undefined,
          }
        }
      })

      const pendingExpenses = await prisma.classPayment.aggregate({
        _sum: {
          tutorAmount: true
        },
        where: {
          tutorPaymentStatus: PaymentStatus.pending,
          Class: {
            Student: guardianId ? {
              guardianId: Number(guardianId)
            } : undefined,
            Institution: {
              id: institutionId
            },
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
            tutorId: tutorId ? Number(tutorId) : undefined,
            studentId: studentId ? Number(studentId) : undefined,
          }
        }
      })

      const paidExpenses = await prisma.classPayment.aggregate({
        _sum: {
          tutorAmount: true
        },
        where: {
          tutorPaymentStatus: PaymentStatus.completed,
          Class: {
            Student: guardianId ? {
              guardianId: Number(guardianId)
            } : undefined,
            Institution: {
              id: institutionId
            },
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new  Date(endDate as string) : undefined,
            },
            tutorId: tutorId ? Number(tutorId) : undefined,
            studentId: studentId ? Number(studentId) : undefined,
          }
        }
      })

      return res.json({
        pendingIncomes: pendingIncomes._sum.guardianAmount || 0,
        receivedIncomes: receivedIncomes._sum.guardianAmount || 0,
        pendingExpenses: pendingExpenses._sum.tutorAmount || 0,
        paidExpenses: paidExpenses._sum.tutorAmount || 0
      })
    }
    // Admin
    if (role === UserRole.admin) {
      const { institutionId } = req.query
      
      const pendingIncomes = await prisma.classPayment.aggregate({
        _sum: {
          guardianAmount: true
        },
        where: {
          guardianPaymentStatus: PaymentStatus.pending,
          Class: {
            Student: guardianId ? {
              guardianId: Number(guardianId)
            } : undefined,
            Institution: {
              id: institutionId ? Number(institutionId) : undefined
            },
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
            tutorId: tutorId ? Number(tutorId) : undefined,
            studentId: studentId ? Number(studentId) : undefined,
          }
        }
      })

      const receivedIncomes = await prisma.classPayment.aggregate({
        _sum: {
          guardianAmount: true
        },
        where: {
          guardianPaymentStatus: PaymentStatus.completed,
          Class: {
            Student: guardianId ? {
              guardianId: Number(guardianId)
            } : undefined,
            Institution: {
              id: institutionId ? Number(institutionId) : undefined
            },
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
            tutorId: tutorId ? Number(tutorId) : undefined,
            studentId: studentId ? Number(studentId) : undefined,
          }
        }
      })

      const pendingExpenses = await prisma.classPayment.aggregate({
        _sum: {
          tutorAmount: true
        },
        where: {
          tutorPaymentStatus: PaymentStatus.pending,
          Class: {
            Student: guardianId ? {
              guardianId: Number(guardianId)
            } : undefined,
            Institution: {
              id: institutionId ? Number(institutionId) : undefined
            },
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new Date(endDate as string) : undefined,
            },
            tutorId: tutorId ? Number(tutorId) : undefined,
            studentId: studentId ? Number(studentId) : undefined,
          }
        }
      })

      const paidExpenses = await prisma.classPayment.aggregate({
        _sum: {
          tutorAmount: true
        },
        where: {
          tutorPaymentStatus: PaymentStatus.completed,
          Class: {
            Student: guardianId ? {
              guardianId: Number(guardianId)
            } : undefined,
            Institution: {
              id: institutionId ? Number(institutionId) : undefined
            },
            date: {
              gte: startDate ? new Date(startDate as string) : undefined,
              lte: endDate ? new  Date(endDate as string) : undefined,
            },
            tutorId: tutorId ? Number(tutorId) : undefined,
            studentId: studentId ? Number(studentId) : undefined,
          }
        }
      })

      return res.json({
        pendingIncomes: pendingIncomes._sum.guardianAmount || 0,
        receivedIncomes: receivedIncomes._sum.guardianAmount || 0,
        pendingExpenses: pendingExpenses._sum.tutorAmount || 0,
        paidExpenses: paidExpenses._sum.tutorAmount || 0
      })
    }
  } catch (err) {
    next(err)
  }
}

export async function getClassesDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const role = (req as any).auth.role as UserRole
    const { 
      startDate,
      endDate,
      tutorId,
      studentId,
      guardianId,
      page,
      pageSize
    } = req.query

    // Guardian
    if (role === UserRole.guardian) {
      const guardianId = (req as any).auth.uid
      const institutionId = (req as any).auth.institutionId
      
      const classes = await prisma.class.findMany({
        where: {
          Student: {
            guardianId: guardianId
          },
          date: {
            gte: startDate ? new Date(startDate as string) : undefined,
            lte: endDate ? new Date(endDate as string) : undefined,
          },
          studentId: studentId ? Number(studentId) : undefined,
          tutorId: tutorId ? Number(tutorId) : undefined,
          institutionId: institutionId
        },
        skip: page && pageSize ? (Number(page) - 1) * Number(pageSize) : undefined,
        take: pageSize ? Number(pageSize) : undefined,
        include: {
          ClassPayment: true,
          Tutor: {
            select: {
              id: true,
              name: true,
            }
          },
          Student: {
            select: {
              id: true,
              name: true,
              Guardian: {
                select: {
                  id: true,
                  name: true,
                }
              }
            }
          },
          Institution: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      })

      return res.json(classes)
    }

    // Tutor
    if (role === UserRole.tutor){
      const tutorId = (req as any).auth.uid
      const institutionId = (req as any).auth.institutionId

      const classes = await prisma.class.findMany({
        where: {
          Student: guardianId ? {
            guardianId: Number(guardianId)
          } : undefined,
          tutorId: tutorId,
          date: {
            gte: startDate ? new Date(startDate as string) : undefined,
            lte: endDate ? new Date(endDate as string) : undefined,
          },
          studentId: studentId ? Number(studentId) : undefined,
          institutionId: institutionId
        },
        skip: page && pageSize ? (Number(page) - 1) * Number(pageSize) : 0,
        take: pageSize ? Number(pageSize) : 10,
        include: {
          ClassPayment: true,
          Tutor: {
            select: {
              id: true,
              name: true,
            }
          },
          Student: {
            select: {
              id: true,
              name: true,
              Guardian: {
                select: {
                  id: true,
                  name: true,
                }
              }
            }
          },
          Institution: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      })

      return res.json(classes)
    }
    // Coordinator
    if (role === UserRole.coordinator) {
      const institutionId = (req as any).auth.institutionId

      const classes = await prisma.class.findMany({
        where: {
          Student: guardianId ? {
            guardianId: Number(guardianId)
          } : undefined,
          Institution: {
            id: institutionId
          },
          date: {
            gte: startDate ? new Date(startDate as string) : undefined,
            lte: endDate ? new Date(endDate as string) : undefined,
          },
          tutorId: tutorId ? Number(tutorId) : undefined,
          studentId: studentId ? Number(studentId) : undefined,
        },
        skip: page && pageSize ? (Number(page) - 1) * Number(pageSize) : undefined,
        take: pageSize ? Number(pageSize) : undefined,
        include: {
          ClassPayment: true,
          Tutor: {
            select: {
              id: true,
              name: true,
            }
          },
          Student: {
            select: {
              id: true,
              name: true,
              Guardian: {
                select: {
                  id: true,
                  name: true,
                }
              }
            }
          },
          Institution: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      })

      return res.json(classes)

    }
    // Admin
    if (role === UserRole.admin) {
      const { institutionId } = req.query
      
      const classes = await prisma.class.findMany({
        where: {
          Student: guardianId ? {
            guardianId: Number(guardianId)
          } : undefined,
          Institution: {
            id: institutionId ? Number(institutionId) : undefined
          },
          date: {
            gte: startDate ? new Date(startDate as string) : undefined,
            lte: endDate ? new Date(endDate as string) : undefined,
          },
          tutorId: tutorId ? Number(tutorId) : undefined,
          studentId: studentId ? Number(studentId) : undefined,
        },
        skip: page && pageSize ? (Number(page) - 1) * Number(pageSize) : undefined,
        take: pageSize ? Number(pageSize) : undefined,
        include: {
          ClassPayment: true,
          Tutor: {
            select: {
              id: true,
              name: true,
            }
          },
          Student: {
            select: {
              id: true,
              name: true,
              Guardian: {
                select: {
                  id: true,
                  name: true,
                }
              }
            }
          },
          Institution: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      })

      return res.json(classes)
    }
  } catch (err) {
    next(err)
  }
}

export async function deleteClass(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId } = req.params

    if (Number.isNaN(Number(classId))) {
      return res.status(400).json({ message: "Invalid class ID" })
    }

    const classWithPayment = await prisma.class.findUnique({
      where: {
        id: Number(classId)
      },
      include: {
        ClassPayment: true
      }
    })

    if (!classWithPayment) { 
      return res.status(404).json({ message: "Class not found" })
    }

    const payment = classWithPayment.ClassPayment

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" })
    }

    if (payment.guardianPaymentStatus !== PaymentStatus.pending || payment.tutorPaymentStatus !== PaymentStatus.pending) {
      return res.status(409).json({ message: "Class cannot be deleted because guardian or tutor payment is already completed"})
    }

    await prisma.$transaction([
      prisma.classPayment.delete({
        where: { id: payment.id }
      }),
      prisma.class.delete({
        where: { id: Number(classId) }
      })
    ])

    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

export async function updateClassPaymentStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { classPaymentId } = req.params

    const {
      guardianPaymentStatus,
      tutorPaymentStatus,
      guardianPaymentType,
    } = req.body

    const data: any = {}

    if (guardianPaymentStatus !== undefined) {
      data.guardianPaymentStatus = guardianPaymentStatus
    }

    if (tutorPaymentStatus !== undefined) {
      data.tutorPaymentStatus = tutorPaymentStatus
    }

    if (guardianPaymentType !== undefined) {
      data.guardianPaymentType = guardianPaymentType
    }

    const updatedClassPayment = await prisma.classPayment.update({
      where: { id: Number(classPaymentId) },
      data
    })

    res.json(updatedClassPayment)
  } catch (err) {
    next(err)
  }
}

export async function updateGuardianClassPaymentStatusByGuardianId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { guardianPaymentStatus, periodStart, periodEnd, guardianId } = req.body

    const data: any = {}

    if (guardianPaymentStatus === PaymentStatus.pending) {
      data.guardianPaymentStatus = guardianPaymentStatus
    }

    if (guardianPaymentStatus === PaymentType.bankTransfer || guardianPaymentStatus === PaymentType.card) {
      data.guardianPaymentType = guardianPaymentStatus
      data.guardianPaymentStatus = PaymentStatus.completed
    }

    const updatedClassPayments = await prisma.classPayment.updateMany({
      where: {
        Class: {
          date: {
            gte: periodStart ? new Date(periodStart) : undefined,
            lte: periodEnd ? new Date(periodEnd) : undefined,
          },
          Student: {
            guardianId: guardianId ? Number(guardianId) : undefined
          }
        }
      },
      data
    })

    res.json(updatedClassPayments)
  } catch (err) {
    next(err)
  }
}