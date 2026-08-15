/**
 * 静态资源管理器模块
 * @module assets/manager
 */

/**
 * 静态资源管理器
 *
 * 前端已重构为 React 单页应用（hash 路由），所有页面均由 public/index.html 承载：
 * - 页面级权限（admin / mailboxes / mailbox / login）由前端依据 /api/session 结果控制；
 * - 数据接口全部走 /api/*，由路由层鉴权；
 * - 旧版多页面地址（/admin.html、/mailbox.html 等）统一重定向到 SPA 入口。
 */
export class AssetManager {
  constructor() {
    this.allowedPaths = new Set([
      '/',
      '/index.html',
      '/favicon.svg',
      '/theme-init.js',
      '/theme-init.css'
    ]);

    this.allowedPrefixes = [
      '/assets/',
      '/pic/'
    ];
  }

  isPathAllowed(pathname) {
    if (this.allowedPaths.has(pathname)) {
      return true;
    }
    return this.allowedPrefixes.some(prefix => pathname.startsWith(prefix));
  }

  async handleAssetRequest(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (!this.isPathAllowed(pathname)) {
      return Response.redirect(new URL('/', url).toString(), 302);
    }

    if (!env.ASSETS || !env.ASSETS.fetch) {
      return new Response('静态资源绑定缺失，请检查 wrangler 配置', { status: 500 });
    }

    if (pathname === '/' || pathname === '/index.html') {
      return await this.handleIndexPage(request, env);
    }

    // 哈希命名的构建产物：一年长缓存（_headers 在 Pages 高级模式下不生效，故由此处设置）
    if (pathname.startsWith('/assets/')) {
      const resp = await env.ASSETS.fetch(request);
      const headers = new Headers(resp.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(resp.body, { status: resp.status, headers });
    }

    return env.ASSETS.fetch(request);
  }

  /**
   * 返回 SPA 入口页面。
   * 邮件域名等运行时配置由前端通过 /api/domains 获取，无需注入 meta。
   */
  async handleIndexPage(request, env) {
    const resp = await env.ASSETS.fetch(request);
    const headers = new Headers(resp.headers);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return new Response(resp.body, { status: resp.status, headers });
  }

  addAllowedPath(path) {
    this.allowedPaths.add(path);
  }

  addAllowedPrefix(prefix) {
    this.allowedPrefixes.push(prefix);
  }

  removeAllowedPath(path) {
    this.allowedPaths.delete(path);
  }

  isApiPath(pathname) {
    return pathname.startsWith('/api/') || pathname === '/receive';
  }

  getAccessLog(request) {
    const url = new URL(request.url);
    return {
      timestamp: new Date().toISOString(),
      method: request.method,
      path: url.pathname,
      userAgent: request.headers.get('User-Agent') || '',
      referer: request.headers.get('Referer') || '',
      ip: request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For') ||
        request.headers.get('X-Real-IP') || 'unknown'
    };
  }
}

/**
 * 创建默认的资源管理器实例
 * @returns {AssetManager} 资源管理器实例
 */
export function createAssetManager() {
  return new AssetManager();
}
