import {spawnSync} from 'node:child_process';
process.env.UNO_DESIGN_PREVIEW='1';
const build=spawnSync(process.execPath,['scripts/build-pages.mjs'],{stdio:'inherit',env:process.env});
if(build.status!==0)process.exit(build.status??1);
await import('./preview.mjs');
