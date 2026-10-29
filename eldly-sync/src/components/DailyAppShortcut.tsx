import AppIcon from './AppIcon';
export default function DailyAppShortcut({to}:{to:'check'|'track'}) {
  return <a className="daily-app-shortcut" href={to==='track'?'#trackly':'#checkly'} aria-label={`Open ${to==='track'?'Track':'Check'}`}><AppIcon app={to==='track'?'mapping':'checkly'}/><span>{to==='track'?'Track':'Check'}</span></a>;
}
