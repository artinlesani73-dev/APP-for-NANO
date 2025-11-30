export interface CanvasPluginHost {
  registerPlugin: (name: string, plugin: unknown) => void;
  plugins?: Record<string, unknown>;
}

export const loadOptionalCanvasPlugins = async (host: CanvasPluginHost) => {
  const tools = [
    {
      name: 'grid-overlay',
      plugin: { type: 'overlay', description: 'Lightweight grid overlay for alignment' }
    },
    {
      name: 'snap-guides',
      plugin: { type: 'guide', description: 'Snap helpers to align layers' }
    }
  ];

  tools.forEach(tool => host.registerPlugin(tool.name, tool.plugin));
};
