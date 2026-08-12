import './loadEnv';
import { ensureIndexes } from '@/lib/mongodb/indexes';
import { recomputeAllAnalytics } from '@/lib/analytics/service';

/**
 * CLI: ensure analytics indexes, then recompute daily/weekly/monthly aggregates for every
 * user that has history and surface any generated insights. Idempotent and safe to run
 * alongside normal reads. Usage: `npm run analytics:compute`.
 */
async function main(): Promise<void> {
  const indexes = await ensureIndexes();
  console.log(`Indexes ensured (${indexes.length}).`);

  const { users } = await recomputeAllAnalytics();
  console.log(`Analytics recomputed for ${users} user(s).`);

  if (users === 0) {
    console.log('No history found — nothing to aggregate yet. Add sessions or plans first.');
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Analytics computation failed:', error);
    process.exit(1);
  });
