interface EmptyStateProps {
  title: string;
  description?: string;
}

export const EmptyState = ({ title, description }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
    <p className="text-sm font-medium">{title}</p>
    {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
  </div>
);