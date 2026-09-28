export function Card({children,className=""}){return <div className={`rounded-2xl border bg-card shadow-sm ${className}`}>{children}</div>}
export function CardHeader({children}){return <div className="p-6 pb-3">{children}</div>}
export function CardContent({children}){return <div className="p-6 pt-3">{children}</div>}
