import { type ComponentProps, forwardRef } from "react";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** The brand's one interactive shape: a hairline pill. See DESIGN.md. */
export const Button = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & { variant?: "primary" | "outline"; size?: "md" | "sm" }
>(function Button({ className, variant = "outline", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-pill font-sans text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none",
        size === "md" ? "px-4 py-2" : "px-3 py-1.5 text-[13px]",
        variant === "primary"
          ? "bg-primary text-on-primary hover:bg-ink-hover"
          : "bg-transparent text-ink border border-hairline-strong hover:bg-canvas-soft",
        className,
      )}
      {...props}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cx(
          "w-full rounded-card border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink placeholder:text-mute outline-none focus:border-ink-hover",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "rounded-card border border-hairline bg-canvas-card p-6",
        className,
      )}
      {...props}
    />
  );
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cx(
        "font-mono text-xs uppercase tracking-[1.4px] text-mute",
        className,
      )}
      {...props}
    />
  );
}
