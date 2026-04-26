import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function multiDirResolver() {
  const dirs = ['frontend', 'backend', 'integration', 'payment-gateway', 'ui-ux'];
  return {
    name: 'multi-dir-resolver',
    enforce: 'pre' as const,
    async resolveId(source: string, importer: string | undefined, options: any) {
      if (source.startsWith('@/')) {
        let subPath = source.slice(2);
        
        // Handle files that were moved to different subdirectories during the split
        if (subPath.startsWith('integrations/')) subPath = subPath.replace('integrations/', '');
        if (subPath === 'contexts/AuthContext') subPath = 'auth/AuthContext';
        if (subPath === 'pages/AuthCallback') subPath = 'auth/AuthCallback';
        if (subPath === 'pages/ResetPassword') subPath = 'auth/ResetPassword';
        if (subPath === 'components/ProtectedRoute') subPath = 'auth/ProtectedRoute';
        if (subPath === 'components/PaymentModal') subPath = 'PaymentModal';
        if (subPath === 'components/PaywallModal') subPath = 'PaywallModal';

        for (const dir of dirs) {
          const tryPath = path.resolve(__dirname, dir, subPath);
          const resolution = await this.resolve(tryPath, importer, { skipSelf: true, ...options });
          if (resolution) return resolution;
        }
      }
      return null;
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    multiDirResolver(),
    react(),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
