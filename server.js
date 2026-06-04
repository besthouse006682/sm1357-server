const express = require('express');
const path = require('path');
const https = require('https');

const app = express();

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// ===============================
// 텔레그램 알림 설정
// Render Environment에 저장한 값을 자동으로 읽습니다.
// ===============================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// ===============================
// Supabase 연결 설정
// 현재 단계에서는 관리자 DB 연결 테스트에만 사용합니다.
// ===============================
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

// ===============================
// 간단 쿠키 처리
// ===============================
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift().trim();
    const value = decodeURIComponent(parts.join('='));
    list[key] = value;
  });

  return list;
}

function setCookie(res, name, value, maxAgeSeconds) {
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax`);
}

function clearCookie(res, name) {
  res.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

function isAdminLoggedIn(req) {
  const cookies = parseCookies(req);
  return cookies.sm1357_admin === 'yes';
}

function requireAdmin(req, res, next) {
  if (!isAdminLoggedIn(req)) {
    return res.redirect('/admin-login');
  }
  next();
}

function getMemberCookie(req) {
  const cookies = parseCookies(req);
  return String(cookies.sm1357_member || '').trim().toLowerCase();
}

async function requireMember(req, res, next) {
  const username = getMemberCookie(req);

  if (!username) {
    return res.redirect('/login');
  }

  const result = await checkActiveMemberFromSupabase(username);

  if (!result.success || !result.data || result.data.success !== true) {
    clearCookie(res, 'sm1357_member');
    return res.redirect('/login');
  }

  req.memberId = result.data.username || username;
  next();
}

// ===============================
// 회원 계정
// ===============================
// 회원 아이디/비밀번호/정지 상태는 Supabase members 테이블에서 관리합니다.

// ===============================
// 관리자 계정
// ===============================
const ADMIN_ID = 'admin';
const ADMIN_PASSWORD = 'admin1357';

// ===============================
// 구매내역 저장소
// 구매내역 이미지와 상태는 Supabase Storage / purchases 테이블에 영구 저장됩니다.
// ===============================

// ===============================
// 공통 함수
// ===============================
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getStatusClass(status) {
  if (status === '적중') return 'status-win';
  if (status === '미적중') return 'status-lose';
  return 'status-progress';
}

// ===============================
// 텔레그램 알림 발송 함수
// 1단계에서는 관리자 테스트 버튼에서만 실행합니다.
// ===============================
function sendTelegramMessage(text) {
  return new Promise((resolve) => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('[TELEGRAM] Render 환경변수 누락');
      resolve(false);
      return;
    }

    const payload = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true
    });

    const request = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (response) => {
        let result = '';
        response.on('data', (chunk) => { result += chunk; });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            console.log('[TELEGRAM] 테스트 알림 전송 완료');
            resolve(true);
          } else {
            console.error('[TELEGRAM] 전송 실패:', response.statusCode, result);
            resolve(false);
          }
        });
      }
    );

    request.on('error', (error) => {
      console.error('[TELEGRAM] 요청 오류:', error.message);
      resolve(false);
    });

    request.write(payload);
    request.end();
  });
}

// ===============================
// Supabase 연결 테스트 함수
// members 테이블 조회만 확인하며 기존 기능은 변경하지 않습니다.
// ===============================
function testSupabaseConnection() {
  return new Promise((resolve) => {
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      resolve({ success: false, message: 'Render의 Supabase 환경변수가 없습니다.' });
      return;
    }

    let apiUrl;
    try {
      apiUrl = new URL('/rest/v1/members?select=username&order=username.asc&limit=3', SUPABASE_URL);
    } catch (error) {
      resolve({ success: false, message: 'SUPABASE_URL 형식이 올바르지 않습니다.' });
      return;
    }

    const request = https.request(
      {
        hostname: apiUrl.hostname,
        path: apiUrl.pathname + apiUrl.search,
        method: 'GET',
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Accept: 'application/json'
        }
      },
      (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            console.error('[SUPABASE] 연결 실패:', response.statusCode, body);
            resolve({ success: false, message: `Supabase 오류 코드: ${response.statusCode}` });
            return;
          }

          try {
            const rows = JSON.parse(body);
            const usernames = Array.isArray(rows)
              ? rows.map((row) => row.username).filter(Boolean)
              : [];

            console.log('[SUPABASE] 연결 성공:', usernames.join(', '));
            resolve({ success: true, usernames });
          } catch (error) {
            resolve({ success: false, message: 'Supabase 응답 처리 실패' });
          }
        });
      }
    );

    request.on('error', (error) => {
      console.error('[SUPABASE] 요청 오류:', error.message);
      resolve({ success: false, message: error.message });
    });

    request.end();
  });
}

// ===============================
// Supabase 회원관리 함수
// 관리자 페이지에서만 호출되며 Secret Key는 Render 서버 안에서만 사용됩니다.
// ===============================
function supabaseRequest(method, endpoint, data) {
  return new Promise((resolve) => {
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      resolve({ success: false, message: 'Render의 Supabase 환경변수가 없습니다.' });
      return;
    }

    let apiUrl;
    try {
      apiUrl = new URL(endpoint, SUPABASE_URL);
    } catch (error) {
      resolve({ success: false, message: 'SUPABASE_URL 형식이 올바르지 않습니다.' });
      return;
    }

    const payload = data ? JSON.stringify(data) : '';
    const headers = {
      apikey: SUPABASE_SECRET_KEY,
      Accept: 'application/json'
    };

    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const request = https.request(
      {
        hostname: apiUrl.hostname,
        path: apiUrl.pathname + apiUrl.search,
        method,
        headers
      },
      (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          let parsed = null;
          try {
            parsed = body ? JSON.parse(body) : null;
          } catch (error) {
            parsed = body;
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({ success: true, data: parsed });
            return;
          }

          const message = parsed && parsed.message
            ? parsed.message
            : `Supabase 오류 코드: ${response.statusCode}`;

          console.error('[SUPABASE] 회원관리 요청 실패:', response.statusCode, body);
          resolve({ success: false, message });
        });
      }
    );

    request.on('error', (error) => {
      console.error('[SUPABASE] 회원관리 요청 오류:', error.message);
      resolve({ success: false, message: error.message });
    });

    if (payload) request.write(payload);
    request.end();
  });
}

async function getMemberListFromSupabase() {
  return supabaseRequest(
    'GET',
    '/rest/v1/members?select=username,memo,is_active,created_at&order=username.asc',
    null
  );
}

async function callMemberAdminFunction(functionName, values) {
  return supabaseRequest(
    'POST',
    `/rest/v1/rpc/${functionName}`,
    values
  );
}

async function verifyMemberLoginFromSupabase(username, password) {
  return supabaseRequest(
    'POST',
    '/rest/v1/rpc/verify_member_login',
    {
      p_username: username,
      p_password: password
    }
  );
}

async function checkActiveMemberFromSupabase(username) {
  return supabaseRequest(
    'POST',
    '/rest/v1/rpc/check_active_member',
    {
      p_username: username
    }
  );
}

function memberResultPage(title, message, success) {
  return layout(title, `
    <div class="card">
      <h1 class="${success ? 'ok' : 'bad'}">${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <div class="row">
        <a class="btn btn-blue" href="/admin/members">회원관리로 돌아가기</a>
        <a class="btn btn-gray" href="/admin">관리자 페이지로 돌아가기</a>
      </div>
    </div>
  `);
}

// ===============================
// Supabase Storage 연결 테스트
// purchase-images 비공개 버킷에 작은 테스트 파일을 저장한 뒤 바로 삭제합니다.
// 실제 구매내역 저장 방식은 아직 변경하지 않습니다.
// ===============================
function supabaseStorageHeaders(hasBody, contentType) {
  const headers = {
    apikey: SUPABASE_SECRET_KEY,
    Accept: 'application/json'
  };

  // legacy service_role JWT 키는 Authorization으로 Storage RLS를 우회합니다.
  // 새 sb_secret_ 키는 apikey 헤더를 통해 서버 권한을 사용합니다.
  if (!SUPABASE_SECRET_KEY.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${SUPABASE_SECRET_KEY}`;
  }

  if (hasBody) {
    headers['Content-Type'] = contentType || 'application/octet-stream';
    headers['x-upsert'] = 'true';
  }

  return headers;
}

