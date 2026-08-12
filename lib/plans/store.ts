import fs from 'fs';
import path from 'path';
import { getDefaultData } from '@/src/utils/defaults';
import { isValidAppData } from '@/src/validators';
import { type AppData, type Plan, type PlanFile } from '@/src/types';
const DATA_DIR = path.join(process.cwd(), 'storage');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const BACKUP_FILE = path.join(DATA_DIR, 'data.json.bak');
const TEMP_FILE = path.join(DATA_DIR, 'data.json.tmp');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAppData(): AppData {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    const defaults = getDefaultData();
    writeAppData(defaults);
    return defaults;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    if (fs.existsSync(BACKUP_FILE)) {
      parsed = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
    } else {
      const defaults = getDefaultData();
      writeAppData(defaults);
      return defaults;
    }
  }
  return isValidAppData(parsed) ? parsed : getDefaultData();
}

function writeAppData(data: AppData): void {
  ensureDir();
  if (fs.existsSync(DATA_FILE)) {
    fs.copyFileSync(DATA_FILE, BACKUP_FILE);
  }
  fs.writeFileSync(TEMP_FILE, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(TEMP_FILE, DATA_FILE);
}

export function findPlan(planId: string | number): Plan | null {
  const id = Number(planId);
  const data = readAppData();
  return data.plans.find((p) => p.id === id) ?? null;
}

export function createPlan(plan: Plan): Plan {
  const data = readAppData();
  const existing = data.plans.findIndex((p) => p.id === plan.id);
  if (existing !== -1) {
    data.plans[existing] = plan;
  } else {
    data.plans.unshift(plan);
  }
  writeAppData(data);
  return plan;
}

export function updatePlan(planId: string | number, updater: (plan: Plan) => Plan): Plan | null {
  const id = Number(planId);
  const data = readAppData();
  const index = data.plans.findIndex((p) => p.id === id);
  if (index === -1) return null;
  data.plans[index] = updater(data.plans[index]);
  writeAppData(data);
  return data.plans[index];
}

export function setPlanFile(planId: string | number, file: PlanFile): Plan | null {
  return updatePlan(planId, (plan) => ({ ...plan, file }));
}

export function clearPlanFile(planId: string | number): Plan | null {
  return updatePlan(planId, (plan) => ({ ...plan, file: null }));
}
