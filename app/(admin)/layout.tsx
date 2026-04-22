import Link from "next/link";
import { logoutAction } from "../(admin-public)/admin/login/actions";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-gray-950 text-gray-100 font-mono">
      <aside className="w-48 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
            Admin
          </span>
          <div className="text-sm text-white mt-1">Voltius</div>
        </div>
        <nav className="flex flex-col gap-1 p-2 flex-1">
          <NavLink href="/admin/users">Users</NavLink>
          <NavLink href="/admin/stats">Stats</NavLink>
          <NavLink href="/admin/churn">Churn</NavLink>
          <NavLink href="/admin/audit">Audit Log</NavLink>
        </nav>
        <form action={logoutAction} className="p-2">
          <button
            type="submit"
            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded"
          >
            Logout
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded"
    >
      {children}
    </Link>
  );
}
