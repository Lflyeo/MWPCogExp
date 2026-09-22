import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { UserPlus, User, Lock } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '@/contexts/authContext';
import { toast } from 'sonner';
import { UserProfileFormFields } from '@/components/UserProfileFields';
import { profileFromUser, profileToPayload } from '@/types/userProfile';
import type { UserProfileFields } from '@/types/userProfile';

export default function Register() {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';
  const [realName, setRealName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profile, setProfile] = useState<UserProfileFields>(profileFromUser(null));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!realName.trim()) {
      toast.error('请输入姓名');
      return;
    }
    if (realName.trim().length < 2) {
      toast.error('姓名至少 2 个字符');
      return;
    }
    if (!password) {
      toast.error('请输入密码');
      return;
    }
    if (password.length < 6) {
      toast.error('密码至少 6 个字符');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const extra = profileToPayload(profile);
      await register(realName.trim(), password, { ...extra, real_name: realName.trim() });
      toast.success('注册成功');
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800">MWPCogExp</h1>
            <p className="text-gray-500 mt-1">创建新账号</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="reg-real-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                姓名
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="reg-real-name"
                  type="text"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  placeholder="2-64 个字符，用于登录"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                  autoComplete="name"
                />
              </div>
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 个字符"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-gray-700 mb-1.5">
                确认密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="reg-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">其他资料（可选，注册后可在「我的」中修改）</div>
              <UserProfileFormFields value={profile} onChange={setProfile} disabled={loading} hideRealName />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              {loading ? '注册中...' : '注册'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            已有账号？{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              去登录
            </Link>
          </p>
        </div>
        <p className="mt-4 text-center">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
            返回首页
          </Link>
        </p>
      </div>
    </div>
  );
}
