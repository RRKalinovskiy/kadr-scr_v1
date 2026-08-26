import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { restoreAuth } from "../session";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    void restoreAuth().then((r) => setOk(Boolean(r)));
  }, []);

  if (ok === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-deep text-sm font-semibold text-mist">
        Загрузка…
      </div>
    );
  }
  if (!ok) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
