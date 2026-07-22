import { Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from './BottomNav';
import { PageTransition } from "../shared/PageTransition";


export const AppLayout = () => (
  <div className="flex min-h-screen">
    <Sidebar />
    <div className="flex flex-1 flex-col">
      <Topbar />
      <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">
        <PageTransition>
        <Outlet />
        </PageTransition>
      </main>
    </div>
     <BottomNav />
    <Toaster />
  </div>
);
