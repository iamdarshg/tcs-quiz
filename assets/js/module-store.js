import { getModuleManifest, getModule, resetModuleDataCache } from './tcs-data.js';

export function createModuleStore({
  getManifest = getModuleManifest,
  getModule: loadModule = getModule,
  resetData = resetModuleDataCache
} = {}) {
  const cache = new Map();

  return {
    async getModules() {
      const manifest = await getManifest();
      const modules = await Promise.all(manifest.modules.map((meta) => {
        if (!cache.has(meta.id)) cache.set(meta.id, loadModule(meta.id));
        return cache.get(meta.id);
      }));
      return { manifest, modules };
    },
    reset() {
      cache.clear();
      resetData();
    }
  };
}

export const moduleStore = createModuleStore();
