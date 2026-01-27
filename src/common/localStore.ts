import { promises as fs } from "fs";
import { join } from "path";

export class LocalStore {
  constructor(private basePath: string) {}

  async ensure(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async write(path: string, content: string | Buffer): Promise<string> {
    await this.ensure();
    const fullPath = join(this.basePath, path);
    await fs.mkdir(join(fullPath, ".."), { recursive: true });
    await fs.writeFile(fullPath, content);
    return fullPath;
  }
}
