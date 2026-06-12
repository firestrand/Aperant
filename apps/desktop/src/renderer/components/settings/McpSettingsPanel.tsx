import { AlertCircle, CheckCircle2, Circle, Globe, Loader2, Lock, Pencil, Plus, RefreshCw, Terminal, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CustomMcpServer, McpHealthCheckResult } from '../../../shared/types';
import { Button } from '../ui/button';

interface McpSettingsPanelProps {
  servers: CustomMcpServer[];
  healthStatus?: Record<string, McpHealthCheckResult>;
  testingServers?: Set<string>;
  onAdd: () => void;
  onEdit?: (server: CustomMcpServer) => void;
  onDelete?: (serverId: string) => void;
  onTest?: (server: CustomMcpServer) => void;
  canEditServer?: (server: CustomMcpServer) => boolean;
  canDeleteServer?: (server: CustomMcpServer) => boolean;
  getSourceLabel?: (server: CustomMcpServer) => string;
}

export function McpSettingsPanel({
  servers,
  healthStatus = {},
  testingServers = new Set<string>(),
  onAdd,
  onEdit,
  onDelete,
  onTest,
  canEditServer,
  canDeleteServer,
  getSourceLabel,
}: McpSettingsPanelProps) {
  const { t } = useTranslation('settings');

  return (
    <div className="pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            {t('mcp.customServers')}
          </span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3 w-3" />
          {t('mcp.addCustomServer')}
        </button>
      </div>

      {servers.length > 0 ? (
        <div className="space-y-2">
          {servers.map((server) => {
            const health = healthStatus[server.id];
            const isTesting = testingServers.has(server.id);
            const isChecking = health?.status === 'checking';
            const sourceLabel = getSourceLabel?.(server);
            const canEdit = Boolean(onEdit) && (canEditServer?.(server) ?? true);
            const canDelete = Boolean(onDelete) && (canDeleteServer?.(server) ?? true);

            const StatusIndicator = () => {
              if (isTesting || isChecking) {
                return <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />;
              }
              switch (health?.status) {
                case 'healthy':
                  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
                case 'needs_auth':
                  return <Lock className="h-3.5 w-3.5 text-amber-500" />;
                case 'unhealthy':
                  return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
                default:
                  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
              }
            };

            return (
              <div key={server.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg group">
                <div className="flex items-center gap-3">
                  <StatusIndicator />
                  {server.type === 'command' ? (
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{server.name}</span>
                      {health?.responseTime && (
                        <span className="text-[10px] text-muted-foreground">{health.responseTime}ms</span>
                      )}
                      {sourceLabel && (
                        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {sourceLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {health?.message || (server.type === 'command'
                        ? `${server.command} ${server.args?.join(' ') || ''}`
                        : server.url)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {onTest && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTest(server)}
                      disabled={isTesting}
                      className="h-7 px-2 text-xs"
                      title={t('mcp.testConnection')}
                    >
                      {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      <span className="ml-1">{t('mcp.testConnection')}</span>
                    </Button>
                  )}
                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(server)}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          title={t('mcp.editCustomServer')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(server.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                          title={t('actions.delete', { defaultValue: 'Delete' })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-3">
          {t('mcp.noCustomServers')}
        </p>
      )}
    </div>
  );
}
