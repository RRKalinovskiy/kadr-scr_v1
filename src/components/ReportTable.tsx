import { formatCell, isNumericColumn, rowLabel, type ReportTableData } from "../statsCloud";

const LABEL_ALIASES = new Set(["Метод_Метод", "name0", "label", "Метод"]);

export default function ReportTable({ data }: { data: ReportTableData }) {
  const rows = data.rows ?? [];
  const columns = data.columns ?? [];

  if (data.error) {
    return (
      <div className="px-4 py-8 text-center text-ember text-sm">{data.error}</div>
    );
  }
  if (!rows.length) {
    return (
      <div className="px-4 py-8 text-center text-mist text-sm">Нет данных для отображения</div>
    );
  }

  const dimCol = columns.find((c) => LABEL_ALIASES.has(c)) ?? columns[0];
  const rest = columns.filter((c) => c !== dimCol);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left min-w-[720px]">
        <thead className="bg-deep/50 border-b border-line">
          <tr>
            <th className="px-4 py-3 text-[12px] font-bold text-mist uppercase tracking-wide whitespace-nowrap">
              {dimCol || "Измерение"}
            </th>
            {rest.map((c) => (
              <th
                key={c}
                className={`px-4 py-3 text-[12px] font-bold text-mist uppercase tracking-wide whitespace-nowrap ${
                  isNumericColumn(c, rows) ? "text-right" : ""
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const label = dimCol ? formatCell(row[dimCol]) : rowLabel(row);
            return (
              <tr key={idx} className="border-b border-line hover:bg-panel/60">
                <td className="px-4 py-3 text-[13px] text-fog font-mono font-semibold max-w-[320px] truncate" title={label}>
                  {label}
                </td>
                {rest.map((c) => {
                  const raw = row[c];
                  const numeric = isNumericColumn(c, rows);
                  const err = c.toLowerCase().includes("ошиб") && typeof raw === "number" && raw > 0;
                  return (
                    <td
                      key={c}
                      className={`px-4 py-3 text-[13px] ${numeric ? "text-right" : "text-fog"}`}
                    >
                      {err ? (
                        <span className="px-2 py-1 rounded text-[11px] font-semibold bg-ember/20 text-ember">
                          {formatCell(raw)}
                        </span>
                      ) : (
                        <span className={numeric ? "text-fog font-semibold" : "text-mist"}>{formatCell(raw)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
