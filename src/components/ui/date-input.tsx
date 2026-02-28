import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  calendarAriaLabel?: string;
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, calendarAriaLabel, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Combine refs
    React.useImperativeHandle(ref, () => inputRef.current!);

    const handleIconClick = () => {
      if (inputRef.current) {
        // Try to use showPicker API (modern browsers)
        if (typeof inputRef.current.showPicker === "function") {
          try {
            inputRef.current.showPicker();
          } catch {
            inputRef.current.focus();
          }
        } else {
          inputRef.current.focus();
        }
      }
    };

    return (
      <div className="relative">
        <Input
          type="date"
          className={cn("date-input-custom pr-10", className)}
          ref={inputRef}
          {...props}
        />
        <button
          type="button"
          aria-label={calendarAriaLabel || "Pick a date"}
          onClick={handleIconClick}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground dark:text-white"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>
    );
  }
);

DateInput.displayName = "DateInput";

export { DateInput };
