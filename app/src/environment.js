export const DESIGN_PREVIEW=typeof __UNO_DESIGN_PREVIEW__!=='undefined'&&__UNO_DESIGN_PREVIEW__===true;
export const storageKey=key=>DESIGN_PREVIEW?'uno-design-test:'+key:key;
export const TABLE_PEER_PREFIX=DESIGN_PREVIEW?'umut-uno-design-test-v9-':'umut-uno-v9-';
