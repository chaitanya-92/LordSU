import { cn } from "../../lib/utils";
export function Input({className="",...props}){return <input className={cn("h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-foreground/15",className)} {...props}/>;}
