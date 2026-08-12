import { NextResponse } from 'next/server';
import { getRequestUserId } from '@/lib/auth/session';
import { toErrorResponse } from '@/lib/repositories/errors';
import { createMongoDbRepository } from '@/lib/repositories/mongodb/MongoDbProductivityRepository';
import type { ProductivityRepository } from '@/lib/repositories/ProductivityRepository';
import type { PlanVisibility } from '@/src/types/collaboration';

interface RepositoryRequest {
  action: string;
  payload?: Record<string, unknown>;
}

function fail(message: string, code: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

function ok(data: unknown): NextResponse {
  return NextResponse.json({ ok: true, data });
}

/**
 * Generic, authenticated gateway to the MongoDB-backed repository. The UI never talks to
 * MongoDB directly: it posts typed actions here and the server applies ownership checks.
 * Caller-supplied user ids in the payload are ignored — the identity always comes from the
 * validated session cookie.
 */
export async function POST(request: Request) {
  let body: RepositoryRequest;
  try {
    body = (await request.json()) as RepositoryRequest;
  } catch {
    return fail('Invalid request body.', 'BAD_REQUEST', 400);
  }

  const userId = await getRequestUserId(request);
  if (!userId) return fail('Authentication required.', 'UNAUTHORIZED', 401);

  const repository = createMongoDbRepository();
  if (!repository) return fail('MongoDB is not configured.', 'NOT_CONFIGURED', 503);

  return dispatch(repository, body.action, body.payload ?? {}, userId);
}

async function dispatch(
  repo: ProductivityRepository,
  action: string,
  payload: Record<string, unknown>,
  userId: string,
): Promise<NextResponse> {
  try {
    switch (action) {
      case 'currentUser.get':
        return ok({ id: userId, email: '', displayName: '' });
      case 'appData.load':
        return ok(await repo.loadAppData());
      case 'plans.my':
        return ok(await repo.getMyPlans(userId));
      case 'plans.common':
        return ok(await repo.getCommonPlans(userId));
      case 'plans.byId':
        return ok(await repo.getPlanById(Number(payload.planId), userId));
      case 'plans.createPersonal':
        return ok(await repo.createPersonalPlan(userId, payload.input as never));
      case 'plans.createCommon':
        return ok(await repo.createCommonPlan(userId, payload.input as never));
      case 'plans.updatePersonal':
        return ok(await repo.updatePersonalPlan(userId, Number(payload.planId), payload.updates as never));
      case 'plans.updateCommon':
        return ok(
          await repo.updateCommonPlan(
            userId,
            Number(payload.planId),
            payload.updates as never,
            payload.expectedUpdatedAt ? String(payload.expectedUpdatedAt) : undefined,
          ),
        );
      case 'plans.delete':
        return ok(await repo.deletePlan(userId, Number(payload.planId)));
      case 'plans.changeVisibility':
        return ok(
          await repo.changePlanVisibility(userId, Number(payload.planId), payload.visibility as PlanVisibility),
        );
      case 'sessions.list':
        return ok(await repo.getSessions(userId));
      case 'sessions.listPaged':
        return ok(
          await repo.listSessions(
            userId,
            payload.cursor ? String(payload.cursor) : undefined,
            payload.limit ? Number(payload.limit) : undefined,
          ),
        );
      case 'sessions.create':
        return ok(await repo.createSession(userId, payload.input as never));
      case 'presence.set':
        await repo.setUserStatus(userId, payload.status as never);
        return ok(true);
      case 'focus.getActive':
        return ok(await repo.getActiveSharedFocus(userId));
      case 'focus.start':
        return ok(await repo.startSharedFocus(userId, Number(payload.durationMinutes)));
      case 'focus.pause':
        return ok(await repo.pauseSharedFocus(userId, String(payload.sessionId)));
      case 'focus.resume':
        return ok(await repo.resumeSharedFocus(userId, String(payload.sessionId)));
      case 'focus.complete':
        return ok(await repo.completeSharedFocus(userId, String(payload.sessionId)));
      case 'focus.cancel':
        return ok(await repo.cancelSharedFocus(userId, String(payload.sessionId)));
      case 'stats.get':
        return ok(await repo.getStatistics(userId));
      case 'analytics.get':
        return ok(await repo.getAnalytics(userId));
      case 'analytics.refresh':
        return ok(await repo.refreshAnalytics(userId));
      case 'assistant.signals':
        return ok(await repo.getPlanningSignals(userId));
      case 'dashboard.layout.get':
        return ok(await repo.getDashboardLayout(userId));
      case 'dashboard.layout.save':
        return ok(await repo.saveDashboardLayout(userId, payload.layout as never));
      case 'partner.get':
        return ok(await repo.getPartner(userId));
      case 'partner.sharedPlans':
        return ok(await repo.getPartnerSharedPlans(userId));
      case 'partner.statistics':
        return ok(await repo.getPartnerStatistics(userId));
      case 'profile.get':
        return ok(await repo.getProfile(String(payload.userId)));
      case 'privacy.get':
        return ok(await repo.getPrivacySettings(userId));
      case 'privacy.update':
        return ok(await repo.updatePrivacySettings(userId, payload.updates as never));
      case 'privacy.maskedStatus':
        return ok(await repo.getMaskedStatus(userId, payload.status as never));
      case 'conversation.get':
        return ok(await repo.getConversation(userId, String(payload.partnerId)));
      case 'messages.list':
        return ok(
          await repo.listMessages(
            userId,
            String(payload.conversationId),
            payload.cursor ? String(payload.cursor) : undefined,
            payload.limit ? Number(payload.limit) : undefined,
          ),
        );
      case 'messages.listPaged':
        return ok(
          await repo.listMessagesPaged(
            userId,
            String(payload.conversationId),
            payload.cursor ? String(payload.cursor) : undefined,
            payload.limit ? Number(payload.limit) : undefined,
          ),
        );
      case 'messages.send':
        return ok(await repo.sendMessage(userId, String(payload.conversationId), payload.input as never));
      case 'messages.markRead':
        return ok(await repo.markRead(userId, String(payload.conversationId)));
      case 'messages.typing':
        return ok(await repo.sendTyping(userId, String(payload.conversationId)));
      case 'activity.list':
        return ok(
          await repo.listSharedActivity(
            userId,
            payload.cursor ? String(payload.cursor) : undefined,
            payload.limit ? Number(payload.limit) : undefined,
          ),
        );
      case 'plans.listPaged':
        return ok(
          await repo.listPlansPaged(
            userId,
            payload.cursor ? String(payload.cursor) : undefined,
            payload.limit ? Number(payload.limit) : undefined,
          ),
        );
      case 'snapshots.list':
        return ok(
          await repo.listSnapshots(
            userId,
            String(payload.conversationId),
            payload.cursor ? String(payload.cursor) : undefined,
            payload.limit ? Number(payload.limit) : undefined,
          ),
        );
      case 'snapshots.save':
        return ok(await repo.saveSnapshot(userId, String(payload.conversationId), payload.input as never));
      case 'snapshots.export':
        return ok(await repo.exportSnapshots(userId, String(payload.conversationId), (payload.messageIds as string[]) ?? []));
      case 'snapshots.remove':
        return ok(
          await repo.removeSnapshotsAfterExport(userId, String(payload.conversationId), (payload.messageIds as string[]) ?? []),
        );
      case 'privacy.maskedPresence':
        return ok(await repo.getMaskedPresence(userId, payload.status as never));
      case 'media.get':
        return ok(await repo.getMedia(String(payload.mediaId)));
      case 'media.update':
        return ok(await repo.updateMedia(String(payload.mediaId), payload.patch as never));
      default:
        return fail(`Unknown action: ${action}`, 'UNKNOWN_ACTION', 400);
    }
  } catch (error) {
    const { message, code, status } = toErrorResponse(error);
    return fail(message, code, status);
  }
}
