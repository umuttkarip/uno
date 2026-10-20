// Change these only after Umut explicitly approves the corresponding design.
export const TABLE_DESIGNS_APPROVED=false;
export const CARD_DESIGNS_APPROVED=false;
const preview=typeof __UNO_DESIGN_PREVIEW__!=='undefined'&&__UNO_DESIGN_PREVIEW__===true;
export const APPEARANCE_POLICY={tables:TABLE_DESIGNS_APPROVED||preview,cards:CARD_DESIGNS_APPROVED||preview};
