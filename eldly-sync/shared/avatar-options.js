const colors={original:['Original',null],midnight:['Midnight','#183447'],espresso:['Espresso','#664737'],chestnut:['Chestnut','#956341'],copper:['Copper','#bc7046'],honey:['Honey','#c6a15a'],platinum:['Platinum','#d3cbbb'],silver:['Silver','#aebbc2'],rose:['Rose','#bd8199'],lavender:['Lavender','#a493c5'],moss:['Moss','#7e8d63'],ocean:['Ocean','#488da3'],ink:['Ink','#294959'],cream:['Cream','#e6d4b5'],sage:['Sage','#9faa87'],forest:['Forest','#426c55'],teal:['Teal','#438b84'],denim:['Denim','#567e9e'],plum:['Plum','#795c83'],rust:['Rust','#b76b4f'],gold:['Gold','#c6a05b'],navy:['Navy','#34516a'],charcoal:['Charcoal','#484e55'],slate:['Slate','#7f8d9c'],sky:['Sky','#8db8cc'],burgundy:['Burgundy','#98566a'],ochre:['Ochre','#bb9752'],white:['Cloud','#edeae1'],porcelain:['Porcelain','#f2d1b2'],warm:['Warm','#e8b080'],olive:['Olive','#cd9a70'],caramel:['Caramel','#ae7958'],deep:['Deep','#865a42']};
const choices={hair:['original','midnight','espresso','chestnut','copper','honey','platinum','silver','rose','lavender','moss','ocean'],headphones:['original','ink','silver','cream','sage','forest','teal','denim','plum','rose','rust','gold'],skin:['original','porcelain','warm','olive','caramel','deep'],sweatshirt:['original','navy','cream','charcoal','slate','forest','sage','teal','denim','sky','burgundy','plum','lavender','rose','rust','ochre'],collar:['original','cream','white','charcoal','navy','sage','rose','ochre','sky','plum']};
export const avatarPalettes=Object.fromEntries(Object.entries(choices).map(([part,ids])=>[part,ids.map(id=>({id,label:colors[id][0],color:colors[id][1]}))]));
export const defaultAvatar={hair:'original',headphones:'original',skin:'original',sweatshirt:'original',collar:'original'};
export const avatarPresets=[
 ['original','Original',{}],['afterhours','After hours',{hair:'espresso',headphones:'gold',sweatshirt:'navy',collar:'cream'}],['matchpoint','Match point',{hair:'chestnut',headphones:'cream',sweatshirt:'forest',collar:'white'}],['coast','Coast',{hair:'honey',headphones:'denim',sweatshirt:'sky',collar:'cream'}],['vinyl','Vinyl',{hair:'espresso',headphones:'rust',sweatshirt:'charcoal',collar:'ochre'}],['lilac','Lilac',{hair:'silver',headphones:'plum',sweatshirt:'lavender',collar:'white'}],['sundown','Sundown',{hair:'copper',headphones:'gold',sweatshirt:'burgundy',collar:'cream'}],['evergreen','Evergreen',{hair:'midnight',headphones:'sage',sweatshirt:'forest',collar:'sage'}],['rosewood','Rosewood',{hair:'chestnut',headphones:'rose',sweatshirt:'rose',collar:'plum'}],['arctic','Arctic',{hair:'platinum',headphones:'silver',sweatshirt:'slate',collar:'white'}],['lagoon','Lagoon',{hair:'espresso',headphones:'teal',sweatshirt:'teal',collar:'cream'}],['golden','Golden',{hair:'honey',headphones:'cream',sweatshirt:'ochre',collar:'white'}],['berry','Berry',{hair:'lavender',headphones:'plum',sweatshirt:'plum',collar:'rose'}],['studio','Studio',{hair:'midnight',headphones:'silver',sweatshirt:'cream',collar:'charcoal'}],
 ['dune','Dune',{hair:'espresso',headphones:'cream',skin:'caramel',sweatshirt:'ochre',collar:'cream'}],
 ['nocturne','Nocturne',{hair:'midnight',headphones:'gold',skin:'deep',sweatshirt:'navy',collar:'ochre'}],
 ['terrace','Terrace',{hair:'chestnut',headphones:'sage',skin:'olive',sweatshirt:'cream',collar:'sage'}],
 ['cloud','Cloud',{hair:'silver',headphones:'cream',skin:'porcelain',sweatshirt:'sky',collar:'white'}],
 ['ember','Ember',{hair:'copper',headphones:'ink',skin:'warm',sweatshirt:'rust',collar:'cream'}],
 ['cedar','Cedar',{hair:'espresso',headphones:'rust',skin:'deep',sweatshirt:'forest',collar:'ochre'}],
 ['harbor','Harbor',{hair:'midnight',headphones:'denim',skin:'caramel',sweatshirt:'slate',collar:'navy'}],
 ['linen','Linen',{hair:'honey',headphones:'sage',skin:'olive',sweatshirt:'cream',collar:'white'}],
 ['orchid','Orchid',{hair:'espresso',headphones:'plum',skin:'deep',sweatshirt:'lavender',collar:'plum'}],
 ['cove','Cove',{hair:'ocean',headphones:'cream',skin:'warm',sweatshirt:'teal',collar:'sky'}],
 ['clay','Clay',{hair:'chestnut',headphones:'gold',skin:'caramel',sweatshirt:'rust',collar:'cream'}],
 ['moonlight','Moonlight',{hair:'platinum',headphones:'ink',skin:'porcelain',sweatshirt:'navy',collar:'sky'}],
 ['meadow','Meadow',{hair:'moss',headphones:'forest',skin:'olive',sweatshirt:'sage',collar:'cream'}],
 ['merlot','Merlot',{hair:'midnight',headphones:'rose',skin:'deep',sweatshirt:'burgundy',collar:'plum'}],
 ['pebble','Pebble',{hair:'espresso',headphones:'silver',skin:'caramel',sweatshirt:'charcoal',collar:'white'}],
 ['apricot','Apricot',{hair:'rose',headphones:'rust',skin:'warm',sweatshirt:'ochre',collar:'cream'}]
].map(([id,label,style])=>({id,label,style:{...defaultAvatar,...style}}));

export function avatarPreset(id='original'){const preset=avatarPresets.find(p=>p.id===id);if(!preset)throw Error('Choose one of the available portraits.');return preset;}
