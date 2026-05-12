import { useState } from 'react';
import { WORKCELL_LOGOS, OleStatus } from '@/lib/ole/oleConstants';

interface WorkcellBadgeProps {
  name: string;
  status: OleStatus | string;
}

export default function WorkcellBadge({ name, status }: WorkcellBadgeProps) {
  const [imgErr, setImgErr] = useState(false);
  const key = name.toLowerCase().replace(/[^a-z]/g, '');  // strip numbers/spaces: 'aop1' → 'aop'
  const logoKey = Object.keys(WORKCELL_LOGOS).find(k => key.startsWith(k)) ?? key;
  const logoSrc = WORKCELL_LOGOS[logoKey];
  
  const ring: Record<string, string> = {
    optimal: 'ring-emerald-500/30',
    warning: 'ring-amber-500/30',
    critical: 'ring-red-500/30',
    idle: 'ring-border',
  };
  
  const bg: Record<string, string> = {
    optimal: 'bg-emerald-500/15 text-emerald-400',
    warning: 'bg-amber-500/15  text-amber-400',
    critical: 'bg-red-500/15    text-red-400',
    idle: 'bg-muted         text-muted-foreground',
  };

  if (logoSrc && !imgErr) {
    return (
      <div 
        className={`w-14 h-8 rounded-lg overflow-hidden ring-1 flex-shrink-0 flex items-center justify-center ${ring[status] ?? 'ring-border'}`}
        style={{ background: '#ffffff' }}
      >
        <img 
          src={logoSrc} 
          alt={name} 
          onError={() => setImgErr(true)} 
          className="w-full h-full object-contain p-1" 
        />
      </div>
    );
  }
  
  return (
    <div 
      className={`w-14 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ring-1 flex-shrink-0 ${bg[status] ?? 'bg-muted text-muted-foreground'} ${ring[status] ?? 'ring-border'}`}
    >
      {name.slice(0, 3).toUpperCase()}
    </div>
  );
}
