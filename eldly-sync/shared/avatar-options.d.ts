export type AvatarStyle={hair:string;headphones:string;skin:string;sweatshirt:string;collar:string};
export type AvatarPart=keyof AvatarStyle;
export const avatarPalettes:Record<AvatarPart,{id:string;label:string;color:string|null}[]>;
export const defaultAvatar:AvatarStyle;
export const avatarPresets:{id:string;label:string;style:AvatarStyle}[];

export function avatarPreset(id?:string):{id:string;label:string;style:AvatarStyle};
