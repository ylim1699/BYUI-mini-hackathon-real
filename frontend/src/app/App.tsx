import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { AddClassesPage } from "../pages/AddClassesPage";
import { CalendarPage } from "../pages/CalendarPage";
import { ReviewPage } from "../pages/ReviewPage";
import { StartPage } from "../pages/StartPage";
import { StudyPage } from "../pages/StudyPage";
import { SyncPage } from "../pages/SyncPage";
import { TrashPage } from "../pages/TrashPage";

function Gate() {
  const { loading, user, holding } = useAuth();
  if (loading) return <div className="app" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)" }}><Spinner /></div>;
  if (!user || holding) return <StartPage />;
  return <AppLayout />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Gate />,
    children: [
      { index: true, element: <Navigate to="/calendar" replace /> },
      { path: "add", element: <AddClassesPage /> },
      { path: "review", element: <ReviewPage /> },
      { path: "study", element: <StudyPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "sync", element: <SyncPage /> },
      { path: "trash", element: <TrashPage /> },
      { path: "*", element: <Navigate to="/calendar" replace /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}

