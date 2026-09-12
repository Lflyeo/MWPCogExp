import { formatDuration } from './computeExperimentStats';
import type { EventRecord } from '../types/experiment';

export type QuestionDurationView = {
  questionId: string;
  index: number;
  title?: string;
  durationMs: number;
};

function durationFromEvents(events: EventRecord[]): number {
  const start = events.find((e) => e.type === 'question_start')?.timestamp;
  const end = [...events].reverse().find((e) => e.type === 'question_end')?.timestamp;
  if (start && end && end >= start) return end - start;
  const endEvent = [...events].reverse().find((e) => e.type === 'question_end');
  const fromData = endEvent?.data?.durationMs;
  return typeof fromData === 'number' && fromData > 0 ? fromData : 0;
}

function normalizeQuestionDuration(raw: unknown, index: number): QuestionDurationView | null {
  if (!raw || typeof raw !== 'object') return null;
  const q = raw as {
    questionId?: string;
    question_id?: string;
    title?: string;
    answerDurationMs?: number;
    answer_duration_ms?: number;
    events?: EventRecord[];
  };
  const questionId = String(q.questionId ?? q.question_id ?? '');
  if (!questionId) return null;

  let durationMs =
    typeof q.answerDurationMs === 'number'
      ? q.answerDurationMs
      : typeof q.answer_duration_ms === 'number'
        ? q.answer_duration_ms
        : 0;
  if (!durationMs && Array.isArray(q.events)) {
    durationMs = durationFromEvents(q.events);
  }

  return {
    questionId,
    index: index + 1,
    title: typeof q.title === 'string' ? q.title : undefined,
    durationMs: Math.max(0, durationMs),
  };
}

/** 从会话 payload 提取各题作答耗时（与用户端实验结果一致） */
export function extractQuestionDurations(payload: Record<string, unknown>): QuestionDurationView[] {
  const questions = payload.questions;
  if (!Array.isArray(questions)) return [];
  return questions
    .map((q, index) => normalizeQuestionDuration(q, index))
    .filter((item): item is QuestionDurationView => item !== null);
}

export function summarizeQuestionDurations(items: QuestionDurationView[]) {
  const totalAnswerMs = items.reduce((sum, item) => sum + item.durationMs, 0);
  const averageAnswerMs = items.length > 0 ? Math.round(totalAnswerMs / items.length) : 0;
  return { totalAnswerMs, averageAnswerMs };
}

export { formatDuration };
