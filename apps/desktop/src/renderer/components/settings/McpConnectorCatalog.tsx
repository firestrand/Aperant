import { useState } from 'react';
import { PackageSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  MCP_CONNECTOR_CATALOG,
  catalogEntryRequiresUserConfiguration,
  catalogEntryToCustomMcpServer,
  type McpCatalogCategory,
} from '../../../shared/mcp/connector-catalog';
import type { CustomMcpServer } from '../../../shared/types';
import { Button } from '../ui/button';

interface McpConnectorCatalogProps {
  existingServers: CustomMcpServer[];
  onInstall: (server: CustomMcpServer) => void | Promise<void>;
}

export function McpConnectorCatalog({ existingServers, onInstall }: McpConnectorCatalogProps) {
  const { t } = useTranslation('settings');
  const [selectedCategory, setSelectedCategory] = useState<McpCatalogCategory | 'all'>('all');
  const existingIds = new Set(existingServers.map((server) => server.id));
  const categories = Array.from(new Set(MCP_CONNECTOR_CATALOG.map((entry) => entry.category))).sort();
  const visibleEntries = selectedCategory === 'all'
    ? MCP_CONNECTOR_CATALOG
    : MCP_CONNECTOR_CATALOG.filter((entry) => entry.category === selectedCategory);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <PackageSearch className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <h4 className="text-sm font-semibold text-foreground">{t('mcp.catalog.title')}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{t('mcp.catalog.description')}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="mcp-catalog-category">
          {t('mcp.catalog.filterLabel')}
        </label>
        <select
          id="mcp-catalog-category"
          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value as McpCatalogCategory | 'all')}
        >
          <option value="all">{t('mcp.catalog.categories.all')}</option>
          {categories.map((category) => (
            <option key={category} value={category}>{t(`mcp.catalog.categories.${category}`)}</option>
          ))}
        </select>
      </div>

      {visibleEntries.length === 0 ? (
        <p className="mt-4 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
          {t('mcp.catalog.empty')}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {visibleEntries.map((entry) => {
            const installed = existingIds.has(entry.id);
            const requiresConfiguration = catalogEntryRequiresUserConfiguration(entry);
            return (
              <div key={entry.id} className="flex items-center justify-between gap-4 rounded-lg bg-muted/40 p-3">
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-medium text-foreground">{t(entry.nameKey)}</div>
                  <p className="text-xs text-muted-foreground">{t(entry.descriptionKey)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t(`mcp.catalog.transports.${entry.transport}`)} · {t(`mcp.catalog.licenses.${entry.id}`)} · {t(`mcp.catalog.maintenanceStatuses.${entry.maintenanceStatus}`)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('mcp.catalog.package')}: {entry.packageName ? `${entry.packageName}@${entry.packageVersion}` : t('mcp.catalog.notApplicable')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {entry.requiredEnv?.length
                      ? `${t('mcp.catalog.requiredEnv')}: ${entry.requiredEnv.map((env) => env.name).join(', ')}`
                      : t('mcp.catalog.noRequiredEnv')}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={installed || requiresConfiguration}
                  onClick={() => onInstall(catalogEntryToCustomMcpServer(entry))}
                >
                  {installed
                    ? t('mcp.catalog.installed')
                    : requiresConfiguration
                      ? t('mcp.catalog.requiresSetup')
                      : t('mcp.catalog.install')}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