function supabaseStorageObjectRequest(method, objectPath, bodyBuffer, contentType) {
  return new Promise((resolve) => {
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      resolve({ success: false, message: 'Render의 Supabase 환경변수가 없습니다.' });
      return;
    }

    const safePath = objectPath.split('/').map(encodeURIComponent).join('/');
    let apiUrl;

    try {
      apiUrl = new URL(`/storage/v1/object/purchase-images/${safePath}`, SUPABASE_URL);
    } catch (error) {
      resolve({ success: false, message: 'SUPABASE_URL 형식이 올바르지 않습니다.' });
      return;
    }

    const headers = supabaseStorageHeaders(Boolean(bodyBuffer), contentType);
    if (bodyBuffer) headers['Content-Length'] = bodyBuffer.length;

    const request = https.request(
      {
        hostname: apiUrl.hostname,
        path: apiUrl.pathname + apiUrl.search,
        method,
        headers
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          let parsed = null;
          try { parsed = body ? JSON.parse(body) : null; } catch (e) { parsed = body; }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({ success: true, data: parsed });
          } else {
            const message = parsed && parsed.message
              ? parsed.message
              : `Storage 오류 코드: ${response.statusCode}`;
            console.error('[SUPABASE STORAGE]', response.statusCode, body);
            resolve({ success: false, message });
          }
        });
      }
    );

    request.on('error', (error) => {
      console.error('[SUPABASE STORAGE] 요청 오류:', error.message);
      resolve({ success: false, message: error.message });
    });

    if (bodyBuffer) request.write(bodyBuffer);
    request.end();
  });
}

async function testSupabaseStorageConnection() {
  const path = `system/storage-test-${Date.now()}.txt`;
  const upload = await supabaseStorageObjectRequest(
    'POST',
    path,
    Buffer.from('SM1357 Storage test', 'utf8'),
    'text/plain; charset=utf-8'
  );

  if (!upload.success) {
    return { success: false, message: `테스트 파일 업로드 실패: ${upload.message}` };
  }

  const remove = await supabaseStorageObjectRequest('DELETE', path, null);

  if (!remove.success) {
    return {
      success: false,
      message: `업로드는 성공했지만 테스트 파일 삭제 실패: ${remove.message}`
    };
  }

  return { success: true };
}

// ===============================
// 구매내역 영구 저장 공통 함수
// 이미지: purchase-images 버킷 / 상태·기록: purchases 테이블
// ===============================
function supabasePurchaseRequest(method, endpoint, data, prefer) {
  return new Promise((resolve) => {
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      resolve({ success: false, message: 'Render의 Supabase 환경변수가 없습니다.' });
      return;
    }

    let apiUrl;
    try {
      apiUrl = new URL(endpoint, SUPABASE_URL);
    } catch (error) {
      resolve({ success: false, message: 'SUPABASE_URL 형식이 올바르지 않습니다.' });
      return;
    }

    const payload = data ? JSON.stringify(data) : '';
    const headers = {
      apikey: SUPABASE_SECRET_KEY,
      Accept: 'application/json'
    };

    if (!SUPABASE_SECRET_KEY.startsWith('sb_secret_')) {
      headers.Authorization = `Bearer ${SUPABASE_SECRET_KEY}`;
    }

    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    if (prefer) {
      headers.Prefer = prefer;
    }

    const request = https.request(
      {
        hostname: apiUrl.hostname,
        path: apiUrl.pathname + apiUrl.search,
        method,
        headers
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          let parsed = null;
          try { parsed = body ? JSON.parse(body) : null; } catch (e) { parsed = body; }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({ success: true, data: parsed });
            return;
          }

          const message = parsed && parsed.message
            ? parsed.message
            : `Supabase 구매내역 오류 코드: ${response.statusCode}`;
          console.error('[SUPABASE PURCHASE]', response.statusCode, body);
          resolve({ success: false, message });
        });
      }
    );

    request.on('error', (error) => {
      console.error('[SUPABASE PURCHASE] 요청 오류:', error.message);
      resolve({ success: false, message: error.message });
    });

    if (payload) request.write(payload);
    request.end();
  });
}

function displayPurchaseDate(value) {
  try {
    return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  } catch (error) {
    return String(value || '');
  }
}

function normalizePurchase(row) {
  return {
    id: row.id,
    username: row.username,
    type: row.source || 'IMAGE',
    memo: row.memo || '',
    imagePath: row.image_path,
    image: `/purchase-image/${encodeURIComponent(String(row.id))}`,
    status: row.status || '확인중',
    createdAt: displayPurchaseDate(row.created_at)
  };
}

async function getPurchasesFromSupabase(username, filters = {}) {
  const conditions = [];

  if (username) {
    conditions.push(`username=eq.${encodeURIComponent(username)}`);
  }

  if (filters.username) {
    conditions.push(`username=eq.${encodeURIComponent(filters.username)}`);
  }

  if (filters.status) {
    conditions.push(`status=eq.${encodeURIComponent(filters.status)}`);
  }

  if (filters.fromDate) {
    conditions.push(`created_at=gte.${encodeURIComponent(filters.fromDate)}`);
  }

  const queryFilters = conditions.length > 0
    ? '&' + conditions.join('&')
    : '';

  const result = await supabasePurchaseRequest(
    'GET',
    `/rest/v1/purchases?select=id,username,source,memo,image_path,status,created_at&order=created_at.desc${queryFilters}`,
    null,
    null
  );

  if (!result.success) return result;

  const list = Array.isArray(result.data)
    ? result.data.map(normalizePurchase)
    : [];

  return { success: true, data: list };
}

