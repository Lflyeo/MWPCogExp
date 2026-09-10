import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, X, Upload, Type, ImageIcon, Loader2, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  adminExperimentFlowsList,
  adminExperimentFlowCreate,
  adminExperimentFlowUpdate,
  adminExperimentFlowDelete,
  adminExperimentFlowQuestionsList,
  adminExperimentFlowQuestionCreate,
  adminExperimentFlowQuestionUpdate,
  adminExperimentFlowQuestionDelete,
  adminExperimentQuestionUploadImage,
  type AdminExperimentFlowItem,
  type AdminExperimentQuestionItem,
} from '@/services/admin';
import { getAssetUrl } from '@/lib/api';
import {
  buildImageQuestionContent,
  extractQuestionImageUrl,
  formatQuestionContent,
  isImageQuestionContent,
} from '@/modules/experiment/utils/formatQuestionContent';
import { BatchDeleteButton, SelectCheckbox, deleteMany, useRowSelection } from './batchSelect';

type ContentMode = 'text' | 'image';

function EnabledSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={checked ? '点击停用' : '点击启用'}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

const DEFAULT_TEXT_CONTENT =
  '【题目】\n\n某班共有 40 名学生，其中女生人数是男生人数的 3/5。\n\n(1) 求男生人数；\n(2) 求女生人数。';

