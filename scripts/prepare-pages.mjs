import {cp,mkdir,writeFile,rm} from 'node:fs/promises';
// docs is generated exclusively by this script; replace stale hashed assets.
await rm(new URL('../docs/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('../docs/',import.meta.url),{recursive:true});
await cp(new URL('../dist/',import.meta.url),new URL('../docs/',import.meta.url),{recursive:true});
await writeFile(new URL('../docs/.nojekyll',import.meta.url),'');
console.log('GitHub Pages build prepared in docs/');
