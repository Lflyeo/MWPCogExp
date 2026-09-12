import type { ExperimentData, ExperimentSession } from '../types/experiment';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString();
}

type ExportPayload = {
  sessionId?: string;
  startedAt?: number | null;
  endedAt?: number | null;
  status?: string;
  questions?: ExperimentData[];
  strokes?: Record<string, unknown>;
  questionAnnotations?: Record<string, unknown>;
};

function normalizePayload(sessionId: string, payload: ExportPayload | ExperimentSession) {
  if ('sessionId' in payload && 'questions' in payload && Array.isArray(payload.questions)) {
    const raw = payload as ExportPayload;
    return {
      sessionId: raw.sessionId,
      startedAt: raw.startedAt ?? null,
      endedAt: raw.endedAt ?? null,
      status: raw.status ?? 'ended',
      questions: raw.questions ?? [],
      strokes: raw.strokes ?? {},
      questionAnnotations: raw.questionAnnotations ?? {},
    };
  }
  const session = payload as ExperimentSession;
  return {
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    status: session.status,
    questions: session.questions,
    strokes: session.strokes,
    questionAnnotations: session.questionAnnotations ?? {},
  };
}

export function exportPayloadAsJson(sessionId: string, payload: ExportPayload | ExperimentSession) {
  const data = normalizePayload(sessionId, payload);
  const output = {
    sessionId: data.sessionId,
    startedAt: data.startedAt ? formatTimestamp(data.startedAt) : null,
    endedAt: data.endedAt ? formatTimestamp(data.endedAt) : null,
    status: data.status,
    questions: data.questions.map((q) => ({
      questionId: q.questionId,
      answerDurationMs: q.answerDurationMs,
      screenSnapshot: q.screenSnapshot,
      events: q.events,
      strokes: (data.strokes as Record<string, unknown>)[q.questionId] ?? [],
      questionAnnotations: (data.questionAnnotations as Record<string, unknown>)[q.questionId] ?? [],
    })),
  };
  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `experiment-${sessionId}.json`);
}

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportPayloadAsCsv(sessionId: string, payload: ExportPayload | ExperimentSession) {
  const data = normalizePayload(sessionId, payload);
  const headers = ['sessionId', 'questionId', 'timestamp', 'isoTime', 'eventType', 'data'];
  const rows: string[] = [headers.join(',')];

  for (const question of data.questions) {
    for (const event of question.events) {
      rows.push(
        [
          sessionId,
          question.questionId,
          event.timestamp,
          formatTimestamp(event.timestamp),
          event.type,
          event.data ? JSON.stringify(event.data) : '',
        ]
          .map(escapeCsvField)
          .join(','),
      );
    }
  }

  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `experiment-${sessionId}.csv`);
}

export function getQuestionData(session: ExperimentSession, questionId: string): ExperimentData | undefined {
  return session.questions.find((q) => q.questionId === questionId);
}
