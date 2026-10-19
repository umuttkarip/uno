import {themedFace,getDeckTheme} from './card-themes.js';
const colors = {red: '#d90b28', yellow: '#f5c400', green: '#00954c', blue: '#086bdb', wild: '#161819'};
const labels = {skip: 'Pas', reverse: 'Yön değiştir', draw2: '+2', wild: 'Renk değiştir', wild4: '+4'};
const names = {red: 'Kırmızı', yellow: 'Sarı', green: 'Yeşil', blue: 'Mavi', wild: 'Joker'};
export const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export function face(c, back = false, theme=getDeckTheme(),options={}) {
  if(theme!=='classic'){const themed=themedFace(c,back,theme,options);if(themed)return themed;}
  const color = colors[c.color] ?? colors.wild;
  const value = labels[c.value] ?? c.value ?? '';
  const corner = c.value === 'wild' ? '✦' : c.value === 'skip' ? '⊘' : c.value === 'reverse' ? '⇄' : value;
  let center;
  if (c.value === 'wild4') {
    center = `<g stroke="#fdfdf6" stroke-width="2.1">${[['#086bdb',29,56,-18],['#00954c',40,51,-8],['#f5c400',51,54,3],['#d90b28',60,62,15]].map(([fill,x,y,r]) => `<rect x="${x}" y="${y}" width="20" height="34" rx="2.5" fill="${fill}" transform="rotate(${r} ${x+10} ${y+17})"/>`).join('')}</g>`;
  } else if (c.value === 'wild') {
    center = '<g transform="rotate(27 50 75)" stroke="#fdfdf6" stroke-width="1.4"><path d="M50 47a28 28 0 0 1 28 28H50Z" fill="#d90b28"/><path d="M78 75a28 28 0 0 1-28 28V75Z" fill="#086bdb"/><path d="M50 103a28 28 0 0 1-28-28h28Z" fill="#00954c"/><path d="M22 75a28 28 0 0 1 28-28v28Z" fill="#f5c400"/></g>';
  } else if (c.value === 'skip') {
    center = `<g fill="none" stroke="${color}" stroke-width="7"><circle cx="50" cy="75" r="23"/><path d="M34 91 66 59"/></g>`;
  } else if (c.value === 'reverse') {
    center = `<g fill="${color}" transform="rotate(-34 50 75)"><path d="M31 72V57a8 8 0 0 1 8-8h15v-8l16 14-16 14v-8H43v11Z"/><path d="M69 78v15a8 8 0 0 1-8 8H46v8L30 95l16-14v8h11V78Z"/></g>`;
  } else {
    center = `<text x="49" y="101" text-anchor="middle" fill="${color}" font-size="${c.value === 'draw2' ? 48 : 76}" font-style="italic" font-weight="900" font-family="Arial,Helvetica,sans-serif" letter-spacing="-5" paint-order="stroke" stroke="${color}" stroke-width=".6">${escape(value)}</text>${['6','9'].includes(c.value)?`<path d="M36 107h29" stroke="${color}" stroke-width="3.5"/>`:''}`;
  }
  const corners = `<g fill="#fdfdf6" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-style="italic" font-size="${corner.length > 1 ? 17 : 23}"><text x="11" y="28">${escape(corner)}</text><g transform="rotate(180 50 75)"><text x="11" y="28">${escape(corner)}</text></g></g>`;
  return `<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x=".6" y=".6" width="98.8" height="148.8" rx="9" fill="#fcfcf4" stroke="#c4c7bd" stroke-width="1.2"/><rect x="5" y="5" width="90" height="140" rx="5.5" fill="${back?'#151b1d':color}"/>${back?'<ellipse cx="50" cy="75" rx="31" ry="57" transform="rotate(28 50 75)" fill="#d90b28"/><text x="46" y="86" text-anchor="middle" transform="rotate(-24 50 75)" fill="#f5c400" stroke="#101517" stroke-width="2.5" paint-order="stroke" font-family="Arial,Helvetica,sans-serif" font-style="italic" font-weight="900" font-size="33" letter-spacing="-3">UNO</text>':`<ellipse cx="50" cy="75" rx="31" ry="57" transform="rotate(28 50 75)" fill="#fcfcf4"/>${center}${corners}`}<path d="M9 5h81" stroke="#ffffff" opacity=".18" stroke-width="1"/></svg>`;
}

export function card(c, {button=false, playable=false, drawn=false, style=''}={}) {
  const tag = button ? 'button' : 'div';
  return `<${tag} class="card ${playable?'playable':''} ${drawn?'drawn':''}" style="${style}" ${button?`type="button" data-card="${escape(c.id)}" aria-label="${names[c.color]} ${escape(labels[c.value]??c.value)}" ${playable?'':'disabled'}`:'aria-hidden="true"'}>${face(c)}</${tag}>`;
}

export function back(style='') {return `<div class="card card-back" style="${style}" aria-hidden="true">${face({color:'wild'}, true)}</div>`;}
