export type ScheduledTaskRecurrence =
  | {
      kind: 'daily';
      timeOfDay: string;
    }
  | {
      kind: 'weekly';
      timeOfDay: string;
      daysOfWeek: number[];
    };

export interface ScheduledTaskDefinition {
  id: string;
  projectId: string;
  name: string;
  prompt: string;
  recurrence: ScheduledTaskRecurrence;
  enabled: boolean;
  autoStart: boolean;
  lastFiredAt?: string;
  nextRunAt?: string;
  lastError?: string;
}

export interface CreateScheduledTaskInput {
  projectId: string;
  name: string;
  prompt: string;
  recurrence: ScheduledTaskRecurrence;
  enabled?: boolean;
  autoStart?: boolean;
}

export interface UpdateScheduledTaskInput extends Partial<CreateScheduledTaskInput> {
  enabled?: boolean;
  lastError?: string;
}
