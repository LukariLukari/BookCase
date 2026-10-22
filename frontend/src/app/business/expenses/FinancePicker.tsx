'use client';

import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import FinanceCategoryIcon from './FinanceCategoryIcon';

type SelectOption = { value: string; label: string; icon?: string; color?: string };

function PickerShell({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close]);

  return (
    <div className="finance-picker-backdrop" role="presentation" onMouseDown={close}>
      <section className="finance-picker-panel" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()}>
        <header className="finance-picker-header">
          <h3>{title}</h3>
          <button type="button" onClick={close} aria-label="Đóng bộ chọn"><X /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function FinanceSelect({ value, options, placeholder, label, compact = false, onChange }: {
  value: string;
  options: SelectOption[];
  placeholder: string;
  label: string;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.find(option => option.value === value);

  return (
    <>
      <button
        type="button"
        className={`finance-picker-trigger${compact ? ' finance-picker-trigger-compact' : ''}`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen(true)}
      >
        <span className={`finance-picker-trigger-value${!selected ? ' finance-picker-placeholder' : ''}`}>
          {selected?.icon && <FinanceCategoryIcon name={selected.icon} color={selected.color} />}
          <span>{selected?.label || placeholder}</span>
        </span>
        <ChevronDown />
      </button>
      {open && (
        <PickerShell title={label} close={() => setOpen(false)}>
          <div id={listId} role="listbox" aria-label={label} className="finance-picker-options">
            {options.map(option => {
              const active = option.value === value;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className="finance-picker-option"
                  key={option.value}
                  onClick={() => { onChange(option.value); setOpen(false); }}
                >
                  <span className="finance-picker-option-value">{option.icon && <FinanceCategoryIcon name={option.icon} color={option.color} />}<span>{option.label}</span></span>
                  {active && <Check />}
                </button>
              );
            })}
          </div>
        </PickerShell>
      )}
    </>
  );
}

const toDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : new Date();
};

const dateValue = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const todayValue = () => {
  const date = new Date();
  return dateValue(date.getFullYear(), date.getMonth(), date.getDate());
};

export function FinanceDatePicker({ value, label, compact = false, onChange }: {
  value: string;
  label: string;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const date = toDate(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const selected = toDate(value);
  const display = value
    ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(selected)
    : 'Chọn ngày';
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => index + 1);

  const show = () => {
    const date = toDate(value);
    setView(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(true);
  };

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`finance-picker-trigger${compact ? ' finance-picker-trigger-compact' : ''}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
      >
        <span>{display}</span>
        <CalendarDays />
      </button>
      {open && (
        <PickerShell title={label} close={() => setOpen(false)}>
          <div className="finance-calendar-nav">
            <button type="button" aria-label="Tháng trước" onClick={() => setView(new Date(year, month - 1, 1))}><ChevronLeft /></button>
            <strong>Tháng {month + 1}, {year}</strong>
            <button type="button" aria-label="Tháng sau" onClick={() => setView(new Date(year, month + 1, 1))}><ChevronRight /></button>
          </div>
          <div className="finance-calendar">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => <b key={day}>{day}</b>)}
            {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
            {days.map(day => {
              const next = dateValue(year, month, day);
              const active = next === value;
              const today = next === todayValue();
              return (
                <button type="button" key={next} aria-pressed={active} className={today ? 'is-today' : undefined} onClick={() => choose(next)}>
                  {day}
                </button>
              );
            })}
          </div>
          <footer className="finance-calendar-footer">
            <button type="button" onClick={() => choose(todayValue())}>Hôm nay</button>
            <button type="button" className="finance-calendar-done" onClick={() => setOpen(false)}><Check /> Xong</button>
          </footer>
        </PickerShell>
      )}
    </>
  );
}
