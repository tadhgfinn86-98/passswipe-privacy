// Spins up throwaway websites so enrichment can be tested without the internet.
import { createServer } from 'node:http';

export async function startSite(routes, { robots = '', host = '127.0.0.1' } = {}) {
  const server = createServer((req, res) => {
    const path = req.url.split('?')[0];
    if (path === '/robots.txt') {
      res.writeHead(robots ? 200 : 404, { 'content-type': 'text/plain' }).end(robots);
      return;
    }
    const body = routes[path];
    if (body === undefined) {
      res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>404</h1>');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-powered-by': 'PHP/7.4' }).end(body);
  });
  await new Promise((resolve) => server.listen(0, host, resolve));
  const { port } = server.address();
  return {
    origin: `http://${host}:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export const OLD_SITE_HOME = `<!doctype html><html><head><title>Joe's Plumbing</title>
<meta name="description" content="Emergency plumber in Dublin">
<link rel="stylesheet" href="/wp-content/themes/joe/style.css"></head>
<body><h1>Joe's Plumbing</h1>
<a href="/contact-us">Contact us</a>
<a href="/blog">Blog</a>
<footer>&copy; 2016 Joe's Plumbing</footer></body></html>`;

export const OLD_SITE_CONTACT = `<!doctype html><html><head><title>Contact</title></head><body>
<p>Call <a href="tel:+353 1 555 0100">01 555 0100</a></p>
<p>Email <a href="mailto:joe@joesplumbing.ie">joe@joesplumbing.ie</a></p>
<a href="https://www.facebook.com/joesplumbing">Facebook</a>
<form><input type="email" name="email"></form>
</body></html>`;

export const MODERN_SITE_HOME = `<!doctype html><html><head><title>Bright Dental</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script></head>
<body><a href="mailto:info@brightdental.ie">info@brightdental.ie</a>
<a href="https://instagram.com/brightdental">IG</a>
<footer>&copy; ${new Date().getFullYear()} Bright Dental</footer></body></html>`;
