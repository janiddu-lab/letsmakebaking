const http = require('node:http');
// 이미 열린 작업실이 있으면 새 서버를 중복 실행하지 않도록 실행 파일에 알립니다.
const req = http.get('http://127.0.0.1:3210/api/health', res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try { process.exit(JSON.parse(body).data?.localOnly ? 42 : 0); }
    catch { process.exit(0); }
  });
});
req.setTimeout(1000, () => req.destroy());
req.on('error', () => process.exit(0));
