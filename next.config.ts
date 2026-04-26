/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/landing.html',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'novae-by-omanaia.com',
          },
        ],
      },
      {
        source: '/',
        destination: '/landing.html',
        permanent: false,
        has: [
          {
            type: 'host',
            value: 'www.novae-by-omanaia.com',
          },
        ],
      },
    ]
  },
}
export default nextConfig