function getAdminDateFilter(period) {
  const now = new Date();

  if (period === 'today') {
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    kst.setHours(0, 0, 0, 0);
    const offsetMs = 9 * 60 * 60 * 1000;
    return new Date(kst.getTime() - offsetMs).toISOString();
  }

  if (period === '7days') {
    return new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
  }

  if (period === '30days') {
    return new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();
  }

  return '';
}

async function getPurchaseRecordById(id) {
  const result = await supabasePurchaseRequest(
    'GET',
    `/rest/v1/purchases?select=id,username,source,memo,image_path,status,created_at&id=eq.${encodeURIComponent(String(id))}&limit=1`,
    null,
    null
  );

  if (!result.success) return result;

  const row = Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : null;
  return { success: true, data: row };
}

async function insertPurchaseRecord(item) {
  const result = await supabasePurchaseRequest(
    'POST',
    '/rest/v1/purchases?select=id,username,source,memo,image_path,status,created_at',
    {
      username: item.username,
      source: item.type,
      memo: item.memo,
      image_path: item.imagePath,
      status: '확인중'
    },
    'return=representation'
  );

  if (!result.success) return result;

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return { success: true, data: normalizePurchase(row) };
}

async function updatePurchaseStatusInSupabase(id, status) {
  return supabasePurchaseRequest(
    'PATCH',
    `/rest/v1/purchases?id=eq.${encodeURIComponent(String(id))}`,
    { status },
    'return=minimal'
  );
}

async function deletePurchaseRecordInSupabase(id) {
  return supabasePurchaseRequest(
    'DELETE',
    `/rest/v1/purchases?id=eq.${encodeURIComponent(String(id))}`,
    null,
    'return=minimal'
  );
}

function decodePurchaseImage(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) {
    return { success: false, message: '전송된 이미지 형식이 올바르지 않습니다.' };
  }

  const mimeType = match[1].toLowerCase();
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(mimeType)) {
    return { success: false, message: '지원하지 않는 이미지 형식입니다.' };
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) {
    return { success: false, message: '이미지 데이터가 없습니다.' };
  }

  if (buffer.length > 20 * 1024 * 1024) {
    return { success: false, message: '이미지 크기가 너무 큽니다.' };
  }

  const extension = mimeType.includes('png')
    ? 'png'
    : mimeType.includes('webp')
      ? 'webp'
      : 'jpg';

  return { success: true, buffer, mimeType, extension };
}

function downloadStorageImage(objectPath) {
  return new Promise((resolve) => {
    const safePath = objectPath.split('/').map(encodeURIComponent).join('/');
    let apiUrl;

    try {
      apiUrl = new URL(`/storage/v1/object/purchase-images/${safePath}`, SUPABASE_URL);
    } catch (error) {
      resolve({ success: false, message: '이미지 주소 오류' });
      return;
    }

    const headers = supabaseStorageHeaders(false, null);
    const request = https.request(
      {
        hostname: apiUrl.hostname,
        path: apiUrl.pathname + apiUrl.search,
        method: 'GET',
        headers
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => { chunks.push(chunk); });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({
              success: true,
              buffer: Buffer.concat(chunks),
              contentType: response.headers['content-type'] || 'image/jpeg'
            });
          } else {
            resolve({ success: false, message: `이미지 조회 오류: ${response.statusCode}` });
          }
        });
      }
    );

    request.on('error', (error) => {
      resolve({ success: false, message: error.message });
    });

    request.end();
  });
}

