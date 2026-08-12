import { type Plan, type PlanFile } from '@/src/types';

export interface CreatePlanFromFileInput {
  file: File;
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  priority?: string;
  category?: string;
  date?: string;
}

export async function createPlanFromFile(planId: number, input: CreatePlanFromFileInput): Promise<Plan> {
  const form = new FormData();
  form.append('file', input.file);
  if (input.title) form.append('title', input.title);
  if (input.description) form.append('description', input.description);
  if (input.type) form.append('type', input.type);
  if (input.status) form.append('status', input.status);
  if (input.priority) form.append('priority', input.priority);
  if (input.category) form.append('category', input.category);
  if (input.date) form.append('date', input.date);

  const res = await fetch(`/api/plans/${planId}/file`, { method: 'POST', body: form });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new Error(payload.error || `Upload failed (${res.status})`);
  }
  const data = (await res.json()) as { plan: Plan };
  return data.plan;
}

export async function getPlanFile(planId: number): Promise<PlanFile | null> {
  const res = await fetch(`/api/plans/${planId}/file`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load file metadata (${res.status})`);
  const data = (await res.json()) as { file: PlanFile };
  return data.file;
}

export function planFileOpenUrl(planId: number): string {
  return `/api/plans/${planId}/file?action=open`;
}

export function planFileDownloadUrl(planId: number): string {
  return `/api/plans/${planId}/file?action=download`;
}

export async function deletePlanFile(planId: number): Promise<boolean> {
  const res = await fetch(`/api/plans/${planId}/file`, { method: 'DELETE' });
  if (res.status === 404) return true;
  return res.ok;
}
