


type FileGetter = (path: string) => Promise<ArrayBuffer | null>;
type SizeGetter = (path: string) => Promise<number | null>;

type FS = {
  getFile: FileGetter;
  getSize: SizeGetter;
}

export class FileSystem {

  mounts: FS[] = [];


  constructor(private prefix?: string) {}

  addMount(fs: FS) {
    this.mounts.push(fs);
  }

  async getFile(path: string): Promise<ArrayBuffer | null> {
    const testPath = this.prefix ? `${this.prefix}/${path}` : path;
    for (const fs of this.mounts) {
      const file = await fs.getFile(testPath);
      if (file) {
        return file;
      }
    }


    for (const fs of this.mounts) {
      const file = await fs.getFile(path);
      if (file) {
        return file;
      }
    }
    return null;
  }

  async getSize(path: string): Promise<number | null> {
    const testPath = this.prefix ? `${this.prefix}/${path}` : path;
    console.log("Getting size for", testPath);
    for (const fs of this.mounts) {
      
      const size = await fs.getSize(testPath);
      console.log("Size", fs, size);
      if (size) {
        return size;
      }
    }

    for (const fs of this.mounts) {
      
      const size = await fs.getSize(path);
      console.log("Size", fs, size);
      if (size) {
        return size;
      }
    }
    return null;
  }

}