function QuestionPreview({ content }: { content: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-[#faf8f4] p-4 text-sm leading-relaxed min-h-[120px]">
      <div className="text-xs text-slate-400 mb-2">预览</div>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          img: ({ src, alt }) => (
            <img
              src={getAssetUrl(src)}
              alt={alt ?? '题目图片'}
              className="max-w-full max-h-48 rounded border border-slate-200 object-contain"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function AdminExperimentQuestions() {
  const [flows, setFlows] = useState<AdminExperimentFlowItem[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AdminExperimentQuestionItem[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [flowBatchBusy, setFlowBatchBusy] = useState(false);
  const [togglingFlowId, setTogglingFlowId] = useState<string | null>(null);
  const [togglingQuestionId, setTogglingQuestionId] = useState<string | null>(null);
  const flowSelection = useRowSelection(flows.map((f) => f.id));
  const questionSelection = useRowSelection(questions.map((q) => q.id), selectedFlowId);

  const [flowModal, setFlowModal] = useState<'add' | 'edit' | null>(null);
  const [editingFlow, setEditingFlow] = useState<AdminExperimentFlowItem | null>(null);
  const [flowFormId, setFlowFormId] = useState('');
  const [flowFormName, setFlowFormName] = useState('');
  const [flowFormDesc, setFlowFormDesc] = useState('');
  const [flowFormSort, setFlowFormSort] = useState(0);
  const [flowFormEnabled, setFlowFormEnabled] = useState(true);
  const [flowFormRestEnabled, setFlowFormRestEnabled] = useState(true);
  const [flowFormRestSeconds, setFlowFormRestSeconds] = useState(5);
  const [flowFormRestEvery, setFlowFormRestEvery] = useState(1);
  const [flowSaving, setFlowSaving] = useState(false);

  const [qModal, setQModal] = useState<'add' | 'edit' | null>(null);
  const [editingQ, setEditingQ] = useState<AdminExperimentQuestionItem | null>(null);
  const [formId, setFormId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [contentMode, setContentMode] = useState<ContentMode>('text');
  const [formTextContent, setFormTextContent] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formEnabled, setFormEnabled] = useState(true);
  const [qSaving, setQSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFlow = flows.find((f) => f.id === selectedFlowId) ?? null;

  const previewContent = useMemo(() => {
    if (contentMode === 'image') {
      return formImageUrl ? buildImageQuestionContent(formImageUrl) : '';
    }
    const raw = formTextContent.trim();
    if (!raw) return '';
    const withHeader = raw.startsWith('【题目】') || raw.startsWith('**【题目】**') ? raw : `【题目】\n\n${raw}`;
    return formatQuestionContent(withHeader.replace(/^【题目】/, '**【题目】**'));
  }, [contentMode, formImageUrl, formTextContent]);

  const loadFlows = useCallback(() => {
    setLoadingFlows(true);
    adminExperimentFlowsList()
      .then((res) => {
        const data = res.data || [];
        setFlows(data);
        setSelectedFlowId((prev) => {
          if (prev && data.some((f) => f.id === prev)) return prev;
          return data[0]?.id ?? null;
        });
      })
      .catch((err) => toast.error(err?.message || '加载实验流失败'))
      .finally(() => setLoadingFlows(false));
  }, []);

  const loadQuestions = useCallback((flowId: string) => {
    setLoadingQuestions(true);
    adminExperimentFlowQuestionsList(flowId)
      .then((res) => setQuestions(res.data || []))
      .catch((err) => toast.error(err?.message || '加载题目失败'))
      .finally(() => setLoadingQuestions(false));
  }, []);

  useEffect(() => {
    loadFlows();
  }, []);

  useEffect(() => {
    if (selectedFlowId) loadQuestions(selectedFlowId);
    else setQuestions([]);
  }, [selectedFlowId, loadQuestions]);

  const openAddFlow = () => {
    setEditingFlow(null);
    setFlowFormId('');
    setFlowFormName('');
    setFlowFormDesc('');
    setFlowFormSort(flows.length);
    setFlowFormEnabled(true);
    setFlowFormRestEnabled(true);
    setFlowFormRestSeconds(5);
    setFlowFormRestEvery(1);
    setFlowModal('add');
  };

  const openEditFlow = (flow: AdminExperimentFlowItem) => {
    setEditingFlow(flow);
    setFlowFormId(flow.id);
    setFlowFormName(flow.name);
    setFlowFormDesc(flow.description || '');
    setFlowFormSort(flow.sort_order);
    setFlowFormEnabled(flow.enabled);
    setFlowFormRestEnabled(flow.rest_break_enabled ?? true);
    setFlowFormRestSeconds(flow.rest_break_seconds ?? 5);
    setFlowFormRestEvery(flow.rest_break_every ?? 1);
    setFlowModal('edit');
  };

  const handleSaveFlow = async () => {
    if (!flowFormName.trim()) {
      toast.error('请填写实验流名称');
      return;
    }
    setFlowSaving(true);
    try {
      if (flowModal === 'add') {
        if (!flowFormId.trim()) {
          toast.error('请填写实验流 ID');
          return;
        }
        await adminExperimentFlowCreate({
          id: flowFormId.trim(),
          name: flowFormName.trim(),
          description: flowFormDesc.trim() || undefined,
          sort_order: flowFormSort,
          enabled: flowFormEnabled,
          rest_break_enabled: flowFormRestEnabled,
          rest_break_seconds: flowFormRestSeconds,
          rest_break_every: Math.max(1, flowFormRestEvery),
        });
        toast.success('已创建实验流');
        setSelectedFlowId(flowFormId.trim());
      } else if (editingFlow) {
        await adminExperimentFlowUpdate(editingFlow.id, {
          name: flowFormName.trim(),
          description: flowFormDesc.trim() || undefined,
          sort_order: flowFormSort,
          enabled: flowFormEnabled,
          rest_break_enabled: flowFormRestEnabled,
          rest_break_seconds: flowFormRestSeconds,
          rest_break_every: Math.max(1, flowFormRestEvery),
        });
        toast.success('已更新实验流');
      }
      setFlowModal(null);
      loadFlows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setFlowSaving(false);
    }
  };

  const handleToggleFlowEnabled = async (flow: AdminExperimentFlowItem, enabled: boolean) => {
    if (togglingFlowId) return;
    setTogglingFlowId(flow.id);
    setFlows((prev) => prev.map((f) => (f.id === flow.id ? { ...f, enabled } : f)));
    try {
      const res = await adminExperimentFlowUpdate(flow.id, { enabled });
      if (res.errCode !== 0) throw new Error(res.errMsg);
      toast.success(enabled ? `已启用「${flow.name}」` : `已停用「${flow.name}」`);
    } catch (err) {
      setFlows((prev) => prev.map((f) => (f.id === flow.id ? { ...f, enabled: flow.enabled } : f)));
      toast.error(err instanceof Error ? err.message : '更新启用状态失败');
    } finally {
      setTogglingFlowId(null);
    }
  };

  const handleDeleteFlow = (flow: AdminExperimentFlowItem) => {
    if (!window.confirm(`确定删除实验流「${flow.name}」？\n其下所有题目也将被删除。`)) return;
    adminExperimentFlowDelete(flow.id)
      .then(() => {
        toast.success('已删除实验流');
        if (selectedFlowId === flow.id) setSelectedFlowId(null);
        loadFlows();
      })
      .catch((err) => toast.error(err?.message || '删除失败'));
  };

  const handleBatchDeleteFlows = async () => {
    const ids = flowSelection.selectedIds;
    if (ids.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${ids.length} 个实验流？其下题目也将被删除。`)) return;
    setFlowBatchBusy(true);
    try {
      const { ok, fail } = await deleteMany(ids, async (id) => {
        const res = await adminExperimentFlowDelete(id);
        if (res.errCode !== 0) throw new Error(res.errMsg);
      });
      if (fail) toast.error(`已删除 ${ok} 个实验流，失败 ${fail} 个`);
      else toast.success(`已删除 ${ok} 个实验流`);
      if (selectedFlowId && ids.includes(selectedFlowId)) setSelectedFlowId(null);
      flowSelection.clear();
      loadFlows();
    } finally {
      setFlowBatchBusy(false);
    }
  };

  const resetQuestionForm = () => {
    setFormId('');
    setFormTitle('');
    setContentMode('text');
    setFormTextContent(DEFAULT_TEXT_CONTENT);
    setFormImageUrl('');
    setFormSortOrder(questions.length);
    setFormEnabled(true);
  };

  const openAddQuestion = () => {
    if (!selectedFlowId) return;
    setEditingQ(null);
    resetQuestionForm();
    setQModal('add');
  };

  const openEditQuestion = (item: AdminExperimentQuestionItem) => {
    setEditingQ(item);
    setFormId(item.id);
    setFormTitle(item.title || '');
    setFormSortOrder(item.sort_order);
    setFormEnabled(item.enabled);
    if (isImageQuestionContent(item.content)) {
      setContentMode('image');
      setFormImageUrl(extractQuestionImageUrl(item.content) || '');
      setFormTextContent('');
    } else {
      setContentMode('text');
      setFormImageUrl('');
      setFormTextContent(item.content.replace(/^\*\*【题目】\*\*\s*/m, '').replace(/^【题目】\s*/m, '').trim());
    }
    setQModal('edit');
  };

  const buildFinalContent = (): string | null => {
    if (contentMode === 'image') {
      if (!formImageUrl.trim()) {
        toast.error('请上传题目图片');
        return null;
      }
      return buildImageQuestionContent(formImageUrl.trim());
    }
    if (!formTextContent.trim()) {
      toast.error('请填写题目内容');
      return null;
    }
    const raw = formTextContent.trim();
    const withHeader = raw.startsWith('【题目】') || raw.startsWith('**【题目】**') ? raw : `【题目】\n\n${raw}`;
    return formatQuestionContent(withHeader.replace(/^【题目】/, '**【题目】**'));
  };

  const handleSaveQuestion = async () => {
    if (!selectedFlowId) return;
    const finalContent = buildFinalContent();
    if (!finalContent) return;
    setQSaving(true);
    try {
      if (qModal === 'add') {
        if (!formId.trim()) {
          toast.error('请填写题目 ID');
          return;
        }
        await adminExperimentFlowQuestionCreate(selectedFlowId, {
          id: formId.trim(),
          title: formTitle.trim() || undefined,
          content: finalContent,
          sort_order: formSortOrder,
          enabled: formEnabled,
        });
        toast.success('已添加题目');
      } else if (editingQ) {
        await adminExperimentFlowQuestionUpdate(selectedFlowId, editingQ.id, {
          title: formTitle.trim() || undefined,
          content: finalContent,
          sort_order: formSortOrder,
          enabled: formEnabled,
        });
        toast.success('已更新题目');
      }
      setQModal(null);
      loadQuestions(selectedFlowId);
      loadFlows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setQSaving(false);
    }
  };

  const handleToggleQuestionEnabled = async (item: AdminExperimentQuestionItem, enabled: boolean) => {
    if (!selectedFlowId || togglingQuestionId) return;
    setTogglingQuestionId(item.id);
    setQuestions((prev) => prev.map((q) => (q.id === item.id ? { ...q, enabled } : q)));
    try {
      const res = await adminExperimentFlowQuestionUpdate(selectedFlowId, item.id, { enabled });
      if (res.errCode !== 0) throw new Error(res.errMsg);
    } catch (err) {
      setQuestions((prev) => prev.map((q) => (q.id === item.id ? { ...q, enabled: item.enabled } : q)));
      toast.error(err instanceof Error ? err.message : '更新题目启用状态失败');
    } finally {
      setTogglingQuestionId(null);
    }
  };

  const handleDeleteQuestion = (item: AdminExperimentQuestionItem) => {
    if (!selectedFlowId) return;
    if (!window.confirm(`确定删除题目「${item.title || item.id}」？`)) return;
    adminExperimentFlowQuestionDelete(selectedFlowId, item.id)
      .then(() => {
        toast.success('已删除');
        loadQuestions(selectedFlowId);
        loadFlows();
      })
      .catch((err) => toast.error(err?.message || '删除失败'));
  };

  const handleBatchDeleteQuestions = async () => {
    if (!selectedFlowId) return;
    const ids = questionSelection.selectedIds;
    if (ids.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${ids.length} 道题目？`)) return;
    setBatchBusy(true);
    try {
      const { ok, fail } = await deleteMany(ids, async (id) => {
        const res = await adminExperimentFlowQuestionDelete(selectedFlowId, id);
        if (res.errCode !== 0) throw new Error(res.errMsg);
      });
      if (fail) toast.error(`已删除 ${ok} 道题，失败 ${fail} 道`);
      else toast.success(`已删除 ${ok} 道题`);
      questionSelection.clear();
      loadQuestions(selectedFlowId);
      loadFlows();
    } finally {
      setBatchBusy(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    setUploading(true);
    try {
      const res = await adminExperimentQuestionUploadImage(file);
      setFormImageUrl(res.data?.url || '');
      toast.success('图片上传成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const getContentPreviewLabel = (content: string) =>
    isImageQuestionContent(content) ? '[图片题目]' : content.replace(/^\*\*【题目】\*\*\s*/m, '').slice(0, 60);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <h1 className="text-xl font-bold text-slate-800 mb-4 shrink-0">认知实验流管理</h1>

      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        {/* 实验流列表 */}
        <div className="w-72 shrink-0 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">实验流</span>
              <button type="button" onClick={openAddFlow} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" title="新建实验流">
                <Plus size={16} />
              </button>
            </div>
            {flows.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <SelectCheckbox
                    checked={flowSelection.allChecked}
                    indeterminate={flowSelection.someChecked}
                    onChange={flowSelection.toggleAll}
                    label="全选实验流"
                  />
                  全选
                </label>
                <BatchDeleteButton count={flowSelection.count} busy={flowBatchBusy} onClick={() => void handleBatchDeleteFlows()} />
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
            {loadingFlows ? (
              <div className="p-4 text-center text-sm text-slate-500">加载中...</div>
            ) : flows.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">暂无实验流</div>
            ) : (
              flows.map((flow) => (
                <div
                  key={flow.id}
                  className={`rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    selectedFlowId === flow.id
                      ? 'border-slate-400 bg-slate-50'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                  onClick={() => setSelectedFlowId(flow.id)}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-start gap-2 min-w-0">
                      <SelectCheckbox
                        checked={flowSelection.isSelected(flow.id)}
                        onChange={() => flowSelection.toggle(flow.id)}
                        label={`选择 ${flow.name}`}
                      />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{flow.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-slate-400">{flow.question_count} 题</span>
                        <EnabledSwitch
                          checked={flow.enabled}
                          disabled={togglingFlowId === flow.id}
                          onChange={(enabled) => void handleToggleFlowEnabled(flow, enabled)}
                        />
                      </div>
                    </div>
                    </div>
                    <div className="flex shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => openEditFlow(flow)} className="p-1 rounded hover:bg-slate-200">
                        <Pencil size={12} />
                      </button>
                      <button type="button" onClick={() => handleDeleteFlow(flow)} className="p-1 rounded hover:bg-red-50 text-red-600">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 题目列表 */}
        <div className="flex-1 min-w-0 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {selectedFlow ? (
            <>
              <div className="shrink-0 p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 text-slate-800 font-medium">
                    <GitBranch size={16} className="text-slate-500" />
                    <span>{selectedFlow.name}</span>
                    <EnabledSwitch
                      checked={selectedFlow.enabled}
                      disabled={togglingFlowId === selectedFlow.id}
                      onChange={(enabled) => void handleToggleFlowEnabled(selectedFlow, enabled)}
                    />
                    <span className="text-xs font-normal text-slate-500">{selectedFlow.enabled ? '已启用' : '已停用'}</span>
                  </div>
                  {selectedFlow.description && (
                    <p className="text-xs text-slate-500 mt-1">{selectedFlow.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <BatchDeleteButton count={questionSelection.count} busy={batchBusy} onClick={() => void handleBatchDeleteQuestions()} />
                <button
                  type="button"
                  onClick={openAddQuestion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-700"
                >
                  <Plus size={14} />
                  新增题目
                </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {loadingQuestions ? (
                  <div className="p-8 text-center text-slate-500">加载题目...</div>
                ) : questions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">该实验流暂无题目</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-medium text-slate-700 w-10">
                          <SelectCheckbox checked={questionSelection.allChecked} indeterminate={questionSelection.someChecked} onChange={questionSelection.toggleAll} label="全选题目" />
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-slate-700">ID</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-700">标题</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-700">难度</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-700">MWP</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-700">内容预览</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-700">排序</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-700">启用</th>
                        <th className="text-right py-3 px-4 font-medium text-slate-700">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 px-4">
                            <SelectCheckbox checked={questionSelection.isSelected(item.id)} onChange={() => questionSelection.toggle(item.id)} label={`选择 ${item.id}`} />
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">{item.id}</td>
                          <td className="py-3 px-4">{item.title || '-'}</td>
                          <td className="py-3 px-4">{item.level5 || '-'}</td>
                          <td className="py-3 px-4 font-mono text-xs">{item.mwp_id ?? '-'}</td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="line-clamp-2 text-slate-600">{getContentPreviewLabel(item.content)}</div>
                          </td>
                          <td className="py-3 px-4">{item.sort_order}</td>
                          <td className="py-3 px-4">
                            <EnabledSwitch
                              checked={item.enabled}
                              disabled={togglingQuestionId === item.id}
                              onChange={(enabled) => void handleToggleQuestionEnabled(item, enabled)}
                            />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button type="button" onClick={() => openEditQuestion(item)} className="p-1.5 rounded-lg hover:bg-slate-100 mr-1">
                              <Pencil size={14} />
                            </button>
                            <button type="button" onClick={() => handleDeleteQuestion(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">请选择或创建实验流</div>
          )}
        </div>
      </div>

      {/* 实验流弹窗 */}
      {flowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="shrink-0 px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold">{flowModal === 'add' ? '新建实验流' : '编辑实验流'}</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">实验流 ID</label>
                <input value={flowFormId} onChange={(e) => setFlowFormId(e.target.value)} disabled={flowModal === 'edit'} placeholder="如 flow-basic" className="w-full px-3 py-2 rounded-lg border border-slate-200 disabled:bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">名称</label>
                <input value={flowFormName} onChange={(e) => setFlowFormName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <textarea value={flowFormDesc} onChange={(e) => setFlowFormDesc(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">排序</label>
                  <input type="number" value={flowFormSort} onChange={(e) => setFlowFormSort(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-200" />
                </div>
                <label className="flex items-end pb-2 gap-2 text-sm">
                  <input type="checkbox" checked={flowFormEnabled} onChange={(e) => setFlowFormEnabled(e.target.checked)} />
                  启用
                </label>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={flowFormRestEnabled} onChange={(e) => setFlowFormRestEnabled(e.target.checked)} />
                  题间启用休息
                </label>
                <div>
                  <label className="block text-sm font-medium mb-1">每完成多少题休息一次</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={flowFormRestEvery}
                    disabled={!flowFormRestEnabled}
                    onChange={(e) => setFlowFormRestEvery(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">休息时长（秒）</label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={flowFormRestSeconds}
                    disabled={!flowFormRestEnabled}
                    onChange={(e) => setFlowFormRestSeconds(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 disabled:bg-slate-50"
                  />
                </div>
              </div>
            </div>
            <div className="shrink-0 px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setFlowModal(null)} className="px-4 py-2 rounded-lg border text-sm">取消</button>
              <button type="button" onClick={handleSaveFlow} disabled={flowSaving} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm disabled:opacity-50">
                {flowSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 题目弹窗 */}
      {qModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
              <h2 className="text-lg font-semibold">{qModal === 'add' ? '新增题目' : '编辑题目'}</h2>
              <button type="button" onClick={() => setQModal(null)} className="p-1 rounded-lg hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">题目 ID</label>
                <input value={formId} onChange={(e) => setFormId(e.target.value)} disabled={qModal === 'edit'} placeholder="如 q-001" className="w-full px-3 py-2 rounded-lg border border-slate-200 disabled:bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">标题</label>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="可选" className="w-full px-3 py-2 rounded-lg border border-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">题目内容</label>
                <div className="flex gap-1 p-1 rounded-lg bg-slate-100 w-fit mb-3">
                  <button type="button" onClick={() => setContentMode('text')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm ${contentMode === 'text' ? 'bg-white shadow-sm' : ''}`}>
                    <Type size={14} /> 文字输入
                  </button>
                  <button type="button" onClick={() => setContentMode('image')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm ${contentMode === 'image' ? 'bg-white shadow-sm' : ''}`}>
                    <ImageIcon size={14} /> 图片上传
                  </button>
                </div>
                {contentMode === 'text' ? (
                  <div className="space-y-3">
                    <textarea value={formTextContent} onChange={(e) => setFormTextContent(e.target.value)} rows={10} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm leading-relaxed" />
                    <p className="text-xs text-slate-500">支持直接输入 3/5、x^2、sqrt(2) 等常用数学写法。</p>
                    {previewContent && <QuestionPreview content={previewContent} />}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }} />
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center cursor-pointer hover:border-slate-300" onClick={() => !uploading && fileInputRef.current?.click()}>
                      {uploading ? <Loader2 className="mx-auto animate-spin" /> : formImageUrl ? (
                        <img src={getAssetUrl(formImageUrl)} alt="预览" className="max-h-48 mx-auto rounded border object-contain" />
                      ) : (
                        <div className="text-slate-500 text-sm"><Upload className="mx-auto mb-2" size={24} />点击上传题目图片</div>
                      )}
                    </div>
                    {previewContent && <QuestionPreview content={previewContent} />}
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">排序</label>
                  <input type="number" value={formSortOrder} onChange={(e) => setFormSortOrder(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-200" />
                </div>
                <label className="flex items-end pb-2 gap-2 text-sm">
                  <input type="checkbox" checked={formEnabled} onChange={(e) => setFormEnabled(e.target.checked)} />
                  启用
                </label>
              </div>
            </div>
            <div className="shrink-0 px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setQModal(null)} className="px-4 py-2 rounded-lg border text-sm">取消</button>
              <button type="button" onClick={handleSaveQuestion} disabled={qSaving || uploading} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm disabled:opacity-50">
                {qSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
