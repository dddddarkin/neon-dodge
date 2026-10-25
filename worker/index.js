/**
 * 《贴脸》DANGER CLOSE —— 线上排行榜后端（Cloudflare Worker + KV）
 *
 * 接口
 *   POST /api/score   提交成绩  { name?, score, wave, time, daily }
 *   GET  /api/top     取前 10
 *   GET  /api/health  健康检查
 *
 * 说明：分数在客户端计算，任何排行榜都无法彻底防伪造。
 * 这里做的是「低成本合理性校验 + 按 IP 限流」，能挡掉随手改数字的人。
 */

const TOP_KEY = 'top:v1';
const MAX_ROWS = 20;
const MAX_NAME = 12;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }, corsHeaders())
  });
}

function cleanName(raw) {
  const s = String(raw == null ? '' : raw)
    .replace(/[\u0000-\u001f<>\\"']/g, '')
    .trim()
    .slice(0, MAX_NAME);
  return s || '匿名飞行员';
}

/** 合理性：分数不可能超过「时间 × 每秒上限 + 起始分」 */
function plausible(s) {
  if (!(s.time >= 3 && s.time <= 7200)) return false;
  if (!(s.score >= 0 && s.score <= s.time * 420 + 4000)) return false;
  if (!(s.wave >= 0 && s.wave <= 200)) return false;
  return true;
}

async function readTop(env) {
  const raw = await env.SCORES.get(TOP_KEY);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

async function handleSubmit(req, env) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ ok: false, err: 'bad json' }, 400);
  }

  const s = {
    score: Math.floor(Number(body.score) || 0),
    wave: Math.floor(Number(body.wave) || 0),
    time: Math.floor(Number(body.time) || 0)
  };
  if (!plausible(s)) return json({ ok: false, err: 'implausible' }, 422);

  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = 'rl:' + ip;
  const now = Date.now();
  const last = Number(await env.SCORES.get(rlKey)) || 0;
  if (now - last < 15000) return json({ ok: false, err: 'too_fast' }, 429);
  await env.SCORES.put(rlKey, String(now), { expirationTtl: 120 });

  const rows = await readTop(env);
  const entry = {
    name: cleanName(body.name),
    score: s.score,
    wave: s.wave,
    time: s.time,
    daily: body.daily ? 1 : 0,
    at: now
  };
  rows.push(entry);
  rows.sort((a, b) => b.score - a.score || a.at - b.at);
  const top = rows.slice(0, MAX_ROWS);
  await env.SCORES.put(TOP_KEY, JSON.stringify(top));

  const rank = top.indexOf(entry) + 1;
  return json({ ok: true, rank: rank || null, top: top.slice(0, 10) });
}

async function handleTop(env) {
  const rows = await readTop(env);
  return json({ ok: true, top: rows.slice(0, 10) });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'neon-dodge-scores', at: Date.now() });
    }
    if (url.pathname === '/api/top' && req.method === 'GET') {
      return handleTop(env);
    }
    if (url.pathname === '/api/score' && req.method === 'POST') {
      return handleSubmit(req, env);
    }
    return json({ ok: false, err: 'not found' }, 404);
  }
};
