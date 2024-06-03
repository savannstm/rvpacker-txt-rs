export class Theme implements Theme {
    name: string;
    background: string;
    primary: string;
    outlinePrimary: string;
    outlineSecondary: string;
    outlineTertiary: string;
    outlineFocus: string;
    borderPrimary: string;
    borderSecondary: string;
    borderFocus: string;
    secondary: string;
    hoverPrimary: string;
    hoverSecondary: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    tertiary: string;

    constructor(name: string | undefined = undefined) {
        switch (name) {
            case "fuflo-light":
                this.name = "fuflo-light";
                this.background = "bg-zinc-100";
                this.primary = "bg-zinc-200";
                this.outlinePrimary = "outline-zinc-300";
                this.outlineSecondary = "outline-zinc-500";
                this.outlineTertiary = "outline-zinc-600";
                this.outlineFocus = "focus:outline-zinc-400";
                this.borderPrimary = "border-zinc-300";
                this.borderSecondary = "border-zinc-400";
                this.borderFocus = "focus:border-zinc-300";
                this.secondary = "bg-zinc-300";
                this.hoverPrimary = "hover:bg-zinc-400";
                this.hoverSecondary = "hover:bg-zinc-500";
                this.textPrimary = "text-zinc-900";
                this.textSecondary = "text-zinc-800";
                this.textTertiary = "text-zinc-700";
                this.tertiary = "bg-zinc-400";
                break;
            default:
            case "cool-zinc":
                this.name = "cool-zinc";
                this.background = "bg-zinc-900";
                this.primary = "bg-zinc-800";
                this.outlinePrimary = "outline-zinc-700";
                this.outlineSecondary = "outline-zinc-500";
                this.outlineTertiary = "outline-zinc-600";
                this.outlineFocus = "focus:outline-zinc-400";
                this.borderPrimary = "border-zinc-600";
                this.borderSecondary = "border-zinc-700";
                this.borderFocus = "focus:border-zinc-600";
                this.secondary = "bg-zinc-700";
                this.hoverPrimary = "hover:bg-zinc-600";
                this.hoverSecondary = "hover:bg-zinc-700";
                this.textPrimary = "text-zinc-300";
                this.textSecondary = "text-zinc-200";
                this.textTertiary = "text-zinc-400";
                this.tertiary = "bg-zinc-500";
                break;
        }
    }
}
