import { apiGet, apiPost, apiUploadForm } from '@/lib/api';
import type { ExperimentFlow, ExperimentSession, QuestionItem } from '@/modules/experiment/types/experiment';
import { captureElementSnapshot, dataUrlToBlob } from '@/modules/experiment/utils/captureExperimentSnapshot';

export function experimentFlowsList() {
  return apiGet<ExperimentFlow[]>('/experiment/flows');
}

export function experimentFlowDetail(flowId: string) {
  return apiGet<ExperimentFlow>(`/experiment/flows/${flowId}`);
}

export function experimentFlowQuestionsList(flowId: string) {
  return apiGet<QuestionItem[]>(`/experiment/flows/${flowId}/questions`);
}

export function experimentSessionSubmit(session: ExperimentSession) {
  return apiPost<{ id: string }>('/experiment/sessions', {
    sessionId: session.sessionId,
    flowId: session.flowId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    status: session.status,
    questions: session.questions,
    strokes: session.strokes,
    questionAnnotations: session.questionAnnotations ?? {},
  });
}

export async function experimentSnapshotUpload(
  sessionId: string,
  flowId: string,
  questionId: string,
  dataUrl: string,
) {
  const blob = await dataUrlToBlob(dataUrl);
  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('flow_id', flowId);
  form.append('question_id', questionId);
  form.append('file', blob, `${questionId}.png`);
  return apiUploadForm<{ url: string }>('/experiment/snapshots', form);
}

export async function captureAndUploadQuestionSnapshot(
  element: HTMLElement,
  sessionId: string,
  flowId: string,
  questionId: string,
) {
  const dataUrl = await captureElementSnapshot(element);
  const res = await experimentSnapshotUpload(sessionId, flowId, questionId, dataUrl);
  return res.data?.url ?? '';
}
