import { HandleChangeForm } from '@/features/settings/HandleChangeForm';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

const SettingsPage = () => {
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="mx-auto max-w-lg space-y-10">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <HandleChangeForm />
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Account</h2>
        <Button variant="outline" onClick={logout}>Log out</Button>
      </div>
    </div>
  );
};

export default SettingsPage;