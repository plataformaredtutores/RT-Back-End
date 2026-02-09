import prisma from '../lib/prisma'

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000

export async function purgeDeactivatedUsers(): Promise<number> {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)

  const result = await prisma.user.deleteMany({
    where: {
      isActive: false,
      deactivatedAt: { lt: cutoff },
      BankAccount: { is: null },
      GuardianLinks: { none: {} },
      TutorLinks: { none: {} },
      Students: { none: {} },
      ClassesAsTutor: { none: {} },
      RefreshTokens: { none: {} },
      coordinatorPayments: { none: {} },
      coordinatorProfitShares: { none: {} },
    },
  })

  return result.count
}

export function startUserCleanupJob() {
  if (process.env.ENABLE_USER_CLEANUP !== 'true') {
    return
  }

  const intervalMs = Number(process.env.USER_CLEANUP_INTERVAL_MS) || DEFAULT_INTERVAL_MS

  const run = async () => {
    try {
      const count = await purgeDeactivatedUsers()
      if (count > 0) {
        console.log(`[cleanup] Permanently deleted ${count} users inactive > 1 year`)
      }
    } catch (err) {
      console.error('[cleanup] Failed to purge deactivated users', err)
    }
  }

  void run()
  setInterval(run, intervalMs).unref()
}
