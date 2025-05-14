const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const net = require('net');

const app = express();

const TARGET_HOSTNAME = 'googleapis.com';

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
        const requestHostname = req.hostname;
        let finalTargetHostname;

        if (net.isIP(requestHostname) !== 0) {
            // 如果是 IP 地址, 直接路由到目标域名
            finalTargetHostname = TARGET_HOSTNAME;
        } else {
            // 如果是主机名 (例如 localhost, sub.domain.com)
            const parts = requestHostname.split('.');
            if (parts.length > 2) {
                // 例如: 'sub1.sub2.proxy.com' -> 'sub1.sub2.googleapis.com'
                finalTargetHostname = parts.slice(0, parts.length - 2).join('.') + `.${TARGET_HOSTNAME}`;
            } else {
                // 例如: 'proxy.com' 或 'localhost' -> 'googleapis.com'
                finalTargetHostname = TARGET_HOSTNAME;
            }
        }

        return `https://${finalTargetHostname}`;
    },
    pathRewrite: (path, req) => {
        return path;
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
