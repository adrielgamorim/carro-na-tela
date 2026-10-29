// Writing files that something else may be reading at that instant: on
// Windows the dev server (public/ is served by Vite), the antivirus or the
// indexer can hold a file open, and writeFile then fails with EBUSY, EPERM or
// "UNKNOWN" (errno -4094). The scripts the daily runs retry a few times.

import { writeFile } from "node:fs/promises";

const lockCodes = new Set(["EBUSY", "EPERM", "EACCES", "UNKNOWN"]);

/** writeFile, retried with a growing pause while the file is locked. */
export async function writeFileRetrying(
  path: string,
  data: string,
  { attempts = 6, pauseMs = 250, write = writeFile }: { attempts?: number; pauseMs?: number; write?: typeof writeFile } = {},
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await write(path, data);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "";
      if (!lockCodes.has(code) || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, pauseMs * attempt));
    }
  }
}
