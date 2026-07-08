type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="relative flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        ⌕
      </span>
      <input
        className="h-11 w-full rounded-md border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-navy-700 focus:ring-2 focus:ring-navy-700/15"
        placeholder="Buscar por cliente, CPF / CNPJ, número do processo ou parte contrária..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
