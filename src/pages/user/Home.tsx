import { Link } from 'react-router-dom';
import { FlaskConical, User, PenLine, Database } from 'lucide-react';

export default function Home() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-10 pb-8">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 md:p-12 shadow-sm border border-blue-100">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
              面向认知实验的数学应用题求解模拟系统
            </h1>
            <h2 className="text-lg md:text-xl text-blue-600 font-medium mb-5">
              MWPCogExp V1.0
            </h2>
            <p className="text-gray-600 mb-8 text-base leading-relaxed">
              面向数学解题认知过程采集：支持实验流配置、全屏手写作答、笔迹与事件记录、题间休息控制，以及实验会话数据归档与管理。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/experiment"
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium shadow-md hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <FlaskConical size={18} />
                进入认知实验
              </Link>
              <Link
                to="/mypage"
                className="px-6 py-3 bg-white text-neutral-800 border border-neutral-300 rounded-xl font-medium hover:bg-neutral-50 transition-colors inline-flex items-center gap-2"
              >
                <User size={18} />
                个人中心
              </Link>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-4">核心能力</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
                <FlaskConical className="text-blue-600" size={20} />
              </div>
              <h4 className="font-semibold text-gray-800 mb-1">可配置实验流</h4>
              <p className="text-sm text-gray-500">按流组织题目，支持启用状态与题间休息参数。</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
                <PenLine className="text-indigo-600" size={20} />
              </div>
              <h4 className="font-semibold text-gray-800 mb-1">手写作答采集</h4>
              <p className="text-sm text-gray-500">全屏沉浸作答，记录笔迹、按键与题目截图快照。</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <Database className="text-emerald-600" size={20} />
              </div>
              <h4 className="font-semibold text-gray-800 mb-1">会话数据归档</h4>
              <p className="text-sm text-gray-500">实验结束后提交会话，供管理端检索、查看与导出。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
