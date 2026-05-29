const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '50mb' }));

// 임시 회원 목록
// 나중에 DB로 바꿀 수 있음
const USERS = {
  vip001: '1234',
  vip002: '1234',
  vip003: '1234',
  sm1357: '1234',
  admin: 'admin1234'
};

// 임시 저장소
// 서버 재시작하면 초기화됨
// 나중에 DB로 바꿀 수 있음
let purchaseList = [];

// 공통 HTML 스타일
function layout(title, body) {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
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
    }

    h1, h2, h3 {
      margin-top: 0;
    }

    input, button, textarea {
      font-size: 16px;
      box-sizing: border-box;
    }

    input, textarea {
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

    button:hover, .btn:hover {
      background: #15803d;
    }

    .btn-red {
      background: #dc2626;
    }

    .btn-red:hover {
      background: #b91c1c;
    }

    .btn-blue {
      background: #2563eb;
    }

    .btn-blue:hover {
      background: #1d4ed8;
    }

    .top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 20px;
    }

    .muted {
      color: #9ca3af;
      font-size: 14px;
    }

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

    th {
      background: #0f172a;
      color: #d1d5db;
    }

    .ok {
      color: #22c55e;
      font-weight: bold;
    }

    .bad {
      color: #ef4444;
      font-weight: bold;
    }

    iframe {
      width: 100%;
      height: 75vh;
      border: 0;
      border-radius: 12px;
      background: white;
    }

    .row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .row .btn {
      margin-bottom: 8px;
    }

    .capture-box {
      margin-top: 20px;
      padding: 16px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
    }

    img {
      max-width: 260px;
      border-radius: 8px;
      border: 1px solid #374151;
    }

    @media (max-width: 700px) {
      .top {
        display: block;
      }

      table, thead, tbody, th, td, tr {
        display: block;
      }

      th {
        display: none;
      }

      td {
        border-bottom: 1px solid #374151;
      }
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

// 서버 상태 확인
app.get('/', (req, res) => {
  res.send(layout('SM1357 SERVER', `
    <div class="card">
      <h1>SM1357 SERVER OK</h1>
      <p class="ok">외부 서버가 정상 실행 중입니다.</p>
      <p class="muted">Render 배포 확인 완료용 첫 화면입니다.</p>
      <div class="row">
        <a class="btn btn-blue" href="/login">로그인 페이지</a>
        <a class="btn" href="/admin">관리자 페이지</a>
      </div>
    </div>
  `));
});

// 로그인 페이지
app.get('/login', (req, res) => {
  res.send(layout('SM1357 로그인', `
    <div class="card" style="max-width:420px;margin:60px auto;">
      <h1>SM1357 로그인</h1>
      <p class="muted">테스트 계정: vip001 / 1234</p>

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

// 로그인 처리
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.send(layout('로그인 실패', `
      <div class="card">
        <h1 class="bad">로그인 실패</h1>
        <p>아이디와 비밀번호를 입력하세요.</p>
        <a class="btn btn-blue" href="/login">다시 로그인</a>
      </div>
    `));
  }

  if (USERS[username] !== password) {
    return res.send(layout('로그인 실패', `
      <div class="card">
        <h1 class="bad">로그인 실패</h1>
        <p>아이디 또는 비밀번호가 틀렸습니다.</p>
        <a class="btn btn-blue" href="/login">다시 로그인</a>
      </div>
    `));
  }

  res.redirect(`/betman?user=${encodeURIComponent(username)}`);
});

// 로그인 후 페이지
app.get('/betman', (req, res) => {
  const username = req.query.user || 'unknown';

  res.send(layout('BETMAN 이동', `
    <div class="top">
      <div>
        <h1>회원 페이지</h1>
        <p class="muted">로그인 회원: <b>${username}</b></p>
      </div>
      <div class="row">
        <a class="btn" href="/admin">관리자</a>
        <a class="btn btn-red" href="/login">로그아웃</a>
      </div>
    </div>

    <div class="card">
      <h2>배트맨 열기</h2>
      <p class="muted">
        아래 버튼을 누르면 배트맨 사이트가 새 창으로 열립니다.
        앱에서는 나중에 이 부분을 WebView 방식으로 연결하면 됩니다.
      </p>

      <div class="row">
        <a class="btn btn-blue" href="https://www.betman.co.kr" target="_blank">배트맨 열기</a>
        <button onclick="sendTest()">구매내역 보내기 테스트</button>
      </div>

      <div class="capture-box">
        <h3>구매내역 보내기 테스트</h3>
        <p class="muted">
          지금은 이미지 캡처 전 단계라서 테스트 데이터만 관리자페이지로 보냅니다.
          다음 단계에서 실제 화면 이미지 저장 기능을 붙이면 됩니다.
        </p>

        <textarea id="memo" rows="5">테스트 구매내역입니다.
회원이 최종 구매내역 화면에서 구매내역 보내기 버튼을 눌렀다고 가정합니다.</textarea>

        <button onclick="sendMemo()">현재 내용 보내기</button>

        <p id="result" class="muted"></p>
      </div>
    </div>

    <script>
      const username = ${JSON.stringify(username)};

      function sendTest() {
        fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            type: 'TEST',
            memo: '구매내역 보내기 테스트',
            image: ''
          })
        })
        .then(res => res.json())
        .then(data => {
          document.getElementById('result').innerText = data.success
            ? '전송 완료: 관리자페이지에서 확인하세요.'
            : '전송 실패';
        })
        .catch(() => {
          document.getElementById('result').innerText = '전송 오류';
        });
      }

      function sendMemo() {
        const memo = document.getElementById('memo').value;

        fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            type: 'MEMO',
            memo,
            image: ''
          })
        })
        .then(res => res.json())
        .then(data => {
          document.getElementById('result').innerText = data.success
            ? '전송 완료: 관리자페이지에서 확인하세요.'
            : '전송 실패';
        })
        .catch(() => {
          document.getElementById('result').innerText = '전송 오류';
        });
      }
    </script>
  `));
});

// 구매내역 전송 API
app.post('/api/send', (req, res) => {
  const { username, type, memo, image } = req.body;

  const item = {
    id: Date.now(),
    username: username || 'unknown',
    type: type || 'UNKNOWN',
    memo: memo || '',
    image: image || '',
    status: '확인전',
    createdAt: new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul'
    })
  };

  purchaseList.unshift(item);

  res.json({
    success: true,
    item
  });
});

// 관리자 페이지
app.get('/admin', (req, res) => {
  const rows = purchaseList.map((item, index) => {
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${item.username}</td>
        <td>${item.type}</td>
        <td>${item.memo.replace(/\n/g, '<br>')}</td>
        <td>${item.status}</td>
        <td>${item.createdAt}</td>
        <td>
          ${item.image ? `<img src="${item.image}" />` : '<span class="muted">이미지 없음</span>'}
        </td>
      </tr>
    `;
  }).join('');

  res.send(layout('SM1357 관리자', `
    <div class="top">
      <div>
        <h1>관리자 페이지</h1>
        <p class="muted">회원이 보낸 구매내역을 확인하는 화면입니다.</p>
      </div>
      <div class="row">
        <a class="btn btn-blue" href="/login">로그인</a>
        <a class="btn" href="/admin">새로고침</a>
      </div>
    </div>

    <div class="card">
      <h2>구매내역 목록</h2>

      ${
        purchaseList.length === 0
          ? '<p class="muted">아직 전송된 구매내역이 없습니다.</p>'
          : `
            <table>
              <thead>
                <tr>
                  <th>번호</th>
                  <th>회원ID</th>
                  <th>구분</th>
                  <th>내용</th>
                  <th>상태</th>
                  <th>시간</th>
                  <th>이미지</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          `
      }
    </div>
  `));
});

// 관리자 데이터 JSON 확인용
app.get('/api/list', (req, res) => {
  res.json({
    success: true,
    count: purchaseList.length,
    list: purchaseList
  });
});

// 없는 주소 처리
app.use((req, res) => {
  res.status(404).send(layout('Not Found', `
    <div class="card">
      <h1>페이지를 찾을 수 없습니다.</h1>
      <p class="muted">요청 주소: ${req.originalUrl}</p>
      <div class="row">
        <a class="btn btn-blue" href="/">첫 화면</a>
        <a class="btn" href="/login">로그인</a>
        <a class="btn" href="/admin">관리자</a>
      </div>
    </div>
  `));
});

// Render 호환 포트 설정
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SERVER START on port ${PORT}`);
});
