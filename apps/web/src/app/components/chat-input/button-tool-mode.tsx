import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { StackIcon, StackSimpleIcon } from "@phosphor-icons/react"

export type ToolMode = "single" | "multi"

type ButtonToolModeProps = {
  mode: ToolMode
  onToggle: (mode: ToolMode) => void
  disabled?: boolean
}

export function ButtonToolMode({
  mode,
  onToggle,
  disabled = false,
}: ButtonToolModeProps) {
  const isMulti = mode === "multi"

  const handleClick = () => {
    onToggle(isMulti ? "single" : "multi")
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className={cn(
            "border-border dark:bg-secondary rounded-full border bg-transparent transition-all duration-150 has-[>svg]:px-1.75 md:has-[>svg]:px-3",
            isMulti &&
              "border-[#8B5CF6]/20 bg-[#F3E8FF] text-[#8B5CF6] hover:bg-[#F3E8FF] hover:text-[#8B5CF6]"
          )}
          onClick={handleClick}
          disabled={disabled}
        >
          {isMulti ? (
            <StackIcon className="size-5" weight="fill" />
          ) : (
            <StackSimpleIcon className="size-5" />
          )}
          <span className="hidden md:block">{isMulti ? "Multi" : "Single"}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {isMulti
          ? "Multi-tool mode: Use multiple tools together"
          : "Single-tool mode: Use one tool at a time"}
      </TooltipContent>
    </Tooltip>
  )
}
