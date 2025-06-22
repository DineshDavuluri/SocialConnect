
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/providers/ThemeProvider";
import AuthForm from "@/components/auth/AuthForm";
import Home from "./pages/Home";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Search from "./pages/Search";
import Activity from "./pages/Activity";
import Create from "./pages/Create";
import Stories from "./pages/Stories";
import Saved from "./pages/Saved";
import NotFound from "./pages/NotFound";
import EnhancedSidebar from "@/components/layout/EnhancedSidebar";
import ResetPassword from './pages/reset-password';

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, loading } =

    useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">SocialApp</h2>
          <p className="text-gray-600 dark:text-gray-400">Loading your experience...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen flex w-full bg-gray-50 dark:bg-gray-900">
      <EnhancedSidebar />
      <main className="flex-1 ml-64">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/search" element={<Search />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/create" element={<Create />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
