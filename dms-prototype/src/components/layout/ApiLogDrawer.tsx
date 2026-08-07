/**
 * The Dev drawer — the header's terminal button.
 *
 * `uiStore.devDrawerOpen` has existed since Phase 0 and the button has been
 * toggling it ever since; the panel itself is Phase 7's, because the plan puts
 * the API log with the integration module. It is labelled a prototype
 * affordance for the same reason the role switcher is: it exists to make the
 * mock/real boundary visible during a demo, not because the product ships a
 * developer console.
 */

import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiLogTable, clearApiLog, useApiLog } from '@/modules/integration/ApiLogTable'
import { useUiStore } from '@/stores/uiStore'

export function ApiLogDrawer() {
  const open = useUiStore((s) => s.devDrawerOpen)
  const toggle = useUiStore((s) => s.toggleDevDrawer)
  const calls = useApiLog()

  return (
    <Sheet open={open} onOpenChange={() => toggle()}>
      {/* Width, not a fixed panel: the request URLs are long and truncating
          them would defeat the point of showing them. */}
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[820px]">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            xMart API call log
            <Badge variant="secondary">Prototype affordance</Badge>
          </SheetTitle>
          <SheetDescription>
            Every read and write in this session, with the request it would send to the real
            warehouse. DMS owns no master data — this is where you can watch that being true.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <ApiLogTable calls={calls} onClear={clearApiLog} compact />
        </div>

        <div className="border-t border-who-border px-4 py-3">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/integration" onClick={() => toggle()}>
              <ExternalLink className="size-3.5" />
              Open the integration page
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
