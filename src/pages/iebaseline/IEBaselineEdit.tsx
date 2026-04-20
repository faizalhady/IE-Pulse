import React from 'react';
import { Card } from '@/components/ui/card';
import { Pencil, Settings, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MODULES } from './IEBaseline';
import { Button } from '@/components/ui/button';

export default function IEBaselineEdit() {
  return (
    <div className="space-y-6 px-6 pb-6 pt-32 max-w-7xl mx-auto">
      
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2 text-foreground">
            <Settings className="w-5 h-5 text-primary" />
            Manage Modules
          </h2>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            <Plus className="w-4 h-4" />
            Create New Module
          </Button>
        </div>

        <Card className="border-border/50 bg-background/40 backdrop-blur-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-4">Module Name</div>
            <div className="col-span-2">Date Created</div>
            <div className="col-span-3">Module Owner</div>
            <div className="col-span-2">Last Updated</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {/* Table Body */}
          <div className="flex flex-col w-full">
            {MODULES.map((mod) => (
              <div key={mod.id} className="grid grid-cols-12 gap-4 p-4 items-center border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors text-sm">
                <div className="col-span-4 font-medium text-foreground">
                  <Link
                    to={`/iebaseline/admin/${mod.id}`}
                    className="hover:text-primary transition-colors hover:underline underline-offset-4 line-clamp-1"
                    title={mod.name}
                  >
                    {mod.name}
                  </Link>
                </div>
                
                <div className="col-span-2 text-muted-foreground">
                  {mod.createdAt}
                </div>
                
                <div className="col-span-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {mod.owner.charAt(0)}
                  </div>
                  <span className="text-foreground truncate">{mod.owner}</span>
                </div>
                
                <div className="col-span-2 text-muted-foreground">
                  {mod.lastUpdated}
                </div>
                
                <div className="col-span-1 flex justify-end">
                  <Link
                    to={`/iebaseline/admin/${mod.id}`}
                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                    title="Edit Module"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
