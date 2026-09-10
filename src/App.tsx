import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Home from "@/pages/user/Home";
import MyPage from "@/pages/user/MyPage";
import ProblemRecords from "@/pages/user/ProblemRecords";
import MyFavorites from "@/pages/user/MyFavorites";
import ProblemResult from "@/pages/user/ProblemResult";
import ProblemInput from "@/pages/user/ProblemInput";
import Login from "@/pages/user/Login";
import Register from "@/pages/user/Register";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminModels from "@/pages/admin/AdminModels";
import AdminKnowledgeModels from "@/pages/admin/AdminKnowledgeModels";
import AdminSemanticModels from "@/pages/admin/AdminSemanticModels";
import AdminRecords from "@/pages/admin/AdminRecords";
import AdminFavorites from "@/pages/admin/AdminFavorites";
import AdminTest from "@/pages/admin/AdminTest";
import AdminExperimentQuestions from "@/pages/admin/AdminExperimentQuestions";
import AdminExperimentData from "@/pages/admin/AdminExperimentData";
import AdminExperimentSampling from "@/pages/admin/AdminExperimentSampling";
import ExperimentHomePage from "@/modules/experiment/pages/ExperimentHomePage";
import ExperimentRunPage from "@/modules/experiment/pages/ExperimentRunPage";
import { useContext } from "react";
import { AuthContext } from "@/contexts/authContext";
import { Layout } from "@/components/Layout";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authReady } = useContext(AuthContext);
  const location = useLocation();
  if (!authReady) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/experiment/:flowId/run" element={<ExperimentRunPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/users" replace />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="models" element={<AdminModels />} />
        <Route path="knowledge-models" element={<AdminKnowledgeModels />} />
        <Route path="semantic-models" element={<AdminSemanticModels />} />
        <Route path="records" element={<AdminRecords />} />
        <Route path="favorites" element={<AdminFavorites />} />
        <Route path="experiment-flows" element={<AdminExperimentQuestions />} />
        <Route path="experiment-sampling" element={<AdminExperimentSampling />} />
        <Route path="experiment-data" element={<AdminExperimentData />} />
        <Route path="test" element={<AdminTest />} />
      </Route>
      <Route path="/" element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/experiment" element={<ExperimentHomePage />} />
        <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
        <Route path="/problem-records" element={<ProtectedRoute><ProblemRecords /></ProtectedRoute>} />
        <Route path="/my-favorites" element={<ProtectedRoute><MyFavorites /></ProtectedRoute>} />
        <Route path="/problem-result/:id" element={<ProtectedRoute><ProblemResult /></ProtectedRoute>} />
        <Route path="/problem-input" element={<ProtectedRoute><ProblemInput /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}
