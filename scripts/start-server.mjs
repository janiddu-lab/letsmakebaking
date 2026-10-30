import { spawn } from "node:child_process";
// 호스팅 서비스가 지정한 PORT에서 외부 접속을 받습니다. 로컬 실행 명령은 그대로 유지합니다.
const port = Number(process.env.PORT ?? 10000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT 설정을 확인하세요.");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", String(port)], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
