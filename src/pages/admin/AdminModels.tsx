import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, KeyRound, Link2, Wifi, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  adminSolveModelsList,
  adminSolveModelCreate,
  adminSolveModelUpdate,
  adminSolveModelDelete,
  adminUniapiConfigGet,
  adminUniapiConfigUpdate,
  adminTestSolve,
  type AdminSolveModelItem,
  type AdminUniapiConfig,
} from '@/services/admin';
import { BatchDeleteButton, SelectCheckbox, deleteMany, useRowSelection } from './batchSelect';

export default function AdminModels() {
  const [list, setList] = useState<AdminSolveModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchBusy, setBatchBusy] = useState(false);
  const selection = useRowSelection(list.map((m) => String(m.id)));
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<AdminSolveModelItem | null>(null);
  const [formModelId, setFormModelId] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formEnabled, setFormEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modelModalTest, setModelModalTest] = useState<'idle' | 'running' | 'ok' | 'fail'>('idle');
  const [modelModalTestMsg, setModelModalTestMsg] = useState('');
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [configTest, setConfigTest] = useState<'idle' | 'running' | 'ok' | 'fail'>('idle');
  const [configTestMsg, setConfigTestMsg] = useState('');
  const [configBaseUrl, setConfigBaseUrl] = useState('');
  const [configToken, setConfigToken] = useState('');

  const load = () => {
    setLoading(true);
    adminSolveModelsList()
      .then((res) => setList(res.data || []))
      .catch((err) => toast.error(err?.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  const loadConfig = () => {
    setConfigLoading(true);
    adminUniapiConfigGet()
      .then((res) => {
        const data = res.data as AdminUniapiConfig | null;
        setConfigBaseUrl(data?.base_url ?? '');
        setConfigToken(data?.token ?? '');
      })
      .catch((err) => toast.error(err?.message || '加载大模型接口配置失败'))
      .finally(() => setConfigLoading(false));
  };

  useEffect(() => {
    load();
    loadConfig();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFormModelId('');
    setFormDisplayName('');
    setFormSortOrder(list.length);
    setFormEnabled(true);
    setModelModalTest('idle');
    setModelModalTestMsg('');
    setModal('add');
  };

  const openEdit = (m: AdminSolveModelItem) => {
    setEditing(m);
    setFormModelId(m.model_id);
    setFormDisplayName(m.display_name);
    setFormSortOrder(m.sort_order);
    setFormEnabled(m.enabled);
    setModelModalTest('idle');
    setModelModalTestMsg('');
    setModal('edit');
  };

  const handleModalTestConnect = async () => {
    const mid = formModelId.trim();
    if (!mid) {
      toast.error('请先填写模型 ID');
      return;
    }
    setModelModalTest('running');
    setModelModalTestMsg('');
    try {
      const res = await adminTestSolve(mid);
      if (res.errCode === 0 && res.data?.success) {
        setModelModalTest('ok');
        setModelModalTestMsg(res.data.durationMs != null ? `耗时 ${res.data.durationMs} ms` : '');
      } else {
        setModelModalTest('fail');
        setModelModalTestMsg(res.errMsg || '连接失败');
      }
    } catch (err) {
      setModelModalTest('fail');
      setModelModalTestMsg(err instanceof Error ? err.message : '请求异常');
    }
  };

  const handleSave = async () => {
    if (modal === 'add') {
      if (!formModelId.trim() || !formDisplayName.trim()) {
        toast.error('请填写模型 ID 和展示名称');
        return;
      }
      setSaving(true);
      try {
        await adminSolveModelCreate({
          model_id: formModelId.trim(),
          display_name: formDisplayName.trim(),
          sort_order: formSortOrder,
          enabled: formEnabled,
        });
        toast.success('已添加');
        setModal(null);
        load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '添加失败');
      } finally {
        setSaving(false);
      }
    } else {
      if (!editing) return;
      setSaving(true);
      try {
        await adminSolveModelUpdate(editing.id, {
          display_name: formDisplayName.trim(),
          sort_order: formSortOrder,
          enabled: formEnabled,
        });
        toast.success('已更新');
        setModal(null);
        load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '更新失败');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSaveConfig = async () => {
    if (!configBaseUrl.trim() || !configToken.trim()) {
      toast.error('请填写完整的 API 地址和 Token');
      return;
    }
    setConfigSaving(true);
    try {
      await adminUniapiConfigUpdate({
        base_url: configBaseUrl.trim(),
        token: configToken.trim(),
      });
      toast.success('大模型接口配置已保存');
      loadConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleTestConnect = async () => {
    setConfigTest('running');
    setConfigTestMsg('');
    try {
      const res = await adminTestSolve();
      if (res.errCode === 0 && res.data?.success) {
        setConfigTest('ok');
        setConfigTestMsg(res.data.model ? `模型: ${res.data.model}，耗时 ${res.data.durationMs ?? 0} ms` : '');
      } else {
        setConfigTest('fail');
        setConfigTestMsg(res.errMsg || '连接失败');
      }
    } catch (err) {
      setConfigTest('fail');
      setConfigTestMsg(err instanceof Error ? err.message : '请求异常');
    }
  };

  const handleDelete = (m: AdminSolveModelItem) => {
    if (!window.confirm(`确定删除模型「${m.display_name}」？前端解题页将不再显示该选项。`)) return;
    adminSolveModelDelete(m.id)
      .then(() => {
        toast.success('已删除');
        load();
      })
      .catch((err) => toast.error(err?.message || '删除失败'));
  };

  const handleBatchDelete = async () => {
    const ids = selection.selectedIds;
    if (ids.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${ids.length} 个解题模型？`)) return;
    setBatchBusy(true);
    try {
      const { ok, fail } = await deleteMany(ids, async (id) => {
        const res = await adminSolveModelDelete(Number(id));
        if (res.errCode !== 0) throw new Error(res.errMsg);
      });
      if (fail) toast.error(`已删除 ${ok} 个，失败 ${fail} 个`);
      else toast.success(`已删除 ${ok} 个模型`);
      selection.clear();
      load();
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <KeyRound size={18} className="text-amber-500" />
          <div>
            <div className="text-sm font-medium text-slate-800">大模型接口（UniAPI）</div>
            <div className="text-xs text-slate-500 mt-0.5">
              在此配置解题调用所使用的 UniAPI 接口地址与 Token，保存后立即生效，无需重启服务。
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {configLoading ? (
            <div className="text-sm text-slate-500">加载中...</div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Link2 size={14} />
                  API Base URL
                </label>
                <input
                  type="url"
                  value={configBaseUrl}
                  onChange={(e) => setConfigBaseUrl(e.target.value)}
                  placeholder="如 https://api.uniapi.io"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">API Token</label>
                <div className="relative">
                  <input
                    type='password'
                    value={configToken}
                    onChange={(e) => setConfigToken(e.target.value)}
                    placeholder="以 sk- 开头的密钥"
                    className="w-full px-3 pr-10 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  仅管理员可见，用于调用解题大模型接口。请妥善保管，避免在前端或客户端代码中暴露。
                </p>
              </div>
              <div className="flex justify-end items-center gap-2 flex-wrap">
                {configTest === 'ok' && (
                  <span className="text-sm text-emerald-600 inline-flex items-center gap-1">
                    <CheckCircle size={16} /> 连接正常
                    {configTestMsg && <span className="text-slate-500">({configTestMsg})</span>}
                  </span>
                )}
                {configTest === 'fail' && (
                  <span className="text-sm text-red-600 inline-flex items-center gap-1">
                    <XCircle size={16} /> {configTestMsg || '连接失败'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleTestConnect}
                  disabled={configTest === 'running'}
                  className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {configTest === 'running' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      连接测试中...
                    </>
                  ) : (
                    <>
                      <Wifi size={16} />
                      连接测试
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={configSaving}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
                >
                  {configSaving ? '保存中...' : '保存接口配置'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">解题大模型列表</h2>
        <div className="flex items-center gap-2">
          <BatchDeleteButton count={selection.count} busy={batchBusy} onClick={() => void handleBatchDelete()} />
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700"
        >
          <Plus size={18} />
          新增模型
        </button>
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        此处配置的是可供前端选择的模型 ID 列表，与上方接口配置共同决定最终调用的大模型。
      </p>
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="p-8 text-center text-slate-500">加载中...</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            暂无模型，请添加。若数据库为空，解题页将使用环境变量 UNIAPI_SOLVE_MODELS 作为回退。
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-700 w-10">
                    <SelectCheckbox checked={selection.allChecked} indeterminate={selection.someChecked} onChange={selection.toggleAll} label="全选" />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">模型 ID</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">展示名称</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">排序</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">状态</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">操作</th>
                </tr>
              </thead>
            </table>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-sm table-fixed">
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4">
                        <SelectCheckbox checked={selection.isSelected(String(m.id))} onChange={() => selection.toggle(String(m.id))} label={`选择 ${m.display_name}`} />
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{m.model_id}</td>
                      <td className="py-3 px-4">{m.display_name}</td>
                      <td className="py-3 px-4">{m.sort_order}</td>
                      <td className="py-3 px-4">
                        <span className={m.enabled ? 'text-green-600' : 'text-slate-400'}>
                          {m.enabled ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 inline-flex items-center gap-1"
                          title="编辑"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center gap-1 ml-1"
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !saving && setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">{modal === 'add' ? '新增解题模型' : '编辑解题模型'}</h2>
              <button type="button" onClick={() => !saving && setModal(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">模型 ID</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={formModelId}
                    onChange={(e) => setFormModelId(e.target.value)}
                    disabled={modal === 'edit'}
                    placeholder="如 gpt-5.2"
                    className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-slate-200 disabled:bg-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleModalTestConnect}
                    disabled={!formModelId.trim() || modelModalTest === 'running'}
                    className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
                  >
                    {modelModalTest === 'running' ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        测试中...
                      </>
                    ) : (
                      <>
                        <Wifi size={14} />
                        连接测试
                      </>
                    )}
                  </button>
                </div>
                {modal === 'edit' && <p className="text-xs text-slate-500 mt-1">模型 ID 不可修改</p>}
                {modelModalTest === 'ok' && (
                  <p className="text-xs text-emerald-600 mt-1.5 inline-flex items-center gap-1">
                    <CheckCircle size={14} /> 连接正常 {modelModalTestMsg && `（${modelModalTestMsg}）`}
                  </p>
                )}
                {modelModalTest === 'fail' && (
                  <p className="text-xs text-red-600 mt-1.5 inline-flex items-center gap-1">
                    <XCircle size={14} /> {modelModalTestMsg || '连接失败'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">展示名称</label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="如 GPT-5.2"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">排序（数字越小越靠前）</label>
                <input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="formEnabled"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <label htmlFor="formEnabled" className="text-sm text-slate-700">启用（前端解题页显示）</label>
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-200">
                取消
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
