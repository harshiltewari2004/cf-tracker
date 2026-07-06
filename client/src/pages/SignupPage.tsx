import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { PASSWORD } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z
    .string()
    .min(PASSWORD.MIN_LENGTH, `At least ${PASSWORD.MIN_LENGTH} characters`),
});

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const signup = useAuthStore((s) => s.signup);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  const handleSignup = async ({ name, email, password }: SignupValues) => {
    try {
      await signup(name, email, password);
      // no navigate — GuestRoute bounces to /, RootRedirect sends new user to /onboarding/handle
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Something went wrong. Please try again.";
      setError("root", { message });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleSignup)} className="space-y-4">
      <div>
        <Input type="text" placeholder="Name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div>
        <Input type="email" placeholder="Email" {...register("email")} />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div>
        <Input
          type="password"
          placeholder="Password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>
      {errors.root && (
        <p className="text-sm text-destructive">{errors.root.message}</p>
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
