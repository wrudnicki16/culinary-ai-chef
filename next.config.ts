import type { NextConfig } from "next";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const nextConfig: NextConfig = {
  serverExternalPackages: ["braintrust"],
  turbopack: {
    rules: {
      "*.{js,mjs,cjs}": {
        loaders: [{ loader: require.resolve("braintrust/webpack-loader"), options: {} }],
      },
    },
  },
};

export default nextConfig;
