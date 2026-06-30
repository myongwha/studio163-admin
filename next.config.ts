import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // スマホ等 LAN 内の別端末から dev サーバーにアクセスできるよう許可
  // （Next.js 16 はクロスオリジンの dev リソースを既定でブロックするため）
  allowedDevOrigins: ["192.168.40.180"],
};

export default nextConfig;
