import React from 'react';
import { LayoutDashboard, Bell, User } from 'lucide-react';

export default function Header() {
  return (
    <header className="glass-panel sticky top-0 z-50">
      <div className="container flex justify-between items-center py-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2 rounded-lg">
            <LayoutDashboard size={24} color="white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">EbookGov AI Agent</h1>
            <p className="text-sm text-muted">Real Estate Knowledge Base</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <Bell size={20} className="text-slate-400" />
          </button>
          <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium">Demo Agent</p>
              <p className="text-xs text-muted">Pro Plan</p>
            </div>
            <div className="bg-slate-700 p-2 rounded-full">
              <User size={20} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
