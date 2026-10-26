import {useLayoutEffect, useRef, useState, type InputHTMLAttributes} from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'defaultValue'>;

/** Keep the browser's editing buffer (including empty, minus and decimal drafts).
 * Parent state can normalize numbers without replacing what the user is typing. */
export default function NumberInput({value, onChange, onFocus, onBlur, ...props}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const editing = useRef(false);
  const [, refresh] = useState(0);
  const text = typeof value === 'number' && !Number.isFinite(value) ? '' : String(value ?? '');
  useLayoutEffect(() => {
    if (input.current && !editing.current && !input.current.validity.badInput && input.current.value !== text) input.current.value = text;
  });
  return <input {...props} type="number" ref={input} defaultValue={text}
    onFocus={event => { editing.current = true; onFocus?.(event); }}
    onChange={event => {
      // A lone minus is an unfinished number, not a request to save zero.
      if (!event.currentTarget.validity.badInput) onChange?.(event);
    }}
    onBlur={event => {
      editing.current = false;
      onBlur?.(event);
      refresh(n => n + 1);
    }} />;
}
