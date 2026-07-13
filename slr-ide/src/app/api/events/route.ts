import { globalEventManager } from '@/lib/services/global-event-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
  return globalEventManager.createEventStream();
}
