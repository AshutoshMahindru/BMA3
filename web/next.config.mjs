/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/dashboard/cash-flow',
        destination: '/dashboard/cashflow',
      },
      {
        source: '/dashboard/capital-strategy',
        destination: '/dashboard/capital',
      },
      {
        source: '/dashboard/simulation',
        destination: '/dashboard/simulations',
      },
    ];
  },
};

export default nextConfig;
