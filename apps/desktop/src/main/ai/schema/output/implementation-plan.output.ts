/**
 * Clean Implementation Plan Output Schema
 * ========================================
 *
 * For use with AI SDK Output.object() constrained decoding.
 * Simplified structure suitable for provider-level schema enforcement.
 *
 * For file-based validation with LLM field coercion, use
 * ImplementationPlanSchema from '../implementation-plan' instead.
 */

import { z } from 'zod';

const SubtaskOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'failed']),
  files_to_create: z.array(z.string()),
  files_to_modify: z.array(z.string()),
});

const ParallelGroupOutputSchema = z.object({
  phases: z.array(z.string()),
  reason: z.string().optional(),
});

const ParallelismOutputSchema = z.object({
  max_parallel_phases: z.number().int().min(1).optional(),
  parallel_groups: z.array(ParallelGroupOutputSchema).optional(),
  recommended_workers: z.number().int().min(1).optional(),
}).passthrough();

const PhaseOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  depends_on: z.array(z.union([z.string(), z.number()])).optional(),
  parallel_safe: z.boolean().optional(),
  subtasks: z.array(SubtaskOutputSchema),
});

export const ImplementationPlanOutputSchema = z.object({
  feature: z.string(),
  workflow_type: z.string(),
  phases: z.array(PhaseOutputSchema).min(1),
  summary: z.object({
    parallelism: ParallelismOutputSchema.optional(),
  }).passthrough().optional(),
}).passthrough();

export type ImplementationPlanOutput = z.infer<typeof ImplementationPlanOutputSchema>;
export type PhaseOutput = z.infer<typeof PhaseOutputSchema>;
export type SubtaskOutput = z.infer<typeof SubtaskOutputSchema>;
