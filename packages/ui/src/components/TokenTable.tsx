import type { ReactNode } from "react";

export function TokenTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ path: string; value: string; extra?: ReactNode }>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
        Nenhum token em {title}.
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="max-h-[min(420px,50vh)] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-3 py-2 font-medium">Token</th>
              <th className="px-3 py-2 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.path} className="border-b border-zinc-100 dark:border-zinc-800/80">
                <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">{r.path}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {r.extra}
                    <span className="font-mono text-xs">{r.value}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
