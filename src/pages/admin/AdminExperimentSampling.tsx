import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dices, Loader2, Download, Upload, Search, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  adminSamplingRun,
  adminSamplingOutputsList,
  adminSamplingOutputDetail,
  adminSamplingImport,
  adminSamplingFetchFileBlob,
  type AdminSamplingOutputDetail,
  type AdminSamplingOutputListItem,
} from '@/services/admin';

const LEVELS = ['易', '较易', '中等', '较难', '难'] as const;
const PAGE_SIZE = 10;

type Coverage = {
  total_trials?: number;
  unique_items?: number;
  duplicate_trials?: number;
  coverage_vs_eligible?: number;
  coverage_vs_database?: number;
  by_level?: Record<string, { total_trials: number; unique_items: number; coverage_rate: number }>;
};

function pct(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(2)}%`;
}

function formatTime(ts?: number | null) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

export default function AdminExperimentSampling() {
  const [seed, setSeed] = useState(20260907);
  const [mode, setMode] = useState<'unused_first' | 'deal'>('unused_first');
  const [nParticipants, setNParticipants] = useState(50);
  const [perLevel, setPerLevel] = useState(3);
  const [includeFormatDiff, setIncludeFormatDiff] = useState(false);
  const [avoidAdjacent, setAvoidAdjacent] = useState(false);
  const [running, setRunning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [flowsEnabled, setFlowsEnabled] = useState(true);
  const [restEvery, setRestEvery] = useState(3);
  const [restSeconds, setRestSeconds] = useState(5);

  const [outputs, setOutputs] = useState<AdminSamplingOutputListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminSamplingOutputDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [figUrls, setFigUrls] = useState<Record<string, string>>({});
  const [assignmentQuery, setAssignmentQuery] = useState('');

  const loadOutputs = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await adminSamplingOutputsList();
      if (res.errCode !== 0) throw new Error(res.errMsg);
      setOutputs(res.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载抽样产物列表失败');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadOutputs();
  }, [loadOutputs]);

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  const closeDetail = useCallback(() => {
    setDetail(null);
    setDetailRunId(null);
    setAssignmentQuery('');
    setFigUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return {};
    });
  }, []);

  const openDetail = useCallback(async (runId: string) => {
    setDetailRunId(runId);
    setDetail(null);
    setDetailLoading(true);
    setAssignmentQuery('');
    try {
      const res = await adminSamplingOutputDetail(runId);
      if (res.errCode !== 0) throw new Error(res.errMsg);
      setDetail(res.data);
      const preferred = ['fig1_trials_by_level.png', 'fig2_unique_by_level.png', 'fig3_usage_hist.png'];
      const available = new Set(res.data.files ?? []);
      const names = preferred.filter((name) => available.has(name));
      const next: Record<string, string> = {};
      for (const name of names) {
        try {
          const blob = await adminSamplingFetchFileBlob(runId, name);
          next[name] = URL.createObjectURL(blob);
        } catch {
          // 图可能尚未生成
        }
      }
      setFigUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载详情失败');
      closeDetail();
    } finally {
      setDetailLoading(false);
    }
  }, [closeDetail]);

  useEffect(() => {
    return () => {
      Object.values(figUrls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [figUrls]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return outputs;
    return outputs.filter((o) => {
      const modeName = String(o.meta?.mode ?? '').toLowerCase();
      return (
        String(o.run_id || '').toLowerCase().includes(q) ||
        String(o.seed ?? '').toLowerCase().includes(q) ||
        modeName.includes(q)
      );
    });
  }, [outputs, keyword]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await adminSamplingRun({
        seed,
        mode,
        n_participants: nParticipants,
        per_level: perLevel,
        include_format_diff: includeFormatDiff,
        avoid_adjacent_same_level: avoidAdjacent,
      });
      if (res.errCode !== 0 || !res.data) throw new Error(res.errMsg || '抽样失败');
      toast.success(`抽样完成：${res.data.run_id} · Unique=${res.data.unique_items} / Trials=${res.data.total_trials}`);
      await loadOutputs();
      await openDetail(res.data.run_id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '抽样失败');
    } finally {
      setRunning(false);
    }
  };

  const handleImport = async () => {
    if (detailRunId == null) return;
    if (
      !window.confirm(
        `将产物 ${detailRunId} 导入为 flow-p001… 实验流？\n${
          replaceExisting ? '已存在的同名流将被替换题目。' : '已存在的流将跳过。'
        }`,
      )
    ) {
      return;
    }
    setImporting(true);
    try {
      const res = await adminSamplingImport({
        run_id: detailRunId,
        replace_existing: replaceExisting,
        enabled: flowsEnabled,
        rest_break_enabled: restSeconds > 0 && restEvery > 0,
        rest_break_seconds: restSeconds,
        rest_break_every: Math.max(1, restEvery),
      });
      if (res.errCode !== 0 || !res.data) throw new Error(res.errMsg || '导入失败');
      toast.success(
        `导入成功：新建 ${res.data.created_flows} 流，更新 ${res.data.updated_flows} 流，题目 ${res.data.created_questions} 道`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleDownload = async (filename: string) => {
    if (detailRunId == null) return;
    try {
      const blob = await adminSamplingFetchFileBlob(detailRunId, filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '下载失败');
    }
  };

  const coverage = detail?.report?.coverage as Coverage | undefined;

  const assignmentRows = useMemo(() => {
    if (!detail?.participants) return [];
    const q = assignmentQuery.trim().toLowerCase();
    const rows = detail.participants.flatMap((p) =>
      (p.items || []).map((it) => ({
        participant_id: p.participant_id,
        flow_id: p.flow_id,
        ...it,
      })),
    );
    if (!q) return rows;
    return rows.filter((r) =>
      [r.participant_id, r.flow_id, String(r.mwp_id), r.level5, r.raw_text_preview]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [detail, assignmentQuery]);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <h1 className="text-xl font-bold text-slate-800 mb-4 shrink-0">分层覆盖抽样</h1>

      <div className="shrink-0 mb-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-slate-600">随机种子（可复现，不覆盖旧产物）</span>
            <input
              type="number"
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-600">模式</span>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'unused_first' | 'deal')}
            >
              <option value="unused_first">unused_first（优先未用）</option>
              <option value="deal">deal（洗牌发牌）</option>
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-600">被试数</span>
            <input
              type="number"
              min={1}
              max={200}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              value={nParticipants}
              onChange={(e) => setNParticipants(Number(e.target.value))}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-600">每层题数</span>
            <input
              type="number"
              min={1}
              max={20}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              value={perLevel}
              onChange={(e) => setPerLevel(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={includeFormatDiff} onChange={(e) => setIncludeFormatDiff(e.target.checked)} />
            包含 format_diff 题目
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={avoidAdjacent} onChange={(e) => setAvoidAdjacent(e.target.checked)} />
            呈现顺序尽量避免相邻同难度
          </label>
          <button
            type="button"
            disabled={running}
            onClick={() => void handleRun()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {running ? <Loader2 className="animate-spin" size={16} /> : <Dices size={16} />}
            {running ? '抽样中…' : '运行抽样'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="shrink-0 p-4 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="按产物、种子或模式搜索"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {loadingList ? (
            <div className="p-8 text-center text-slate-500">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500">暂无抽样产物，请先运行抽样</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">产物</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">种子</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">模式</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">被试数</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">总 trial</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Unique</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">覆盖率</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">生成时间</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <tr key={item.run_id || item.seed} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-xs">{item.run_id || item.seed}</td>
                    <td className="py-3 px-4 font-mono text-xs">{item.seed}</td>
                    <td className="py-3 px-4">{item.meta?.mode || '—'}</td>
                    <td className="py-3 px-4">{item.meta?.n_participants ?? '—'}</td>
                    <td className="py-3 px-4">{item.coverage?.total_trials ?? '—'}</td>
                    <td className="py-3 px-4">{item.coverage?.unique_items ?? '—'}</td>
                    <td className="py-3 px-4">{pct(item.coverage?.coverage_vs_eligible)}</td>
                    <td className="py-3 px-4 text-slate-500">{formatTime(item.created_at)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => void openDetail(String(item.run_id || item.seed))}
                        className="p-1.5 rounded-lg hover:bg-slate-100"
                        title="查看详情"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="shrink-0 p-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
          <span>共 {filtered.length} 条</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-2 py-1">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {(detail || detailLoading || detailRunId != null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="shrink-0 px-5 py-4 border-b flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">抽样集详情{detailRunId != null ? ` · ${detailRunId}` : ''}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (detailRunId != null) void handleDownload('assignments.json');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm"
                >
                  <Download size={14} /> JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (detailRunId != null) void handleDownload('assignments.csv');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm"
                >
                  <Download size={14} /> CSV
                </button>
                <button type="button" onClick={closeDetail} className="p-1.5 rounded-lg border" title="关闭">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5 text-sm">
              {detailLoading ? (
                <div className="text-center text-slate-500 py-8">加载中...</div>
              ) : detail ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-slate-500">模式</div>
                      <div className="text-base font-semibold">{String(detail.meta?.mode ?? '—')}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-slate-500">被试 / 流</div>
                      <div className="text-lg font-semibold">{detail.n_participants}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-slate-500">Unique / Trials</div>
                      <div className="text-lg font-semibold">
                        {coverage?.unique_items ?? '—'} / {coverage?.total_trials ?? '—'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-slate-500">覆盖率（合格池）</div>
                      <div className="text-lg font-semibold">{pct(coverage?.coverage_vs_eligible)}</div>
                    </div>
                  </div>

                  {coverage?.by_level && (
                    <div>
                      <h3 className="font-medium text-slate-800 mb-2">按复杂度覆盖</h3>
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="text-left text-slate-500 border-b">
                            <th className="py-2 pr-3">level5</th>
                            <th className="py-2 pr-3">trials</th>
                            <th className="py-2 pr-3">unique</th>
                            <th className="py-2">coverage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {LEVELS.map((lv) => {
                            const row = coverage.by_level?.[lv];
                            return (
                              <tr key={lv} className="border-b border-slate-100">
                                <td className="py-2 pr-3">{lv}</td>
                                <td className="py-2 pr-3">{row?.total_trials ?? '—'}</td>
                                <td className="py-2 pr-3">{row?.unique_items ?? '—'}</td>
                                <td className="py-2">{pct(row?.coverage_rate)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {Object.keys(figUrls).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {Object.entries(figUrls).map(([name, url]) => (
                        <figure key={name} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <img src={url} alt={name} className="w-full h-auto" />
                          <figcaption className="text-xs text-slate-500 px-2 py-1 truncate">{name}</figcaption>
                        </figure>
                      ))}
                    </div>
                  )}

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <h3 className="font-medium text-slate-800">抽样题目分配</h3>
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          value={assignmentQuery}
                          onChange={(e) => setAssignmentQuery(e.target.value)}
                          placeholder="搜索被试 / MWP / 难度 / 题干"
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 overflow-auto max-h-80">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 px-3 font-medium text-slate-700">被试</th>
                            <th className="text-left py-2 px-3 font-medium text-slate-700">顺序</th>
                            <th className="text-left py-2 px-3 font-medium text-slate-700">难度</th>
                            <th className="text-left py-2 px-3 font-medium text-slate-700">MWP</th>
                            <th className="text-left py-2 px-3 font-medium text-slate-700">题干预览</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignmentRows.map((row) => (
                            <tr
                              key={`${row.participant_id}-${row.trial_index}-${row.mwp_id}`}
                              className="border-b border-slate-100"
                            >
                              <td className="py-2 px-3 font-mono text-xs">{row.participant_id}</td>
                              <td className="py-2 px-3">{row.trial_index}</td>
                              <td className="py-2 px-3">{row.level5}</td>
                              <td className="py-2 px-3 font-mono text-xs">{row.mwp_id}</td>
                              <td className="py-2 px-3 text-slate-600 max-w-md">
                                <div className="line-clamp-2">{row.raw_text_preview || '—'}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">显示 {assignmentRows.length} 条分配记录</p>
                  </div>

                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <h3 className="font-medium text-slate-800">导入到认知实验流</h3>
                    <p className="text-slate-500">
                      将生成 flow-p001 … flow-p{String(detail.n_participants).padStart(3, '0')}，每流含 mwp_id / level5。
                      作答时每完成 {Math.max(1, restEvery)} 题休息 {Math.max(0, restSeconds)} 秒（最后一题结束后不休息）。
                    </p>
                    <div className="flex flex-wrap items-end gap-4">
                      <label className="text-sm space-y-1">
                        <span className="text-slate-600">每多少题休息</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className="w-28 border border-slate-200 rounded-lg px-3 py-2"
                          value={restEvery}
                          onChange={(e) => setRestEvery(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </label>
                      <label className="text-sm space-y-1">
                        <span className="text-slate-600">休息秒数（0 表示不休息）</span>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          className="w-28 border border-slate-200 rounded-lg px-3 py-2"
                          value={restSeconds}
                          onChange={(e) => setRestSeconds(Math.max(0, Number(e.target.value) || 0))}
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={replaceExisting}
                          onChange={(e) => setReplaceExisting(e.target.checked)}
                        />
                        替换已存在的同名流
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={flowsEnabled} onChange={(e) => setFlowsEnabled(e.target.checked)} />
                        导入后启用流
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={importing}
                      onClick={() => void handleImport()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-60"
                    >
                      {importing ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                      {importing ? '导入中…' : '导入为实验流'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-500 py-8">未能加载详情</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
