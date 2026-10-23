import {it,expect} from 'vitest';
import {avatarPresets,avatarPreset,avatarPalettes,defaultAvatar} from '../shared/avatar-options';
it('offers exactly thirty distinct fixed portraits including the original',()=>{
 expect(avatarPresets).toHaveLength(30);expect(new Set(avatarPresets.map(p=>p.id)).size).toBe(30);expect(new Set(avatarPresets.map(p=>JSON.stringify(p.style))).size).toBe(30);expect(avatarPreset().style).toEqual(defaultAvatar);for(const p of avatarPresets){expect(avatarPreset(p.id)).toEqual(p);for(const part of Object.keys(p.style) as (keyof typeof p.style)[])expect(avatarPalettes[part].some(c=>c.id===p.style[part])).toBe(true);}
});
it('rejects arbitrary images, colors and unknown preset IDs',()=>{
 for(const id of ['#ff0000','unknown','https://example.com/image.png','{"hair":"copper"}'])expect(()=>avatarPreset(id)).toThrow('portraits');
});
