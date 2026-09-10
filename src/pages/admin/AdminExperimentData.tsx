import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Eye, Download, ExternalLink, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getAssetUrl } from '@/lib/api';
import { extractQuestionSnapshots } from '@/modules/experiment/utils/extractQuestionSnapshots';
import {
  adminExperimentFlowsList,
  adminExperimentSessionsList,
  adminExperimentSessionDetail,
  adminExperimentSessionDelete,
  type AdminExperimentFlowItem,
  type AdminExperimentSessionItem,
  type AdminExperimentSessionDetailItem,
} from '@/services/admin';
import { exportPayloadAsCsv, exportPayloadAsJson } from '@/modules/experiment/utils/exportExperimentData';
import { formatUserLabel, formatUserProfileSummary, hasUserIdentity } from '@/types/userProfile';
import { BatchDeleteButton, SelectCheckbox, deleteMany, useRowSelection } from './batchSelect';

export default function AdminExperimentData() {
  const [flows, setFlows] = useState<AdminExperimentFlowItem[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [list, setList] = useState<AdminExperimentSessionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AdminExperimentSessionDetailItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const selection = useRowSelection(list.map((item) => item.id), `${page}|${keyword}|${selectedFlowId}`);

  useEffect(() => {
    adminExperimentFlowsList({ include_archived: true })
      .then((res) => {
        const data = res.data || [];
        setFlows(data);
        if (data.length > 0) setSelectedFlowId(data[0].id);
      })
      .catch((err) => toast.error(err?.message || '加载实验流失败'));
  }, []);

  const fetchList = useCallback(
    (p: number) => {
      if (!selectedFlowId) {
        setList([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      adminExperimentSessionsList({
        page: p,
        pageSize,
        keyword: keyword || undefined,
        flow_id: selectedFlowId,
      })
        .then((res) => {
          setList(res.data || []);
          setTotal((res as { total?: number }).total ?? 0);
        })
        .catch((err) => toast.error(err?.message || '加载失败'))
        .finally(() => setLoading(false));
    },
    [keyword, pageSize, selectedFlowId],
  );

  useEffect(() => {
    fetchList(page);
  }, [fetchList, page]);

  useEffect(() => {
    setPage(1);
  }, [keyword, selectedFlowId]);

  const selectedFlow = flows.find((f) => f.id === selectedFlowId);

  const openDetail = (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    adminExperimentSessionDetail(id)
      .then((res) => setDetail(res.data ?? null))
      .catch((err) => toast.error(err?.message || '加载详情失败'))
      .finally(() => setDetailLoading(false));
  };

  const handleDelete = (item: AdminExperimentSessionItem) => {
    if (!window.confirm(`确定删除该用户的实验数据？\n会话：${item.id}`)) return;
    adminExperimentSessionDelete(item.id)
      .then(() => {
        toast.success('已删除');
        if (detail?.id === item.id) setDetail(null);
        fetchList(page);
      })
      .catch((err) => toast.error(err?.message || '删除失败'));
  };

  const handleBatchDelete = async () => {
    const ids = selection.selectedIds;
    if (ids.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${ids.length} 条实验数据？`)) return;
    setBatchBusy(true);
    try {
      const { ok, fail } = await deleteMany(ids, async (id) => {
        const res = await adminExperimentSessionDelete(id);
        if (res.errCode !== 0) throw new Error(res.errMsg);
      });
      if (fail) toast.error(`已删除 ${ok} 条，失败 ${fail} 条`);
      else toast.success(`已删除 ${ok} 条实验数据`);
      if (detail && ids.includes(detail.id)) setDetail(null);
      selection.clear();
      fetchList(page);
    } finally {
      setBatchBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const detailSnapshots = useMemo(
    () => (detail?.payload ? extractQuestionSnapshots(detail.payload) : []),
    [detail?.payload],
  );

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <h1 className="text-xl font-bold text-slate-800 mb-4 shrink-0">认知实验数据管理</h1>

      <div className="shrink-0 mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">实验流：</label>
        <select
          value={selectedFlowId}
          onChange={(e) => setSelectedFlowId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm min-w-[220px]"
        >
          {flows.length === 0 && <option value="">暂无实验流</option>}
          {flows.map((f) => (
            <option key={f.id} value={f.id}>
              {f.archived
                ? `${f.name}（${f.session_count ?? 0} 条记录）`
                : `${f.name}（${f.question_count} 题）`}
            </option>
          ))}
        </select>
        {selectedFlow && (
          <span className="text-xs text-slate-500">
            {selectedFlow.archived
              ? `查看已删除实验流「${selectedFlow.id}」保留的作答数据`
              : `查看「${selectedFlow.name}」中被试的作答数据`}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="shrink-0 p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="按用户信息或会话 ID 搜索"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <BatchDeleteButton count={selection.count} busy={batchBusy} onClick={() => void handleBatchDelete()} />
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500">加载中...</div>
          ) : !selectedFlowId ? (
            <div className="p-8 text-center text-slate-500">暂无实验流或作答数据</div>
          ) : list.length === 0 ? (
            <div className="p-8 text-center text-slate-500">该实验流暂无作答数据</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-700 w-10">
                    <SelectCheckbox checked={selection.allChecked} indeterminate={selection.someChecked} onChange={selection.toggleAll} label="全选本页" />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">用户</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">会话 ID</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">状态</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">题目数</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">事件数</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">提交时间</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <SelectCheckbox checked={selection.isSelected(item.id)} onChange={() => selection.toggle(item.id)} label={`选择 ${item.id}`} />
                    </td>
                    <td className="py-3 px-4">
                      {hasUserIdentity(item) ? (
                        <span>{formatUserLabel(item)}</span>
                      ) : (
                        <span className="text-slate-400">匿名</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{item.id}</td>
                    <td className="py-3 px-4">{item.status}</td>
                    <td className="py-3 px-4">{item.question_count}</td>
                    <td className="py-3 px-4">{item.event_count}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button type="button" onClick={() => openDetail(item.id)} className="p-1.5 rounded-lg hover:bg-slate-100 mr-1">
                        <Eye size={16} />
                      </button>
                      <button type="button" onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="shrink-0 p-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border disabled:opacity-50">上一页</button>
            <span className="px-2 py-1">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border disabled:opacity-50">下一页</button>
          </div>
        </div>
      </div>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="shrink-0 px-5 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">实验数据详情</h2>
              <div className="flex items-center gap-2">
                {detail && (
                  <>
                    <button type="button" onClick={() => exportPayloadAsJson(detail.id, detail.payload)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm">
                      <Download size={14} /> JSON
                    </button>
                    <button type="button" onClick={() => exportPayloadAsCsv(detail.id, detail.payload)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm">
                      <Download size={14} /> CSV
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setDetail(null)} className="px-3 py-1.5 rounded-lg border text-sm">关闭</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading ? (
                <div className="text-center text-slate-500 py-8">加载中...</div>
              ) : detail ? (
                <div className="space-y-5 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-slate-500">实验流：</span>{detail.flow_name || detail.flow_id || '-'}</div>
                    <div><span className="text-slate-500">用户：</span>{formatUserLabel(detail)}</div>
                    {formatUserProfileSummary(detail) && (
                      <div className="sm:col-span-2 text-slate-600">{formatUserProfileSummary(detail)}</div>
                    )}
                    {detail.contact && (
                      <div><span className="text-slate-500">联系方式：</span>{detail.contact}</div>
                    )}
                    <div><span className="text-slate-500">会话 ID：</span>{detail.id}</div>
                    <div><span className="text-slate-500">题目数 / 事件数：</span>{detail.question_count} / {detail.event_count}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon size={16} className="text-slate-500" />
                      <h3 className="font-medium text-slate-800">屏幕快照</h3>
                      <span className="text-xs text-slate-400">（被试按 F9 结束题目时截取）</span>
                    </div>
                    {detailSnapshots.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-500 text-sm">
                        暂无屏幕快照。请确认被试在结束每道题时按下了 F9，且实验已正常提交。
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {detailSnapshots.map((snap) => (
                          <div key={`${snap.questionId}-${snap.index}`} className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 bg-white text-xs text-slate-600">
                              <span>
                                第 {snap.index} 题 · <span className="font-mono">{snap.questionId}</span>
                                {snap.capturedAt ? (
                                  <span className="text-slate-400 ml-2">
                                    {new Date(snap.capturedAt).toLocaleString()}
                                  </span>
                                ) : null}
                              </span>
                              <a
                                href={getAssetUrl(snap.url)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline shrink-0"
                              >
                                原图 <ExternalLink size={12} />
                              </a>
                            </div>
                            <a href={getAssetUrl(snap.url)} target="_blank" rel="noreferrer" className="block">
                              <img
                                src={getAssetUrl(snap.url)}
                                alt={`第 ${snap.index} 题屏幕快照`}
                                className="w-full max-h-[420px] object-contain bg-[#f0f0ef]"
                              />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-medium text-slate-800 mb-2">原始数据</h3>
                    <pre className="bg-slate-50 border rounded-lg p-4 text-xs overflow-x-auto max-h-80">
                      {JSON.stringify(detail.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
