import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { AddClassesPage } from "../pages/AddClassesPage";
import { CalendarPage } from "../pages/CalendarPage";
import { LoginPage } from "../pages/LoginPage";
import { ReviewPage } from "../pages/ReviewPage";
import { StudyPage } from "../pages/StudyPage";
import { SyncPage } from "../pages/SyncPage";
import { TrashPage } from "../pages/TrashPage";

function Gate() {
  const { loading, user } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner /></div>;
  return user ? <AppLayout /> : <LoginPage />;
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
