/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg', 'jspdf', '@electric-sql/pglite', 'web-push'],
  poweredByHeader: false,
};
export default nextConfig;
