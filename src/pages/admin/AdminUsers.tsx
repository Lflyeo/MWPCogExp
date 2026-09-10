import React, { useState, useEffect } from 'react';
import { Search, Pencil, Trash2, X, Plus, Image as ImageIcon, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  adminUsersList,
  adminUserUpdate,
  adminUserDelete,
  adminUserCreate,
  adminUserUpdatePassword,
  adminUserUploadAvatar,
  type AdminUserItem,
} from '@/services/admin';
import { getAssetUrl } from '@/lib/api';
import { UserProfileFormFields } from '@/components/UserProfileFields';
import { profileFromUser, profileToPayload, getUserDisplayName } from '@/types/userProfile';
import type { UserProfileFields } from '@/types/userProfile';
import { BatchDeleteButton, SelectCheckbox, deleteMany, useRowSelection } from './batchSelect';

export default function AdminUsers() {
  const [list, setList] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<AdminUserItem | null>(null);
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editProfile, setEditProfile] = useState<UserProfileFields>(profileFromUser(null));
  const [saving, setSaving] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createRealName, setCreateRealName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createProfile, setCreateProfile] = useState<UserProfileFields>(profileFromUser(null));
  const [creating, setCreating] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const selection = useRowSelection(list.map((u) => u.id), `${page}|${keyword}`);

  const load = (opts?: { page?: number; keyword?: string }) => {
    setLoading(true);
    const p = opts?.page ?? page;
    const k = opts?.keyword !== undefined ? opts.keyword : keyword;
    adminUsersList({ page: p, pageSize, keyword: k || undefined })
      .then((res) => {
        setList(res.data || []);
        setTotal((res as { total?: number }).total ?? 0);
      })
      .catch((err) => toast.error(err?.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, keyword]);

  const openEdit = (u: AdminUserItem) => {
    setEditUser(u);
    setEditAvatarUrl(u.avatar_url ?? '');
    setEditProfile(profileFromUser(u));
    setEditPassword('');
  };

  const handleSaveUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await adminUserUpdate(editUser.id, {
        avatar_url: editAvatarUrl.trim() || undefined,
        ...profileToPayload(editProfile),
      });
      if (editPassword.trim()) {
        await adminUserUpdatePassword(editUser.id, { password: editPassword.trim() });
      }
      toast.success('已更新');
      setEditUser(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = (u: AdminUserItem) => {
    if (!window.confirm(`确定删除用户「${getUserDisplayName(u)}」？其解题记录将保留但不再关联。`)) return;
    adminUserDelete(u.id)
      .then(() => {
        toast.success('已删除');
        load();
      })
      .catch((err) => toast.error(err?.message || '删除失败'));
  };

  const handleBatchDelete = async () => {
    const ids = selection.selectedIds;
    if (ids.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${ids.length} 名用户？其解题记录将保留但不再关联。`)) return;
    setBatchBusy(true);
    try {
      const { ok, fail } = await deleteMany(ids, async (id) => {
        const res = await adminUserDelete(id);
        if (res.errCode !== 0) throw new Error(res.errMsg);
      });
      if (fail) toast.error(`已删除 ${ok} 名，失败 ${fail} 名`);
      else toast.success(`已删除 ${ok} 名用户`);
      selection.clear();
      load();
    } finally {
      setBatchBusy(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editUser) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await adminUserUploadAvatar(editUser.id, file);
      const url = (res.data as any)?.url;
      if (url) {
        setEditAvatarUrl(url);
        toast.success('头像已上传');
      } else {
        toast.error('上传成功但未返回 URL');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleCreateUser = async () => {
    if (!createRealName.trim() || !createPassword.trim()) {
      toast.error('请填写姓名和密码');
      return;
    }
    setCreating(true);
    try {
      const extra = profileToPayload(createProfile);
      await adminUserCreate({
        username: createRealName.trim(),
        password: createPassword.trim(),
        ...extra,
        real_name: createRealName.trim(),
      });
      toast.success('用户已创建');
      setCreateModalOpen(false);
      setCreateRealName('');
      setCreatePassword('');
      setCreateProfile(profileFromUser(null));
      setPage(1);
      load({ page: 1 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">用户管理</h1>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-1 items-center gap-3 min-w-[240px]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setPage(1) && load()}
                placeholder="搜索姓名、学号、学院等"
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                load({ page: 1 });
              }}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700"
            >
              搜索
            </button>
          </div>
          <BatchDeleteButton count={selection.count} busy={batchBusy} onClick={() => void handleBatchDelete()} />
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
          >
            <Plus size={16} />
            新增用户
          </button>
        </div>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500">加载中...</div>
          ) : list.length === 0 ? (
            <div className="p-8 text-center text-slate-500">暂无用户</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-700 w-10">
                    <SelectCheckbox checked={selection.allChecked} indeterminate={selection.someChecked} onChange={selection.toggleAll} label="全选本页" />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700 w-16">序号</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">用户ID</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">头像</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">姓名</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">学号</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">学院</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">专业</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">注册时间</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u, idx) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <SelectCheckbox checked={selection.isSelected(u.id)} onChange={() => selection.toggle(u.id)} label={`选择 ${u.id}`} />
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-sm">
                      {(page - 1) * pageSize + idx + 1}
                    </td>
                    <td className="py-3 px-4">{u.id}</td>
                    <td className="py-3 px-4">
                      {u.avatar_url ? (
                        <img
                          src={getAssetUrl(u.avatar_url)}
                          alt={getUserDisplayName(u)}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.visibility = 'hidden';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <ImageIcon size={14} />
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">{getUserDisplayName(u)}</td>
                    <td className="py-3 px-4">{u.student_id || '-'}</td>
                    <td className="py-3 px-4">{u.college || '-'}</td>
                    <td className="py-3 px-4">{u.major || '-'}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {u.created_at ? new Date(u.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 inline-flex items-center gap-1"
                        title="编辑"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u)}
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
          )}
        </div>
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50"
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
              className="px-3 py-1 rounded border border-slate-200 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !saving && setEditUser(null)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-100 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">编辑用户</h2>
                <button type="button" onClick={() => !saving && setEditUser(null)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-2">用户 ID：{editUser.id}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">头像</label>
                <div className="flex items-center gap-3">
                  {editAvatarUrl ? (
                    <img
                      src={getAssetUrl(editAvatarUrl)}
                      alt="avatar"
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.visibility = 'hidden';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <ImageIcon size={18} />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      placeholder="头像 URL（可手动填写）"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs cursor-pointer hover:bg-slate-50">
                        <ImageIcon size={14} />
                        <span>{uploadingAvatar ? '上传中...' : '上传图片'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarFileChange}
                          disabled={uploadingAvatar || saving}
                        />
                      </label>
                      <span className="text-[11px] text-slate-400">支持小于 2MB 的图片</span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Lock size={14} />
                  管理员重置密码
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="留空则不修改密码"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
                <p className="mt-1 text-xs text-slate-400">仅管理员可见，用于为用户重置登录密码。</p>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-700 mb-2">个人资料</div>
                <UserProfileFormFields
                  value={editProfile}
                  onChange={setEditProfile}
                  disabled={saving}
                  variant="admin"
                />
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex gap-2 justify-end">
              <button type="button" onClick={() => setEditUser(null)} className="px-4 py-2 rounded-lg border border-slate-200">
                取消
              </button>
              <button type="button" onClick={handleSaveUser} disabled={saving} className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !creating && setCreateModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">新增用户</h2>
              <button
                type="button"
                onClick={() => !creating && setCreateModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
                <input
                  type="text"
                  value={createRealName}
                  onChange={(e) => setCreateRealName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  placeholder="请填写姓名（用于登录）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  placeholder="至少 6 位"
                />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-700 mb-2">个人资料（可选）</div>
                <UserProfileFormFields
                  value={createProfile}
                  onChange={setCreateProfile}
                  disabled={creating}
                  variant="admin"
                  hideRealName
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateUser}
                disabled={creating}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
              >
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
