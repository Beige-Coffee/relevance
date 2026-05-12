import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  webpack: (config, { isServer, webpack }) => {
    if (!isServer && webpack) {
      // The Anthropic SDK imports node:fs/node:path/node:os for server-side
      // credential file loading. Those code paths are never reached in the
      // browser (we always pass apiKey directly). Ignore the imports during
      // browser builds so webpack doesn't choke on the node: scheme.
      config.plugins = config.plugins ?? [];
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^node:(fs|path|os|crypto)(\/.*)?$/,
        })
      );
    }
    return config;
  },
};

export default nextConfig;
