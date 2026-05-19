import { estadoConfig } from '@/utils/helpers';

export const EstadoBadge = ({ estado }: { estado: string }) => {
  const config = estadoConfig[estado] || estadoConfig.pendiente;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
};
