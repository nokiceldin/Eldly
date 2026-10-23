import {useId} from 'react';
import {avatarPalettes,defaultAvatar,type AvatarPart,type AvatarStyle} from '../../shared/avatar-options';
// Color layers reuse the original transparent portrait. These masks isolate its parts;
// they never replace the character, its silhouette or its facial features.
const regions:Record<AvatarPart,string>={
 hair:'M155 111 C186 90 198 68 249 64 C271 60 296 69 317 85 L330 81 C355 85 364 108 374 125 C414 157 447 216 444 263 L428 304 L431 279 C411 304 406 318 390 326 L397 282 L366 301 L371 263 L350 276 L335 249 L315 261 L273 287 L204 292 L156 281 L175 269 L163 270 L177 249 L142 252 L151 225 L135 229 L145 194 L137 192 C133 167 140 140 158 118 L151 119 L175 103Z',
 skin:'M151 304 L207 262 L282 256 L321 250 L337 257 L362 246 L354 275 L385 254 L376 280 L367 289 L359 300 L352 315 L350 333 Q355 340 346 345 L330 349 L322 360 L311 370 L286 391 L243 360 L228 345 L210 368Z',
 sweatshirt:'M68 359 L133 296 C162 311 198 345 229 388 L247 408 L279 444 L253 452 C201 454 154 428 115 393Z',
 collar:'M132 299 L156 309 C189 327 221 373 231 399 L256 419 L276 444 L245 435 L226 419 L194 371 L158 341 L108 330Z',
 headphones:'M254 203 L274 155 C292 118 318 82 338 81 C354 83 364 101 365 115 L344 103 C323 113 300 147 288 177 L274 216Z M251 198 C272 195 296 213 299 240 C302 273 284 301 259 309 C228 320 201 304 194 279 C185 250 205 215 228 207Z'
};
const order:AvatarPart[]=['hair','skin','sweatshirt','collar','headphones'];
export default function ProfileAvatar({style=defaultAvatar,size=42,label,className=''}:{style?:Partial<AvatarStyle>|null;size?:number;label?:string;className?:string}){
 const id=useId().replaceAll(':',''),look={...defaultAvatar,...style};
 return <svg className={`profile-portrait ${className}`} width={size} height={size} viewBox="50 50 420 420" role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true}>
  <defs>{order.map(part=>{const color=avatarPalettes[part].find(c=>c.id===look[part])?.color;
   const rgb=color?[1,3,5].map(start=>parseInt(color.slice(start,start+2),16)/255):null;
   return <g key={part}><clipPath id={`${id}-${part}`}><path d={regions[part]}/></clipPath>{rgb&&<filter id={`${id}-${part}-tint`} colorInterpolationFilters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer>{(['R','G','B'] as const).map((channel,i)=>{const Component=channel==='R'?'feFuncR':channel==='G'?'feFuncG':'feFuncB';const strength=part==='skin'?[.08,.35,.65,.92,1.12]:[.25,.76,1.02,1.2,1.45];return <Component key={channel} type="table" tableValues={strength.map(s=>Math.min(1,rgb[i]*s)).join(' ')}/>;})}</feComponentTransfer></filter>}</g>;
  })}</defs>
  <image href="/eldly-logo.png" width="512" height="512"/>
  {order.map(part=><image key={part} href="/eldly-logo.png" width="512" height="512" clipPath={`url(#${id}-${part})`} filter={avatarPalettes[part].find(c=>c.id===look[part])?.color?`url(#${id}-${part}-tint)`:undefined}/>)}
 </svg>;
}
