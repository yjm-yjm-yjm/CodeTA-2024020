import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { homePath, useAuth } from "@/store/auth";
import type { Role } from "@/types";
import LoginPage from "@/pages/auth/LoginPage";
import StudentList from "@/pages/student/ProjectListPage";
import StudentForm from "@/pages/student/ProjectFormPage";
import StudentResult from "@/pages/student/ProjectResultPage";
import ReviewerList from "@/pages/reviewer/AssignedListPage";
import ReviewForm from "@/pages/reviewer/ReviewFormPage";
import AdminDashboard from "@/pages/admin/DashboardPage";
import AdminProjects from "@/pages/admin/ProjectListPage";
import AdminAssign from "@/pages/admin/AssignReviewersPage";
import AdminResults from "@/pages/admin/ResultsPage";

function Guard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, hydrated } = useAuth();
  if (!hydrated) return <div className="p-8">加载中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { hydrate, user, hydrated } = useAuth();
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) return <div className="p-8">加载中...</div>;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={homePath(user.role)} replace /> : <LoginPage />}
      />

      <Route
        element={
          <Guard roles={["student"]}>
            <AppShell links={[{ to: "/student/projects", label: "我的立项" }]} />
          </Guard>
        }
      >
        <Route path="/student/projects" element={<StudentList />} />
        <Route path="/student/projects/new" element={<StudentForm />} />
        <Route path="/student/projects/:id/edit" element={<StudentForm />} />
        <Route path="/student/projects/:id/result" element={<StudentResult />} />
      </Route>

      <Route
        element={
          <Guard roles={["reviewer"]}>
            <AppShell links={[{ to: "/reviewer/projects", label: "评审任务" }]} />
          </Guard>
        }
      >
        <Route path="/reviewer/projects" element={<ReviewerList />} />
        <Route path="/reviewer/projects/:id/review" element={<ReviewForm />} />
      </Route>

      <Route
        element={
          <Guard roles={["admin"]}>
            <AppShell
              links={[
                { to: "/admin/dashboard", label: "看板" },
                { to: "/admin/projects", label: "立项" },
                { to: "/admin/results", label: "评审结果" },
              ]}
            />
          </Guard>
        }
      >
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/projects" element={<AdminProjects />} />
        <Route path="/admin/projects/:id/assign" element={<AdminAssign />} />
        <Route path="/admin/results" element={<AdminResults />} />
      </Route>

      <Route path="/" element={<Navigate to={user ? homePath(user.role) : "/login"} replace />} />
      <Route path="*" element={<Navigate to={user ? homePath(user.role) : "/login"} replace />} />
    </Routes>
  );
}
