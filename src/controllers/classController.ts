import { UserRole } from "@prisma/client"
import { Request, Response, NextFunction } from "express"
import prisma from "../lib/prisma"

export async function createClass(req: Request, res: Response, next: NextFunction) {
  try {
    const role = (req as any).auth.role as UserRole

    console.log("Auth", (req as any).auth)

    console.log("Role:", role)
    console.log("User ID:", (req as any).auth.userId)

    const { 
      studentId, 
      date, 
      numberOfStudents,
      duration,
      subject,
      type,
      modality
    } = req.body

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

    const createData: any = {
      date: new Date(date),
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
    const classPayment = await prisma.classPayment.create({
      data: {
        classId: newClass.id,
        guardianAmount: classFee ? classFee.guardianAmount : 0,
        tutorAmount: classFee ? classFee.tutorAmount : 0
      }
    })

    return res.status(201).json({ class: newClass, classPayment })

    

  } catch (err) {
    next(err)
  }
}