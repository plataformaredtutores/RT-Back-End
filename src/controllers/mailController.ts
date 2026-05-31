import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { sendEmail } from '../services/mailService'

const emailRegex = /.+@.+\..+/
const EmailAddress = z.string().regex(emailRegex, 'Invalid email')

const MailRequestSchema = z
  .object({
    to: z.union([EmailAddress, z.array(EmailAddress).nonempty()]),
    cc: z.union([EmailAddress, z.array(EmailAddress)]).optional(),
    bcc: z.union([EmailAddress, z.array(EmailAddress)]).optional(),
    subject: z.string().min(1),
    text: z.string().optional(),
    html: z.string().optional(),
    replyTo: EmailAddress.optional(),
  })
  .refine((d) => d.text || d.html, {
    message: 'Either text or html must be provided',
    path: ['text'],
  })

export async function postMail(req: Request, res: Response, next: NextFunction) {
  try {
    const data = MailRequestSchema.parse(req.body)

    const result = await sendEmail({
      to: data.to,
      cc: data.cc,
      bcc: data.bcc,
      subject: data.subject,
      text: data.text,
      html: data.html,
      replyTo: data.replyTo,
    })

    res.status(202).json({ ok: true, id: result.messageId, accepted: result.accepted })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return res.status(400).json({ ok: false, errors: err.issues })
    }
    next(err)
  }
}
