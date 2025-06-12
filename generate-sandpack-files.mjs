import { globby } from 'globby';
import { readFile } from 'fs/promises';
import path from 'path';

const ROOT_DIR = './pages'; // root directory of your project

async function generateFlattenedFilesObject() {
    const files = await globby(['**/*.{astro,ts,tsx,js,css}'], {
        cwd: ROOT_DIR,
        absolute: false,
        gitignore: true
    });

    const fileEntries = await Promise.all(
        files.map(async (filePath) => {
            const fullPath = path.join(ROOT_DIR, filePath);
            const code = await readFile(fullPath, 'utf8');
            const normalizedPath = `src/${filePath.replace(/\\/g, '/')}`;

            return [normalizedPath, {
                code,
                active: true
            }];
        })
    );

    const flattenedFilesObject = Object.fromEntries(fileEntries);

    console.log(JSON.stringify(flattenedFilesObject, null, 2));
}

generateFlattenedFilesObject().catch(console.error);
