// dev 起動前の安全処理:
//  1) 対象ポートを使っているプロセスを停止（EADDRINUSE 回避）
//  2) 壊れた .next キャッシュを削除（Turbopack パニック回避）
// クラッシュせず毎回クリーンに起動するためのもの。失敗しても起動は止めない。
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const port = process.argv[2];

function freePort(p) {
  if (!p) return;
  try {
    if (process.platform === "win32") {
      const out = execSync("netstat -ano -p tcp", { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split("\n")) {
        if (line.includes(`:${p} `) && /LISTENING/i.test(line)) {
          const cols = line.trim().split(/\s+/);
          const pid = cols[cols.length - 1];
          if (pid && pid !== "0") pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        } catch {}
      }
    } else {
      try {
        execSync(`lsof -ti tcp:${p} | xargs -r kill -9`, { stdio: "ignore" });
      } catch {}
    }
  } catch {}
}

freePort(port);
try {
  rmSync(".next", { recursive: true, force: true });
} catch {}
