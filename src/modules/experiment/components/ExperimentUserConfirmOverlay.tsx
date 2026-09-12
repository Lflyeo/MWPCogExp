import { type RefObject } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ProfileData } from '@/services/auth';
import { getUserDisplayName } from '@/types/userProfile';
import { ExperimentOverlayShell } from './ExperimentOverlayShell';

function ProfileRow({ label, value }: { label: string; value?: string | number | null }) {
  const text = value != null && String(value).trim() !== '' ? String(value) : '未填写';
  const empty = text === '未填写';
  return (
    <div className="flex gap-3 py-2 border-b border-neutral-100 last:border-0 text-sm">
      <span className="w-24 shrink-0 text-neutral-500">{label}</span>
      <span className={empty ? 'text-neutral-400' : 'text-neutral-900'}>{text}</span>
    </div>
  );
}

interface ExperimentUserConfirmOverlayProps {
  show: boolean;
  profile: ProfileData | null;
  flowName?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  dialogRef?: RefObject<HTMLDivElement | null>;
  profileRef?: RefObject<HTMLDivElement | null>;
  confirmButtonRef?: RefObject<HTMLButtonElement | null>;
  cancelButtonRef?: RefObject<HTMLButtonElement | null>;
}

export function ExperimentUserConfirmOverlay({
  show,
  profile,
  flowName,
  loading,
  onConfirm,
  onCancel,
  dialogRef,
  profileRef,
  confirmButtonRef,
  cancelButtonRef,
}: ExperimentUserConfirmOverlayProps) {
  const location = useLocation();

  return (
    <ExperimentOverlayShell show={show}>
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 pt-6 pb-4 border-b border-neutral-100">
          <h2 className="text-lg font-bold text-neutral-900">请确认个人信息</h2>
          <p className="mt-2 text-sm text-neutral-500">
            {flowName ? `即将开始「${flowName}」。` : '即将开始实验。'}
            请核对以下信息是否正确，确认后将按 F9 键进入作答。
          </p>
        </div>

        <div ref={profileRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="py-8 text-center text-neutral-500 text-sm">加载资料中...</div>
          ) : !profile ? (
            <div className="py-6 text-center text-sm text-neutral-600 space-y-3">
              <p>无法获取用户资料，请先登录后再参与实验。</p>
              <Link
                to="/login"
                state={{ from: location }}
                className="inline-block text-blue-600 hover:text-blue-700 font-medium"
              >
                去登录
              </Link>
            </div>
          ) : (
            <div>
              <ProfileRow label="姓名" value={getUserDisplayName(profile)} />
              <ProfileRow label="学号" value={profile.student_id} />
              <ProfileRow label="年龄" value={profile.age} />
              <ProfileRow label="性别" value={profile.gender} />
              <ProfileRow label="联系方式" value={profile.contact} />
              <ProfileRow label="学院" value={profile.college} />
              <ProfileRow label="专业" value={profile.major} />
              <p className="mt-4 text-xs text-neutral-400">
                信息有误请先取消，在
                <Link to="/mypage" className="text-blue-600 hover:text-blue-700 mx-0.5">
                  我的
                </Link>
                页面修改后再开始实验。
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-neutral-100 flex gap-3 justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors duration-150"
          >
            取消
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={loading || !profile}
            className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            确认无误，继续
          </button>
        </div>
      </div>
    </ExperimentOverlayShell>
  );
}
