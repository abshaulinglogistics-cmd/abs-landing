/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg', 'jspdf', '@electric-sql/pglite'],
  poweredByHeader: false,
};
export default nextConfig;
