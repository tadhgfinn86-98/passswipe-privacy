#!/usr/bin/env node
// d7 — local business lead finder CLI.
import { writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { findLeads } from '../src/search.js';
import { render } from '../src/export.js';
import { startServer } from '../server/server.js';
import { DiskCache } from '../src/cache.js';

const HELP = `
d7 — leads finder: find local businesses, enrich contacts, score the opportunity.

USAGE
  d7 "<keyword>" --in "<location>" [options]
  d7 serve [--port 8787]
  d7 cache clear

EXAMPLES
  d7 "dentist" --in "Dublin, Ireland" --limit 50 --out dentists.csv
  d7 "plumber,electrician" --in "Manchester, UK" --radius 15 --no-website
  d7 "cafe" --in "53.3498,-6.2603" --radius 3 --require-email --format json
  d7 "gym" --in "Austin, TX" --source google --min-rating 4 --out gyms.csv

SEARCH
  --in, --location <place>   Place name, address, or "lat,lng"   (required)
  --radius <km>              Search radius, default 10
  --limit <n>                Max leads returned, default 100
  --source <name>            overpass (default, free) | google (GOOGLE_MAPS_API_KEY)
  --sort <field>             score (default) | name | rating | reviews

ENRICHMENT
  --no-enrich                Skip website crawling (much faster, fewer emails)
  --concurrency <n>          Parallel site crawls, default 6
  --pages <n>                Pages per site (home + contact pages), default 3
  --ignore-robots            Crawl even when robots.txt disallows (not recommended)

FILTERS
  --require-email            Only leads with an email address
  --require-phone            Only leads with a phone number
  --no-website               Only businesses with no website (classic agency list)
  --has-website              Only businesses that do have a website
  --min-score <n>            Drop leads below this score (0-100)
  --min-rating <n>           Google source only
  --category <regex>         Keep leads whose category/name matches

OUTPUT
  --out <file>               Write results (format inferred from extension)
  --format <fmt>             csv (default) | json | ndjson | html
  --json                     Print JSON to stdout instead of a table
  --quiet                    Suppress progress output
  --no-cache                 Bypass the on-disk API cache
  -h, --help                 Show this help
`;

function parseArgs(argv) {
  const opts = { _: [] };
  const flags = new Set([
    'help',
    'h',
    'no-enrich',
    'ignore-robots',
    'require-email',
    'require-phone',
    'no-website',
    'has-website',
    'json',
    'quiet',
    'no-cache',
  ]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('-')) {
      opts._.push(arg);
      continue;
    }
    const name = arg.replace(/^--?/, '');
    if (flags.has(name)) {
      opts[name] = true;
      continue;
    }
    const [key, inlineValue] = name.split('=');
    opts[key] = inlineValue ?? argv[++i];
  }
  return opts;
}

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

function formatFor(opts) {
  if (opts.format) return String(opts.format).toLowerCase();
  const ext = opts.out ? extname(opts.out).replace('.', '').toLowerCase() : '';
  return ['csv', 'json', 'ndjson', 'jsonl', 'html'].includes(ext) ? ext : 'csv';
}

function printTable(leads) {
  if (!leads.length) {
    console.log('\nNo leads matched. Try a bigger --radius, a broader keyword, or drop --require-email.');
    return;
  }
  const rows = leads.map((l) => ({
    score: String(l.score ?? ''),
    name: l.name.slice(0, 30),
    phone: (l.phone || '').slice(0, 18),
    email: (l.email || '').slice(0, 30),
    site: (l.domain || '—').slice(0, 26),
    opp: (l.opportunities || []).slice(0, 2).join(','),
  }));
  const cols = ['score', 'name', 'phone', 'email', 'site', 'opp'];
  const width = Object.fromEntries(cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => r[c].length))]));
  const line = (r) => cols.map((c) => String(r[c]).padEnd(width[c])).join('  ');
  console.log('');
  console.log(line(Object.fromEntries(cols.map((c) => [c, c.toUpperCase()]))));
  console.log(cols.map((c) => '-'.repeat(width[c])).join('  '));
  for (const r of rows) console.log(line(r));
}

function progressReporter(quiet) {
  let lastPhase = '';
  return (event) => {
    if (quiet) return;
    const { phase, message, done, total } = event;
    const counter = total ? ` [${done ?? 0}/${total}]` : '';
    if (phase === 'enrich' && lastPhase === 'enrich' && process.stderr.isTTY) {
      process.stderr.write(`\r  enrich${counter} ${String(message).slice(0, 48).padEnd(48)}`);
    } else {
      if (lastPhase === 'enrich' && process.stderr.isTTY) process.stderr.write('\n');
      process.stderr.write(`  ${phase}: ${message}${counter}\n`);
    }
    lastPhase = phase;
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const [command] = opts._;

  if (opts.help || opts.h || (!opts._.length && !opts.in && !opts.location)) {
    console.log(HELP.trim());
    return;
  }

  if (command === 'serve') {
    const port = num(opts.port, Number(process.env.PORT) || 8787);
    await startServer({ port, host: opts.host || '127.0.0.1' });
    return;
  }

  if (command === 'cache' && opts._[1] === 'clear') {
    await new DiskCache().clear();
    console.log('Cache cleared.');
    return;
  }

  const keyword = opts._.join(' ').trim() || opts.keyword;
  const location = opts.in || opts.location;
  if (!keyword) throw new Error('missing keyword — try: d7 "dentist" --in "Dublin, Ireland"');
  if (!location) throw new Error('missing --in <location> — try: d7 "dentist" --in "Dublin, Ireland"');

  const started = Date.now();
  const { leads, area, stats } = await findLeads({
    keyword,
    location,
    radiusKm: num(opts.radius, 10),
    limit: num(opts.limit, 100),
    source: opts.source || 'overpass',
    enrich: !opts['no-enrich'],
    concurrency: num(opts.concurrency, 6),
    maxPages: num(opts.pages, 3),
    respectRobots: !opts['ignore-robots'],
    useCache: !opts['no-cache'],
    sort: opts.sort || 'score',
    filters: {
      requireEmail: Boolean(opts['require-email']),
      requirePhone: Boolean(opts['require-phone']),
      withoutWebsite: Boolean(opts['no-website']),
      requireWebsite: Boolean(opts['has-website']),
      minScore: num(opts['min-score'], 0),
      minRating: opts['min-rating'] != null ? num(opts['min-rating'], null) : null,
      category: opts.category || '',
    },
    onProgress: progressReporter(opts.quiet || opts.json),
  });

  const format = formatFor(opts);
  const output = render(leads, format, { title: `${keyword} — ${area.displayName}` });

  if (opts.out) {
    const path = resolve(opts.out);
    await writeFile(path, output, 'utf8');
    if (!opts.quiet) console.log(`\nSaved ${leads.length} leads → ${path}`);
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify({ area, stats, leads }, null, 2) + '\n');
    return;
  }

  if (!opts.out) process.stdout.write(format === 'csv' ? '' : output);
  printTable(leads);

  if (!opts.quiet) {
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `\n${stats.count} leads · ${stats.withEmail} with email · ${stats.withPhone} with phone · ` +
        `${stats.withoutWebsite} without a website · avg score ${stats.avgScore} · ${secs}s`,
    );
    if (stats.topOpportunities.length) {
      console.log(`top angles: ${stats.topOpportunities.map((o) => `${o.name} (${o.count})`).join(', ')}`);
    }
    if (!opts.out) console.log('tip: add --out leads.csv to export');
  }
}

main().catch((err) => {
  console.error(`\nerror: ${err.message}`);
  process.exitCode = 1;
});
