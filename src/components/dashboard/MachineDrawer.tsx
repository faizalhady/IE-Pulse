import { Bay } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { statusText } from '@/components/StatusIndicator';
import { cn } from '@/lib/utils';

interface MachineDrawerProps {
  bay: Bay | null;
  open: boolean;
  onClose: () => void;
}

export default function MachineDrawer({ bay, open, onClose }: MachineDrawerProps) {
  const navigate = useNavigate();

  if (!bay) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card">
        <SheetHeader>
          <SheetTitle className="text-card-foreground">{bay.name}</SheetTitle>
          <p className={cn('text-2xl font-mono font-bold', statusText(bay.status))}>
            {bay.productivity}%
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Hourly UPH Chart */}
          <div>
            <h3 className="text-sm font-semibold text-card-foreground mb-2">Hourly UPH — Plan vs Actual</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bay.hourlyData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="plan" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} name="Plan" />
                  <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* WIP Table */}
          <div>
            <h3 className="text-sm font-semibold text-card-foreground mb-2">WIP</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Overall WIP</p>
                <p className="text-xl font-mono font-bold text-card-foreground">{bay.overallWip}</p>
              </div>
              <div className="rounded-md bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Pending WIP</p>
                <p className="text-xl font-mono font-bold text-card-foreground">{bay.pendingWip}</p>
              </div>
            </div>
          </div>

          {/* Downtime log */}
          <div>
            <h3 className="text-sm font-semibold text-card-foreground mb-2">Downtime Log</h3>
            <div className="space-y-1.5">
              {bay.downtimeLog.map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="font-mono text-muted-foreground">{d.timestamp}</span>
                  <span className="text-destructive font-medium">{d.duration}</span>
                  <span className="text-card-foreground">{d.reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Operator */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Operator on duty</span>
            <span className="text-sm font-medium text-card-foreground">{bay.operatorOnDuty}</span>
          </div>

          <Button
            onClick={() => { onClose(); navigate(`/pulse/bay/${bay.id}`); }}
            className="w-full"
          >
            View Full Bay →
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
