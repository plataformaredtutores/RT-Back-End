import { createTransport } from 'nodemailer'
export type MailAddress = string

export type SendEmailParams = {
  to: MailAddress[] | MailAddress
  cc?: MailAddress[] | MailAddress
  bcc?: MailAddress[] | MailAddress
  subject: string
  text?: string
  html?: string
  replyTo?: MailAddress
}

const transporter = createTransport({
  host: process.env.SMTP_SERVER,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const DEFAULT_FROM = 'no-reply@redtutores.com'

export async function sendEmail(params: SendEmailParams) {
  if (!params.text && !params.html) {
    throw new Error('Either text or html body must be provided')
  }

  const info = await transporter.sendMail({
    from: DEFAULT_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
  })

  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected }
}
