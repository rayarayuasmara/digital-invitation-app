/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(host => host.trim())
    .filter(Boolean),
}

export default nextConfig
