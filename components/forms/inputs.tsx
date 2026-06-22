import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

const baseInputClass =
  "w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15 disabled:bg-slate-100 disabled:text-slate-500";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${baseInputClass} h-10`} {...props} />;
}

export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" className={`${baseInputClass} h-10`} {...props} />;
}

export function MoneyInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input inputMode="decimal" className={`${baseInputClass} h-10`} {...props} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${baseInputClass} h-10`} {...props} />;
}

export function TextareaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${baseInputClass} min-h-28 py-2`} {...props} />;
}
