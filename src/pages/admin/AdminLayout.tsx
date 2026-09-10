import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, Brain, LogOut, Shield, History, Heart, Wifi, FlaskConical, Database, Dices } from 'lucide-react';
import { getAdminToken, clearAdminToken } from '@/services/admin';
import { useEffect } from 'react';

export default function AdminLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!getAdminToken()) {
      navigate('/admin/login', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    clearAdminToken();
    navigate('/admin/login', { replace: true });
  };

  if (!getAdminToken()) {
    return null;
  }

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      <aside className="w-66 bg-slate-800 text-white shrink-0 flex flex-col">
        <div className="p-4 flex items-center gap-2 border-b border-slate-700">
          <Shield size={20} />
          <span className="font-semibold">MWPSolver-KS管理后台</span>
        </div>
        <nav className="p-2 flex-1">
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg mb-1 ${isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`
            }
          >
            <Users size={18} />
            用户管理
          </NavLink>
          <NavLink
            to="/admin/models"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg ${isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`
            }
          >
            <Brain size={18} />
            解题模型管理
          </NavLink>
          <NavLink
            to="/admin/knowledge-models"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg mt-1 ${
                isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
              }`
            }
          >
            <Brain size={18} />
            知识点识别模型管理
          </NavLink>
          <NavLink
            to="/admin/semantic-models"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg mt-1 ${
                isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
              }`
            }
          >
            <Brain size={18} />
            语义情境识别模型管理
          </NavLink>
          <NavLink
            to="/admin/records"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg mt-1 ${
                isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
              }`
            }
          >
            <History size={18} />
            解题记录管理
          </NavLink>
          <NavLink
            to="/admin/favorites"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg mt-1 ${
                isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
              }`
            }
          >
            <Heart size={18} />
            收藏记录管理
          </NavLink>
          <NavLink
            to="/admin/experiment-flows"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg mt-1 ${
                isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
              }`
            }
          >
            <FlaskConical size={18} />
            认知实验流
          </NavLink>
          <NavLink
            to="/admin/experiment-sampling"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg mt-1 ${
                isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
              }`
            }
          >
            <Dices size={18} />
            分层覆盖抽样
          </NavLink>
          <NavLink
            to="/admin/experiment-data"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg mt-1 ${
                isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
              }`
            }
          >
            <Database size={18} />
            认知实验数据
          </NavLink>
          <NavLink
            to="/admin/test"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg mt-1 ${
                isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
              }`
            }
          >
            <Wifi size={18} />
            后端连接测试
          </NavLink>
        </nav>
        <div className="p-2 border-t border-slate-700">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-700 w-full text-left"
          >
            <LogOut size={18} />
            退出
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 min-h-0 p-6 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
