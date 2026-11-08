'use client';

import { Children, isValidElement, useId, useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { FinanceSelect } from '@/app/business/expenses/FinancePicker';

function optionText(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : String(child)).join('');
}

// Preserve native form values, change events and required validation while the
// visible picker uses the same themed dialog as the rest of the application.
export default function StyledSelect({ children, className = '', id, style, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [invalid, setInvalid] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState<string | undefined>(() => props.defaultValue === undefined ? undefined : String(props.defaultValue));
  const options: { value: string; label: string; disabled?: boolean }[] = [];
  const collect = (nodes: ReactNode, groupDisabled = false) => Children.forEach(nodes, child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child)) return;
    if (child.type === 'option') {
      const label = optionText(child.props.children);
      options.push({ value: String(child.props.value ?? label), label, disabled: groupDisabled || child.props.disabled });
    } else collect(child.props.children, groupDisabled || child.props.disabled);
  });
  collect(children);
  const value = String(props.value ?? uncontrolledValue ?? options[0]?.value ?? '');
  return <>
    <select {...props} ref={native} id={`${id || generatedId}-native`} hidden tabIndex={-1} aria-hidden="true" onInvalid={event => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); }}>
      {children}
    </select>
    <FinanceSelect id={id} style={style} triggerRef={trigger} invalid={invalid} value={value} disabled={props.disabled} options={options} label={props['aria-label'] || props.title || 'Chọn một mục'} placeholder="Chọn một mục" className={`web-select-trigger ${className}`} onChange={next => {
      if (!native.current) return;
      native.current.value = next;
      if (props.value === undefined) setUncontrolledValue(next);
      setInvalid(false);
      native.current.dispatchEvent(new Event('change', { bubbles: true }));
    }}/>
  </>;
}