function layout(title, body) {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #111827;
      color: #fff;
    }

    .wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 30px 16px;
    }

    .card {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      margin-bottom: 20px;
    }

    h1, h2, h3 { margin-top: 0; }

    input, button, textarea, select {
      font-size: 16px;
      box-sizing: border-box;
    }

    input, textarea, select {
      width: 100%;
      padding: 12px;
      margin: 8px 0 14px;
      border-radius: 8px;
      border: 1px solid #4b5563;
      background: #111827;
      color: #fff;
    }

    button, .btn {
      display: inline-block;
      padding: 12px 18px;
      background: #16a34a;
      color: white;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      font-weight: bold;
    }

    button:hover, .btn:hover { background: #15803d; }
    .btn-red { background: #dc2626; }
    .btn-red:hover { background: #b91c1c; }
    .btn-blue { background: #2563eb; }
    .btn-blue:hover { background: #1d4ed8; }
    .btn-gray { background: #4b5563; }
    .btn-gray:hover { background: #374151; }
    .btn-yellow { background: #d97706; }
    .btn-yellow:hover { background: #b45309; }
    .btn-small { padding: 9px 12px; font-size: 13px; }

    .row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .muted { color: #9ca3af; font-size: 14px; }
    .ok { color: #22c55e; font-weight: bold; }
    .bad { color: #ef4444; font-weight: bold; }

    /* 회원 상단 */
    .member-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 22px;
    }

    .member-header h1 { margin-bottom: 10px; }

    /* 다운로드 카드 */
    .download-card {
      border: 1px solid #31445f;
      background: #1f2a3a;
    }

    .download-card h2 {
      margin-bottom: 14px;
      font-size: 26px;
      color: #ffffff;
    }

    .download-desc {
      color: #b8c7dc;
      line-height: 1.7;
      margin-bottom: 18px;
    }

    .download-buttons {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .download-btn {
      display: inline-block;
      padding: 14px 20px;
      border-radius: 8px;
      color: #ffffff;
      font-weight: 800;
      text-decoration: none;
    }

    .mobile-btn { background: #16a34a; }
    .mobile-btn:hover { background: #15803d; }
    .windows-btn { background: #2563eb; }
    .windows-btn:hover { background: #1d4ed8; }

    .download-guide {
      margin-top: 12px;
      padding: 12px 14px;
      border-radius: 8px;
      background: #111827;
      border: 1px solid #334155;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.6;
    }

    .download-guide p { margin: 4px 0; }

    /* 회원 구매내역 */
    .history-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 18px;
    }

    .history-item {
      display: flex;
      gap: 14px;
      align-items: center;
      padding: 12px;
      background: #111827;
      border: 1px solid #374151;
      border-radius: 12px;
    }

    .member-img {
      width: 145px;
      height: 105px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid #374151;
      background: #000;
      cursor: pointer;
      flex-shrink: 0;
    }

    .history-info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 9px;
      min-width: 0;
    }

    .status {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: bold;
    }

    .status-progress {
      background: #78350f;
      color: #fde68a;
      border: 1px solid #d97706;
    }

    .status-win {
      background: #14532d;
      color: #86efac;
      border: 1px solid #16a34a;
    }

    .status-lose {
      background: #7f1d1d;
      color: #fca5a5;
      border: 1px solid #dc2626;
    }

    /* 관리자 */
    .admin-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 20px;
    }

    .admin-img {
      max-width: 220px;
      max-height: 180px;
      border-radius: 8px;
      border: 1px solid #374151;
      cursor: pointer;
      background: #000;
    }

    .admin-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }

    .admin-actions form { margin: 0; }

    table {
      width: 100%;
      border-collapse: collapse;
      background: #111827;
      border-radius: 10px;
      overflow: hidden;
    }

    th, td {
      padding: 12px;
      border-bottom: 1px solid #374151;
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }

    th { background: #0f172a; color: #d1d5db; }

    /* 이미지 확대 */
    .modal {
      display: none;
      position: fixed;
      z-index: 9999;
      inset: 0;
      background: rgba(0,0,0,0.85);
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal img {
      max-width: 95vw;
      max-height: 90vh;
      border-radius: 10px;
      border: 1px solid #334155;
      background: #000;
    }

    .modal-close {
      position: fixed;
      top: 18px;
      right: 18px;
      background: #dc2626;
      color: #fff;
      border: 0;
      border-radius: 8px;
      padding: 10px 14px;
      cursor: pointer;
      font-weight: bold;
    }

    @media (max-width: 700px) {
      .wrap { padding: 18px 12px; }
      .card { padding: 17px; border-radius: 12px; }
      .member-header h1 { font-size: 25px; }
      .member-header .btn { padding: 10px 12px; font-size: 14px; }
      .download-card h2 { font-size: 23px; }
      .download-buttons { flex-direction: column; }
      .download-btn { width: 100%; text-align: center; }
      .history-item { align-items: flex-start; }
      .member-img { width: 128px; height: 105px; }
      .admin-top { display: block; }
      .admin-top .row { margin-top: 15px; }
      table, thead, tbody, th, td, tr { display: block; }
      th { display: none; }
      td { border-bottom: 1px solid #374151; }
      tr { margin-bottom: 18px; border: 1px solid #374151; border-radius: 10px; overflow: hidden; }
      .admin-img { max-width: 100%; max-height: none; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    ${body}
  </div>
</body>
</html>
  `;
}

// ===============================
// 첫 화면: 회원 로그인으로 바로 이동
// 관리자는 /admin-login 주소를 직접 사용
// ===============================
app.get('/', (req, res) => {
  res.redirect('/login');
});

// ===============================
// 회원 로그인 페이지
// ===============================
app.get('/login', (req, res) => {
  res.send(layout('SM1357 로그인', `
    <div class="card" style="max-width:420px;margin:60px auto;">
      <h1>SM1357 로그인</h1>
      <p class="muted">회원 계정으로 로그인하세요.</p>

      <form method="POST" action="/login">
        <label>아이디</label>
        <input name="username" placeholder="아이디 입력" required />

        <label>비밀번호</label>
        <input name="password" type="password" placeholder="비밀번호 입력" required />

        <button type="submit" style="width:100%;">로그인</button>
      </form>
    </div>
  `));
});

// ===============================
// 회원 로그인 처리
// ===============================
app.post('/login', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.send(layout('로그인 실패', `
      <div class="card">
        <h1 class="bad">로그인 실패</h1>
        <p>아이디와 비밀번호를 입력하세요.</p>
        <a class="btn btn-blue" href="/login">다시 로그인</a>
      </div>
    `));
  }

  const result = await verifyMemberLoginFromSupabase(username, password);

  if (!result.success) {
    return res.status(500).send(layout('로그인 확인 오류', `
      <div class="card">
        <h1 class="bad">로그인 확인 오류</h1>
        <p>회원정보 확인 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.</p>
        <a class="btn btn-blue" href="/login">다시 로그인</a>
      </div>
    `));
  }

  if (!result.data || result.data.success !== true) {
    const message = result.data && result.data.message
      ? result.data.message
      : '아이디 또는 비밀번호가 틀렸습니다.';

    return res.send(layout('로그인 실패', `
      <div class="card">
        <h1 class="bad">로그인 실패</h1>
        <p>${escapeHtml(message)}</p>
        <a class="btn btn-blue" href="/login">다시 로그인</a>
      </div>
    `));
  }

  const verifiedUsername = result.data.username || username;
  setCookie(res, 'sm1357_member', verifiedUsername, 86400);
  res.redirect(`/betman?user=${encodeURIComponent(verifiedUsername)}`);
});

// ===============================
// 회원 로그아웃
// ===============================
app.get('/member-logout', (req, res) => {
  clearCookie(res, 'sm1357_member');
  res.redirect('/login');
});

// ===============================
// 회원 페이지
// Supabase 구매내역을 조회하여 표시합니다.
// ===============================
app.get('/betman', requireMember, async (req, res) => {
  const username = req.memberId;
  const result = await getPurchasesFromSupabase(username);

  if (!result.success) {
    return res.status(500).send(layout('구매내역 조회 실패', `
      <div class="card">
        <h1 class="bad">구매내역 조회 실패</h1>
        <p>${escapeHtml(result.message)}</p>
        <a class="btn btn-blue" href="/betman?user=${encodeURIComponent(username)}">다시 시도</a>
      </div>
    `));
  }

  const myList = result.data;

  const myRows = myList.map((item) => `
    <div class="history-item">
      <img class="member-img" src="${item.image}" onclick="openMemberImage('${item.id}')" alt="구매내역 이미지" />
      <div class="history-info">
        <span class="status ${getStatusClass(item.status)}">${escapeHtml(item.status)}</span>
        <span class="muted">${escapeHtml(item.createdAt)}</span>
        ${item.memo ? `<span class="muted">${escapeHtml(item.memo)}</span>` : ''}
        <form method="POST" action="/member/delete/${encodeURIComponent(String(item.id))}" onsubmit="return confirm('이 구매내역을 삭제할까요?');">
          <button class="btn-small btn-red" type="submit">삭제</button>
        </form>
      </div>
    </div>
  `).join('');

  const memberImageMap = {};
  myList.forEach((item) => {
    memberImageMap[item.id] = item.image;
  });

  res.send(layout('SM1357 회원 페이지', `
    <div class="member-header">
      <div>
        <h1>회원 페이지</h1>
        <p class="muted">로그인 회원: <b>${escapeHtml(username)}</b></p>
      </div>
      <div class="row">
        <a class="btn btn-blue" href="/betman?user=${encodeURIComponent(username)}">새로고침</a>
        <a class="btn btn-red" href="/member-logout">로그아웃</a>
      </div>
    </div>

    <div class="card download-card">
      <h2>SM1357 프로그램 다운로드</h2>
      <p class="download-desc">
        모바일 사용자는 <b>모바일용 앱</b>을 설치하세요.<br>
        PC 사용자는 <b>윈도우용 확장프로그램</b>을 설치하세요.
      </p>
      <div class="download-buttons">
        <a class="download-btn mobile-btn" href="/download/mobile">모바일용 다운로드</a>
        <a class="download-btn windows-btn" href="/download/windows">윈도우용 다운로드</a>
      </div>
      <div class="download-guide">
        <p>모바일: APK 설치 후 앱 안에서 배트맨에 접속합니다.</p>
        <p>윈도우: ZIP 압축을 풀고 크롬 확장프로그램에서 등록합니다.</p>
      </div>
    </div>

    <div class="card">
      <h2>배트맨 열기</h2>
      <p class="muted">
        아래 버튼을 누르면 배트맨 사이트가 열립니다.<br>
        설치된 프로그램에서 구매내역을 보내면 아래 내역에 표시됩니다.
      </p>
      <a class="btn btn-blue" href="https://www.betman.co.kr" target="_blank">배트맨 열기</a>
    </div>

    <div class="card">
      <h2>내 구매내역</h2>
      <p class="muted">보낸 구매내역의 처리 상태를 확인할 수 있습니다.</p>
      ${myList.length === 0
        ? '<div class="download-guide">아직 보낸 구매내역이 없습니다.</div>'
        : `<div class="history-list">${myRows}</div>`
      }
    </div>

    <div id="memberModal" class="modal" onclick="closeMemberImage()">
      <button class="modal-close" onclick="closeMemberImage()">닫기</button>
      <img id="memberModalImg" src="" alt="구매내역 확대 이미지" />
    </div>

    <script>
      const memberImageMap = ${JSON.stringify(memberImageMap)};

      function openMemberImage(id) {
        if (!memberImageMap[id]) return;
        document.getElementById('memberModalImg').src = memberImageMap[id];
        document.getElementById('memberModal').style.display = 'flex';
      }

      function closeMemberImage() {
        document.getElementById('memberModal').style.display = 'none';
        document.getElementById('memberModalImg').src = '';
      }
    </script>
  `));
});

// ===============================
// 구매내역 비공개 이미지 제공
// 관리자 또는 본인 회원만 조회할 수 있습니다.
// ===============================
app.get('/purchase-image/:id', async (req, res) => {
  const id = Number(req.params.id);
  const recordResult = await getPurchaseRecordById(id);

  if (!recordResult.success || !recordResult.data) {
    return res.status(404).send('이미지를 찾을 수 없습니다.');
  }

  const record = recordResult.data;
  const memberId = getMemberCookie(req);
  let permitted = isAdminLoggedIn(req);

  if (!permitted && memberId && memberId === record.username) {
    const activeResult = await checkActiveMemberFromSupabase(memberId);
    permitted = activeResult.success && activeResult.data && activeResult.data.success === true;
  }

  if (!permitted) {
    return res.status(403).send('접근 권한이 없습니다.');
  }

  const imageResult = await downloadStorageImage(record.image_path);
  if (!imageResult.success) {
    return res.status(404).send('이미지를 불러오지 못했습니다.');
  }

  res.setHeader('Content-Type', imageResult.contentType);
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.end(imageResult.buffer);
});

// ===============================
// 회원: 본인 구매내역 개별 삭제
// ===============================
app.post('/member/delete/:id', requireMember, async (req, res) => {
  const id = Number(req.params.id);
  const username = req.memberId;
  const recordResult = await getPurchaseRecordById(id);

  if (!recordResult.success || !recordResult.data || recordResult.data.username !== username) {
    return res.redirect(`/betman?user=${encodeURIComponent(username)}`);
  }

  const deleteDb = await deletePurchaseRecordInSupabase(id);
  if (deleteDb.success) {
    await supabaseStorageObjectRequest('DELETE', recordResult.data.image_path, null, null);
  }

  res.redirect(`/betman?user=${encodeURIComponent(username)}`);
});

// ===============================
// 구매내역 전송 API
// 모바일 앱/PC 확장프로그램이 계속 사용하는 기능
// 이미지와 상태를 Supabase에 영구 저장합니다.
// ===============================
app.post('/api/send', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const { type, memo, image } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: '회원 정보가 올바르지 않습니다.' });
  }

  const activeResult = await checkActiveMemberFromSupabase(username);
  if (!activeResult.success) {
    return res.status(500).json({ success: false, message: '회원 상태 확인 중 오류가 발생했습니다.' });
  }

  if (!activeResult.data || activeResult.data.success !== true) {
    return res.status(403).json({ success: false, message: '사용할 수 없는 회원 계정입니다.' });
  }

  if (!image) {
    return res.status(400).json({ success: false, message: '구매내역 이미지가 필요합니다.' });
  }

  const decoded = decodePurchaseImage(image);
  if (!decoded.success) {
    return res.status(400).json({ success: false, message: decoded.message });
  }

  const storagePath = `${username}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${decoded.extension}`;
  const upload = await supabaseStorageObjectRequest(
    'POST',
    storagePath,
    decoded.buffer,
    decoded.mimeType
  );

  if (!upload.success) {
    return res.status(500).json({ success: false, message: `이미지 저장 실패: ${upload.message}` });
  }

  const insert = await insertPurchaseRecord({
    username,
    type: type || 'IMAGE',
    memo: memo || '',
    imagePath: storagePath
  });

  if (!insert.success) {
    await supabaseStorageObjectRequest('DELETE', storagePath, null, null);
    return res.status(500).json({ success: false, message: `구매내역 저장 실패: ${insert.message}` });
  }

  const item = insert.data;
  const notificationText = [
    '📩 SM1357 신규 구매내역',
    '',
    `회원: ${item.username}`,
    `시간: ${item.createdAt}`,
    `상태: ${item.status}`,
    '',
    '관리자 페이지에서 이미지를 확인하세요.',
    'https://sm1357.kr/admin-login'
  ].join('\n');

  sendTelegramMessage(notificationText).catch((error) => {
    console.error('[TELEGRAM] 신규 구매내역 알림 오류:', error.message);
  });

  res.json({ success: true, item });
});

// ===============================
// 관리자 로그인 페이지
// ===============================
// 관리자 로그인 페이지
// 주소를 아는 관리자만 접속: /admin-login
// ===============================
app.get('/admin-login', (req, res) => {
  res.send(layout('SM1357 관리자 로그인', `
    <div class="card" style="max-width:420px;margin:60px auto;">
      <h1>관리자 로그인</h1>
      <p class="muted">관리자만 접속할 수 있습니다.</p>

      <form method="POST" action="/admin-login">
        <label>관리자 아이디</label>
        <input name="adminId" placeholder="관리자 아이디" required />

        <label>관리자 비밀번호</label>
        <input name="adminPassword" type="password" placeholder="관리자 비밀번호" required />

        <button type="submit" style="width:100%;">관리자 로그인</button>
      </form>
    </div>
  `));
});

// ===============================
// 관리자 로그인 처리
// ===============================
app.post('/admin-login', (req, res) => {
  const { adminId, adminPassword } = req.body;

  if (adminId !== ADMIN_ID || adminPassword !== ADMIN_PASSWORD) {
    return res.send(layout('관리자 로그인 실패', `
      <div class="card">
        <h1 class="bad">관리자 로그인 실패</h1>
        <p>아이디 또는 비밀번호가 틀렸습니다.</p>
        <a class="btn btn-blue" href="/admin-login">다시 로그인</a>
      </div>
    `));
  }

  setCookie(res, 'sm1357_admin', 'yes', 86400);
  res.redirect('/admin');
});

// ===============================
// 관리자 로그아웃
// ===============================
app.get('/admin-logout', (req, res) => {
  clearCookie(res, 'sm1357_admin');
  res.redirect('/admin-login');
});

// ===============================
// 관리자 페이지
// Supabase 구매내역을 조회하며 회원/상태/기간 필터를 제공합니다.
// ===============================
app.get('/admin', requireAdmin, async (req, res) => {
  const selectedMember = String(req.query.member || '').trim().toLowerCase();
  const selectedStatus = ['확인중', '진행중', '적중', '미적중'].includes(req.query.status)
    ? req.query.status
    : '';
  const selectedPeriod = ['today', '7days', '30days'].includes(req.query.period)
    ? req.query.period
    : '';

  const memberResult = await getMemberListFromSupabase();
  const members = memberResult.success && Array.isArray(memberResult.data)
    ? memberResult.data
    : [];

  const result = await getPurchasesFromSupabase('', {
    username: selectedMember,
    status: selectedStatus,
    fromDate: getAdminDateFilter(selectedPeriod)
  });

  if (!result.success) {
    return res.status(500).send(layout('구매내역 조회 실패', `
      <div class="card">
        <h1 class="bad">구매내역 조회 실패</h1>
        <p>${escapeHtml(result.message)}</p>
        <a class="btn btn-blue" href="/admin">다시 시도</a>
      </div>
    `));
  }

  const purchaseList = result.data;

  const memberOptions = members.map((member) => `
    <option value="${escapeHtml(member.username)}" ${selectedMember === member.username ? 'selected' : ''}>
      ${escapeHtml(member.username)}${member.memo ? ` - ${escapeHtml(member.memo)}` : ''}
    </option>
  `).join('');

  const rows = purchaseList.map((item, index) => {
    const memoHtml = escapeHtml(item.memo).replace(/\n/g, '<br>');
    const safeId = encodeURIComponent(String(item.id));

    return `
      <tr>
        <td>${index + 1}</td>
        <td><b>${escapeHtml(item.username)}</b></td>
        <td>${escapeHtml(item.type)}</td>
        <td>${memoHtml || '<span class="muted">메모 없음</span>'}</td>
        <td>
          <span class="status ${getStatusClass(item.status)}">${escapeHtml(item.status)}</span>
          <div class="admin-actions">
            <form method="POST" action="/admin/status/${safeId}?member=${encodeURIComponent(selectedMember)}&status=${encodeURIComponent(selectedStatus)}&period=${encodeURIComponent(selectedPeriod)}">
              <input type="hidden" name="status" value="확인중" />
              <button class="btn-small btn-yellow" type="submit">확인중</button>
            </form>
            <form method="POST" action="/admin/status/${safeId}?member=${encodeURIComponent(selectedMember)}&status=${encodeURIComponent(selectedStatus)}&period=${encodeURIComponent(selectedPeriod)}">
              <input type="hidden" name="status" value="진행중" />
              <button class="btn-small btn-blue" type="submit">진행중</button>
            </form>
            <form method="POST" action="/admin/status/${safeId}?member=${encodeURIComponent(selectedMember)}&status=${encodeURIComponent(selectedStatus)}&period=${encodeURIComponent(selectedPeriod)}">
              <input type="hidden" name="status" value="적중" />
              <button class="btn-small" type="submit">적중</button>
            </form>
            <form method="POST" action="/admin/status/${safeId}?member=${encodeURIComponent(selectedMember)}&status=${encodeURIComponent(selectedStatus)}&period=${encodeURIComponent(selectedPeriod)}">
              <input type="hidden" name="status" value="미적중" />
              <button class="btn-small btn-red" type="submit">미적중</button>
            </form>
          </div>
        </td>
        <td>${escapeHtml(item.createdAt)}</td>
        <td>
          <img class="admin-img" src="${item.image}" onclick="openImage('${item.id}')" alt="구매내역 이미지" />
          <div class="admin-actions">
            <button class="btn-small btn-blue" onclick="openImage('${item.id}')">크게 보기</button>
            <form method="POST" action="/admin/delete/${safeId}?member=${encodeURIComponent(selectedMember)}&status=${encodeURIComponent(selectedStatus)}&period=${encodeURIComponent(selectedPeriod)}" onsubmit="return confirm('이 구매내역을 삭제할까요?');">
              <button class="btn-small btn-red" type="submit">삭제</button>
            </form>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const imageMap = {};
  purchaseList.forEach((item) => {
    imageMap[item.id] = item.image;
  });

  const activeFilterText = [
    selectedMember ? `회원: ${selectedMember}` : '',
    selectedStatus ? `상태: ${selectedStatus}` : '',
    selectedPeriod === 'today' ? '기간: 오늘' : '',
    selectedPeriod === '7days' ? '기간: 최근 7일' : '',
    selectedPeriod === '30days' ? '기간: 최근 30일' : ''
  ].filter(Boolean).join(' / ');

  res.send(layout('SM1357 관리자', `
    <div class="admin-top">
      <div>
        <h1>관리자 페이지</h1>
        <p class="muted">구매내역 이미지와 처리 상태는 Supabase에 영구 저장됩니다.</p>
      </div>
      <div class="row">
        <a class="btn" href="/admin">새로고침</a>
        <a class="btn btn-yellow" href="/admin/members">회원관리</a>
        <form method="POST" action="/admin/telegram-test" style="margin:0;">
          <button class="btn btn-blue" type="submit">알림 테스트</button>
        </form>
        <form method="POST" action="/admin/supabase-test" style="margin:0;">
          <button class="btn btn-yellow" type="submit">DB 연결 테스트</button>
        </form>
        <form method="POST" action="/admin/storage-test" style="margin:0;">
          <button class="btn btn-yellow" type="submit">저장소 테스트</button>
        </form>
        <a class="btn btn-red" href="/admin/clear" onclick="return confirm('전체 구매내역을 삭제할까요?')">전체삭제</a>
        <a class="btn btn-gray" href="/admin-logout">관리자 로그아웃</a>
      </div>
    </div>

    <div class="card">
      <h2>구매내역 검색</h2>
      <form method="GET" action="/admin">
        <div class="row">
          <div style="flex:1;min-width:170px;">
            <label>회원별 보기</label>
            <select name="member">
              <option value="">전체 회원</option>
              ${memberOptions}
            </select>
          </div>
          <div style="flex:1;min-width:170px;">
            <label>상태별 보기</label>
            <select name="status">
              <option value="">전체 상태</option>
              <option value="확인중" ${selectedStatus === '확인중' ? 'selected' : ''}>확인중</option>
              <option value="진행중" ${selectedStatus === '진행중' ? 'selected' : ''}>진행중</option>
              <option value="적중" ${selectedStatus === '적중' ? 'selected' : ''}>적중</option>
              <option value="미적중" ${selectedStatus === '미적중' ? 'selected' : ''}>미적중</option>
            </select>
          </div>
          <div style="flex:1;min-width:170px;">
            <label>기간별 보기</label>
            <select name="period">
              <option value="">전체 기간</option>
              <option value="today" ${selectedPeriod === 'today' ? 'selected' : ''}>오늘</option>
              <option value="7days" ${selectedPeriod === '7days' ? 'selected' : ''}>최근 7일</option>
              <option value="30days" ${selectedPeriod === '30days' ? 'selected' : ''}>최근 30일</option>
            </select>
          </div>
        </div>
        <div class="row">
          <button class="btn btn-blue" type="submit">검색</button>
          <a class="btn btn-gray" href="/admin">필터 초기화</a>
        </div>
      </form>
      ${activeFilterText
        ? `<div class="download-guide" style="margin-top:16px;">현재 조건: ${escapeHtml(activeFilterText)} / 검색 결과 ${purchaseList.length}건</div>`
        : `<div class="download-guide" style="margin-top:16px;">전체 구매내역 ${purchaseList.length}건</div>`
      }
    </div>

    <div class="card">
      <h2>구매내역 목록</h2>
      ${purchaseList.length === 0
        ? '<p class="muted">조건에 맞는 구매내역이 없습니다.</p>'
        : `
          <table>
            <thead>
              <tr>
                <th>번호</th>
                <th>회원ID</th>
                <th>구분</th>
                <th>내용</th>
                <th>상태 변경</th>
                <th>시간</th>
                <th>이미지</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `
      }
    </div>

    <div id="modal" class="modal" onclick="closeImage()">
      <button class="modal-close" onclick="closeImage()">닫기</button>
      <img id="modalImg" src="" alt="구매내역 확대 이미지" />
    </div>

    <script>
      const imageMap = ${JSON.stringify(imageMap)};

      function openImage(id) {
        if (!imageMap[id]) return;
        document.getElementById('modalImg').src = imageMap[id];
        document.getElementById('modal').style.display = 'flex';
      }

      function closeImage() {
        document.getElementById('modal').style.display = 'none';
        document.getElementById('modalImg').src = '';
      }
    </script>
  `));
});

// ===============================
// 관리자: 회원관리 페이지
// ===============================
// 관리자: 회원관리 페이지
// 현재 단계에서는 Supabase 회원 목록과 관리기능만 제공합니다.
// 실제 회원 로그인은 다음 단계에서 연결합니다.
// ===============================
app.get('/admin/members', requireAdmin, async (req, res) => {
  const result = await getMemberListFromSupabase();

  if (!result.success) {
    return res.status(500).send(memberResultPage(
      '회원 목록 조회 실패',
      result.message,
      false
    ));
  }

  const members = Array.isArray(result.data) ? result.data : [];

  const rows = members.map((member) => {
    const username = escapeHtml(member.username);
    const memo = escapeHtml(member.memo || '');
    const isActive = member.is_active === true;

    return `
      <tr>
        <td><b>${username}</b></td>
        <td>${memo || '<span class="muted">메모 없음</span>'}</td>
        <td>
          <span class="status ${isActive ? 'status-win' : 'status-lose'}">
            ${isActive ? '사용중' : '정지'}
          </span>
        </td>
        <td>
          <form method="POST" action="/admin/members/password" style="margin-bottom:10px;">
            <input type="hidden" name="username" value="${username}" />
            <input name="password" type="password" placeholder="새 비밀번호" minlength="4" required style="margin:0 0 7px;" />
            <button class="btn-small btn-blue" type="submit">비밀번호 변경</button>
          </form>

          <div class="admin-actions">
            <form method="POST" action="/admin/members/active">
              <input type="hidden" name="username" value="${username}" />
              <input type="hidden" name="is_active" value="${isActive ? 'false' : 'true'}" />
              <button class="btn-small ${isActive ? 'btn-yellow' : ''}" type="submit">
                ${isActive ? '정지' : '사용재개'}
              </button>
            </form>

            <form method="POST" action="/admin/members/delete" onsubmit="return confirm('${username} 회원을 삭제할까요? 구매내역이 있는 회원은 삭제되지 않습니다.');">
              <input type="hidden" name="username" value="${username}" />
              <button class="btn-small btn-red" type="submit">삭제</button>
            </form>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  res.send(layout('SM1357 회원관리', `
    <div class="admin-top">
      <div>
        <h1>회원관리</h1>
        <p class="muted">회원 계정은 Supabase에 영구 저장됩니다.</p>
      </div>
      <div class="row">
        <a class="btn btn-blue" href="/admin/members">새로고침</a>
        <a class="btn btn-gray" href="/admin">구매내역 관리로 돌아가기</a>
      </div>
    </div>

    <div class="card">
      <h2>새 회원 추가</h2>
      <p class="muted">아이디는 영문 소문자, 숫자, _, - 만 사용하여 3~20자로 입력하세요.</p>
      <form method="POST" action="/admin/members/create">
        <div class="row">
          <div style="flex:1;min-width:180px;">
            <label>아이디</label>
            <input name="username" placeholder="예: vip021" required />
          </div>
          <div style="flex:1;min-width:180px;">
            <label>비밀번호</label>
            <input name="password" type="password" placeholder="4자 이상" minlength="4" required />
          </div>
          <div style="flex:1;min-width:180px;">
            <label>메모</label>
            <input name="memo" placeholder="예: 신규회원" />
          </div>
        </div>
        <button type="submit">회원 생성</button>
      </form>
    </div>

    <div class="card">
      <h2>회원 목록 (${members.length}명)</h2>
      ${members.length === 0
        ? '<p class="muted">등록된 회원이 없습니다.</p>'
        : `
          <table>
            <thead>
              <tr>
                <th>아이디</th>
                <th>메모</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `
      }
    </div>
  `));
});

// ===============================
// 관리자: 새 회원 생성
// ===============================
app.post('/admin/members/create', requireAdmin, async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const memo = String(req.body.memo || '').trim();

  const result = await callMemberAdminFunction('admin_create_member', {
    p_username: username,
    p_password: password,
    p_memo: memo
  });

  if (!result.success) {
    return res.status(400).send(memberResultPage('회원 생성 실패', result.message, false));
  }

  res.send(memberResultPage(
    '회원 생성 완료',
    `${username} 회원이 생성되었습니다. 실제 로그인 연결은 다음 단계에서 적용합니다.`,
    true
  ));
});

// ===============================
// 관리자: 회원 비밀번호 변경
// ===============================
app.post('/admin/members/password', requireAdmin, async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  const result = await callMemberAdminFunction('admin_change_member_password', {
    p_username: username,
    p_password: password
  });

  if (!result.success) {
    return res.status(400).send(memberResultPage('비밀번호 변경 실패', result.message, false));
  }

  res.send(memberResultPage('비밀번호 변경 완료', `${username} 회원의 비밀번호가 변경되었습니다.`, true));
});

// ===============================
// 관리자: 회원 사용중/정지 변경
// ===============================
app.post('/admin/members/active', requireAdmin, async (req, res) => {
  const username = String(req.body.username || '').trim();
  const isActive = String(req.body.is_active) === 'true';

  const result = await callMemberAdminFunction('admin_set_member_active', {
    p_username: username,
    p_is_active: isActive
  });

  if (!result.success) {
    return res.status(400).send(memberResultPage('회원 상태 변경 실패', result.message, false));
  }

  res.send(memberResultPage(
    '회원 상태 변경 완료',
    `${username} 회원을 ${isActive ? '사용중' : '정지'} 상태로 변경했습니다.`,
    true
  ));
});

// ===============================
// 관리자: 회원 삭제
// 구매내역이 있는 회원은 Supabase 함수에서 삭제 차단
// ===============================
app.post('/admin/members/delete', requireAdmin, async (req, res) => {
  const username = String(req.body.username || '').trim();

  const result = await callMemberAdminFunction('admin_delete_member', {
    p_username: username
  });

  if (!result.success) {
    return res.status(400).send(memberResultPage('회원 삭제 실패', result.message, false));
  }

  res.send(memberResultPage('회원 삭제 완료', `${username} 회원이 삭제되었습니다.`, true));
});

// ===============================
// 관리자: Supabase Storage 연결 테스트
// 실제 구매내역 영구 저장은 아직 연결하지 않습니다.
// ===============================
app.post('/admin/storage-test', requireAdmin, async (req, res) => {
  const result = await testSupabaseStorageConnection();

  if (result.success) {
    return res.send(layout('저장소 연결 성공', `
      <div class="card">
        <h1>Storage 연결 성공</h1>
        <p class="ok">purchase-images 비공개 저장소 연결이 정상입니다.</p>
        <p class="muted">작은 테스트 파일 업로드와 자동 삭제까지 확인했습니다.</p>
        <a class="btn btn-blue" href="/admin">관리자 페이지로 돌아가기</a>
      </div>
    `));
  }

  res.status(500).send(layout('저장소 연결 실패', `
    <div class="card">
      <h1 class="bad">Storage 연결 실패</h1>
      <p>${escapeHtml(result.message)}</p>
      <a class="btn btn-blue" href="/admin">관리자 페이지로 돌아가기</a>
    </div>
  `));
});

// ===============================
app.post('/admin/supabase-test', requireAdmin, async (req, res) => {
  const result = await testSupabaseConnection();

  if (result.success) {
    const members = result.usernames.length > 0
      ? result.usernames.map((username) => escapeHtml(username)).join(', ')
      : '조회된 회원 없음';

    return res.send(layout('DB 연결 성공', `
      <div class="card">
        <h1>Supabase 연결 성공</h1>
        <p class="ok">영구 저장소 연결이 정상입니다.</p>
        <p class="muted">확인 회원: ${members}</p>
        <a class="btn btn-blue" href="/admin">관리자 페이지로 돌아가기</a>
      </div>
    `));
  }

  res.status(500).send(layout('DB 연결 실패', `
    <div class="card">
      <h1 class="bad">Supabase 연결 실패</h1>
      <p>${escapeHtml(result.message)}</p>
      <a class="btn btn-blue" href="/admin">관리자 페이지로 돌아가기</a>
    </div>
  `));
});

// ===============================
app.post('/admin/telegram-test', requireAdmin, async (req, res) => {
  const now = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul'
  });

  const success = await sendTelegramMessage(
    `✅ SM1357 텔레그램 알림 테스트 성공\n\n시간: ${now}\n휴대폰과 PC 알림 연결이 정상입니다.`
  );

  if (success) {
    return res.send(layout('알림 테스트 완료', `
      <div class="card">
        <h1>알림 전송 완료</h1>
        <p>텔레그램에서 테스트 메시지를 확인하세요.</p>
        <a class="btn btn-blue" href="/admin">관리자 페이지로 돌아가기</a>
      </div>
    `));
  }

  res.status(500).send(layout('알림 테스트 실패', `
    <div class="card">
      <h1 class="bad">알림 전송 실패</h1>
      <p>Render 환경변수 또는 텔레그램 봇 설정을 확인해야 합니다.</p>
      <a class="btn btn-blue" href="/admin">관리자 페이지로 돌아가기</a>
    </div>
  `));
});

// ===============================
// 관리자: 구매내역 상태 변경
// ===============================
app.post('/admin/status/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.status;
  const allowedStatus = ['확인중', '진행중', '적중', '미적중'];

  if (!allowedStatus.includes(status)) {
    return res.status(400).send('허용되지 않은 상태입니다.');
  }

  await updatePurchaseStatusInSupabase(id, status);

  const query = new URLSearchParams({
    member: String(req.query.member || ''),
    status: String(req.query.status || ''),
    period: String(req.query.period || '')
  }).toString();

  res.redirect(`/admin?${query}`);
});

// ===============================
// 관리자: 구매내역 개별 삭제
// ===============================
app.post('/admin/delete/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const recordResult = await getPurchaseRecordById(id);

  if (recordResult.success && recordResult.data) {
    const deleteDb = await deletePurchaseRecordInSupabase(id);
    if (deleteDb.success) {
      await supabaseStorageObjectRequest('DELETE', recordResult.data.image_path, null, null);
    }
  }

  const query = new URLSearchParams({
    member: String(req.query.member || ''),
    status: String(req.query.status || ''),
    period: String(req.query.period || '')
  }).toString();

  res.redirect(`/admin?${query}`);
});

// ===============================
// 관리자: 구매내역 전체 삭제
// ===============================
app.get('/admin/clear', requireAdmin, async (req, res) => {
  const result = await getPurchasesFromSupabase();

  if (result.success) {
    for (const item of result.data) {
      await deletePurchaseRecordInSupabase(item.id);
      await supabaseStorageObjectRequest('DELETE', item.imagePath, null, null);
    }
  }

  res.redirect('/admin');
});

// ===============================
// 관리자 JSON 확인용
// ===============================
app.get('/api/list', requireAdmin, async (req, res) => {
  const result = await getPurchasesFromSupabase();

  if (!result.success) {
    return res.status(500).json({ success: false, message: result.message });
  }

  res.json({ success: true, count: result.data.length, list: result.data });
});

// ===============================
// 회원 프로그램 다운로드
// ===============================
// 회원 프로그램 다운로드
// ===============================
app.get('/download/mobile', (req, res) => {
  res.download(path.join(__dirname, 'public', 'sm1357-mobile.apk'));
});

app.get('/download/windows', (req, res) => {
  res.download(path.join(__dirname, 'public', 'sm1357-pc-extension.zip'));
});

// ===============================
// 없는 주소 처리
// 회원에게는 관리자 경로를 노출하지 않음
// ===============================
app.use((req, res) => {
  res.status(404).send(layout('Not Found', `
    <div class="card">
      <h1>페이지를 찾을 수 없습니다.</h1>
      <p class="muted">요청 주소: ${escapeHtml(req.originalUrl)}</p>
      <a class="btn btn-blue" href="/login">회원 로그인</a>
    </div>
  `));
});

// ===============================
// Render 호환 포트
// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SERVER START on port ${PORT}`);
});
