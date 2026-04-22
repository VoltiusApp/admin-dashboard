import { loginAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  credentials: "Invalid email or password.",
  not_admin: "This account does not have admin access.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMsg = error ? (ERROR_MESSAGES[error] ?? "Login failed.") : null;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center font-mono">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
            Admin
          </span>
          <h1 className="text-2xl text-white mt-1">Voltius Dashboard</h1>
        </div>
        {errorMsg && (
          <p className="text-sm text-red-400 mb-2 bg-red-900/20 border border-red-800 rounded px-3 py-2">
            {errorMsg}
          </p>
        )}
        <form action={loginAction} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            />
          </div>
          <button
            type="submit"
            className="mt-2 bg-white text-black font-bold rounded px-4 py-2 text-sm hover:bg-gray-200"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
