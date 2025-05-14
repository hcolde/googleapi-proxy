const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const net = require('net');

const app = express();

// 添加前置中间件来清理请求
app.use((req, res, next) => {
    // 清除所有可能暴露IP的头部
    req.connection.remoteAddress = '0.0.0.0';
    req.socket.remoteAddress = '0.0.0.0';
    if (req.connection.socket) {
        req.connection.socket.remoteAddress = '0.0.0.0';
    }
    next();
});

const removeHeaders = [
    'accept-language',
    'forwarded',
    'user-agent',
    'x-forwarded',
    'x-vercel',
    'x-real-ip',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-forwarded-host',
    'via',
    'cf-connecting-ip',
    'cf-ipcountry',
    'true-client-ip',
    'cf-ray',
    'cf-visitor',
    'X-Proxy-Authorization',
]

app.use('/*', createProxyMiddleware({
    target: 'https://googleapis.com',
    changeOrigin: true,
    xfwd: false,
    secure: true,
    router: (req) => {
        const url = new URL(req.url);

        url.protocol = 'https:'; // 确保目标协议为 https

        const originalHostname = url.hostname;
        const parts = originalHostname.split('.');

        if (parts.length > 2) {
            // 如果原始主机名是 sub.domain.tld 格式, 新主机名将是 sub.googleapis.com
            url.hostname = parts.slice(0, parts.length - 2).join('.') + '.googleapis.com';
        } else {
            // 如果原始主机名是 domain.tld 或单个词 (例如 localhost), 新主机名将是 googleapis.com
            url.hostname = 'googleapis.com';
        }

        return url.toString();
    },
    on: {
        proxyReq: (proxyReq, req, res) => {
            for (const header of Object.keys(proxyReq.getHeaders())) {
                if (removeHeaders.some(h => header.toLowerCase().startsWith(h.toLowerCase()))) {
                    proxyReq.removeHeader(header);
                }
            }
        }
    }
}));

// 监听端口
const port = process.env.PORT || 3000;
app.listen(port);
