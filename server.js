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

function getLoggedInMember(req) {
  const cookies = parseCookies(req);
  const username = cookies.sm1357_member || '';
  return USERS[username] ? username : '';
}

function requireMember(req, res, next) {
  const username = getLoggedInMember(req);
  if (!username) {
    return res.redirect('/login');
  }
  req.memberId = username;
  next();
}

// ===============================
// 회원 계정 목록
// ===============================
const USERS = {
  vip001: '1234',
  vip002: '1234',
  vip003: '1234',
  vip004: '1234',
  vip005: '1234',
  vip006: '1234',
  vip007: '1234',
  vip008: '1234',
  vip009: '1234',
  vip010: '1234',
  vip011: '1234',
  vip012: '1234',
  vip013: '1234',
  vip014: '1234',
  vip015: '1234',
  vip016: '1234',
  vip017: '1234',
  vip018: '1234',
  vip019: '1234',
  vip020: '1234'
};

// ===============================
// 관리자 계정
// ===============================
const ADMIN_ID = 'admin';
const ADMIN_PASSWORD = 'admin1357';

// ===============================
// 임시 구매내역 저장소
// 주의: Render 서버 재시작/재배포 시 초기화됨
// ===============================
let purchaseList = [];

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
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password || USERS[username] !== password) {
    return res.send(layout('로그인 실패', `
      <div class="card">
        <h1 class="bad">로그인 실패</h1>
        <p>아이디 또는 비밀번호가 틀렸습니다.</p>
        <a class="btn btn-blue" href="/login">다시 로그인</a>
      </div>
    `));
  }

  setCookie(res, 'sm1357_member', username, 86400);
  res.redirect(`/betman?user=${encodeURIComponent(username)}`);
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
// ===============================
app.get('/betman', requireMember, (req, res) => {
  const username = req.memberId;
  const myList = purchaseList.filter((item) => item.username === username);

  const myRows = myList.map((item) => `
    <div class="history-item">
      ${item.image
        ? `<img class="member-img" src="${item.image}" onclick="openMemberImage('${item.id}')" alt="구매내역 이미지" />`
        : '<div class="member-img" style="display:flex;align-items:center;justify-content:center;color:#9ca3af;">이미지 없음</div>'
      }
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
    if (item.image) memberImageMap[item.id] = item.image;
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
// 회원: 본인 구매내역 개별 삭제
// ===============================
app.post('/member/delete/:id', requireMember, (req, res) => {
  const id = Number(req.params.id);
  const username = req.memberId;

  purchaseList = purchaseList.filter((purchase) => {
    return !(purchase.id === id && purchase.username === username);
  });

  res.redirect(`/betman?user=${encodeURIComponent(username)}`);
});

// ===============================
// 구매내역 전송 API
// 모바일 앱/PC 확장프로그램이 계속 사용하는 기능이므로 삭제 금지
// ===============================
app.post('/api/send', (req, res) => {
  const { username, type, memo, image } = req.body;

  if (!username || !USERS[username]) {
    return res.status(400).json({
      success: false,
      message: '회원 정보가 올바르지 않습니다.'
    });
  }

  if (!memo && !image) {
    return res.status(400).json({
      success: false,
      message: '메모 또는 이미지가 필요합니다.'
    });
  }

  const item = {
    id: Date.now(),
    username,
    type: type || 'IMAGE',
    memo: memo || '',
    image: image || '',
    status: '진행중',
    createdAt: new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul'
    })
  };

  purchaseList.unshift(item);

  // 신규 구매내역 접수 즉시 텔레그램으로 관리자에게 자동 알림
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

  // 이미지 저장 응답을 늦추지 않도록 알림은 비동기로 발송합니다.
  sendTelegramMessage(notificationText).catch((error) => {
    console.error('[TELEGRAM] 신규 구매내역 알림 오류:', error.message);
  });

  res.json({ success: true, item });
});

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
// ===============================
app.get('/admin', requireAdmin, (req, res) => {
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
            <form method="POST" action="/admin/status/${safeId}">
              <input type="hidden" name="status" value="진행중" />
              <button class="btn-small btn-yellow" type="submit">진행중</button>
            </form>
            <form method="POST" action="/admin/status/${safeId}">
              <input type="hidden" name="status" value="적중" />
              <button class="btn-small" type="submit">적중</button>
            </form>
            <form method="POST" action="/admin/status/${safeId}">
              <input type="hidden" name="status" value="미적중" />
              <button class="btn-small btn-red" type="submit">미적중</button>
            </form>
          </div>
        </td>
        <td>${escapeHtml(item.createdAt)}</td>
        <td>
          ${item.image
            ? `<img class="admin-img" src="${item.image}" onclick="openImage('${item.id}')" alt="구매내역 이미지" />
               <div class="admin-actions">
                 <button class="btn-small btn-blue" onclick="openImage('${item.id}')">크게 보기</button>
                 <form method="POST" action="/admin/delete/${safeId}" onsubmit="return confirm('이 구매내역을 삭제할까요?');">
                   <button class="btn-small btn-red" type="submit">삭제</button>
                 </form>
               </div>`
            : `<span class="muted">이미지 없음</span>
               <div class="admin-actions">
                 <form method="POST" action="/admin/delete/${safeId}" onsubmit="return confirm('이 구매내역을 삭제할까요?');">
                   <button class="btn-small btn-red" type="submit">삭제</button>
                 </form>
               </div>`
          }
        </td>
      </tr>
    `;
  }).join('');

  const imageMap = {};
  purchaseList.forEach((item) => {
    if (item.image) imageMap[item.id] = item.image;
  });

  res.send(layout('SM1357 관리자', `
    <div class="admin-top">
      <div>
        <h1>관리자 페이지</h1>
        <p class="muted">회원이 보낸 구매내역 이미지와 처리 상태를 관리합니다.</p>
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
        <a class="btn btn-red" href="/admin/clear" onclick="return confirm('전체 구매내역을 삭제할까요?')">전체삭제</a>
        <a class="btn btn-gray" href="/admin-logout">관리자 로그아웃</a>
      </div>
    </div>

    <div class="card">
      <h2>구매내역 목록</h2>
      ${purchaseList.length === 0
        ? '<p class="muted">아직 전송된 구매내역이 없습니다.</p>'
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
// 관리자: 텔레그램 알림 테스트
// 회원 전송 자동 알림은 아직 연결하지 않습니다.
// ===============================
// 관리자: Supabase DB 연결 테스트
// 회원 로그인/구매내역 저장 방식은 아직 변경하지 않습니다.
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
app.post('/admin/status/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.status;
  const allowedStatus = ['진행중', '적중', '미적중'];

  if (!allowedStatus.includes(status)) {
    return res.status(400).send('허용되지 않은 상태입니다.');
  }

  const item = purchaseList.find((purchase) => purchase.id === id);
  if (item) item.status = status;

  res.redirect('/admin');
});

// ===============================
// 관리자: 구매내역 개별 삭제
// ===============================
app.post('/admin/delete/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  purchaseList = purchaseList.filter((purchase) => purchase.id !== id);
  res.redirect('/admin');
});

// ===============================
// 관리자: 구매내역 전체 삭제
// ===============================
app.get('/admin/clear', requireAdmin, (req, res) => {
  purchaseList = [];
  res.redirect('/admin');
});

// ===============================
// 관리자 JSON 확인용
// ===============================
app.get('/api/list', requireAdmin, (req, res) => {
  res.json({ success: true, count: purchaseList.length, list: purchaseList });
});

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
