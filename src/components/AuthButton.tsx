import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface Props {
  user: User | null;
}

export function AuthButton({ user }: Props) {
  const signIn = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = () => {
    supabase.auth.signOut();
  };

  if (user) {
    return (
      <div className="auth-status">
        <span>{user.email}</span>
        <button onClick={signOut}>ログアウト</button>
      </div>
    );
  }

  return <button onClick={signIn}>Googleでログイン</button>;
}
