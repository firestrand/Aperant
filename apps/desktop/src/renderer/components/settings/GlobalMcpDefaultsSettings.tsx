import { Plus, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CustomMcpServer } from '../../../shared/types';
import { saveSettings, useSettingsStore } from '../../stores/settings-store';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { CustomMcpDialog } from '../CustomMcpDialog';
import { McpSettingsPanel } from './McpSettingsPanel';

export function GlobalMcpDefaultsSettings() {
  const { t } = useTranslation('settings');
  const globalMcpServers = useSettingsStore((state) => state.settings.globalMcpServers ?? []);
  const globalMcpDefaults = useSettingsStore((state) => state.settings.globalMcpDefaults ?? {});
  const [showDialog, setShowDialog] = useState(false);
  const [editingServer, setEditingServer] = useState<CustomMcpServer | null>(null);

  const handleSave = async (server: CustomMcpServer) => {
    const existingIndex = globalMcpServers.findIndex((candidate) => candidate.id === server.id);
    const nextServers = existingIndex >= 0
      ? globalMcpServers.map((candidate, index) => index === existingIndex ? server : candidate)
      : [...globalMcpServers, server];
    await saveSettings({ globalMcpServers: nextServers });
  };

  const handleDelete = async (serverId: string) => {
    await saveSettings({
      globalMcpServers: globalMcpServers.filter((server) => server.id !== serverId),
    });
  };


  const updateGlobalDefaults = async (updates: Partial<NonNullable<typeof globalMcpDefaults>>) => {
    await saveSettings({
      globalMcpDefaults: {
        context7Enabled: globalMcpDefaults.context7Enabled !== false,
        serenaEnabled: globalMcpDefaults.serenaEnabled === true,
        serenaLaunchWebUi: globalMcpDefaults.serenaLaunchWebUi !== false,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {t('mcp.globalDefaultsTitle')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('mcp.globalDefaultsDescription')}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingServer(null);
              setShowDialog(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('mcp.addCustomServer')}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-foreground">
            {t('mcp.builtinDefaultsTitle')}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('mcp.builtinDefaultsDescription')}
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/40 p-3">
            <div className="flex items-start gap-3">
              <Search className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">
                  {t('mcp.servers.context7.name')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('mcp.servers.context7.description')}
                </p>
              </div>
            </div>
            <Switch
              checked={globalMcpDefaults.context7Enabled !== false}
              onCheckedChange={(checked) => updateGlobalDefaults({ context7Enabled: checked })}
              aria-label={t('mcp.toggleServer', { server: t('mcp.servers.context7.name') })}
            />
          </div>

          <div className="space-y-3 rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground">
                    {t('mcp.servers.serena.name')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('mcp.servers.serena.description')}
                  </p>
                </div>
              </div>
              <Switch
                checked={globalMcpDefaults.serenaEnabled === true}
                onCheckedChange={(checked) => updateGlobalDefaults({ serenaEnabled: checked })}
                aria-label={t('mcp.toggleServer', { server: t('mcp.servers.serena.name') })}
              />
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-3 pl-7">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">
                  {t('mcp.serenaLaunchWebUi')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('mcp.serenaLaunchWebUiDescription')}
                </p>
              </div>
              <Switch
                checked={globalMcpDefaults.serenaLaunchWebUi !== false}
                disabled={globalMcpDefaults.serenaEnabled !== true}
                onCheckedChange={(checked) => updateGlobalDefaults({ serenaLaunchWebUi: checked })}
                aria-label={t('mcp.serenaLaunchWebUi')}
              />
            </div>
          </div>
        </div>
      </div>

      <McpSettingsPanel
        servers={globalMcpServers}
        onAdd={() => {
          setEditingServer(null);
          setShowDialog(true);
        }}
        onEdit={(server) => {
          setEditingServer(server);
          setShowDialog(true);
        }}
        onDelete={handleDelete}
        getSourceLabel={() => t('mcp.globalServer')}
      />

      <CustomMcpDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        server={editingServer}
        existingIds={globalMcpServers.map((server) => server.id)}
        onSave={handleSave}
      />
    </div>
  );
}
