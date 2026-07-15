import { z } from 'zod'
import { readRequiredEnv } from '../_shared/env.ts'
import { deleteMuxAsset } from '../_shared/mux.ts'
import { secureEqual } from '../_shared/secret.ts'
import { createAdminClient } from '../_shared/supabase.ts'

const jobSchema = z.object({
  id: z.uuid(),
  scope: z.enum(['post', 'room', 'account']),
  target_id: z.uuid(),
  provider: z.literal('mux'),
  attempts: z.number().int().min(1).max(5),
})

const jobsSchema = z.array(jobSchema)
const assetIdsSchema = z.array(z.object({ mux_asset_id: z.string().min(1) }))

function retryAt(attempts: number): string {
  const delaySeconds = Math.min(3600, 30 * (2 ** Math.max(0, attempts - 1)))
  return new Date(Date.now() + delaySeconds * 1000).toISOString()
}

export async function handleDeletionWorker(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const expected = `Bearer ${readRequiredEnv('DELETION_WORKER_SECRET')}`
  if (!secureEqual(request.headers.get('authorization') ?? '', expected)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const claimResponse = await admin.rpc('claim_deletion_jobs', { p_limit: 10 })
  if (claimResponse.error) return new Response('Claim failed', { status: 500 })
  const jobs = jobsSchema.parse(claimResponse.data)
  const credentials = {
    tokenId: readRequiredEnv('MUX_TOKEN_ID'),
    tokenSecret: readRequiredEnv('MUX_TOKEN_SECRET'),
  }

  let completed = 0
  let retried = 0

  for (const job of jobs) {
    try {
      const assetsResponse = await admin.rpc('get_deletion_job_asset_ids', { p_job_id: job.id })
      if (assetsResponse.error) throw assetsResponse.error
      const assets = assetIdsSchema.parse(assetsResponse.data)

      await Promise.all(assets.map((asset) => deleteMuxAsset(credentials, asset.mux_asset_id)))
      const finishResponse = await admin.rpc('finish_deletion_job', {
        p_job_id: job.id,
        p_succeeded: true,
        p_last_error: null,
        p_next_retry_at: null,
      })
      if (finishResponse.error) throw finishResponse.error
      completed += 1
    } catch {
      const finishResponse = await admin.rpc('finish_deletion_job', {
        p_job_id: job.id,
        p_succeeded: false,
        p_last_error: 'MUX_DELETE_FAILED',
        p_next_retry_at: job.attempts >= 5 ? null : retryAt(job.attempts),
      })
      if (!finishResponse.error) retried += 1
    }
  }

  return Response.json({ claimed: jobs.length, completed, retried })
}

Deno.serve(handleDeletionWorker)
