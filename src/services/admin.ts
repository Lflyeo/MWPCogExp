/**
 * 管理员端 API：所有请求携带 X-Admin-Token（与后端 ADMIN_SECRET 一致）
 */
import type { UserProfileFields } from '@/types/userProfile';
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const API_PREFIX = '/api';
const ADMIN_TOKEN_KEY = 'mathpro_admin_token';

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

interface ApiResult<T = unknown> {
  errCode: number;
  errMsg: string;
  data: T;
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const token = getAdminToken();
  if (!token) {
    throw new Error('请先登录管理员');
  }
  const url = path.startsWith('/') ? `${BASE_URL}${API_PREFIX}${path}` : `${BASE_URL}${API_PREFIX}/${path}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Admin-Token': token,
    ...(options.headers as HeadersInit),
  };
  const res = await fetch(url, { ...options, headers });
  const json = (await res.json()) as ApiResult<T>;
  if (!res.ok) throw new Error(json.errMsg || res.statusText || '请求失败');
  return json;
}

export interface AdminUserItem extends UserProfileFields {
  id: string;
  username: string;
  nickname?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
}

export interface AdminSolveModelItem {
  id: number;
  model_id: string;
  display_name: string;
  sort_order: number;
  enabled: boolean;
  created_at?: string | null;
}

export interface AdminUniapiConfig {
  base_url: string;
  token: string;
  model?: string | null;
  base_url_knowledge?: string | null;
  token_knowledge?: string | null;
  model_knowledge?: string | null;
  base_url_semantic?: string | null;
  token_semantic?: string | null;
  model_semantic?: string | null;
}

export interface AdminRecordItem extends UserProfileFields {
  id: string;
  question: string;
  answer?: string | null;
  created_at?: string | null;
  user_id?: string | null;
  username?: string | null;
  nickname?: string | null;
}

export interface AdminRecordDetailItem extends AdminRecordItem {
  solution?: string | null;
  knowledge_points?: string[];
  semantic_contexts?: string[];
}

export interface AdminFavoriteItem extends UserProfileFields {
  id: string;
  record_id: string;
  question: string;
  created_at?: string | null;
  user_id?: string | null;
  username?: string | null;
  nickname?: string | null;
}

export function adminUsersList(params: { page?: number; pageSize?: number; keyword?: string }) {
  const search = new URLSearchParams();
  if (params.page != null) search.set('page', String(params.page));
  if (params.pageSize != null) search.set('pageSize', String(params.pageSize));
  if (params.keyword) search.set('keyword', params.keyword);
  const qs = search.toString();
  return adminRequest<AdminUserItem[]>(`/admin/users${qs ? `?${qs}` : ''}`) as Promise<ApiResult<AdminUserItem[]> & { total: number }>;
}

export function adminUserGet(userId: string) {
  return adminRequest<AdminUserItem>(`/admin/users/${userId}`);
}

export function adminUserUpdate(
  userId: string,
  body: {
    avatar_url?: string;
  } & UserProfileFields,
) {
  return adminRequest<{ id: string }>(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function adminUserDelete(userId: string) {
  return adminRequest<Record<string, never>>(`/admin/users/${userId}`, { method: 'DELETE' });
}

export function adminUniapiConfigGet() {
  return adminRequest<AdminUniapiConfig | null>(`/admin/uniapi-config`);
}

export function adminUniapiConfigUpdate(body: {
  base_url?: string;
  token?: string;
  model?: string | null;
  base_url_knowledge?: string | null;
  token_knowledge?: string | null;
  model_knowledge?: string | null;
  base_url_semantic?: string | null;
  token_semantic?: string | null;
  model_semantic?: string | null;
}) {
  return adminRequest<Record<string, never>>(`/admin/uniapi-config`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function adminUserCreate(body: { username: string; password: string } & UserProfileFields) {
  return adminRequest<{ id: string }>(`/admin/users`, { method: 'POST', body: JSON.stringify(body) });
}

export function adminUserUpdatePassword(userId: string, body: { password: string }) {
  return adminRequest<{ id: string }>(`/admin/users/${userId}/password`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function adminUserUploadAvatar(userId: string, file: File) {
  const token = getAdminToken();
  if (!token) {
    throw new Error('请先登录管理员');
  }
  const url = `${BASE_URL}${API_PREFIX}/admin/users/${userId}/avatar`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Admin-Token': token,
    },
    body: formData,
  });
  const json = (await res.json()) as ApiResult<{ url: string }>;
  if (!res.ok || json.errCode !== 0) {
    throw new Error(json.errMsg || res.statusText || '上传失败');
  }
  return json;
}

export function adminSolveModelsList() {
  return adminRequest<AdminSolveModelItem[]>('/admin/solve-models');
}

export function adminSolveModelCreate(body: { model_id: string; display_name: string; sort_order?: number; enabled?: boolean }) {
  return adminRequest<AdminSolveModelItem>('/admin/solve-models', { method: 'POST', body: JSON.stringify(body) });
}

export function adminSolveModelUpdate(id: number, body: { display_name?: string; sort_order?: number; enabled?: boolean }) {
  return adminRequest<AdminSolveModelItem>(`/admin/solve-models/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function adminSolveModelDelete(id: number) {
  return adminRequest<Record<string, never>>(`/admin/solve-models/${id}`, { method: 'DELETE' });
}

export function adminRecordsList(params: { page?: number; pageSize?: number; keyword?: string; user_id?: string }) {
  const search = new URLSearchParams();
  if (params.page != null) search.set('page', String(params.page));
  if (params.pageSize != null) search.set('pageSize', String(params.pageSize));
  if (params.keyword) search.set('keyword', params.keyword);
  if (params.user_id) search.set('user_id', params.user_id);
  const qs = search.toString();
  return adminRequest<AdminRecordItem[]>(`/admin/records${qs ? `?${qs}` : ''}`) as Promise<ApiResult<AdminRecordItem[]> & {
    total: number;
  }>;
}

export function adminRecordDelete(id: string) {
  return adminRequest<Record<string, never>>(`/admin/records/${id}`, { method: 'DELETE' });
}

export function adminRecordDetail(id: string) {
  return adminRequest<AdminRecordDetailItem | null>(`/admin/records/${id}`);
}

export function adminFavoritesList(params: { page?: number; pageSize?: number; keyword?: string; user_id?: string }) {
  const search = new URLSearchParams();
  if (params.page != null) search.set('page', String(params.page));
  if (params.pageSize != null) search.set('pageSize', String(params.pageSize));
  if (params.keyword) search.set('keyword', params.keyword);
  if (params.user_id) search.set('user_id', params.user_id);
  const qs = search.toString();
  return adminRequest<AdminFavoriteItem[]>(`/admin/favorites${qs ? `?${qs}` : ''}`) as Promise<
    ApiResult<AdminFavoriteItem[]> & { total: number }
  >;
}

export function adminFavoriteDelete(id: string) {
  return adminRequest<Record<string, never>>(`/admin/favorites/${id}`, { method: 'DELETE' });
}

/** 模型 API 连接测试返回 data 结构 */
export interface AdminTestResultData {
  success: boolean;
  durationMs?: number;
  model?: string;
}

/** 测试解题模型 API 连接；可选传入 model_id 测试指定模型（如新增/编辑时的模型 ID） */
export function adminTestSolve(modelId?: string) {
  const qs = modelId?.trim() ? `?model_id=${encodeURIComponent(modelId.trim())}` : '';
  return adminRequest<AdminTestResultData>(`/admin/test/solve${qs}`);
}

/** 测试知识点识别模型 API 连接 */
export function adminTestKnowledge() {
  return adminRequest<AdminTestResultData>('/admin/test/knowledge');
}

/** 测试语义情境识别模型 API 连接 */
export function adminTestSemantic() {
  return adminRequest<AdminTestResultData>('/admin/test/semantic');
}

export interface AdminExperimentFlowItem {
  id: string;
  name: string;
  description?: string | null;
  sort_order: number;
  enabled: boolean;
  rest_break_enabled: boolean;
  rest_break_seconds: number;
  rest_break_every?: number;
  question_count: number;
  session_count?: number;
  archived?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminExperimentQuestionItem {
  flow_id: string;
  id: string;
  title?: string | null;
  content: string;
  sort_order: number;
  enabled: boolean;
  mwp_id?: number | null;
  level5?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminExperimentSessionItem extends UserProfileFields {
  id: string;
  flow_id?: string | null;
  flow_name?: string | null;
  status: string;
  started_at?: string | null;
  ended_at?: string | null;
  user_id?: string | null;
  username?: string | null;
  nickname?: string | null;
  question_count: number;
  event_count: number;
  created_at?: string | null;
}

export interface AdminExperimentSessionDetailItem extends AdminExperimentSessionItem {
  payload: Record<string, unknown>;
}

export function adminExperimentFlowsList(params?: { include_archived?: boolean }) {
  const search = new URLSearchParams();
  if (params?.include_archived) search.set('include_archived', 'true');
  const qs = search.toString();
  return adminRequest<AdminExperimentFlowItem[]>(`/admin/experiment-flows${qs ? `?${qs}` : ''}`);
}

export function adminExperimentFlowCreate(body: {
  id: string;
  name: string;
  description?: string;
  sort_order?: number;
  enabled?: boolean;
  rest_break_enabled?: boolean;
  rest_break_seconds?: number;
  rest_break_every?: number;
}) {
  return adminRequest<AdminExperimentFlowItem>('/admin/experiment-flows', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function adminExperimentFlowUpdate(
  id: string,
  body: {
    name?: string;
    description?: string;
    sort_order?: number;
    enabled?: boolean;
    rest_break_enabled?: boolean;
    rest_break_seconds?: number;
    rest_break_every?: number;
  },
) {
  return adminRequest<AdminExperimentFlowItem>(`/admin/experiment-flows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function adminExperimentFlowDelete(id: string) {
  return adminRequest<Record<string, never>>(`/admin/experiment-flows/${id}`, { method: 'DELETE' });
}

export function adminExperimentFlowQuestionsList(flowId: string) {
  return adminRequest<AdminExperimentQuestionItem[]>(`/admin/experiment-flows/${flowId}/questions`);
}

export function adminExperimentFlowQuestionCreate(
  flowId: string,
  body: { id: string; title?: string; content: string; sort_order?: number; enabled?: boolean },
) {
  return adminRequest<AdminExperimentQuestionItem>(`/admin/experiment-flows/${flowId}/questions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function adminExperimentFlowQuestionUpdate(
  flowId: string,
  questionId: string,
  body: { title?: string; content?: string; sort_order?: number; enabled?: boolean },
) {
  return adminRequest<AdminExperimentQuestionItem>(`/admin/experiment-flows/${flowId}/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function adminExperimentFlowQuestionDelete(flowId: string, questionId: string) {
  return adminRequest<Record<string, never>>(`/admin/experiment-flows/${flowId}/questions/${questionId}`, {
    method: 'DELETE',
  });
}

export async function adminExperimentQuestionUploadImage(file: File) {
  const token = getAdminToken();
  if (!token) throw new Error('请先登录管理员');
  const url = `${BASE_URL}${API_PREFIX}/admin/experiment-questions/upload-image`;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Admin-Token': token },
    body: formData,
  });
  const json = (await res.json()) as ApiResult<{ url: string }>;
  if (!res.ok || json.errCode !== 0) {
    throw new Error(json.errMsg || res.statusText || '上传失败');
  }
  return json;
}

export function adminExperimentSessionsList(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  flow_id?: string;
}) {
  const search = new URLSearchParams();
  if (params.page != null) search.set('page', String(params.page));
  if (params.pageSize != null) search.set('pageSize', String(params.pageSize));
  if (params.keyword) search.set('keyword', params.keyword);
  if (params.flow_id) search.set('flow_id', params.flow_id);
  const qs = search.toString();
  return adminRequest<AdminExperimentSessionItem[]>(`/admin/experiment-sessions${qs ? `?${qs}` : ''}`) as Promise<
    ApiResult<AdminExperimentSessionItem[]> & { total: number }
  >;
}

export function adminExperimentSessionDetail(id: string) {
  return adminRequest<AdminExperimentSessionDetailItem | null>(`/admin/experiment-sessions/${id}`);
}

export function adminExperimentSessionDelete(id: string) {
  return adminRequest<Record<string, never>>(`/admin/experiment-sessions/${id}`, { method: 'DELETE' });
}

/** 分层覆盖抽样 */
export interface AdminSamplingRunResult {
  seed: number;
  run_id: string;
  mode: string;
  out_dir: string;
  total_trials: number;
  unique_items: number;
  duplicate_trials: number;
  database_size: number;
  eligible_size: number;
  coverage_vs_database: number;
  coverage_vs_eligible: number;
  eligible_by_level: Record<string, number>;
  warnings: string[];
  files: Record<string, string>;
}

export interface AdminSamplingOutputListItem {
  run_id: string;
  seed: string | number;
  path: string;
  has_assignments: boolean;
  created_at?: number | null;
  coverage?: {
    total_trials?: number;
    unique_items?: number;
    duplicate_trials?: number;
    coverage_vs_eligible?: number;
    coverage_vs_database?: number;
  };
  meta?: {
    seed?: number;
    mode?: string;
    n_participants?: number;
    per_level?: number;
  };
}

export interface AdminSamplingAssignmentItem {
  trial_index: number;
  mwp_id: number;
  level5: string;
  composite_score?: number | null;
  raw_text_preview?: string;
}

export interface AdminSamplingParticipant {
  participant_id: string;
  flow_id: string;
  items: AdminSamplingAssignmentItem[];
}

export interface AdminSamplingOutputDetail {
  run_id: string;
  seed: number | string;
  out_dir: string;
  meta?: Record<string, unknown>;
  n_participants: number;
  participants: AdminSamplingParticipant[];
  preview?: Record<string, unknown>;
  report?: {
    meta?: Record<string, unknown>;
    coverage?: {
      total_trials?: number;
      unique_items?: number;
      duplicate_trials?: number;
      coverage_vs_eligible?: number;
      coverage_vs_database?: number;
      by_level?: Record<string, { total_trials: number; unique_items: number; coverage_rate: number }>;
    };
    issues?: Array<{ severity: string; code: string; message: string }>;
  } | null;
  files: string[];
}

export interface AdminSamplingImportResult {
  seed: number;
  mode: string;
  created_flows: number;
  updated_flows: number;
  created_questions: number;
  n_flows: number;
  flow_ids: string[];
}

export function adminSamplingRun(body: {
  seed?: number;
  mode?: string;
  n_participants?: number;
  per_level?: number;
  include_format_diff?: boolean;
  allow_missing_composite_score?: boolean;
  avoid_adjacent_same_level?: boolean;
}) {
  return adminRequest<AdminSamplingRunResult>('/admin/experiment-sampling/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function adminSamplingOutputsList() {
  return adminRequest<AdminSamplingOutputListItem[]>('/admin/experiment-sampling/outputs');
}

export function adminSamplingOutputDetail(runId: string) {
  return adminRequest<AdminSamplingOutputDetail>(`/admin/experiment-sampling/outputs/${encodeURIComponent(runId)}`);
}

export function adminSamplingImport(body: {
  run_id: string;
  seed?: number;
  replace_existing?: boolean;
  enabled?: boolean;
  rest_break_enabled?: boolean;
  rest_break_seconds?: number;
  rest_break_every?: number;
  participant_ids?: string[] | null;
}) {
  return adminRequest<AdminSamplingImportResult>('/admin/experiment-sampling/import', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 带管理员 Token 的抽样产物文件 URL（用于 img / 下载） */
export function adminSamplingFileUrl(runId: string, filename: string) {
  return `${BASE_URL}${API_PREFIX}/admin/experiment-sampling/outputs/${encodeURIComponent(runId)}/files/${encodeURIComponent(filename)}`;
}

export async function adminSamplingFetchFileBlob(runId: string, filename: string) {
  const token = getAdminToken();
  if (!token) throw new Error('请先登录管理员');
  const res = await fetch(adminSamplingFileUrl(runId, filename), {
    headers: { 'X-Admin-Token': token },
  });
  if (!res.ok) {
    throw new Error(`下载失败: ${res.status}`);
  }
  return res.blob();
}
