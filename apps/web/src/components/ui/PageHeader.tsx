import { Breadcrumb } from "./Breadcrumb";

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} className="mb-3" />}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
