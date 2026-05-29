const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// ===============================
// 임시 회원 목록
// ===============================
const USERS = {
  vip001: '1234',
  vip002: '1234',
  vip003: '1234',
  sm1357: '1234',
  admin: 'admin1234'
};

// ===============================
// 임시 구매내역 저장소
// Render 서버 재시작 시 초기화됨
// ===============================
let purchaseList = [];

// ===============================
// 공통 HTML 레이아웃
// ===============================
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
      margin-bottom: 20px;
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

    input[type="file"] {
      background: #0f172a;
      border: 1px dashed #64748b;
      cursor: pointer;
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

    .btn-gray {
      background: #4b5563;
    }

    .btn-gray:hover {
      background: #374151;
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

    .ok {
      color: #22c55e;
      font-weight: bold;
    }

    .bad {
      color: #ef4444;
      font-weight: bold;
    }

    .row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .preview-img {
      display: none;
      max-width: 100%;
      max-height: 420px;
      margin-top: 12px;
      border-radius: 10px;
      border: 1px solid #374151;
      background: #000;
    }

    .admin-img {
      max-width: 220px;
      max-height: 180px;
      border-radius: 8px;
      border: 1px solid #374151;
      cursor: pointer;
      background: #000;
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

    .status {
      display: inline-block;
      padding: 5px 9px;
      border-radius: 999px;
      background: #7c2d12;
      color: #fed7aa;
      font-size: 13px;
      font-weight: bold;
    }

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

    .notice {
      padding: 12px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      margin-bottom: 14px;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.6;
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

      .admin-img {
        max-width: 100%;
        max-height: none;
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

// ===============================
// 첫 화면
// ===============================
app.get('/', (req, res) => {
  res.send(layout('SM1357 SERVER', `
    <div class="card">
      <h1>SM1357 SERVER OK</h1>
      <p class="ok">외부 서버가 정상 실행 중입니다.</p>
      <p class="muted">이미지 업로드 버전입니다.</p>
      <div class="row">
        <a class="btn btn-blue" href="/login">로그인 페이지</a>
        <a class="btn" href="/admin">관리자 페이지</a>
      </div>
    </div>
  `));
});

// ===============================
// 로그인 페이지
// ===============================
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

// ===============================
// 로그인 처리
// ===============================
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

// ===============================
// 회원 페이지
// ===============================
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
        최종 구매내역 화면을 캡처한 뒤 이미지 선택해서 보내면 됩니다.
      </p>

      <div class="row">
        <a class="btn btn-blue" href="https://www.betman.co.kr" target="_blank">배트맨 열기</a>
        <a class="btn btn-gray" href="/admin" target="_blank">관리자 새 창</a>
      </div>
    </div>

    <div class="card">
      <h2>구매내역 보내기</h2>

      <div class="notice">
        1. 배트맨에서 최종 구매내역 화면까지 이동<br>
        2. 화면 캡처 또는 스크린샷 저장<br>
        3. 아래에서 이미지 선택<br>
        4. 구매내역 보내기 클릭<br>
        5. 관리자 페이지에서 확인
      </div>

      <label>메모</label>
      <textarea id="memo" rows="5">구매내역 이미지 첨부합니다.</textarea>

      <label>구매내역 이미지 선택</label>
      <input id="imageFile" type="file" accept="image/*" />

      <img id="preview" class="preview-img" />

      <div class="row" style="margin-top:16px;">
        <button onclick="sendPurchase()">구매내역 보내기</button>
        <button class="btn-gray" onclick="clearImage()">이미지 지우기</button>
      </div>

      <p id="result" class="muted"></p>
    </div>

    <script>
      const username = ${JSON.stringify(username)};
      let selectedImage = '';

      const imageFile = document.getElementById('imageFile');
      const preview = document.getElementById('preview');
      const result = document.getElementById('result');

      imageFile.addEventListener('change', function () {
        const file = this.files[0];

        if (!file) {
          selectedImage = '';
          preview.style.display = 'none';
          return;
        }

        if (!file.type.startsWith('image/')) {
          alert('이미지 파일만 선택 가능합니다.');
          this.value = '';
          selectedImage = '';
          preview.style.display = 'none';
          return;
        }

        if (file.size > 8 * 1024 * 1024) {
          alert('이미지가 너무 큽니다. 8MB 이하 이미지를 선택하세요.');
          this.value = '';
          selectedImage = '';
          preview.style.display = 'none';
          return;
        }

        const reader = new FileReader();

        reader.onload = function (e) {
          selectedImage = e.target.result;
          preview.src = selectedImage;
          preview.style.display = 'block';
          result.innerText = '이미지 선택 완료';
        };

        reader.readAsDataURL(file);
      });

      function clearImage() {
        imageFile.value = '';
        selectedImage = '';
        preview.src = '';
        preview.style.display = 'none';
        result.innerText = '이미지를 지웠습니다.';
      }

      function sendPurchase() {
        const memo = document.getElementById('memo').value.trim();

        if (!memo && !selectedImage) {
          alert('메모 또는 이미지를 입력하세요.');
          return;
        }

        result.innerText = '전송 중입니다...';

        fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            type: selectedImage ? 'IMAGE' : 'MEMO',
            memo,
            image: selectedImage
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            result.innerText = '전송 완료. 관리자 페이지에서 확인하세요.';
          } else {
            result.innerText = '전송 실패: ' + (data.message || '알 수 없는 오류');
          }
        })
        .catch(() => {
          result.innerText = '전송 오류가 발생했습니다.';
        });
      }
    </script>
  `));
});

// ===============================
// 구매내역 전송 API
// ===============================
app.post('/api/send', (req, res) => {
  const { username, type, memo, image } = req.body;

  if (!username) {
    return res.status(400).json({
      success: false,
      message: '회원 정보가 없습니다.'
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

// ===============================
// 관리자 페이지
// ===============================
app.get('/admin', (req, res) => {
  const rows = purchaseList.map((item, index) => {
    const memoHtml = escapeHtml(item.memo).replace(/\\n/g, '<br>');

    return `
      <tr>
        <td>${index + 1}</td>
        <td><b>${escapeHtml(item.username)}</b></td>
        <td>${escapeHtml(item.type)}</td>
        <td>${memoHtml || '<span class="muted">메모 없음</span>'}</td>
        <td><span class="status">${escapeHtml(item.status)}</span></td>
        <td>${escapeHtml(item.createdAt)}</td>
        <td>
          ${
            item.image
              ? `<img class="admin-img" src="${item.image}" onclick="openImage('${item.id}')" />
                 <div style="margin-top:8px;">
                   <button onclick="openImage('${item.id}')">크게 보기</button>
                 </div>`
              : '<span class="muted">이미지 없음</span>'
          }
        </td>
      </tr>
    `;
  }).join('');

  const imageMap = {};
  purchaseList.forEach(item => {
    if (item.image) imageMap[item.id] = item.image;
  });

  res.send(layout('SM1357 관리자', `
    <div class="top">
      <div>
        <h1>관리자 페이지</h1>
        <p class="muted">회원이 보낸 구매내역 이미지와 메모를 확인하는 화면입니다.</p>
      </div>
      <div class="row">
        <a class="btn btn-blue" href="/login">로그인</a>
        <a class="btn" href="/admin">새로고침</a>
        <a class="btn btn-red" href="/admin/clear" onclick="return confirm('전체 구매내역을 삭제할까요?')">전체삭제</a>
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

    <div id="modal" class="modal" onclick="closeImage()">
      <button class="modal-close" onclick="closeImage()">닫기</button>
      <img id="modalImg" src="" />
    </div>

    <script>
      const imageMap = ${JSON.stringify(imageMap)};

      function openImage(id) {
        const modal = document.getElementById('modal');
        const modalImg = document.getElementById('modalImg');

        if (!imageMap[id]) return;

        modalImg.src = imageMap[id];
        modal.style.display = 'flex';
      }

      function closeImage() {
        const modal = document.getElementById('modal');
        const modalImg = document.getElementById('modalImg');

        modal.style.display = 'none';
        modalImg.src = '';
      }
    </script>
  `));
});

// ===============================
// 관리자 데이터 전체 삭제
// ===============================
app.get('/admin/clear', (req, res) => {
  purchaseList = [];
  res.redirect('/admin');
});

// ===============================
// 관리자 JSON 확인용
// ===============================
app.get('/api/list', (req, res) => {
  res.json({
    success: true,
    count: purchaseList.length,
    list: purchaseList
  });
});

// ===============================
// HTML 이스케이프
// ===============================
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===============================
// 없는 주소 처리
// ===============================
app.use((req, res) => {
  res.status(404).send(layout('Not Found', `
    <div class="card">
      <h1>페이지를 찾을 수 없습니다.</h1>
      <p class="muted">요청 주소: ${escapeHtml(req.originalUrl)}</p>
      <div class="row">
        <a class="btn btn-blue" href="/">첫 화면</a>
        <a class="btn" href="/login">로그인</a>
        <a class="btn" href="/admin">관리자</a>
      </div>
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
