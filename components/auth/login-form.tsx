"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Info } from "lucide-react";
import { useActionState, useId, useState, type FormEvent } from "react";
import { login, type LoginState } from "@/lib/actions/auth";
import { EASE_CARD } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<"email" | "password", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email: string, password: string): Errors {
  const errors: Errors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!EMAIL_RE.test(email.trim()))
    errors.email = "Enter an email address like name@council.gov.uk.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

const inputClass =
  "h-12 w-full rounded-sw border bg-white px-3.5 text-[1rem] text-ink placeholder:text-ink/40 transition-[border-color,box-shadow] duration-200 focus:outline-none focus:ring-2 focus:ring-ink/80 focus:ring-offset-1";

/*
  Log-in form. Submits to the login server action, which signs a session
  cookie and redirects into the builder. While the platform is a prototype
  every password is accepted – see checkCredentials in lib/auth.ts.
*/
export function LoginForm({ next = "/builder" }: { next?: string }) {
  const id = useId();
  const reduce = useReducedMotion() ?? false;
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  /* Client-side check first, so mistakes are caught without a round trip. */
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const found = validate(email, password);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      event.preventDefault();
      document.getElementById(`${id}-${found.email ? "email" : "password"}`)?.focus();
    }
  }

  const field = (name: keyof Errors) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });

  return (
    <form noValidate action={formAction} onSubmit={onSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-email`} className="text-[0.94rem] font-medium text-ink">
          Email
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errors.email) setErrors((previous) => ({ ...previous, email: undefined }));
          }}
          className={cn(
            inputClass,
            errors.email ? "border-coral" : "border-ink/20 hover:border-ink/35",
          )}
          {...field("email")}
        />
        {errors.email && (
          <p id={`${id}-email-error`} className="text-[0.82rem] text-ink">
            <span
              className="mr-1.5 inline-block size-1.5 rounded-full bg-coral align-middle"
              aria-hidden="true"
            />
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-password`} className="text-[0.94rem] font-medium text-ink">
            Password
          </label>
          <a
            href="mailto:team@smilingwolf.co.uk?subject=Openplan%20password%20reset"
            className="text-[0.82rem] text-ink/70 underline decoration-ink/30 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <input
            id={`${id}-password`}
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) setErrors((previous) => ({ ...previous, password: undefined }));
            }}
            className={cn(
              inputClass,
              "pr-12",
              errors.password ? "border-coral" : "border-ink/20 hover:border-ink/35",
            )}
            {...field("password")}
          />
          <button
            type="button"
            onClick={() => setShow((current) => !current)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-sw text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
          >
            {show ? (
              <EyeOff className="size-4.5" aria-hidden="true" />
            ) : (
              <Eye className="size-4.5" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.password && (
          <p id={`${id}-password-error`} className="text-[0.82rem] text-ink">
            <span
              className="mr-1.5 inline-block size-1.5 rounded-full bg-coral align-middle"
              aria-hidden="true"
            />
            {errors.password}
          </p>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-[0.94rem] text-ink/80">
        <input type="checkbox" name="remember" className="size-4 rounded-[3px] accent-[#131713]" />
        Keep me signed in on this device
      </label>

      <button
        type="submit"
        disabled={pending}
        className="group mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-sw bg-coral px-5 text-[1rem] font-medium text-ink transition-colors duration-300 hover:bg-peach focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Signing in…" : "Log in"}
        {!pending && (
          <ArrowRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        )}
      </button>

      <div aria-live="polite">
        <AnimatePresence>
          {state.error && (
            <motion.p
              role="status"
              className="text-[0.88rem] text-ink"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE_CARD }}
            >
              <span
                className="mr-1.5 inline-block size-1.5 rounded-full bg-coral align-middle"
                aria-hidden="true"
              />
              {state.error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <p className="flex gap-3 rounded-sw border border-ink/10 bg-paper p-3.5 text-[0.84rem] leading-snug text-ink/80">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Preview build – any password works for now, so you can get into the builder. Real accounts
          come later.
        </span>
      </p>
    </form>
  );
}
