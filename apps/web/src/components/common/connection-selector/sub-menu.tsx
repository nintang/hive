import type { Connection } from "@/lib/connections/types"
import { ArrowSquareOutIcon, WrenchIcon } from "@phosphor-icons/react"
import Image from "next/image"

type SubMenuProps = {
  connection: Connection
}

export function ConnectionSubMenu({ connection }: SubMenuProps) {
  return (
    <div className="bg-popover border-border w-[280px] rounded-md border p-3 shadow-md">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="relative size-8 flex-shrink-0 overflow-hidden rounded">
            <Image
              src={connection.logo}
              alt={connection.name}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="flex flex-col">
            <h3 className="font-medium">{connection.name}</h3>
            <span className="text-muted-foreground text-xs">
              {connection.category}
            </span>
          </div>
        </div>

        <p className="text-muted-foreground text-sm">{connection.description}</p>

        <div className="mt-1 flex flex-wrap gap-2">
          <div className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-800 dark:text-purple-100">
            <WrenchIcon className="size-3" />
            <span>{connection.toolsCount} Tools</span>
          </div>

          {connection.connected && (
            <div className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-800 dark:text-green-100">
              <span className="size-1.5 rounded-full bg-green-500" />
              <span>Connected</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">Auth Methods</span>
            <span className="text-muted-foreground text-xs">
              {connection.authSchemes.length > 0
                ? connection.authSchemes.join(", ")
                : "No auth required"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">ID</span>
            <span className="text-muted-foreground truncate text-xs">
              {connection.slug}
            </span>
          </div>

          {connection.appUrl && (
            <div className="mt-4 flex items-center justify-end text-xs">
              <a
                href={connection.appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 hover:underline"
              >
                <span>Visit {connection.name}</span>
                <ArrowSquareOutIcon className="size-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
