/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The collector lives in /collector with its own package.json and must not be
  // pulled into the Next build graph.
  outputFileTracingExcludes: {
    '*': ['./collector/**']
  }
};

export default nextConfig;
