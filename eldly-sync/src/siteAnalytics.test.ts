import {it,expect} from 'vitest';
import {analyticsPath,publicPageview} from './siteAnalytics';
it('counts public hash sections while omitting private detail identifiers',()=>{
 expect(['','#checkly','#trackly','#progress/sleep/private-range','#packly/private-trip','#mapping'].map(analyticsPath)).toEqual(['/','/check','/track','/data','/pack','/track']);
 expect(analyticsPath('#nokiceldin/private')).toBe('/');
});
it('strips query strings, unknown paths and fragments before sending analytics',()=>{
 expect(publicPageview({type:'pageview',url:'https://eldly.vercel.app/?username=private#progress/sleep'})).toEqual({type:'pageview',url:'https://eldly.vercel.app/data'});
 expect(publicPageview({type:'pageview',url:'https://eldly.vercel.app/track?coins=1000'})).toEqual({type:'pageview',url:'https://eldly.vercel.app/track'});
 expect(publicPageview({type:'pageview',url:'https://eldly.vercel.app/private-account'})).toEqual({type:'pageview',url:'https://eldly.vercel.app/'});
 expect(publicPageview({type:'event',url:'https://eldly.vercel.app/'})).toBeNull();
 expect(publicPageview({type:'pageview',url:'not a URL'})).toBeNull();
});
