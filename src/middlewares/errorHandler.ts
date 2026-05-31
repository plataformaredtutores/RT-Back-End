import { NextFunction, Request, Response } from 'express'

interface AppError extends Error {
  status?: number
  code?: string
  details?: unknown
}

export default function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err.status || 500
  const message = err.message || 'Internal Server Error'

  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error]', err)
  }

  res.status(status).json({
    ok: false,
    message,
    code: err.code,
    details: process.env.NODE_ENV !== 'production' ? err.details : undefined,
  })
}
