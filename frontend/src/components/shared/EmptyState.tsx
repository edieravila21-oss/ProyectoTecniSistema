import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="text-muted-foreground mb-4">
      {icon || <InboxIcon className="h-12 w-12" />}
    </div>
    <h3 className="text-lg font-semibold">{title}</h3>
    {description && <p className="text-muted-foreground mt-1 text-sm max-w-md">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
