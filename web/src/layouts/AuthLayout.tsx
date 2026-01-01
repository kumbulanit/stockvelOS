import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Stockvel OS</h1>
          <p className="text-muted-foreground mt-2">Savings Group Management</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
