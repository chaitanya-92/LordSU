import { cn } from "../../lib/utils";

export function Button({className="",variant="default",size="default",...props}){
  const variants={
    default:"bg-foreground text-background hover:opacity-90",
    outline:"border bg-background hover:bg-muted",
    ghost:"hover:bg-muted"
  };
  const sizes={default:"h-10 px-4",sm:"h-9 px-3",lg:"h-11 px-6"};
  return <button className={cn("inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",variants[variant],sizes[size],className)} {...props}/>;
}
