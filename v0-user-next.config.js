/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  api: {
    bodyParser: {
      sizeLimit: '1gb',
    },
    responseLimit: '1gb',
  },
}

module.exports = nextConfig

