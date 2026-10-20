import {spawnSync} from 'node:child_process';
import {writeDesignGallery} from './design-gallery.mjs';
import {writeTableProposals} from './table-proposals.mjs';
process.env.UNO_DESIGN_PREVIEW='1';
const build=spawnSync(process.execPath,['scripts/build-pages.mjs'],{stdio:'inherit',env:process.env});
if(build.status!==0)process.exit(build.status??1);
await writeDesignGallery('preview');
await writeTableProposals('preview');
await import('./preview.mjs');
